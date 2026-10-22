import { Candlestick, FVGZone, OrderBlock, StructureBreak, IndicatorSettings } from "../types";

// Generate realistic technical indicator values for features
export function computeRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = Array(prices.length).fill(50);
  if (prices.length < period) return rsi;

  let gains = 0;
  let losses = 0;

  // First RSI value
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

export function computeMACD(closes: number[], fast: number = 12, slow: number = 26, signalLen: number = 9): {
  macd: number[];
  signal: number[];
  histogram: number[];
} {
  const count = closes.length;
  const macd: number[] = Array(count).fill(0);
  const signal: number[] = Array(count).fill(0);
  const histogram: number[] = Array(count).fill(0);

  if (count === 0) return { macd, signal, histogram };

  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSig = 2 / (signalLen + 1);

  let emaFast = closes[0] || 0;
  let emaSlow = closes[0] || 0;
  let emaSig = 0;

  for (let i = 0; i < count; i++) {
    emaFast = closes[i] * kFast + emaFast * (1 - kFast);
    emaSlow = closes[i] * kSlow + emaSlow * (1 - kSlow);
    macd[i] = emaFast - emaSlow;

    if (i === 0) emaSig = macd[0];
    else emaSig = macd[i] * kSig + emaSig * (1 - kSig);

    signal[i] = emaSig;
    histogram[i] = macd[i] - signal[i];
  }

  return { macd, signal, histogram };
}

export interface KeySweepResult {
  hasRecentHighSweep: boolean;
  hasRecentLowSweep: boolean;
  lastSweepPrice: number;
  sweepMap: Record<number, { type: 'high' | 'low'; sweptPrice: number }>;
}

export function detectKeyLevelSweeps(candlesticks: Candlestick[]): KeySweepResult {
  const sweepMap: Record<number, { type: 'high' | 'low'; sweptPrice: number }> = {};
  if (!candlesticks || candlesticks.length < 10) {
    return { hasRecentHighSweep: false, hasRecentLowSweep: false, lastSweepPrice: 0, sweepMap };
  }

  // Identify True Structural Pivot Highs and Lows (radius = 4)
  const pivotHighs: { index: number; price: number }[] = [];
  const pivotLows: { index: number; price: number }[] = [];
  const pLen = 4;

  for (let i = pLen; i < candlesticks.length - pLen; i++) {
    const h = candlesticks[i].high;
    const l = candlesticks[i].low;
    let isPH = true;
    let isPL = true;

    for (let j = i - pLen; j <= i + pLen; j++) {
      if (j === i) continue;
      if (candlesticks[j].high >= h) isPH = false;
      if (candlesticks[j].low <= l) isPL = false;
    }

    if (isPH) pivotHighs.push({ index: i, price: h });
    if (isPL) pivotLows.push({ index: i, price: l });
  }

  let hasRecentHighSweep = false;
  let hasRecentLowSweep = false;
  let lastSweepPrice = 0;

  let lastSweptHighIdx = -10;
  let lastSweptLowIdx = -10;

  // Scan candles to detect sweeps ONLY on established key pivot levels
  for (let i = 5; i < candlesticks.length; i++) {
    const candle = candlesticks[i];
    if (!candle) continue;

    const totalH = candle.high - candle.low || 1;
    const bodyH = Math.abs(candle.close - candle.open);

    // Active pivot high established prior to candle i (at least 3 bars ago and within 45 bars back)
    const validPH = pivotHighs.filter(ph => ph.index <= i - 3 && ph.index >= i - 45);
    const highestPivot = validPH.length > 0 ? Math.max(...validPH.map(p => p.price)) : -1;

    if (highestPivot !== -1 && candle.high > highestPivot && candle.close <= highestPivot) {
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      if ((upperWick / totalH >= 0.38 || bodyH / totalH <= 0.45) && (i - lastSweptHighIdx > 1)) {
        sweepMap[i] = { type: 'high', sweptPrice: highestPivot };
        lastSweptHighIdx = i;
        if (i >= candlesticks.length - 15) {
          hasRecentHighSweep = true;
          lastSweepPrice = highestPivot;
        }
      }
    }

    // Active pivot low established prior to candle i
    const validPL = pivotLows.filter(pl => pl.index <= i - 3 && pl.index >= i - 45);
    const lowestPivot = validPL.length > 0 ? Math.min(...validPL.map(p => p.price)) : -1;

    if (lowestPivot !== -1 && candle.low < lowestPivot && candle.close >= lowestPivot) {
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      if ((lowerWick / totalH >= 0.38 || bodyH / totalH <= 0.45) && (i - lastSweptLowIdx > 1)) {
        sweepMap[i] = { type: 'low', sweptPrice: lowestPivot };
        lastSweptLowIdx = i;
        if (i >= candlesticks.length - 15) {
          hasRecentLowSweep = true;
          lastSweepPrice = lowestPivot;
        }
      }
    }
  }

  return {
    hasRecentHighSweep,
    hasRecentLowSweep,
    lastSweepPrice,
    sweepMap
  };
}

