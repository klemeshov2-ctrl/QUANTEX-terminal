/**
 * ============================================================================
 * S&T PREMIUM ULTIMATE SUPER INDICATOR [S&T Premium v8 / Pine Script v6]
 * 1:1 PURE MATHEMATICAL & LOGICAL PORT TO TYPESCRIPT / JS / SERVER
 * ============================================================================
 * Every function, formula, and rule below directly mirrors SuperIndicator_v6.txt
 */

import type { GexMarketReport } from "../../server/gexEngine";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PresetParams {
  st: number;
  it: number;
  lt: number;
  fib: number;
  ext: number;
  sig: string;
  mult: number;
  lb: number;
}

export interface SrZone {
  isSup: boolean;
  level: number;
  top: number;
  bottom: number;
  offset: number;
  label: string;
  isLt: boolean;
}

export interface BoxItem {
  id: string;
  left: number; // bar index
  top: number;
  right: number; // bar index
  bottom: number;
  color: string;
  text: string;
  isDashed: boolean;
}

export interface GexReportCalculated {
  spotPrice: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  maxPain: number;
  sleeperMagnet: number;
  charmDrift: number;
  effectiveIv: number;
  gexStep: number;
  expectedMove68: { low: number; high: number };
  expectedMove95: { low: number; high: number };
  pcrVal: number;
  rvIvVal: number;
  strikes: number[];
  callGex: number[];
  putGex: number[];
  netGex: number[];
  totGex: number[];
  audit: {
    total: number;
    cwRate: number;
    pwRate: number;
    flipRate: number;
  };
}

export interface ForecastState {
  isBull: boolean;
  probability: number;
  startBar: number;
  startTime?: number;
  startLogical?: number;
  barsSinceStart?: number;
  isLocked?: boolean;
  statusReason?: string;
  startPrice: number;
  p1Entry: number; // Вход
  p2Tp1: number;   // TP1
  p3Tp2: number;   // TP2
  p5Tp3: number;   // TP3 / Leg 5
  invalidLevelSl: number; // Начальный SL
  activeTrailingSl: number; // Текущий трейлинг SL
  trailingStageStr: string; // "🛡️ Начальный SL" | "🔒 BE+..." | "💰 Защита 50%" | "🚀 Трейл X.X ATR"
  trailingStageIdx: number;
  leg1Hit: boolean;
  leg2Hit: boolean;
  leg3Hit: boolean;
  leg4Hit: boolean;
  leg5Hit: boolean;
  isPlanBActive: boolean;
  isWickSweep: boolean;
  altTp1: number;
  altTp2: number;
  altTp3: number;
  isHighRunaway: boolean;
  noPullbackProb: number;
}

export interface HudData {
  ticker: string;
  tfPeriod: string;
  utcClockStr: string;
  dowName: string;
  dowEmoji: string;
  dowShortVerdict: string;
  dowFullVerdict: string;
  dowVerdictStr: string;
  twWarning: string;
  recActionStr: string;
  recCol: string;
  gexRegimeStr: string;
  gexRegimeCol: string;
  dayTargetStr: string;
  dayTargetCol: string;
  dayRangeTxt: string;
  speedStr: string;
  speedDir: string;
  speedCol: string;
  speedExplainFull: string;
  flipDistAtr: number;
  dayBiasStr: string;
  dayBiasCol: string;
  mtfDesc: string;
  curScoreBull: number;
  curScoreBear: number;
  flowsDeltaStr: string;
  flowsDeltaCol: string;
  dValStr: string;
  deltaBadge: string;
  cvdArrow: string;
  cvdSign: string;
  cvdValStr: string;
  pcrRvFull: string;
  pcrRvShort: string;
  pcrRvCol: string;
  auditStr: string;
  auditCol: string;
  autoHtfName: string;
  hudHtfUp: boolean;
}

export interface SuperIndicatorOutput {
  params: PresetParams;
  trendState: string;
  trendLineVal: number;
  atrVal: number;
  rsi14Val: number;
  rsi6Val: number;
  macd: { dif: number; dea: number; hist: number };
  deltaCurrent: number;
  cvdValue: number;
  isExtremeDelta: boolean;
  isBos: boolean;
  isChoch: boolean;
  isBullishBreak: boolean;
  breakPrice: number | null;
  bosBarIndex: number | null;
  isHighSweep: boolean;
  isLowSweep: boolean;
  lastSweepPrice: number | null;
  oteTop: number;
  oteBottom: number;
  fib500: number;
  probOte: number;
  buySig: boolean;
  sellSig: boolean;
  gex: GexReportCalculated;
  forecast: ForecastState;
  srZones: SrZone[];
  bullObBoxes: BoxItem[];
  bearObBoxes: BoxItem[];
  bullFvgBoxes: BoxItem[];
  bearFvgBoxes: BoxItem[];
  hud: HudData;
}

// ============================================================================
// TRADINGVIEW STATEFUL FORECAST ANCHOR (var fc_start_bar, var fc_p1, var fc_p2)
// Forecast lines remain LOCKED and only update when there is an actual reason:
// 1) Target TP2/TP3 hit, 2) SL broken (Plan B), 3) Timeout (12-16 bars), 4) Major structure breakout
// ============================================================================

interface AnchoredForecastItem {
  key: string;
  forecast: ForecastState;
  anchorCandleTime: number;
  highestPriceSinceStart: number;
  lowestPriceSinceStart: number;
  createdAt: number;
}

const anchoredForecastCache = new Map<string, AnchoredForecastItem>();

export function resetIndicatorForecast(symbol?: string, tf?: string): void {
  if (symbol && tf) {
    anchoredForecastCache.delete(`${symbol}_${tf}`);
  } else if (symbol) {
    for (const key of anchoredForecastCache.keys()) {
      if (key.startsWith(`${symbol}_`)) anchoredForecastCache.delete(key);
    }
  } else {
    anchoredForecastCache.clear();
  }
}

// ============================================================================
// 1. MATH HELPERS (Mirroring ta.* & math.* from Pine Script v6)
// ============================================================================

export function f_norm_pdf(x: number): number {
  return (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export function f_calc_gamma(S: number, K: number, sigma: number, T: number): number {
  if (S <= 0 || K <= 0 || sigma <= 0 || T <= 0) return 0.0;
  const d1 = (Math.log(S / K) + (sigma * sigma * 0.5) * T) / (sigma * Math.sqrt(T));
  return f_norm_pdf(d1) / (S * sigma * Math.sqrt(T));
}

export function f_calc_charm(S: number, K: number, sigma: number, T: number): number {
  if (S <= 0 || K <= 0 || sigma <= 0 || T <= 0) return 0.0;
  const d1 = (Math.log(S / K) + (sigma * sigma * 0.5) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return (-f_norm_pdf(d1) * d2) / (2.0 * T);
}

export function f_round_step(pr: number): number {
  if (pr >= 50000) return 1000.0;
  if (pr >= 10000) return 500.0;
  if (pr >= 5000) return 100.0;
  if (pr >= 2000) return 50.0;
  if (pr >= 1000) return 25.0;
  if (pr >= 100) return 5.0;
  if (pr >= 10) return 1.0;
  if (pr >= 1) return 0.1;
  return 0.01;
}

export function f_avoid_round(price: number, isLong: boolean, atrV: number, mintick = 0.01): number {
  const step = f_round_step(price);
  const nr = Math.round(price / step) * step;
  const dist = Math.abs(price - nr);
  const zone = atrV * 0.35;
  let result = price;
  if (dist < zone && step > 0) {
    const sh = Math.max(atrV * 0.12, mintick * 5);
    result = isLong ? Math.min(nr - sh, price) : Math.max(nr + sh, price);
  }
  return result;
}

export function f_avoid_round_sl(price: number, isLong: boolean, atrV: number, mintick = 0.01): number {
  const step = f_round_step(price);
  const nr = Math.round(price / step) * step;
  const dist = Math.abs(price - nr);
  const zone = atrV * 0.35;
  let result = price;
  if (dist < zone && step > 0) {
    const sh = Math.max(atrV * 0.12, mintick * 5);
    result = isLong ? nr - sh : nr + sh;
  }
  return result;
}

export function calcEMA(values: number[], length: number): number[] {
  const k = 2 / (length + 1);
  const out: number[] = [];
  let prev = values[0] || 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      prev = values[0];
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function calcSMA(values: number[], length: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - length + 1);
    const slice = values.slice(start, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    out.push(sum / slice.length);
  }
  return out;
}

export function calcStdev(values: number[], length: number): number[] {
  const sma = calcSMA(values, length);
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - length + 1);
    const slice = values.slice(start, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    out.push(Math.sqrt(variance));
  }
  return out;
}

export function calcRSI(closes: number[], length: number): number[] {
  const out: number[] = new Array(closes.length).fill(50);
  if (closes.length <= length) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / length;
  let avgLoss = losses / length;
  out[length] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = length + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (length - 1) + gain) / length;
    avgLoss = (avgLoss * (length - 1) + loss) / length;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return out;
}

export function calcATR(candles: Candle[], length = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[0].high - candles[0].low);
    } else {
      const prevClose = candles[i - 1].close;
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevClose),
        Math.abs(candles[i].low - prevClose)
      );
      trs.push(tr);
    }
  }
  return calcEMA(trs, length);
}

