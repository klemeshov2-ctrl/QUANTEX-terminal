/**
 * ============================================================================
 * S&T PREMIUM ULTIMATE SUPER INDICATOR [S&T Premium v8 / Pine Script v6]
 * 1:1 PURE MATHEMATICAL & LOGICAL PORT TO TYPESCRIPT / JS / SERVER
 * ============================================================================
 * Every function, formula, and rule below directly mirrors SuperIndicator_v6.txt
 */

import type { GexMarketReport } from "../../server/gexEngine";
import { getExpirySuffix } from "./gexLabels";

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
  type?: "LT" | "IT" | "ST";
  pivotIndex?: number;
  pivotTime?: number;
  confirmIndex?: number;
  confirmTime?: number;
  volume?: number;
  delta?: number;
  isMitigated?: boolean;
  mitigatedIndex?: number;
  mitigatedTime?: number;
}

export function formatSrZoneLabel(
  type: "LT" | "IT" | "ST",
  isSup: boolean,
  level: number,
  volume?: number,
  isMitigated?: boolean
): string {
  const role = isSup ? "Подд." : "Сопр.";
  const mitSuffix = isMitigated ? " (снят)" : "";
  const priceStr = level.toFixed(1);
  if (volume !== undefined && volume > 0) {
    const volStr = (volume / 1000).toFixed(1) + "K";
    return `Liq ${type}${mitSuffix} [${volStr} | ${priceStr}] ${role}`;
  }
  return `Liq ${type}${mitSuffix} [${priceStr}] ${role}`;
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
  windowSec: number = 86400,
  asset: string = "XAUUSD"
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

  // Dynamic touch tolerance buffer (Tolerance Buffer) strictly bound to live ATR-14 and explicit asset type (no price range hardcoding)
  let touchTol: number;
  let breakTol: number;

  const normAsset = (asset || "XAUUSD").toUpperCase();
  const isGoldUsd =
    normAsset.includes("XAU") ||
    normAsset === "MOEX_GOLD" ||
    normAsset === "MOEX_MINI" ||
    normAsset === "GD" ||
    normAsset === "GN" ||
    normAsset.includes("PAXG");
  const isBtc = normAsset.includes("BTC");
  const isMoexHighNominal = normAsset.includes("SI") || normAsset.includes("RI") || normAsset.includes("RTS") || normAsset.includes("GLDRUB");

  if (isGoldUsd) {
    // Gold (XAUUSD / MOEX GD / GN): 0.55x ATR14
    touchTol = Math.round(Math.max(1.8, Math.min(11.5, atr14 * 0.55)) * 10) / 10;
    breakTol = Math.round(touchTol * 1.45 * 10) / 10;
  } else if (isBtc || isMoexHighNominal) {
    // BTC / MOEX Si / MOEX RTS: 0.55x ATR14
    touchTol = Math.round(Math.max(levelPrice * 0.0008, Math.min(levelPrice * 0.006, atr14 * 0.55)));
    breakTol = Math.round(touchTol * 1.45);
  } else {
    // ETH, SOL, XRP, MOEX BR, MOEX NG: 0.55x ATR14
    touchTol = Math.round(Math.max(levelPrice * 0.0007, Math.min(levelPrice * 0.0045, atr14 * 0.55)) * 1000) / 1000;
    breakTol = Math.round(touchTol * 1.45 * 1000) / 1000;
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

export type SetupLifecycleStatus =
  | "PENDING"
  | "ACTIVE"
  | "SCALP"
  | "NO_SETUP"
  | "EXPIRED"
  | "WIN_TP1"
  | "WIN_TP2"
  | "LOSS_SL"
  | "MISSED_ENTRY";

export type SetupExpirationReason =
  | "regimeFlip"
  | "slBroken"
  | "structuralReversal"
  | "missedEntry"
  | "timeout"
  | "counterTrendTp"
  | "tp2Hit"
  | "trailingHit"
  | "drift";

export interface ForecastState {
  isBull: boolean;
  probability: number;
  startBar: number;
  startTime?: number;
  startLogical?: number;
  barsSinceStart?: number;
  isLocked?: boolean;
  status?: SetupLifecycleStatus;
  setupMode?: "FULL_LADDER" | "SCALP" | "NO_SETUP" | "BREAKOUT";
  hasValidSetup?: boolean;
  isScalpMode?: boolean;
  hideTp1Line?: boolean;
  hideTp2Line?: boolean;
  isBreakoutSetup?: boolean;
  tp2ExtendedByBos?: boolean;
  atrVal?: number;
  rrTp1?: number;
  rrTp2?: number;
  entrySourceTag?: string;
  tp1SourceTag?: string;
  tp2SourceTag?: string;
  tp3SourceTag?: string;
  slSourceTag?: string;
  isExpired?: boolean;
  expirationReason?: SetupExpirationReason;
  reason?: string;
  statusReason?: string;
  isMissedEntry?: boolean;
  counterTrend?: boolean;
  lockRole?: string; // "ТРЕНД" | "ОТКАТ (контртренд, уменьшенный размер)" | "СКАЛЬП (цель = потолок отката, размер 1/2)"
  trendAlignmentBadge?: string; // "🌊 ОТКАТ в тренде 1D/4H (SHORT)" | "🏛️ ПО ТРЕНДУ 1D"
  parentTrendTf?: string;
  parentTrendDirection?: "LONG" | "SHORT";
  parentEntryPrice?: number;
  isUnderThreat?: boolean;
  maeBadge?: string;
  maeRecommendation?: string;
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
  trendAlignmentBadge?: string;
  consensus5Str?: string;
  isCounterTrend?: boolean;
  lockRole?: string;
  isUnderThreat?: boolean;
  maeBadge?: string;
  maeRecommendation?: string;
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
  fib382?: number;
  fib618?: number;
  fib786?: number;
  fib1618?: number;
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
  mathVersion?: number;
}

const CURRENT_FORECAST_MATH_VERSION = 4;
// Zero client-side persistent caching: memory-only cache populated exclusively from server
const anchoredForecastCache = new Map<string, AnchoredForecastItem>();
const lastSyncedSignatureMap = new Map<string, string>();

if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("quantex_anchored_forecasts_v4");
  } catch {}
}

/**
 * Строгая валидация сетапа при гидратации (hydrateSetupsFromServer / localStorage):
 * Отбрасывает сетап, если любое из полей p1Entry/p2Tp1/p3Tp2/activeTrailingSl не isFinite,
 * или p2Tp1 <= 0, или |p2Tp1 - p3Tp2| < 0.01, или R:R < 1.0.
 */
export function isValidAnchoredSetup(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  const fc = item.forecast ?? item;
  if (!fc || typeof fc !== "object") return false;
  if (fc.status === "NO_SETUP" || fc.hasValidSetup === false) return false;

  const p1Entry = Number(fc.p1Entry);
  const p2Tp1 = Number(fc.p2Tp1);
  const p3Tp2 = Number(fc.p3Tp2);
  const activeTrailingSl = Number(fc.activeTrailingSl);

  if (
    !Number.isFinite(p1Entry) ||
    !Number.isFinite(p2Tp1) ||
    !Number.isFinite(p3Tp2) ||
    !Number.isFinite(activeTrailingSl)
  ) {
    return false;
  }

  if (p2Tp1 <= 0 || p1Entry <= 0 || p3Tp2 <= 0 || activeTrailingSl <= 0) {
    return false;
  }

  if (Math.abs(p2Tp1 - p3Tp2) < 0.01) {
    return false;
  }

  const baseSl =
    Number.isFinite(Number(fc.invalidLevelSl)) && Number(fc.invalidLevelSl) > 0
      ? Number(fc.invalidLevelSl)
      : activeTrailingSl;
  const risk = Math.abs(p1Entry - baseSl);
  const rew1 = Math.abs(p2Tp1 - p1Entry);
  const calcRr1 = risk > 0 ? rew1 / risk : 0;
  const rr1 = fc.rrTp1 !== undefined && fc.rrTp1 !== null ? Number(fc.rrTp1) : calcRr1;

  if (!Number.isFinite(rr1) || rr1 < 1.0 || calcRr1 < 1.0 - 1e-6) {
    return false;
  }

  return true;
}

export function getAnchoredForecastCache(): Map<string, AnchoredForecastItem> {
  return anchoredForecastCache;
}

export function setAnchoredForecastCacheItem(key: string, item: AnchoredForecastItem): void {
  anchoredForecastCache.set(key, item);
}

function deleteCorruptedSetupFromStorage(key: string): void {
  anchoredForecastCache.delete(key);
  lastSyncedSignatureMap.delete(key);
  if (typeof window !== "undefined" && typeof fetch === "function") {
    fetch(`/api/indicator/setups?key=${encodeURIComponent(key)}&t=${Date.now()}`, {
      method: "DELETE",
      cache: "no-store"
    }).catch(() => {});
  }
}

function syncSetupToServer(key: string, item: AnchoredForecastItem): void {
  if (!isValidAnchoredSetup(item)) {
    deleteCorruptedSetupFromStorage(key);
    return;
  }
  if (typeof window === "undefined") return;
  const fc = item.forecast;
  const sig = `v${CURRENT_FORECAST_MATH_VERSION}_${item.anchorCandleTime}_${fc.p1Entry}_${fc.p2Tp1}_${fc.p3Tp2}_${fc.leg1Hit}_${fc.leg2Hit}_${fc.leg3Hit}_${fc.trailingStageIdx}_${fc.isPlanBActive}`;
  if (lastSyncedSignatureMap.get(key) === sig) return;
  lastSyncedSignatureMap.set(key, sig);

  fetch(`/api/indicator/setups?t=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ key, item })
  }).catch(() => {});
}

// 2. Asynchronous hydration directly from Server (memory-only state, zero localStorage)
export async function hydrateSetupsFromServer(injectedSetups?: Record<string, any>): Promise<boolean> {
  try {
    let setupsMap: Record<string, any> | null = null;
    if (injectedSetups && typeof injectedSetups === "object") {
      setupsMap = injectedSetups;
    } else if (typeof window !== "undefined" && typeof fetch === "function") {
      const res = await fetch(`/api/indicator/setups?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.setups && typeof data.setups === "object") {
        setupsMap = data.setups;
      }
    } else {
      return false;
    }

    if (setupsMap && typeof setupsMap === "object") {
      let updated = false;
      for (const [k, val] of Object.entries(setupsMap)) {
        const serverItem = val as AnchoredForecastItem;
        if (
          !serverItem ||
          !serverItem.forecast ||
          typeof serverItem.anchorCandleTime !== "number" ||
          (serverItem.mathVersion !== undefined && serverItem.mathVersion !== CURRENT_FORECAST_MATH_VERSION) ||
          !isValidAnchoredSetup(serverItem)
        ) {
          // Битые записи удаляем из хранилища, а не усыновляем
          delete setupsMap[k];
          deleteCorruptedSetupFromStorage(k);
          continue;
        }
        // State is directly overwritten by server response
        anchoredForecastCache.set(k, {
          ...serverItem,
          mathVersion: CURRENT_FORECAST_MATH_VERSION
        });
        updated = true;
      }

      // Purge any corrupted entries sitting in anchoredForecastCache
      for (const [cacheKey, cacheVal] of Array.from(anchoredForecastCache.entries())) {
        if (!isValidAnchoredSetup(cacheVal)) {
          deleteCorruptedSetupFromStorage(cacheKey);
        }
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
    if (typeof window !== "undefined") {
      fetch(`/api/indicator/setups?key=${encodeURIComponent(key)}&t=${Date.now()}`, { method: "DELETE", cache: "no-store" }).catch(() => {});
    }
  } else if (symbol) {
    for (const key of Array.from(anchoredForecastCache.keys())) {
      if (key.startsWith(`${symbol}_`)) {
        anchoredForecastCache.delete(key);
        lastSyncedSignatureMap.delete(key);
      }
    }
    if (typeof window !== "undefined") {
      fetch(`/api/indicator/setups?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`, { method: "DELETE", cache: "no-store" }).catch(() => {});
    }
  } else {
    anchoredForecastCache.clear();
    lastSyncedSignatureMap.clear();
    if (typeof window !== "undefined") {
      fetch(`/api/indicator/setups?t=${Date.now()}`, { method: "DELETE", cache: "no-store" }).catch(() => {});
    }
  }
}

export interface Honest5TfConsensusResult {
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  summaryText: string;
  dominantDirection: "LONG" | "SHORT" | "NEUTRAL";
  htfTrendDirection: "LONG" | "SHORT" | "NEUTRAL";
  tf1dDir: "LONG" | "SHORT" | "NEUTRAL";
  tf4hDir: "LONG" | "SHORT" | "NEUTRAL";
  details: string[];
}

/**
 * Honest 5-TF Consensus calculator (ported from server.ts computeHonest5TfConsensus).
 * Accepts optional explicit multiTfMetrics map or inspects active anchored locks for `symbol`
 * across 1d, 4h, 1h, 30m, 15m.
 */
export function computeHonest5TfConsensus(
  multiTfMetrics?: Record<string, any> | null,
  symbol?: string
): Honest5TfConsensusResult {
  const tfs = ["1d", "4h", "1h", "30m", "15m"];
  let bullCount = 0;
  let bearCount = 0;
  let neutralCount = 0;
  const details: string[] = [];
  const dirByTf: Record<string, "LONG" | "SHORT" | "NEUTRAL"> = {
    "1d": "NEUTRAL",
    "4h": "NEUTRAL",
    "1h": "NEUTRAL",
    "30m": "NEUTRAL",
    "15m": "NEUTRAL"
  };

  for (const tf of tfs) {
    const m = multiTfMetrics?.[tf] || multiTfMetrics?.[tf.toUpperCase()];
    if (m && typeof m.trend === "string") {
      const tUpper = m.trend.toUpperCase();
      if (tUpper.includes("BULL") || tUpper.includes("LONG") || tUpper.includes("БЫЧ")) {
        bullCount++;
        dirByTf[tf] = "LONG";
        details.push(`${tf.toUpperCase()}: БЫЧИЙ`);
      } else if (tUpper.includes("BEAR") || tUpper.includes("SHORT") || tUpper.includes("МЕДВ")) {
        bearCount++;
        dirByTf[tf] = "SHORT";
        details.push(`${tf.toUpperCase()}: МЕДВЕЖИЙ`);
      } else {
        neutralCount++;
        dirByTf[tf] = "NEUTRAL";
        details.push(`${tf.toUpperCase()}: НЕЙТРАЛЬНО`);
      }
      continue;
    }

    if (symbol) {
      const cached =
        anchoredForecastCache.get(`${symbol}_${tf}`) ||
        anchoredForecastCache.get(`${symbol}_${tf.toUpperCase()}`);
      if (cached && cached.forecast && cached.forecast.status !== "EXPIRED" && !cached.forecast.isExpired) {
        if (cached.forecast.isBull) {
          bullCount++;
          dirByTf[tf] = "LONG";
          details.push(`${tf.toUpperCase()}: БЫЧИЙ`);
        } else {
          bearCount++;
          dirByTf[tf] = "SHORT";
          details.push(`${tf.toUpperCase()}: МЕДВЕЖИЙ`);
        }
        continue;
      }
    }

    neutralCount++;
    dirByTf[tf] = "NEUTRAL";
    details.push(`${tf.toUpperCase()}: НЕТ ДАННЫХ`);
  }

  let htfTrendDirection: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  if (dirByTf["1d"] !== "NEUTRAL") {
    htfTrendDirection = dirByTf["1d"];
  } else if (dirByTf["4h"] !== "NEUTRAL") {
    htfTrendDirection = dirByTf["4h"];
  } else if (bullCount > bearCount) {
    htfTrendDirection = "LONG";
  } else if (bearCount > bullCount) {
    htfTrendDirection = "SHORT";
  }

  const dominantDirection: "LONG" | "SHORT" | "NEUTRAL" =
    bullCount > bearCount ? "LONG" : bearCount > bullCount ? "SHORT" : htfTrendDirection;

  let summaryText = "";
  if (bullCount >= 4) {
    summaryText = `${bullCount} из 5 ТФ за LONG (${bearCount} за SHORT) — сильный бычий консенсус`;
  } else if (bearCount >= 4) {
    summaryText = `${bearCount} из 5 ТФ за SHORT (${bullCount} за LONG) — сильный медвежий консенсус`;
  } else if (bullCount > bearCount) {
    summaryText = `${bullCount} из 5 ТФ за LONG против ${bearCount} за SHORT — умеренный перевес покупателей`;
  } else if (bearCount > bullCount) {
    summaryText = `${bearCount} из 5 ТФ за SHORT против ${bullCount} за LONG — умеренный перевес продавцов (Разнобой ТФ)`;
  } else {
    summaryText = `${bullCount} за LONG / ${bearCount} за SHORT — баланс (флэт / конфликт ТФ)`;
  }

  return {
    bullCount,
    bearCount,
    neutralCount,
    summaryText,
    dominantDirection,
    htfTrendDirection,
    tf1dDir: dirByTf["1d"],
    tf4hDir: dirByTf["4h"],
    details
  };
}

