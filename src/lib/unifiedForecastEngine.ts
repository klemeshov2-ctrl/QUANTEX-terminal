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
 *    TRADEABLE | CONDITIONAL | BLOCKED | SCALP | DEGRADED | IN_POSITION | EXPIRED
 * 
 * 4. Инварианты направления:
 *    LONG:  sl < entryMid < tp1 < tp2 < tp3
 *    SHORT: sl > entryMid > tp1 > tp2 > tp3
 *    Если нарушен: лестница блокируется (BLOCKED)
 * 
 * 5. Управляемый стоп (managedSl):
 *    ST0/ST1: sl (начальный)
 *    TP1_HIT: BE + 0.15R
 *    TP2_HIT / TRAIL: трейлинг за структурой
 */

import {
  computeConfluenceSetup,
  ConfluenceSetupResult,
  ConfluenceTarget,
  ConfluencePlanB,
  CandleLike,
  computeVolumeProfile,
  detectLiquidityPools,
  VolumeProfileResult,
  LiquidityPoolItem
} from "./confluenceEngine";
import { getSessionSchedule, SessionSchedule } from "./marketSessions";
import { calcATR } from "./pineSuperIndicatorEngine";

export type UnifiedPermissionState =
  | "TRADEABLE"
  | "CONDITIONAL"
  | "BLOCKED"
  | "SCALP"
  | "DEGRADED"
  | "IN_POSITION"
  | "EXPIRED";

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

export interface UnifiedPermissionReason {
  code: string;
  text: string;
  unblockTrigger?: string;
}

export interface UnifiedPermission {
  state: UnifiedPermissionState;
  reasons: string[];
  reasonsDetailed?: UnifiedPermissionReason[];
  primaryReason: string;
  unblockTrigger: string;
  score: number;
  activeLayers: UnifiedLayer[];
  allLayers: UnifiedLayer[];
  arbiterNote: string;
}

export interface PoolChip {
  id: string;
  type: string;
  price: number;
  volume: number;
  distancePts: number;
  label: string;
}

export interface UnifiedForecastResult {
  symbol: string;
  timeframe: string;
  timestamp: number;
  direction: "LONG" | "SHORT" | "NONE";
  entryZone: [number, number];
  entryMid: number;
  sl: number;
  managedSl: number;
  riskR: number;
  riskAtrRatio: number;
  atr: number;
  tp1: ConfluenceTarget;
  tp2: ConfluenceTarget | null;
  tp3: ConfluenceTarget | null;
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
  poolsChips: PoolChip[];
  vp?: VolumeProfileResult | null;
  adr?: {
    available: boolean;
    adr14: number | null;
    todayRange: number;
    usedPct: number | null;
  } | null;
  scheduleLabel?: string;
  stateHistoryLast5?: Array<{ state: UnifiedPermissionState; timestamp: number }>;
  nextSetup?: UnifiedForecastResult | null;
  invariantValid: boolean;
}