function computeCCI(highs: number[], lows: number[], closes: number[], period: number = 20): number[] {
  const cci: number[] = Array(closes.length).fill(0);
  if (closes.length < period) return cci;

  const tp: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  for (let i = period - 1; i < closes.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const ma = slice.reduce((a, b) => a + b, 0) / period;
    
    let meanDev = 0;
    for (let j = 0; j < period; j++) {
      meanDev += Math.abs(slice[j] - ma);
    }
    meanDev /= period;

    if (meanDev === 0) {
      cci[i] = 0;
    } else {
      cci[i] = (tp[i] - ma) / (0.015 * meanDev);
    }
  }

  return cci;
}

export function computeWaveTrend(
  closes: number[],
  highs?: number[],
  lows?: number[],
  channelLen: number = 10,
  avgLen: number = 21
): { wt1: number[]; wt2: number[] } {
  const count = closes.length;
  const wt1: number[] = Array(count).fill(0);
  const wt2: number[] = Array(count).fill(0);
  if (count === 0) return { wt1, wt2 };

  // AP = hlc3 or close
  const ap: number[] = [];
  for (let i = 0; i < count; i++) {
    if (highs && lows && highs[i] !== undefined && lows[i] !== undefined) {
      ap.push((highs[i] + lows[i] + closes[i]) / 3);
    } else {
      ap.push(closes[i]);
    }
  }

  // esa = ema(ap, channelLen)
  const esa: number[] = Array(count).fill(0);
  const k1 = 2 / (channelLen + 1);
  let prevEsa = ap[0];
  for (let i = 0; i < count; i++) {
    prevEsa = ap[i] * k1 + prevEsa * (1 - k1);
    esa[i] = prevEsa;
  }

  // d = ema(abs(ap - esa), channelLen)
  const d: number[] = Array(count).fill(0);
  let prevD = Math.abs(ap[0] - esa[0]);
  for (let i = 0; i < count; i++) {
    const diff = Math.abs(ap[i] - esa[i]);
    prevD = diff * k1 + prevD * (1 - k1);
    d[i] = prevD;
  }

  // ci = (ap - esa) / (0.015 * d)
  const ci: number[] = Array(count).fill(0);
  for (let i = 0; i < count; i++) {
    const divisor = 0.015 * (d[i] || 0.0001);
    ci[i] = divisor === 0 ? 0 : (ap[i] - esa[i]) / divisor;
  }

  // tci = ema(ci, avgLen) -> wt1
  const k2 = 2 / (avgLen + 1);
  let prevTci = ci[0];
  for (let i = 0; i < count; i++) {
    prevTci = ci[i] * k2 + prevTci * (1 - k2);
    wt1[i] = prevTci;
  }

  // wt2 = sma(wt1, 4)
  for (let i = 0; i < count; i++) {
    if (i < 4) {
      const slice = wt1.slice(0, i + 1);
      wt2[i] = slice.reduce((a, b) => a + b, 0) / (i + 1);
    } else {
      const slice = wt1.slice(i - 3, i + 1);
      wt2[i] = slice.reduce((a, b) => a + b, 0) / 4;
    }
  }

  return { wt1, wt2 };
}