/**
 * Computes the chart & HUD trend alignment badge using 5-TF consensus and opposing lock arbitration.
 */
export function resolveTrendAlignmentBadge(
  fc: ForecastState,
  tf: string,
  consensus: Honest5TfConsensusResult
): string {
  const lockDir: "LONG" | "SHORT" = fc.isBull ? "LONG" : "SHORT";
  const htfCandidate = fc.parentTrendDirection || consensus.htfTrendDirection;
  const isCounter = fc.counterTrend || (htfCandidate !== "NEUTRAL" && htfCandidate !== lockDir);

  if (isCounter) {
    const oppDir = htfCandidate && htfCandidate !== "NEUTRAL" && htfCandidate !== lockDir
      ? htfCandidate
      : (fc.isBull ? "SHORT" : "LONG");
    return `🌊 ОТКАТ в тренде 1D/4H (${oppDir})`;
  }
  return `🏛️ ПО ТРЕНДУ 1D`;
}

/**
 * MAE-Guard for losing locks:
 * If floating loss exceeds 1.25 × risk (|price - entry| > 1.25 * |entry - SL|)
 * AND price is within 0.3 ATR of SL (|price - SL| <= 0.3 * ATR),
 * marks setup with "⚠️ ПОД УГРОЗОЙ" and recommends closing manually or tightening stop.
 */
export function evaluateMaeGuard(
  fc: ForecastState,
  currentPrice: number,
  atrVal: number
): { isUnderThreat: boolean; maeBadge?: string; maeRecommendation?: string } {
  const risk = Math.max(0.0001, Math.abs(fc.p1Entry - fc.invalidLevelSl));
  const floatingLoss = fc.isBull ? fc.p1Entry - currentPrice : currentPrice - fc.p1Entry;
  const distToSl = Math.abs(currentPrice - fc.invalidLevelSl);
  const safeAtr = Math.max(0.0001, atrVal);

  const isUnderThreat =
    floatingLoss > 1.25 * risk &&
    distToSl <= 0.3 * safeAtr;

  if (isUnderThreat) {
    return {
      isUnderThreat: true,
      maeBadge: "⚠️ ПОД УГРОЗОЙ",
      maeRecommendation: "⚠️ ПОД УГРОЗОЙ — закрыть вручную или ужать стоп"
    };
  }
  return { isUnderThreat: false };
}

/**
 * 3. СТОП-ПУЛ КОНФЛИКТ:
 * Запрещает SL внутри ±0.3*ATR от Magnet/PW/CW/Flip — выносит за пул с буфером 0.15*ATR
 * (на дистанцию > 0.3*ATR от центра пула в сторону от точки входа).
 */