export interface UnifiedForecastParams {
  candles: CandleLike[];
  gexReport?: any;
  schedule?: SessionSchedule;
  adrPct?: number;
  adr?: {
    available: boolean;
    adr14: number | null;
    todayRange: number;
    usedPct: number | null;
  } | null;
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
  stateProgressionOverride?: {
    stage: "ST0" | "ST1" | "TP1" | "TP2" | "TRAIL" | "EXPIRED" | "STOP";
    barsSinceEntry: number;
  };
  skipStateTracking?: boolean;
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

// Хранилище истории состояний UFE
const stateHistoryMap = new Map<string, Array<{ state: UnifiedPermissionState; timestamp: number }>>();

export function recordStateHistory(key: string, state: UnifiedPermissionState, now: number): Array<{ state: UnifiedPermissionState; timestamp: number }> {
  let hist = stateHistoryMap.get(key) || [];
  if (hist.length === 0 || hist[hist.length - 1].state !== state) {
    hist.push({ state, timestamp: now });
    if (hist.length > 5) hist = hist.slice(-5);
    stateHistoryMap.set(key, hist);
  }
  return hist;
}

/**
 * Проверка инвариантов направления:
 * LONG:  sl < entryMid < tp1 < tp2 < tp3
 * SHORT: sl > entryMid > tp1 > tp2 > tp3
 */
export function validateLadderInvariant(
  direction: "LONG" | "SHORT" | "NONE",
  entryMid: number,
  sl: number,
  tp1?: number | null,
  tp2?: number | null,
  tp3?: number | null
): boolean {
  if (direction === "NONE") return true;

  if (direction === "LONG") {
    if (sl >= entryMid) return false;
    if (tp1 != null && tp1 <= entryMid) return false;
    if (tp2 != null && tp1 != null && tp2 <= tp1) return false;
    if (tp3 != null && tp2 != null && tp3 <= tp2) return false;
    if (tp3 != null && tp1 != null && tp2 == null && tp3 <= tp1) return false;
    return true;
  }

  if (direction === "SHORT") {
    if (sl <= entryMid) return false;
    if (tp1 != null && tp1 >= entryMid) return false;
    if (tp2 != null && tp1 != null && tp2 >= tp1) return false;
    if (tp3 != null && tp2 != null && tp3 >= tp2) return false;
    if (tp3 != null && tp1 != null && tp2 == null && tp3 >= tp1) return false;
    return true;
  }

  return true;
}

/**
 * Дедупликация пулов ликвидности для отображения в чипах:
 * Пулы ближе чем max(2 пункта, 0.02%) объединяются в один кластер.
 * Суммируется объем, взвешивается цена, тип берется от наибольшего объема.
 * Возвращается максимум 6 чипов, отсортированных по близости к текущей цене.
 */
export function deduplicatePoolsForChips(
  pools: Array<LiquidityPoolItem | { type: string; price: number; volume?: number; swept?: boolean }>,
  currentPrice: number
): PoolChip[] {
  if (!pools || pools.length === 0) return [];

  // Фильтруем только активные (несметенные) пулы
  const unswept = pools.filter(p => !p.swept && isFinite(p.price) && p.price > 0);
  if (unswept.length === 0) return [];

  const threshold = Math.max(2.0, currentPrice * 0.0002);

  // Сортируем по цене для кластеризации
  const sorted = [...unswept].sort((a, b) => a.price - b.price);

  interface Cluster {
    items: Array<{ type: string; price: number; volume: number }>;
  }

  const clusters: Cluster[] = [];
  let currentCluster: Cluster | null = null;

  for (const item of sorted) {
    const vol = (item as any).volume && (item as any).volume > 0 ? (item as any).volume : 100;
    if (!currentCluster) {
      currentCluster = { items: [{ type: item.type, price: item.price, volume: vol }] };
    } else {
      const avgPrice =
        currentCluster.items.reduce((s, it) => s + it.price * it.volume, 0) /
        currentCluster.items.reduce((s, it) => s + it.volume, 0);

      if (Math.abs(item.price - avgPrice) <= threshold) {
        currentCluster.items.push({ type: item.type, price: item.price, volume: vol });
      } else {
        clusters.push(currentCluster);
        currentCluster = { items: [{ type: item.type, price: item.price, volume: vol }] };
      }
    }
  }
  if (currentCluster) {
    clusters.push(currentCluster);
  }

  // Создаем чипы из кластеров
  const chips: PoolChip[] = clusters.map((cl, idx) => {
    const totalVol = cl.items.reduce((s, it) => s + it.volume, 0);
    const weightedPrice = cl.items.reduce((s, it) => s + it.price * it.volume, 0) / totalVol;

    // Доминирующий тип
    const typeVolMap = new Map<string, number>();
    for (const it of cl.items) {
      typeVolMap.set(it.type, (typeVolMap.get(it.type) || 0) + it.volume);
    }
    let dominantType = cl.items[0].type;
    let maxTypeVol = 0;
    for (const [t, v] of typeVolMap.entries()) {
      if (v > maxTypeVol) {
        maxTypeVol = v;
        dominantType = t;
      }
    }

    const dist = Math.abs(weightedPrice - currentPrice);
    const roundedPrice = Number(weightedPrice.toFixed(2));

    return {
      id: `chip_pool_${idx}_${roundedPrice}`,
      type: dominantType,
      price: roundedPrice,
      volume: Math.round(totalVol),
      distancePts: Number(dist.toFixed(2)),
      label: `${dominantType} ${roundedPrice}`
    };
  });

  // Сортировка по расстоянию до спота и ограничение до 6 штук
  chips.sort((a, b) => a.distancePts - b.distancePts);
  return chips.slice(0, 6);
}

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