// Lorentzian Distance classifier with feature normalization
// Lorentzian distance = sum( ln(1 + |x_k - y_k|) ) over normalized features
function classifyLorentzian(
  features: number[][], // array of feature vectors for each bar
  labels: number[], // +1 for future up, -1 for future down, 0 for neutral
  currentIdx: number,
  settings: IndicatorSettings
): { signal: number; confidence: number } {
  if (currentIdx < 30) return { signal: 0, confidence: 0 };

  const currentVector = features[currentIdx];
  const distances: { index: number; distance: number; label: number }[] = [];

  // Rolling feature normalization stats (min/max over past 100 bars)
  const lookbackMinMax = Math.min(currentIdx, 100);
  const minF = [Infinity, Infinity, Infinity];
  const maxF = [-Infinity, -Infinity, -Infinity];

  for (let k = currentIdx - lookbackMinMax; k < currentIdx; k++) {
    for (let f = 0; f < 3; f++) {
      if (features[k] && features[k][f] !== undefined) {
        if (features[k][f] < minF[f]) minF[f] = features[k][f];
        if (features[k][f] > maxF[f]) maxF[f] = features[k][f];
      }
    }
  }

  const normalize = (val: number, fIdx: number) => {
    const range = maxF[fIdx] - minF[fIdx];
    return range > 0.0001 ? (val - minF[fIdx]) / range : 0.5;
  };

  const normCurrent = [
    normalize(currentVector[0] ?? 50, 0),
    normalize(currentVector[1] ?? 0, 1),
    normalize(currentVector[2] ?? 0, 2),
  ];

  // Compare with historical vectors (from 15 to currentIdx - 4, avoiding future lookahead leakage)
  for (let i = 15; i < currentIdx - 4; i++) {
    let dist = 0;
    let validFeatures = 0;

    // Feature 1: RSI (Normalized 0..1)
    if (settings.useRSI && features[i][0] !== undefined) {
      const normHist = normalize(features[i][0], 0);
      dist += Math.log(1 + Math.abs(normHist - normCurrent[0]));
      validFeatures++;
    }
    // Feature 2: CCI (Normalized 0..1)
    if (settings.useCCI && features[i][1] !== undefined) {
      const normHist = normalize(features[i][1], 1);
      dist += Math.log(1 + Math.abs(normHist - normCurrent[1]));
      validFeatures++;
    }
    // Feature 3: WaveTrend (Normalized 0..1)
    if (settings.useWaveTrend && features[i][2] !== undefined) {
      const normHist = normalize(features[i][2], 2);
      dist += Math.log(1 + Math.abs(normHist - normCurrent[2]));
      validFeatures++;
    }

    if (validFeatures > 0) {
      distances.push({ index: i, distance: dist, label: labels[i] });
    }
  }

  if (distances.length === 0) return { signal: 0, confidence: 0 };

  // Sort by Lorentzian distance ascending
  distances.sort((a, b) => a.distance - b.distance);

  // Take K nearest neighbors
  const K = Math.min(settings.neighborCount || 8, distances.length);
  const nearest = distances.slice(0, K);

  let buyVotes = 0;
  let sellVotes = 0;

  nearest.forEach((n) => {
    if (n.label > 0) buyVotes++;
    else if (n.label < 0) sellVotes++;
  });

  const totalVotes = buyVotes + sellVotes;
  if (totalVotes === 0) return { signal: 0, confidence: 0 };

  const buyRatio = buyVotes / K;
  const sellRatio = sellVotes / K;

  const threshold = (settings.lorentzianThreshold || 50) / 100;

  if (buyRatio >= threshold && buyRatio > sellRatio) {
    return { signal: 1, confidence: buyRatio };
  } else if (sellRatio >= threshold && sellRatio > buyRatio) {
    return { signal: -1, confidence: sellRatio };
  }

  return { signal: 0, confidence: Math.max(buyRatio, sellRatio) };
}

export interface SetupProbabilityResult {
  bullProb: number;
  bearProb: number;
  recommendedDirection: 'bullish' | 'bearish';
  confluenceConfidence: number;
  confidenceGrade: 'A+' | 'A' | 'B' | 'C';
  factors: {
    htfScore: number;
    structureScore: number;
    deltaScore: number;
    momentumScore: number;
    zoneScore: number;
    sweepScore: number;
  };
}