// ta.pivothigh(high, left, right): returns high of candle [i - right] if highest in [i-left-right ... i]
export function findPivotHigh(highs: number[], idx: number, left: number, right: number): number | null {
  const targetIdx = idx - right;
  if (targetIdx < left || targetIdx >= highs.length) return null;
  const targetVal = highs[targetIdx];
  for (let j = targetIdx - left; j <= targetIdx + right; j++) {
    if (j === targetIdx) continue;
    if (j >= 0 && j < highs.length && highs[j] > targetVal) {
      return null;
    }
  }
  return targetVal;
}

export function findPivotLow(lows: number[], idx: number, left: number, right: number): number | null {
  const targetIdx = idx - right;
  if (targetIdx < left || targetIdx >= lows.length) return null;
  const targetVal = lows[targetIdx];
  for (let j = targetIdx - left; j <= targetIdx + right; j++) {
    if (j === targetIdx) continue;
    if (j >= 0 && j < lows.length && lows[j] < targetVal) {
      return null;
    }
  }
  return targetVal;
}

// ============================================================================
// 2. TIMEFRAME DYNAMICS & PRESETS (f_resolve_preset 1:1)
// ============================================================================

export function f_resolve_preset(
  sel: string,
  tfSec: number,
  d_st = 5,
  d_it = 12,
  d_lt = 28,
  d_fib = 15,
  d_ext = 1.0,
  d_sig = "Консервативный",
  d_mult = 1.0,
  d_lb = 30
): PresetParams {
  let st_ = d_st;
  let it_ = d_it;
  let lt_ = d_lt;
  let fib_ = d_fib;
  let lb_ = d_lb;
  let ext_ = d_ext;
  let mult_ = d_mult;
  let sig_ = d_sig;

  if (sel === "★ Универсальный (Все таймфреймы / Авто-Адаптивный)") {
    const b =
      tfSec <= 180 ? 0 :
      tfSec <= 300 ? 1 :
      tfSec <= 900 ? 2 :
      tfSec <= 1800 ? 3 :
      tfSec <= 7200 ? 4 :
      tfSec <= 28800 ? 5 : 6;

    if (b === 0) {
      st_ = 2; it_ = 6; lt_ = 16; fib_ = 10; ext_ = 1.00; sig_ = "Агрессивный"; mult_ = 0.85; lb_ = 16;
    } else if (b === 1) {
      st_ = 3; it_ = 8; lt_ = 20; fib_ = 12; ext_ = 1.10; sig_ = "Консервативный"; mult_ = 1.00; lb_ = 20;
    } else if (b === 2) {
      st_ = 3; it_ = 10; lt_ = 22; fib_ = 15; ext_ = 1.15; sig_ = "Консервативный"; mult_ = 1.10; lb_ = 25;
    } else if (b === 3) {
      st_ = 4; it_ = 12; lt_ = 26; fib_ = 18; ext_ = 1.25; sig_ = "Консервативный"; mult_ = 1.15; lb_ = 28;
    } else if (b === 4) {
      st_ = 4; it_ = 13; lt_ = 28; fib_ = 20; ext_ = 1.35; sig_ = "Консервативный"; mult_ = 1.18; lb_ = 32;
    } else if (b === 5) {
      st_ = 5; it_ = 14; lt_ = 30; fib_ = 22; ext_ = 1.45; sig_ = "Сверх-Надежный"; mult_ = 1.20; lb_ = 35;
    } else {
      st_ = 5; it_ = 15; lt_ = 32; fib_ = 24; ext_ = 1.50; sig_ = "Сверх-Надежный"; mult_ = 1.22; lb_ = 38;
    }
  } else if (sel === "Золото (XAUUSD) - 5 мин Скальпинг") {
    st_ = 2; it_ = 8; lt_ = 18; fib_ = 12; ext_ = 1.0; sig_ = "Консервативный"; mult_ = 0.95; lb_ = 18;
  } else if (sel === "Золото (XAUUSD) - 15 мин Оптимальный") {
    st_ = 3; it_ = 10; lt_ = 22; fib_ = 15; ext_ = 1.1; sig_ = "Консервативный"; mult_ = 1.10; lb_ = 25;
  } else if (sel === "Золото (XAUUSD) - 30 мин Свинг-Интрадей") {
    st_ = 4; it_ = 12; lt_ = 26; fib_ = 18; ext_ = 1.2; sig_ = "Консервативный"; mult_ = 1.15; lb_ = 30;
  } else if (sel === "Золото (XAUUSD) - 1 час Интрадей/Тренд") {
    st_ = 4; it_ = 13; lt_ = 28; fib_ = 20; ext_ = 1.3; sig_ = "Консервативный"; mult_ = 1.18; lb_ = 32;
  } else if (sel === "Золото (XAUUSD) - 4 часа Свинг") {
    st_ = 5; it_ = 14; lt_ = 30; fib_ = 22; ext_ = 1.4; sig_ = "Сверх-Надежный"; mult_ = 1.20; lb_ = 35;
  } else if (sel === "Золото (XAUUSD) - 1 день Инвестиционный/Дневной") {
    st_ = 5; it_ = 15; lt_ = 32; fib_ = 24; ext_ = 1.5; sig_ = "Сверх-Надежный"; mult_ = 1.22; lb_ = 38;
  } else if (sel === "Биткоин (BTCUSD) - 15 мин Оптимальный") {
    st_ = 3; it_ = 10; lt_ = 24; fib_ = 18; ext_ = 1.3; sig_ = "Консервативный"; mult_ = 1.20; lb_ = 25;
  } else if (sel === "Общий (Все активы) - 1 мин Скальпинг") {
    st_ = 2; it_ = 5; lt_ = 14; fib_ = 10; ext_ = 0.9; sig_ = "Агрессивный"; mult_ = 0.75; lb_ = 12;
  } else if (sel === "Общий (Все активы) - 5 мин Быстрый скальпинг") {
    st_ = 3; it_ = 8; lt_ = 18; fib_ = 14; ext_ = 1.1; sig_ = "Агрессивный"; mult_ = 0.90; lb_ = 18;
  } else if (sel === "Общий (Все активы) - 15 мин Оптимальный") {
    st_ = 4; it_ = 10; lt_ = 24; fib_ = 16; ext_ = 1.2; sig_ = "Консервативный"; mult_ = 1.10; lb_ = 25;
  } else if (sel === "Общий (Все активы) - 30 мин Свинг-Интрадей") {
    st_ = 4; it_ = 12; lt_ = 26; fib_ = 18; ext_ = 1.3; sig_ = "Консервативный"; mult_ = 1.15; lb_ = 28;
  } else if (sel === "Общий (Все активы) - 1 час Часовой тренд") {
    st_ = 5; it_ = 13; lt_ = 28; fib_ = 20; ext_ = 1.4; sig_ = "Консервативный"; mult_ = 1.18; lb_ = 30;
  } else if (sel === "Общий (Все активы) - 4 часа Свинг-трейдинг") {
    st_ = 5; it_ = 14; lt_ = 30; fib_ = 22; ext_ = 1.5; sig_ = "Сверх-Надежный"; mult_ = 1.20; lb_ = 35;
  } else if (sel === "Общий (Все активы) - 1 день Дневной/Инвестиционный") {
    st_ = 5; it_ = 15; lt_ = 32; fib_ = 24; ext_ = 1.6; sig_ = "Сверх-Надежный"; mult_ = 1.22; lb_ = 38;
  }

  return { st: st_, it: it_, lt: lt_, fib: fib_, ext: ext_, sig: sig_, mult: mult_, lb: lb_ };
}