  if (rawState === entry.lastState) {
    entry.candidateState = rawState;
    entry.candidateCount = 1;
    return entry.lastState;
  }

  const elapsedMs = now - entry.lastTransitionTime;
  if (rawState === entry.candidateState) {
    entry.candidateCount++;
  } else {
    entry.candidateState = rawState;
    entry.candidateCount = 1;
  }

  if (entry.candidateCount >= 3 || elapsedMs >= 120000) {
    entry.lastState = rawState;
    entry.lastTransitionTime = now;
    entry.candidateCount = 1;
    return rawState;
  }

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
    adr = null,
    symbol = "XAUUSD",
    timeframe = "15m",
    currentPrice,
    tickSize = 0.01,
    legacyWave = null,
    dynamicWeights,
    now = Date.now(),
    stateProgressionOverride,
    skipStateTracking = false
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

  // Вычисляем профиль объема (адаптивное окно для старших ТФ) и пулы для всех режимов
  const vpLookback = timeframe === "1d" ? 40 : timeframe === "4h" ? 60 : timeframe === "1h" ? 100 : 200;
  const vp = candles && candles.length >= 20 ? computeVolumeProfile(candles, vpLookback) : null;
  const rawPools = candles && candles.length >= 20 ? detectLiquidityPools(candles) : [];
  const poolsChips = deduplicatePoolsForChips(rawPools, spot);

  // 1. ПРОВЕРКА РЕЖИМА DEGRADED (< 50 свечей)
  if (!candles || candles.length < 50) {
    const legDir = legacyWave?.direction && legacyWave.direction !== "NONE" ? legacyWave.direction : "LONG";
    const entryMid = legacyWave?.entry && isFinite(legacyWave.entry) ? legacyWave.entry : spot;
    const entryZone: [number, number] = [entryMid - 0.2 * atr, entryMid + 0.2 * atr];
    const sl = legacyWave?.sl && isFinite(legacyWave.sl)
      ? legacyWave.sl
      : (legDir === "LONG" ? entryMid - 1.0 * atr : entryMid + 1.0 * atr);

    const tp1Price = legacyWave?.tp1 && isFinite(legacyWave.tp1)
      ? legacyWave.tp1
      : (legDir === "LONG" ? entryMid + 1.5 * atr : entryMid - 1.5 * atr);

    const tp2Price = legacyWave?.tp2 && isFinite(legacyWave.tp2)
      ? legacyWave.tp2
      : (legDir === "LONG" ? entryMid + 2.6 * atr : entryMid - 2.6 * atr);

    const tp3Price = legDir === "LONG" ? entryMid + 3.8 * atr : entryMid - 3.8 * atr;

    const riskR = Math.max(0.1, Math.abs(entryMid - sl));

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

    const invValid = validateLadderInvariant(legDir, entryMid, sl, tp1Price, tp2Price, tp3Price);
    const hist = recordStateHistory(key, "DEGRADED", now);

    return {
      symbol,
      timeframe,
      timestamp: now,
      direction: legDir,
      entryZone,
      entryMid,
      sl,
      managedSl: sl,
      riskR,
      riskAtrRatio: riskR / atr,
      atr,
      tp1: { price: tp1Price, tag: "[Wave TP1]", r: 1.5 },
      tp2: { price: tp2Price, tag: "[Wave TP2]", r: 2.6 },
      tp3: { price: tp3Price, tag: "[Wave TP3 runner]", r: 3.8 },
      planB: null,
      permission: degradedPerm,
      stateProgression: stateProgressionOverride || { stage: "ST0", barsSinceEntry: 0 },
      isScalpMode: false,
      cllSetup: null,
      legacyWave,
      poolsChips,
      vp,
      adr: adr || { available: false, adr14: null, todayRange: 0, usedPct: null },
      scheduleLabel: schedule?.labelRu || "Regular",
      stateHistoryLast5: hist,
      nextSetup: null,
      invariantValid: invValid
    };
  }

  // 2. ВЫЧИСЛЕНИЕ CLL СЕТАПА (СЛОИ 1..6)
  const effectiveAdrPct = adr && adr.available && adr.usedPct != null ? adr.usedPct : adrPct;

