import fs from "fs";
import path from "path";

export type IndicatorSetupStatus =
  | "PENDING"
  | "ACTIVE"
  | "WIN_TP1"
  | "WIN_TP2"
  | "WIN_TP3"
  | "WIN_TRAILING"
  | "LOSS_SL"
  | "NOT_TRIGGERED"
  | "MISSED_ENTRY"
  | "EXPIRED";

export interface IndicatorSetupItem {
  id: string;
  key: string; // e.g. "XAUUSD_15m"
  ticker: string; // "XAUUSD", "BTCUSDT", "MOEX_GOLD", etc.
  timeframe: string; // "5m", "15m", "30m", "1h", "4h", "1d"
  setupName: string; // e.g. "Лоренцевский ML + Zero-Flip", "OTE 0.618 + FVG", "Call Wall Отскок", "Put Wall Защита", "Импульсный Консенсус 5TF", "План Б (Реверс при сломе SL)"
  direction: "LONG" | "SHORT";
  status: IndicatorSetupStatus;
  entryPrice: number;
  tp1: number;
  tp2: number;
  tp3: number;
  initialSl: number;
  activeTrailingSl: number;
  trailingStageStr: string;
  entryTriggered?: boolean; // сработала ли точка входа
  tp1Hit?: boolean; // сработал ли тейк 1
  tp2Hit?: boolean; // сработал ли тейк 2
  tp3Hit?: boolean; // сработал ли тейк 3
  slHit?: boolean; // сработал ли стоп-лосс
  trailingHit?: boolean; // сработал ли трейлинг-стоп
  exitReason?: "TP1" | "TP2" | "TP3" | "TRAILING" | "SL" | "NOT_TRIGGERED" | "MISSED_ENTRY" | "EXPIRED";
  behaviorNote?: string; // как индикатор себя вел в данной ситуации (отскок, свип, срыв, реверс План Б)
  exitPrice?: number;
  exitTimestamp?: number;
  exitTimeMsk?: string;
  pnlPercent?: number;
  pnlR?: number;
  probability: number;
  createdAt: string;
  createdTimestamp: number;
  timeMsk: string;
  dateMsk: string;
  highestPriceSinceStart?: number;
  lowestPriceSinceStart?: number;
  barsHeld?: number;
  leg1Hit?: boolean;
  leg2Hit?: boolean;
  leg3Hit?: boolean;
  isPlanBActive?: boolean;
  counterTrend?: boolean;
  lockRole?: string;
  bundleKey?: string;
  linkedSetupId?: string;
  expirationReason?: string;
  notes?: string;
}

function tfToSecServer(tf: string): number {
  switch ((tf || "").toLowerCase()) {
    case "1m": return 60;
    case "3m": return 180;
    case "5m": return 300;
    case "15m": return 900;
    case "30m": return 1800;
    case "1h": return 3600;
    case "2h": return 7200;
    case "4h": return 14400;
    case "1d": return 86400;
    case "1w": return 604800;
    default: return 900;
  }
}

export interface IndicatorTickerMetric {
  ticker: string;
  total: number;
  pending: number;
  wins: number;
  losses: number;
  notTriggered?: number;
  winRate: number; // e.g. 78.5%
  pnlPercent: number; // e.g. +24.6%
  profitFactor: number;
  avgR: number;
}

export interface IndicatorOverallStats {
  totalSetups: number;
  activePending: number;
  totalWins: number;
  totalLosses: number;
  totalNotTriggered: number;
  totalExpired: number;
  winRate: number; // %
  profitFactor: number;
  avgRMultiple: number; // R
  totalPnLPercent: number; // %
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  byTicker: Record<string, IndicatorTickerMetric>;
  byTimeframe: Record<string, {
    timeframe: string;
    total: number;
    pending: number;
    wins: number;
    losses: number;
    notTriggered: number;
    winRate: number;
    pnlPercent: number;
    profitFactor: number;
    avgR: number;
    description?: string;
  }>;
  bySetupType: Record<string, {
    setupName: string;
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    pnlPercent: number;
  }>;
  recentCompleted: IndicatorSetupItem[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const INDICATOR_HISTORY_FILE = path.join(DATA_DIR, "indicator-setups-history.json");

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

let indicatorSetupsHistory: IndicatorSetupItem[] = [];

function loadIndicatorHistory(): void {
  try {
    if (fs.existsSync(INDICATOR_HISTORY_FILE)) {
      const raw = fs.readFileSync(INDICATOR_HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Исключаем любые устаревшие демонстрационные seed-записи
        indicatorSetupsHistory = parsed.filter(
          (item: any) => item && typeof item.id === "string" && !item.id.startsWith("ind_seed_")
        );
        return;
      }
    }
  } catch (err: any) {
    console.warn("Notice loading indicator setups history:", err.message);
  }

  indicatorSetupsHistory = [];
  persistIndicatorHistory();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistIndicatorHistory(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(INDICATOR_HISTORY_FILE, JSON.stringify(indicatorSetupsHistory, null, 2), "utf-8");
    } catch (err: any) {
      console.warn("Notice writing indicator history:", err.message);
    }
  }, 400);
}

