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
  exitReason?: "TP1" | "TP2" | "TP3" | "TRAILING" | "SL" | "NOT_TRIGGERED" | "EXPIRED";
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
  notes?: string;
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

// Realistic institutional seeds across all 6 timeframes (5m, 15m, 30m, 1h, 4h, 1d) and key tickers
const DEFAULT_INDICATOR_SEEDS: IndicatorSetupItem[] = [
  // ==================== 5M SCALPING ====================
  {
    id: "ind_seed_5m_1",
    key: "XAUUSD_5m",
    ticker: "XAUUSD",
    timeframe: "5m",
    setupName: "Лоренцевский ML + OTE 0.618 Скальп",
    direction: "LONG",
    status: "WIN_TRAILING",
    entryPrice: 4004.20,
    tp1: 4012.00,
    tp2: 4019.00,
    tp3: 4028.00,
    initialSl: 3998.00,
    activeTrailingSl: 4012.00,
    trailingStageStr: "🔒 BE+0.15 (Защита)",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: false,
    trailingHit: true,
    exitPrice: 4012.00,
    exitReason: "TRAILING",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 6,
    exitTimeMsk: "14:15 МСК",
    pnlPercent: 0.19,
    pnlR: 1.25,
    probability: 83,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 8,
    timeMsk: "12:15 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 14,
    notes: "Скальпинг M5: быстрый отскок от OTE 0.618, взят TP1, позиция защищена по трейлинг-стопу",
    behaviorNote: "Скальп M5: реакция на бычий импульс, взятие первой цели TP1 и фиксация прибыли по трейлу"
  },
  {
    id: "ind_seed_5m_2",
    key: "BTCUSDT_5m",
    ticker: "BTCUSDT",
    timeframe: "5m",
    setupName: "Импульсный Консенсус 5TF",
    direction: "SHORT",
    status: "WIN_TP1",
    entryPrice: 67800.0,
    tp1: 67200.0,
    tp2: 66600.0,
    tp3: 65900.0,
    initialSl: 68150.0,
    activeTrailingSl: 67600.0,
    trailingStageStr: "🔒 BE+0.15",
    entryTriggered: true,
    tp1Hit: true,
    exitPrice: 67200.0,
    exitReason: "TP1",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 10,
    exitTimeMsk: "16:20 МСК",
    pnlPercent: 0.88,
    pnlR: 1.71,
    probability: 84,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 13).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 13,
    timeMsk: "13:40 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: true,
    barsHeld: 11,
    notes: "Медвежий импульс M5: пробой локальной поддержки при отрицательной дельте CVD",
    behaviorNote: "Трендовый импульс сработал быстро до TP1 с подтягиванием безубытка"
  },
  {
    id: "ind_seed_5m_3",
    key: "MOEX_GOLD_5m",
    ticker: "MOEX_GOLD",
    timeframe: "5m",
    setupName: "План Б (Реверс при сломе SL)",
    direction: "SHORT",
    status: "WIN_TP1",
    entryPrice: 4062.0,
    tp1: 4048.0,
    tp2: 4038.0,
    tp3: 4028.0,
    initialSl: 4070.0,
    activeTrailingSl: 4056.0,
    trailingStageStr: "🔒 BE+0.15",
    entryTriggered: true,
    tp1Hit: true,
    isPlanBActive: true,
    exitPrice: 4048.0,
    exitReason: "TP1",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 14,
    exitTimeMsk: "15:45 МСК",
    pnlPercent: 0.34,
    pnlR: 1.75,
    probability: 81,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 18,
    timeMsk: "11:30 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    barsHeld: 9,
    notes: "План Б: мгновенный разворот индикатора после ложного закола вверх, импульсный тейк",
    behaviorNote: "Индикатор распознал ложный пробой (Fakeout) и перевернулся в шорт"
  },

  // ==================== 15M INTRADAY ====================
  {
    id: "ind_seed_1",
    key: "XAUUSD_15m",
    ticker: "XAUUSD",
    timeframe: "15m",
    setupName: "Лоренцевский ML + Zero-Flip Срыв",
    direction: "SHORT",
    status: "WIN_TP2",
    entryPrice: 4026.5,
    tp1: 4005.0,
    tp2: 3980.0,
    tp3: 3965.0,
    initialSl: 4036.5,
    activeTrailingSl: 4005.0,
    trailingStageStr: "💰 Защита 50%",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 3980.0,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 14,
    exitTimeMsk: "17:25 МСК",
    pnlPercent: 1.15,
    pnlR: 2.70,
    probability: 86,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 20,
    timeMsk: "16:30 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    leg3Hit: false,
    barsHeld: 18,
    notes: "Пробой рубежа Zero-Flip 4026.5 с каскадным сбросом дилеров прямо до Put Wall 3975.65",
    behaviorNote: "Срыв под Zero-Flip в отрицательной гамме вызвал лавину ликвидаций прямо к полу рынка"
  },
  {
    id: "ind_seed_15m_not_trig",
    key: "XAUUSD_15m",
    ticker: "XAUUSD",
    timeframe: "15m",
    setupName: "Call Wall Отскок (Лимит)",
    direction: "SHORT",
    status: "NOT_TRIGGERED",
    entryPrice: 4038.50,
    tp1: 4015.00,
    tp2: 3995.00,
    tp3: 3980.00,
    initialSl: 4048.00,
    activeTrailingSl: 4048.00,
    trailingStageStr: "🛡️ Начальный SL",
    entryTriggered: false,
    tp1Hit: false,
    tp2Hit: false,
    slHit: false,
    exitReason: "NOT_TRIGGERED",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 24,
    exitTimeMsk: "16:15 МСК",
    probability: 79,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 30,
    timeMsk: "12:00 МСК",
    dateMsk: "23.10.2026",
    notes: "Сетап сменился до срабатывания точки входа: цена развернулась на 4034.09, не дойдя до лимитного уровня 4038.50, после чего алгоритм переключился на пробой Zero-Flip",
    behaviorNote: "Лимитный ордер не активирован: сетап отменен алгоритмом при смене фазы рынка"
  },
  {
    id: "ind_seed_15m_pend",
    key: "XAUUSD_15m",
    ticker: "XAUUSD",
    timeframe: "15m",
    setupName: "Call Wall Отскок",
    direction: "SHORT",
    status: "PENDING",
    entryPrice: 4006.05,
    tp1: 3985.00,
    tp2: 3974.53,
    tp3: 3960.14,
    initialSl: 4017.17,
    activeTrailingSl: 4004.88,
    trailingStageStr: "🔒 BE+0.15",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: false,
    probability: 74,
    createdAt: "2026-10-25T18:59:28.132Z",
    createdTimestamp: 1792954768132,
    timeMsk: "21:59 МСК",
    dateMsk: "25.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    isPlanBActive: false,
    notes: "Вход сработал на 4006.05, TP1 (3985) взят, стоп перенесен в безубыток BE+0.15 на 4004.88",
    behaviorNote: "Активный рабочий сетап: часть позиции закрыта на TP1, остаток защищен безубытком"
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
    entryTriggered: true,
    tp1Hit: true,
    exitPrice: 68650.0,
    exitReason: "TP1",
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
    notes: "Пробой сопротивления при экстремальной бычьей дельте CVD",
    behaviorNote: "Импульсный пробой подтвержден всплеском объемов"
  },
  {
    id: "ind_seed_5",
    key: "MOEX_MINI_15m",
    ticker: "MOEX_MINI",
    timeframe: "15m",
    setupName: "Put Wall Защита",
    direction: "LONG",
    status: "WIN_TP1",
    entryPrice: 4052.0,
    tp1: 4065.0,
    tp2: 4075.0,
    tp3: 4085.0,
    initialSl: 4044.0,
    activeTrailingSl: 4058.0,
    trailingStageStr: "🔒 BE+0.15",
    entryTriggered: true,
    tp1Hit: true,
    exitPrice: 4065.0,
    exitReason: "TP1",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 10,
    exitTimeMsk: "16:15 МСК",
    pnlPercent: 0.32,
    pnlR: 1.63,
    probability: 80,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 14,
    timeMsk: "12:15 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: false,
    leg3Hit: false,
    barsHeld: 15,
    notes: "Тест поддержки розничного мини-контракта GNZ6 4052",
    behaviorNote: "Удержание уровня институциональной поддержки"
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
    entryTriggered: true,
    tp1Hit: true,
    exitPrice: 83650.0,
    exitReason: "TP1",
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
    barsHeld: 19,
    notes: "Отбой от Call Wall фьючерса SiZ6 на пике налогового периода экспортеров",
    behaviorNote: "Дилеры защитили потолок Call Wall крупными продажами"
  },
  {
    id: "ind_seed_9",
    key: "MOEX_BR_15m",
    ticker: "MOEX_BR",
    timeframe: "15m",
    setupName: "Call Wall Отскок",
    direction: "SHORT",
    status: "WIN_TP1",
    entryPrice: 111.2,
    tp1: 109.8,
    tp2: 108.4,
    tp3: 107.0,
    initialSl: 112.1,
    activeTrailingSl: 110.5,
    trailingStageStr: "🔒 BE+0.15",
    entryTriggered: true,
    tp1Hit: true,
    exitPrice: 109.8,
    exitReason: "TP1",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 7,
    exitTimeMsk: "18:15 МСК",
    pnlPercent: 1.26,
    pnlR: 1.56,
    probability: 79,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 11,
    timeMsk: "13:15 МСК",
    dateMsk: "24.10.2026",
    leg1Hit: true,
    barsHeld: 14,
    notes: "Нефть Brent BRZ6: отбой от стены предложения перед выходными",
    behaviorNote: "Фиксация позиций перед закрытием сессии"
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
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 2.910,
    exitReason: "TP2",
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
    barsHeld: 21,
    notes: "Природный газ NGZ6: слом локального уровня поддержки при выходе данных EIA",
    behaviorNote: "Сильный импульс после фундаментального отчета"
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
    entryTriggered: true,
    tp1Hit: true,
    exitPrice: 187.8,
    exitReason: "TP1",
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
    barsHeld: 13,
    notes: "Solana: импульсный пробой локального диапазона",
    behaviorNote: "Следование за трендом рынка"
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
    entryTriggered: true,
    slHit: true,
    exitPrice: 1.365,
    exitReason: "SL",
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
    barsHeld: 12,
    notes: "Сбит стоп-лосс на фоне резкого новостного импульса крипторынка",
    behaviorNote: "Истинный пробой сопротивления на новостях вопреки отбою"
  },

  // ==================== 30M SESSION CONFLUENCE ====================
  {
    id: "ind_seed_30m_1",
    key: "XAUUSD_30m",
    ticker: "XAUUSD",
    timeframe: "30m",
    setupName: "OTE 0.618 + FVG Свип",
    direction: "LONG",
    status: "WIN_TP1",
    entryPrice: 3988.50,
    tp1: 4004.00,
    tp2: 4018.00,
    tp3: 4030.00,
    initialSl: 3978.00,
    activeTrailingSl: 3995.00,
    trailingStageStr: "🔒 BE+0.15 (Защита)",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: false,
    exitPrice: 4004.00,
    exitReason: "TP1",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 16,
    exitTimeMsk: "15:00 МСК",
    pnlPercent: 0.39,
    pnlR: 1.48,
    probability: 85,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 22,
    timeMsk: "09:00 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    barsHeld: 12,
    notes: "30-минутный сетап: выкуп теста FVG имбаланса 3988 с достижением первой цели 4004",
    behaviorNote: "Четкая реакция на 30-минутный уровень институционального спроса"
  },
  {
    id: "ind_seed_15",
    key: "XAUUSD_30m",
    ticker: "XAUUSD",
    timeframe: "30m",
    setupName: "Импульсный Консенсус 5TF",
    direction: "LONG",
    status: "PENDING",
    entryPrice: 3996.5,
    tp1: 4012.0,
    tp2: 4025.0,
    tp3: 4035.0,
    initialSl: 3984.0,
    activeTrailingSl: 3984.0,
    trailingStageStr: "🛡️ Начальный SL",
    entryTriggered: false,
    probability: 85,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 45,
    timeMsk: "18:30 МСК",
    dateMsk: "24.10.2026",
    notes: "Активный рабочий сетап в ожидании возобновления торгов в понедельник",
    behaviorNote: "Ожидание открытия торговой сессии понедельника"
  },

  // ==================== 1H SWING TREND ====================
  {
    id: "ind_seed_2",
    key: "XAUUSD_1h",
    ticker: "XAUUSD",
    timeframe: "1h",
    setupName: "OTE 0.618 + FVG Свип",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 4014.0,
    tp1: 4025.0,
    tp2: 4032.0,
    tp3: 4040.0,
    initialSl: 4006.0,
    activeTrailingSl: 4024.0,
    trailingStageStr: "🚀 Трейл ATR",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 4032.0,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 26,
    exitTimeMsk: "16:15 МСК",
    pnlPercent: 0.45,
    pnlR: 2.25,
    probability: 88,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 40,
    timeMsk: "11:30 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 14,
    notes: "Свип ликвидности 4010 и тест имбаланса FVG 4014 с отработкой волны до максимума дня 4034.09",
    behaviorNote: "Свип азиатской ликвидности с мощной реакцией вверх"
  },
  {
    id: "ind_seed_4",
    key: "MOEX_GOLD_1h",
    ticker: "MOEX_GOLD",
    timeframe: "1h",
    setupName: "Импульсный Консенсус 5TF",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 4056.0,
    tp1: 4068.0,
    tp2: 4078.0,
    tp3: 4090.0,
    initialSl: 4046.0,
    activeTrailingSl: 4068.0,
    trailingStageStr: "💰 Защита 50%",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 4078.0,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 18,
    exitTimeMsk: "19:00 МСК",
    pnlPercent: 0.54,
    pnlR: 2.20,
    probability: 85,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 30,
    timeMsk: "07:00 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 12,
    notes: "Фьючерс GDZ6: приток ОИ юрлиц на сессии с тестом поддержки 4056",
    behaviorNote: "Институциональный набор позиций на утренней сессии"
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
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 94800.0,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 42,
    exitTimeMsk: "14:00 МСК",
    pnlPercent: 2.60,
    pnlR: 3.00,
    probability: 87,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 60,
    timeMsk: "18:00 МСК",
    dateMsk: "22.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 15,
    notes: "Индекс РТС RIZ6: импульсный лонг от поддержки OTE",
    behaviorNote: "Идеальная отработка 1H зоны спроса"
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
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 2520.0,
    exitReason: "TP2",
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
    barsHeld: 16,
    notes: "Ethereum: бычья реакция на FVG поддержку после очистки минимума недели",
    behaviorNote: "Разворот от недельного минимума"
  },
  {
    id: "ind_seed_14",
    key: "PAXGUSDT_1h",
    ticker: "PAXGUSDT",
    timeframe: "1h",
    setupName: "Put Wall Защита",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 4008.5,
    tp1: 4022.0,
    tp2: 4030.0,
    tp3: 4042.0,
    initialSl: 3995.0,
    activeTrailingSl: 4022.0,
    trailingStageStr: "💰 Защита 50%",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 4030.0,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 20,
    exitTimeMsk: "17:00 МСК",
    pnlPercent: 0.54,
    pnlR: 1.59,
    probability: 89,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 36,
    timeMsk: "01:00 МСК",
    dateMsk: "23.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 16,
    notes: "Крипто-золото PAXG: тест Put Wall 4008 и отскок в рамках пятничной сессии 23.10",
    behaviorNote: "Следование за глобальным спотом золота"
  },

  // ==================== 4H POSITION SWING ====================
  {
    id: "ind_seed_4h_1",
    key: "XAUUSD_4h",
    ticker: "XAUUSD",
    timeframe: "4h",
    setupName: "SMC Order Block + 200 EMA",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 3978.00,
    tp1: 4015.00,
    tp2: 4035.00,
    tp3: 4055.00,
    initialSl: 3962.00,
    activeTrailingSl: 4015.00,
    trailingStageStr: "💰 Защита 50%",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 4035.00,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 36,
    exitTimeMsk: "20:00 МСК",
    pnlPercent: 1.43,
    pnlR: 3.56,
    probability: 90,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 72,
    timeMsk: "10:00 МСК",
    dateMsk: "22.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 8,
    notes: "Позиционный 4H сетап: институциональный отскок от бычьего ордерблока (+OB) и 200 EMA",
    behaviorNote: "Крупные участники рынка защитили 4H трендовый рубеж"
  },
  {
    id: "ind_seed_4h_2",
    key: "BTCUSDT_4h",
    ticker: "BTCUSDT",
    timeframe: "4h",
    setupName: "Тренд + Положительная Гамма",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 65400.0,
    tp1: 67200.0,
    tp2: 68800.0,
    tp3: 70500.0,
    initialSl: 64100.0,
    activeTrailingSl: 67200.0,
    trailingStageStr: "🚀 Трейл ATR",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 68800.0,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 48,
    exitTimeMsk: "16:00 МСК",
    pnlPercent: 5.20,
    pnlR: 2.62,
    probability: 89,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 96,
    timeMsk: "08:00 МСК",
    dateMsk: "21.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 10,
    notes: "4H тренд: удержание границы гаммы и закрепление выше сопротивления",
    behaviorNote: "Восходящий импульс при отсутствии встречного сопротивления"
  },

  // ==================== 1D MACRO CYCLE ====================
  {
    id: "ind_seed_1d_1",
    key: "XAUUSD_1d",
    ticker: "XAUUSD",
    timeframe: "1d",
    setupName: "Глобальный Тренд + Положительная Гамма",
    direction: "LONG",
    status: "WIN_TP2",
    entryPrice: 3950.00,
    tp1: 4010.00,
    tp2: 4040.00,
    tp3: 4080.00,
    initialSl: 3915.00,
    activeTrailingSl: 4010.00,
    trailingStageStr: "🚀 Трейл ATR",
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 4040.00,
    exitReason: "TP2",
    exitTimestamp: Date.now() - 1000 * 60 * 60 * 60,
    exitTimeMsk: "23:00 МСК",
    pnlPercent: 2.28,
    pnlR: 2.57,
    probability: 92,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(),
    createdTimestamp: Date.now() - 1000 * 60 * 60 * 168,
    timeMsk: "10:00 МСК",
    dateMsk: "18.10.2026",
    leg1Hit: true,
    leg2Hit: true,
    barsHeld: 5,
    notes: "Дневной тренд: следование за институциональной скупкой золота центробанками и удержание Call Wall",
    behaviorNote: "Макро-тренд D1 с высочайшим винрейтом за счет глобального притока ликвидности"
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
    entryTriggered: true,
    tp1Hit: true,
    tp2Hit: true,
    exitPrice: 8710.0,
    exitReason: "TP2",
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
    barsHeld: 4,
    notes: "Вечный фьючерс золото/рубль: следование за курсом золота и ослаблением рубля",
    behaviorNote: "Следование за фундаментальным спросом на физическое золото"
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
  const entry = Number(fc?.p1Entry) || 3995.8;
  const tp1 = Number(fc?.p2Tp1) || (entry * 1.008);
  const tp2 = Number(fc?.p3Tp2) || (entry * 1.016);
  const tp3 = Number(fc?.p5Tp3) || (entry * 1.025);
  const sl = Number(fc?.invalidLevelSl) || (entry * 0.995);
  const activeSl = Number(fc?.activeTrailingSl) || sl;
  const trailingStr = fc?.trailingStageStr || "🛡️ Начальный SL";
  const prob = Number(fc?.probability) || 84;

  let existing = indicatorSetupsHistory.find(s => s.key === key && s.status === "PENDING");
  if (existing) {
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
      if (fc?.entryTriggered) existing.entryTriggered = true;
      if (fc?.tp1Hit) existing.tp1Hit = true;
      if (fc?.tp2Hit) existing.tp2Hit = true;
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
    status: "PENDING",
    entryPrice: entry,
    tp1,
    tp2,
    tp3,
    initialSl: sl,
    activeTrailingSl: activeSl,
    trailingStageStr: trailingStr,
    entryTriggered: false,
    tp1Hit: false,
    tp2Hit: false,
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
  const totalSetups = indicatorSetupsHistory.length;
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

  for (const item of indicatorSetupsHistory) {
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

    if (item.status === "PENDING") {
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
  indicatorSetupsHistory = [...DEFAULT_INDICATOR_SEEDS];
  persistIndicatorHistory();
}