  const cllSetup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    adrPct: effectiveAdrPct,
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
    if (cllSetup.score >= 0.80 && l1GexActive) {
      decidedDirection = cllDir;
      arbiterNote = "Арбитраж: CLL доминирует (расхождение с wave)";
    } else if (cllSetup.score >= 0.70 && cllSetup.score < 0.80) {
      decidedDirection = cllDir;
      isModelConflict = true;
      arbiterNote = `Конфликт моделей: CLL (${cllDir}) vs Wave (${legDir}) при S=${totalScore.toFixed(2)}`;
      modelConflictTrigger = cllDir === "LONG"
        ? `Пробой максимума ${cllSetup.entryZone[1].toFixed(2)} или свип ${cllSetup.entryZone[0].toFixed(2)}`
        : `Пробой минимума ${cllSetup.entryZone[0].toFixed(2)} или свип ${cllSetup.entryZone[1].toFixed(2)}`;
    } else {
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
    decidedDirection = "LONG";
    arbiterNote = "Нейтральный рынок: дефолтная сетка ликвидности";
  }

  // 5. ПОСТРОЕНИЕ ПОЛНОЙ ГАРАНТИРОВАННОЙ ЛЕСТНИЦЫ С СОБЛЮДЕНИЕМ НАПРАВЛЕНИЯ
  let entryZone: [number, number];
  let entryMid: number;
  let sl: number;
  let tp1: ConfluenceTarget;
  let tp2: ConfluenceTarget | null = null;
  let tp3: ConfluenceTarget | null = null;
  let planB = cllSetup.planB;

  const isHtf = timeframe === "1h" || timeframe === "4h" || timeframe === "1d";
  const minRiskAllowed = Math.max(4 * tickSize, 0.6 * atr);
  const maxRiskAllowed = Math.max(minRiskAllowed * 1.05, 1.6 * atr);
  const maxTp1Mult = isHtf ? 2.6 : 5.0;
  const maxTp2Mult = isHtf ? 3.8 : 7.0;

  // Если CLL направление совпадает с решением арбитра и точка входа не устарела относительно спота
  const cllEntryFresh =
    cllSetup.entryMid &&
    isFinite(cllSetup.entryMid) &&
    Math.abs(cllSetup.entryMid - spot) <= 5.0 * atr;

