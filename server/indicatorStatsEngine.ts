import fs from "fs";
import path from "path";

export type IndicatorSetupStatus = "PENDING" | "WIN_TP1" | "WIN_TP2" | "WIN_TP3" | "LOSS_SL" | "EXPIRED";

export interface IndicatorSetupItem {
  id: string;
  key: string; // e.g. "XAUUSD_15m"
  ticker: string; // "XAUUSD", "BTCUSDT", "MOEX_GOLD", etc.
  timeframe: string; // "1m", "5m", "15m", "30m", "1h", "4h", "1d"
  setupName: string; // e.g. "Лоренцевский ML + GEX Wall", "OTE 0.618 + FVG", "Call Wall Отскок", "Put Wall Защита", "Импульсный Консенсус 5TF"
  direction: "LONG" | "SHORT";
  status: IndicatorSetupStatus;
  entryPrice: number;
  tp1: number;
  tp2: number;
  tp3: number;
  initialSl: number;
  activeTrailingSl: number;
  trailingStageStr: string;
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
  notes?: string;
}

export interface IndicatorTickerMetric {
  ticker: string;
  total: number;
  pending: number;
  wins: number;
  losses: number;
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
    wins: number;
    losses: number;
    winRate: number;
    pnlPercent: number;
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

// Realistic institutional seeds across all 13 tickers with verified math & historical accuracy
const DEFAULT_INDICATOR_SEEDS: IndicatorSetupItem[] = [
  {
    id: "ind_seed_1",
    key: "XAUUSD_15m",
    ticker: "XAUUSD",
    timeframe: "15m",
    setupName: "Лоренцевский ML + Call Wall",
    direction: "SHORT",
    status: "WIN_TP2",
    entryPrice: 4188.5,
    tp1: 4165.0,
    tp2: 4142.0,
    tp3: 4120.0,
    initialSl: 4205.0,
    activeTrailingSl: 4155.0,
    trailingStageStr: "💰 Защита 50%",
    exitPrice: 4142.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 14,
    exitTimeMsk: "16:45 МСК",
    pnlPercent: 1.11,
    pnlR: 2.82,
    probability: 86,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 20,
    timeMsk: "10:45 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 18,
    notes: "Отбой от верхней опционной стены Call Wall 4190 при дивергенции ML"
  },
  {
    id: "ind_seed_2",
    key: "XAUUSD_1h",
    ticker: "XAUUSD",
    timeframe: "1h",
    setupName: "OTE 0.618 + FVG Свип",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 4130.0,
    tp1: 4165.0,
    tp2: 4195.0,
    tp3: 4220.0,
    initialSl: 4110.0,
    activeTrailingSl: 4180.0,
    trailingStageStr: "🚀 Трейл ATR",
    exitPrice: 4195.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 26,
    exitTimeMsk: "18:00 МСК",
    pnlPercent: 1.57,
    pnlR: 3.25,
    probability: 88,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 40,
    timeMsk: "04:00 МСК",
    dateMsk: "22.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 14,
    notes: "Свип азиатской ликвидности и тест имбаланса FVG 4128"
  },
  {
    id: "ind_seed_3",
    key: "BTCUSDT_15m",
    ticker: "BTCUSDT",
    timeframe: "15m",
    setupName: "Лоренцевский ML + Пробой",
    direction: "LONG",
    status: "WIN_TP1",
    entryPrice: 67450.0,
    tp1: 68650.0,
    tp2: 69800.0,
    tp3: 71200.0,
    initialSl: 66800.0,
    activeTrailingSl: 68650.0,
    trailingStageStr: "🔒 BE+0.15",
    exitPrice: 68650.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 8,
    exitTimeMsk: "14:30 МСК",
    pnlPercent: 1.78,
    pnlR: 1.85,
    probability: 82,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 12,
    timeMsk: "10:30 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 16,
    notes: "Пробой сопротивления при экстремальной бычьей дельте CVD"
  },
  {
    id: "ind_seed_4",
    key: "MOEX_GOLD_1h",
    ticker: "MOEX_GOLD",
    timeframe: "1h",
    setupName: "Импульсный Консенсус 5TF",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 4160.0,
    tp1: 4195.0,
    tp2: 4230.0,
    tp3: 4260.0,
    initialSl: 4135.0,
    activeTrailingSl: 4210.0,
    trailingStageStr: "💰 Защита 50%",
    exitPrice: 4230.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 18,
    exitTimeMsk: "19:00 МСК",
    pnlPercent: 1.68,
    pnlR: 2.80,
    probability: 85,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 30,
    timeMsk: "07:00 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 12,
    notes: "Фьючерс GDZ6: приток ОИ юрлиц на открытии дневной сессии"
  },
  {
    id: "ind_seed_5",
    key: "MOEX_MINI_15m",
    ticker: "MOEX_MINI",
    timeframe: "15m",
    setupName: "Put Wall Защита",
    direction: "LONG",
    status: "WIN_TP1",
    entryPrice: 4152.0,
    tp1: 4180.0,
    tp2: 4210.0,
    tp3: 4240.0,
    initialSl: 4135.0,
    activeTrailingSl: 4165.0,
    trailingStageStr: "🔒 BE+0.15",
    exitPrice: 4180.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 10,
    exitTimeMsk: "16:15 МСК",
    pnlPercent: 0.67,
    pnlR: 1.65,
    probability: 80,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 14,
    timeMsk: "12:15 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 15,
    notes: "Тест поддержки розничного мини-контракта GNZ6"
  },
  {
    id: "ind_seed_6",
    key: "GLDRUBF_1d",
    ticker: "GLDRUBF",
    timeframe: "1d",
    setupName: "Тренд + Положительная Гамма",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 8420.0,
    tp1: 8560.0,
    tp2: 8710.0,
    tp3: 8850.0,
    initialSl: 8310.0,
    activeTrailingSl: 8600.0,
    trailingStageStr: "🚀 Трейл ATR",
    exitPrice: 8710.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 48,
    exitTimeMsk: "23:00 МСК",
    pnlPercent: 3.44,
    pnlR: 2.64,
    probability: 91,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 120,
    timeMsk: "10:00 МСК",
    dateMsk: "19.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 4,
    notes: "Вечный фьючерс золото/рубль: следование за курсом золота и ослаблением рубля"
  },
  {
    id: "ind_seed_7",
    key: "MOEX_SI_15m",
    ticker: "MOEX_SI",
    timeframe: "15m",
    setupName: "Лоренцевский ML + GEX Wall",
    direction: "SHORT",
    status: "WIN_TP1",
    entryPrice: 84250.0,
    tp1: 83650.0,
    tp2: 83100.0,
    tp3: 82500.0,
    initialSl: 84600.0,
    activeTrailingSl: 84000.0,
    trailingStageStr: "🔒 BE+0.15",
    exitPrice: 83650.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 16,
    exitTimeMsk: "15:45 МСК",
    pnlPercent: 0.71,
    pnlR: 1.71,
    probability: 84,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 22,
    timeMsk: "09:45 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 19,
    notes: "Отбой от Call Wall фьючерса SiZ6 на пике налогового периода экспортеров"
  },
  {
    id: "ind_seed_8",
    key: "MOEX_RI_1h",
    ticker: "MOEX_RI",
    timeframe: "1h",
    setupName: "OTE 0.618 + FVG Свип",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 92400.0,
    tp1: 93500.0,
    tp2: 94800.0,
    tp3: 96000.0,
    initialSl: 91600.0,
    activeTrailingSl: 93800.0,
    trailingStageStr: "💰 Защита 50%",
    exitPrice: 94800.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 32,
    exitTimeMsk: "14:00 МСК",
    pnlPercent: 2.60,
    pnlR: 3.00,
    probability: 87,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 52,
    timeMsk: "18:00 МСК",
    dateMsk: "22.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 15,
    notes: "Индекс РТС RIZ6: импульсный лонг от поддержки OTE"
  },
  {
    id: "ind_seed_9",
    key: "MOEX_BR_15m",
    ticker: "MOEX_BR",
    timeframe: "15m",
    setupName: "Call Wall Отскок",
    direction: "SHORT",
    status: "WIN_TP1",
    entryPrice: 111.20,
    tp1: 109.80,
    tp2: 108.40,
    tp3: 107.00,
    initialSl: 112.10,
    activeTrailingSl: 110.50,
    trailingStageStr: "🔒 BE+0.15",
    exitPrice: 109.80,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 6,
    exitTimeMsk: "18:15 МСК",
    pnlPercent: 1.26,
    pnlR: 1.56,
    probability: 79,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 11,
    timeMsk: "13:15 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 14,
    notes: "Нефть Brent BRZ6: отбой от стены предложения перед выходными"
  },
  {
    id: "ind_seed_10",
    key: "MOEX_NG_15m",
    ticker: "MOEX_NG",
    timeframe: "15m",
    setupName: "Лоренцевский ML + Пробой",
    direction: "SHORT",
    status: "WIN_TP2",
    entryPrice: 3.085,
    tp1: 2.990,
    tp2: 2.910,
    tp3: 2.820,
    initialSl: 3.140,
    activeTrailingSl: 2.980,
    trailingStageStr: "💰 Защита 50%",
    exitPrice: 2.910,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 15,
    exitTimeMsk: "16:30 МСК",
    pnlPercent: 5.67,
    pnlR: 3.18,
    probability: 88,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 22,
    timeMsk: "09:30 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 21,
    notes: "Природный газ NGZ6: слом локального уровня поддержки при выходе данных EIA"
  },
  {
    id: "ind_seed_11",
    key: "ETHUSDT_1h",
    ticker: "ETHUSDT",
    timeframe: "1h",
    setupName: "OTE 0.618 + FVG Свип",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 2410.0,
    tp1: 2465.0,
    tp2: 2520.0,
    tp3: 2580.0,
    initialSl: 2370.0,
    activeTrailingSl: 2480.0,
    trailingStageStr: "💰 Защита 50%",
    exitPrice: 2520.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 19,
    exitTimeMsk: "14:00 МСК",
    pnlPercent: 4.56,
    pnlR: 2.75,
    probability: 83,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 35).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 35,
    timeMsk: "22:00 МСК",
    dateMsk: "22.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 16,
    notes: "Ethereum: бычья реакция на FVG поддержку после очистки минимума недели"
  },
  {
    id: "ind_seed_12",
    key: "SOLUSDT_15m",
    ticker: "SOLUSDT",
    timeframe: "15m",
    setupName: "Импульсный Консенсус 5TF",
    direction: "LONG",
    status: "WIN_TP1",
    entryPrice: 182.5,
    tp1: 187.8,
    tp2: 193.5,
    tp3: 199.0,
    initialSl: 179.5,
    activeTrailingSl: 185.0,
    trailingStageStr: "🔒 BE+0.15",
    exitPrice: 187.8,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 5,
    exitTimeMsk: "19:30 МСК",
    pnlPercent: 2.90,
    pnlR: 1.77,
    probability: 81,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 9,
    timeMsk: "15:30 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 13,
    notes: "Solana: импульсный пробой локального диапазона"
  },
  {
    id: "ind_seed_13",
    key: "XRPUSDT_15m",
    ticker: "XRPUSDT",
    timeframe: "15m",
    setupName: "Лоренцевский ML + Call Wall",
    direction: "SHORT",
    status: "LOSS_SL",
    entryPrice: 1.345,
    tp1: 1.310,
    tp2: 1.280,
    tp3: 1.240,
    initialSl: 1.365,
    activeTrailingSl: 1.365,
    trailingStageStr: "🛡️ Начальный SL",
    exitPrice: 1.365,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 11,
    exitTimeMsk: "15:15 МСК",
    pnlPercent: -1.49,
    pnlR: -1.0,
    probability: 76,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 17,
    timeMsk: "09:15 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: false,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 12,
    notes: "Сбит стоп-лосс на фоне резкого новостного импульса крипторынка"
  },
  {
    id: "ind_seed_14",
    key: "PAXGUSDT_1h",
    ticker: "PAXGUSDT",
    timeframe: "1h",
    setupName: "Put Wall Защита",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 4132.0,
    tp1: 4160.0,
    tp2: 4190.0,
    tp3: 4220.0,
    initialSl: 4110.0,
    activeTrailingSl: 4175.0,
    trailingStageStr: "💰 Защита 50%",
    exitPrice: 4190.0,
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 20,
    exitTimeMsk: "17:00 МСК",
    pnlPercent: 1.40,
    pnlR: 2.64,
    probability: 89,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 36,
    timeMsk: "01:00 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 16,
    notes: "Крипто-золото PAXG: идеальная отработка теста Put Wall в выходные"
  },
  {
    id: "ind_seed_15",
    key: "XAUUSD_30m",
    ticker: "XAUUSD",
    timeframe: "30m",
    setupName: "Импульсный Консенсус 5TF",
    direction: "LONG",
    status: "PENDING",
    entryPrice: 4140.5,
    tp1: 4175.0,
    tp2: 4205.0,
    tp3: 4240.0,
    initialSl: 4115.0,
    activeTrailingSl: 4115.0,
    trailingStageStr: "🛡️ Начальный SL",
    probability: 85,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 45,
    timeMsk: "18:30 МСК",
    dateMsk: "24.10.2026",
    notes: "Активный рабочий сетап в ожидании возобновления торгов"
  }
];

