/**
 * unifiedForecastEngine.ts
 * UFE v1 (Unified Forecast Engine)
 * Единый квантовый движок прогнозных линий терминала QUANTEX.
 * 
 * Объединяет:
 * 1. 7 слоёв консенсуса с динамическими весами:
 *    - L1 GEX (0.18)
 *    - L2 Volume Profile (0.18)
 *    - L3 Liquidity Pools (0.16)
 *    - L4 Order Flow / CVD (0.14)
 *    - L5 Smart Money Concepts / Structure (0.14)
 *    - L6 Session Timing & ADR (0.10)
 *    - L7 Legacy Wave / Pine Engine (0.10)
 *    Сумма весов = 1.00
 * 
 * 2. Правила арбитража и голосования:
 *    (а) Согласие моделей -> основной сетап по правилам CLL
 *    (б) Расхождение + CLL score >= 0.80 + L1 GEX подтверждает -> CLL доминирует
 *    (в) Расхождение + CLL score [0.70, 0.80) -> статус BLOCKED (конфликт моделей) с сохранением лестницы и триггером разблокировки
 *    (г) Расхождение + GEX миграция в сторону Wave -> арбитр выбирает Wave
 *    (д) <50 свечей / нет prop context -> DEGRADED (только Legacy wave)
 * 
 * 3. Система допусков (Permission-Based Ladder):
 *    TRADEABLE | CONDITIONAL | BLOCKED | SCALP | DEGRADED | IN_POSITION
 * 
 * 4. Анти-фликер:
 *    Смена состояния TRADEABLE <-> BLOCKED требует подтверждения (3 опроса или закрытие бара, не чаще 1 в 2 мин)
 * 
 * 5. ПОСТОЯННАЯ ОТРИСОВКА:
 *    Всегда возвращает полную лестницу (entryZone, entryMid, sl, tp1, tp2, tp3).
 *    Прогноз НИКОГДА не равен null или пустой структуре.
 */

import {
  computeConfluenceSetup,
  ConfluenceSetupResult,
  ConfluenceTarget,
  ConfluencePlanB,
  CandleLike,
  computeVolumeProfile,
  detectLiquidityPools
} from "./confluenceEngine";
import { getSessionSchedule, SessionSchedule } from "./marketSessions";
import { calcATR } from "./pineSuperIndicatorEngine";

export type UnifiedPermissionState =
  | "TRADEABLE"
  | "CONDITIONAL"
  | "BLOCKED"
  | "SCALP"
  | "DEGRADED"
  | "IN_POSITION";

export type UnifiedLayerId = "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";

export interface UnifiedLayer {
  id: UnifiedLayerId;
  name: string;
  bias: "LONG" | "SHORT" | "NEUTRAL";
  zone: [number, number];
  weight: number;
  tag: string;
  active: boolean;
  rationale: string;
}

export interface UnifiedPermission {
  state: UnifiedPermissionState;
  reasons: string[];
  primaryReason: string;
  unblockTrigger: string;
  score: number;
  activeLayers: UnifiedLayer[];
  allLayers: UnifiedLayer[];
  arbiterNote: string;
}

export interface UnifiedForecastResult {
  symbol: string;
  timeframe: string;
  timestamp: number;
  direction: "LONG" | "SHORT" | "NONE";
  entryZone: [number, number];
  entryMid: number;
  sl: number;
  riskR: number;
  riskAtrRatio: number;
  atr: number;
  tp1: ConfluenceTarget;
  tp2: ConfluenceTarget;
  tp3: ConfluenceTarget;
  planB: ConfluencePlanB | null;
  permission: UnifiedPermission;
  stateProgression: {
    stage: "ST0" | "ST1" | "TP1" | "TP2" | "TRAIL" | "EXPIRED" | "STOP";
    barsSinceEntry: number;
  };
  isScalpMode: boolean;
  cllSetup: ConfluenceSetupResult | null;
  legacyWave: {
    direction: "LONG" | "SHORT" | "NONE";
    entry: number;
    sl: number;
    tp1: number;
    tp2: number;
    confidence?: number;
  } | null;
}