  if (
    cllSetup.status !== "NO_TRADE" &&
    cllSetup.entryZone &&
    isFinite(cllSetup.entryZone[0]) &&
    cllSetup.direction === decidedDirection &&
    cllEntryFresh
  ) {
    entryZone = [cllSetup.entryZone[0], cllSetup.entryZone[1]];
    entryMid = cllSetup.entryMid;
    sl = cllSetup.sl;

    // Проверяем соответствие направления и допуск риска [0.6 ATR .. 1.6 ATR]
    if (decidedDirection === "LONG") {
      if (sl >= entryMid) sl = entryMid - 1.0 * atr;
      const clampedR = Math.max(minRiskAllowed, Math.min(maxRiskAllowed, Math.abs(entryMid - sl)));
      sl = entryMid - clampedR;
      const baseR = Math.max(0.1, clampedR);
      const rawTp1 = cllSetup.tp1 && cllSetup.tp1.price > entryMid ? cllSetup.tp1.price : entryMid + 1.5 * baseR;
      const tp1P = Math.min(rawTp1, entryMid + Math.max(maxTp1Mult * baseR, (isHtf ? 2.5 : 6.2) * atr));
      const minTp2P = Math.max(entryMid + 2.6 * baseR, tp1P + 0.8 * atr);
      const rawTp2 = cllSetup.tp2 && cllSetup.tp2.price > tp1P ? cllSetup.tp2.price : minTp2P;
      const tp2P = Math.max(minTp2P, Math.min(rawTp2, entryMid + Math.max(maxTp2Mult * baseR, (isHtf ? 4.0 : 7.5) * atr)));
      const tp3P = cllSetup.tp3 && cllSetup.tp3.price > tp2P ? cllSetup.tp3.price : tp2P + 1.2 * atr;

      tp1 = { price: tp1P, tag: cllSetup.tp1?.tag || "[CLL TP1]", r: Number((Math.abs(tp1P - entryMid) / baseR).toFixed(2)) };
      tp2 = { price: tp2P, tag: cllSetup.tp2?.tag || "[CLL TP2]", r: Number((Math.abs(tp2P - entryMid) / baseR).toFixed(2)) };
      tp3 = { price: tp3P, tag: cllSetup.tp3?.tag || "[CLL TP3 runner]", r: Number((Math.abs(tp3P - entryMid) / baseR).toFixed(2)) };
    } else {
      // SHORT
      if (sl <= entryMid) sl = entryMid + 1.0 * atr;
      const clampedR = Math.max(minRiskAllowed, Math.min(maxRiskAllowed, Math.abs(entryMid - sl)));
      sl = entryMid + clampedR;
      const baseR = Math.max(0.1, clampedR);
      const rawTp1 = cllSetup.tp1 && cllSetup.tp1.price < entryMid ? cllSetup.tp1.price : entryMid - 1.5 * baseR;
      const tp1P = Math.max(rawTp1, entryMid - Math.max(maxTp1Mult * baseR, (isHtf ? 2.5 : 6.2) * atr));
      const minTp2P = Math.min(entryMid - 2.6 * baseR, tp1P - 0.8 * atr);
      const rawTp2 = cllSetup.tp2 && cllSetup.tp2.price < tp1P ? cllSetup.tp2.price : minTp2P;
      const tp2P = Math.min(minTp2P, Math.max(rawTp2, entryMid - Math.max(maxTp2Mult * baseR, (isHtf ? 4.0 : 7.5) * atr)));
      const tp3P = cllSetup.tp3 && cllSetup.tp3.price < tp2P ? cllSetup.tp3.price : tp2P - 1.2 * atr;

      tp1 = { price: tp1P, tag: cllSetup.tp1?.tag || "[CLL TP1]", r: Number((Math.abs(entryMid - tp1P) / baseR).toFixed(2)) };
      tp2 = { price: tp2P, tag: cllSetup.tp2?.tag || "[CLL TP2]", r: Number((Math.abs(entryMid - tp2P) / baseR).toFixed(2)) };
      tp3 = { price: tp3P, tag: cllSetup.tp3?.tag || "[CLL TP3 runner]", r: Number((Math.abs(entryMid - tp3P) / baseR).toFixed(2)) };
    }
  } else {
    // Синтез лестницы строго по направлению decidedDirection:
    // используем vp.poc только если он рядом со спотом (<= 1.2 ATR), иначе якоримся к споту
    const anchor = vp && Math.abs(vp.poc - spot) <= 1.2 * atr ? vp.poc : spot;
    const span = Math.max(0.2 * atr, 4 * tickSize);
    entryMid = anchor;
    entryZone = [entryMid - span, entryMid + span];

    const baseR = Math.max(minRiskAllowed, Math.min(maxRiskAllowed, 1.0 * atr));
    const buffer = Math.max(0.25 * atr, 5 * tickSize);

    if (decidedDirection === "LONG") {
      const validEql = rawPools
        .filter(
          p =>
            !p.swept &&
            (p.type === "EQL" || p.type === "PDL") &&
            p.price < entryMid &&
            entryMid - (p.price - buffer) <= maxRiskAllowed
        )
        .sort((a, b) => b.price - a.price);
      const nearestPool = validEql[0];
      sl = nearestPool ? nearestPool.price - buffer : entryMid - baseR;
      const clampedR = Math.max(minRiskAllowed, Math.min(maxRiskAllowed, Math.abs(entryMid - sl)));
      sl = entryMid - clampedR;

      const actualR = Math.max(0.1, clampedR);
      const targetTp1 = entryMid + Math.max(1.5 * actualR, 1.2 * atr);
      const targetTp2 = targetTp1 + Math.max(0.8 * atr, 1.1 * actualR);
      const targetTp3 = targetTp2 + 1.2 * atr;

      tp1 = { price: targetTp1, tag: "[UFE TP1]", r: Number((Math.abs(targetTp1 - entryMid) / actualR).toFixed(2)) };
      tp2 = { price: targetTp2, tag: "[UFE TP2]", r: Number((Math.abs(targetTp2 - entryMid) / actualR).toFixed(2)) };
      tp3 = { price: targetTp3, tag: "[UFE TP3 runner]", r: Number((Math.abs(targetTp3 - entryMid) / actualR).toFixed(2)) };
    } else {
      // SHORT: строго выше entryMid
      const validEqh = rawPools
        .filter(
          p =>
            !p.swept &&
            (p.type === "EQH" || p.type === "PDH") &&
            p.price > entryMid &&
            (p.price + buffer) - entryMid <= maxRiskAllowed
        )
        .sort((a, b) => a.price - b.price);
      const nearestPool = validEqh[0];
      sl = nearestPool ? nearestPool.price + buffer : entryMid + baseR;
      const clampedR = Math.max(minRiskAllowed, Math.min(maxRiskAllowed, Math.abs(entryMid - sl)));
      sl = entryMid + clampedR;

      const actualR = Math.max(0.1, clampedR);
      const targetTp1 = entryMid - Math.max(1.5 * actualR, 1.2 * atr);
      const targetTp2 = targetTp1 - Math.max(0.8 * atr, 1.1 * actualR);
      const targetTp3 = targetTp2 - 1.2 * atr;

      tp1 = { price: targetTp1, tag: "[UFE TP1]", r: Number((Math.abs(entryMid - targetTp1) / actualR).toFixed(2)) };
      tp2 = { price: targetTp2, tag: "[UFE TP2]", r: Number((Math.abs(entryMid - targetTp2) / actualR).toFixed(2)) };
      tp3 = { price: targetTp3, tag: "[UFE TP3 runner]", r: Number((Math.abs(entryMid - targetTp3) / actualR).toFixed(2)) };
    }
  }