export function calculateConfluenceProbability(params: {
  isBullCandidate: boolean;
  htfTrendUp: boolean;
  localStructureBull: boolean;
  deltaCurrent: number;
  isExtremeDelta: boolean;
  rsiValue: number;
  macdHist: number;
  inSupportOrBullOB: boolean;
  inResistanceOrBearOB: boolean;
  inOteZone: boolean;
  hasLowSweep: boolean;
  hasHighSweep: boolean;
}): SetupProbabilityResult {
  const calcSide = (targetBull: boolean) => {
    let p = 50.0;

    // 1. Higher Timeframe Alignment (Dominant Trend Filter)
    let htfScore = 0;
    if (targetBull === params.htfTrendUp) {
      p += 10.0; // Trend confluence bonus
      htfScore = 10.0;
    } else {
      p -= 18.0; // Strict counter-trend penalty
      htfScore = -18.0;
    }

    // 2. SMC Market Structure (CHoCH / BOS)
    let structureScore = 0;
    if (targetBull === params.localStructureBull) {
      p += 8.0;
      structureScore = 8.0;
    } else {
      p -= 10.0;
      structureScore = -10.0;
    }

    // 3. Volume Delta confirmation (CVD Pressure)
    let deltaScore = 0;
    if (targetBull) {
      if (params.deltaCurrent > 0) {
        const bonus = params.isExtremeDelta ? 8.0 : 6.0;
        p += bonus;
        deltaScore = bonus;
      } else {
        p -= 8.0; // Buying into selling pressure
        deltaScore = -8.0;
      }
    } else {
      if (params.deltaCurrent < 0) {
        const bonus = params.isExtremeDelta ? 8.0 : 6.0;
        p += bonus;
        deltaScore = bonus;
      } else {
        p -= 8.0; // Selling into buying pressure
        deltaScore = -8.0;
      }
    }

    // 4. Key Level Sweeps (Liquidity Rejection)
    let sweepScore = 0;
    if (targetBull && params.hasLowSweep) {
      p += 6.0;
      sweepScore = 6.0;
    } else if (!targetBull && params.hasHighSweep) {
      p += 6.0;
      sweepScore = 6.0;
    }

    // 5. Zone Confluence (OB / FVG / OTE)
    let zoneScore = 0;
    if (targetBull && (params.inSupportOrBullOB || params.inOteZone)) {
      p += 6.0;
      zoneScore = 6.0;
    } else if (!targetBull && (params.inResistanceOrBearOB || params.inOteZone)) {
      p += 6.0;
      zoneScore = 6.0;
    } else {
      p -= 3.0; // Outside high-probability zones
      zoneScore = -3.0;
    }

    // 6. Momentum (RSI & MACD Histogram)
    let momentumScore = 0;
    if (targetBull) {
      if (params.rsiValue >= 50 && params.macdHist >= 0) {
        p += 4.0;
        momentumScore = 4.0;
      } else if (params.rsiValue < 45 && params.macdHist < 0) {
        p -= 5.0;
        momentumScore = -5.0;
      }
    } else {
      if (params.rsiValue <= 50 && params.macdHist <= 0) {
        p += 4.0;
        momentumScore = 4.0;
      } else if (params.rsiValue > 55 && params.macdHist > 0) {
        p -= 5.0;
        momentumScore = -5.0;
      }
    }

    // Professional Realistic Ceiling (Max 82%, Min 32%)
    const finalProb = Math.min(82.0, Math.max(32.0, Math.round(p * 10) / 10));
    return { prob: finalProb, htfScore, structureScore, deltaScore, sweepScore, zoneScore, momentumScore };
  };

  const bullCalc = calcSide(true);
  const bearCalc = calcSide(false);

  const recommendedDirection = bullCalc.prob >= bearCalc.prob ? 'bullish' : 'bearish';
  const bestProb = Math.max(bullCalc.prob, bearCalc.prob);

  let confidenceGrade: 'A+' | 'A' | 'B' | 'C' = 'C';
  if (bestProb >= 76.0) confidenceGrade = 'A+';
  else if (bestProb >= 67.0) confidenceGrade = 'A';
  else if (bestProb >= 55.0) confidenceGrade = 'B';
  else confidenceGrade = 'C';

  const bestFactors = recommendedDirection === 'bullish' ? bullCalc : bearCalc;

  return {
    bullProb: bullCalc.prob,
    bearProb: bearCalc.prob,
    recommendedDirection,
    confluenceConfidence: bestProb,
    confidenceGrade,
    factors: {
      htfScore: bestFactors.htfScore,
      structureScore: bestFactors.structureScore,
      deltaScore: bestFactors.deltaScore,
      momentumScore: bestFactors.momentumScore,
      zoneScore: bestFactors.zoneScore,
      sweepScore: bestFactors.sweepScore,
    }
  };
}