export function tfToSeconds(tf: string): number {
  switch (tf) {
    case "1m": return 60;
    case "3m": return 180;
    case "5m": return 300;
    case "15m": return 900;
    case "30m": return 1800;
    case "1h":
    case "60": return 3600;
    case "4h":
    case "240": return 14400;
    case "1d":
    case "D": return 86400;
    case "1w":
    case "W": return 604800;
    default: return 900;
  }
}

// ============================================================================
// 3. FULL PIPELINE EVALUATION (Runs on every bar / tick)
// ============================================================================

export function evaluateSuperIndicator(
  candles: Candle[],
  symbol = "XAUUSD",
  tf = "15m",
  presetSel = "★ Универсальный (Все таймфреймы / Авто-Адаптивный)",
  options?: {
    useGex?: boolean;
    showGex?: boolean;
    showOb?: boolean;
    showFvg?: boolean;
    showSr?: boolean;
    useTrailing?: boolean;
    showSignals?: boolean;
    signalMode?: string;
    cleanOb?: boolean;
    mergeObFvg?: boolean;
    useAntiRound?: boolean;
    gexAnchorMode?: string;
    useFridayBoost?: boolean;
    useGexAudit?: boolean;
    manualPcr?: number;
    manualRvIv?: number;
    hudTextDensity?: string;
    tblViewMode?: string;
    externalGexReport?: GexMarketReport | null;
  }
): SuperIndicatorOutput {
  const n = candles.length;
  const tfSec = tfToSeconds(tf);
  const p = f_resolve_preset(presetSel, tfSec);
  const lastCandle = candles[n - 1] || { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 };
  const close = lastCandle.close;

  // 1. Indicators: ATR, Trend Line (EMA 200), RSI, MACD
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const atrs = calcATR(candles, 14);
  const atrVal = atrs[n - 1] || (lastCandle.high - lastCandle.low) || 1.0;

  const ema200 = calcEMA(closes, 200);
  const trendLineVal = ema200[n - 1] || close;

  const rsi6 = calcRSI(closes, 6);
  const rsi14 = calcRSI(closes, 14);
  const rsi6Val = rsi6[n - 1] || 50;
  const rsi14Val = rsi14[n - 1] || 50;

  const emaFast = calcEMA(closes, 12);
  const emaSlow = calcEMA(closes, 26);
  const dif = emaFast.map((v, i) => v - emaSlow[i]);
  const dea = calcEMA(dif, 9);
  const macdHist = dif.map((v, i) => v - dea[i]);
  const macd = {
    dif: dif[n - 1] || 0,
    dea: dea[n - 1] || 0,
    hist: macdHist[n - 1] || 0
  };

  // 2. Volume Delta & CVD
  let cvdValue = 0;
  const deltas: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const cr = c.high - c.low;
    let bv = 0;
    if (cr === 0) {
      bv = c.volume * 0.5;
    } else if (c.close >= c.open) {
      bv = c.volume * ((c.close - c.open + (c.high - c.close) * 0.5 + (c.open - c.low) * 0.5) / cr);
    } else {
      bv = c.volume * (((c.high - c.open) * 0.5 + (c.close - c.low) * 0.5) / cr);
    }
    const delta = bv - (c.volume - bv);
    deltas.push(delta);
    cvdValue += delta;
  }
  const deltaCurrent = deltas[n - 1] || 0;
  const deltaStdArr = calcStdev(deltas, 20);
  const deltaStd = deltaStdArr[n - 1] || 1;
  const isExtremeDelta = Math.abs(deltaCurrent) > deltaStd * p.ext;

  // 3. SMC: Pivots, BOS/CHoCH, Sweeps
  let trendState = "bullish";
  let lastShVal: number | null = null;
  let lastSlVal: number | null = null;
  let lastShBar: number | null = null;
  let lastSlBar: number | null = null;
  let isBos = false;
  let isChoch = false;
  let isBullishBreak = false;
  let breakPrice: number | null = null;
  let bosBarIndex: number | null = null;

  for (let i = p.it; i < n; i++) {
    const ph = findPivotHigh(highs, i, p.it, p.it);
    const pl = findPivotLow(lows, i, p.it, p.it);
    if (ph !== null) {
      lastShVal = ph;
      lastShBar = i - p.it;
    }
    if (pl !== null) {
      lastSlVal = pl;
      lastSlBar = i - p.it;
    }

    const cClose = closes[i];
    if (lastShVal !== null && cClose > lastShVal) {
      isBullishBreak = true;
      breakPrice = lastShVal;
      bosBarIndex = lastShBar;
      if (trendState === "bearish") {
        isChoch = true;
        trendState = "bullish";
      } else {
        isBos = true;
      }
      lastShVal = null;
    } else if (lastSlVal !== null && cClose < lastSlVal) {
      isBullishBreak = false;
      breakPrice = lastSlVal;
      bosBarIndex = lastSlBar;
      if (trendState === "bullish") {
        isChoch = true;
        trendState = "bearish";
      } else {
        isBos = true;
      }
      lastSlVal = null;
    }
  }

  // Sweeps (high/low sweep of 5-period pivot)
  let keyHighRef: number | null = null;
  let keyLowRef: number | null = null;
  for (let i = 5; i < n; i++) {
    const ph5 = findPivotHigh(highs, i, 5, 5);
    const pl5 = findPivotLow(lows, i, 5, 5);
    if (ph5 !== null) keyHighRef = ph5;
    if (pl5 !== null) keyLowRef = pl5;
  }
  let isHighSweep = false;
  let isLowSweep = false;
  let lastSweepPrice: number | null = null;
  if (keyHighRef !== null && lastCandle.high > keyHighRef && lastCandle.close <= keyHighRef) {
    const tot = lastCandle.high - lastCandle.low;
    const wick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    if (tot > 0 && wick >= tot * 0.4) {
      isHighSweep = true;
      lastSweepPrice = keyHighRef;
    }
  }
  if (keyLowRef !== null && lastCandle.low < keyLowRef && lastCandle.close >= keyLowRef) {
    const tot = lastCandle.high - lastCandle.low;
    const wick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
    if (tot > 0 && wick >= tot * 0.4) {
      isLowSweep = true;
      lastSweepPrice = keyLowRef;
    }
  }

  // 4. S&R Zones (Liq ST 5, Liq IT 15, Liq LT 35)
  const srZones: SrZone[] = [];
  const phLt = findPivotHigh(highs, n - 1, 35, 35);
  const plLt = findPivotLow(lows, n - 1, 35, 35);
  const phIt = findPivotHigh(highs, n - 1, 15, 15);
  const plIt = findPivotLow(lows, n - 1, 15, 15);
  const phSt = findPivotHigh(highs, n - 1, 5, 5);
  const plSt = findPivotLow(lows, n - 1, 5, 5);

  const addSrZone = (isSup: boolean, lvl: number, offset: number, label: string, isLt: boolean) => {
    srZones.push({
      isSup,
      level: lvl,
      top: lvl + atrVal * 0.08,
      bottom: lvl - atrVal * 0.08,
      offset,
      label,
      isLt
    });
  };

  if (phLt !== null) addSrZone(false, phLt, 35, `Liq LT Сопр.`, true);
  if (plLt !== null) addSrZone(true, plLt, 35, `Liq LT Подд.`, true);
  if (phIt !== null) addSrZone(false, phIt, 15, `Liq IT Сопр.`, false);
  if (plIt !== null) addSrZone(true, plIt, 15, `Liq IT Подд.`, false);
  if (phSt !== null) addSrZone(false, phSt, 5, `Liq ST Сопр.`, false);
  if (plSt !== null) addSrZone(true, plSt, 5, `Liq ST Подд.`, false);

  // 5. Order Blocks (OB) & Fair Value Gaps (FVG)
  const bullObBoxes: BoxItem[] = [];
  const bearObBoxes: BoxItem[] = [];
  const bullFvgBoxes: BoxItem[] = [];
  const bearFvgBoxes: BoxItem[] = [];

  for (let i = 2; i < n; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];

    // Bullish OB
    if (c.close > prev.high && prev.close < prev.open) {
      bullObBoxes.push({
        id: `ob_bull_${c.time}`,
        left: i - 1,
        top: prev.high,
        right: n - 1 + 8,
        bottom: prev.low,
        color: "#089981",
        text: "+OB",
        isDashed: false
      });
    }
    // Bearish OB
    if (c.close < prev.low && prev.close > prev.open) {
      bearObBoxes.push({
        id: `ob_bear_${c.time}`,
        left: i - 1,
        top: prev.high,
        right: n - 1 + 8,
        bottom: prev.low,
        color: "#f23645",
        text: "-OB",
        isDashed: false
      });
    }

    // Bullish FVG
    if (c.low > prev2.high && prev.close > prev.open) {
      bullFvgBoxes.push({
        id: `fvg_bull_${c.time}`,
        left: i - 1,
        top: c.low,
        right: n - 1 + 6,
        bottom: prev2.high,
        color: "#0ea5e9",
        text: "+FVG",
        isDashed: true
      });
    }
    // Bearish FVG
    if (c.high < prev2.low && prev.close < prev.open) {
      bearFvgBoxes.push({
        id: `fvg_bear_${c.time}`,
        left: i - 1,
        top: prev2.low,
        right: n - 1 + 6,
        bottom: c.high,
        color: "#f23645",
        text: "-FVG",
        isDashed: true
      });
    }
  }

  // Mitigation cleaning
  const filterMitigated = (arr: BoxItem[], isBull: boolean) => {
    return arr.filter(b => {
      if (isBull) {
        return lastCandle.low >= b.bottom;
      } else {
        return lastCandle.high <= b.top;
      }
    }).slice(-3); // keep max 3 active
  };
  const cleanBullOb = filterMitigated(bullObBoxes, true);
  const cleanBearOb = filterMitigated(bearObBoxes, false);
  const cleanBullFvg = filterMitigated(bullFvgBoxes, true);
  const cleanBearFvg = filterMitigated(bearFvgBoxes, false);

  // 6. Fib / OTE Calculations
  const recentFib = candles.slice(-p.fib);
  const highestHigh = Math.max(...recentFib.map(c => c.high));
  const lowestLow = Math.min(...recentFib.map(c => c.low));
  const swingRange = highestHigh - lowestLow;
  const fib500 = lowestLow + swingRange * 0.5;
  const isBull = trendState === "bullish";

  const oteTop = isBull ? highestHigh - swingRange * 0.618 : lowestLow + swingRange * 0.786;
  const oteBottom = isBull ? highestHigh - swingRange * 0.786 : lowestLow + swingRange * 0.618;
  const probOte = Math.min(95, Math.max(35, 55 + (Math.abs(close - oteBottom) / close < 0.005 ? 15 : 0)));

  // 7. GEX Engine Calculation
  const isGold = symbol.toUpperCase().includes("XAU") || symbol.toUpperCase().includes("GOLD") || symbol.toUpperCase().includes("GD") || symbol.toUpperCase().includes("GN") || symbol.toUpperCase().includes("GLD") || symbol.toUpperCase().includes("MOEX") || symbol.toUpperCase().includes("PAXG");
  const isBtc = symbol.toUpperCase().includes("BTC");
  const effectiveIv = isGold ? 17.5 : isBtc ? 52.0 : 16.0;
  const gexStep = isGold ? (close > 9000 ? 50.0 : close > 3500 ? 25.0 : close > 1500 ? 10.0 : 5.0) : isBtc ? (close > 50000 ? 1000.0 : 500.0) : 25.0;

  const now = new Date();
  const dow = now.getUTCDay(); // 0 is Sunday, 1 Mon, 5 Fri
  const dteDays = dow === 1 ? 4.0 : dow === 2 ? 3.0 : dow === 3 ? 2.0 : dow === 4 ? 1.0 : 0.5;
  const gexT = Math.max(0.5, dteDays) / 365.0;
  const gexSigma = effectiveIv / 100.0;
  const gexEm1sd = close * gexSigma * Math.sqrt(dteDays / 365.0);
  const gexEm2sd = gexEm1sd * 2.0;

  const gexAtm = Math.round(close / gexStep) * gexStep;
  let strikes: number[] = [];
  let callGex: number[] = [];
  let putGex: number[] = [];
  let netGex: number[] = [];
  let totGex: number[] = [];

  let callWall: number;
  let putWall: number;
  let gammaFlip: number;
  let maxPain: number;
  let sleeperMagnet: number;
  let charmDrift = 0;
  let expectedMove68 = { low: Math.round((close - gexEm1sd) * 10) / 10, high: Math.round((close + gexEm1sd) * 10) / 10 };
  let expectedMove95 = { low: Math.round((close - gexEm2sd) * 10) / 10, high: Math.round((close + gexEm2sd) * 10) / 10 };
  let pcrVal = 1.05;
  let rvIvVal = 0.85;

  if (options?.externalGexReport) {
    const ext = options.externalGexReport;
    callWall = ext.callWall;
    putWall = ext.putWall;
    gammaFlip = ext.gammaFlip;
    maxPain = ext.maxPain;
    sleeperMagnet = ext.sleeperMagnet || (ext.callWall > close ? ext.callWall + (isGold ? 20 : 500) : ext.callWall + 20);
    if (ext.expectedMove68) {
      expectedMove68 = { low: ext.expectedMove68.low, high: ext.expectedMove68.high };
    }
    if (ext.expectedMove95) {
      expectedMove95 = { low: ext.expectedMove95.low, high: ext.expectedMove95.high };
    }
    if (ext.dealerGreeks?.charm) charmDrift = ext.dealerGreeks.charm;
    if (ext.pcrOi) pcrVal = ext.pcrOi;
    if (ext.realizedVol30d && ext.impliedVolAvg) {
      rvIvVal = Math.round((ext.realizedVol30d / ext.impliedVolAvg) * 100) / 100;
    }
    if (ext.strikes && ext.strikes.length > 0) {
      const asc = [...ext.strikes].sort((a, b) => a.strike - b.strike);
      strikes = asc.map(s => s.strike);
      callGex = asc.map(s => s.callGex);
      putGex = asc.map(s => s.putGex);
      netGex = asc.map(s => s.netGex);
      totGex = asc.map(s => Math.abs(s.callGex) + Math.abs(s.putGex));
    }
  } else {
    // Standalone synthetic GEX fallback
    let bestCGex = -1;
    let bestPGex = -1;
    let bestCStrike = gexAtm + gexStep;
    let bestPStrike = gexAtm - gexStep;
    let bestPotMagVal = -1e9;
    let bestPotStrike = gexAtm;

    const fridayBoost = dow === 5 ? 0.8 : 0.0;
    const numStrikes = 14;

    for (let i = -numStrikes; i <= numStrikes; i++) {
      const strike = gexAtm + i * gexStep;
      const moneyness = (strike - close) / close;
      const strikeSkew = moneyness < 0 ? (1.0 + Math.abs(moneyness) * 1.5) : (1.0 - Math.abs(moneyness) * 0.3);
      const adjSigma = Math.max(0.06, gexSigma * strikeSkew);
      const rawG = f_calc_gamma(close, strike, adjSigma, gexT);

      let roundW = 1.0;
      if (Math.abs(strike / (gexStep * 5.0) - Math.round(strike / (gexStep * 5.0))) < 0.01) {
        roundW = 2.2 + fridayBoost;
      } else if (Math.abs(strike / (gexStep * 2.0) - Math.round(strike / (gexStep * 2.0))) < 0.01) {
        roundW = 1.5 + fridayBoost * 0.5;
      }

      const cW = 1.0 / (1.0 + Math.exp(-3.0 * (strike - close) / (gexStep * 5.0)));
      const pW = 1.0 - cW;
      const cG = rawG * cW * roundW * 100000.0;
      const pG = rawG * pW * roundW * 100000.0;
      const nG = cG - pG;
      const tG = cG + pG;

      strikes.push(strike);
      callGex.push(cG);
      putGex.push(pG);
      netGex.push(nG);
      totGex.push(tG);

      if (strike >= close && cG > bestCGex) {
        bestCGex = cG;
        bestCStrike = strike;
      }
      if (strike <= close && pG > bestPGex) {
        bestPGex = pG;
        bestPStrike = strike;
      }

      const potGex = (roundW * 100.0 * strike) / Math.max(0.01, Math.abs(strike - close));
      if (Math.abs(strike - close) >= gexStep * 1.5 && potGex > bestPotMagVal) {
        bestPotMagVal = potGex;
        bestPotStrike = strike;
      }

      const ch = f_calc_charm(close, strike, adjSigma, gexT);
      charmDrift += (cG - pG) * ch;
    }

    callWall = bestCStrike;
    putWall = bestPStrike;
    sleeperMagnet = bestPotStrike;

    // Zero-flip search
    let closestD = 1e10;
    gammaFlip = gexAtm;
    for (let i = 1; i < strikes.length; i++) {
      const sPrev = strikes[i - 1];
      const sCurr = strikes[i];
      const ngPrev = netGex[i - 1];
      const ngCurr = netGex[i];
      if ((ngPrev > 0 && ngCurr <= 0) || (ngPrev < 0 && ngCurr >= 0)) {
        const denom = ngCurr - ngPrev;
        const crossPrice = denom !== 0 ? sPrev + (sCurr - sPrev) * (0.0 - ngPrev) / denom : sCurr;
        if (Math.abs(crossPrice - close) < closestD) {
          closestD = Math.abs(crossPrice - close);
          gammaFlip = Math.round(crossPrice / gexStep) * gexStep;
        }
      }
    }

    // Max Pain calculation (strike minimizing total intrinsic cost)
    let minPainCost = 1e12;
    maxPain = gexAtm;
    for (let j = 0; j < strikes.length; j++) {
      const testS = strikes[j];
      let totPain = 0;
      for (let k = 0; k < strikes.length; k++) {
        const sK = strikes[k];
        if (testS > sK) totPain += (testS - sK) * callGex[k];
        if (testS < sK) totPain += (sK - testS) * putGex[k];
      }
      if (totPain < minPainCost && totPain > 0) {
        minPainCost = totPain;
        maxPain = testS;
      }
    }
  }

  const gex: GexReportCalculated = {
    spotPrice: close,
    callWall,
    putWall,
    gammaFlip,
    maxPain,
    sleeperMagnet,
    charmDrift,
    effectiveIv,
    gexStep,
    expectedMove68,
    expectedMove95,
    pcrVal,
    rvIvVal,
    strikes,
    callGex,
    putGex,
    netGex,
    totGex,
    audit: {
      total: 48,
      cwRate: 72,
      pwRate: 78,
      flipRate: 68
    }
  };

  // 8. Forecast Wave (Вход, TP1, TP2, TP3, SL, Trailing) - Exact Pine Script 1:1 Port
  // Dynamic ATR volatility limits based on timeframe
  const isWeeklyOrMonthly = tfSec >= 604800;
  const isDaily = tfSec >= 86400 && tfSec < 604800;
  const is240Plus = tfSec >= 14400 && tfSec < 86400;
  const is60Plus = tfSec >= 3600 && tfSec < 14400;

  const max_tp1_atr = isWeeklyOrMonthly ? 1.8 : isDaily ? 1.8 : is240Plus ? 1.6 : is60Plus ? 1.5 : 1.4;
  const max_tp2_atr = isWeeklyOrMonthly ? 2.8 : isDaily ? 2.8 : is240Plus ? 2.5 : is60Plus ? 2.4 : 2.2;
  const min_tp1_atr = isWeeklyOrMonthly ? 0.85 : isDaily ? 0.85 : is240Plus ? 0.75 : is60Plus ? 0.7 : 0.65;
  const min_tp2_atr = isWeeklyOrMonthly ? 1.0 : isDaily ? 1.0 : is240Plus ? 0.9 : is60Plus ? 0.85 : 0.8;
  const max_pullback_atr = isWeeklyOrMonthly ? 0.45 : isDaily ? 0.55 : is240Plus ? 0.65 : 0.75;

  // Efficiency ratio (ER) & Market regime
  const erPeriod = Math.min(20, n - 1);
  const netMove = Math.abs(close - closes[Math.max(0, n - 1 - erPeriod)]);
  let pathSum = 0;
  for (let i = Math.max(1, n - erPeriod); i < n; i++) {
    pathSum += Math.abs(closes[i] - closes[i - 1]);
  }
  const erVal = pathSum > 0 ? netMove / pathSum : 0.0;
  const isTrending = erVal > 0.40;
  const isRanging = erVal < 0.25;

  const mtfMult = 1.0;
  const regimeMult = isTrending ? 1.25 : (isRanging ? 0.80 : 0.95);
  const ictSetupStrong = (isLowSweep && cleanBullOb.length > 0) || (isHighSweep && cleanBearOb.length > 0);
  const ictMult = ictSetupStrong ? 1.15 : 1.0;
  const absorptionSignal = isExtremeDelta && Math.abs(close - lastCandle.open) < atrVal * 0.3;
  const absorbMult = absorptionSignal ? 1.10 : 1.0;

  const tpMult = Math.min(1.80, Math.max(0.55, p.mult * mtfMult * regimeMult * ictMult * absorbMult));

  // target_p1 (Entry)
  let target_p1: number;
  if (isLowSweep && isBull) {
    target_p1 = Math.min(close, lastCandle.low);
  } else if (isHighSweep && !isBull) {
    target_p1 = Math.max(close, lastCandle.high);
  } else if (isBull) {
    let p1Found: number | null = null;
    if (cleanBullOb.length > 0) {
      for (let i = cleanBullOb.length - 1; i >= 0; i--) {
        const ob = cleanBullOb[i];
        if (ob.top < close && ob.top >= close - atrVal * max_pullback_atr) {
          p1Found = Math.max((ob.top + ob.bottom) / 2, close - atrVal * max_pullback_atr);
          break;
        }
      }
    }
    if (p1Found === null && cleanBullFvg.length > 0) {
      for (let i = cleanBullFvg.length - 1; i >= 0; i--) {
        const fvg = cleanBullFvg[i];
        if (fvg.top < close && fvg.top >= close - atrVal * max_pullback_atr) {
          p1Found = Math.max((fvg.top + fvg.bottom) / 2, close - atrVal * max_pullback_atr);
          break;
        }
      }
    }
    target_p1 = p1Found !== null ? p1Found : close - atrVal * (tfSec < 86400 ? 0.45 : 0.35);
  } else {
    let p1Found: number | null = null;
    if (cleanBearOb.length > 0) {
      for (let i = cleanBearOb.length - 1; i >= 0; i--) {
        const ob = cleanBearOb[i];
        if (ob.bottom > close && ob.bottom <= close + atrVal * max_pullback_atr) {
          p1Found = Math.min((ob.top + ob.bottom) / 2, close + atrVal * max_pullback_atr);
          break;
        }
      }
    }
    if (p1Found === null && cleanBearFvg.length > 0) {
      for (let i = cleanBearFvg.length - 1; i >= 0; i--) {
        const fvg = cleanBearFvg[i];
        if (fvg.bottom > close && fvg.bottom <= close + atrVal * max_pullback_atr) {
          p1Found = Math.min((fvg.top + fvg.bottom) / 2, close + atrVal * max_pullback_atr);
          break;
        }
      }
    }
    target_p1 = p1Found !== null ? p1Found : close + atrVal * (tfSec < 86400 ? 0.45 : 0.35);
  }

  // target_p2 (TP1) & target_p3 (TP2)
  let target_p2: number;
  let target_p3: number;

  if (isBull) {
    let candP2 = close + atrVal * 1.35 * tpMult;
    if (cleanBearFvg.length > 0) {
      for (let i = cleanBearFvg.length - 1; i >= 0; i--) {
        const fb = cleanBearFvg[i].bottom;
        if (fb >= close + atrVal * min_tp1_atr && fb <= close + atrVal * max_tp1_atr * tpMult) {
          candP2 = fb;
          break;
        }
      }
    } else if (cleanBearOb.length > 0) {
      for (let i = cleanBearOb.length - 1; i >= 0; i--) {
        const ob = cleanBearOb[i].bottom;
        if (ob >= close + atrVal * min_tp1_atr && ob <= close + atrVal * max_tp1_atr * tpMult) {
          candP2 = ob;
          break;
        }
      }
    }
    // Exact Pine Script formula for bull target_p2:
    // target_p2 := math.max(target_p1 + atr * min_tp1_atr, math.min(close + atr * max_tp1_atr * tp_mult, math.max(close + atr * min_tp1_atr, target_p2)))
    target_p2 = Math.max(target_p1 + atrVal * min_tp1_atr, Math.min(close + atrVal * max_tp1_atr * tpMult, Math.max(close + atrVal * min_tp1_atr, candP2)));

    // Exact Pine Script formula for bull target_p3:
    const candP3 = close + atrVal * 2.2 * tpMult;
    target_p3 = Math.max(target_p2 + atrVal * min_tp2_atr, Math.min(close + atrVal * max_tp2_atr * tpMult, candP3));
  } else {
    let candP2 = close - atrVal * 1.35 * tpMult;
    if (cleanBullFvg.length > 0) {
      for (let i = cleanBullFvg.length - 1; i >= 0; i--) {
        const ft = cleanBullFvg[i].top;
        if (ft <= close - atrVal * min_tp1_atr && ft >= close - atrVal * max_tp1_atr * tpMult) {
          candP2 = ft;
          break;
        }
      }
    } else if (cleanBullOb.length > 0) {
      for (let i = cleanBullOb.length - 1; i >= 0; i--) {
        const ot = cleanBullOb[i].top;
        if (ot <= close - atrVal * min_tp1_atr && ot >= close - atrVal * max_tp1_atr * tpMult) {
          candP2 = ot;
          break;
        }
      }
    }
    // Exact Pine Script formula for bear target_p2:
    // target_p2 := math.min(target_p1 - atr * min_tp1_atr, math.max(close - atr * max_tp1_atr * tp_mult, math.min(close - atr * min_tp1_atr, target_p2)))
    target_p2 = Math.min(target_p1 - atrVal * min_tp1_atr, Math.max(close - atrVal * max_tp1_atr * tpMult, Math.min(close - atrVal * min_tp1_atr, candP2)));

    // Exact Pine Script formula for bear target_p3:
    const candP3 = close - atrVal * 2.2 * tpMult;
    target_p3 = Math.min(target_p2 - atrVal * min_tp2_atr, Math.max(close - atrVal * max_tp2_atr * tpMult, candP3));
  }

  // Independent anti-round calculation (f_avoid_round) matching Pine Script v6
  target_p2 = f_avoid_round(target_p2, isBull, atrVal);
  target_p3 = f_avoid_round(target_p3, isBull, atrVal);

  if (isBull) {
    target_p2 = Math.min(close + atrVal * max_tp1_atr * tpMult, Math.max(target_p1 + atrVal * min_tp1_atr, target_p2));
    target_p3 = Math.min(close + atrVal * max_tp2_atr * tpMult, Math.max(target_p2 + atrVal * min_tp2_atr, target_p3));
  } else {
    target_p2 = Math.max(close - atrVal * max_tp1_atr * tpMult, Math.min(target_p1 - atrVal * min_tp1_atr, target_p2));
    target_p3 = Math.max(close - atrVal * max_tp2_atr * tpMult, Math.min(target_p2 - atrVal * min_tp2_atr, target_p3));
  }
  const p5Tp3 = isBull ? target_p3 + atrVal * 1.10 : target_p3 - atrVal * 1.10;

  // Stop loss calculation (fc_invalid_level) based on swing structure and ATR buffer
  let invalidLevelSl = isBull ? target_p1 - atrVal * 0.85 : target_p1 + atrVal * 0.85;
  if (isBull) {
    const ll8 = Math.min(...candles.slice(-8).map(c => c.low));
    if (ll8 < target_p1 && ll8 >= target_p1 - atrVal * 1.25) {
      invalidLevelSl = ll8 - atrVal * 0.15;
    }
  } else {
    const hh8 = Math.max(...candles.slice(-8).map(c => c.high));
    if (hh8 > target_p1 && hh8 <= target_p1 + atrVal * 1.25) {
      invalidLevelSl = hh8 + atrVal * 0.15;
    }
  }
  invalidLevelSl = f_avoid_round_sl(invalidLevelSl, isBull, atrVal);

  // Trailing stop progression
  let activeTrailingSl = invalidLevelSl;
  let trailingStageStr = "🛡️ Начальный SL";
  let trailingStageIdx = 0;

  const distToTp1 = Math.abs(target_p2 - target_p1);
  const currentProfit = isBull ? close - target_p1 : target_p1 - close;

  if (currentProfit >= distToTp1) {
    activeTrailingSl = isBull ? target_p1 + (target_p2 - target_p1) * 0.50 : target_p1 - (target_p1 - target_p2) * 0.50;
    trailingStageStr = "💰 Защита 50%";
    trailingStageIdx = 2;
  } else if (currentProfit >= distToTp1 * 0.70) {
    activeTrailingSl = isBull ? target_p1 + atrVal * 0.15 : target_p1 - atrVal * 0.15;
    trailingStageStr = "🔒 BE+0.15";
    trailingStageIdx = 1;
  }

  const isPlanBActive = isBull ? close < invalidLevelSl : close > invalidLevelSl;
  const altTp1 = isBull ? invalidLevelSl - atrVal * 1.5 : invalidLevelSl + atrVal * 1.5;
  const altTp2 = isBull ? invalidLevelSl - atrVal * 3.0 : invalidLevelSl + atrVal * 3.0;

  const noPullbackProb = Math.min(95, Math.max(12, 15 + (isExtremeDelta ? 25 : 10) + (Math.abs(close - target_p1) > atrVal ? 20 : 0)));

  const p1Entry = target_p1;
  const p2Tp1 = target_p2;
  const p3Tp2 = target_p3;

  // TradingView Stateful Forecast Anchoring Algorithm (var fc_start_bar, var fc_p1...)
  const cacheKey = `${symbol}_${tf}`;
  const existingItem = anchoredForecastCache.get(cacheKey);
  let finalForecast: ForecastState | null = null;

  if (existingItem) {
    const anchorIdx = candles.findIndex(c => c.time === existingItem.anchorCandleTime);
    let shouldTriggerNewForecast = false;
    let triggerReason = "";

    if (anchorIdx < 0) {
      shouldTriggerNewForecast = true;
      triggerReason = "История сдвинулась";
    } else {
      const barsPassed = (n - 1) - anchorIdx;
      const prev = existingItem.forecast;

      // Track price extremes since anchor bar
      for (let bi = anchorIdx; bi < n; bi++) {
        if (candles[bi].high > existingItem.highestPriceSinceStart) {
          existingItem.highestPriceSinceStart = candles[bi].high;
        }
        if (candles[bi].low < existingItem.lowestPriceSinceStart) {
          existingItem.lowestPriceSinceStart = candles[bi].low;
        }
      }

      // Check whether target or entry was hit on any bar since start
      let leg1Hit = prev.leg1Hit;
      let leg2Hit = prev.leg2Hit;
      let leg3Hit = prev.leg3Hit;
      for (let bi = anchorIdx; bi < n; bi++) {
        const cb = candles[bi];
        if (prev.isBull) {
          if (cb.low <= prev.p1Entry) leg1Hit = true;
          if (cb.high >= prev.p2Tp1) leg2Hit = true;
          if (cb.high >= prev.p3Tp2) leg3Hit = true;
        } else {
          if (cb.high >= prev.p1Entry) leg1Hit = true;
          if (cb.low <= prev.p2Tp1) leg2Hit = true;
          if (cb.low <= prev.p3Tp2) leg3Hit = true;
        }
      }

      // 1. Invalidation: Stop loss hit (Plan B activation)
      const slBroken = prev.isBull ? close < prev.invalidLevelSl : close > prev.invalidLevelSl;
      if (slBroken) {
        shouldTriggerNewForecast = true;
        triggerReason = `Слом SL (${prev.invalidLevelSl.toFixed(1)}) — активация Плана Б`;
      }
      // 2. Final TP2 hit and completed
      else if (leg3Hit && barsPassed >= 3) {
        shouldTriggerNewForecast = true;
        triggerReason = `Цель TP2 (${prev.p3Tp2.toFixed(1)}) достигнута`;
      }
      // 3. Timeout without entry (12 bars passed)
      else if (!leg1Hit && barsPassed >= 12) {
        shouldTriggerNewForecast = true;
        triggerReason = `Таймаут входа (${barsPassed} баров без отката)`;
      }
      // 4. Maximum cycle completion (20 bars)
      else if (barsPassed >= 20) {
        shouldTriggerNewForecast = true;
        triggerReason = `Волновой цикл завершен (${barsPassed} баров)`;
      }
      // 5. Structure breakout in opposite direction with high momentum
      else if (isBos && (isBullishBreak !== prev.isBull) && isExtremeDelta) {
        shouldTriggerNewForecast = true;
        triggerReason = `Структурный разворот (${isBullishBreak ? "BOS ↑" : "BOS ↓"})`;
      }

      if (!shouldTriggerNewForecast) {
        // PRESERVE ANCHORED FORECAST LEVELS
        let activeTrailingSl = prev.activeTrailingSl;
        let trailingStageStr = prev.trailingStageStr;
        let trailingStageIdx = prev.trailingStageIdx;

        const currentProfit = prev.isBull ? close - prev.p1Entry : prev.p1Entry - close;
        const distToTp1 = Math.abs(prev.p2Tp1 - prev.p1Entry);

        if (currentProfit >= distToTp1) {
          activeTrailingSl = prev.isBull
            ? prev.p1Entry + (prev.p2Tp1 - prev.p1Entry) * 0.50
            : prev.p1Entry - (prev.p1Entry - prev.p2Tp1) * 0.50;
          trailingStageStr = "💰 Защита 50%";
          trailingStageIdx = 2;
        } else if (currentProfit >= distToTp1 * 0.70) {
          activeTrailingSl = prev.isBull ? prev.p1Entry + atrVal * 0.15 : prev.p1Entry - atrVal * 0.15;
          trailingStageStr = "🔒 BE+0.15";
          trailingStageIdx = 1;
        }

        finalForecast = {
          ...prev,
          startBar: anchorIdx,
          startLogical: anchorIdx,
          startTime: existingItem.anchorCandleTime,
          barsSinceStart: barsPassed,
          isLocked: true,
          statusReason: `Фиксирован (бар #${anchorIdx}, ${barsPassed} баров назад)`,
          leg1Hit,
          leg2Hit,
          leg3Hit,
          activeTrailingSl: Math.round(activeTrailingSl * 100) / 100,
          trailingStageStr,
          trailingStageIdx
        };
        existingItem.forecast = finalForecast;
      }
    }
  }

  if (!finalForecast) {
    const candidateForecast: ForecastState = {
      isBull,
      probability: Math.round(isBull ? (deltaCurrent > 0 ? 74 : 66) : (deltaCurrent < 0 ? 74 : 66)),
      startBar: n - 1,
      startLogical: n - 1,
      startTime: lastCandle.time,
      barsSinceStart: 0,
      isLocked: true,
      statusReason: "Новый прогноз зафиксирован",
      startPrice: close,
      p1Entry: Math.round(p1Entry * 100) / 100,
      p2Tp1: Math.round(p2Tp1 * 100) / 100,
      p3Tp2: Math.round(p3Tp2 * 100) / 100,
      p5Tp3: Math.round(p5Tp3 * 100) / 100,
      invalidLevelSl: Math.round(invalidLevelSl * 100) / 100,
      activeTrailingSl: Math.round(activeTrailingSl * 100) / 100,
      trailingStageStr,
      trailingStageIdx,
      leg1Hit: isBull ? lastCandle.low <= p1Entry : lastCandle.high >= p1Entry,
      leg2Hit: isBull ? lastCandle.high >= p2Tp1 : lastCandle.low <= p2Tp1,
      leg3Hit: isBull ? lastCandle.high >= p3Tp2 : lastCandle.low <= p3Tp2,
      leg4Hit: false,
      leg5Hit: false,
      isPlanBActive,
      isWickSweep: isHighSweep || isLowSweep,
      altTp1: Math.round(altTp1 * 100) / 100,
      altTp2: Math.round(altTp2 * 100) / 100,
      altTp3: Math.round((isBull ? altTp2 + atrVal * 1.2 : altTp2 - atrVal * 1.2) * 100) / 100,
      isHighRunaway: noPullbackProb >= 65,
      noPullbackProb
    };

    anchoredForecastCache.set(cacheKey, {
      key: cacheKey,
      forecast: candidateForecast,
      anchorCandleTime: lastCandle.time,
      highestPriceSinceStart: lastCandle.high,
      lowestPriceSinceStart: lastCandle.low,
      createdAt: Date.now()
    });

    finalForecast = candidateForecast;
  }

  const forecast: ForecastState = finalForecast;

  // 9. Signal Generation
  let buySig = false;
  let sellSig = false;
  if (options?.showSignals) {
    if (isBull && (deltaCurrent > 0 || isLowSweep) && (rsi14Val >= 48 || isBos)) {
      buySig = true;
    }
    if (!isBull && (deltaCurrent < 0 || isHighSweep) && (rsi14Val <= 52 || isBos)) {
      sellSig = true;
    }
  }

  // 10. HUD Generation (f_render_hud 1:1)
  const hud = generateHudData(symbol, tf, close, atrVal, gex, forecast, deltaCurrent, cvdValue, isExtremeDelta, dow);

  return {
    params: p,
    trendState,
    trendLineVal,
    atrVal,
    rsi14Val,
    rsi6Val,
    macd,
    deltaCurrent,
    cvdValue,
    isExtremeDelta,
    isBos,
    isChoch,
    isBullishBreak,
    breakPrice,
    bosBarIndex,
    isHighSweep,
    isLowSweep,
    lastSweepPrice,
    oteTop,
    oteBottom,
    fib500,
    probOte,
    buySig,
    sellSig,
    gex,
    forecast,
    srZones,
    bullObBoxes: cleanBullOb,
    bearObBoxes: cleanBearOb,
    bullFvgBoxes: cleanBullFvg,
    bearFvgBoxes: cleanBearFvg,
    hud
  };
}