  const riskR = Math.max(0.1, Math.abs(entryMid - sl));
  const riskAtrRatio = riskR / atr;

  // Ограничитель раннера TP3: |tp3.price - entryMid| <= min(6R, 3ATR, corridor)
  const gexCorridor = (gexReport?.callWall && gexReport?.putWall && isFinite(gexReport.callWall) && isFinite(gexReport.putWall))
    ? Math.abs(gexReport.callWall - gexReport.putWall)
    : 0.05 * spot;
  const maxRunnerDist = Math.min(6 * riskR, 3 * atr, gexCorridor);

  if (tp3 && Math.abs(tp3.price - entryMid) > maxRunnerDist) {
    tp3 = null;
  }

  // 6. ОПРЕДЕЛЕНИЕ СТАТУСА ДОПУСКА (PERMISSION-BASED LADDER)
  const reasons: string[] = [];
  const reasonsDetailed: UnifiedPermissionReason[] = [];
  let rawState: UnifiedPermissionState = "TRADEABLE";
  let primaryReason = "Условия соблюдены";
  let unblockTrigger = "Вход лимитным ордером в зоне";

  const stage = stateProgressionOverride?.stage || cllSetup.stateProgression?.stage || "ST0";
  const barsSinceEntry = stateProgressionOverride?.barsSinceEntry ?? cllSetup.stateProgression?.barsSinceEntry ?? 0;

  const isPositionActive =
    stage === "ST1" ||
    stage === "TP1" ||
    stage === "TP2" ||
    stage === "TRAIL" ||
    cllSetup.status === "ST1_ACTIVE" ||
    cllSetup.status === "TP1_HIT" ||
    cllSetup.status === "TP2_HIT" ||
    cllSetup.status === "TRAIL";

  const isExpired = stage === "EXPIRED";

  // Честный ADR:
  const isAdrAvailable = adr ? adr.available : true;
  const adrUsed = adr && adr.available && adr.usedPct != null ? adr.usedPct : adrPct;