export interface UnifiedForecastParams {
  candles: CandleLike[];
  gexReport?: any;
  schedule?: SessionSchedule;
  adrPct?: number;
  symbol?: string;
  timeframe?: string;
  currentPrice?: number;
  tickSize?: number;
  legacyWave?: {
    direction: "LONG" | "SHORT" | "NONE";
    entry: number;
    sl: number;
    tp1: number;
    tp2: number;
    confidence?: number;
    status?: string;
  } | null;
  dynamicWeights?: Record<UnifiedLayerId, number>;
  now?: number;
}

// Дефолтные веса 7 слоёв UFE v1 (сумма = 1.00)
export const DEFAULT_UFE_WEIGHTS: Record<UnifiedLayerId, number> = {
  L1: 0.18, // GEX опционы
  L2: 0.18, // Volume Profile 70% VA
  L3: 0.16, // Liquidity Pools (EQH/EQL/PDH/PDL)
  L4: 0.14, // Order Flow / CVD / Absorption
  L5: 0.14, // SMC структура & свипы
  L6: 0.10, // Session Timing & ADR
  L7: 0.10  // Legacy Wave (Pine Engine)
};

// Хранилище состояния анти-фликера
interface AntiFlickerEntry {
  lastState: UnifiedPermissionState;
  candidateState: UnifiedPermissionState;
  candidateCount: number;
  lastTransitionTime: number;
}

const antiFlickerCache = new Map<string, AntiFlickerEntry>();

export function clearUfeAntiFlickerCache(): void {
  antiFlickerCache.clear();
}

/**
 * Анти-фликер фильтр переходов между TRADEABLE и BLOCKED
 */
function applyAntiFlicker(
  key: string,
  rawState: UnifiedPermissionState,
  now: number
): UnifiedPermissionState {
  let entry = antiFlickerCache.get(key);
  if (!entry) {
    entry = {
      lastState: rawState,
      candidateState: rawState,
      candidateCount: 1,
      lastTransitionTime: now
    };
    antiFlickerCache.set(key, entry);
    return rawState;
  }

  // Если состояние не изменилось
  if (rawState === entry.lastState) {
    entry.candidateState = rawState;
    entry.candidateCount = 1;
    return entry.lastState;
  }

  // Защита от дребезга (анти-фликер): переключение между состояниями
  // (особенно TRADEABLE <-> BLOCKED / CONDITIONAL) требует либо 3 опроса подряд с новым состоянием,
  // либо истечение 2 минут (120 000 мс) без изменений. Одиночные скачки не меняют состояние.
  const elapsedMs = now - entry.lastTransitionTime;
  if (rawState === entry.candidateState) {
    entry.candidateCount++;
  } else {
    entry.candidateState = rawState;
    entry.candidateCount = 1;
  }

  // Подтверждение: 3 опроса подряд ИЛИ прошло >= 2 минут (120 000 мс)
  if (entry.candidateCount >= 3 || elapsedMs >= 120000) {
    entry.lastState = rawState;
    entry.lastTransitionTime = now;
    entry.candidateCount = 1;
    return rawState;
  }

  // До подтверждения удерживаем прежнее состояние
  return entry.lastState;
}

/**
 * Главный метод UFE v1: computeUnifiedForecast
 */