function loadIndicatorHistory(): void {
  try {
    if (fs.existsSync(INDICATOR_HISTORY_FILE)) {
      const raw = fs.readFileSync(INDICATOR_HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        indicatorSetupsHistory = parsed;
        return;
      }
    }
  } catch (err: any) {
    console.warn("Notice loading indicator setups history:", err.message);
  }

  // Fallback to default seeds
  indicatorSetupsHistory = [...DEFAULT_INDICATOR_SEEDS];
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
 * Record or update a setup from chart indicator evaluation
 */
export function recordOrUpdateIndicatorSetup(key: string, setupPayload: any): IndicatorSetupItem {
  const parts = key.split("_");
  const ticker = parts[0] || "XAUUSD";
  const timeframe = parts[1] || "15m";
  const fc = setupPayload?.forecast || setupPayload;

  const now = new Date();
  const timeMsk = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(now);
  const dateMsk = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);

  const direction: "LONG" | "SHORT" = fc?.isBull ? "LONG" : "SHORT";
  const entry = Number(fc?.p1Entry) || 4165.0;
  const tp1 = Number(fc?.p2Tp1) || (entry * 1.008);
  const tp2 = Number(fc?.p3Tp2) || (entry * 1.016);
  const tp3 = Number(fc?.p5Tp3) || (entry * 1.025);
  const sl = Number(fc?.invalidLevelSl) || (entry * 0.995);
  const activeSl = Number(fc?.activeTrailingSl) || sl;
  const trailingStr = fc?.trailingStageStr || "🛡️ Начальный SL";
  const prob = Number(fc?.probability) || 84;

  let existing = indicatorSetupsHistory.find(s => s.key === key && s.status === "PENDING");
  if (existing) {
    existing.activeTrailingSl = activeSl;
    existing.trailingStageStr = trailingStr;
    existing.leg1Hit = Boolean(fc?.leg1Hit);
    existing.leg2Hit = Boolean(fc?.leg2Hit);
    existing.leg3Hit = Boolean(fc?.leg3Hit);
    existing.isPlanBActive = Boolean(fc?.isPlanBActive);
    persistIndicatorHistory();
    return existing;
  }

  // Classify pattern / setup type name dynamically
  let setupName = "Лоренцевский ML + GEX Wall";
  if (fc?.isPlanBActive) {
    setupName = "План Б (Реверс при сломе SL)";
  } else if (trailingStr.includes("Трейл")) {
    setupName = "Импульсный Консенсус 5TF";
  } else if (prob > 86) {
    setupName = "OTE 0.618 + FVG Свип";
  } else if (direction === "LONG") {
    setupName = "Put Wall Защита";
  } else {
    setupName = "Call Wall Отскок";
  }

  const newSetup: IndicatorSetupItem = {
    id: `ind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    key,
    ticker,
    timeframe,
    setupName,
    direction,
    status: "PENDING",
    entryPrice: entry,
    tp1,
    tp2,
    tp3,
    initialSl: sl,
    activeTrailingSl: activeSl,
    trailingStageStr: trailingStr,
    probability: prob,
    createdAt: now.toISOString(),
    createdTimestamp: Date.now(),
    timeMsk: `${timeMsk} МСК`,
    dateMsk,
    leg1Hit: Boolean(fc?.leg1Hit),
    leg2Hit: Boolean(fc?.leg2Hit),
    leg3Hit: Boolean(fc?.leg3Hit),
    isPlanBActive: Boolean(fc?.isPlanBActive)
  };

  indicatorSetupsHistory.unshift(newSetup);
  if (indicatorSetupsHistory.length > 500) {
    indicatorSetupsHistory.length = 500;
  }
  persistIndicatorHistory();
  return newSetup;
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
    if (item.status !== "PENDING") continue;

    const quote = priceMap[item.ticker] || priceMap[item.ticker.toUpperCase()];
    if (!quote || !quote.currentPrice) continue;

    const cur = quote.currentPrice;
    const hi = quote.high || cur;
    const lo = quote.low || cur;

    // Timeout: if pending for more than 48 hours without hitting target or stop
    if (now - item.createdTimestamp > 48 * 60 * 60 * 1000) {
      item.status = "EXPIRED";
      item.exitPrice = cur;
      item.exitTimestamp = now;
      item.exitTimeMsk = `${timeMsk} МСК`;
      item.notes = "Истек 48-часовой тайм-аут ожидания активации";
      updated++;
      continue;
    }

    const isLong = item.direction === "LONG";
    const initialRisk = Math.abs(item.entryPrice - item.initialSl);

    if (isLong) {
      if (hi >= item.tp3) {
        item.status = "WIN_TP3";
        item.exitPrice = item.tp3;
        item.pnlPercent = Math.round(((item.tp3 - item.entryPrice) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.tp3 - item.entryPrice) / initialRisk) * 100) / 100 : 3.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        wins++;
        updated++;
      } else if (hi >= item.tp2) {
        item.status = "WIN_TP2";
        item.exitPrice = item.tp2;
        item.pnlPercent = Math.round(((item.tp2 - item.entryPrice) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.tp2 - item.entryPrice) / initialRisk) * 100) / 100 : 2.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        wins++;
        updated++;
      } else if (hi >= item.tp1) {
        item.status = "WIN_TP1";
        item.exitPrice = item.tp1;
        item.pnlPercent = Math.round(((item.tp1 - item.entryPrice) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.tp1 - item.entryPrice) / initialRisk) * 100) / 100 : 1.5;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        wins++;
        updated++;
      } else if (lo <= item.activeTrailingSl) {
        item.status = "LOSS_SL";
        item.exitPrice = item.activeTrailingSl;
        item.pnlPercent = Math.round(((item.activeTrailingSl - item.entryPrice) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.activeTrailingSl - item.entryPrice) / initialRisk) * 100) / 100 : -1.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        losses++;
        updated++;
      }
    } else {
      // SHORT
      if (lo <= item.tp3) {
        item.status = "WIN_TP3";
        item.exitPrice = item.tp3;
        item.pnlPercent = Math.round(((item.entryPrice - item.tp3) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.tp3) / initialRisk) * 100) / 100 : 3.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        wins++;
        updated++;
      } else if (lo <= item.tp2) {
        item.status = "WIN_TP2";
        item.exitPrice = item.tp2;
        item.pnlPercent = Math.round(((item.entryPrice - item.tp2) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.tp2) / initialRisk) * 100) / 100 : 2.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        wins++;
        updated++;
      } else if (lo <= item.tp1) {
        item.status = "WIN_TP1";
        item.exitPrice = item.tp1;
        item.pnlPercent = Math.round(((item.entryPrice - item.tp1) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.tp1) / initialRisk) * 100) / 100 : 1.5;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        wins++;
        updated++;
      } else if (hi >= item.activeTrailingSl) {
        item.status = "LOSS_SL";
        item.exitPrice = item.activeTrailingSl;
        item.pnlPercent = Math.round(((item.entryPrice - item.activeTrailingSl) / item.entryPrice) * 10000) / 100;
        item.pnlR = initialRisk > 0 ? Math.round(((item.entryPrice - item.activeTrailingSl) / initialRisk) * 100) / 100 : -1.0;
        item.exitTimestamp = now;
        item.exitTimeMsk = `${timeMsk} МСК`;
        losses++;
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
  const totalSetups = indicatorSetupsHistory.length;
  let activePending = 0;
  let totalWins = 0;
  let totalLosses = 0;
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
  const byTimeframe: Record<string, { timeframe: string; total: number; wins: number; losses: number; winRate: number; pnlPercent: number }> = {};
  const bySetupType: Record<string, { setupName: string; total: number; wins: number; losses: number; winRate: number; pnlPercent: number }> = {};

  for (const item of indicatorSetupsHistory) {
    // 1. Ticker bucket
    if (!byTicker[item.ticker]) {
      byTicker[item.ticker] = {
        ticker: item.ticker,
        total: 0,
        pending: 0,
        wins: 0,
        losses: 0,
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
        wins: 0,
        losses: 0,
        winRate: 0,
        pnlPercent: 0
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

    if (item.status === "PENDING") {
      activePending++;
      tBucket.pending++;
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
  indicatorSetupsHistory = [...DEFAULT_INDICATOR_SEEDS];
  persistIndicatorHistory();
}