  if (isExpired) {
    rawState = "EXPIRED";
    primaryReason = "Время удержания сетапа истекло";
    unblockTrigger = "Ожидание нового импульса / следующего сетапа";
    reasons.push("Срок жизни сетапа превышен (> 30 баров)");
    reasonsDetailed.push({
      code: "SETUP_EXPIRED",
      text: "Срок жизни сетапа превышен",
      unblockTrigger: "Перезакрепление цены"
    });
  } else if (isPositionActive) {
    rawState = "IN_POSITION";
    primaryReason = "Позиция активна (вход взят)";
    unblockTrigger = "Сопровождение до TP/SL";
  } else if (cllSetup.gates.newsBlock) {
    rawState = "BLOCKED";
    const det = cllSetup.gates.newsDetails || "Новостное макро-окно (высокая волатильность)";
    reasons.push(det);
    reasonsDetailed.push({
      code: "NEWS_WINDOW",
      text: det,
      unblockTrigger: "Истечение окна ±15 мин от выхода новости"
    });
    primaryReason = "Новостное окно";
    unblockTrigger = "Истечение окна ±15 мин от выхода новости";
  } else if (isModelConflict) {
    rawState = "BLOCKED";
    reasons.push("Конфликт моделей CLL vs Wave");
    reasonsDetailed.push({
      code: "MODEL_CONFLICT",
      text: "Конфликт моделей CLL vs Wave",
      unblockTrigger: modelConflictTrigger
    });
    primaryReason = "Конфликт моделей CLL vs Wave";
    unblockTrigger = modelConflictTrigger;
  } else if (!cllSetup.gates.regimeAllow) {
    rawState = "BLOCKED";
    const det = cllSetup.gates.regimeDetails || "Гейт опционного режима блокирует вход";
    reasons.push(det);
    reasonsDetailed.push({
      code: "GEX_REGIME_BLOCKED",
      text: det,
      unblockTrigger: "Смена режима или возврат цены к Flip"
    });
    primaryReason = "Опционный режим GEX";
    unblockTrigger = "Смена режима или возврат цены к Flip";
  } else if (!isAdrAvailable) {
    // ADR честно: мало дневных корзин -> не скальп, а CONDITIONAL
    rawState = "CONDITIONAL";
    reasons.push("ADR н/д (мало дневных корзин)");
    reasonsDetailed.push({
      code: "ADR_UNAVAILABLE",
      text: "ADR н/д (мало дневных корзин)",
      unblockTrigger: "Накопление дневной истории (>=10 дней)"
    });
    primaryReason = "ADR н/д (мало дневных корзин)";
    unblockTrigger = "Работа с фиксированным ATR";
  } else if (isAdrAvailable && adrUsed >= 85) {
    // ADR исчерпан при доступных данных
    if (cllSetup.isScalpMode) {
      rawState = "SCALP";
      primaryReason = "ADR >= 85%: разрешён только скальп к TP1";
      unblockTrigger = "Фиксация на TP1";
    } else {
      rawState = "BLOCKED";
      reasons.push("ADR >= 85% исчерпан для пробойного входа");
      reasonsDetailed.push({
        code: "ADR_EXHAUSTED",
        text: "ADR >= 85% исчерпан",
        unblockTrigger: "Откат от экстремума дня либо новая сессия"
      });
      primaryReason = "ADR >= 85% исчерпан";
      unblockTrigger = "Откат от экстремума дня либо новая сессия";
    }
  } else if (totalScore < 0.70 || activeLayers.length < 4) {
    rawState = "CONDITIONAL";
    reasons.push(`Score S=${totalScore.toFixed(2)} (<0.70) или активных слоёв ${activeLayers.length}/7 (нужно >=4)`);
    reasonsDetailed.push({
      code: "INSUFFICIENT_CONFLUENCE",
      text: `Score S=${totalScore.toFixed(2)} (<0.70) или слоёв ${activeLayers.length}/7`,
      unblockTrigger: "Ждать свип пула или подтверждение дельты"
    });
    primaryReason = `Недостаточно подтверждений (${activeLayers.length}/7 слоёв)`;
    unblockTrigger = "Ждать свип пула или подтверждение дельты";
  } else if (!l1GexActive && !cllLayers.find(l => l.id === "L2")?.active) {
    rawState = "CONDITIONAL";
    reasons.push("Отсутствует подтверждение институциональных уровней (L1 GEX или L2 VP)");
    reasonsDetailed.push({
      code: "NO_INSTITUTIONAL_ANCHOR",
      text: "Отсутствует подтверждение институциональных уровней (L1 GEX или L2 VP)",
      unblockTrigger: "Тест границы Value Area или опционной стены"
    });
    primaryReason = "Нет привязки к GEX или POC";
    unblockTrigger = "Тест границы Value Area или опционной стены";
  }