export function computeUnifiedForecast(params: UnifiedForecastParams): UnifiedForecastResult {
  const {
    candles,
    gexReport,
    schedule = getSessionSchedule(new Date()),
    adrPct = 50,
    symbol = "XAUUSD",
    timeframe = "15m",
    currentPrice,
    tickSize = 0.01,
    legacyWave = null,
    dynamicWeights,
    now = Date.now()
  } = params;

  const weights = { ...DEFAULT_UFE_WEIGHTS, ...(dynamicWeights || {}) };
  const lastCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const spot = currentPrice ?? (lastCandle ? lastCandle.close : 4000);

  // Расчет ATR
  let atr = 15;
  if (candles && candles.length >= 14) {
    const atrArr = calcATR(candles as any, 14);
    atr = atrArr[atrArr.length - 1] || 15;
  }
  if (!isFinite(atr) || atr <= 0) atr = 15;

  const key = `${symbol}_${timeframe}`;

  // 1. ПРОВЕРКА РЕЖИМА DEGRADED (< 50 свечей)
  if (!candles || candles.length < 50) {
    const legDir = legacyWave?.direction && legacyWave.direction !== "NONE" ? legacyWave.direction : "LONG";
    const entryMid = legacyWave?.entry && isFinite(legacyWave.entry) ? legacyWave.entry : spot;
    const entryZone: [number, number] = [entryMid - 0.2 * atr, entryMid + 0.2 * atr];
    const sl = legacyWave?.sl && isFinite(legacyWave.sl) ? legacyWave.sl : (legDir === "LONG" ? entryMid - 1.0 * atr : entryMid + 1.0 * atr);
    const tp1Price = legacyWave?.tp1 && isFinite(legacyWave.tp1) ? legacyWave.tp1 : (legDir === "LONG" ? entryMid + 1.5 * atr : entryMid - 1.5 * atr);
    const tp2Price = legacyWave?.tp2 && isFinite(legacyWave.tp2) ? legacyWave.tp2 : (legDir === "LONG" ? entryMid + 2.6 * atr : entryMid - 2.6 * atr);
    const tp3Price = legDir === "LONG" ? entryMid + 3.8 * atr : entryMid - 3.8 * atr;

    const riskR = Math.abs(entryMid - sl);

    const l7Layer: UnifiedLayer = {
      id: "L7",
      name: "Legacy Wave Engine",
      bias: legDir,
      zone: entryZone,
      weight: weights.L7,
      tag: "[Wave]",
      active: true,
      rationale: "Волновой анализ Pine Super Indicator (единственный активный слой)"
    };

    const degradedPerm: UnifiedPermission = {
      state: "DEGRADED",
      reasons: ["Недостаточно данных для микроструктуры (< 50 свечей)"],
      primaryReason: "Недостаточно свечей (< 50)",
      unblockTrigger: "Накопление 50 баров истории",
      score: weights.L7,
      activeLayers: [l7Layer],
      allLayers: [l7Layer],
      arbiterNote: "DEGRADED: только волновой анализ"
    };

    return {
      symbol,
      timeframe,
      timestamp: now,
      direction: legDir,
      entryZone,
      entryMid,
      sl,
      riskR,
      riskAtrRatio: riskR / atr,
      atr,
      tp1: { price: tp1Price, tag: "[Wave TP1]", r: 1.5 },
      tp2: { price: tp2Price, tag: "[Wave TP2]", r: 2.6 },
      tp3: { price: tp3Price, tag: "[Wave TP3 runner]", r: 3.8 },
      planB: null,
      permission: degradedPerm,
      stateProgression: { stage: "ST0", barsSinceEntry: 0 },
      isScalpMode: false,
      cllSetup: null,
      legacyWave
    };
  }

  // 2. ВЫЧИСЛЕНИЕ CLL СЕТАПА (СЛОИ 1..6)
  const cllSetup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    adrPct,
    symbol,
    timeframe,
    currentPrice: spot,
    tickSize
  });

  // Преобразуем слои CLL в UnifiedLayers с весами UFE
  const cllLayers: UnifiedLayer[] = cllSetup.allLayers.map(l => ({
    id: l.id as UnifiedLayerId,
    name: l.name,
    bias: l.bias,
    zone: l.zone,
    weight: weights[l.id as UnifiedLayerId] || l.weight,
    tag: l.tag,
    active: l.active,
    rationale: l.rationale
  }));

  // 3. ДОБАВЛЕНИЕ СЛОЯ L7 (Legacy Wave)
  const legDir = legacyWave?.direction || "NONE";
  const cllDir = cllSetup.direction;
  const targetDir = cllDir !== "NONE" ? cllDir : (legDir !== "NONE" ? legDir : "LONG");

  const l7Active = legDir !== "NONE" && (legDir === targetDir);
  const l7Zone: [number, number] = legacyWave?.entry
    ? [legacyWave.entry - 0.15 * atr, legacyWave.entry + 0.15 * atr]
    : [spot - 0.15 * atr, spot + 0.15 * atr];

  const l7Layer: UnifiedLayer = {
    id: "L7",
    name: "Legacy Wave Engine",
    bias: legDir === "LONG" || legDir === "SHORT" ? legDir : "NEUTRAL",
    zone: l7Zone,
    weight: weights.L7,
    tag: "[Wave]",
    active: l7Active,
    rationale: l7Active
      ? `Wave подтверждает направление ${legDir} (conf ${legacyWave?.confidence ?? 70}%)`
      : `Wave ${legDir === "NONE" ? "нейтрален" : `расходится (${legDir} vs ${targetDir})`}`
  };

  const allLayers = [...cllLayers, l7Layer];
  const activeLayers = allLayers.filter(l => l.active);

  // Суммарный score 7 слоёв
  const totalScore = Math.min(1.0, activeLayers.reduce((sum, l) => sum + l.weight, 0));

  // 4. ПРАВИЛА АРБИТРАЖА И ГОЛОСОВАНИЯ
  let decidedDirection: "LONG" | "SHORT" | "NONE" = cllDir;
  let arbiterNote = "Согласие моделей (CLL + Wave)";
  let isModelConflict = false;
  let modelConflictTrigger = "";

  const l1GexActive = cllLayers.find(l => l.id === "L1")?.active ?? false;

  if (cllDir !== "NONE" && legDir !== "NONE" && cllDir !== legDir) {
    // Направления расходятся
    if (cllSetup.score >= 0.80 && l1GexActive) {
      // Правило (б): CLL score >= 0.80 и L1 подтверждает -> CLL доминирует
      decidedDirection = cllDir;
      arbiterNote = "Арбитраж: CLL доминирует (расхождение с wave)";
    } else if (cllSetup.score >= 0.70 && cllSetup.score < 0.80) {
      // Правило (в): CLL score [0.70, 0.80) -> BLOCKED
      decidedDirection = cllDir;
      isModelConflict = true;
      arbiterNote = `Конфликт моделей: CLL (${cllDir}) vs Wave (${legDir}) при S=${totalScore.toFixed(2)}`;
      modelConflictTrigger = cllDir === "LONG"
        ? `Пробой максимума ${cllSetup.entryZone[1].toFixed(2)} или свип ${cllSetup.entryZone[0].toFixed(2)}`
        : `Пробой минимума ${cllSetup.entryZone[0].toFixed(2)} или свип ${cllSetup.entryZone[1].toFixed(2)}`;
    } else {
      // Проверка миграции стены GEX в сторону Wave (правило г)
      const gexRegime = gexReport?.regime || "";
      const isGexWaveShift =
        (legDir === "LONG" && (gexRegime.includes("BULL") || (gexReport?.callWall && spot > gexReport.callWall))) ||
        (legDir === "SHORT" && (gexRegime.includes("BEAR") || (gexReport?.putWall && spot < gexReport.putWall)));

      if (isGexWaveShift) {
        decidedDirection = legDir;
        arbiterNote = "Арбитраж: Выбрано направление Wave по миграции GEX";
      } else {
        decidedDirection = cllDir;
        arbiterNote = "Арбитраж: Оценка по доминирующему весу слоёв";
      }
    }
  } else if (cllDir === "NONE" && legDir !== "NONE") {
    decidedDirection = legDir;
    arbiterNote = "Арбитраж: Использовано направление Legacy Wave (CLL нейтрален)";
  } else if (cllDir !== "NONE") {
    decidedDirection = cllDir;
    arbiterNote = legDir === cllDir ? "Согласие моделей (CLL + Wave)" : "CLL активен";
  } else {
    decidedDirection = "LONG"; // дефолтная монотонная сетка при нейтральном рынке
    arbiterNote = "Нейтральный рынок: дефолтная сетка ликвидности";
  }

  // 5. ПОСТРОЕНИЕ ПОЛНОЙ ГАРАНТИРОВАННОЙ ЛЕСТНИЦЫ (НЕ МОЖЕТ БЫТЬ ПУСТОЙ)
  let entryZone: [number, number];
  let entryMid: number;
  let sl: number;
  let tp1: ConfluenceTarget;
  let tp2: ConfluenceTarget;
  let tp3: ConfluenceTarget;
  let planB = cllSetup.planB;

  if (cllSetup.status !== "NO_TRADE" && cllSetup.entryZone && isFinite(cllSetup.entryZone[0])) {
    entryZone = [cllSetup.entryZone[0], cllSetup.entryZone[1]];
    entryMid = cllSetup.entryMid;
    sl = cllSetup.sl;
    tp1 = cllSetup.tp1 || {
      price: decidedDirection === "LONG" ? entryMid + 1.5 * Math.abs(entryMid - sl) : entryMid - 1.5 * Math.abs(entryMid - sl),
      tag: "[CLL TP1]",
      r: 1.5
    };
    tp2 = cllSetup.tp2 || {
      price: decidedDirection === "LONG" ? tp1.price + 0.9 * atr : tp1.price - 0.9 * atr,
      tag: "[CLL TP2]",
      r: 2.6
    };
    tp3 = cllSetup.tp3 || {
      price: decidedDirection === "LONG" ? tp2.price + 1.2 * atr : tp2.price - 1.2 * atr,
      tag: "[CLL TP3 runner]",
      r: 3.8
    };
  } else {
    // Синтез лестницы по инвариантам UFE от POC / спота
    const vp = computeVolumeProfile(candles);
    const pools = detectLiquidityPools(candles);
    const anchor = vp?.poc || spot;

    const span = Math.max(0.2 * atr, 4 * tickSize);
    entryMid = anchor;
    entryZone = [entryMid - span, entryMid + span];

    const baseR = Math.max(0.6 * atr, Math.min(1.6 * atr, 1.0 * atr));
    if (decidedDirection === "LONG") {
      // Ищем ближайший EQL пул ниже входа для безопасного SL
      const unSweptEql = pools.filter(p => !p.swept && (p.type === "EQL" || p.type === "PDL") && p.price < entryMid);
      const nearestPool = unSweptEql.sort((a, b) => b.price - a.price)[0];
      const buffer = Math.max(0.25 * atr, 5 * tickSize);
      sl = nearestPool ? nearestPool.price - buffer : entryMid - baseR;
      const actualR = Math.abs(entryMid - sl);

      const targetTp1 = entryMid + Math.max(1.5 * actualR, 1.2 * atr);
      const targetTp2 = targetTp1 + Math.max(0.8 * atr, 1.1 * actualR);
      const targetTp3 = targetTp2 + 1.2 * atr;

      tp1 = { price: targetTp1, tag: "[UFE TP1]", r: Number((Math.abs(targetTp1 - entryMid) / actualR).toFixed(2)) };
      tp2 = { price: targetTp2, tag: "[UFE TP2]", r: Number((Math.abs(targetTp2 - entryMid) / actualR).toFixed(2)) };
      tp3 = { price: targetTp3, tag: "[UFE TP3 runner]", r: Number((Math.abs(targetTp3 - entryMid) / actualR).toFixed(2)) };
    } else {
      // SHORT
      const unSweptEqh = pools.filter(p => !p.swept && (p.type === "EQH" || p.type === "PDH") && p.price > entryMid);
      const nearestPool = unSweptEqh.sort((a, b) => a.price - b.price)[0];
      const buffer = Math.max(0.25 * atr, 5 * tickSize);
      sl = nearestPool ? nearestPool.price + buffer : entryMid + baseR;
      const actualR = Math.abs(entryMid - sl);

      const targetTp1 = entryMid - Math.max(1.5 * actualR, 1.2 * atr);
      const targetTp2 = targetTp1 - Math.max(0.8 * atr, 1.1 * actualR);
      const targetTp3 = targetTp2 - 1.2 * atr;

      tp1 = { price: targetTp1, tag: "[UFE TP1]", r: Number((Math.abs(entryMid - targetTp1) / actualR).toFixed(2)) };
      tp2 = { price: targetTp2, tag: "[UFE TP2]", r: Number((Math.abs(entryMid - targetTp2) / actualR).toFixed(2)) };
      tp3 = { price: targetTp3, tag: "[UFE TP3 runner]", r: Number((Math.abs(entryMid - targetTp3) / actualR).toFixed(2)) };
    }
  }

  const riskR = Math.abs(entryMid - sl);
  const riskAtrRatio = riskR / atr;

  // 6. ОПРЕДЕЛЕНИЕ СТАТУСА ДОПУСКА (PERMISSION-BASED LADDER)
  const reasons: string[] = [];
  let rawState: UnifiedPermissionState = "TRADEABLE";
  let primaryReason = "Условия соблюдены";
  let unblockTrigger = "Вход лимитным ордером в зоне";

  const isPositionActive =
    cllSetup.status === "ST1_ACTIVE" ||
    cllSetup.status === "TP1_HIT" ||
    cllSetup.status === "TP2_HIT" ||
    cllSetup.status === "TRAIL";

  if (isPositionActive) {
    rawState = "IN_POSITION";
    primaryReason = "Позиция активна (вход взят)";
    unblockTrigger = "Сопровождение до TP/SL";
  } else if (cllSetup.gates.newsBlock) {
    rawState = "BLOCKED";
    reasons.push(cllSetup.gates.newsDetails || "Новостное макро-окно (высокая волатильность)");
    primaryReason = "Новостное окно";
    unblockTrigger = "Истечение окна ±15 мин от выхода новости";
  } else if (isModelConflict) {
    rawState = "BLOCKED";
    reasons.push("Конфликт моделей CLL vs Wave");
    primaryReason = "Конфликт моделей CLL vs Wave";
    unblockTrigger = modelConflictTrigger;
  } else if (!cllSetup.gates.regimeAllow) {
    rawState = "BLOCKED";
    reasons.push(cllSetup.gates.regimeDetails || "Гейт опционного режима блокирует вход");
    primaryReason = "Опционный режим GEX";
    unblockTrigger = "Смена режима или возврат цены к Flip";
  } else if (adrPct >= 85) {
    // ADR > 85%
    if (cllSetup.isScalpMode) {
      rawState = "SCALP";
      primaryReason = "ADR > 85%: разрешён только скальп к TP1";
      unblockTrigger = "Фиксация на TP1";
    } else {
      rawState = "BLOCKED";
      reasons.push("ADR > 85% исчерпан для пробойного входа");
      primaryReason = "ADR > 85% исчерпан";
      unblockTrigger = "Откат от экстремума дня либо новая сессия";
    }
  } else if (totalScore < 0.70 || activeLayers.length < 4) {
    rawState = "CONDITIONAL";
    const missing = 4 - activeLayers.length;
    reasons.push(`Score S=${totalScore.toFixed(2)} (<0.70) или активных слоёв ${activeLayers.length}/7 (нужно >=4)`);
    primaryReason = `Недостаточно подтверждений (${activeLayers.length}/7 слоёв)`;
    unblockTrigger = "Ждать свип пула или подтверждение дельты";
  } else if (!l1GexActive && !cllLayers.find(l => l.id === "L2")?.active) {
    rawState = "CONDITIONAL";
    reasons.push("Отсутствует подтверждение институциональных уровней (L1 GEX или L2 VP)");
    primaryReason = "Нет привязки к GEX или POC";
    unblockTrigger = "Тест границы Value Area или опционной стены";
  }

  // 7. ПРИМЕНЕНИЕ АНТИ-ФЛИКЕРА
  const finalState = applyAntiFlicker(key, rawState, now);

  const permission: UnifiedPermission = {
    state: finalState,
    reasons,
    primaryReason: finalState === rawState ? primaryReason : `Стабилизация: ${primaryReason}`,
    unblockTrigger,
    score: totalScore,
    activeLayers,
    allLayers,
    arbiterNote
  };

  return {
    symbol,
    timeframe,
    timestamp: now,
    direction: decidedDirection,
    entryZone,
    entryMid,
    sl,
    riskR,
    riskAtrRatio,
    atr,
    tp1,
    tp2,
    tp3,
    planB,
    permission,
    stateProgression: {
      stage: cllSetup.stateProgression?.stage || "ST0",
      barsSinceEntry: cllSetup.stateProgression?.barsSinceEntry || 0
    },
    isScalpMode: finalState === "SCALP" || cllSetup.isScalpMode,
    cllSetup,
    legacyWave
  };
}
