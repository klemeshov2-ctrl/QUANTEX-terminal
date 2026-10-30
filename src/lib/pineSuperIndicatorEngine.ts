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

export interface LevelAuditResult {
  touches: number;
  bounces: number;
  breakouts: number;
  hitRatePct: number;
  isTested: boolean;
  closestExtreme: number;
  distToExtreme: number;
  touchTol?: number;
  breakTol?: number;
  strike?: number;
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
  isDumping?: boolean;
  audit: {
    total: number;
    cwRate: number;
    cwTouches?: number;
    cwBounces?: number;
    pwRate: number;
    pwTouches?: number;
    pwBounces?: number;
    flipRate: number;
    flipTouches?: number;
    flipBounces?: number;
    painRate?: number;
    painTouches?: number;
    painBounces?: number;
  };
}

/**
 * Shared institutional GEX Level Hit Rate auditor used by BOTH the Chart HUD and the GEX Analytics tab
 * so level touch/bounce/breakout counts are 100% identical across all views.
 */
export function auditSingleGexLevel(
  candles: Array<{ time: number; open: number; high: number; low: number; close: number }>,
  levelPrice: number,
  levelType: "RESISTANCE" | "SUPPORT" | "FLIP" | "MAGNET",
  windowSec: number = 86400
): LevelAuditResult {
  if (!candles || candles.length === 0 || !levelPrice || levelPrice <= 0) {
    return { touches: 0, bounces: 0, breakouts: 0, hitRatePct: 0, isTested: false, closestExtreme: 0, distToExtreme: 0 };
  }

  const latestTime = candles[candles.length - 1].time;
  const filtered = windowSec > 0 ? candles.filter((c) => c.time >= latestTime - windowSec) : candles;
  const activeCandles = filtered.length >= 6 ? filtered : candles;

  // True 14-period ATR calculation (accounting for high-low and inter-candle gaps)
  const atrSlice = activeCandles.slice(-Math.min(20, activeCandles.length));
  let trSum = 0;
  for (let idx = 0; idx < atrSlice.length; idx++) {
    const cur = atrSlice[idx];
    const prevClose = idx > 0 ? atrSlice[idx - 1].close : cur.open;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
      0.0001
    );
    trSum += tr;
  }
  const atr14 = trSum / Math.max(1, atrSlice.length);

  // Dynamic touch tolerance buffer (Tolerance Buffer) strictly bound to live ATR-14
  // Expands automatically during strong trend / news impulses so wicks don't trigger false breakouts
  let touchTol: number;
  let breakTol: number;

  if (levelPrice >= 1500 && levelPrice <= 6500) {
    // Gold (XAUUSD / GD): 0.55x ATR14 (dynamically scales from ~$1.8 in calm flat up to ~$10.5 in high volatility)
    touchTol = Math.round(Math.max(1.8, Math.min(11.5, atr14 * 0.55)) * 10) / 10;
    breakTol = Math.round(touchTol * 1.45 * 10) / 10;
  } else if (levelPrice > 10000) {
    // BTC / High-value indices: 0.55x ATR14
    touchTol = Math.round(Math.max(85, Math.min(550, atr14 * 0.55)));
    breakTol = Math.round(touchTol * 1.45);
  } else {
    // General assets (FX, ETH, SOL, MOEX): 0.55x ATR14
    touchTol = Math.round(Math.max(levelPrice * 0.0007, Math.min(levelPrice * 0.0045, atr14 * 0.55)) * 100) / 100;
    breakTol = Math.round(touchTol * 1.45 * 100) / 100;
  }

  let touches = 0;
  let bounces = 0;
  let breakouts = 0;

  const maxHigh = Math.max(...activeCandles.map((c) => c.high));
  const minLow = Math.min(...activeCandles.map((c) => c.low));
  const lastClose = activeCandles[activeCandles.length - 1].close;
  const closestExtreme = levelPrice >= lastClose ? maxHigh : minLow;
  const distToExtreme = Math.abs(levelPrice - closestExtreme);

  let i = 0;
  while (i < activeCandles.length) {
    const c = activeCandles[i];
    const isTouch = c.high >= levelPrice - touchTol && c.low <= levelPrice + touchTol;

    if (!isTouch) {
      i++;
      continue;
    }

    touches += 1;

    // Determine direction of approach from preceding bars (up to 3 bars prior)
    let prePrice = c.open;
    for (let b = i - 1; b >= Math.max(0, i - 3); b--) {
      if (Math.abs(activeCandles[b].close - levelPrice) > touchTol * 0.5) {
        prePrice = activeCandles[b].close;
        break;
      }
    }
    const approachedFromAbove = prePrice >= levelPrice;

    // Group contiguous candles hovering inside the touch band (up to 3 bars) to evaluate outcome
    let endClusterIdx = i;
    while (
      endClusterIdx + 1 < activeCandles.length &&
      endClusterIdx - i < 2 &&
      activeCandles[endClusterIdx].close >= levelPrice - breakTol &&
      activeCandles[endClusterIdx].close <= levelPrice + breakTol &&
      activeCandles[endClusterIdx + 1].high >= levelPrice - touchTol &&
      activeCandles[endClusterIdx + 1].low <= levelPrice + touchTol
    ) {
      endClusterIdx++;
    }

    const evalIdx = Math.min(activeCandles.length - 1, endClusterIdx + 1);
    const clusterClose = activeCandles[endClusterIdx].close;
    const followClose = activeCandles[evalIdx].close;

    let isBreakout = false;
    if (levelType === "RESISTANCE") {
      isBreakout =
        clusterClose > levelPrice + breakTol ||
        (clusterClose > levelPrice && followClose > levelPrice + breakTol);
    } else if (levelType === "SUPPORT") {
      isBreakout =
        clusterClose < levelPrice - breakTol ||
        (clusterClose < levelPrice && followClose < levelPrice - breakTol);
    } else {
      // FLIP or MAGNET (two-way pivot level)
      if (approachedFromAbove) {
        isBreakout =
          clusterClose < levelPrice - breakTol ||
          (clusterClose < levelPrice && followClose < levelPrice - breakTol);
      } else {
        isBreakout =
          clusterClose > levelPrice + breakTol ||
          (clusterClose > levelPrice && followClose > levelPrice + breakTol);
      }
    }

    if (isBreakout) {
      breakouts += 1;
    } else {
      bounces += 1;
    }

    // Advance past this interaction cluster so consecutive bars at the level aren't double-counted
    i = endClusterIdx + 1;
    while (
      i < activeCandles.length &&
      activeCandles[i].high >= levelPrice - touchTol * 0.8 &&
      activeCandles[i].low <= levelPrice + touchTol * 0.8
    ) {
      i++;
    }
  }

  const isTested = touches > 0;
  const hitRatePct = isTested ? Math.round((bounces / touches) * 100) : 0;

  return {
    touches,
    bounces,
    breakouts,
    hitRatePct,
    isTested,
    closestExtreme,
    distToExtreme,
    touchTol,
    breakTol,
    strike: levelPrice
  };
}

export interface RangeDetectionResult {
  isRangeMode: boolean;
  totalBounces: number;
  totalBreakouts: number;
  bounceRatePct: number;
  corridorSpan: number;
  pw: number;
  cw: number;
  candlesInCorridorPct: number;
  atrRatio: number;
  statusLabel: string;
  summary: string;
}