export function resolveStopPoolConflict(
  rawSl: number,
  entry: number,
  isBull: boolean,
  atrVal: number,
  pools: Array<{ price: number; name: string }>
): { sl: number; slSourceTag: string; displacedByPool?: string } {
  const safeAtr = Math.max(0.0001, atrVal);
  const conflictRadius = 0.3 * safeAtr;
  // Зона пула (~0.16 ATR) + буфер 0.15 ATR = 0.31 ATR от уровня пула (строго за пределами ±0.3*ATR)
  const displaceDist = (0.16 + 0.15) * safeAtr;
  let sl = rawSl;
  let displacedByPool: string | undefined = undefined;

  const validPools = (pools || []).filter((p) => p && Number.isFinite(p.price) && p.price > 0);
  validPools.sort((a, b) => (isBull ? b.price - a.price : a.price - b.price));

  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const pool of validPools) {
      if (Math.abs(sl - pool.price) <= conflictRadius + 1e-6) {
        if (isBull) {
          // Для LONG стоп ниже входа: выносим вниз за пул
          const candidate = pool.price - displaceDist;
          if (candidate < sl || Math.abs(sl - pool.price) <= conflictRadius + 1e-6) {
            sl = Math.min(sl, candidate);
            displacedByPool = `${pool.name} ${roundPriceForAsset(pool.price, entry)}`;
            changed = true;
          }
        } else {
          // Для SHORT стоп выше входа: выносим вверх за пул
          const candidate = pool.price + displaceDist;
          if (candidate > sl || Math.abs(sl - pool.price) <= conflictRadius + 1e-6) {
            sl = Math.max(sl, candidate);
            displacedByPool = `${pool.name} ${roundPriceForAsset(pool.price, entry)}`;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }

  sl = roundPriceForAsset(sl, entry);
  for (const pool of validPools) {
    if (Math.abs(sl - pool.price) <= conflictRadius) {
      const nudge = entry < 10 ? 0.0002 : 0.02;
      sl = isBull
        ? roundPriceForAsset(pool.price - conflictRadius - nudge, entry)
        : roundPriceForAsset(pool.price + conflictRadius + nudge, entry);
      displacedByPool = `${pool.name} ${roundPriceForAsset(pool.price, entry)}`;
    }
  }

  const slSourceTag = displacedByPool
    ? `[за пулом: ${displacedByPool} +0.15 ATR]`
    : isBull
    ? `[структура: Swing Low -0.12 ATR]`
    : `[структура: Swing High +0.12 ATR]`;

  return { sl, slSourceTag, displacedByPool };
}

export interface NestedLadderInput {
  entry: number;
  rawSl: number;
  isBull: boolean;
  atrOwn: number;
  tfSec: number;
  counterTrend?: boolean;
  entryHtf?: number;
  atrHtf?: number;
  parentTrendTf?: string;
  gexPools?: {
    maxPain?: number;
    putWall?: number;
    callWall?: number;
    gammaFlip?: number;
    sleeperMagnet?: number;
    expectedMove68?: { low: number; high: number };
  };
  structureLevels?: Array<{ price: number; name: string }>;
  entrySourceTag?: string;
  rawTp1?: number;
  rawTp2?: number;
  rawTp3?: number;
}

export interface NestedLadderResult {
  p1Entry: number;
  invalidLevelSl: number;
  p2Tp1: number;
  p3Tp2: number;
  p5Tp3: number;
  rrTp1: number;
  rrTp2: number;
  status: SetupLifecycleStatus;
  setupMode: "FULL_LADDER" | "SCALP" | "NO_SETUP";
  hasValidSetup: boolean;
  isScalpMode: boolean;
  hideTp1Line: boolean;
  hideTp2Line: boolean;
  lockRole: string;
  statusReason: string;
  entrySourceTag: string;
  tp1SourceTag: string;
  tp2SourceTag: string;
  tp3SourceTag: string;
  slSourceTag: string;
}

/**
 * 1, 2, 3, 4(а), 5: Модель "Вложенная лестница" (Nested Ladder) + Гейты R:R после снапинга + Стоп-пул конфликт + Теги ролей.
 */
export function computeNestedLadderSetup(input: NestedLadderInput): NestedLadderResult {
  const {
    entry: rawEntry,
    rawSl,
    isBull,
    atrOwn: rawAtrOwn,
    tfSec,
    counterTrend = false,
    entryHtf,
    atrHtf,
    parentTrendTf = "1D",
    gexPools,
    structureLevels = [],
    entrySourceTag: passedEntryTag
  } = input;

  const atrOwn = Math.max(0.0001, rawAtrOwn);
  const entry = roundPriceForAsset(rawEntry, rawEntry);

  // 1. Стоп-пул конфликт: выносим SL за пределы ±0.3*ATR от Magnet/PW/CW/Flip с буфером 0.15*ATR
  const slPools: Array<{ price: number; name: string }> = [];
  if (gexPools?.maxPain && gexPools.maxPain > 0) slPools.push({ price: gexPools.maxPain, name: "Магнит" });
  if (gexPools?.putWall && gexPools.putWall > 0) slPools.push({ price: gexPools.putWall, name: "PW" });
  if (gexPools?.callWall && gexPools.callWall > 0) slPools.push({ price: gexPools.callWall, name: "CW" });
  if (gexPools?.gammaFlip && gexPools.gammaFlip > 0) slPools.push({ price: gexPools.gammaFlip, name: "Flip" });

  const { sl, slSourceTag } = resolveStopPoolConflict(rawSl, entry, isBull, atrOwn, slPools);
  const risk = Math.max(0.0001, isBull ? entry - sl : sl - entry);

  const entrySourceTag =
    passedEntryTag ||
    (isBull ? `[структура: OB/FVG ${entry}]` : `[структура: OB/FVG ${entry}]`);

  let tp1: number;
  let tp2: number;
  let tp3: number;
  let tp1SourceTag: string;
  let tp2SourceTag: string;
  let tp3SourceTag = `[runner: трейл ATR]`;

  const isHtf = tfSec >= 14400; // 4H / 1D и выше

  if (counterTrend && typeof entryHtf === "number" && entryHtf > 0) {
    // КОНТРТРЕНДОВЫЙ ИНТРАДЕЙ (ОТКАТ):
    // TP2 <= entryHTF - 0.2*ATR_HTF (для лонга) / TP2 >= entryHTF + 0.2*ATR_HTF (для шорта)
    // TP1 = ближайшая своя структура ниже TP2; |TP2 - TP1| >= 0.4*ATR_own
    const effAtrHtf = Math.max(1.35, atrOwn * 1.3, atrHtf && atrHtf > 0 ? atrHtf : atrOwn * 2.0);
    const htfBuffer = Math.max(0.26, 0.2 * effAtrHtf);
    const htfName = (parentTrendTf || "1D").toUpperCase();

    if (isBull) {
      const ceiling = roundPriceForAsset(entryHtf - htfBuffer, entry);
      const rawCandTp2 = input.rawTp2 && input.rawTp2 > entry ? Math.min(input.rawTp2, ceiling) : ceiling;
      tp2 = roundPriceForAsset(Math.min(ceiling, rawCandTp2), entry);
      tp2SourceTag = `[потолок: вход ${htfName}]`;

      // Ищем ближайшую свою структуру ниже TP2 с зазором >= 0.4*ATR_own
      const maxTp1Allowed = tp2 - 0.4 * atrOwn;
      const validStructs = structureLevels
        .filter((s) => Number.isFinite(s.price) && s.price > entry && s.price <= maxTp1Allowed + 1e-6)
        .sort((a, b) => b.price - a.price); // ближайшая снизу к TP2

      const rrQualifyingStructs = validStructs.filter((s) => (s.price - entry) / risk >= 1.2 - 1e-6);
      const chosenStruct = rrQualifyingStructs[0] || validStructs[0];

      if (chosenStruct) {
        tp1 = roundPriceForAsset(Math.min(chosenStruct.price, maxTp1Allowed), entry);
        tp1SourceTag = `[структура: ${chosenStruct.name} ${tp1}]`;
      } else {
        // Собственная структура (Liq IT / EQ) с соблюдением TP2 - TP1 >= 0.4 * ATR_own
        const targetTp1 = Math.min(maxTp1Allowed, Math.max(entry + 1.25 * risk, tp2 - 0.45 * atrOwn));
        tp1 = roundPriceForAsset(targetTp1, entry);
        if (tp2 - tp1 < 0.4 * atrOwn) {
          tp1 = roundPriceForAsset(tp2 - 0.4 * atrOwn, entry);
        }
        tp1SourceTag = `[структура: Liq IT ${tp1}]`;
      }

      tp3 = roundPriceForAsset(ceiling, entry);
      tp3SourceTag = `[потолок: вход ${htfName}]`;
    } else {
      const floor = roundPriceForAsset(entryHtf + htfBuffer, entry);
      const rawCandTp2 = input.rawTp2 && input.rawTp2 < entry ? Math.max(input.rawTp2, floor) : floor;
      tp2 = roundPriceForAsset(Math.max(floor, rawCandTp2), entry);
      tp2SourceTag = `[потолок: вход ${htfName}]`;

      const minTp1Allowed = tp2 + 0.4 * atrOwn;
      const validStructs = structureLevels
        .filter((s) => Number.isFinite(s.price) && s.price < entry && s.price >= minTp1Allowed - 1e-6)
        .sort((a, b) => a.price - b.price); // ближайшая сверху к TP2

      const rrQualifyingStructs = validStructs.filter((s) => (entry - s.price) / risk >= 1.2 - 1e-6);
      const chosenStruct = rrQualifyingStructs[0] || validStructs[0];

      if (chosenStruct) {
        tp1 = roundPriceForAsset(Math.max(chosenStruct.price, minTp1Allowed), entry);
        tp1SourceTag = `[структура: ${chosenStruct.name} ${tp1}]`;
      } else {
        const targetTp1 = Math.max(minTp1Allowed, Math.min(entry - 1.25 * risk, tp2 + 0.45 * atrOwn));
        tp1 = roundPriceForAsset(targetTp1, entry);
        if (tp1 - tp2 < 0.4 * atrOwn) {
          tp1 = roundPriceForAsset(tp2 + 0.4 * atrOwn, entry);
        }
        tp1SourceTag = `[структура: Liq IT ${tp1}]`;
      }

      tp3 = roundPriceForAsset(floor, entry);
      tp3SourceTag = `[потолок: вход ${htfName}]`;
    }
  } else {
    // ТРЕНДОВЫЙ ТФ:
    // TP1 = ближайший пул (Magnet/PW для шорта, Magnet/CW для лонга) в пределах 1.8*ATR_own (у 1D/4H всегда на ближайшем пуле);
    // TP2 = следующий пул <= 3.2*ATR_own;
    // TP3 = runner за TP2 с трейл-правилом.
    if (isBull) {
      const primaryPools: Array<{ price: number; name: string }> = [];
      if (gexPools?.maxPain && gexPools.maxPain > entry) {
        primaryPools.push({ price: roundPriceForAsset(gexPools.maxPain, entry), name: "Магнит" });
      }
      if (gexPools?.callWall && gexPools.callWall > entry) {
        primaryPools.push({ price: roundPriceForAsset(gexPools.callWall, entry), name: "CW" });
      }
      primaryPools.sort((a, b) => a.price - b.price);

      const allPools: Array<{ price: number; name: string; isStruct?: boolean }> = [...primaryPools];
      if (gexPools?.sleeperMagnet && gexPools.sleeperMagnet > entry) {
        allPools.push({ price: roundPriceForAsset(gexPools.sleeperMagnet, entry), name: "Магнит" });
      }
      if (gexPools?.expectedMove68?.high && gexPools.expectedMove68.high > entry) {
        allPools.push({ price: roundPriceForAsset(gexPools.expectedMove68.high, entry), name: "EM68" });
      }
      for (const s of structureLevels) {
        if (Number.isFinite(s.price) && s.price > entry) {
          allPools.push({ price: roundPriceForAsset(s.price, entry), name: s.name, isStruct: true });
        }
      }
      allPools.sort((a, b) => a.price - b.price);

      // Deduplicate pools closer than 0.25*ATR
      const uniquePools: Array<{ price: number; name: string; isStruct?: boolean }> = [];
      for (const p of allPools) {
        if (uniquePools.length === 0 || Math.abs(p.price - uniquePools[uniquePools.length - 1].price) >= 0.25 * atrOwn) {
          uniquePools.push(p);
        }
      }

      const maxTp1Dist = isHtf ? Infinity : 1.8 * atrOwn;
      const maxTp2Dist = isHtf ? Infinity : 3.2 * atrOwn;

      // Для 1D/4H TP1 всегда на ближайшем пуле (Magnet или CW)
      const p1Cand = isHtf
        ? (primaryPools[0] || uniquePools[0])
        : (primaryPools.find((p) => p.price - entry <= maxTp1Dist && (p.price - entry) / risk >= 1.2) ||
           uniquePools.find((p) => p.price - entry <= maxTp1Dist && (p.price - entry) / risk >= 1.2));

      if (p1Cand) {
        tp1 = p1Cand.price;
        tp1SourceTag = (p1Cand as any).isStruct
          ? `[структура: ${p1Cand.name} ${tp1}]`
          : `[пул: ${p1Cand.name} ${tp1}]`;
      } else if (input.rawTp1 && input.rawTp1 > entry && input.rawTp1 - entry <= 1.8 * atrOwn) {
        tp1 = roundPriceForAsset(input.rawTp1, entry);
        tp1SourceTag = `[структура: Liq IT ${tp1}]`;
      } else {
        tp1 = roundPriceForAsset(entry + Math.min(1.8 * atrOwn, Math.max(1.25 * risk, 1.3 * atrOwn)), entry);
        tp1SourceTag = `[пул: Магнит ${tp1}]`;
      }

      // TP2 = следующий пул > TP1 (с зазором >= 0.35*ATR и <= 3.2*ATR_own)
      const p2Cand =
        primaryPools.find((p) => p.price >= tp1 + 0.35 * atrOwn && p.price - entry <= maxTp2Dist) ||
        uniquePools.find((p) => p.price >= tp1 + 0.35 * atrOwn && p.price - entry <= maxTp2Dist && (isHtf || (p.price - entry) / risk >= 2.0));

      if (p2Cand) {
        tp2 = p2Cand.price;
        tp2SourceTag = (p2Cand as any).isStruct
          ? `[структура: ${p2Cand.name} ${tp2}]`
          : `[пул: ${p2Cand.name} ${tp2}]`;
      } else if (input.rawTp2 && input.rawTp2 >= tp1 + 0.35 * atrOwn && input.rawTp2 - entry <= 3.2 * atrOwn) {
        tp2 = roundPriceForAsset(input.rawTp2, entry);
        tp2SourceTag = `[пул: CW ${tp2}]`;
      } else {
        tp2 = roundPriceForAsset(
          Math.min(entry + 3.2 * atrOwn, Math.max(tp1 + 0.85 * atrOwn, entry + 2.15 * risk)),
          entry
        );
        tp2SourceTag = `[пул: CW ${tp2}]`;
      }

      if (tp2 - tp1 < 0.35 * atrOwn) {
        tp2 = roundPriceForAsset(tp1 + 0.45 * atrOwn, entry);
      }

      tp3 = roundPriceForAsset(tp2 + Math.max(1.0 * atrOwn, 0.85 * risk), entry);
    } else {
      // SHORT на трендовом ТФ
      const primaryPools: Array<{ price: number; name: string }> = [];
      if (gexPools?.maxPain && gexPools.maxPain < entry) {
        primaryPools.push({ price: roundPriceForAsset(gexPools.maxPain, entry), name: "Магнит" });
      }
      if (gexPools?.putWall && gexPools.putWall < entry) {
        primaryPools.push({ price: roundPriceForAsset(gexPools.putWall, entry), name: "PW" });
      }
      primaryPools.sort((a, b) => b.price - a.price); // ближайший снизу к entry идёт первым

      const allPools: Array<{ price: number; name: string; isStruct?: boolean }> = [...primaryPools];
      if (gexPools?.sleeperMagnet && gexPools.sleeperMagnet < entry) {
        allPools.push({ price: roundPriceForAsset(gexPools.sleeperMagnet, entry), name: "Магнит" });
      }
      if (gexPools?.expectedMove68?.low && gexPools.expectedMove68.low < entry) {
        allPools.push({ price: roundPriceForAsset(gexPools.expectedMove68.low, entry), name: "EM68" });
      }
      for (const s of structureLevels) {
        if (Number.isFinite(s.price) && s.price < entry) {
          allPools.push({ price: roundPriceForAsset(s.price, entry), name: s.name, isStruct: true });
        }
      }
      allPools.sort((a, b) => b.price - a.price);

      const uniquePools: Array<{ price: number; name: string; isStruct?: boolean }> = [];
      for (const p of allPools) {
        if (uniquePools.length === 0 || Math.abs(p.price - uniquePools[uniquePools.length - 1].price) >= 0.25 * atrOwn) {
          uniquePools.push(p);
        }
      }

      const maxTp1Dist = isHtf ? Infinity : 1.8 * atrOwn;
      const maxTp2Dist = isHtf ? Infinity : 3.2 * atrOwn;

      // Для 1D/4H шорт: TP1 всегда на ближайшем пуле (Magnet или PW)
      const p1Cand = isHtf
        ? (primaryPools[0] || uniquePools[0])
        : (primaryPools.find((p) => entry - p.price <= maxTp1Dist && (entry - p.price) / risk >= 1.2) ||
           uniquePools.find((p) => entry - p.price <= maxTp1Dist && (entry - p.price) / risk >= 1.2));

      if (p1Cand) {
        tp1 = p1Cand.price;
        tp1SourceTag = (p1Cand as any).isStruct
          ? `[структура: ${p1Cand.name} ${tp1}]`
          : `[пул: ${p1Cand.name} ${tp1}]`;
      } else if (input.rawTp1 && input.rawTp1 < entry && entry - input.rawTp1 <= 1.8 * atrOwn) {
        tp1 = roundPriceForAsset(input.rawTp1, entry);
        tp1SourceTag = `[структура: Liq IT ${tp1}]`;
      } else {
        tp1 = roundPriceForAsset(entry - Math.min(1.8 * atrOwn, Math.max(1.25 * risk, 1.3 * atrOwn)), entry);
        tp1SourceTag = `[пул: Магнит ${tp1}]`;
      }

      // TP2 = следующий пул < TP1
      const p2Cand =
        primaryPools.find((p) => p.price <= tp1 - 0.35 * atrOwn && entry - p.price <= maxTp2Dist) ||
        uniquePools.find((p) => p.price <= tp1 - 0.35 * atrOwn && entry - p.price <= maxTp2Dist && (isHtf || (entry - p.price) / risk >= 2.0));

      if (p2Cand) {
        tp2 = p2Cand.price;
        tp2SourceTag = (p2Cand as any).isStruct
          ? `[структура: ${p2Cand.name} ${tp2}]`
          : `[пул: ${p2Cand.name} ${tp2}]`;
      } else if (input.rawTp2 && input.rawTp2 <= tp1 - 0.35 * atrOwn && entry - input.rawTp2 <= 3.2 * atrOwn) {
        tp2 = roundPriceForAsset(input.rawTp2, entry);
        tp2SourceTag = `[пул: PW ${tp2}]`;
      } else {
        tp2 = roundPriceForAsset(
          Math.max(entry - 3.2 * atrOwn, Math.min(tp1 - 0.85 * atrOwn, entry - 2.15 * risk)),
          entry
        );
        tp2SourceTag = `[пул: PW ${tp2}]`;
      }

      if (tp1 - tp2 < 0.35 * atrOwn) {
        tp2 = roundPriceForAsset(tp1 - 0.45 * atrOwn, entry);
      }

      tp3 = roundPriceForAsset(tp2 - Math.max(1.0 * atrOwn, 0.85 * risk), entry);
    }
  }

  // Жёсткий инвариант: TP1 == TP2 невозможен ни на одном ТФ (мин. зазор >= 0.3*ATR_own, для контртренда >= 0.4*ATR_own)
  const minGap = counterTrend ? 0.4 * atrOwn : 0.32 * atrOwn;
  if (isBull) {
    if (tp2 - tp1 < minGap) {
      if (counterTrend) {
        tp1 = roundPriceForAsset(tp2 - minGap, entry);
      } else {
        tp2 = roundPriceForAsset(tp1 + minGap, entry);
      }
    }
  } else {
    if (tp1 - tp2 < minGap) {
      if (counterTrend) {
        tp1 = roundPriceForAsset(tp2 + minGap, entry);
      } else {
        tp2 = roundPriceForAsset(tp1 - minGap, entry);
      }
    }
  }

  // 2. ГЕЙТЫ ПОСЛЕ СНАПИНГА:
  // если |TP2 - TP1| < 0.3*ATR_own ИЛИ R:R(TP1) < 1.2 ИЛИ R:R(TP2) < 2.0 —
  // не рисуем полную лесенку: статус "СКАЛЬП (цель = потолок отката, размер 1/2)" или NO_SETUP.
  // Линии с R:R < 1 запрещены.
  const rew1 = isBull ? tp1 - entry : entry - tp1;
  const rew2 = isBull ? tp2 - entry : entry - tp2;
  const rrTp1 = Math.round((rew1 / risk) * 100) / 100;
  const rrTp2 = Math.round((rew2 / risk) * 100) / 100;
  const actualGap = isBull ? tp2 - tp1 : tp1 - tp2;

  const passesFullLadder =
    actualGap >= 0.3 * atrOwn - 1e-6 &&
    rrTp1 >= 1.2 - 1e-6 &&
    rrTp2 >= 2.0 - 1e-6;

  let status: SetupLifecycleStatus = "PENDING";
  let setupMode: "FULL_LADDER" | "SCALP" | "NO_SETUP" = "FULL_LADDER";
  let hasValidSetup = true;
  let isScalpMode = false;
  let hideTp1Line = false;
  let hideTp2Line = false;
  let lockRole = counterTrend ? "ОТКАТ (контртренд, уменьшенный размер)" : "ТРЕНД";
  let statusReason = counterTrend
    ? "ОТКАТ (контртренд, уменьшенный размер)"
    : "ТРЕНД (полная вложенная лестница)";

  if (!passesFullLadder) {
    if (rrTp2 < 1.0 && rrTp1 < 1.0) {
      status = "NO_SETUP";
      setupMode = "NO_SETUP";
      hasValidSetup = false;
      hideTp1Line = true;
      hideTp2Line = true;
      lockRole = "NO_SETUP";
      statusReason = "NO_SETUP (R:R < 1.0 — линии с R:R < 1 запрещены)";
    } else {
      status = "SCALP";
      setupMode = "SCALP";
      isScalpMode = true;
      hideTp2Line = true;
      if (rrTp1 < 1.0) {
        hideTp1Line = true;
      }
      lockRole = "СКАЛЬП (цель = потолок отката, размер 1/2)";
      statusReason = "СКАЛЬП (цель = потолок отката, размер 1/2)";
    }
  }

  return {
    p1Entry: entry,
    invalidLevelSl: sl,
    p2Tp1: tp1,
    p3Tp2: tp2,
    p5Tp3: tp3,
    rrTp1,
    rrTp2,
    status,
    setupMode,
    hasValidSetup,
    isScalpMode,
    hideTp1Line,
    hideTp2Line,
    lockRole,
    statusReason,
    entrySourceTag,
    tp1SourceTag,
    tp2SourceTag,
    tp3SourceTag,
    slSourceTag
  };
}

/**
 * Register or update an anchored forecast item in the active locks registry and run opposing-lock arbitration.
 */
export function registerActiveLock(symbol: string, tf: string, item: AnchoredForecastItem): ForecastState {
  const normTf = tf.toLowerCase();
  const key = `${symbol}_${normTf}`;
  item.key = key;
  anchoredForecastCache.set(key, item);
  arbitrateOpposingLocksForAsset(symbol);
  return anchoredForecastCache.get(key)?.forecast || item.forecast;
}

export function getActiveLocksForAsset(symbol: string): Array<{ tf: string; tfSec: number; item: AnchoredForecastItem }> {
  const prefix = `${symbol}_`;
  const list: Array<{ tf: string; tfSec: number; item: AnchoredForecastItem }> = [];
  for (const [k, item] of anchoredForecastCache.entries()) {
    if (!k.startsWith(prefix)) continue;
    const tf = k.slice(prefix.length).toLowerCase();
    const fc = item.forecast;
    if (!fc || fc.status === "EXPIRED" || fc.isExpired) continue;
    list.push({ tf, tfSec: tfToSeconds(tf), item });
  }
  list.sort((a, b) => b.tfSec - a.tfSec);
  return list;
}

/**
 * Arbitrates opposing locks across timeframes for the same asset using the Nested Ladder model:
 * - Senior TF (1D/4H, higher tfSec) is marked "ТРЕНД" (counterTrend: false).
 * - Junior TF (1H and below, lower tfSec) with opposite direction !D is marked
 *   "ОТКАТ (контртренд, уменьшенный размер)" (counterTrend: true), its TP2 is bounded by
 *   entryHTF - 0.2*ATR_HTF (for LONG) / entryHTF + 0.2*ATR_HTF (for SHORT), and TP1 is placed at its own
 *   structure with |TP2 - TP1| >= 0.4*ATR_own (TP1 == TP2 is strictly impossible).
 */
export function arbitrateOpposingLocksForAsset(symbol: string): void {
  const activeLocks = getActiveLocksForAsset(symbol);
  if (activeLocks.length === 0) return;

  const consensus = computeHonest5TfConsensus(null, symbol);
  const senior = activeLocks[0];
  const seniorFc = senior.item.forecast;

  const hasOpposing = activeLocks.some((l) => l.item.forecast.isBull !== seniorFc.isBull);

  if (hasOpposing) {
    seniorFc.counterTrend = false;
    seniorFc.lockRole = "ТРЕНД";
    seniorFc.trendAlignmentBadge = "🏛️ ПО ТРЕНДУ 1D";
    if (!seniorFc.status || seniorFc.status === "PENDING" || seniorFc.status === "ACTIVE") {
      seniorFc.status = seniorFc.leg1Hit ? "ACTIVE" : "PENDING";
    }
  } else {
    seniorFc.counterTrend = false;
    if (!seniorFc.isScalpMode && seniorFc.status !== "NO_SETUP") {
      seniorFc.lockRole = "ТРЕНД";
    }
    seniorFc.trendAlignmentBadge = resolveTrendAlignmentBadge(seniorFc, senior.tf, consensus);
  }

  for (let i = 1; i < activeLocks.length; i++) {
    const cur = activeLocks[i];
    const curFc = cur.item.forecast;

    const opposingSenior = activeLocks
      .slice(0, i)
      .find((higher) => higher.item.forecast.isBull !== curFc.isBull);

    if (!opposingSenior) {
      curFc.counterTrend = false;
      if (!curFc.isScalpMode && curFc.status !== "NO_SETUP") {
        curFc.lockRole = "ТРЕНД";
      }
      curFc.trendAlignmentBadge = resolveTrendAlignmentBadge(curFc, cur.tf, consensus);
      continue;
    }

    const oppFc = opposingSenior.item.forecast;
    const oppDir: "LONG" | "SHORT" = oppFc.isBull ? "LONG" : "SHORT";
    const atrOwn = Math.max(0.5, curFc.atrVal || Math.abs(curFc.p1Entry - curFc.invalidLevelSl) / 0.72 || 5);
    const atrHtf = Math.max(1.5, oppFc.atrVal || Math.abs(oppFc.p1Entry - oppFc.invalidLevelSl) / 0.72 || atrOwn * 2);

    curFc.counterTrend = true;
    curFc.parentTrendTf = opposingSenior.tf.toUpperCase();
    curFc.parentTrendDirection = oppDir;
    curFc.parentEntryPrice = oppFc.p1Entry;
    curFc.trendAlignmentBadge = `🌊 ОТКАТ в тренде 1D/4H (${oppDir})`;

    // Recalculate TP1 / TP2 via Nested Ladder constraints (TP2 <= entryHTF - 0.2*ATR_HTF, TP2 - TP1 >= 0.4*ATR_own)
    const ladder = computeNestedLadderSetup({
      entry: curFc.p1Entry,
      rawSl: curFc.invalidLevelSl,
      isBull: curFc.isBull,
      atrOwn,
      tfSec: cur.tfSec,
      counterTrend: true,
      entryHtf: oppFc.p1Entry,
      atrHtf,
      parentTrendTf: opposingSenior.tf.toUpperCase(),
      rawTp1: curFc.p2Tp1,
      rawTp2: curFc.p3Tp2,
      rawTp3: curFc.p5Tp3,
      entrySourceTag: curFc.entrySourceTag
    });

    curFc.p2Tp1 = ladder.p2Tp1;
    curFc.p3Tp2 = ladder.p3Tp2;
    curFc.p5Tp3 = ladder.p5Tp3;
    curFc.rrTp1 = ladder.rrTp1;
    curFc.rrTp2 = ladder.rrTp2;
    curFc.tp1SourceTag = ladder.tp1SourceTag;
    curFc.tp2SourceTag = ladder.tp2SourceTag;
    curFc.tp3SourceTag = ladder.tp3SourceTag;
    curFc.slSourceTag = curFc.slSourceTag || ladder.slSourceTag;
    curFc.setupMode = ladder.setupMode;
    curFc.hasValidSetup = ladder.hasValidSetup;
    curFc.isScalpMode = ladder.isScalpMode;
    curFc.hideTp1Line = ladder.hideTp1Line;
    curFc.hideTp2Line = ladder.hideTp2Line;
    curFc.lockRole = ladder.isScalpMode ? ladder.lockRole : "ОТКАТ (контртренд, уменьшенный размер)";
    if (ladder.status === "NO_SETUP" || ladder.status === "SCALP") {
      curFc.status = ladder.status;
      curFc.statusReason = ladder.statusReason;
    }

    // If BOTH locks have "ВХОД ВЗЯТ" (leg1Hit === true) and directions are opposite:
    // Junior lock expires at its ceiling TP2 (while preserving TP1 < TP2 invariant).
    if (oppFc.leg1Hit && curFc.leg1Hit) {
      curFc.leg2Hit = true;
      curFc.status = "EXPIRED";
      curFc.isExpired = true;
      curFc.expirationReason = "counterTrendTp";
      curFc.reason = `Потолок отката у входа старшего лока (${oppFc.p1Entry})`;
      curFc.statusReason = `⏳ Истёк: ОТКАТ закрыт у потолка входа ${opposingSenior.tf.toUpperCase()} (${curFc.p3Tp2})`;
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

export function f_round_step(pr: number, atrV?: number): number {
  if (pr >= 50000) return atrV && atrV < 350 ? 250.0 : 1000.0;
  if (pr >= 10000) return atrV && atrV < 120 ? 100.0 : 500.0;
  if (pr >= 1000) {
    if (atrV && atrV > 0) {
      if (atrV <= 6.5) return 10.0;
      if (atrV <= 22.0) return 25.0;
      if (atrV <= 45.0) return 50.0;
      return 100.0;
    }
    return pr >= 2000 ? 50.0 : 25.0;
  }
  if (pr >= 100) return 5.0;
  if (pr >= 10) return 1.0;
  if (pr >= 1) return 0.1;
  return 0.01;
}

export function f_avoid_round(price: number, isLong: boolean, atrV: number, mintick = 0.01): number {
  const step = f_round_step(price, atrV);
  if (step <= 0) return price;
  const nr = Math.round(price / step) * step;
  const dist = Math.abs(price - nr);
  const zone = atrV * 0.18;
  if (dist >= zone) return price;

  const sh = Math.max(atrV * 0.08, mintick * 5);
  let result = price;
  if (isLong) {
    // For Long TP: if price lands near or slightly past round resistance nr, take profit slightly before it (nr - sh)
    if (price >= nr - sh && price <= nr + zone) {
      result = nr - sh;
    }
  } else {
    // For Short TP: if price lands near or slightly past round support nr, take profit slightly before it (nr + sh)
    if (price <= nr + sh && price >= nr - zone) {
      result = nr + sh;
    }
  }
  return result;
}

export function f_avoid_round_sl(price: number, isLong: boolean, atrV: number, mintick = 0.01): number {
  const step = f_round_step(price, atrV);
  if (step <= 0) return price;
  const nr = Math.round(price / step) * step;
  const dist = Math.abs(price - nr);
  const zone = atrV * 0.15;
  if (dist >= zone) return price;

  const sh = Math.max(atrV * 0.08, mintick * 5);
  let result = price;
  if (isLong) {
    // Long SL (below entry): only push slightly below round support (nr - sh) if price is sitting on or just above nr
    if (price >= nr - sh && price <= nr + zone) {
      result = nr - sh;
    }
  } else {
    // Short SL (above entry): only push slightly above round resistance (nr + sh) if price is sitting on or just below nr
    if (price <= nr + sh && price >= nr - zone) {
      result = nr + sh;
    }
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
// 2.5. PINE S&R ZONES ENGINE (Liq LT 35, Liq IT 15, Liq ST 5)
// Tracks confirmed unmitigated pivots and frozen coordinates across bars
// ============================================================================

export function computePineSrZones(
  candles: Candle[],
  highs: number[],
  lows: number[],
  atrVal: number,
  deltaCurrent?: number[]
): SrZone[] {
  const n = candles.length;
  if (n < 10) return [];

  const effectiveAtr = atrVal > 0 ? atrVal : Math.max(1, (candles[n - 1].high - candles[n - 1].low) || 5);
  const srHalfH = Math.max(effectiveAtr * 0.08, 0.4);
  const activeRes: SrZone[] = [];
  const activeSup: SrZone[] = [];
  const maxBoxes = 5;

  const mergeOrPush = (arr: SrZone[], zone: SrZone) => {
    for (let i = 0; i < arr.length; i++) {
      const ex = arr[i];
      if (ex.type === zone.type && Math.abs(ex.level - zone.level) < effectiveAtr * 0.5) {
        ex.top = Math.max(ex.top, zone.top);
        ex.bottom = Math.min(ex.bottom, zone.bottom);
        ex.level = (ex.top + ex.bottom) / 2.0;
        ex.label = zone.label;
        ex.volume = zone.volume;
        ex.pivotIndex = zone.pivotIndex;
        ex.pivotTime = zone.pivotTime;
        ex.confirmIndex = zone.confirmIndex;
        ex.confirmTime = zone.confirmTime;
        return;
      }
    }
    arr.push(zone);
    if (arr.length > maxBoxes) {
      arr.shift();
    }
  };

  // Bar-by-bar progression across candles up to closedCount (n - 1)
  const closedCount = n - 1;

  for (let b = 10; b <= closedCount; b++) {
    // 1. Check mitigation on bar b
    const curH = candles[b].high;
    const curL = candles[b].low;

    for (let r = activeRes.length - 1; r >= 0; r--) {
      if (curH > activeRes[r].top) {
        activeRes[r].isMitigated = true;
        activeRes[r].mitigatedIndex = b;
        activeRes[r].mitigatedTime = candles[b].time;
        activeRes.splice(r, 1);
      }
    }
    for (let s = activeSup.length - 1; s >= 0; s--) {
      if (curL < activeSup[s].bottom) {
        activeSup[s].isMitigated = true;
        activeSup[s].mitigatedIndex = b;
        activeSup[s].mitigatedTime = candles[b].time;
        activeSup.splice(s, 1);
      }
    }

    // 2. Pivot confirmation on closed bars (b < closedCount)
    if (b < closedCount) {
      // LT (35, 35)
      const phLt = findPivotHigh(highs, b, 35, 35);
      if (phLt !== null) {
        const pIdx = b - 35;
        const vol = candles[pIdx]?.volume || 0;
        const dVal = deltaCurrent ? deltaCurrent[pIdx] : undefined;
        mergeOrPush(activeRes, {
          isSup: false,
          level: phLt,
          top: phLt + srHalfH,
          bottom: phLt - srHalfH,
          offset: 35,
          label: formatSrZoneLabel("LT", false, phLt, vol),
          isLt: true,
          type: "LT",
          pivotIndex: pIdx,
          pivotTime: candles[pIdx].time,
          confirmIndex: b,
          confirmTime: candles[b].time,
          volume: vol,
          delta: dVal,
          isMitigated: false
        });
      }

      const plLt = findPivotLow(lows, b, 35, 35);
      if (plLt !== null) {
        const pIdx = b - 35;
        const vol = candles[pIdx]?.volume || 0;
        const dVal = deltaCurrent ? deltaCurrent[pIdx] : undefined;
        mergeOrPush(activeSup, {
          isSup: true,
          level: plLt,
          top: plLt + srHalfH,
          bottom: plLt - srHalfH,
          offset: 35,
          label: formatSrZoneLabel("LT", true, plLt, vol),
          isLt: true,
          type: "LT",
          pivotIndex: pIdx,
          pivotTime: candles[pIdx].time,
          confirmIndex: b,
          confirmTime: candles[b].time,
          volume: vol,
          delta: dVal,
          isMitigated: false
        });
      }

      // IT (15, 15)
      const phIt = findPivotHigh(highs, b, 15, 15);
      if (phIt !== null) {
        const pIdx = b - 15;
        const vol = candles[pIdx]?.volume || 0;
        const dVal = deltaCurrent ? deltaCurrent[pIdx] : undefined;
        mergeOrPush(activeRes, {
          isSup: false,
          level: phIt,
          top: phIt + srHalfH,
          bottom: phIt - srHalfH,
          offset: 15,
          label: formatSrZoneLabel("IT", false, phIt, vol),
          isLt: false,
          type: "IT",
          pivotIndex: pIdx,
          pivotTime: candles[pIdx].time,
          confirmIndex: b,
          confirmTime: candles[b].time,
          volume: vol,
          delta: dVal,
          isMitigated: false
        });
      }

      const plIt = findPivotLow(lows, b, 15, 15);
      if (plIt !== null) {
        const pIdx = b - 15;
        const vol = candles[pIdx]?.volume || 0;
        const dVal = deltaCurrent ? deltaCurrent[pIdx] : undefined;
        mergeOrPush(activeSup, {
          isSup: true,
          level: plIt,
          top: plIt + srHalfH,
          bottom: plIt - srHalfH,
          offset: 15,
          label: formatSrZoneLabel("IT", true, plIt, vol),
          isLt: false,
          type: "IT",
          pivotIndex: pIdx,
          pivotTime: candles[pIdx].time,
          confirmIndex: b,
          confirmTime: candles[b].time,
          volume: vol,
          delta: dVal,
          isMitigated: false
        });
      }

      // ST (5, 5)
      const phSt = findPivotHigh(highs, b, 5, 5);
      if (phSt !== null) {
        const pIdx = b - 5;
        const vol = candles[pIdx]?.volume || 0;
        mergeOrPush(activeRes, {
          isSup: false,
          level: phSt,
          top: phSt + srHalfH,
          bottom: phSt - srHalfH,
          offset: 5,
          label: formatSrZoneLabel("ST", false, phSt, vol),
          isLt: false,
          type: "ST",
          pivotIndex: pIdx,
          pivotTime: candles[pIdx].time,
          confirmIndex: b,
          confirmTime: candles[b].time,
          volume: vol,
          isMitigated: false
        });
      }

      const plSt = findPivotLow(lows, b, 5, 5);
      if (plSt !== null) {
        const pIdx = b - 5;
        const vol = candles[pIdx]?.volume || 0;
        mergeOrPush(activeSup, {
          isSup: true,
          level: plSt,
          top: plSt + srHalfH,
          bottom: plSt - srHalfH,
          offset: 5,
          label: formatSrZoneLabel("ST", true, plSt, vol),
          isLt: false,
          type: "ST",
          pivotIndex: pIdx,
          pivotTime: candles[pIdx].time,
          confirmIndex: b,
          confirmTime: candles[b].time,
          volume: vol,
          isMitigated: false
        });
      }
    }
  }

  // Fallback for short histories or if no LT zone confirmed in history:
  // Take closed candles closed.slice(-40) (excluding forming bar closedCount = n - 1)
  const hasLtRes = activeRes.some(z => z.type === "LT");
  const hasLtSup = activeSup.some(z => z.type === "LT");

  if (!hasLtRes && n >= 15) {
    const lookback = Math.min(40, closedCount);
    let maxIdx = closedCount - lookback;
    let maxH = highs[maxIdx];
    for (let k = maxIdx + 1; k < closedCount; k++) {
      if (highs[k] >= maxH) {
        maxH = highs[k];
        maxIdx = k;
      }
    }
    const top = maxH + srHalfH;
    const isMit = candles.slice(maxIdx + 1).some(c => c.high > top);
    if (!isMit) {
      const vol = candles[maxIdx]?.volume || 0;
      activeRes.push({
        isSup: false,
        level: maxH,
        top,
        bottom: maxH - srHalfH,
        offset: closedCount - maxIdx,
        label: formatSrZoneLabel("LT", false, maxH, vol),
        isLt: true,
        type: "LT",
        pivotIndex: maxIdx,
        pivotTime: candles[maxIdx].time,
        confirmIndex: maxIdx + 1,
        confirmTime: candles[Math.min(maxIdx + 1, closedCount)].time,
        volume: vol,
        isMitigated: false
      });
    }
  }

  if (!hasLtSup && n >= 15) {
    const lookback = Math.min(40, closedCount);
    let minIdx = closedCount - lookback;
    let minL = lows[minIdx];
    for (let k = minIdx + 1; k < closedCount; k++) {
      if (lows[k] <= minL) {
        minL = lows[k];
        minIdx = k;
      }
    }
    const bottom = minL - srHalfH;
    const isMit = candles.slice(minIdx + 1).some(c => c.low < bottom);
    if (!isMit) {
      const vol = candles[minIdx]?.volume || 0;
      activeSup.push({
        isSup: true,
        level: minL,
        top: minL + srHalfH,
        bottom,
        offset: closedCount - minIdx,
        label: formatSrZoneLabel("LT", true, minL, vol),
        isLt: true,
        type: "LT",
        pivotIndex: minIdx,
        pivotTime: candles[minIdx].time,
        confirmIndex: minIdx + 1,
        confirmTime: candles[Math.min(minIdx + 1, closedCount)].time,
        volume: vol,
        isMitigated: false
      });
    }
  }

  const hasItRes = activeRes.some(z => z.type === "IT");
  const hasItSup = activeSup.some(z => z.type === "IT");

  if (!hasItRes && n >= 12) {
    const lookback = Math.min(18, closedCount);
    let maxIdx = closedCount - lookback;
    let maxH = highs[maxIdx];
    for (let k = maxIdx + 1; k < closedCount; k++) {
      if (highs[k] >= maxH) {
        maxH = highs[k];
        maxIdx = k;
      }
    }
    const top = maxH + srHalfH;
    const isMit = candles.slice(maxIdx + 1).some(c => c.high > top);
    if (!isMit) {
      const vol = candles[maxIdx]?.volume || 0;
      activeRes.push({
        isSup: false,
        level: maxH,
        top,
        bottom: maxH - srHalfH,
        offset: closedCount - maxIdx,
        label: formatSrZoneLabel("IT", false, maxH, vol),
        isLt: false,
        type: "IT",
        pivotIndex: maxIdx,
        pivotTime: candles[maxIdx].time,
        confirmIndex: maxIdx + 1,
        confirmTime: candles[Math.min(maxIdx + 1, closedCount)].time,
        volume: vol,
        isMitigated: false
      });
    }
  }

  if (!hasItSup && n >= 12) {
    const lookback = Math.min(18, closedCount);
    let minIdx = closedCount - lookback;
    let minL = lows[minIdx];
    for (let k = minIdx + 1; k < closedCount; k++) {
      if (lows[k] <= minL) {
        minL = lows[k];
        minIdx = k;
      }
    }
    const bottom = minL - srHalfH;
    const isMit = candles.slice(minIdx + 1).some(c => c.low < bottom);
    if (!isMit) {
      const vol = candles[minIdx]?.volume || 0;
      activeSup.push({
        isSup: true,
        level: minL,
        top: minL + srHalfH,
        bottom,
        offset: closedCount - minIdx,
        label: formatSrZoneLabel("IT", true, minL, vol),
        isLt: false,
        type: "IT",
        pivotIndex: minIdx,
        pivotTime: candles[minIdx].time,
        confirmIndex: minIdx + 1,
        confirmTime: candles[Math.min(minIdx + 1, closedCount)].time,
        volume: vol,
        isMitigated: false
      });
    }
  }

  return [...activeRes, ...activeSup];
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
    multiTfMetrics?: Record<string, any> | null;
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
  let trendState = closes[0] >= (ema200[0] || closes[0]) ? "bullish" : "bearish";
  const trendStateByBar: string[] = new Array(n).fill(trendState);
  let lastShVal: number | null = null;
  let lastSlVal: number | null = null;
  let lastShBar: number | null = null;
  let lastSlBar: number | null = null;
  let isBos = false;
  let isChoch = false;
  let isBullishBreak = false;
  let breakPrice: number | null = null;
  let bosBarIndex: number | null = null;

  for (let i = 0; i < Math.min(p.it, n); i++) {
    trendStateByBar[i] = closes[i] >= (ema200[i] || closes[i]) ? "bullish" : "bearish";
    trendState = trendStateByBar[i];
  }

  // 3. SMC Structure & Non-Repainting ZigZag/Fractal History
  // Historical pivots confirmed at index <= n - 1 - p.it are strictly locked to prevent historical repainting.
  // Dynamic recalculation is enabled only for the active live bar (n - 1).
  const confirmedWavePivots: Array<{ index: number; price: number; type: "HIGH" | "LOW"; time: number }> = [];

  for (let i = p.it; i < n; i++) {
    const isLiveBar = i === n - 1;
    const ph = findPivotHigh(highs, i, p.it, p.it);
    const pl = findPivotLow(lows, i, p.it, p.it);
    if (ph !== null) {
      lastShVal = ph;
      lastShBar = i - p.it;
      if (!isLiveBar) {
        confirmedWavePivots.push({
          index: lastShBar,
          price: ph,
          type: "HIGH",
          time: candles[lastShBar]?.time || 0
        });
      }
    }
    if (pl !== null) {
      lastSlVal = pl;
      lastSlBar = i - p.it;
      if (!isLiveBar) {
        confirmedWavePivots.push({
          index: lastSlBar,
          price: pl,
          type: "LOW",
          time: candles[lastSlBar]?.time || 0
        });
      }
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
    trendStateByBar[i] = trendState;
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

  // 4. S&R Zones (Liq ST 5, Liq IT 15, Liq LT 35) matching Pine scriptSuper.txt
  const srZones: SrZone[] = computePineSrZones(candles, highs, lows, atrVal, deltas);

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

  // 6. Fib / OTE Calculations: Anchor strictly to structural impulse origin indices
  let highestHigh: number;
  let lowestLow: number;
  const isBull = trendState === "bullish";

  if (isBull && typeof lastSlBar === "number" && lastSlBar >= 0) {
    const endBar = typeof lastShBar === "number" && lastShBar > lastSlBar ? lastShBar : n - 1;
    const sub = candles.slice(lastSlBar, endBar + 1);
    lowestLow = lastSlVal !== null ? lastSlVal : Math.min(...sub.map(c => c.low));
    highestHigh = Math.max(...sub.map(c => c.high));
  } else if (!isBull && typeof lastShBar === "number" && lastShBar >= 0) {
    const endBar = typeof lastSlBar === "number" && lastSlBar > lastShBar ? lastSlBar : n - 1;
    const sub = candles.slice(lastShBar, endBar + 1);
    highestHigh = lastShVal !== null ? lastShVal : Math.max(...sub.map(c => c.high));
    lowestLow = Math.min(...sub.map(c => c.low));
  } else {
    const recentFib = candles.slice(-p.fib);
    highestHigh = Math.max(...recentFib.map(c => c.high));
    lowestLow = Math.min(...recentFib.map(c => c.low));
  }

  const swingRange = Math.max(highestHigh - lowestLow, 0.0001);
  const fib382 = isBull ? highestHigh - swingRange * 0.382 : lowestLow + swingRange * 0.382;
  const fib500 = lowestLow + swingRange * 0.500;
  const fib618 = isBull ? highestHigh - swingRange * 0.618 : lowestLow + swingRange * 0.618;
  const fib786 = isBull ? highestHigh - swingRange * 0.786 : lowestLow + swingRange * 0.786;
  const fib1618 = isBull ? highestHigh + swingRange * 0.618 : lowestLow - swingRange * 0.618;

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
  const cwAudit = auditSingleGexLevel(candles, callWall, "RESISTANCE", 86400, symbol);
  const pwAudit = auditSingleGexLevel(candles, putWall, "SUPPORT", 86400, symbol);
  const flipAudit = auditSingleGexLevel(candles, gammaFlip, "FLIP", 86400, symbol);
  const painAudit = auditSingleGexLevel(candles, maxPain, "MAGNET", 86400, symbol);
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

  // 8. Forecast Wave (Вход, TP1, TP2, TP3, SL, Trailing) - Calibrated Multi-Timeframe Institutional Engine
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

  const regimeMult = isTrending ? 1.08 : (isRanging ? 0.90 : 1.00);
  const ictSetupStrong = (isLowSweep && cleanBullOb.length > 0) || (isHighSweep && cleanBearOb.length > 0);
  const ictMult = ictSetupStrong ? 1.05 : 1.0;
  const absorptionSignal = isExtremeDelta && Math.abs(close - lastCandle.open) < atrVal * 0.3;
  const absorbMult = absorptionSignal ? 1.04 : 1.0;
  const basePresetMult = Math.min(1.12, Math.max(0.90, p.mult));

  // Tightly bounded multiplier [0.85, 1.20] so TP1 and TP2 never inflate beyond institutional ATR bands
  const tpMult = Math.min(1.20, Math.max(0.85, basePresetMult * regimeMult * ictMult * absorbMult));

  interface SetupLevelsResult extends NestedLadderResult {
    altTp1: number;
    altTp2: number;
    altTp3: number;
  }

  // Own structural levels for Nested Ladder (Liq LT/IT/ST, EQ, FVG/OB edges)
  const buildOwnStructureLevels = (bIdx: number, isBullDir: boolean): Array<{ price: number; name: string }> => {
    const structList: Array<{ price: number; name: string }> = [];
    for (const z of srZones) {
      if (z.isMitigated) continue;
      structList.push({ price: z.level, name: `Liq ${z.type}` });
    }
    if (Number.isFinite(fib500) && fib500 > 0) {
      structList.push({ price: fib500, name: "EQ" });
    }
    if (isBullDir) {
      for (const fvg of cleanBearFvg) {
        if (fvg.left <= bIdx) structList.push({ price: fvg.bottom, name: "FVG" });
      }
      for (const ob of cleanBearOb) {
        if (ob.left <= bIdx) structList.push({ price: ob.bottom, name: "OB" });
      }
    } else {
      for (const fvg of cleanBullFvg) {
        if (fvg.left <= bIdx) structList.push({ price: fvg.top, name: "FVG" });
      }
      for (const ob of cleanBullOb) {
        if (ob.left <= bIdx) structList.push({ price: ob.top, name: "OB" });
      }
    }
    return structList;
  };

  const computeSetupLevelsForBar = (
    bIdx: number,
    isBullDir: boolean,
    bCandle: Candle,
    bAtr: number,
    isSweep: boolean
  ): SetupLevelsResult => {
    const bClose = bCandle.close;
    const isWkOrMo = tfSec >= 604800;
    const isDly = tfSec >= 86400 && tfSec < 604800;
    const is240 = tfSec >= 14400 && tfSec < 86400;
    const is60 = tfSec >= 3600 && tfSec < 14400;

    // Calibrated institutional ATR bands per timeframe (measured from Entry P1)
    const min_tp1_atr = isWkOrMo || isDly ? 1.20 : is240 || is60 ? 1.15 : 1.05;
    const max_tp1_atr = isWkOrMo || isDly ? 1.60 : is240 || is60 ? 1.50 : 1.40;
    const step_tp2_atr = isWkOrMo || isDly ? 1.00 : is240 || is60 ? 0.90 : 0.85;
    const max_tp2_atr = isWkOrMo || isDly ? 2.65 : is240 || is60 ? 2.45 : 2.25;
    const max_pullback_atr = isWkOrMo || isDly ? 0.40 : is240 || is60 ? 0.45 : 0.50;
    const min_pullback_atr = isSweep ? 0.0 : 0.18;

    let entry: number;
    let entryTagKind = "Pullback";

    if (isBullDir) {
      // 1. HIGH-PROBABILITY LONG ENTRY (Pullback to unmitigated Bullish OB / FVG within [0.18, max_pullback_atr] ATR)
      if (isSweep) {
        entry = Math.max(bClose - bAtr * max_pullback_atr, Math.min(bClose, bCandle.low));
        entryTagKind = "Sweep";
      } else {
        let pFound: number | null = null;
        for (let i = cleanBullOb.length - 1; i >= 0; i--) {
          const ob = cleanBullOb[i];
          const mid = (ob.top + ob.bottom) / 2;
          const candidate = Math.min(ob.top, Math.max(mid, bClose - bAtr * max_pullback_atr));
          if (ob.left <= bIdx && candidate <= bClose - bAtr * min_pullback_atr && candidate >= bClose - bAtr * max_pullback_atr) {
            pFound = candidate;
            entryTagKind = "OB";
            break;
          }
        }
        if (pFound === null && cleanBullFvg.length > 0) {
          for (let i = cleanBullFvg.length - 1; i >= 0; i--) {
            const fvg = cleanBullFvg[i];
            const mid = (fvg.top + fvg.bottom) / 2;
            const candidate = Math.min(fvg.top, Math.max(mid, bClose - bAtr * max_pullback_atr));
            if (fvg.left <= bIdx && candidate <= bClose - bAtr * min_pullback_atr && candidate >= bClose - bAtr * max_pullback_atr) {
              pFound = candidate;
              entryTagKind = "FVG";
              break;
            }
          }
        }
        const defPullbackMult = isTrending ? 0.24 : (tfSec >= 14400 ? 0.26 : 0.30);
        entry = pFound !== null ? pFound : bClose - bAtr * defPullbackMult;
      }
      entry = Math.max(bClose - bAtr * max_pullback_atr, Math.min(bClose - bAtr * min_pullback_atr, entry));
      entry = roundPriceForAsset(entry, bClose);
      const entrySourceTag = `[структура: ${entryTagKind} ${entry}]`;

      // 2. LONG STOP LOSS (Strictly below entry and local 6-bar swing low, bounded [0.55, 0.95] ATR)
      const winSlice = candles.slice(Math.max(0, bIdx - 6), bIdx + 1);
      const ll = winSlice.length > 0 ? Math.min(...winSlice.map(c => c.low)) : entry - bAtr * 0.72;
      const ssl = (ll < entry && ll >= entry - bAtr * 0.85) ? ll - bAtr * 0.12 : entry - bAtr * 0.72;
      let rawSl = Math.min(entry - bAtr * 0.55, Math.max(entry - bAtr * 0.95, ssl));
      rawSl = f_avoid_round_sl(rawSl, true, bAtr);
      rawSl = Math.min(entry - bAtr * 0.52, Math.max(entry - bAtr * 1.00, rawSl));
      rawSl = roundPriceForAsset(rawSl, bClose);
      const riskDist = Math.max(bAtr * 0.52, entry - rawSl);

      // 3. Raw LONG TP1 / TP2 candidates
      const pullbackDist = Math.max(0, bClose - entry);
      const minRew1 = Math.max(bAtr * min_tp1_atr, riskDist * 1.25, pullbackDist + bAtr * 0.55);
      const maxRew1 = Math.max(minRew1 + bAtr * 0.15, bAtr * max_tp1_atr * tpMult);

      let candP2: number | null = null;
      for (let i = cleanBearFvg.length - 1; i >= 0; i--) {
        const fvg = cleanBearFvg[i];
        if (fvg.left <= bIdx && fvg.bottom >= entry + minRew1 && fvg.bottom <= entry + maxRew1) {
          candP2 = fvg.bottom;
          break;
        }
      }
      if (candP2 === null) {
        for (let i = cleanBearOb.length - 1; i >= 0; i--) {
          const ob = cleanBearOb[i];
          if (ob.left <= bIdx && ob.bottom >= entry + minRew1 && ob.bottom <= entry + maxRew1) {
            candP2 = ob.bottom;
            break;
          }
        }
      }
      const recentHighs = candles.slice(Math.max(0, bIdx - 20), bIdx + 1).map(c => c.high);
      const hh = Math.max(...recentHighs);
      const swingTarget = hh > entry + minRew1 ? entry + Math.min(maxRew1, Math.max(minRew1, (hh - entry) * 0.85)) : entry + bAtr * 1.28 * tpMult;
      let rawTp1 = candP2 !== null ? candP2 : swingTarget;
      rawTp1 = f_avoid_round(rawTp1, true, bAtr);
      rawTp1 = Math.min(entry + maxRew1, Math.max(entry + minRew1, rawTp1));
      rawTp1 = roundPriceForAsset(rawTp1, bClose);

      const rew1 = rawTp1 - entry;
      const minRew2 = Math.max(rew1 + bAtr * step_tp2_atr, riskDist * 2.05);
      const maxRew2 = Math.max(minRew2 + bAtr * 0.20, bAtr * max_tp2_atr * tpMult);
      let rawTp2 = entry + Math.min(maxRew2, Math.max(minRew2, bAtr * (isTrending ? 2.35 : 2.15) * tpMult));
      rawTp2 = f_avoid_round(rawTp2, true, bAtr);
      rawTp2 = Math.min(entry + maxRew2, Math.max(entry + minRew2, rawTp2));
      rawTp2 = roundPriceForAsset(rawTp2, bClose);
      const rawTp3 = roundPriceForAsset(rawTp2 + bAtr * Math.max(0.95, 1.10 * tpMult), bClose);

      const ladder = computeNestedLadderSetup({
        entry,
        rawSl,
        isBull: true,
        atrOwn: bAtr,
        tfSec,
        gexPools: {
          maxPain,
          putWall,
          callWall,
          gammaFlip,
          sleeperMagnet,
          expectedMove68
        },
        structureLevels: buildOwnStructureLevels(bIdx, true),
        entrySourceTag,
        rawTp1,
        rawTp2,
        rawTp3
      });

      const altTp1 = roundPriceForAsset(ladder.invalidLevelSl - bAtr * 1.35, bClose);
      const altTp2 = roundPriceForAsset(ladder.invalidLevelSl - bAtr * 2.60, bClose);
      const altTp3 = roundPriceForAsset(altTp2 - bAtr * 1.15, bClose);

      return { ...ladder, altTp1, altTp2, altTp3 };
    } else {
      // 1. HIGH-PROBABILITY SHORT ENTRY (Pullback to unmitigated Bearish OB / FVG within [0.18, max_pullback_atr] ATR)
      if (isSweep) {
        entry = Math.min(bClose + bAtr * max_pullback_atr, Math.max(bClose, bCandle.high));
        entryTagKind = "Sweep";
      } else {
        let pFound: number | null = null;
        for (let i = cleanBearOb.length - 1; i >= 0; i--) {
          const ob = cleanBearOb[i];
          const mid = (ob.top + ob.bottom) / 2;
          const candidate = Math.max(ob.bottom, Math.min(mid, bClose + bAtr * max_pullback_atr));
          if (ob.left <= bIdx && candidate >= bClose + bAtr * min_pullback_atr && candidate <= bClose + bAtr * max_pullback_atr) {
            pFound = candidate;
            entryTagKind = "OB";
            break;
          }
        }
        if (pFound === null && cleanBearFvg.length > 0) {
          for (let i = cleanBearFvg.length - 1; i >= 0; i--) {
            const fvg = cleanBearFvg[i];
            const mid = (fvg.top + fvg.bottom) / 2;
            const candidate = Math.max(fvg.bottom, Math.min(mid, bClose + bAtr * max_pullback_atr));
            if (fvg.left <= bIdx && candidate >= bClose + bAtr * min_pullback_atr && candidate <= bClose + bAtr * max_pullback_atr) {
              pFound = candidate;
              entryTagKind = "FVG";
              break;
            }
          }
        }
        const defPullbackMult = isTrending ? 0.24 : (tfSec >= 14400 ? 0.26 : 0.30);
        entry = pFound !== null ? pFound : bClose + bAtr * defPullbackMult;
      }
      entry = Math.min(bClose + bAtr * max_pullback_atr, Math.max(bClose + bAtr * min_pullback_atr, entry));
      entry = roundPriceForAsset(entry, bClose);
      const entrySourceTag = `[структура: ${entryTagKind} ${entry}]`;

      // 2. SHORT STOP LOSS (Strictly above entry and local 6-bar swing high, bounded [0.55, 0.95] ATR)
      const winSlice = candles.slice(Math.max(0, bIdx - 6), bIdx + 1);
      const hh = winSlice.length > 0 ? Math.max(...winSlice.map(c => c.high)) : entry + bAtr * 0.72;
      const ssl = (hh > entry && hh <= entry + bAtr * 0.85) ? hh + bAtr * 0.12 : entry + bAtr * 0.72;
      let rawSl = Math.max(entry + bAtr * 0.55, Math.min(entry + bAtr * 0.95, ssl));
      rawSl = f_avoid_round_sl(rawSl, false, bAtr);
      rawSl = Math.max(entry + bAtr * 0.52, Math.min(entry + bAtr * 1.00, rawSl));
      rawSl = roundPriceForAsset(rawSl, bClose);
      const riskDist = Math.max(bAtr * 0.52, rawSl - entry);

      // 3. Raw SHORT TP1 / TP2 candidates
      const pullbackDist = Math.max(0, entry - bClose);
      const minRew1 = Math.max(bAtr * min_tp1_atr, riskDist * 1.25, pullbackDist + bAtr * 0.55);
      const maxRew1 = Math.max(minRew1 + bAtr * 0.15, bAtr * max_tp1_atr * tpMult);

      let candP2: number | null = null;
      for (let i = cleanBullFvg.length - 1; i >= 0; i--) {
        const fvg = cleanBullFvg[i];
        if (fvg.left <= bIdx && fvg.top <= entry - minRew1 && fvg.top >= entry - maxRew1) {
          candP2 = fvg.top;
          break;
        }
      }
      if (candP2 === null) {
        for (let i = cleanBullOb.length - 1; i >= 0; i--) {
          const ob = cleanBullOb[i];
          if (ob.left <= bIdx && ob.top <= entry - minRew1 && ob.top >= entry - maxRew1) {
            candP2 = ob.top;
            break;
          }
        }
      }
      const recentLows = candles.slice(Math.max(0, bIdx - 20), bIdx + 1).map(c => c.low);
      const ll = Math.min(...recentLows);
      const swingTarget = ll < entry - minRew1 ? entry - Math.min(maxRew1, Math.max(minRew1, (entry - ll) * 0.85)) : entry - bAtr * 1.28 * tpMult;
      let rawTp1 = candP2 !== null ? candP2 : swingTarget;
      rawTp1 = f_avoid_round(rawTp1, false, bAtr);
      rawTp1 = Math.max(entry - maxRew1, Math.min(entry - minRew1, rawTp1));
      rawTp1 = roundPriceForAsset(rawTp1, bClose);

      const rew1 = entry - rawTp1;
      const minRew2 = Math.max(rew1 + bAtr * step_tp2_atr, riskDist * 2.05);
      const maxRew2 = Math.max(minRew2 + bAtr * 0.20, bAtr * max_tp2_atr * tpMult);
      let rawTp2 = entry - Math.min(maxRew2, Math.max(minRew2, bAtr * (isTrending ? 2.35 : 2.15) * tpMult));
      rawTp2 = f_avoid_round(rawTp2, false, bAtr);
      rawTp2 = Math.max(entry - maxRew2, Math.min(entry - minRew2, rawTp2));
      rawTp2 = roundPriceForAsset(rawTp2, bClose);
      const rawTp3 = roundPriceForAsset(rawTp2 - bAtr * Math.max(0.95, 1.10 * tpMult), bClose);

      const ladder = computeNestedLadderSetup({
        entry,
        rawSl,
        isBull: false,
        atrOwn: bAtr,
        tfSec,
        gexPools: {
          maxPain,
          putWall,
          callWall,
          gammaFlip,
          sleeperMagnet,
          expectedMove68
        },
        structureLevels: buildOwnStructureLevels(bIdx, false),
        entrySourceTag,
        rawTp1,
        rawTp2,
        rawTp3
      });

      const altTp1 = roundPriceForAsset(ladder.invalidLevelSl + bAtr * 1.35, bClose);
      const altTp2 = roundPriceForAsset(ladder.invalidLevelSl + bAtr * 2.60, bClose);
      const altTp3 = roundPriceForAsset(altTp2 + bAtr * 1.15, bClose);

      return { ...ladder, altTp1, altTp2, altTp3 };
    }
  };

  // Compute live setup levels at latest bar
  const liveLevels = computeSetupLevelsForBar(n - 1, isBull, lastCandle, atrVal, isLowSweep || isHighSweep);
  const target_p1 = liveLevels.p1Entry;
  const target_p2 = liveLevels.p2Tp1;
  const target_p3 = liveLevels.p3Tp2;
  const invalidLevelSl = liveLevels.invalidLevelSl;

  const noPullbackProb = Math.min(95, Math.max(12, 15 + (isExtremeDelta ? 25 : 10) + (Math.abs(close - target_p1) > atrVal ? 20 : 0)));

  // TradingView Stateful Forecast Anchoring Algorithm (var fc_start_bar, var fc_p1...)
  // Persists across page refreshes (localStorage + Server) and replays historical bars so it never resets to the last candle on reload
  const cacheKey = `${symbol}_${tf}`;
  const isFallbackCandles = Boolean((candles[0] as any)?._isFallback);
  let existingItem = anchoredForecastCache.get(cacheKey);
  if (existingItem && !isValidAnchoredSetup(existingItem)) {
    deleteCorruptedSetupFromStorage(cacheKey);
    existingItem = undefined;
  }
  let finalForecast: ForecastState | null = null;
  let completedAtBarIdx: number | undefined = undefined;

  // Helper to construct a fresh ForecastState anchored at any historical bar index `barIdx`
  const createSetupAtBar = (barIdx: number): { item: AnchoredForecastItem; forecast: ForecastState } => {
    const bIdx = Math.max(0, Math.min(n - 1, barIdx));
    const bCandle = candles[bIdx];
    const bClose = bCandle.close;
    const bAtr = atrs[bIdx] || atrVal;
    const bDelta = deltas[bIdx] || 0;

    // Direction at barIdx: use exact bar-by-bar SMC structural trend (trendStateByBar)
    const bIsBull = bIdx === n - 1 ? isBull : (trendStateByBar[bIdx] ? trendStateByBar[bIdx] === "bullish" : isBull);
    const bIsSweep = bIdx === n - 1 && (isLowSweep || isHighSweep);

    // Use unified deterministic setup level calculator
    const levels = computeSetupLevelsForBar(bIdx, bIsBull, bCandle, bAtr, bIsSweep);
    const bP1 = levels.p1Entry;
    const bP2 = levels.p2Tp1;
    const bP3 = levels.p3Tp2;
    const bP5 = levels.p5Tp3;
    const bSl = levels.invalidLevelSl;
    const bAlt1 = levels.altTp1;
    const bAlt2 = levels.altTp2;
    const bAlt3 = levels.altTp3;

    // A limit pullback order placed at the close of barIdx is only filled on barIdx if it is a market-price sweep entry
    const bEntryHitOnStart = Math.abs(bP1 - bClose) <= bAtr * 0.03;

    const initialStatus: SetupLifecycleStatus =
      levels.status === "NO_SETUP" || levels.status === "SCALP"
        ? levels.status
        : bEntryHitOnStart
        ? "ACTIVE"
        : "PENDING";

    const fcState: ForecastState = {
      isBull: bIsBull,
      probability: Math.round(bIsBull ? (bDelta > 0 ? 74 : 68) : (bDelta < 0 ? 74 : 68)),
      startBar: bIdx,
      startLogical: bIdx,
      startTime: bCandle.time,
      barsSinceStart: (n - 1) - bIdx,
      isLocked: true,
      atrVal: bAtr,
      rrTp1: levels.rrTp1,
      rrTp2: levels.rrTp2,
      setupMode: levels.setupMode,
      hasValidSetup: levels.hasValidSetup,
      isScalpMode: levels.isScalpMode,
      hideTp1Line: levels.hideTp1Line,
      hideTp2Line: levels.hideTp2Line,
      lockRole: levels.lockRole,
      entrySourceTag: levels.entrySourceTag,
      tp1SourceTag: levels.tp1SourceTag,
      tp2SourceTag: levels.tp2SourceTag,
      tp3SourceTag: levels.tp3SourceTag,
      slSourceTag: levels.slSourceTag,
      statusReason:
        levels.status === "NO_SETUP" || levels.status === "SCALP"
          ? levels.statusReason
          : `Фиксирован (бар #${bIdx})`,
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
      isWickSweep: bIsSweep,
      altTp1: roundPriceForAsset(bAlt1, bClose),
      altTp2: roundPriceForAsset(bAlt2, bClose),
      altTp3: roundPriceForAsset(bAlt3, bClose),
      isHighRunaway: noPullbackProb >= 65,
      noPullbackProb,
      status: initialStatus,
      isExpired: false
    };

    const item: AnchoredForecastItem = {
      key: cacheKey,
      forecast: fcState,
      anchorCandleTime: bCandle.time,
      highestPriceSinceStart: bCandle.high,
      lowestPriceSinceStart: bCandle.low,
      createdAt: Date.now(),
      mathVersion: CURRENT_FORECAST_MATH_VERSION
    };

    return { item, forecast: fcState };
  };

  const extGammaFlip = options?.externalGexReport?.gammaFlip ?? gammaFlip;

  if (existingItem && existingItem.mathVersion === CURRENT_FORECAST_MATH_VERSION) {
    // If rendering temporary fallback candles before server response arrives, return cached forecast untouched
    if (isFallbackCandles) {
      finalForecast = existingItem.forecast;
    } else {
      const priceDiffRatio = Math.abs(existingItem.forecast.startPrice - close) / Math.max(0.0001, close);
      const anchorIdx = priceDiffRatio < 0.15 ? findCandleIndexByTime(candles, existingItem.anchorCandleTime, tfSec) : -1;

      if (anchorIdx >= 0) {
        const { expiredAtBar, updatedForecast } = evaluateSetupRange(
          existingItem,
          anchorIdx,
          n - 1,
          candles,
          atrs,
          atrVal,
          tfSec,
          trendStateByBar,
          isBull,
          extGammaFlip
        );
        if (updatedForecast.expirationReason === "regimeFlip") {
          // Keep the EXPIRED regimeFlip setup visible when spot flipped gamma regime against the lock
          finalForecast = updatedForecast;
          existingItem.forecast = updatedForecast;
          syncSetupToServer(cacheKey, existingItem);
        } else if (expiredAtBar === null && (updatedForecast.isBull === isBull || updatedForecast.counterTrend)) {
          finalForecast = updatedForecast;
          existingItem.forecast = updatedForecast;
          syncSetupToServer(cacheKey, existingItem);
        } else {
          completedAtBarIdx = expiredAtBar ?? (n - 1);
        }
      }
    }
  }

  // If no valid active setup in memory (or previous setup finished at `completedAtBarIdx`),
  // replay historical bars forward up to `n - 1` so the setup is anchored at the actual historical bar where it began!
  if (!finalForecast) {
    const defaultLookbackBars = tfSec >= 86400 ? 5 : tfSec >= 14400 ? 7 : tfSec >= 3600 ? 9 : 11;
    const defaultLookbackStart = Math.max(25, n - 1 - Math.min(defaultLookbackBars, Math.max(4, n - 26)));
    let walkBar = completedAtBarIdx !== undefined ? Math.min(n - 1, completedAtBarIdx) : defaultLookbackStart;
    let currentCandidate = createSetupAtBar(walkBar);

    while (walkBar < n - 1) {
      const { expiredAtBar, updatedForecast } = evaluateSetupRange(
        currentCandidate.item,
        walkBar,
        n - 1,
        candles,
        atrs,
        atrVal,
        tfSec,
        trendStateByBar,
        isBull,
        extGammaFlip
      );
      if (updatedForecast.expirationReason === "regimeFlip" && expiredAtBar !== null && expiredAtBar >= n - 2) {
        currentCandidate.forecast = updatedForecast;
        currentCandidate.item.forecast = updatedForecast;
        break;
      }
      if (expiredAtBar === null && updatedForecast.isBull === isBull) {
        currentCandidate.forecast = updatedForecast;
        currentCandidate.item.forecast = updatedForecast;
        break;
      }
      walkBar = Math.min(n - 1, Math.max(walkBar + 1, expiredAtBar ?? (walkBar + 1)));
      currentCandidate = createSetupAtBar(walkBar);
    }

    finalForecast = currentCandidate.forecast;

    if (!isFallbackCandles) {
      anchoredForecastCache.set(cacheKey, currentCandidate.item);
      syncSetupToServer(cacheKey, currentCandidate.item);
    }
  }

  const forecast: ForecastState = finalForecast;

  // Run multi-TF opposing lock arbitration & 5-TF consensus badge assignment
  if (!isFallbackCandles) {
    const activeItem = anchoredForecastCache.get(cacheKey);
    if (activeItem) {
      activeItem.forecast = forecast;
    } else {
      anchoredForecastCache.set(cacheKey, {
        key: cacheKey,
        forecast,
        anchorCandleTime: forecast.startTime || lastCandle.time,
        highestPriceSinceStart: lastCandle.high,
        lowestPriceSinceStart: lastCandle.low,
        createdAt: Date.now(),
        mathVersion: CURRENT_FORECAST_MATH_VERSION
      });
    }
    if (forecast.status !== "EXPIRED" && !forecast.isExpired) {
      arbitrateOpposingLocksForAsset(symbol);
    }
  }

  const consensus5Tf = computeHonest5TfConsensus(options?.multiTfMetrics, symbol);
  if (!forecast.trendAlignmentBadge) {
    forecast.trendAlignmentBadge = resolveTrendAlignmentBadge(forecast, tf, consensus5Tf);
  }
  if (!forecast.lockRole) {
    forecast.lockRole = forecast.counterTrend ? "ОТКАТ (контртренд, уменьшенный размер)" : "ТРЕНД";
  }

  // Apply MAE-Guard for losing locks
  const maeGuard = evaluateMaeGuard(forecast, close, atrVal);
  forecast.isUnderThreat = maeGuard.isUnderThreat;
  forecast.maeBadge = maeGuard.maeBadge;
  forecast.maeRecommendation = maeGuard.maeRecommendation;

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
    fib382,
    fib618,
    fib786,
    fib1618,
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

export interface EvaluateSetupOptions {
  bosByBar?: boolean[];
  nextPools?: Array<{ price: number; name: string }>;
  gexPools?: {
    maxPain?: number;
    putWall?: number;
    callWall?: number;
    gammaFlip?: number;
    sleeperMagnet?: number;
  };
}

export function evaluateSetupRange(
  item: AnchoredForecastItem,
  anchorIdx: number,
  targetEndIdx: number,
  candles: Candle[],
  atrs?: number[],
  atrVal: number = 10,
  tfSec: number = 900,
  trendStateByBar?: string[],
  isBull: boolean = item.forecast.isBull,
  externalGammaFlip?: number,
  evalOptions?: EvaluateSetupOptions
): { expiredAtBar: number | null; updatedForecast: ForecastState } {
  const prev = item.forecast;
  const entryWaitBars = tfSec >= 86400 ? 4 : tfSec >= 3600 ? 6 : 8;
  const maxSetupBars = tfSec >= 86400 ? 6 : tfSec >= 14400 ? 8 : tfSec >= 3600 ? 10 : 12;
  const anchorCandle = candles[anchorIdx];
  const anchorAtr = (atrs && atrs[anchorIdx]) || atrVal;
  const lastClose = candles[targetEndIdx]?.close ?? prev.startPrice;

  let currentEntry = prev.p1Entry;
  let currentSl = prev.invalidLevelSl;
  let currentTp1 = prev.p2Tp1;
  let currentTp2 = prev.p3Tp2;
  let currentTp3 = prev.p5Tp3;
  let entrySourceTag = prev.entrySourceTag;
  let slSourceTag = prev.slSourceTag;
  let tp1SourceTag = prev.tp1SourceTag;
  let tp2SourceTag = prev.tp2SourceTag;
  let tp3SourceTag = prev.tp3SourceTag;
  let isBreakoutSetup = Boolean(prev.isBreakoutSetup);
  let tp2ExtendedByBos = Boolean(prev.tp2ExtendedByBos);
  let setupMode = prev.setupMode;
  let effectiveAnchorIdx = anchorIdx;

  // Deterministically replay fills starting from anchorIdx
  let leg1Hit = Boolean(prev.leg1Hit) || Math.abs(currentEntry - prev.startPrice) <= anchorAtr * 0.03;
  let leg1Idx: number | undefined = leg1Hit ? (prev.leg1Idx ?? anchorIdx) : undefined;
  let leg1Time: number | undefined = leg1Hit ? (prev.leg1Time ?? anchorCandle?.time) : undefined;

  let leg2Hit = Boolean(prev.leg2Hit);
  let leg2Idx: number | undefined = prev.leg2Idx;
  let leg2Time: number | undefined = prev.leg2Time;

  let leg3Hit = Boolean(prev.leg3Hit);
  let leg3Idx: number | undefined = prev.leg3Idx;
  let leg3Time: number | undefined = prev.leg3Time;

  let activeTrailingSl = currentSl;
  let trailingStageStr = "🛡️ Начальный SL";
  let trailingStageIdx = 0;
  let trailingActivatedAtBar: number | undefined = undefined;
  let expiredAtBar: number | null = null;
  let isMissedEntry = false;
  let expirationReason: SetupExpirationReason | undefined = undefined;
  let customReason: string | undefined = undefined;

  item.highestPriceSinceStart = anchorCandle ? anchorCandle.high : prev.startPrice;
  item.lowestPriceSinceStart = anchorCandle ? anchorCandle.low : prev.startPrice;

  let consecutiveRegimeFlipBars = 0;
  if (
    typeof externalGammaFlip === "number" &&
    externalGammaFlip > 0 &&
    !prev.counterTrend &&
    anchorCandle &&
    targetEndIdx - anchorIdx === 1
  ) {
    const anchorOpposite = prev.isBull
      ? anchorCandle.close < externalGammaFlip
      : anchorCandle.close > externalGammaFlip;
    if (anchorOpposite) {
      consecutiveRegimeFlipBars = 1;
    }
  }

  for (let bi = anchorIdx + 1; bi <= targetEndIdx; bi++) {
    const cb = candles[bi];
    if (!cb) continue;
    const bAtr = (atrs && atrs[bi]) || atrVal;
    if (cb.high > item.highestPriceSinceStart) item.highestPriceSinceStart = cb.high;
    if (cb.low < item.lowestPriceSinceStart) item.lowestPriceSinceStart = cb.low;

    const wasLeg1Hit = leg1Hit;
    const wasLeg2Hit = leg2Hit;

    // 1. GAMMA-REGIME INVALIDATION (regimeFlip):
    if (typeof externalGammaFlip === "number" && externalGammaFlip > 0 && !prev.counterTrend) {
      const isOppositeSideOfFlip = prev.isBull
        ? cb.close < externalGammaFlip
        : cb.close > externalGammaFlip;
      if (isOppositeSideOfFlip) {
        consecutiveRegimeFlipBars += 1;
      } else {
        consecutiveRegimeFlipBars = 0;
      }

      if (consecutiveRegimeFlipBars >= 2) {
        expiredAtBar = bi;
        expirationReason = "regimeFlip";
        customReason = "смена гамма-режима";
        break;
      }
    }

    const nextBarCompletesRegimeFlip =
      consecutiveRegimeFlipBars === 1 &&
      bi + 1 <= targetEndIdx &&
      typeof externalGammaFlip === "number" &&
      externalGammaFlip > 0 &&
      !prev.counterTrend &&
      (prev.isBull
        ? candles[bi + 1].close < externalGammaFlip
        : candles[bi + 1].close > externalGammaFlip);

    // Check if an already-active trailing stop (BE+0.15 or Защита 50%) was hit on this bar
    const trailingHitAtBi =
      wasLeg1Hit &&
      trailingStageIdx > 0 &&
      trailingActivatedAtBar !== undefined &&
      bi > trailingActivatedAtBar &&
      (prev.isBull ? cb.low <= activeTrailingSl : cb.high >= activeTrailingSl);

    if (trailingHitAtBi && !nextBarCompletesRegimeFlip) {
      expiredAtBar = bi;
      expirationReason = "trailingHit";
      break;
    }

    // 4(в) Check if price reached TP1 before ever touching limit Entry (Missed Entry)
    // If accompanied by confirming BOS -> create a BREAKOUT setup with entry on retest of the broken level instead of grey "НЕДОХОД"
    if (!wasLeg1Hit && !nextBarCompletesRegimeFlip) {
      const touchedEntry = prev.isBull ? cb.low <= currentEntry : cb.high >= currentEntry;
      const touchedTp1 = prev.isBull ? cb.high >= currentTp1 : cb.low <= currentTp1;
      if (touchedTp1 && !touchedEntry) {
        const confirmingBos =
          Boolean(evalOptions?.bosByBar?.[bi]) ||
          (prev.isBull ? cb.close > currentTp1 : cb.close < currentTp1);

        if (confirmingBos && !isBreakoutSetup) {
          const brokenLevel = roundPriceForAsset(currentTp1, cb.close);
          const oldTp2 = currentTp2;
          const oldTp3 = currentTp3;

          currentEntry = brokenLevel;
          entrySourceTag = `[ретест BOS: ${brokenLevel}]`;

          currentTp1 = roundPriceForAsset(oldTp2, cb.close);
          tp1SourceTag = tp2SourceTag || `[пул: Магнит ${currentTp1}]`;

          // Find next pool beyond oldTp2 for new TP2
          const poolCands = (evalOptions?.nextPools || []).filter((p) =>
            prev.isBull ? p.price > currentTp1 + 0.3 * bAtr : p.price < currentTp1 - 0.3 * bAtr
          );
          poolCands.sort((a, b) => (prev.isBull ? a.price - b.price : b.price - a.price));

          if (poolCands[0]) {
            currentTp2 = roundPriceForAsset(poolCands[0].price, cb.close);
            tp2SourceTag = `[пул: ${poolCands[0].name} ${currentTp2}]`;
          } else if (
            oldTp3 > 0 &&
            (prev.isBull ? oldTp3 >= currentTp1 + 0.35 * bAtr : oldTp3 <= currentTp1 - 0.35 * bAtr)
          ) {
            currentTp2 = roundPriceForAsset(oldTp3, cb.close);
            tp2SourceTag = `[пул: ${prev.isBull ? "CW" : "PW"} ${currentTp2}]`;
          } else {
            currentTp2 = roundPriceForAsset(
              currentTp1 + (prev.isBull ? 1 : -1) * Math.max(0.85 * bAtr, Math.abs(currentTp1 - currentEntry)),
              cb.close
            );
            tp2SourceTag = `[пул: ${prev.isBull ? "CW" : "PW"} ${currentTp2}]`;
          }

          currentTp3 = roundPriceForAsset(currentTp2 + (prev.isBull ? 1 : -1) * bAtr * 1.05, cb.close);

          const rawBreakoutSl = currentEntry + (prev.isBull ? -1 : 1) * bAtr * 0.72;
          const slPools: Array<{ price: number; name: string }> = [];
          if (evalOptions?.gexPools?.maxPain) slPools.push({ price: evalOptions.gexPools.maxPain, name: "Магнит" });
          if (evalOptions?.gexPools?.putWall) slPools.push({ price: evalOptions.gexPools.putWall, name: "PW" });
          if (evalOptions?.gexPools?.callWall) slPools.push({ price: evalOptions.gexPools.callWall, name: "CW" });
          if (evalOptions?.gexPools?.gammaFlip) slPools.push({ price: evalOptions.gexPools.gammaFlip, name: "Flip" });
          const slResolved = resolveStopPoolConflict(rawBreakoutSl, currentEntry, prev.isBull, bAtr, slPools);
          currentSl = slResolved.sl;
          slSourceTag = slResolved.slSourceTag;
          activeTrailingSl = currentSl;

          isBreakoutSetup = true;
          setupMode = "BREAKOUT";
          isMissedEntry = false;
          effectiveAnchorIdx = bi;
          continue;
        } else {
          isMissedEntry = true;
          expiredAtBar = bi;
          expirationReason = "missedEntry";
          break;
        }
      }
    }

    if (prev.isBull) {
      if (!leg1Hit && cb.low <= currentEntry) {
        leg1Hit = true;
        leg1Idx = bi;
        leg1Time = cb.time;
      }
      if (leg1Hit && !leg2Hit && cb.high >= currentTp1 && (wasLeg1Hit || cb.close >= currentTp1)) {
        leg2Hit = true;
        leg2Idx = bi;
        leg2Time = cb.time;
      }
    } else {
      if (!leg1Hit && cb.high >= currentEntry) {
        leg1Hit = true;
        leg1Idx = bi;
        leg1Time = cb.time;
      }
      if (leg1Hit && !leg2Hit && cb.low <= currentTp1 && (wasLeg1Hit || cb.close <= currentTp1)) {
        leg2Hit = true;
        leg2Idx = bi;
        leg2Time = cb.time;
      }
    }

    // 4(б) After TP1 + BOS of own TF in the direction of the trade:
    // Move TP2 to the next pool (entry and stop do NOT change)
    if (leg2Hit && !tp2ExtendedByBos) {
      const tp1BarHigh = typeof leg2Idx === "number" && candles[leg2Idx] ? candles[leg2Idx].high : currentTp1;
      const tp1BarLow = typeof leg2Idx === "number" && candles[leg2Idx] ? candles[leg2Idx].low : currentTp1;
      const bosAfterTp1 =
        Boolean(evalOptions?.bosByBar?.[bi]) ||
        (Boolean(evalOptions?.nextPools?.length) && (prev.isBull ? cb.close > currentTp1 : cb.close < currentTp1)) ||
        (typeof leg2Idx === "number" &&
          bi > leg2Idx &&
          (prev.isBull ? cb.close > tp1BarHigh : cb.close < tp1BarLow));

      if (bosAfterTp1) {
        const nextPoolCands: Array<{ price: number; name: string }> = [];
        for (const p of evalOptions?.nextPools || []) {
          if (prev.isBull && p.price > currentTp2 + 0.1 * bAtr) nextPoolCands.push(p);
          if (!prev.isBull && p.price < currentTp2 - 0.1 * bAtr) nextPoolCands.push(p);
        }
        if (evalOptions?.gexPools) {
          const gp = evalOptions.gexPools;
          const poolEntries = [
            { price: gp.maxPain || 0, name: "Магнит" },
            { price: gp.callWall || 0, name: "CW" },
            { price: gp.putWall || 0, name: "PW" },
            { price: gp.sleeperMagnet || 0, name: "Магнит" }
          ];
          for (const pe of poolEntries) {
            if (pe.price > 0) {
              if (prev.isBull && pe.price > currentTp2 + 0.1 * bAtr) nextPoolCands.push(pe);
              if (!prev.isBull && pe.price < currentTp2 - 0.1 * bAtr) nextPoolCands.push(pe);
            }
          }
        }
        nextPoolCands.sort((a, b) => (prev.isBull ? a.price - b.price : b.price - a.price));

        if (nextPoolCands[0]) {
          currentTp2 = roundPriceForAsset(nextPoolCands[0].price, cb.close);
          tp2SourceTag = `[пул: ${nextPoolCands[0].name} ${currentTp2} (BOS)]`;
        } else if (
          currentTp3 > 0 &&
          (prev.isBull ? currentTp3 > currentTp2 + 0.1 * bAtr : currentTp3 < currentTp2 - 0.1 * bAtr)
        ) {
          currentTp2 = roundPriceForAsset(currentTp3, cb.close);
          tp2SourceTag = `[пул: ${prev.isBull ? "CW" : "PW"} ${currentTp2} (BOS)]`;
        } else {
          currentTp2 = roundPriceForAsset(currentTp2 + (prev.isBull ? 1 : -1) * bAtr * 1.0, cb.close);
          tp2SourceTag = `[пул: ${prev.isBull ? "CW" : "PW"} ${currentTp2} (BOS)]`;
        }
        currentTp3 = roundPriceForAsset(currentTp2 + (prev.isBull ? 1 : -1) * bAtr * 1.0, cb.close);
        tp2ExtendedByBos = true;
        // Entry (currentEntry) and Stop (currentSl) strictly remain unchanged!
      }
    }

    // Check TP2 (currentTp2) hit
    if (prev.isBull) {
      if (wasLeg1Hit && leg2Hit && !leg3Hit && cb.high >= currentTp2 && (wasLeg2Hit || cb.close >= currentTp2)) {
        leg3Hit = true;
        leg3Idx = bi;
        leg3Time = cb.time;
      }
    } else {
      if (wasLeg1Hit && leg2Hit && !leg3Hit && cb.low <= currentTp2 && (wasLeg2Hit || cb.close <= currentTp2)) {
        leg3Hit = true;
        leg3Idx = bi;
        leg3Time = cb.time;
      }
    }

    const distToTp1 = Math.abs(currentTp1 - currentEntry);
    // Monotonic ratcheted trailing stop progression once entry is active
    if (leg1Hit && distToTp1 > 0) {
      const bestExtreme = prev.isBull ? cb.high - currentEntry : currentEntry - cb.low;
      if (leg2Hit && trailingStageIdx < 2) {
        activeTrailingSl = prev.isBull
          ? currentEntry + (currentTp1 - currentEntry) * 0.50
          : currentEntry - (currentEntry - currentTp1) * 0.50;
        trailingStageStr = "💰 Защита 50%";
        trailingStageIdx = 2;
        trailingActivatedAtBar = bi;
      } else if (wasLeg1Hit && trailingStageIdx < 1 && bestExtreme >= distToTp1 * 0.72) {
        activeTrailingSl = prev.isBull ? currentEntry + bAtr * 0.15 : currentEntry - bAtr * 0.15;
        trailingStageStr = "🔒 BE+0.15";
        trailingStageIdx = 1;
        trailingActivatedAtBar = bi;
      }
    }

    if (nextBarCompletesRegimeFlip) {
      continue;
    }

    const barsPassedAtBi = bi - effectiveAnchorIdx;
    const slBrokenAtBi = prev.isBull ? cb.low <= currentSl : cb.high >= currentSl;

    // On the final bar, if MAE-Guard is active (floating loss > 1.25 * risk AND within 0.3 ATR of SL),
    // keep the lock alive with the "⚠️ ПОД УГРОЗОЙ" warning instead of immediately expiring
    const maeOnFinalBar =
      bi === targetEndIdx &&
      evaluateMaeGuard({ ...prev, p1Entry: currentEntry, invalidLevelSl: currentSl, leg1Hit }, cb.close, bAtr).isUnderThreat;

    // Structural trend reversal (CHoCH) against setup direction
    const barTrendBull = trendStateByBar && trendStateByBar[bi] ? trendStateByBar[bi] === "bullish" : isBull;
    const structuralReversalAtBi = barTrendBull !== prev.isBull;

    // Drift without entry: price moved > 1.75 ATR away from limit entry without filling
    const driftedAwayWithoutEntry =
      !leg1Hit && Math.abs(cb.close - currentEntry) > bAtr * 1.75;

    const barsSinceTp1 = leg2Hit && typeof leg2Idx === "number" ? bi - leg2Idx : 0;

    if (
      (slBrokenAtBi && !maeOnFinalBar) ||
      (structuralReversalAtBi && !maeOnFinalBar) ||
      (leg3Hit && typeof leg3Idx === "number" && bi > leg3Idx) ||
      driftedAwayWithoutEntry ||
      (!leg1Hit && barsPassedAtBi >= entryWaitBars) ||
      (leg2Hit && !leg3Hit && barsSinceTp1 >= 10) ||
      barsPassedAtBi >= maxSetupBars
    ) {
      expiredAtBar = bi;
      if (slBrokenAtBi) expirationReason = "slBroken";
      else if (structuralReversalAtBi) expirationReason = "structuralReversal";
      else if (leg3Hit) expirationReason = "tp2Hit";
      else if (driftedAwayWithoutEntry) expirationReason = "drift";
      else expirationReason = "timeout";
      break;
    }
  }

  const barsPassed = targetEndIdx - anchorIdx;
  const isRegimeFlipExpired = expirationReason === "regimeFlip";
  const isExpired = expiredAtBar !== null;

  let status: SetupLifecycleStatus =
    prev.status === "NO_SETUP" || prev.status === "SCALP"
      ? prev.status
      : leg1Hit
      ? "ACTIVE"
      : "PENDING";
  if (isBreakoutSetup) {
    status = leg1Hit ? "ACTIVE" : "PENDING";
  }
  if (isRegimeFlipExpired || isExpired) {
    status = "EXPIRED";
  }

  const updatedForecast: ForecastState = {
    ...prev,
    startBar: anchorIdx,
    startLogical: anchorIdx,
    startTime: candles[anchorIdx]?.time ?? item.anchorCandleTime,
    startPrice: prev.startPrice,
    p1Entry: currentEntry,
    invalidLevelSl: currentSl,
    p2Tp1: currentTp1,
    p3Tp2: currentTp2,
    p5Tp3: currentTp3,
    entrySourceTag,
    slSourceTag,
    tp1SourceTag,
    tp2SourceTag,
    tp3SourceTag,
    isBreakoutSetup,
    tp2ExtendedByBos,
    setupMode,
    barsSinceStart: barsPassed,
    isLocked: !isRegimeFlipExpired,
    status,
    isExpired,
    expirationReason,
    reason: customReason,
    isMissedEntry,
    lockRole: isBreakoutSetup ? "ПРОБОЙ + РЕТЕСТ (BOS)" : prev.lockRole,
    statusReason: isRegimeFlipExpired
      ? "смена гамма-режима"
      : isMissedEntry
      ? `🚫 НЕДОХОД (MISSED ENTRY) - Тейк взят до активации лимита`
      : isBreakoutSetup
      ? `🚀 ПРОБОЙ + РЕТЕСТ (вход на ретесте пробитого уровня ${currentEntry})`
      : tp2ExtendedByBos
      ? `📈 TP2 сдвинут по BOS на следующий пул (${currentTp2})`
      : prev.status === "SCALP" || prev.status === "NO_SETUP"
      ? prev.statusReason
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
    activeTrailingSl: roundPriceForAsset(activeTrailingSl, lastClose),
    trailingStageStr,
    trailingStageIdx
  };

  const finalMae = evaluateMaeGuard(updatedForecast, lastClose, atrVal);
  updatedForecast.isUnderThreat = finalMae.isUnderThreat;
  updatedForecast.maeBadge = finalMae.maeBadge;
  updatedForecast.maeRecommendation = finalMae.maeRecommendation;

  return { expiredAtBar, updatedForecast };
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

  const consensus5Tf = computeHonest5TfConsensus(null, symbol);
  const trendAlignmentBadge = fc.trendAlignmentBadge || resolveTrendAlignmentBadge(fc, tf, consensus5Tf);
  const maeGuard = evaluateMaeGuard(fc, close, atrVal);
  const isUnderThreat = Boolean(fc.isUnderThreat || maeGuard.isUnderThreat);
  const maeBadge = fc.maeBadge || maeGuard.maeBadge;
  const maeRecommendation = fc.maeRecommendation || maeGuard.maeRecommendation;

  // 1. Rec Action
  const p1Str = fc.p1Entry.toFixed(1);
  const p2Str = fc.p2Tp1.toFixed(1);
  const p3Str = fc.p3Tp2.toFixed(1);
  let recActionStr = `⏳ Ждём вход @${p1Str} (${fc.isBull ? "LONG" : "SHORT"})`;
  let recCol = "#94a3b8";
  if (fc.status === "NO_SETUP" || fc.hasValidSetup === false) {
    recActionStr = "🚫 NO_SETUP (R:R < 1.0 — сделка пропущена)";
    recCol = "#64748b";
  } else if (fc.status === "SCALP" || fc.isScalpMode) {
    recActionStr = `⚡ СКАЛЬП (цель = потолок отката @${p2Str}, размер 1/2)`;
    recCol = "#f59e0b";
  } else if (fc.status === "EXPIRED" && fc.expirationReason === "regimeFlip") {
    recActionStr = "⛔ EXPIRED — смена гамма-режима (закрытие за Flip)";
    recCol = "#ef4444";
  } else if (fc.status === "EXPIRED" && fc.expirationReason === "counterTrendTp") {
    recActionStr = `🎯 ОТКАТ ЗАКРЫТ у потолка входа старшего ТФ (@${p3Str})`;
    recCol = "#10b981";
  } else if (isUnderThreat) {
    recActionStr = `${maeBadge} — закрыть вручную или ужать стоп (@${fc.invalidLevelSl.toFixed(1)})`;
    recCol = "#ef4444";
  } else if (fc.isPlanBActive) {
    recActionStr = "⚡ ПЛАН Б — слом SL, жди разворот";
    recCol = "#f59e0b";
  } else if (fc.isBreakoutSetup && !fc.leg1Hit) {
    recActionStr = `🚀 ПРОБОЙ + РЕТЕСТ @${p1Str} → ждём TP1 ${p2Str}`;
    recCol = "#38bdf8";
  } else if (fc.leg3Hit) {
    recActionStr = "🏆 ЗАКРЫВАЙ — TP2 достигнут";
    recCol = "#10b981";
  } else if (fc.leg2Hit) {
    recActionStr = `📈 ДЕРЖИМ до TP2 ${p3Str}${fc.tp2ExtendedByBos ? " (BOS+)" : ""}`;
    recCol = "#38bdf8";
  } else if (fc.leg1Hit) {
    recActionStr = `📍 В позиции → ждём TP1 ${p2Str}`;
    recCol = "#fbbf24";
  }
  if (fc.counterTrend && !recActionStr.includes("ОТКАТ")) {
    recActionStr = `${recActionStr} • ${trendAlignmentBadge}`;
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

  const expirySuffix = (gex as any)?.horizon ? getExpirySuffix((gex as any).horizon) : "Дневной";
  let dayTargetStr = `Потолок (${expirySuffix}) ${gex.callWall} (${Math.round(probCall)}%)`;
  let dayTargetCol = "#10b981";
  if (distPainAtr < distCallAtr && distPainAtr < distPutAtr) {
    dayTargetStr = `Магнит (${expirySuffix}) ${gex.maxPain} (${Math.round(probPain)}%)`;
    dayTargetCol = "#06b6d4";
  } else if (distPutAtr < distCallAtr) {
    dayTargetStr = `Пол (${expirySuffix}) ${gex.putWall} (${Math.round(probPut)}%)`;
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
  const mtfDesc = `${trendAlignmentBadge} • ${consensus5Tf.summaryText}`;

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
    hudHtfUp: consensus5Tf.htfTrendDirection === "LONG" ? true : consensus5Tf.htfTrendDirection === "SHORT" ? false : fc.isBull,
    trendAlignmentBadge,
    consensus5Str: consensus5Tf.summaryText,
    isCounterTrend: Boolean(fc.counterTrend),
    lockRole: fc.lockRole || (fc.counterTrend ? "ОТКАТ (контртренд, уменьшенный размер)" : "ТРЕНД"),
    isUnderThreat,
    maeBadge,
    maeRecommendation
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

/**
 * Вычисляет живые уровни сетапа (ВХОД / TP1 / TP2 / TP3 / SL) на указанном баре (по умолчанию — текущем последнем баре)
 * для fallback-восстановления лесенки в AutonomousTradingStation при невалидном кэшированном сетапе.
 */
export type SetupLevelsResult = NestedLadderResult & {
  altTp1: number;
  altTp2: number;
  altTp3: number;
  isBull: boolean;
  atrVal: number;
};

export function createSetupLevelsForBar(
  candles: Candle[],
  symbol: string = "XAUUSD",
  tf: string = "15m",
  barIdx?: number,
  externalGexReport?: Partial<GexReportCalculated> | null
): SetupLevelsResult {
  const safeCandles = Array.isArray(candles) && candles.length > 0
    ? candles
    : [{ time: Math.floor(Date.now() / 1000), open: 4050, high: 4062, low: 4042, close: 4055, volume: 1000 }];
  const targetIdx = typeof barIdx === "number" && barIdx >= 0 && barIdx < safeCandles.length
    ? barIdx
    : safeCandles.length - 1;
  const sliced = safeCandles.slice(0, targetIdx + 1);
  const lastC = sliced[sliced.length - 1];
  const close = lastC.close > 0 ? lastC.close : 4050;
  const atrs = calcATR(sliced, 14);
  const rawAtr = atrs[atrs.length - 1] || Math.abs(lastC.high - lastC.low) || close * 0.004;
  const atrVal = Math.max(close * 0.001, rawAtr);
  const closes = sliced.map(c => c.close);
  const ema50 = calcEMA(closes, Math.min(50, Math.max(2, closes.length)));
  const isBull = close >= (ema50[ema50.length - 1] || close);
  const tfSec = tf === "1m" ? 60 : tf === "5m" ? 300 : tf === "15m" ? 900 : tf === "30m" ? 1800 : tf === "1h" ? 3600 : tf === "4h" ? 14400 : 86400;

  const entry = roundPriceForAsset(isBull ? close - atrVal * 0.25 : close + atrVal * 0.25, close);
  const rawSl = roundPriceForAsset(isBull ? entry - atrVal * 0.65 : entry + atrVal * 0.65, close);
  const rawTp1 = roundPriceForAsset(isBull ? entry + atrVal * 1.15 : entry - atrVal * 1.15, close);
  const rawTp2 = roundPriceForAsset(isBull ? entry + atrVal * 2.15 : entry - atrVal * 2.15, close);
  const rawTp3 = roundPriceForAsset(isBull ? rawTp2 + atrVal * 1.05 : rawTp2 - atrVal * 1.05, close);

  const gexPools = {
    maxPain: externalGexReport?.maxPain || roundPriceForAsset(isBull ? entry + atrVal * 1.25 : entry - atrVal * 1.25, close),
    putWall: externalGexReport?.putWall || roundPriceForAsset(entry - atrVal * 2.4, close),
    callWall: externalGexReport?.callWall || roundPriceForAsset(entry + atrVal * 2.4, close),
    gammaFlip: externalGexReport?.gammaFlip || roundPriceForAsset(entry, close),
    sleeperMagnet: externalGexReport?.sleeperMagnet || roundPriceForAsset(isBull ? entry + atrVal * 3.1 : entry - atrVal * 3.1, close),
    expectedMove68: externalGexReport?.expectedMove68 || {
      low: roundPriceForAsset(entry - atrVal * 2.2, close),
      high: roundPriceForAsset(entry + atrVal * 2.2, close)
    }
  };

  const ladder = computeNestedLadderSetup({
    entry,
    rawSl,
    isBull,
    atrOwn: atrVal,
    tfSec,
    gexPools,
    structureLevels: [
      { price: rawTp1, name: "Liq ST" },
      { price: rawTp2, name: "Liq IT" }
    ],
    entrySourceTag: `[структура: Pullback ${entry}]`,
    rawTp1,
    rawTp2,
    rawTp3
  });

  // Guarantee positive finite fallback levels so the ladder never vanishes
  const finalEntry = Number.isFinite(ladder.p1Entry) && ladder.p1Entry > 0 ? ladder.p1Entry : entry;
  const finalSl = Number.isFinite(ladder.invalidLevelSl) && ladder.invalidLevelSl > 0 ? ladder.invalidLevelSl : rawSl;
  const finalTp1 = Number.isFinite(ladder.p2Tp1) && ladder.p2Tp1 > 0 ? ladder.p2Tp1 : rawTp1;
  const finalTp2 =
    Number.isFinite(ladder.p3Tp2) && ladder.p3Tp2 > 0 && Math.abs(ladder.p3Tp2 - finalTp1) >= 0.01
      ? ladder.p3Tp2
      : rawTp2;
  const finalTp3 = Number.isFinite(ladder.p5Tp3) && ladder.p5Tp3 > 0 ? ladder.p5Tp3 : rawTp3;
  const altTp1 = roundPriceForAsset(isBull ? finalSl - atrVal * 1.35 : finalSl + atrVal * 1.35, close);
  const altTp2 = roundPriceForAsset(isBull ? finalSl - atrVal * 2.60 : finalSl + atrVal * 2.60, close);
  const altTp3 = roundPriceForAsset(isBull ? altTp2 - atrVal * 1.15 : altTp2 + atrVal * 1.15, close);

  return {
    ...ladder,
    p1Entry: finalEntry,
    p2Tp1: finalTp1,
    p3Tp2: finalTp2,
    p5Tp3: finalTp3,
    invalidLevelSl: finalSl,
    hasValidSetup: true,
    status: ladder.status === "NO_SETUP" ? "PENDING" : ladder.status,
    altTp1,
    altTp2,
    altTp3,
    isBull,
    atrVal
  };
}

export { evaluateSuperIndicator as runPineSuperIndicatorEngine };