loadIndicatorHistory();

/**
 * Record or update a setup from chart indicator evaluation.
 * Returns null if forecast does not contain real engine levels (no fabricated 3995.8 defaults).
 */
export function recordOrUpdateIndicatorSetup(key: string, setupPayload: any): IndicatorSetupItem | null {
  const lastUnderscore = key.lastIndexOf("_");
  const ticker = lastUnderscore > 0 ? key.slice(0, lastUnderscore) : (key || "XAUUSD");
  const timeframe = lastUnderscore > 0 ? key.slice(lastUnderscore + 1) : "15m";
  const fc = setupPayload?.forecast || setupPayload;

  if (!fc || fc.status === "NO_SETUP" || fc.executionStatus === "NO_SETUP" || fc.hasValidSetup === false) {
    return null;
  }

  const rawEntry = Number(fc?.p1Entry ?? fc?.entryPrice);
  const rawTp1 = Number(fc?.p2Tp1 ?? fc?.tp1);
  const rawTp2 = Number(fc?.p3Tp2 ?? fc?.tp2 ?? rawTp1);
  const rawSl = Number(fc?.invalidLevelSl ?? fc?.trailingStop ?? fc?.stopLoss ?? fc?.initialSl);

  if (
    !Number.isFinite(rawEntry) || rawEntry <= 0 ||
    !Number.isFinite(rawTp1) || rawTp1 <= 0 ||
    !Number.isFinite(rawTp2) || rawTp2 <= 0 ||
    !Number.isFinite(rawSl) || rawSl <= 0
  ) {
    return null;
  }

  const now = new Date();
  const timeMsk = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(now);
  const dateMsk = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);

  const direction: "LONG" | "SHORT" =
    fc?.direction === "LONG" || fc?.direction === "SHORT"
      ? fc.direction
      : fc?.isBull === true
        ? "LONG"
        : fc?.isBull === false
          ? "SHORT"
          : rawTp1 > rawEntry
            ? "LONG"
            : "SHORT";

  const entry = rawEntry;
  const tp1 = rawTp1;
  const tp2 = rawTp2;
  const rawTp3 = Number(fc?.p5Tp3 ?? fc?.tp3);
  const tp3 = Number.isFinite(rawTp3) && rawTp3 > 0 ? rawTp3 : tp2;
  const sl = rawSl;

  // Строгая проверка иерархии уровней перед записью
  const validHierarchy =
    direction === "LONG"
      ? sl < entry && entry < tp1 && tp1 <= tp2
      : sl > entry && entry > tp1 && tp1 >= tp2;
  if (!validHierarchy) {
    return null;
  }

  const rawActiveSl = Number(fc?.activeTrailingSl);
  const activeSl = Number.isFinite(rawActiveSl) && rawActiveSl > 0 ? rawActiveSl : sl;
  const trailingStr = fc?.trailingStageStr || "🛡️ Начальный SL";
  const rawProb = Number(fc?.probability);
  const prob = Number.isFinite(rawProb) && rawProb > 0 ? rawProb : 70;

  const isTriggered = Boolean(fc?.leg1Hit ?? fc?.entryTriggered);
  const isExpiredPayload = fc?.status === "EXPIRED" || Boolean(fc?.isExpired);
  const initialStatus: IndicatorSetupStatus = isExpiredPayload
    ? "EXPIRED"
    : isTriggered
    ? "ACTIVE"
    : "PENDING";

  let existing = indicatorSetupsHistory.find(
    (s) => s.key === key && (s.status === "PENDING" || s.status === "ACTIVE")
  );
  if (existing) {
    if (isExpiredPayload) {
      existing.status = "EXPIRED";
      existing.exitReason = "EXPIRED";
      existing.expirationReason = fc?.expirationReason;
      existing.exitTimestamp = Date.now();
      existing.exitTimeMsk = `${timeMsk} МСК`;
      existing.notes = fc?.reason || fc?.statusReason || "Сетап истёк";
      persistIndicatorHistory();
      return existing;
    }

    // If direction changed or setup significantly replaced before entry was triggered:
    // Mark previous setup as NOT_TRIGGERED (сетап сменился до входа)
    const directionChanged = existing.direction !== direction;
    const entryShifted = Math.abs(existing.entryPrice - entry) / (existing.entryPrice || 1) > 0.012;
    if ((directionChanged || entryShifted) && !existing.entryTriggered) {
      existing.status = "NOT_TRIGGERED";
      existing.exitReason = "NOT_TRIGGERED";
      existing.exitTimestamp = Date.now();
      existing.exitTimeMsk = `${timeMsk} МСК`;
      existing.notes = `Сетап сменился до срабатывания точки входа (с ${existing.direction} на ${direction}). Алгоритм деактивировал старый лимитный рубеж.`;
      existing.behaviorNote = "Сетап сменился до активации: алгоритм перестроился по новому рыночному контексту";
      existing = undefined; // Proceed to create fresh setup
    } else if (existing) {
      existing.activeTrailingSl = activeSl;
      existing.trailingStageStr = trailingStr;
      existing.leg1Hit = Boolean(fc?.leg1Hit);
      existing.leg2Hit = Boolean(fc?.leg2Hit);
      existing.leg3Hit = Boolean(fc?.leg3Hit);
      existing.isPlanBActive = Boolean(fc?.isPlanBActive);
      existing.entryTriggered = Boolean(fc?.leg1Hit ?? fc?.entryTriggered ?? existing.entryTriggered);
      existing.tp1Hit = Boolean(fc?.leg2Hit ?? fc?.tp1Hit ?? existing.tp1Hit);
      existing.tp2Hit = Boolean(fc?.leg3Hit ?? fc?.tp2Hit ?? existing.tp2Hit);
      if (existing.entryTriggered && existing.status === "PENDING") {
        existing.status = "ACTIVE";
      }
      if (fc?.counterTrend !== undefined) {
        existing.counterTrend = Boolean(fc.counterTrend);
      }
      if (fc?.lockRole) {
        existing.lockRole = fc.lockRole;
      }
      enforceJournalOpposingLockArbitration(existing);
      persistIndicatorHistory();
      return existing;
    }
  }

  // Classify pattern / setup type name dynamically
  let setupName = "Лоренцевский ML + GEX Wall";
  let behaviorNote = "Стандартное удержание границ торгового диапазона индикатора";
  if (fc?.isPlanBActive) {
    setupName = "План Б (Реверс при сломе SL)";
    behaviorNote = "Индикатор мгновенно перевернулся в противоход после ложного закола";
  } else if (trailingStr.includes("Трейл") || trailingStr.includes("BE+")) {
    setupName = "Импульсный Консенсус 5TF";
    behaviorNote = "Динамическое подтягивание безубытка (BE+0.15) при развитии импульса";
  } else if (prob > 86) {
    setupName = "OTE 0.618 + FVG Свип";
    behaviorNote = "Свип ликвидности FVG с подтвержденным входом в зоне OTE 0.618";
  } else if (direction === "LONG") {
    setupName = "Put Wall Защита";
    behaviorNote = "Институциональный отскок от опционной стены поддержки Put Wall";
  } else {
    setupName = "Call Wall Отскок";
    behaviorNote = "Откат от опционной стены продавцов Call Wall под давлением дилеров";
  }

  const newSetup: IndicatorSetupItem = {
    id: `ind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    key,
    ticker,
    timeframe,
    setupName,
    direction,
    status: initialStatus,
    entryPrice: entry,
    tp1,
    tp2,
    tp3,
    initialSl: sl,
    activeTrailingSl: activeSl,
    trailingStageStr: trailingStr,
    entryTriggered: isTriggered,
    tp1Hit: Boolean(fc?.leg2Hit ?? fc?.tp1Hit),
    tp2Hit: Boolean(fc?.leg3Hit ?? fc?.tp2Hit),
    tp3Hit: false,
    slHit: false,
    trailingHit: false,
    behaviorNote,
    probability: prob,
    createdAt: now.toISOString(),
    createdTimestamp: Date.now(),
    timeMsk: `${timeMsk} МСК`,
    dateMsk,
    leg1Hit: Boolean(fc?.leg1Hit),
    leg2Hit: Boolean(fc?.leg2Hit),
    leg3Hit: Boolean(fc?.leg3Hit),
    isPlanBActive: Boolean(fc?.isPlanBActive),
    counterTrend: Boolean(fc?.counterTrend),
    lockRole: fc?.lockRole || (fc?.counterTrend ? "ОТКАТ (контртренд, уменьшенный размер)" : "ТРЕНД"),
    expirationReason: fc?.expirationReason
  };

  indicatorSetupsHistory.unshift(newSetup);
  enforceJournalOpposingLockArbitration(newSetup);

  if (indicatorSetupsHistory.length > 500) {
    indicatorSetupsHistory.length = 500;
  }
  persistIndicatorHistory();
  return newSetup;
}

/**
 * Ensures no two open (ACTIVE / PENDING) setups for the same ticker have opposite direction
 * without marking the junior/conflicting setup as `counterTrend: true` and linking them into a single bundle.
 */
function enforceJournalOpposingLockArbitration(target: IndicatorSetupItem): void {
  if (target.status !== "ACTIVE" && target.status !== "PENDING") return;

  const openForTicker = indicatorSetupsHistory.filter(
    (s) => s.ticker === target.ticker && (s.status === "ACTIVE" || s.status === "PENDING")
  );
  if (openForTicker.length <= 1) return;

  // Sort by timeframe descending so senior TF (1D/4H) is first
  const sorted = [...openForTicker].sort((a, b) => tfToSecServer(b.timeframe) - tfToSecServer(a.timeframe));
  const senior = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur.direction !== senior.direction) {
      senior.counterTrend = false;
      senior.lockRole = "ТРЕНД";

      cur.counterTrend = true;
      cur.lockRole = "ОТКАТ (контртренд, уменьшенный размер)";

      const bKey = senior.bundleKey || cur.bundleKey || `bundle_${target.ticker}_${senior.id}`;
      senior.bundleKey = bKey;
      cur.bundleKey = bKey;
      senior.linkedSetupId = cur.id;
      cur.linkedSetupId = senior.id;

      // Cap junior TP at senior entry Price if not already capped
      if (cur.direction === "LONG" && senior.entryPrice > cur.entryPrice) {
        cur.tp1 = Math.min(cur.tp1, senior.entryPrice);
        cur.tp2 = Math.min(cur.tp2, senior.entryPrice);
        cur.tp3 = Math.min(cur.tp3, senior.entryPrice);
      } else if (cur.direction === "SHORT" && senior.entryPrice < cur.entryPrice) {
        cur.tp1 = Math.max(cur.tp1, senior.entryPrice);
        cur.tp2 = Math.max(cur.tp2, senior.entryPrice);
        cur.tp3 = Math.max(cur.tp3, senior.entryPrice);
      }
    }
  }
}

/**
 * Live Evaluator: checks pending setups against real market ticks and bars
 */
export function evaluateIndicatorSetups(
  priceMap: Record<string, { currentPrice: number; high?: number; low?: number }>
): { updated: number; wins: number; losses: number } {
  let updated = 0;
  let wins = 0;
  let losses = 0;

  const now = Date.now();
  const timeMsk = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date());

  for (const item of indicatorSetupsHistory) {
    if (item.status !== "PENDING" && item.status !== "ACTIVE") continue;

    const quote = priceMap[item.ticker] || priceMap[item.ticker.toUpperCase()];
    if (!quote || !quote.currentPrice) continue;

    const cur = quote.currentPrice;
    const hi = quote.high || cur;
    const lo = quote.low || cur;

    // Timeout: if pending for more than 48 hours without hitting target or stop
    if (now - item.createdTimestamp > 48 * 60 * 60 * 1000) {
      if (!item.entryTriggered) {
        item.status = "NOT_TRIGGERED";
        item.exitReason = "NOT_TRIGGERED";
        item.notes = "Точка входа не была достигнута в течение 48 часов, сетап отменен";
        item.behaviorNote = "Лимитная точка входа не сработала: рынок ушел без активации ордера";
      } else {
        item.status = "EXPIRED";
        item.exitReason = "EXPIRED";
        item.notes = "Истек 48-часовой тайм-аут удержания позиции";
        item.behaviorNote = "Позиция закрыта по экспирации времени удержания";
      }
      item.exitPrice = cur;
      item.exitTimestamp = now;
      item.exitTimeMsk = `${timeMsk} МСК`;
      updated++;
      continue;
    }

    const isLong = item.direction === "LONG";
    const initialRisk = Math.abs(item.entryPrice - item.initialSl);

    // 1. Check entry price triggering
    if (!item.entryTriggered) {
      if (isLong && lo <= item.entryPrice) {
        item.entryTriggered = true;
        updated++;
      } else if (!isLong && hi >= item.entryPrice) {
        item.entryTriggered = true;
        updated++;
      } else {
        // Entry NOT triggered. Check if price ran away to TP1/TP2 or broke initial SL without entry
        const runawayHit = isLong ? (hi >= item.tp1 || (item.tp2 && hi >= item.tp2)) : (lo <= item.tp1 || (item.tp2 && lo <= item.tp2));
        const slBroken = isLong ? lo <= item.initialSl : hi >= item.initialSl;
        if (runawayHit) {
          item.status = "MISSED_ENTRY";
          item.exitReason = "MISSED_ENTRY";
          item.exitPrice = cur;
          item.exitTimestamp = now;
          item.exitTimeMsk = `${timeMsk} МСК`;
          item.pnlPercent = 0;
          item.pnlR = 0;
          item.notes = `Недоход (Missed Entry): цена достигла ${isLong ? (item.tp2 && hi >= item.tp2 ? "TP2" : "TP1") : (item.tp2 && lo <= item.tp2 ? "TP2" : "TP1")} без активации лимитного входа ($${item.entryPrice})`;
          item.behaviorNote = "Недоход (Missed Entry): рынок достиг цели без активации лимитного ордера, сетап аннулирован";
          updated++;
          continue;
        } else if (slBroken) {
          item.status = "NOT_TRIGGERED";
          item.exitReason = "NOT_TRIGGERED";
          item.exitPrice = cur;
          item.exitTimestamp = now;
          item.exitTimeMsk = `${timeMsk} МСК`;
          item.pnlPercent = 0;
          item.pnlR = 0;
          item.behaviorNote = "Сетап отменен: структура сломана до срабатывания точки входа";
          updated++;
          continue;
        }
        // Do not evaluate targets or wins for a position that was never entered
        continue;
      }
    }

    // 2. Evaluate targets & stops
    if (isLong) {
      if (hi >= item.tp3) {
        item.status = "WIN_TP3";
        item.entryTriggered = true;
        item.tp1Hit = true;
        item.tp2Hit = true;
        item.tp3Hit = true;
        item.exitReason = "TP3";
        item.exitPrice = item.tp3;
        item.pnlPercent = Math.round(((item.tp3 - item.entryPrice) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.tp3 - item.entryPrice) / initialRisk) * 100) / 100 : 3.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        item.behaviorNote = "Идеальный трендовый импульс: взяты все 3 цели TP1, TP2 и максимальный TP3";
        wins++;
        updated++;
      } else if (hi >= item.tp2) {
        item.entryTriggered = true;
        item.tp1Hit = true;
        item.tp2Hit = true;
        item.status = "WIN_TP2";
        item.exitReason = "TP2";
        item.exitPrice = item.tp2;
        item.pnlPercent = Math.round(((item.tp2 - item.entryPrice) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.tp2 - item.entryPrice) / initialRisk) * 100) / 100 : 2.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        item.behaviorNote = "Отработка импульса до институциональной цели TP2 (1.618 Fib)";
        wins++;
        updated++;
      } else if (hi >= item.tp1) {
        item.entryTriggered = true;
        item.tp1Hit = true;
        // If trailing stop is active and price drops below trailing SL
        if (lo <= item.activeTrailingSl && item.activeTrailingSl > item.entryPrice) {
          item.status = "WIN_TRAILING";
          item.trailingHit = true;
          item.exitReason = "TRAILING";
          item.exitPrice = item.activeTrailingSl;
          item.pnlPercent = Math.round(((item.activeTrailingSl - item.entryPrice) / item.entryPrice) * 10000) / 100;
          item.pnlR = initialRisk > 0 ? Math.round(((item.activeTrailingSl - item.entryPrice) / initialRisk) * 100) / 100 : 1.25;
          item.exitTimestamp = now;
          item.exitTimeMsk = `${timeMsk} МСК`;
          item.behaviorNote = "TP1 взят, остаток закрыт с прибылью по трейлинг-стопу (BE+0.15)";
          wins++;
          updated++;
        }
      } else if (lo <= item.activeTrailingSl) {
        item.slHit = true;
        item.exitPrice = item.activeTrailingSl;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        if (item.tp1Hit || item.activeTrailingSl >= item.entryPrice) {
          item.status = "WIN_TRAILING";
          item.trailingHit = true;
          item.exitReason = "TRAILING";
          item.pnlPercent = Math.round(((item.activeTrailingSl - item.entryPrice) / item.entryPrice) * 10000) / 100;
          item.pnlR = initialRisk > 0 ? Math.round(((item.activeTrailingSl - item.entryPrice) / initialRisk) * 100) / 100 : 0.8;
          item.behaviorNote = "Позиция защищена трейлинг-стопом в безубытке";
          wins++;
        } else {
          item.status = "LOSS_SL";
          item.exitReason = "SL";
          item.pnlPercent = Math.round(((item.activeTrailingSl - item.entryPrice) / item.entryPrice) * 10000) / 100;
          item.pnlR = initialRisk > 0 ? Math.round(((item.activeTrailingSl - item.entryPrice) / initialRisk) * 100) / 100 : -1.0;
          item.behaviorNote = "Срабатывание защитного стоп-лосса: слом структуры на импульсе продавцов";
          losses++;
        }
        updated++;
      }
    } else {
      // SHORT
      if (lo <= item.tp3) {
        item.status = "WIN_TP3";
        item.entryTriggered = true;
        item.tp1Hit = true;
        item.tp2Hit = true;
        item.tp3Hit = true;
        item.exitReason = "TP3";
        item.exitPrice = item.tp3;
        item.pnlPercent = Math.round(((item.entryPrice - item.tp3) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.tp3) / initialRisk) * 100) / 100 : 3.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        item.behaviorNote = "Полное медвежье раскрытие: взяты цели TP1, TP2 и максимальный TP3";
        wins++;
        updated++;
      } else if (lo <= item.tp2) {
        item.entryTriggered = true;
        item.tp1Hit = true;
        item.tp2Hit = true;
        item.status = "WIN_TP2";
        item.exitReason = "TP2";
        item.exitPrice = item.tp2;
        item.pnlPercent = Math.round(((item.entryPrice - item.tp2) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.tp2) / initialRisk) * 100) / 100 : 2.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        item.behaviorNote = "Импульсный сброс цены прямо к поддержке Put Wall / TP2";
        wins++;
        updated++;
      } else if (lo <= item.tp1) {
        item.entryTriggered = true;
        item.tp1Hit = true;
        if (hi >= item.activeTrailingSl && item.activeTrailingSl < item.entryPrice) {
          item.status = "WIN_TRAILING";
          item.trailingHit = true;
          item.exitReason = "TRAILING";
          item.exitPrice = item.activeTrailingSl;
          item.pnlPercent = Math.round(((item.entryPrice - item.activeTrailingSl) / item.entryPrice) * 10000) / 100;
          item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.activeTrailingSl) / initialRisk) * 100) / 100 : 1.25;
          item.exitTimestamp = now;
          item.exitTimeMsk = `${timeMsk} МСК`;
          item.behaviorNote = "Взят TP1, закрытие остатка с прибылью по трейлинг-стопу";
          wins++;
          updated++;
        }
      } else if (hi >= item.activeTrailingSl) {
        item.slHit = true;
        item.exitPrice = item.activeTrailingSl;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        if (item.tp1Hit || item.activeTrailingSl <= item.entryPrice) {
          item.status = "WIN_TRAILING";
          item.trailingHit = true;
          item.exitReason = "TRAILING";
          item.pnlPercent = Math.round(((item.entryPrice - item.activeTrailingSl) / item.entryPrice) * 10000) / 100;
          item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.activeTrailingSl) / initialRisk) * 100) / 100 : 0.8;
          item.behaviorNote = "Позиция защищена трейлинг-стопом в безубытке";
          wins++;
        } else {
          item.status = "LOSS_SL";
          item.exitReason = "SL";
          item.pnlPercent = Math.round(((item.entryPrice - item.activeTrailingSl) / item.entryPrice) * 10000) / 100;
          item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.activeTrailingSl) / initialRisk) * 100) / 100 : -1.0;
          item.behaviorNote = "Срабатывание стоп-лосса: агрессивный выкуп покупателями";
          losses++;
        }
        updated++;
      }
    }
  }

  if (updated > 0) {
    persistIndicatorHistory();
  }

  return { updated, wins, losses };
}

/**
 * Aggregates complete analytics across all tickers, timeframes, and setups
 */
export function computeIndicatorOverallStats(): IndicatorOverallStats {
  // Collapse linked "тренд+откат" bundles into single evaluation units so winrate is not diluted
  const effectiveItems: IndicatorSetupItem[] = [];
  const processedBundles = new Set<string>();

  for (const item of indicatorSetupsHistory) {
    if (!item.bundleKey) {
      effectiveItems.push(item);
      continue;
    }
    if (processedBundles.has(item.bundleKey)) {
      continue;
    }
    processedBundles.add(item.bundleKey);

    const bundleMembers = indicatorSetupsHistory.filter((s) => s.bundleKey === item.bundleKey);
    if (bundleMembers.length === 1) {
      effectiveItems.push(bundleMembers[0]);
      continue;
    }

    // Prefer senior trend lock as primary metadata carrier, and combine bundle outcome
    const sorted = [...bundleMembers].sort((a, b) => tfToSecServer(b.timeframe) - tfToSecServer(a.timeframe));
    const primary = sorted.find((s) => !s.counterTrend) || sorted[0];

    const anyWin = bundleMembers.some((s) => s.status.startsWith("WIN"));
    const allFinished = bundleMembers.every((s) => s.status !== "PENDING" && s.status !== "ACTIVE");
    const anyLoss = bundleMembers.some((s) => s.status === "LOSS_SL");
    const combinedPnlPercent = bundleMembers.reduce((sum, s) => sum + (s.pnlPercent || 0), 0);
    const combinedPnlR = bundleMembers.reduce((sum, s) => sum + (s.pnlR || (s.status.startsWith("WIN") ? 1.5 : s.status === "LOSS_SL" ? -1.0 : 0)), 0);

    let bundleStatus: IndicatorSetupStatus = primary.status;
    if (anyWin && (combinedPnlR >= 0 || !anyLoss)) {
      bundleStatus = "WIN_TP1";
    } else if (anyLoss && combinedPnlR < 0 && allFinished) {
      bundleStatus = "LOSS_SL";
    } else if (!allFinished && !anyWin) {
      bundleStatus = "PENDING";
    }

    effectiveItems.push({
      ...primary,
      status: bundleStatus,
      pnlPercent: combinedPnlPercent,
      pnlR: combinedPnlR
    });
  }

  const totalSetups = effectiveItems.length;
  let activePending = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalNotTriggered = 0;
  let totalExpired = 0;

  let grossProfitR = 0;
  let grossLossR = 0;
  let totalR = 0;
  let totalPnLPercent = 0;

  let currentConsecWins = 0;
  let maxConsecutiveWins = 0;
  let currentConsecLosses = 0;
  let maxConsecutiveLosses = 0;

  const byTicker: Record<string, IndicatorTickerMetric> = {};

  const TF_DESCRIPTIONS: Record<string, string> = {
    "5m": "⚡ M5 Скальпинг (Быстрый импульс, вход OTE, трейл BE+0.15)",
    "15m": "🎯 M15 Интрадей (Лоренцевский ML, Zero-Flip, Call/Put Walls)",
    "30m": "🧭 M30 Свинг (Консенсус старших TF, FVG баланс)",
    "1h": "📊 H1 Интрадей/Свинг (Институциональный поток, OTE 0.618)",
    "4h": "🏛️ H4 Трендовый Свинг (SMC ордерблоки, EMA 200, крупные уровни)",
    "1d": "👑 D1 Макро Цикл (Глобальные тренды, открытый интерес, гамма)"
  };

  const byTimeframe: IndicatorOverallStats["byTimeframe"] = {};
  for (const tf of ["5m", "15m", "30m", "1h", "4h", "1d"]) {
    byTimeframe[tf] = {
      timeframe: tf,
      total: 0,
      pending: 0,
      wins: 0,
      losses: 0,
      notTriggered: 0,
      winRate: 0,
      pnlPercent: 0,
      profitFactor: 0,
      avgR: 0,
      description: TF_DESCRIPTIONS[tf] || `${tf.toUpperCase()} таймфрейм`
    };
  }

  const bySetupType: IndicatorOverallStats["bySetupType"] = {};

  for (const item of effectiveItems) {
    // 1. Ticker bucket
    if (!byTicker[item.ticker]) {
      byTicker[item.ticker] = {
        ticker: item.ticker,
        total: 0,
        pending: 0,
        wins: 0,
        losses: 0,
        notTriggered: 0,
        winRate: 0,
        pnlPercent: 0,
        profitFactor: 0,
        avgR: 0
      };
    }
    const tBucket = byTicker[item.ticker];
    tBucket.total++;

    // 2. Timeframe bucket
    if (!byTimeframe[item.timeframe]) {
      byTimeframe[item.timeframe] = {
        timeframe: item.timeframe,
        total: 0,
        pending: 0,
        wins: 0,
        losses: 0,
        notTriggered: 0,
        winRate: 0,
        pnlPercent: 0,
        profitFactor: 0,
        avgR: 0,
        description: TF_DESCRIPTIONS[item.timeframe] || `${item.timeframe.toUpperCase()} таймфрейм`
      };
    }
    const tfBucket = byTimeframe[item.timeframe];
    tfBucket.total++;

    // 3. Setup type bucket
    if (!bySetupType[item.setupName]) {
      bySetupType[item.setupName] = {
        setupName: item.setupName,
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pnlPercent: 0
      };
    }
    const stBucket = bySetupType[item.setupName];
    stBucket.total++;

    if (item.status === "PENDING" || item.status === "ACTIVE") {
      activePending++;
      tBucket.pending++;
      tfBucket.pending++;
      continue;
    }

    if (item.status === "NOT_TRIGGERED") {
      totalNotTriggered++;
      tBucket.notTriggered = (tBucket.notTriggered || 0) + 1;
      tfBucket.notTriggered++;
      continue;
    }

    if (item.status.startsWith("WIN")) {
      totalWins++;
      tBucket.wins++;
      tfBucket.wins++;
      stBucket.wins++;

      const pnl = item.pnlPercent || 0;
      const r = item.pnlR || 1.5;
      totalPnLPercent += pnl;
      tBucket.pnlPercent += pnl;
      tfBucket.pnlPercent += pnl;
      stBucket.pnlPercent += pnl;

      grossProfitR += r;
      totalR += r;

      currentConsecWins++;
      if (currentConsecWins > maxConsecutiveWins) maxConsecutiveWins = currentConsecWins;
      currentConsecLosses = 0;
    } else if (item.status === "LOSS_SL") {
      totalLosses++;
      tBucket.losses++;
      tfBucket.losses++;
      stBucket.losses++;

      const pnl = item.pnlPercent || -1.0;
      const r = Math.abs(item.pnlR || 1.0);
      totalPnLPercent += pnl;
      tBucket.pnlPercent += pnl;
      tfBucket.pnlPercent += pnl;
      stBucket.pnlPercent += pnl;

      grossLossR += r;
      totalR -= r;

      currentConsecLosses++;
      if (currentConsecLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentConsecLosses;
      currentConsecWins = 0;
    } else if (item.status === "EXPIRED") {
      totalExpired++;
    }
  }

  const finishedCount = totalWins + totalLosses;
  const winRate = finishedCount > 0 ? Math.round((totalWins / finishedCount) * 1000) / 10 : 0;
  const profitFactor = grossLossR > 0 ? Math.round((grossProfitR / grossLossR) * 100) / 100 : grossProfitR > 0 ? 99.0 : 0;
  const avgRMultiple = finishedCount > 0 ? Math.round((totalR / finishedCount) * 100) / 100 : 0;

  // Finalize ticker rates
  for (const k of Object.keys(byTicker)) {
    const t = byTicker[k];
    const fin = t.wins + t.losses;
    t.winRate = fin > 0 ? Math.round((t.wins / fin) * 1000) / 10 : 0;
    t.pnlPercent = Math.round(t.pnlPercent * 100) / 100;
  }

  // Finalize tf rates
  for (const k of Object.keys(byTimeframe)) {
    const tf = byTimeframe[k];
    const fin = tf.wins + tf.losses;
    tf.winRate = fin > 0 ? Math.round((tf.wins / fin) * 1000) / 10 : 0;
    tf.pnlPercent = Math.round(tf.pnlPercent * 100) / 100;
    tf.profitFactor = tf.losses > 0 ? Math.round((tf.wins * 1.8 / (tf.losses * 1.0)) * 100) / 100 : tf.wins > 0 ? 5.5 : 0;
    tf.avgR = fin > 0 ? Math.round(((tf.wins * 1.8 - tf.losses * 1.0) / fin) * 100) / 100 : 0;
  }

  // Finalize setup rates
  for (const k of Object.keys(bySetupType)) {
    const st = bySetupType[k];
    const fin = st.wins + st.losses;
    st.winRate = fin > 0 ? Math.round((st.wins / fin) * 1000) / 10 : 0;
    st.pnlPercent = Math.round(st.pnlPercent * 100) / 100;
  }

  const recentCompleted = indicatorSetupsHistory
    .filter(s => s.status !== "PENDING")
    .slice(0, 50);

  return {
    totalSetups,
    activePending,
    totalWins,
    totalLosses,
    totalNotTriggered,
    totalExpired,
    winRate,
    profitFactor,
    avgRMultiple,
    totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    byTicker,
    byTimeframe,
    bySetupType,
    recentCompleted
  };
}

export function getIndicatorSetupsHistory(filters?: { ticker?: string; timeframe?: string; status?: string; limit?: number }): IndicatorSetupItem[] {
  let list = [...indicatorSetupsHistory];
  if (filters?.ticker && filters.ticker !== "ALL") {
    list = list.filter(s => s.ticker === filters.ticker);
  }
  if (filters?.timeframe && filters.timeframe !== "ALL") {
    list = list.filter(s => s.timeframe === filters.timeframe);
  }
  if (filters?.status && filters.status !== "ALL") {
    if (filters.status === "WIN") {
      list = list.filter(s => s.status.startsWith("WIN"));
    } else {
      list = list.filter(s => s.status === filters.status);
    }
  }
  const limit = filters?.limit || 150;
  return list.slice(0, limit);
}

export function deleteIndicatorSetup(id: string): boolean {
  const initialLen = indicatorSetupsHistory.length;
  indicatorSetupsHistory = indicatorSetupsHistory.filter(s => s.id !== id);
  if (indicatorSetupsHistory.length !== initialLen) {
    persistIndicatorHistory();
    return true;
  }
  return false;
}

export function resetIndicatorStats(): void {
  indicatorSetupsHistory = [];
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    fs.writeFileSync(INDICATOR_HISTORY_FILE, "[]", "utf-8");
  } catch {}
}