export function detectMarketRangeMode(
  candles: Array<{ high: number; low: number; close: number }>,
  pw: number,
  cw: number,
  pwAudit?: LevelAuditResult,
  cwAudit?: LevelAuditResult
): RangeDetectionResult {
  if (!candles || candles.length < 8 || !pw || !cw || cw <= pw) {
    return {
      isRangeMode: false,
      totalBounces: 0,
      totalBreakouts: 0,
      bounceRatePct: 0,
      corridorSpan: 0,
      pw: pw || 0,
      cw: cw || 0,
      candlesInCorridorPct: 0,
      atrRatio: 1.0,
      statusLabel: "НЕДОСТАТОЧНО ДАННЫХ",
      summary: "Недостаточно данных для анализа боковика"
    };
  }

  const corridorSpan = cw - pw;
  const recent = candles.slice(-40);
  
  // Calculate ATR ratio (recent 12 vs baseline 40)
  const recentRanges = recent.slice(-12).map(c => Math.max(0.01, c.high - c.low));
  const recentAvg = recentRanges.reduce((a, b) => a + b, 0) / Math.max(1, recentRanges.length);
  const baselineRanges = recent.map(c => Math.max(0.01, c.high - c.low));
  const baselineAvg = baselineRanges.reduce((a, b) => a + b, 0) / Math.max(1, baselineRanges.length);
  const atrRatio = baselineAvg > 0 ? recentAvg / baselineAvg : 1.0;

  // Count candles inside corridor [pw - buffer, cw + buffer]
  const touchBuffer = Math.max(corridorSpan * 0.05, 3.0);
  let insideCount = 0;
  for (const c of recent) {
    if (c.high <= cw + touchBuffer && c.low >= pw - touchBuffer) {
      insideCount++;
    }
  }
  const candlesInCorridorPct = Math.round((insideCount / recent.length) * 100);

  const totalBounces = (pwAudit?.bounces || 0) + (cwAudit?.bounces || 0);
  const totalBreakouts = (pwAudit?.breakouts || 0) + (cwAudit?.breakouts || 0);
  const totalInteractions = totalBounces + totalBreakouts;
  const bounceRatePct = totalInteractions > 0 ? Math.round((totalBounces / totalInteractions) * 100) : 100;

  // Range criteria:
  // 1. At least 65% of candles stayed inside [pw, cw] corridor
  // 2. ATR ratio <= 1.25 (not an accelerating trend / squeeze)
  // 3. Level boundaries have held price (bounces >= breakouts or breakouts <= 1)
  const isRangeMode = candlesInCorridorPct >= 65 && atrRatio <= 1.25 && (totalBreakouts <= 1 || totalBounces >= totalBreakouts);

  const statusLabel = isRangeMode ? "РЕЖИМ БОКОВИКА (ФЛЭТ)" : "ТРЕНДОВЫЙ РЕЖИМ";
  const summary = isRangeMode
    ? `Рынок движется в боковике между Put Wall $${pw} и Call Wall $${cw} (${candlesInCorridorPct}% свечей в диапазоне). Уровни держат цену: ${totalBounces} отскоков, ${totalBreakouts} пробоев (${bounceRatePct}% удержаний). Рекомендуется торговля от границ на отбой.`
    : `Рынок в направленном движении. Выход за границы диапазона $${pw}–$${cw} или расширение ATR (x${atrRatio.toFixed(1)}).`;

  return {
    isRangeMode,
    totalBounces,
    totalBreakouts,
    bounceRatePct,
    corridorSpan,
    pw,
    cw,
    candlesInCorridorPct,
    atrRatio,
    statusLabel,
    summary
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
  isMissedEntry?: boolean;
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
  leg1Idx?: number;
  leg1Time?: number;
  leg2Hit: boolean;
  leg2Idx?: number;
  leg2Time?: number;
  leg3Hit: boolean;
  leg3Idx?: number;
  leg3Time?: number;
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

export interface AnchoredForecastItem {
  key: string;
  forecast: ForecastState;
  anchorCandleTime: number;
  highestPriceSinceStart: number;
  lowestPriceSinceStart: number;
  createdAt: number;
}

const LOCAL_STORAGE_SETUPS_KEY = "quantex_anchored_forecasts_v3";
const anchoredForecastCache = new Map<string, AnchoredForecastItem>();
const lastSyncedSignatureMap = new Map<string, string>();

// 1. Immediate synchronous hydration from localStorage so page reload (F5) has all setups before first render
function hydrateSetupsFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SETUPS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [k, val] of Object.entries(parsed)) {
        const item = val as AnchoredForecastItem;
        if (item && item.forecast && typeof item.anchorCandleTime === "number") {
          anchoredForecastCache.set(k, item);
        }
      }
    }
  } catch {}
}

hydrateSetupsFromLocalStorage();

function saveSetupsToLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, AnchoredForecastItem> = {};
    for (const [k, v] of anchoredForecastCache.entries()) {
      obj[k] = v;
    }
    window.localStorage.setItem(LOCAL_STORAGE_SETUPS_KEY, JSON.stringify(obj));
  } catch {}
}

function syncSetupToServer(key: string, item: AnchoredForecastItem): void {
  if (typeof window === "undefined") return;
  const fc = item.forecast;
  const sig = `${item.anchorCandleTime}_${fc.p1Entry}_${fc.p2Tp1}_${fc.p3Tp2}_${fc.leg1Hit}_${fc.leg2Hit}_${fc.leg3Hit}_${fc.trailingStageIdx}_${fc.isPlanBActive}`;
  if (lastSyncedSignatureMap.get(key) === sig) return;
  lastSyncedSignatureMap.set(key, sig);

  saveSetupsToLocalStorage();
  fetch("/api/indicator/setups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, item })
  }).catch(() => {});
}

// 2. Asynchronous hydration from Server disk storage (for cross-session / cross-device continuity)
export async function hydrateSetupsFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/indicator/setups");
    if (!res.ok) return false;
    const data = await res.json();
    if (data && data.setups && typeof data.setups === "object") {
      let updated = false;
      for (const [k, val] of Object.entries(data.setups)) {
        const serverItem = val as AnchoredForecastItem;
        if (!serverItem || !serverItem.forecast || typeof serverItem.anchorCandleTime !== "number") continue;
        const localItem = anchoredForecastCache.get(k);
        // Adopt server setup if local doesn't exist or server setup has a newer anchor/progress
        if (
          !localItem ||
          serverItem.anchorCandleTime > localItem.anchorCandleTime ||
          (serverItem.anchorCandleTime === localItem.anchorCandleTime &&
            (Number(Boolean(serverItem.forecast.leg3Hit)) > Number(Boolean(localItem.forecast.leg3Hit)) ||
              Number(Boolean(serverItem.forecast.leg2Hit)) > Number(Boolean(localItem.forecast.leg2Hit)) ||
              Number(Boolean(serverItem.forecast.leg1Hit)) > Number(Boolean(localItem.forecast.leg1Hit))))
        ) {
          anchoredForecastCache.set(k, serverItem);
          updated = true;
        }
      }
      if (updated) {
        saveSetupsToLocalStorage();
      }
      return updated;
    }
  } catch {}
  return false;
}

if (typeof window !== "undefined") {
  hydrateSetupsFromServer();
}