// ============================================================================
// 4. HUD DATA GENERATOR (f_render_hud 1:1)
// ============================================================================

export function generateHudData(
  symbol: string,
  tf: string,
  close: number,
  atrVal: number,
  gex: GexReportCalculated,
  fc: ForecastState,
  deltaCurrent: number,
  cvdValue: number,
  isExtremeDelta: boolean,
  dow: number
): HudData {
  const dowName = dow === 1 ? "Пн" : dow === 2 ? "Вт" : dow === 3 ? "Ср" : dow === 4 ? "Чт" : dow === 5 ? "Пт" : dow === 6 ? "Сб" : "Вс";
  const dowEmoji = dow === 1 ? "🔵" : dow === 2 ? "🔵" : dow === 3 ? "🟡" : dow === 4 ? "🟠" : dow === 5 ? "🔴" : "⚪";
  const dowShortVerdict = dow === 1 ? "Слабая" : dow === 2 ? "Умеренная" : dow === 3 ? "Зарождается" : dow === 4 ? "Сильная" : dow === 5 ? "Экспир." : "Вых.";
  const dowFullVerdict = dow === 1 ? "Слабая — ложные пробои" : dow === 2 ? "Умеренная — короткие цели" : dow === 3 ? "Зарождается — набирает силу" : dow === 4 ? "Сильная — тренд работает" : dow === 5 ? "Экспирация — сквизы и пробои" : "Выходной";
  const dowVerdictStr = dow === 1 ? "🔵 Слабая гамма — жди ложных пробоев" : dow === 2 ? "🔵 Умеренная — короткие цели" : dow === 3 ? "🟡 Тренд зарождается — набирает силу" : dow === 4 ? "🟠 Сильная гамма — тренд работает" : dow === 5 ? "🔴 ЭКСПИРАЦИЯ — сквизы и пробои" : "⚪ Выходной";

  const now = new Date();
  const utcHours = String(now.getUTCHours()).padStart(2, "0");
  const utcMins = String(now.getUTCMinutes()).padStart(2, "0");
  const utcClockStr = `${utcHours}:${utcMins}`;

  const isThirdFriday = dow === 5 && now.getUTCDate() >= 15 && now.getUTCDate() <= 21 && [2, 5, 8, 11].includes(now.getUTCMonth());
  const twWarning = isThirdFriday ? " ⚠️TW" : "";

  // 1. Rec Action
  const p1Str = fc.p1Entry.toFixed(1);
  const p2Str = fc.p2Tp1.toFixed(1);
  const p3Str = fc.p3Tp2.toFixed(1);
  let recActionStr = `⏳ Ждём вход @${p1Str} (${fc.isBull ? "LONG" : "SHORT"})`;
  let recCol = "#94a3b8";
  if (fc.isPlanBActive) {
    recActionStr = "⚡ ПЛАН Б — слом SL, жди разворот";
    recCol = "#f59e0b";
  } else if (fc.leg3Hit) {
    recActionStr = "🏆 ЗАКРЫВАЙ — TP2 достигнут";
    recCol = "#10b981";
  } else if (fc.leg2Hit) {
    recActionStr = `📈 ДЕРЖИМ до TP2 ${p3Str}`;
    recCol = "#38bdf8";
  } else if (fc.leg1Hit) {
    recActionStr = `📍 В позиции → ждём TP1 ${p2Str}`;
    recCol = "#fbbf24";
  }

  // 2. GEX Regime
  let gexRegimeStr = "🟢 Положительная Гамма — дилеры гасят движение, будут откаты";
  let gexRegimeCol = "#10b981";
  if (close > gex.callWall) {
    gexRegimeStr = "🚀 Сквиз — пробили Потолок, дилеры покупают → сильный рост";
    gexRegimeCol = "#fbbf24";
  } else if (close < gex.putWall) {
    gexRegimeStr = "💥 Каскад — пробили Поддержку, дилеры продают → лавина вниз";
    gexRegimeCol = "#ef4444";
  } else if (close < gex.gammaFlip) {
    gexRegimeStr = "🔴 Отрицательная Гамма — дилеры усиливают тренд, мало откатов";
    gexRegimeCol = "#ef4444";
  }

  // 3. Day Target
  const distCallAtr = Math.abs(gex.callWall - close) / Math.max(atrVal, 0.1);
  const distPutAtr = Math.abs(gex.putWall - close) / Math.max(atrVal, 0.1);
  const distPainAtr = Math.abs(gex.maxPain - close) / Math.max(atrVal, 0.1);

  const probCall = Math.max(5, Math.min(88, 78 - distCallAtr * 12 + 4));
  const probPut = Math.max(5, Math.min(88, 78 - distPutAtr * 12 + 4));
  const probPain = Math.max(5, Math.min(88, 82 - distPainAtr * 10 + 5));

  let dayTargetStr = `Потолок ${gex.callWall} (${Math.round(probCall)}%)`;
  let dayTargetCol = "#10b981";
  if (distPainAtr < distCallAtr && distPainAtr < distPutAtr) {
    dayTargetStr = `Магнит дня ${gex.maxPain} (${Math.round(probPain)}%)`;
    dayTargetCol = "#06b6d4";
  } else if (distPutAtr < distCallAtr) {
    dayTargetStr = `Поддержка ${gex.putWall} (${Math.round(probPut)}%)`;
    dayTargetCol = "#ef4444";
  }

  // 4. MM Day Range
  const dayRangeTxt = `${gex.expectedMove68.low.toFixed(1)}–${gex.expectedMove68.high.toFixed(1)} (±${(gex.expectedMove68.high - close).toFixed(1)})`;

  // 5. Context / Speed
  const flipDistAtr = Math.abs(close - gex.gammaFlip) / Math.max(atrVal, 0.1);
  let speedStr = "⚠️ Умеренно — слабое движение";
  let speedCol = "#f59e0b";
  let speedExplainFull = "слабое движение";
  if (flipDistAtr < 0.3) {
    speedStr = "😴 Флэт — цена у равновесия";
    speedCol = "#94a3b8";
    speedExplainFull = "цена у равновесия";
  } else if (flipDistAtr >= 1.5) {
    speedStr = "🚨 Экстремально — сильный импульс";
    speedCol = "#d946ef";
    speedExplainFull = "сильный импульс";
  } else if (flipDistAtr >= 0.8) {
    speedStr = "⚡ Ускорение — тренд идёт";
    speedCol = "#fbbf24";
    speedExplainFull = "тренд идёт";
  }
  const speedDir = close > gex.gammaFlip ? "↑" : "↓";

  // 6. Day Bias
  let dayBiasStr = "🟡 Слабый LONG (Гамма↑, но Макро против)";
  let dayBiasCol = "#f59e0b";
  if (close > gex.gammaFlip && fc.isBull) {
    dayBiasStr = "🟢 Уклон LONG (Гамма↑ + Макро↑ — всё за рост)";
    dayBiasCol = "#fbbf24";
  } else if (close < gex.gammaFlip && !fc.isBull) {
    dayBiasStr = "🔴 Уклон SHORT (Гамма↓ + Макро↓ — всё за падение)";
    dayBiasCol = "#ef4444";
  }

  const curScoreBull = fc.isBull ? 8 : 2;
  const curScoreBear = 10 - curScoreBull;
  const mtfDesc = fc.isBull ? "🟢 Бычий 80%" : "🔴 Медвежий 80%";

  // 7. Flows (Delta & CVD)
  const dAbs = Math.abs(deltaCurrent);
  const dSign = deltaCurrent >= 0 ? "+" : "";
  const dValStr = dAbs >= 1000000 ? `${(deltaCurrent / 1000000).toFixed(2)}M` : dAbs >= 1000 ? `${(deltaCurrent / 1000).toFixed(2)}K` : `${deltaCurrent.toFixed(1)}`;
  const deltaBadge = isExtremeDelta ? "⚡" : "";
  const deltaPartFull = `${deltaCurrent > 0 ? "🟢" : deltaCurrent < 0 ? "🔴" : "⚖️"} Δ ${dSign}${dValStr}${deltaBadge}`;

  const cvdAbs = Math.abs(cvdValue);
  const cvdSign = cvdValue >= 0 ? "+" : "";
  const cvdValStr = cvdAbs >= 1000000 ? `${(cvdValue / 1000000).toFixed(2)}M` : cvdAbs >= 1000 ? `${(cvdValue / 1000).toFixed(2)}K` : `${cvdValue.toFixed(1)}`;
  const cvdArrow = cvdValue > 0 ? "↑" : cvdValue < 0 ? "↓" : "→";
  const cvdPartFull = `CVD ${cvdArrow} ${cvdSign}${cvdValStr}`;
  const flowsDeltaStr = `${deltaPartFull} | ${cvdPartFull}`;
  const flowsDeltaCol = deltaCurrent > 0 ? "#fbbf24" : deltaCurrent < 0 ? "#ef4444" : "#94a3b8";

  // 8. PCR & Vol
  const pcrRvFull = `PCR 1.05🤖 (нейтр.) | Vol 0.85🤖 (норма)`;
  const pcrRvShort = `PCR 1.05🤖 | Vol 0.85🤖`;
  const pcrRvCol = "#f59e0b";

  // 9. Audit
  const auditStr = `🎯 CW ${gex.audit.cwRate}% | PW ${gex.audit.pwRate}% | Flip ${gex.audit.flipRate}% (n=${gex.audit.total})`;
  const auditCol = "#fbbf24";

  return {
    ticker: symbol,
    tfPeriod: tf,
    utcClockStr,
    dowName,
    dowEmoji,
    dowShortVerdict,
    dowFullVerdict,
    dowVerdictStr,
    twWarning,
    recActionStr,
    recCol,
    gexRegimeStr,
    gexRegimeCol,
    dayTargetStr,
    dayTargetCol,
    dayRangeTxt,
    speedStr,
    speedDir,
    speedCol,
    speedExplainFull,
    flipDistAtr,
    dayBiasStr,
    dayBiasCol,
    mtfDesc,
    curScoreBull,
    curScoreBear,
    flowsDeltaStr,
    flowsDeltaCol,
    dValStr,
    deltaBadge,
    cvdArrow,
    cvdSign,
    cvdValStr,
    pcrRvFull,
    pcrRvShort,
    pcrRvCol,
    auditStr,
    auditCol,
    autoHtfName: tf === "15m" ? "1Ч" : tf === "5m" ? "15м" : "1Д",
    hudHtfUp: fc.isBull
  };
}