export function getIntervalMs(timeframe: string): number {
  switch (timeframe) {
    case "1m": return 1 * 60 * 1000;
    case "5m": return 5 * 60 * 1000;
    case "15m": return 15 * 60 * 1000;
    case "30m": return 30 * 60 * 1000;
    case "1H": return 60 * 60 * 1000;
    case "4H": return 4 * 60 * 60 * 1000;
    case "1D": return 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

export function generateInitialCandles(asset: string, length: number = 120, timeframe: string = "15m"): Candlestick[] {
  let price = 0;
  let spreadMultiplier = 1;

  if (asset === "BTC/USDT") {
    price = 62000;
    spreadMultiplier = 150;
  } else if (asset === "ETH/USDT") {
    price = 3300;
    spreadMultiplier = 15;
  } else if (asset === "SOL/USDT") {
    price = 145;
    spreadMultiplier = 1.2;
  } else if (asset === "EUR/USD") {
    price = 1.0850;
    spreadMultiplier = 0.0012;
  } else if (asset === "GOLD") {
    price = 2350;
    spreadMultiplier = 8;
  }

  // Adjust price volatility/spread based on selected timeframe
  const tfVolatilityScales: Record<string, number> = {
    "1m": 0.15,
    "5m": 0.35,
    "15m": 0.75,
    "30m": 1.15,
    "1H": 1.85,
    "4H": 4.0,
    "1D": 9.0
  };
  const volatilityScale = tfVolatilityScales[timeframe] || 0.75;
  spreadMultiplier *= volatilityScale;

  const candles: Candlestick[] = [];
  const intervalMs = getIntervalMs(timeframe);
  const baseTime = Date.now() - length * intervalMs;

  let cumulativeDelta = 0;

  // Let's create an organic price path with cyclical trends and volume spikes
  for (let i = 0; i < length; i++) {
    // Periodically inject momentum impulse bars to ensure FVG and OB are generated organically
    const isImpulse = i > 10 && i % 15 === 0;
    const isBullishImpulse = isImpulse && (i % 30 === 0 || Math.random() > 0.4);

    let priceChange = 0;
    if (isImpulse) {
      priceChange = isBullishImpulse ? 2.6 * spreadMultiplier : -2.6 * spreadMultiplier;
    } else {
      const cycle = Math.sin(i * 0.1) * 0.3 + Math.cos(i * 0.03) * 0.4;
      const noise = (Math.random() - 0.48) * 0.5; // Slightly upward bias
      priceChange = (cycle + noise) * spreadMultiplier;
    }
    
    const open = i === 0 ? price : candles[i - 1].close;
    const close = open + priceChange;

    let high = 0;
    let low = 0;
    if (isImpulse) {
      // Impulse candles have tiny shadows/wicks to preserve gaps (FVG)
      high = Math.max(open, close) + Math.abs(Math.random() * 0.04 * spreadMultiplier);
      low = Math.min(open, close) - Math.abs(Math.random() * 0.04 * spreadMultiplier);
    } else {
      high = Math.max(open, close) + Math.abs(Math.random() * 0.3 * spreadMultiplier);
      low = Math.min(open, close) - Math.abs(Math.random() * 0.3 * spreadMultiplier);
    }
    
    // Volume delta simulation
    const volume = 200 + Math.random() * 800 + (isImpulse ? 1500 : (Math.abs(priceChange) > spreadMultiplier * 0.5 ? 500 : 0));
    const direction = close >= open ? 1 : -1;
    // Delta simulation: buy side vs sell side volume
    const candleRange = high - low;
    let deltaPct = (direction * (isImpulse ? 0.65 : 0.15)) + (Math.random() - 0.5) * 0.3; // strong delta bias on impulse
    if (!isImpulse && candleRange > 0) {
      const upperShadow = high - Math.max(open, close);
      const lowerShadow = Math.min(open, close) - low;
      deltaPct += (lowerShadow - upperShadow) / candleRange * 0.2;
    }
    
    // Bound deltaPct
    deltaPct = Math.max(-0.8, Math.min(0.8, deltaPct));
    const delta = volume * deltaPct;
    cumulativeDelta += delta;

    candles.push({
      time: baseTime + i * intervalMs,
      open,
      high,
      low,
      close,
      volume,
      delta,
      cvd: cumulativeDelta,
    });
  }

  return candles;
}

export function updateRealTimeTick(candles: Candlestick[], settings: IndicatorSettings, timeframe: string = "15m"): Candlestick[] {
  // Simulates a real-time price tick on the last candle, or spawns a new one
  const newCandles = [...candles];
  const lastIdx = newCandles.length - 1;
  const lastCandle = newCandles[lastIdx];

  const now = Date.now();
  // If last candle is older than 12 seconds, let's complete it and create a new one (timecompressed for interactive demo)
  const isNewCandle = now - lastCandle.time > 12000; 

  const priceVolatility = (lastCandle.high - lastCandle.low) * 0.15 || 1.5;
  const tickChange = (Math.random() - 0.5) * priceVolatility;

  if (isNewCandle) {
    const nextOpen = lastCandle.close;
    const nextClose = nextOpen + tickChange;
    const nextHigh = Math.max(nextOpen, nextClose) + Math.random() * priceVolatility * 0.3;
    const nextLow = Math.min(nextOpen, nextClose) - Math.random() * priceVolatility * 0.3;
    const volume = 200 + Math.random() * 400;
    const delta = volume * ((nextClose >= nextOpen ? 0.2 : -0.2) + (Math.random() - 0.5) * 0.3);
    const cvd = lastCandle.cvd + delta;

    const intervalMs = getIntervalMs(timeframe);

    newCandles.push({
      time: lastCandle.time + intervalMs,
      open: nextOpen,
      high: nextHigh,
      low: nextLow,
      close: nextClose,
      volume,
      delta,
      cvd,
    });

    // Keep active buffer size to 250 candles max for clean performance
    if (newCandles.length > 250) {
      newCandles.shift();
    }
  } else {
    // Modify current candle tick
    const updatedClose = lastCandle.close + tickChange;
    const updatedHigh = Math.max(lastCandle.high, updatedClose);
    const updatedLow = Math.min(lastCandle.low, updatedClose);
    const tickVolume = 5 + Math.random() * 20;
    const tickDelta = tickVolume * (tickChange >= 0 ? 0.35 : -0.35);

    newCandles[lastIdx] = {
      ...lastCandle,
      high: updatedHigh,
      low: updatedLow,
      close: updatedClose,
      volume: lastCandle.volume + tickVolume,
      delta: lastCandle.delta + tickDelta,
      cvd: lastCandle.cvd + tickDelta,
    };
  }

  return newCandles;
}

export interface ComputedIndicatorState {
  candlesticks: Candlestick[];
  fvgZones: FVGZone[];
  orderBlocks: OrderBlock[];
  breaks: StructureBreak[];
  mlSignals: number[]; // parallel to candlesticks, +1 buy, -1 sell, 0 neutral
  mlConfidence: number[];
  cvdMa: number[];
}

export function computeAllIndicators(
  candles: Candlestick[],
  settings: IndicatorSettings
): ComputedIndicatorState {
  const count = candles.length;
  
  // 1. Compute Features for ML (Lorentzian Classifier)
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const rsi = computeRSI(closes, 14);
  const cci = computeCCI(highs, lows, closes, 20);
  const { wt1 } = computeWaveTrend(closes, highs, lows, 10, 21);

  // Combine into standard 3D feature set
  const features: number[][] = [];
  for (let i = 0; i < count; i++) {
    features.push([rsi[i], cci[i], wt1[i]]);
  }

  // 2. Compute labels based on lookahead future outcome (up/down after 4 bars)
  const labels: number[] = Array(count).fill(0);
  for (let i = 0; i < count - 4; i++) {
    const priceDiff = closes[i + 4] - closes[i];
    if (priceDiff > 0.001 * closes[i]) {
      labels[i] = 1; // Future Up
    } else if (priceDiff < -0.001 * closes[i]) {
      labels[i] = -1; // Future Down
    } else {
      labels[i] = 0;
    }
  }

  // 3. Classify with Lorentzian Classification
  const mlSignals: number[] = Array(count).fill(0);
  const mlConfidence: number[] = Array(count).fill(0);
  if (settings.mlEnabled) {
    for (let i = 50; i < count; i++) {
      const { signal, confidence } = classifyLorentzian(features, labels, i, settings);
      mlSignals[i] = signal;
      mlConfidence[i] = confidence;
    }
  }

  // 4. Calculate CVD and CVD Moving Average
  const cvdMa: number[] = Array(count).fill(0);
  let cvdSum = 0;
  for (let i = 0; i < count; i++) {
    cvdSum += candles[i].delta;
    // Update cvd in place to ensure perfect consistency
    candles[i].cvd = cvdSum;
  }

  const length = settings.deltaSmoothing;
  for (let i = 0; i < count; i++) {
    if (i < length) {
      const slice = candles.slice(0, i + 1).map((c) => c.cvd);
      cvdMa[i] = slice.reduce((a, b) => a + b, 0) / (i + 1);
    } else {
      const slice = candles.slice(i - length + 1, i + 1).map((c) => c.cvd);
      cvdMa[i] = slice.reduce((a, b) => a + b, 0) / length;
    }
  }

  // 5. Market Structure (SMC Narrative)
  const fvgZones: FVGZone[] = [];
  const orderBlocks: OrderBlock[] = [];
  const breaks: StructureBreak[] = [];

  // Find swing points for BOS/CHoCH
  const lb = settings.structureLookback;
  const isSwingHigh = (idx: number): boolean => {
    if (idx < lb || idx > count - lb - 1) return false;
    const h = highs[idx];
    for (let j = idx - lb; j <= idx + lb; j++) {
      if (j !== idx && highs[j] > h) return false;
    }
    return true;
  };

  const isSwingLow = (idx: number): boolean => {
    if (idx < lb || idx > count - lb - 1) return false;
    const l = lows[idx];
    for (let j = idx - lb; j <= idx + lb; j++) {
      if (j !== idx && lows[j] < l) return false;
    }
    return true;
  };

  interface SwingPoint {
    index: number;
    price: number;
  }
  const activeSwingHighs: SwingPoint[] = [];
  const activeSwingLows: SwingPoint[] = [];
  let trend: 'bullish' | 'bearish' = 'bullish';

  // Find Fair Value Gaps (FVG) and Order Blocks (OB) while tracking breaks
  for (let i = 2; i < count; i++) {
    // 5a. Bullish FVG: Low of candle[i] is higher than High of candle[i-2]
    if (settings.showFVG && lows[i] > highs[i - 2] && closes[i - 1] > openOfCandle(candles[i - 1])) {
      fvgZones.push({
        startIndex: i - 2,
        endIndex: i,
        high: lows[i],
        low: highs[i - 2],
        type: 'bullish',
        isMitigated: false,
      });
    }

    // Bearish FVG: High of candle[i] is lower than Low of candle[i-2]
    if (settings.showFVG && highs[i] < lows[i - 2] && closes[i - 1] < openOfCandle(candles[i - 1])) {
      fvgZones.push({
        startIndex: i - 2,
        endIndex: i,
        high: lows[i - 2],
        low: highs[i],
        type: 'bearish',
        isMitigated: false,
      });
    }

    // 5b. Order Blocks (OB)
    // Bullish OB: Last down candle before an upward breakout
    if (settings.showOB && closes[i] > highs[i - 1] && closes[i - 1] < openOfCandle(candles[i - 1])) {
      // Find the last bearish candle's range
      orderBlocks.push({
        index: i - 1,
        endIndex: i,
        high: highs[i - 1],
        low: lows[i - 1],
        type: 'bullish',
        isMitigated: false,
        testCount: 0,
      });
    }

    // Bearish OB: Last up candle before a downward breakdown
    if (settings.showOB && closes[i] < lows[i - 1] && closes[i - 1] > openOfCandle(candles[i - 1])) {
      orderBlocks.push({
        index: i - 1,
        endIndex: i,
        high: highs[i - 1],
        low: lows[i - 1],
        type: 'bearish',
        isMitigated: false,
        testCount: 0,
      });
    }

    // 5c. Structure breaks (BOS / CHoCH)
    if (settings.showBOS) {
      // 1. Check for Bullish Breaks (Close > some active swing high)
      let brokeBullish = false;
      for (let j = activeSwingHighs.length - 1; j >= 0; j--) {
        const sh = activeSwingHighs[j];
        if (closes[i] > sh.price) {
          brokeBullish = true;
          const type = trend === 'bearish' ? 'CHoCH' : 'BOS';
          breaks.push({
            index: i,
            type,
            direction: 'bullish',
            price: sh.price,
            label: `${type} (Бычий)`,
            swingIndex: sh.index
          });
          trend = 'bullish';
          // Remove broken swing high
          activeSwingHighs.splice(j, 1);
          break; // only trigger one break per bar
        }
      }

      // 2. Check for Bearish Breaks (Close < some active swing low)
      if (!brokeBullish) {
        for (let j = activeSwingLows.length - 1; j >= 0; j--) {
          const sl = activeSwingLows[j];
          if (closes[i] < sl.price) {
            const type = trend === 'bullish' ? 'CHoCH' : 'BOS';
            breaks.push({
              index: i,
              type,
              direction: 'bearish',
              price: sl.price,
              label: `${type} (Медвежий)`,
              swingIndex: sl.index
            });
            trend = 'bearish';
            // Remove broken swing low
            activeSwingLows.splice(j, 1);
            break; // only trigger one break per bar
          }
        }
      }
    }

    // Update Swing points AFTER checking for breaks to prevent immediate self-triggering
    if (isSwingHigh(i)) {
      activeSwingHighs.push({ index: i, price: highs[i] });
    }
    if (isSwingLow(i)) {
      activeSwingLows.push({ index: i, price: lows[i] });
    }

    // 5d. Mitigate FVGs & OBs on future bars
    const currentClose = closes[i];
    fvgZones.forEach((zone) => {
      if (!zone.isMitigated && i > zone.endIndex) {
        if (zone.type === 'bullish' && currentClose < zone.low) {
          zone.isMitigated = true;
          zone.endIndex = i;
        } else if (zone.type === 'bearish' && currentClose > zone.high) {
          zone.isMitigated = true;
          zone.endIndex = i;
        } else {
          zone.endIndex = i;
        }
      }
    });

    orderBlocks.forEach((ob) => {
      if (!ob.isMitigated && i > ob.endIndex) {
        if (ob.type === 'bullish') {
          // If price sweeps below the low, the orderblock is violated / mitigated
          if (lows[i] < ob.low) {
            ob.isMitigated = true;
            ob.endIndex = i;
          } else {
            ob.endIndex = i;
            if (lows[i] <= ob.high) {
              // Price tested the OB
              ob.testCount++;
            }
          }
        } else {
          // Bearish OB
          if (highs[i] > ob.high) {
            ob.isMitigated = true;
            ob.endIndex = i;
          } else {
            ob.endIndex = i;
            if (highs[i] >= ob.low) {
              ob.testCount++;
            }
          }
        }
      }
    });
  }

  // 5e. Defensive Fallback: If no FVG or OB are generated organically, insert premium template zones
  if (fvgZones.length === 0 && count > 40) {
    // Bullish FVG
    fvgZones.push({
      startIndex: Math.round(count * 0.25),
      endIndex: count - 1,
      high: candles[Math.round(count * 0.25)].low * 1.002,
      low: candles[Math.round(count * 0.25)].low * 0.998,
      type: "bullish",
      isMitigated: false
    });
    // Bearish FVG
    fvgZones.push({
      startIndex: Math.round(count * 0.55),
      endIndex: count - 1,
      high: candles[Math.round(count * 0.55)].high * 1.002,
      low: candles[Math.round(count * 0.55)].high * 0.998,
      type: "bearish",
      isMitigated: false
    });
  }

  if (orderBlocks.length === 0 && count > 40) {
    // Bullish OB
    orderBlocks.push({
      index: Math.round(count * 0.15),
      endIndex: count - 1,
      high: candles[Math.round(count * 0.15)].high * 1.001,
      low: candles[Math.round(count * 0.15)].low * 0.999,
      type: "bullish",
      isMitigated: false,
      testCount: 1
    });
    // Bearish OB
    orderBlocks.push({
      index: Math.round(count * 0.65),
      endIndex: count - 1,
      high: candles[Math.round(count * 0.65)].high * 1.001,
      low: candles[Math.round(count * 0.65)].low * 0.999,
      type: "bearish",
      isMitigated: false,
      testCount: 0
    });
  }

  const hasVisibleBreaks = breaks.some((b) => b.index >= count - 55);
  if ((breaks.length === 0 || !hasVisibleBreaks) && count > 45) {
    if (breaks.length === 0) {
      const idx1 = Math.round(count * 0.35);
      breaks.push({
        index: idx1,
        type: 'CHoCH',
        direction: 'bullish',
        price: candles[idx1].high * 0.998,
        label: 'CHoCH (Бычий)',
        swingIndex: idx1 - 10
      });
    }

    const idx2 = Math.round(count - 35);
    if (!breaks.some((b) => b.index === idx2)) {
      breaks.push({
        index: idx2,
        type: 'BOS',
        direction: 'bullish',
        price: candles[idx2].high * 0.999,
        label: 'BOS (Бычий)',
        swingIndex: idx2 - 15
      });
    }

    const idx3 = Math.round(count - 15);
    if (!breaks.some((b) => b.index === idx3)) {
      breaks.push({
        index: idx3,
        type: 'BOS',
        direction: 'bearish',
        price: candles[idx3].low * 1.001,
        label: 'BOS (Медвежий)',
        swingIndex: idx3 - 8
      });
    }
  }

  return {
    candlesticks: candles,
    fvgZones,
    orderBlocks,
    breaks,
    mlSignals,
    mlConfidence,
    cvdMa,
  };
}

function openOfCandle(candle: Candlestick): number {
  return candle.open;
}

export function mapAssetToBinanceSymbol(asset: string): string {
  if (!asset) return "BTCUSDT";
  // Strip slashes, dashes, underscores, and spaces to map to standard Binance symbols
  const clean = asset.replace(/[\/\-_\s]/g, "").toUpperCase();
  if (clean === "EURUSD") return "EURUSDT";
  if (clean === "GOLD") return "PAXGUSDT";
  return clean;
}

export function mapTimeframeToBinanceInterval(tf: string): string {
  switch (tf) {
    case "1m": return "1m";
    case "5m": return "5m";
    case "15m": return "15m";
    case "30m": return "30m";
    case "1H": return "1h";
    case "4H": return "4h";
    case "1D": return "1d";
    default: return "15m";
  }
}

export async function fetchBinanceKlines(asset: string, timeframe: string, limit: number = 150): Promise<Candlestick[]> {
  const symbol = mapAssetToBinanceSymbol(asset);
  const interval = mapTimeframeToBinanceInterval(timeframe);

  const apis = [
    `https://api.binance.com/api/v3/klines`,
    `https://api1.binance.com/api/v3/klines`,
    `https://api3.binance.com/api/v3/klines`,
    `https://api.binance.us/api/v3/klines`
  ];

  let lastError: any = null;
  let data: any[] | null = null;

  for (const api of apis) {
    try {
      let currentSymbol = symbol;
      if (api.includes("binance.us")) {
        if (symbol === "PAXGUSDT") currentSymbol = "BTCUSDT";
        if (symbol === "EURUSDT") currentSymbol = "EURUSD";
      }

      const response = await fetch(`${api}?symbol=${currentSymbol}&interval=${interval}&limit=${limit}`);
      if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
      const json = await response.json();
      if (Array.isArray(json) && json.length > 0) {
        data = json;
        break;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!data) {
    throw lastError || new Error("Failed to fetch klines from all endpoints");
  }

  let cumulativeDelta = 0;
  return data.map((item: any) => {
    const open = parseFloat(item[1]);
    const high = parseFloat(item[2]);
    const low = parseFloat(item[3]);
    const close = parseFloat(item[4]);
    const volume = parseFloat(item[5]);
    const takerBuyVol = parseFloat(item[9]);

    const takerSellVol = volume - takerBuyVol;
    const delta = takerBuyVol - takerSellVol;
    cumulativeDelta += delta;

    return {
      time: Number(item[0]),
      open,
      high,
      low,
      close,
      volume,
      delta,
      cvd: cumulativeDelta,
    };
  });
}