export function resetIndicatorForecast(symbol?: string, tf?: string): void {
  if (symbol && tf) {
    const key = `${symbol}_${tf}`;
    anchoredForecastCache.delete(key);
    lastSyncedSignatureMap.delete(key);
    saveSetupsToLocalStorage();
    if (typeof window !== "undefined") {
      fetch(`/api/indicator/setups?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {});
    }
  } else if (symbol) {
    for (const key of Array.from(anchoredForecastCache.keys())) {
      if (key.startsWith(`${symbol}_`)) {
        anchoredForecastCache.delete(key);
        lastSyncedSignatureMap.delete(key);
      }
    }
    saveSetupsToLocalStorage();
    if (typeof window !== "undefined") {
      fetch(`/api/indicator/setups?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" }).catch(() => {});
    }
  } else {
    anchoredForecastCache.clear();
    lastSyncedSignatureMap.clear();
    saveSetupsToLocalStorage();
    if (typeof window !== "undefined") {
      fetch(`/api/indicator/setups`, { method: "DELETE" }).catch(() => {});
    }
  }
}

function roundPriceForAsset(val: number, refPrice: number): number {
  const factor = refPrice < 10 ? 10000 : 100;
  return Math.round(val * factor) / factor;
}

function findCandleIndexByTime(candles: Candle[], targetTime: number | undefined, tfSec: number): number {
  if (!candles || candles.length === 0 || !targetTime) return -1;
  const exact = candles.findIndex((c) => c.time === targetTime);
  if (exact !== -1) return exact;
  let bestIdx = -1;
  let bestDiff = Infinity;
  const maxTol = Math.max(60, tfSec * 0.9);
  for (let i = 0; i < candles.length; i++) {
    const diff = Math.abs(candles[i].time - targetTime);
    if (diff < bestDiff && diff <= maxTol) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
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
  if (step <= 0) return price;
  const nr = Math.round(price / step) * step;
  const dist = Math.abs(price - nr);
  const zone = atrV * 0.35;
  if (dist >= zone) return price;

  const sh = Math.max(atrV * 0.12, mintick * 5);
  let result = price;
  if (isLong) {
    // For Long TP: if price is just below or at a round resistance nr, take profit slightly before it (nr - sh)
    if (price <= nr && nr - sh > price - zone) {
      result = nr - sh;
    }
  } else {
    // For Short TP: if price is just above or at a round support nr, take profit slightly before it (nr + sh)
    if (price >= nr && nr + sh < price + zone) {
      result = nr + sh;
    }
  }
  return result;
}

export function f_avoid_round_sl(price: number, isLong: boolean, atrV: number, mintick = 0.01): number {
  const step = f_round_step(price);
  if (step <= 0) return price;
  const nr = Math.round(price / step) * step;
  const dist = Math.abs(price - nr);
  const zone = atrV * 0.35;
  if (dist >= zone) return price;

  const sh = Math.max(atrV * 0.12, mintick * 5);
  let result = price;
  if (isLong) {
    // Long SL: Place slightly below round support (nr - sh)
    result = nr - sh;
  } else {
    // Short SL: Place slightly above round resistance (nr + sh)
    result = nr + sh;
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

  // Real-time audit of GEX levels against actual candle history (synchronized 1:1 with GEX Analytics Hit Rate)
  const cwAudit = auditSingleGexLevel(candles, callWall, "RESISTANCE", 86400);
  const pwAudit = auditSingleGexLevel(candles, putWall, "SUPPORT", 86400);
  const flipAudit = auditSingleGexLevel(candles, gammaFlip, "FLIP", 86400);
  const painAudit = auditSingleGexLevel(candles, maxPain, "MAGNET", 86400);
  const totalGexTouches = cwAudit.touches + pwAudit.touches + flipAudit.touches + painAudit.touches;

  // Detect active dump / momentum sell-off (matching Thermometer in GEX Analytics)
  let isDumping = false;
  if (candles.length >= 8) {
    const recentSlice = candles.slice(-12);
    const firstP = recentSlice[0].open || recentSlice[0].close;
    const recentChgPct = firstP > 0 ? ((close - firstP) / firstP) * 100 : 0;
    const daySlice = candles.slice(-Math.min(candles.length, 96));
    const dayOpenP = daySlice[0].open || daySlice[0].close;
    const dayChgPct = dayOpenP > 0 ? ((close - dayOpenP) / dayOpenP) * 100 : 0;
    const distToFlipPct = ((close - gammaFlip) / Math.max(1, gammaFlip)) * 100;
    isDumping =
      recentChgPct <= -0.28 ||
      dayChgPct <= -0.65 ||
      (distToFlipPct < 0.25 && recentChgPct < -0.15);
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
    isDumping,
    audit: {
      total: totalGexTouches,
      cwRate: cwAudit.hitRatePct,
      cwTouches: cwAudit.touches,
      cwBounces: cwAudit.bounces,
      pwRate: pwAudit.hitRatePct,
      pwTouches: pwAudit.touches,
      pwBounces: pwAudit.bounces,
      flipRate: flipAudit.hitRatePct,
      flipTouches: flipAudit.touches,
      flipBounces: flipAudit.bounces,
      painRate: painAudit.hitRatePct,
      painTouches: painAudit.touches,
      painBounces: painAudit.bounces
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

  // 8. Forecast Wave (Вход, TP1, TP2, TP3, SL, Trailing) - Exact Pine Script 1:1 Port with Strict Invariants
  interface SetupLevelsResult {
    p1Entry: number;
    p2Tp1: number;
    p3Tp2: number;
    p5Tp3: number;
    invalidLevelSl: number;
    altTp1: number;
    altTp2: number;
    altTp3: number;
  }

  const computeSetupLevelsForBar = (
    bIdx: number,
    isBullDir: boolean,
    bCandle: Candle,
    bAtr: number,
    isSweep: boolean
  ): SetupLevelsResult => {
    const bOpen = bCandle.open;
    const isWkOrMo = tfSec >= 604800;
    const isDly = tfSec >= 86400 && tfSec < 604800;
    const is240 = tfSec >= 14400 && tfSec < 86400;
    const is60 = tfSec >= 3600 && tfSec < 14400;

    const max_tp1_atr = isWkOrMo ? 1.8 : isDly ? 1.8 : is240 ? 1.6 : is60 ? 1.5 : 1.4;
    const max_tp2_atr = isWkOrMo ? 2.8 : isDly ? 2.8 : is240 ? 2.5 : is60 ? 2.4 : 2.2;
    const min_tp1_atr = isWkOrMo ? 0.85 : isDly ? 0.85 : is240 ? 0.75 : is60 ? 0.7 : 0.65;
    const min_tp2_atr = isWkOrMo ? 1.0 : isDly ? 1.0 : is240 ? 0.9 : is60 ? 0.85 : 0.8;
    const max_pullback_atr = isWkOrMo ? 0.45 : isDly ? 0.55 : is240 ? 0.65 : 0.75;

    let entry: number;

    if (isBullDir) {
      if (isSweep) {
        entry = bCandle.low;
      } else {
        let pFound: number | null = null;
        for (let i = cleanBullOb.length - 1; i >= 0; i--) {
          const ob = cleanBullOb[i];
          if (ob.left <= bIdx && ob.top < bOpen && ob.top >= bOpen - bAtr * max_pullback_atr) {
            pFound = (ob.top + ob.bottom) / 2;
            break;
          }
        }
        if (pFound === null && cleanBullFvg.length > 0) {
          for (let i = cleanBullFvg.length - 1; i >= 0; i--) {
            const fvg = cleanBullFvg[i];
            if (fvg.left <= bIdx && fvg.top < bOpen && fvg.top >= bOpen - bAtr * max_pullback_atr) {
              pFound = (fvg.top + fvg.bottom) / 2;
              break;
            }
          }
        }
        entry = pFound !== null ? pFound : bOpen - bAtr * (tfSec < 86400 ? 0.42 : 0.35);
      }
      entry = Math.round(entry * 100) / 100;

      // Stop Loss strictly below entry
      let sl = entry - bAtr * 0.85;
      const winSlice = candles.slice(Math.max(0, bIdx - 7), bIdx + 1);
      if (winSlice.length > 0) {
        const ll = Math.min(...winSlice.map(c => c.low));
        if (ll < entry && ll >= entry - bAtr * 1.35) {
          sl = ll - bAtr * 0.15;
        }
      }
      sl = f_avoid_round_sl(sl, true, bAtr);
      sl = Math.min(entry - bAtr * 0.35, sl);
      const riskDist = Math.max(entry - sl, bAtr * 0.75, 2.0);

      const isNegativeGamma = close < gammaFlip || Boolean(gex?.isDumping);
      const isTrendingOrNegGamma = isTrending || isNegativeGamma;

      let tp1: number;
      let tp2: number;
      let tp3: number;

      if (isTrendingOrNegGamma) {
        // Enforce R:R >= 1:3 anchored to structural levels (Call Wall, swing highs, OBs)
        const minTrendTp1Dist = Math.max(riskDist * 3.0, bAtr * 2.8);
        let structuralTarget = entry + minTrendTp1Dist;

        if (callWall > entry + minTrendTp1Dist) {
          structuralTarget = callWall;
        }

        const recentHighs = candles.slice(Math.max(0, bIdx - 30), bIdx + 1).map(c => c.high);
        const swingHigh = Math.max(...recentHighs);
        if (swingHigh > entry + minTrendTp1Dist && (callWall <= entry + minTrendTp1Dist || swingHigh < callWall)) {
          structuralTarget = swingHigh;
        }

        structuralTarget = f_avoid_round(structuralTarget, true, bAtr);
        tp1 = Math.max(entry + minTrendTp1Dist, structuralTarget);
        tp2 = Math.max(tp1 + riskDist * 1.5, callWall > tp1 ? callWall : tp1 + bAtr * 2.5);
        tp2 = f_avoid_round(tp2, true, bAtr);
        tp3 = tp2 + Math.max(riskDist * 1.5, bAtr * 2.0);
      } else {
        // Flat / ranging market: keep standard short bounded scalp targets
        const tp1Dist = bAtr * Math.max(min_tp1_atr, Math.min(max_tp1_atr * tpMult, 1.25 * tpMult));
        let candP2 = entry + tp1Dist;
        for (let i = cleanBearOb.length - 1; i >= 0; i--) {
          const ob = cleanBearOb[i];
          if (ob.left <= bIdx && ob.bottom >= entry + bAtr * min_tp1_atr && ob.bottom <= entry + bAtr * max_tp1_atr * tpMult) {
            candP2 = ob.bottom;
            break;
          }
        }
        candP2 = f_avoid_round(candP2, true, bAtr);
        tp1 = Math.max(entry + bAtr * min_tp1_atr, Math.min(entry + bAtr * max_tp1_atr * tpMult, candP2));

        const tp2Dist = bAtr * Math.max(min_tp2_atr, Math.min(max_tp2_atr * tpMult, 2.10 * tpMult));
        let candP3 = Math.max(tp1 + bAtr * min_tp2_atr, entry + tp2Dist);
        candP3 = f_avoid_round(candP3, true, bAtr);
        tp2 = Math.max(tp1 + bAtr * min_tp2_atr, Math.min(entry + bAtr * max_tp2_atr * tpMult, candP3));
        tp3 = tp2 + bAtr * Math.max(0.85, 1.10 * tpMult);
      }

      const altTp1 = sl - bAtr * 1.5;
      const altTp2 = sl - bAtr * 3.0;
      const altTp3 = altTp2 - bAtr * 1.2;

      return { p1Entry: entry, p2Tp1: tp1, p3Tp2: tp2, p5Tp3: tp3, invalidLevelSl: sl, altTp1, altTp2, altTp3 };
    } else {
      // SHORT DIRECTION
      if (isSweep) {
        entry = bCandle.high;
      } else {
        let pFound: number | null = null;
        for (let i = cleanBearOb.length - 1; i >= 0; i--) {
          const ob = cleanBearOb[i];
          if (ob.left <= bIdx && ob.bottom > bOpen && ob.bottom <= bOpen + bAtr * max_pullback_atr) {
            pFound = (ob.top + ob.bottom) / 2;
            break;
          }
        }
        if (pFound === null && cleanBearFvg.length > 0) {
          for (let i = cleanBearFvg.length - 1; i >= 0; i--) {
            const fvg = cleanBearFvg[i];
            if (fvg.left <= bIdx && fvg.bottom > bOpen && fvg.bottom <= bOpen + bAtr * max_pullback_atr) {
              pFound = (fvg.top + fvg.bottom) / 2;
              break;
            }
          }
        }
        entry = pFound !== null ? pFound : bOpen + bAtr * (tfSec < 86400 ? 0.42 : 0.35);
      }
      entry = Math.round(entry * 100) / 100;

      // Stop Loss strictly above entry
      let sl = entry + bAtr * 0.85;
      const winSlice = candles.slice(Math.max(0, bIdx - 7), bIdx + 1);
      if (winSlice.length > 0) {
        const hh = Math.max(...winSlice.map(c => c.high));
        if (hh > entry && hh <= entry + bAtr * 1.35) {
          sl = hh + bAtr * 0.15;
        }
      }
      sl = f_avoid_round_sl(sl, false, bAtr);
      sl = Math.max(entry + bAtr * 0.35, sl);
      const riskDist = Math.max(sl - entry, bAtr * 0.75, 2.0);

      const isNegativeGamma = close < gammaFlip || Boolean(gex?.isDumping);
      const isTrendingOrNegGamma = isTrending || isNegativeGamma;

      let tp1: number;
      let tp2: number;
      let tp3: number;

      if (isTrendingOrNegGamma) {
        // Enforce R:R >= 1:3 anchored to structural levels (Put Wall, swing lows, OBs)
        const minTrendTp1Dist = Math.max(riskDist * 3.0, bAtr * 2.8);
        let structuralTarget = entry - minTrendTp1Dist;

        if (putWall < entry - minTrendTp1Dist) {
          structuralTarget = putWall;
        }

        const recentLows = candles.slice(Math.max(0, bIdx - 30), bIdx + 1).map(c => c.low);
        const swingLow = Math.min(...recentLows);
        if (swingLow < entry - minTrendTp1Dist && (putWall >= entry - minTrendTp1Dist || swingLow > putWall)) {
          structuralTarget = swingLow;
        }

        structuralTarget = f_avoid_round(structuralTarget, false, bAtr);
        tp1 = Math.min(entry - minTrendTp1Dist, structuralTarget);
        tp2 = Math.min(tp1 - riskDist * 1.5, putWall < tp1 ? putWall : tp1 - bAtr * 2.5);
        tp2 = f_avoid_round(tp2, false, bAtr);
        tp3 = tp2 - Math.max(riskDist * 1.5, bAtr * 2.0);
      } else {
        // Flat / ranging market: keep standard short bounded scalp targets
        const tp1Dist = bAtr * Math.max(min_tp1_atr, Math.min(max_tp1_atr * tpMult, 1.25 * tpMult));
        let candP2 = entry - tp1Dist;
        for (let i = cleanBullOb.length - 1; i >= 0; i--) {
          const ob = cleanBullOb[i];
          if (ob.left <= bIdx && ob.top <= entry - bAtr * min_tp1_atr && ob.top >= entry - bAtr * max_tp1_atr * tpMult) {
            candP2 = ob.top;
            break;
          }
        }
        candP2 = f_avoid_round(candP2, false, bAtr);
        tp1 = Math.min(entry - bAtr * min_tp1_atr, Math.max(entry - bAtr * max_tp1_atr * tpMult, candP2));

        const tp2Dist = bAtr * Math.max(min_tp2_atr, Math.min(max_tp2_atr * tpMult, 2.10 * tpMult));
        let candP3 = Math.min(tp1 - bAtr * min_tp2_atr, entry - tp2Dist);
        candP3 = f_avoid_round(candP3, false, bAtr);
        tp2 = Math.min(tp1 - bAtr * min_tp2_atr, Math.max(entry - bAtr * max_tp2_atr * tpMult, candP3));
        tp3 = tp2 - bAtr * Math.max(0.85, 1.10 * tpMult);
      }

      const altTp1 = sl + bAtr * 1.5;
      const altTp2 = sl + bAtr * 3.0;
      const altTp3 = altTp2 + bAtr * 1.2;

      return { p1Entry: entry, p2Tp1: tp1, p3Tp2: tp2, p5Tp3: tp3, invalidLevelSl: sl, altTp1, altTp2, altTp3 };
    }
  };

  // Compute live setup levels at latest bar
  const liveLevels = computeSetupLevelsForBar(n - 1, isBull, lastCandle, atrVal, isLowSweep || isHighSweep);
  const target_p1 = liveLevels.p1Entry;
  const target_p2 = liveLevels.p2Tp1;
  const target_p3 = liveLevels.p3Tp2;
  const invalidLevelSl = liveLevels.invalidLevelSl;
  const p5Tp3 = liveLevels.p5Tp3;
  const altTp1 = liveLevels.altTp1;
  const altTp2 = liveLevels.altTp2;
  const altTp3 = liveLevels.altTp3;

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
  const noPullbackProb = Math.min(95, Math.max(12, 15 + (isExtremeDelta ? 25 : 10) + (Math.abs(close - target_p1) > atrVal ? 20 : 0)));

  const p1Entry = target_p1;
  const p2Tp1 = target_p2;
  const p3Tp2 = target_p3;

  // TradingView Stateful Forecast Anchoring Algorithm (var fc_start_bar, var fc_p1...)
  // Persists across page refreshes (localStorage + Server) and replays historical bars so it never resets to the last candle on reload
  const cacheKey = `${symbol}_${tf}`;
  const isFallbackCandles = Boolean((candles[0] as any)?._isFallback);
  const existingItem = anchoredForecastCache.get(cacheKey);
  let finalForecast: ForecastState | null = null;
  let completedAtBarIdx: number | undefined = undefined;

  // Helper to construct a fresh ForecastState anchored at any historical bar index `barIdx`
  const createSetupAtBar = (barIdx: number): { item: AnchoredForecastItem; forecast: ForecastState } => {
    const bIdx = Math.max(0, Math.min(n - 1, barIdx));
    const bCandle = candles[bIdx];
    const bClose = bCandle.close;
    const bAtr = atrs[bIdx] || atrVal;
    const bEma200 = ema200[bIdx] || bClose;
    const bDelta = deltas[bIdx] || 0;

    // Direction at barIdx: if at latest bar use current isBull, otherwise evaluate trend structure at barIdx
    let bIsBull = isBull;
    if (bIdx < n - 1) {
      const lookbackIdx = Math.max(0, bIdx - p.it);
      const localMomUp = bClose >= closes[lookbackIdx];
      bIsBull = bClose >= bEma200 ? (localMomUp || bDelta >= 0) : (localMomUp && bClose > bEma200 * 0.998);
    }

    // Use unified deterministic setup level calculator
    const levels = computeSetupLevelsForBar(bIdx, bIsBull, bCandle, bAtr, false);
    const bP1 = levels.p1Entry;
    const bP2 = levels.p2Tp1;
    const bP3 = levels.p3Tp2;
    const bP5 = levels.p5Tp3;
    const bSl = levels.invalidLevelSl;
    const bAlt1 = levels.altTp1;
    const bAlt2 = levels.altTp2;
    const bAlt3 = levels.altTp3;

    const bEntryHitOnStart = bIsBull ? bCandle.low <= bP1 : bCandle.high >= bP1;

    const fcState: ForecastState = {
      isBull: bIsBull,
      probability: Math.round(bIsBull ? (bDelta > 0 ? 74 : 66) : (bDelta < 0 ? 74 : 66)),
      startBar: bIdx,
      startLogical: bIdx,
      startTime: bCandle.time,
      barsSinceStart: (n - 1) - bIdx,
      isLocked: true,
      statusReason: `Фиксирован (бар #${bIdx})`,
      startPrice: roundPriceForAsset(bClose, bClose),
      p1Entry: roundPriceForAsset(bP1, bClose),
      p2Tp1: roundPriceForAsset(bP2, bClose),
      p3Tp2: roundPriceForAsset(bP3, bClose),
      p5Tp3: roundPriceForAsset(bP5, bClose),
      invalidLevelSl: roundPriceForAsset(bSl, bClose),
      activeTrailingSl: roundPriceForAsset(bSl, bClose),
      trailingStageStr: "🛡️ Начальный SL",
      trailingStageIdx: 0,
      leg1Hit: bEntryHitOnStart,
      leg1Idx: bEntryHitOnStart ? bIdx : undefined,
      leg1Time: bEntryHitOnStart ? bCandle.time : undefined,
      leg2Hit: false,
      leg3Hit: false,
      leg4Hit: false,
      leg5Hit: false,
      isPlanBActive: false,
      isWickSweep: isHighSweep || isLowSweep,
      altTp1: roundPriceForAsset(bAlt1, bClose),
      altTp2: roundPriceForAsset(bAlt2, bClose),
      altTp3: roundPriceForAsset(bAlt3, bClose),
      isHighRunaway: noPullbackProb >= 65,
      noPullbackProb
    };

    const item: AnchoredForecastItem = {
      key: cacheKey,
      forecast: fcState,
      anchorCandleTime: bCandle.time,
      highestPriceSinceStart: bCandle.high,
      lowestPriceSinceStart: bCandle.low,
      createdAt: Date.now()
    };

    return { item, forecast: fcState };
  };

  // Helper to evaluate a locked setup from its `anchorIdx` up to `targetEndIdx`
  const evaluateSetupRange = (
    item: AnchoredForecastItem,
    anchorIdx: number,
    targetEndIdx: number
  ): { expiredAtBar: number | null; updatedForecast: ForecastState } => {
    const prev = item.forecast;
    const entryWaitBars = tfSec <= 300 ? 12 : tfSec <= 1800 ? 10 : 8;

    let leg1Hit = Boolean(prev.leg1Hit);
    let leg1Idx = prev.leg1Time ? findCandleIndexByTime(candles, prev.leg1Time, tfSec) : prev.leg1Idx;
    if (leg1Idx === undefined || leg1Idx < anchorIdx) {
      leg1Hit = false;
      leg1Idx = undefined;
    }
    let leg1Time = leg1Hit && leg1Idx !== undefined ? candles[leg1Idx]?.time ?? prev.leg1Time : undefined;

    let leg2Hit = Boolean(prev.leg2Hit);
    let leg2Idx = prev.leg2Time ? findCandleIndexByTime(candles, prev.leg2Time, tfSec) : prev.leg2Idx;
    if (!leg1Hit || leg2Idx === undefined || leg2Idx < anchorIdx) {
      leg2Hit = false;
      leg2Idx = undefined;
    }
    let leg2Time = leg2Hit && leg2Idx !== undefined ? candles[leg2Idx]?.time ?? prev.leg2Time : undefined;

    let leg3Hit = Boolean(prev.leg3Hit);
    let leg3Idx = prev.leg3Time ? findCandleIndexByTime(candles, prev.leg3Time, tfSec) : prev.leg3Idx;
    if (!leg2Hit || leg3Idx === undefined || leg3Idx < anchorIdx) {
      leg3Hit = false;
      leg3Idx = undefined;
    }
    let leg3Time = leg3Hit && leg3Idx !== undefined ? candles[leg3Idx]?.time ?? prev.leg3Time : undefined;

    let activeTrailingSl = prev.invalidLevelSl;
    let trailingStageStr = "🛡️ Начальный SL";
    let trailingStageIdx = 0;
    let expiredAtBar: number | null = null;

    const distToTp1 = Math.abs(prev.p2Tp1 - prev.p1Entry);

    for (let bi = anchorIdx; bi <= targetEndIdx; bi++) {
      const cb = candles[bi];
      if (cb.high > item.highestPriceSinceStart) item.highestPriceSinceStart = cb.high;
      if (cb.low < item.lowestPriceSinceStart) item.lowestPriceSinceStart = cb.low;

      if (prev.isBull) {
        if (!leg1Hit && cb.low <= prev.p1Entry) {
          leg1Hit = true;
          leg1Idx = bi;
          leg1Time = cb.time;
        }
        if (leg1Hit && !leg2Hit && cb.high >= prev.p2Tp1) {
          leg2Hit = true;
          leg2Idx = bi;
          leg2Time = cb.time;
        }
        if (leg2Hit && !leg3Hit && cb.high >= prev.p3Tp2) {
          leg3Hit = true;
          leg3Idx = bi;
          leg3Time = cb.time;
        }
      } else {
        if (!leg1Hit && cb.high >= prev.p1Entry) {
          leg1Hit = true;
          leg1Idx = bi;
          leg1Time = cb.time;
        }
        if (leg1Hit && !leg2Hit && cb.low <= prev.p2Tp1) {
          leg2Hit = true;
          leg2Idx = bi;
          leg2Time = cb.time;
        }
        if (leg2Hit && !leg3Hit && cb.low <= prev.p3Tp2) {
          leg3Hit = true;
          leg3Idx = bi;
          leg3Time = cb.time;
        }
      }

      // Update trailing stop stage if entry was taken
      if (leg1Hit && distToTp1 > 0) {
        const bestExtreme = prev.isBull ? cb.high - prev.p1Entry : prev.p1Entry - cb.low;
        if (leg2Hit || bestExtreme >= distToTp1) {
          activeTrailingSl = prev.isBull
            ? prev.p1Entry + (prev.p2Tp1 - prev.p1Entry) * 0.50
            : prev.p1Entry - (prev.p1Entry - prev.p2Tp1) * 0.50;
          trailingStageStr = "💰 Защита 50%";
          trailingStageIdx = 2;
        } else if (bestExtreme >= distToTp1 * 0.70) {
          const bAtr = atrs[bi] || atrVal;
          activeTrailingSl = prev.isBull ? prev.p1Entry + bAtr * 0.15 : prev.p1Entry - bAtr * 0.15;
          trailingStageStr = "🔒 BE+0.15";
          trailingStageIdx = 1;
        }
      }

      const barsPassedAtBi = bi - anchorIdx;
      const slBrokenAtBi = prev.isBull ? cb.low <= prev.invalidLevelSl : cb.high >= prev.invalidLevelSl;
      // Trailing stop hit condition: only checks on candles AFTER TP1 was achieved
      const trailingHitAtBi =
        leg2Hit &&
        trailingStageIdx > 0 &&
        bi > (leg2Idx ?? anchorIdx) &&
        (prev.isBull ? cb.low <= activeTrailingSl : cb.high >= activeTrailingSl);
      
      // Missed entry: price reached TP1 or TP2 before limit entry was hit
      const isMissedEntryAtBi =
        !leg1Hit &&
        (prev.isBull
          ? cb.high >= prev.p2Tp1
          : cb.low <= prev.p2Tp1);
      if (isMissedEntryAtBi) {
        prev.isMissedEntry = true;
      }

      // Runaway without entry: price already achieved TP1 or broke SL before entry ever triggered
      const runawayWithoutEntry =
        !leg1Hit &&
        (prev.isBull
          ? cb.high >= prev.p2Tp1 || cb.low <= prev.invalidLevelSl
          : cb.low <= prev.p2Tp1 || cb.high >= prev.invalidLevelSl);
      const barsSinceTp1 = leg2Hit && typeof leg2Idx === "number" ? bi - leg2Idx : 0;

      if (
        slBrokenAtBi ||
        (leg3Hit && typeof leg3Idx === "number" && bi - leg3Idx >= 3) ||
        trailingHitAtBi ||
        runawayWithoutEntry ||
        (!leg1Hit && barsPassedAtBi >= entryWaitBars) ||
        (leg2Hit && !leg3Hit && barsSinceTp1 >= 28) ||
        barsPassedAtBi >= 45
      ) {
        expiredAtBar = bi;
        break;
      }
    }

    const barsPassed = targetEndIdx - anchorIdx;
    const isMissedEntry = Boolean(prev.isMissedEntry);
    const updatedForecast: ForecastState = {
      ...prev,
      startBar: anchorIdx,
      startLogical: anchorIdx,
      startTime: candles[anchorIdx]?.time ?? item.anchorCandleTime,
      startPrice: prev.startPrice,
      barsSinceStart: barsPassed,
      isLocked: true,
      isMissedEntry,
      statusReason: isMissedEntry
        ? `🚫 НЕДОХОД (MISSED ENTRY) - Тейк взят до активации лимита`
        : `Фиксирован (бар #${anchorIdx}, ${barsPassed} б. назад)`,
      leg1Hit,
      leg1Idx,
      leg1Time,
      leg2Hit,
      leg2Idx,
      leg2Time,
      leg3Hit,
      leg3Idx,
      leg3Time,
      activeTrailingSl: roundPriceForAsset(activeTrailingSl, close),
      trailingStageStr,
      trailingStageIdx
    };

    return { expiredAtBar, updatedForecast };
  };

  if (existingItem) {
    // If rendering temporary fallback candles before server response arrives, return cached forecast untouched
    if (isFallbackCandles) {
      finalForecast = existingItem.forecast;
    } else {
      const priceDiffRatio = Math.abs(existingItem.forecast.startPrice - close) / Math.max(0.0001, close);
      const anchorIdx = priceDiffRatio < 0.25 ? findCandleIndexByTime(candles, existingItem.anchorCandleTime, tfSec) : -1;

      if (anchorIdx >= 0) {
        const { expiredAtBar, updatedForecast } = evaluateSetupRange(existingItem, anchorIdx, n - 1);
        if (expiredAtBar === null) {
          finalForecast = updatedForecast;
          existingItem.forecast = updatedForecast;
          syncSetupToServer(cacheKey, existingItem);
        } else {
          completedAtBarIdx = expiredAtBar;
        }
      }
    }
  }

  // If no valid active setup in memory (or previous setup finished at `completedAtBarIdx`),
  // replay historical bars forward up to `n - 1` so the setup is anchored at the actual historical bar where it began!
  if (!finalForecast) {
    const defaultLookbackStart = Math.max(25, n - Math.min(36, Math.max(10, n - 25)));
    let walkBar = completedAtBarIdx !== undefined ? Math.min(n - 1, completedAtBarIdx) : defaultLookbackStart;
    let currentCandidate = createSetupAtBar(walkBar);

    while (walkBar < n - 1) {
      const { expiredAtBar, updatedForecast } = evaluateSetupRange(currentCandidate.item, walkBar, n - 1);
      if (expiredAtBar === null) {
        currentCandidate.forecast = updatedForecast;
        currentCandidate.item.forecast = updatedForecast;
        break;
      }
      walkBar = Math.min(n - 1, Math.max(walkBar + 1, expiredAtBar));
      currentCandidate = createSetupAtBar(walkBar);
    }

    finalForecast = currentCandidate.forecast;

    if (!isFallbackCandles) {
      anchoredForecastCache.set(cacheKey, currentCandidate.item);
      syncSetupToServer(cacheKey, currentCandidate.item);
    }
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

  // 2. GEX Regime (100% synchronized with Thermometer in GEX Analytics)
  let gexRegimeStr = `🟢 Положительная Гамма (выше Flip $${gex.gammaFlip}) — дилеры гасят движение`;
  let gexRegimeCol = "#10b981";
  if (close > gex.callWall) {
    gexRegimeStr = `🚀 Сквиз — пробили Потолок $${gex.callWall}, дилеры покупают → сильный рост`;
    gexRegimeCol = "#fbbf24";
  } else if (close < gex.putWall) {
    gexRegimeStr = `💥 Каскад — пробили Поддержку $${gex.putWall}, дилеры продают → лавина вниз`;
    gexRegimeCol = "#ef4444";
  } else if (close < gex.gammaFlip) {
    gexRegimeStr = `🔴 Отрицательная Гамма (ниже Flip $${gex.gammaFlip}) — дилеры усиливают тренд`;
    gexRegimeCol = "#ef4444";
  } else if (gex.isDumping) {
    gexRegimeStr = `🔴 Режим Шторм (Дамп к Flip $${gex.gammaFlip}) — дилеры хеджируются продажами`;
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
  if (close > gex.gammaFlip && fc.isBull && !gex.isDumping) {
    dayBiasStr = "🟢 Уклон LONG (Гамма↑ + Макро↑ — всё за рост)";
    dayBiasCol = "#fbbf24";
  } else if ((close < gex.gammaFlip || gex.isDumping) && !fc.isBull) {
    dayBiasStr = "🔴 Уклон SHORT (Гамма↓ + Макро↓ — всё за падение)";
    dayBiasCol = "#ef4444";
  } else if (close < gex.gammaFlip && fc.isBull) {
    dayBiasStr = "🟠 Осторожный LONG (Отскок против -GEX)";
    dayBiasCol = "#f59e0b";
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

  // 8. PCR & Vol (dynamic from actual GEX report)
  const pcrLabel = gex.pcrVal > 1.08 ? "путы↑" : gex.pcrVal < 0.92 ? "коллы↑" : "нейтр.";
  const rvIvLabel = gex.rvIvVal > 1.05 ? "высокая" : "норма";
  const pcrRvFull = `PCR ${gex.pcrVal.toFixed(2)} (${pcrLabel}) | Vol ${gex.rvIvVal.toFixed(2)} (${rvIvLabel})`;
  const pcrRvShort = `PCR ${gex.pcrVal.toFixed(2)} | Vol ${gex.rvIvVal.toFixed(2)}`;
  const pcrRvCol = "#f59e0b";

  // 9. Audit (100% synchronized with Hit Rate module in GEX Analytics)
  const cwTxt = (gex.audit.cwTouches ?? 0) > 0 ? `${gex.audit.cwRate}% (${gex.audit.cwBounces}/${gex.audit.cwTouches})` : "0 уд.";
  const pwTxt = (gex.audit.pwTouches ?? 0) > 0 ? `${gex.audit.pwRate}% (${gex.audit.pwBounces}/${gex.audit.pwTouches})` : "0 уд.";
  const flipTxt = (gex.audit.flipTouches ?? 0) > 0 ? `${gex.audit.flipRate}% (${gex.audit.flipBounces}/${gex.audit.flipTouches})` : "0 уд.";
  const auditStr = `🎯 CW ${cwTxt} | PW ${pwTxt} | Flip ${flipTxt} (всего уд: ${gex.audit.total})`;
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

// ============================================================================
// 🎯 QUANT GEX PROBABILITY ENGINE (ВЕРОЯТНОСТНЫЙ ДВИЖОК ПРОГНОЗА ЦЕНЫ)
// ============================================================================

export interface GexProbabilityEngineInput {
  spotPrice: number;
  callWall: number;
  putWall: number;
  zeroFlip: number;
  totalCallVolume: number;
  totalPutVolume: number;
  iv: number; // Implied Volatility (%)
  rv: number; // Realized Volatility (%)
  normalTotalVolume?: number; // Baseline normal volume for comparison
  maxPain?: number;
}

export interface GexProbabilityFactorBreakdown {
  label: string;
  impactText: string;
  bias: "LONG" | "SHORT" | "FLAT" | "SWEEP";
  points: number;
}

export interface GexProbabilityEngineOutput {
  probabilityLong: number;
  probabilityShort: number;
  probabilityFlat: number;
  recommendation: string;
  confidenceScore: number;
  // Additional rich diagnostics for the top-of-page visual forecast chart
  dominantScenario: "LONG" | "SHORT" | "FLAT";
  sweepRiskActive: boolean;
  sweepProbability: number;
  distToCallWallPts: number;
  distToPutWallPts: number;
  distToCallWallPct: number;
  distToPutWallPct: number;
  rawScores: {
    long: number;
    short: number;
    flat: number;
    sweepBonus: number;
  };
  factors: GexProbabilityFactorBreakdown[];
}

export function calculateGexProbabilityEngine(
  input: GexProbabilityEngineInput
): GexProbabilityEngineOutput {
  const {
    spotPrice,
    callWall,
    putWall,
    zeroFlip,
    totalCallVolume,
    totalPutVolume,
    iv,
    rv,
    normalTotalVolume = 35000,
    maxPain
  } = input;

  // 1. Базовая система баллов: 50 баллов за нейтральный рынок каждому вектору
  let scoreLong = 50;
  let scoreShort = 50;
  let scoreFlat = 50;
  let sweepBonus = 0;

  const factors: GexProbabilityFactorBreakdown[] = [];

  // 2. Положение Spot относительно Zero-Flip (+20 баллов)
  const isBelowFlip = spotPrice < zeroFlip;
  if (isBelowFlip) {
    // Spot < Zero Flip: +20 баллов к сценарию "Тренд" (SHORT bias / отрицательная гамма)
    scoreShort += 20;
    factors.push({
      label: `Spot ($${spotPrice.toFixed(1)}) < Zero-Flip ($${zeroFlip})`,
      impactText: "+20 баллов к Тренду вниз (SHORT bias, дилеры в -GEX продают по рынку)",
      bias: "SHORT",
      points: 20
    });
  } else {
    // Spot >= Zero Flip: +20 баллов к "Боковик/Отскок" (LONG bias / положительная гамма)
    scoreLong += 20;
    scoreFlat += 15;
    factors.push({
      label: `Spot ($${spotPrice.toFixed(1)}) > Zero-Flip ($${zeroFlip})`,
      impactText: "+20 баллов к Отскоку / Боковику (LONG bias, дилеры в +GEX выкупают проливы)",
      bias: "LONG",
      points: 20
    });
  }

  // 3. Расстояние до стен (Put Wall и Call Wall) в пунктах и процентах (до +30 баллов)
  const corridorRange = Math.max(1, callWall - putWall);
  const distToPutWallPts = Math.round((spotPrice - putWall) * 10) / 10;
  const distToCallWallPts = Math.round((callWall - spotPrice) * 10) / 10;
  const distToPutWallPct = Math.round(((spotPrice - putWall) / Math.max(1, spotPrice)) * 10000) / 100;
  const distToCallWallPct = Math.round(((callWall - spotPrice) / Math.max(1, spotPrice)) * 10000) / 100;

  // Нормализованная позиция внутри коридора [0 = на Put Wall, 1 = на Call Wall]
  const posInCorridor = Math.max(0, Math.min(1, (spotPrice - putWall) / corridorRange));

  if (posInCorridor <= 0.32) {
    // Чем ближе Spot к Put Wall, тем выше вероятность отскока вверх (+30 баллов к LONG)
    const proximityWeight = Math.max(0.45, 1 - posInCorridor / 0.35);
    const putBonus = Math.round(30 * proximityWeight);
    scoreLong += putBonus;
    factors.push({
      label: `Близость к поддержке Put Wall ($${putWall}, дист. $${Math.abs(distToPutWallPts).toFixed(1)} / ${Math.abs(distToPutWallPct).toFixed(2)}%)`,
      impactText: `+${putBonus} баллов к LONG (высокая плотность путов — зона алгоритмического отскока вверх)`,
      bias: "LONG",
      points: putBonus
    });
  } else if (posInCorridor >= 0.68) {
    // Чем ближе Spot к Call Wall, тем выше вероятность отката вниз (+30 баллов к SHORT)
    const proximityWeight = Math.max(0.45, (posInCorridor - 0.65) / 0.35);
    const callBonus = Math.round(30 * Math.min(1, proximityWeight));
    scoreShort += callBonus;
    factors.push({
      label: `Близость к потолку Call Wall ($${callWall}, дист. $${Math.abs(distToCallWallPts).toFixed(1)} / ${Math.abs(distToCallWallPct).toFixed(2)}%)`,
      impactText: `+${callBonus} баллов к SHORT (барьер хеджирования коллов — высокая вероятность отбоя вниз)`,
      bias: "SHORT",
      points: callBonus
    });
  } else {
    // Цена в середине коридора — усиление бокового сценария и притяжения к Max Pain
    const flatBonus = 22;
    scoreFlat += flatBonus;
    factors.push({
      label: `Баланс в центре коридора ($${putWall} – $${callWall})`,
      impactText: `+${flatBonus} балла к Боковику (равноудаленность от стен, тяга к Max Pain $${maxPain || Math.round((callWall + putWall) / 2)})`,
      bias: "FLAT",
      points: flatBonus
    });
  }

  // 4. Учет внутридневного объема (Total Call Volume + Total Put Volume) (+10 баллов к пробою ближайшего барьера)
  const totalVol = Math.max(0, totalCallVolume + totalPutVolume);
  const effectiveBaselineVol = Math.max(5000, normalTotalVolume);
  const isHighVolume = totalVol >= effectiveBaselineVol * 1.15 || Math.abs(totalCallVolume - totalPutVolume) / Math.max(1, totalVol) > 0.22;

  const closerToCallWall = Math.abs(callWall - spotPrice) <= Math.abs(spotPrice - putWall);
  if (isHighVolume) {
    if (closerToCallWall) {
      // Ближайший барьер — Call Wall: повышенный объем увеличивает шанс пробоя вверх (+10 к LONG)
      scoreLong += 10;
      factors.push({
        label: `Аномальный опционный Volume (${totalVol.toLocaleString()} контр.) у верхнего барьера`,
        impactText: `+10 баллов к пробою Call Wall вверх (давление потока на снос стопов за $${callWall})`,
        bias: "LONG",
        points: 10
      });
    } else {
      // Ближайший барьер — Put Wall: повышенный объем увеличивает шанс пробоя вниз (+10 к SHORT)
      scoreShort += 10;
      factors.push({
        label: `Аномальный опционный Volume (${totalVol.toLocaleString()} контр.) у нижнего барьера`,
        impactText: `+10 баллов к пробою Put Wall вниз (агрессивный поток усиливает тест $${putWall})`,
        bias: "SHORT",
        points: 10
      });
    }
  } else {
    scoreFlat += 8;
    factors.push({
      label: `Умеренный опционный Volume (${totalVol.toLocaleString()} контр.)`,
      impactText: `+8 баллов к удержанию границ без импульсного пробоя`,
      bias: "FLAT",
      points: 8
    });
  }

  // 5. Учет IV > RV (+10 баллов к сценарию "Пробой и ложный вынос / Liquidity Sweep")
  const ivRvSpread = Math.round((iv - rv) * 10) / 10;
  const sweepRiskActive = ivRvSpread >= 1.5;
  if (sweepRiskActive) {
    sweepBonus = 10;
    // При высоком IV > RV цена часто делает ложный прокол ближайшей стены (Sweep) и разворачивается обратно к центру
    if (closerToCallWall) {
      scoreShort += 10;
    } else {
      scoreLong += 10;
    }
    factors.push({
      label: `IV (${iv.toFixed(1)}%) > RV (${rv.toFixed(1)}%) на +${ivRvSpread.toFixed(1)}%`,
      impactText: `+10 баллов к сценарию «Пробой и ложный вынос (Liquidity Sweep)» за ближайшим уровнем`,
      bias: "SWEEP",
      points: 10
    });
  } else if (ivRvSpread <= -1.0) {
    // IV < RV: опционы дешевые, идет устойчивое трендовое движение
    if (isBelowFlip) scoreShort += 8;
    else scoreLong += 8;
    factors.push({
      label: `IV (${iv.toFixed(1)}%) < RV (${rv.toFixed(1)}%) (${ivRvSpread.toFixed(1)}%)`,
      impactText: `+8 баллов к продолжению чистого направленного движения без ложных запилов`,
      bias: isBelowFlip ? "SHORT" : "LONG",
      points: 8
    });
  }

  // 6. Нормализация баллов в проценты вероятности (сумма = 100%)
  const totalRaw = Math.max(1, scoreLong + scoreShort + scoreFlat);
  let probabilityLong = Math.round((scoreLong / totalRaw) * 100);
  let probabilityShort = Math.round((scoreShort / totalRaw) * 100);
  let probabilityFlat = 100 - probabilityLong - probabilityShort;

  if (probabilityFlat < 5) {
    const diff = 5 - probabilityFlat;
    probabilityFlat = 5;
    if (probabilityLong >= probabilityShort) probabilityLong -= diff;
    else probabilityShort -= diff;
  }

  // Определение доминирующего сценария и индекса уверенности (Confidence Score)
  const sortedProbs = [
    { type: "LONG" as const, val: probabilityLong },
    { type: "SHORT" as const, val: probabilityShort },
    { type: "FLAT" as const, val: probabilityFlat }
  ].sort((a, b) => b.val - a.val);

  const dominantScenario = sortedProbs[0].type;
  const spreadTopTwo = sortedProbs[0].val - sortedProbs[1].val;
  const confidenceScore = Math.max(54, Math.min(94, Math.round(58 + spreadTopTwo * 1.15 + (sweepRiskActive ? 4 : 0))));
  const sweepProbability = sweepRiskActive
    ? Math.min(82, Math.round(52 + ivRvSpread * 4.5 + (isHighVolume ? 10 : 0)))
    : Math.max(18, Math.round(25 + Math.max(0, ivRvSpread) * 4));

  // 7. Генерация понятного вердикта-рекомендации на русском языке
  const mpTarget = maxPain || Math.round((callWall + putWall) / 2);
  let recommendation = "";

  if (dominantScenario === "LONG") {
    if (posInCorridor <= 0.35) {
      recommendation = `Приоритет LONG (${probabilityLong}%): Цена находится в зоне притяжения поддержки Put Wall ($${putWall}) при ${
        isBelowFlip ? "контртрендовом отскоке" : "положительной гамме (+GEX)"
      }. Ожидается алгоритмический откуп маркетмейкерами с целью возврата к балансу $${mpTarget} и верхней границе $${callWall}.${
        sweepRiskActive
          ? ` Внимание: так как IV > RV (+${ivRvSpread.toFixed(1)}%), вероятен предварительный ложный закол (Sweep) под $${putWall} перед разворотом вверх.`
          : ""
      }`;
    } else {
      recommendation = `Приоритет LONG (${probabilityLong}%): Котировки удерживаются выше рубежа Zero-Flip ($${zeroFlip}) в режиме положительной гаммы (+GEX), а повышенный поток объемов поддерживает движение к потолку Call Wall ($${callWall}).${
        sweepRiskActive
          ? ` Учитывайте повышенную IV (${iv.toFixed(1)}%): при подходе к $${callWall} возможен ложный вынос стопов (Sweep) с последующим откатом.`
          : ""
      }`;
    }
  } else if (dominantScenario === "SHORT") {
    if (isBelowFlip) {
      recommendation = `Приоритет SHORT (${probabilityShort}%): Цена торгуется под границей Zero-Flip ($${zeroFlip}) в зоне отрицательной гаммы (-GEX). Дилеры хеджируют дельту продажами по тренду, ускоряя импульс вниз к поддержке Put Wall ($${putWall}).${
        sweepRiskActive
          ? ` Из-за превышения IV над RV (+${ivRvSpread.toFixed(1)}%) возможен резкий снос стопов (Sweep) под $${putWall}.`
          : ""
      }`;
    } else {
      recommendation = `Приоритет SHORT / Откат от потолка (${probabilityShort}%): Цена подошла вплотную к сопротивлению Call Wall ($${callWall}, дистанция $${Math.abs(distToCallWallPts).toFixed(1)}). Маркетмейкеры сдерживают рост продажами базового актива — ожидается откат к магниту Max Pain ($${mpTarget}).${
        sweepRiskActive
          ? ` Высокий спред IV > RV (+${ivRvSpread.toFixed(1)}%) указывает на риск ложного прокола (Sweep) чуть выше $${callWall} перед разворотом вниз.`
          : ""
      }`;
    }
  } else {
    recommendation = `Приоритет БОКОВИК / Возврат к среднему (${probabilityFlat}%): Цена сбалансирована выше Zero-Flip ($${zeroFlip}) в центральной части коридора $${putWall}–$${callWall}. Дилеры гасят волатильность, стягивая котировки к магниту экспирации Max Pain ($${mpTarget}). Оптимальна работа от границ диапазона.`;
  }

  return {
    probabilityLong,
    probabilityShort,
    probabilityFlat,
    recommendation,
    confidenceScore,
    dominantScenario,
    sweepRiskActive,
    sweepProbability,
    distToCallWallPts,
    distToPutWallPts,
    distToCallWallPct,
    distToPutWallPct,
    rawScores: {
      long: scoreLong,
      short: scoreShort,
      flat: scoreFlat,
      sweepBonus
    },
    factors
  };
}