  // 7. СКАЛЬП-РЕЖИМ СКРЫВАЕТ TP2 И TP3
  const isScalpMode = rawState === "SCALP" || cllSetup.isScalpMode;
  if (isScalpMode) {
    tp2 = null;
    tp3 = null;
  }

  // 8. УПРАВЛЯЕМЫЙ СТОП (managedSl)
  let managedSl = sl;
  if (stage === "TP1" || cllSetup.status === "TP1_HIT") {
    // BE + 0.15R
    managedSl = decidedDirection === "LONG"
      ? Number((entryMid + 0.15 * riskR).toFixed(2))
      : Number((entryMid - 0.15 * riskR).toFixed(2));
  } else if (stage === "TP2" || stage === "TRAIL" || cllSetup.status === "TP2_HIT" || cllSetup.status === "TRAIL") {
    managedSl = decidedDirection === "LONG"
      ? Number(Math.max(entryMid + 0.15 * riskR, (tp1 ? tp1.price - 0.5 * atr : entryMid)).toFixed(2))
      : Number(Math.min(entryMid - 0.15 * riskR, (tp1 ? tp1.price + 0.5 * atr : entryMid)).toFixed(2));
  }

  // 9. ПРОВЕРКА ИНВАРИАНТА НАПРАВЛЕНИЯ
  const invariantValid = validateLadderInvariant(
    decidedDirection,
    entryMid,
    sl,
    tp1.price,
    tp2?.price ?? null,
    tp3?.price ?? null
  );

  if (!invariantValid) {
    rawState = "BLOCKED";
    reasons.push("Нарушен инвариант направления (LONG/SHORT)");
    reasonsDetailed.push({
      code: "DIRECTIONAL_INVARIANT_BROKEN",
      text: "Нарушен инвариант направления (LONG/SHORT)",
      unblockTrigger: "Синхронизация экстремумов"
    });
    primaryReason = "Нарушен инвариант направления (LONG/SHORT)";
    unblockTrigger = "Синхронизация моделей";
  }

  // 10. ПРИМЕНЕНИЕ АНТИ-ФЛИКЕРА (для синтетического nextSetup не трогаем основной кэш)
  const finalState = skipStateTracking ? rawState : applyAntiFlicker(key, rawState, now);
  const stateHistory = skipStateTracking
    ? (stateHistoryMap.get(key) || [])
    : recordStateHistory(key, finalState, now);

  const permission: UnifiedPermission = {
    state: finalState,
    reasons,
    reasonsDetailed,
    primaryReason: finalState === rawState ? primaryReason : `Стабилизация: ${primaryReason}`,
    unblockTrigger,
    score: totalScore,
    activeLayers,
    allLayers,
    arbiterNote
  };

  // 11. ПОДГОТОВКА NEXT_SETUP ДЛЯ EXPIRED
  let nextSetup: UnifiedForecastResult | null = null;
  if (!skipStateTracking && finalState === "EXPIRED" && candles.length >= 50) {
    // Генерируем свежий активный сетап от текущего бара без перезаписи кэша/истории
    nextSetup = computeUnifiedForecast({
      ...params,
      stateProgressionOverride: { stage: "ST0", barsSinceEntry: 0 },
      skipStateTracking: true
    });
  }

  return {
    symbol,
    timeframe,
    timestamp: now,
    direction: decidedDirection,
    entryZone,
    entryMid: Number(entryMid.toFixed(2)),
    sl: Number(sl.toFixed(2)),
    managedSl: Number(managedSl.toFixed(2)),
    riskR: Number(riskR.toFixed(2)),
    riskAtrRatio: Number(riskAtrRatio.toFixed(2)),
    atr: Number(atr.toFixed(2)),
    tp1,
    tp2,
    tp3,
    planB,
    permission,
    stateProgression: {
      stage,
      barsSinceEntry
    },
    isScalpMode,
    cllSetup,
    legacyWave,
    poolsChips,
    vp,
    adr: adr || {
      available: isAdrAvailable,
      adr14: null,
      todayRange: 0,
      usedPct: isAdrAvailable ? adrUsed : null
    },
    scheduleLabel: schedule?.labelRu || "Regular",
    stateHistoryLast5: stateHistory,
    nextSetup,
    invariantValid
  };
}
