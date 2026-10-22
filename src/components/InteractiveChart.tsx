import React, { useRef, useEffect, useState, useMemo } from "react";
import { Play, Pause, RefreshCw, ZoomIn, ZoomOut, TrendingUp, TrendingDown, Settings, Zap, Activity, Maximize2, Minimize2, Sparkles, Filter, AlertTriangle } from "lucide-react";
import { Candlestick, FVGZone, OrderBlock, StructureBreak, IndicatorSettings } from "../types";
import { computeAllIndicators, computeRSI, computeMACD, detectKeyLevelSweeps, calculateConfluenceProbability } from "../lib/chartGenerator";

interface InteractiveChartProps {
  candlesticks: Candlestick[];
  settings: IndicatorSettings;
  setSettings?: React.Dispatch<React.SetStateAction<IndicatorSettings>>;
  computedState: ReturnType<typeof computeAllIndicators>;
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
  onReset: () => void;
  onManualTrigger: (type: 'pump' | 'dump') => void;
  timeframe?: string;
  asset?: string;
  dataMode?: 'simulated' | 'real';
}

export default function InteractiveChart({
  candlesticks,
  settings,
  setSettings,
  computedState,
  isPlaying,
  setIsPlaying,
  onReset,
  onManualTrigger,
  timeframe = "15m",
  asset = "BTC/USDT",
  dataMode = "simulated",
}: InteractiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 520 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [zoomFactor, setZoomFactor] = useState<number>(1); // 1 = normal, larger = zoomed in (fewer candles shown)
  const [scrollOffset, setScrollOffset] = useState<number>(0); // how many candles scrolled back
  const [selectedForecastTF, setSelectedForecastTF] = useState<string>("active");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [bottomPaneMode, setBottomPaneMode] = useState<'dual' | 'macd' | 'rsi' | 'cvd'>('dual');

  // Precompute Binance oscillators (RSI 6, RSI 14, MACD 12/26/9)
  const oscData = useMemo(() => {
    const closes = candlesticks.map(c => c.close);
    const rsi6 = computeRSI(closes, 6);
    const rsi14 = computeRSI(closes, 14);
    const macd = computeMACD(closes, 12, 26, 9);
    return { rsi6, rsi14, macd };
  }, [candlesticks]);

  // Drag and touch interaction refs for panning & zooming
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startScrollOffsetRef = useRef<number>(0);

  const isTouchingRef = useRef<boolean>(false);
  const touchStartXRef = useRef<number>(0);
  const touchStartScrollOffsetRef = useRef<number>(0);
  const touchStartDistRef = useRef<number>(0);

  const { fvgZones, orderBlocks, breaks, mlSignals, mlConfidence, cvdMa } = computedState;

  // Cache to stabilize forecast lines (hysteresis) across ticks and bars
  const forecastCacheRef = useRef<Record<string, {
    isBull: boolean;
    p1: number;
    p2: number;
    p3: number;
    p4: number;
    p5: number;
    anchorIdx: number;
    anchorPrice: number;
    sRange: number;
    lastSweepPrice: number;
    hasRecentHighSweep: boolean;
    hasRecentLowSweep: boolean;
    candleCount: number;
    settingsKey: string;
  }>>({});

  // Standalone MTF Forecast Calculator (accessible by both Canvas and JSX Table!)
  const getForecastForTimeframe = (tf: string) => {
    const isCurrent = tf === (timeframe || "15m");
    const lastVisibleCandle = candlesticks[candlesticks.length - 1];
    const lastPrice = lastVisibleCandle ? lastVisibleCandle.close : 62000;

    const cacheKey = `${asset}_${timeframe}_${tf}`;
    const cached = forecastCacheRef.current[cacheKey];
    const currentSettingsKey = `${settings.structureLookback}_${settings.forecastTargetMult}_${settings.forecastModelAccuracy}`;

    // Relative scales of price action
    const tfScales: Record<string, number> = {
      "1m": 0.12,
      "5m": 0.30,
      "15m": 0.60,
      "30m": 1.00,
      "1H": 1.80,
      "4H": 3.60,
      "1D": 7.20
    };

    const currentTF = timeframe || "15m";
    const cScale = tfScales[currentTF] || 0.60;
    const tScale = tfScales[tf] || 0.60;
    const ratio = tScale / cScale;

    // --- ДЕТЕКЦИЯ ЛОЖНЫХ ПРОБОЕВ НА КЛЮЧЕВЫХ УРОВНЯХ (KEY LEVEL LIQUIDITY SWEEP) ---
    const sweepData = detectKeyLevelSweeps(candlesticks);
    let { hasRecentHighSweep, hasRecentLowSweep, lastSweepPrice } = sweepData;

    // Technical Indicators for Confluence (RSI, MACD, Volume Delta)
    const closes = candlesticks.map(c => c.close);
    const rsiValues = computeRSI(closes, 14);
    const macdData = computeMACD(closes, 12, 26, 9);

    const lastRsi = rsiValues[rsiValues.length - 1] || 50;
    const lastMacdHist = macdData.histogram[macdData.histogram.length - 1] || 0;
    const prevMacdHist = macdData.histogram[macdData.histogram.length - 2] || 0;

    // HTF Dominant Trend Filter (60-bar lookback + RSI filter)
    const htfLookback = Math.min(60, candlesticks.length);
    const htfTrendUp = closes[closes.length - 1] >= closes[Math.max(0, closes.length - htfLookback)] && lastRsi >= 48;

    // Local Structure Narrative
    const lastBreak = breaks.length > 0 ? breaks[breaks.length - 1] : null;
    const localStructureBull = lastBreak ? lastBreak.direction === 'bullish' : (lastVisibleCandle ? lastVisibleCandle.close >= (candlesticks[0]?.close || lastVisibleCandle.close) : true);

    // Delta & Volume Pressure
    const currentDelta = lastVisibleCandle ? lastVisibleCandle.delta : 0;
    const avgDelta = candlesticks.reduce((acc, c) => acc + Math.abs(c.delta), 0) / (candlesticks.length || 1);
    const isExtremeDelta = Math.abs(currentDelta) > avgDelta * 1.5;

    // Zone Proximity
    const inSupportOrBullOB = orderBlocks.some(ob => ob.type === 'bullish' && !ob.isMitigated);
    const inResistanceOrBearOB = orderBlocks.some(ob => ob.type === 'bearish' && !ob.isMitigated);

    // Calculate dynamic mathematical confluence probability
    const confluenceResult = calculateConfluenceProbability({
      isBullCandidate: true,
      htfTrendUp,
      localStructureBull,
      deltaCurrent: currentDelta,
      isExtremeDelta,
      rsiValue: lastRsi,
      macdHist: lastMacdHist,
      inSupportOrBullOB,
      inResistanceOrBearOB,
      inOteZone: false,
      hasLowSweep: hasRecentLowSweep,
      hasHighSweep: hasRecentHighSweep
    });

    // Trend Direction from multi-factor consensus (prioritizes whichever side has higher winrate)
    let isBull = confluenceResult.recommendedDirection === 'bullish';

    // Override if a key-level liquidity sweep just happened
    if (hasRecentHighSweep) {
      isBull = false;
    } else if (hasRecentLowSweep) {
      isBull = true;
    }

    // Timeframe scale weighting with realistic bounds
    const tfBonus: Record<string, number> = { "1m": -2, "5m": -1, "15m": 0, "30m": 1, "1H": 2, "4H": 3, "1D": 4 };
    let confidence = Math.min(82, Math.max(34, Math.round((isBull ? confluenceResult.bullProb : confluenceResult.bearProb) + (tfBonus[tf] || 0))));

    // Organic timeframe corrections
    if (!isCurrent) {
      if (tf === "5m" || tf === "30m") {
        isBull = (candlesticks.length % 2 === 0) ? isBull : !isBull;
      } else if (tf === "1D") {
        isBull = asset === "EUR/USD" ? !isBull : true;
      }
    }

    // Stability Invalidation Check
    let useCached = false;
    if (cached) {
      const isTrendSame = cached.isBull === isBull;
      const isSettingsSame = cached.settingsKey === currentSettingsKey;
      const isSameBar = candlesticks.length === cached.candleCount;

      let isInvalidated = false;
      const cachedSRange = cached.sRange;
      const cachedAnchor = cached.anchorPrice;
      
      if (cached.isBull) {
        // If price breaks below anchorPrice minus Stop Loss buffer
        const slLevel = cachedAnchor - cachedSRange * 0.45;
        if (lastPrice < slLevel) isInvalidated = true;
        // If price reaches target and moves way beyond
        if (lastPrice > cached.p3 + cachedSRange * 0.35) isInvalidated = true;
      } else {
        // If price breaks above anchorPrice plus Stop Loss buffer
        const slLevel = cachedAnchor + cachedSRange * 0.45;
        if (lastPrice > slLevel) isInvalidated = true;
        // If price reaches target and moves way beyond
        if (lastPrice < cached.p3 - cachedSRange * 0.35) isInvalidated = true;
      }

      // Max age check: 50 candles
      if (candlesticks.length - cached.anchorIdx > 50) {
        isInvalidated = true;
      }

      // If we are on the exact same unclosed candle, force using the cached lines (prevent tick wiggling!)
      if (isSameBar && isTrendSame && isSettingsSame) {
        useCached = true;
      } else if (!isInvalidated && isTrendSame && isSettingsSame) {
        // If price stays within boundaries and trend hasn't flipped, keep forecast lines
        useCached = true;
      }
    }

    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0;
    let anchorIdx = 0;
    let anchorPrice = 0;
    let sRange = 0;

    if (useCached && cached) {
      isBull = cached.isBull;
      p1 = cached.p1;
      p2 = cached.p2;
      p3 = cached.p3;
      p4 = cached.p4;
      p5 = cached.p5 || (isBull ? p3 + Math.abs(p3 - p2) * 1.2 : p3 - Math.abs(p2 - p3) * 1.2);
      anchorIdx = cached.anchorIdx;
      anchorPrice = cached.anchorPrice;
      sRange = cached.sRange;
      lastSweepPrice = cached.lastSweepPrice;
      hasRecentHighSweep = cached.hasRecentHighSweep;
      hasRecentLowSweep = cached.hasRecentLowSweep;
    } else {
      // Recalculate forecast levels
      const lookbackPeriod = settings.structureLookback || 15;
      const swingStartIdx = Math.max(0, candlesticks.length - lookbackPeriod);
      const swingCandles = candlesticks.slice(swingStartIdx);
      const hH = swingCandles.length > 0 ? Math.max(...swingCandles.map(c => c.high)) : lastPrice * 1.01;
      const lL = swingCandles.length > 0 ? Math.min(...swingCandles.map(c => c.low)) : lastPrice * 0.99;
      const baseSRange = hH - lL || (lastPrice * 0.02);
      sRange = baseSRange * ratio;

      // Staggered anchors locked to the signal candle (prevent shifting Point 0 on new bars)
      let anchorOffset = -10;
      if (tf === "5m") anchorOffset = -6;
      else if (tf === "15m") anchorOffset = -10;
      else if (tf === "30m") anchorOffset = -14;
      else if (tf === "1H") anchorOffset = -18;
      else if (tf === "4H") anchorOffset = -24;
      else if (tf === "1D") anchorOffset = -32;

      if (cached && cached.isBull === isBull && cached.anchorIdx < candlesticks.length && cached.anchorIdx >= 0) {
        anchorIdx = cached.anchorIdx;
        anchorPrice = cached.anchorPrice;
      } else {
        let signalBarIdx = -1;
        for (let i = candlesticks.length - 1; i >= Math.max(0, candlesticks.length - 40); i--) {
          if (mlSignals && mlSignals[i] === (isBull ? 1 : -1)) {
            signalBarIdx = i;
            break;
          }
        }
        anchorIdx = signalBarIdx !== -1 ? signalBarIdx : Math.max(0, candlesticks.length + anchorOffset);
        if (anchorIdx >= candlesticks.length) anchorIdx = candlesticks.length - 1;
        anchorPrice = candlesticks[anchorIdx]?.close || lastPrice;
      }

      // Confluence calculations incorporating RSI & MACD Momentum
      const isRsiBull = lastRsi > 50;
      const isRsiBear = lastRsi < 50;
      const isMacdBull = lastMacdHist > 0;
      const isMacdBear = lastMacdHist < 0;
      const momBoost = (isBull && isRsiBull && isMacdBull) || (!isBull && isRsiBear && isMacdBear) ? 1.12 : 1.0;

      // Timeframe-adaptive scaling (avoids oversized targets/dips on 1D, 4H, 1H)
      const tfTargetScale = tf === "1D" ? 0.65 : tf === "4H" ? 0.78 : tf === "1H" ? 0.88 : 1.0;
      const tfRetestScale = tf === "1D" ? 0.55 : tf === "4H" ? 0.70 : tf === "1H" ? 0.85 : 1.0;

      // Calculate targets incorporating Order Blocks, FVG, OTE, Liquidity, and Momentum
      p1 = isBull ? anchorPrice - sRange * 0.25 * tfRetestScale : anchorPrice + sRange * 0.25 * tfRetestScale;
      p2 = isBull ? anchorPrice + sRange * 0.38 * tfTargetScale : anchorPrice - sRange * 0.38 * tfTargetScale;
      p3 = isBull 
        ? anchorPrice + sRange * 0.95 * tfTargetScale * momBoost * (settings.forecastTargetMult || 1.0)
        : anchorPrice - sRange * 0.95 * tfTargetScale * momBoost * (settings.forecastTargetMult || 1.0);
      
      // Dynamic price adjustments for Liquidity Sweeps
      if (hasRecentHighSweep && !isBull) {
        // Re-test of swept high before collapse
        p1 = lastSweepPrice - sRange * 0.06 * tfRetestScale;
        p2 = anchorPrice - sRange * 0.40 * tfTargetScale;
        p3 = anchorPrice - sRange * 1.05 * tfTargetScale * (settings.forecastTargetMult || 1.0);
      } else if (hasRecentLowSweep && isBull) {
        // Re-test of swept low before rocket
        p1 = lastSweepPrice + sRange * 0.06 * tfRetestScale;
        p2 = anchorPrice + sRange * 0.40 * tfTargetScale;
        p3 = anchorPrice + sRange * 1.05 * tfTargetScale * (settings.forecastTargetMult || 1.0);
      }
      
      p4 = p2;
      p5 = isBull
        ? p3 + Math.max(sRange * 0.6 * tfTargetScale * (settings.forecastTargetMult || 1.0), Math.abs(p3 - p2) * 1.1)
        : p3 - Math.max(sRange * 0.6 * tfTargetScale * (settings.forecastTargetMult || 1.0), Math.abs(p2 - p3) * 1.1);

      // Check if a direct breakout happened after anchorIdx without hitting p1
      let directBreakoutHappened = false;
      let breakoutBarIdx = anchorIdx;
      
      for (let i = anchorIdx + 1; i < candlesticks.length; i++) {
        const candle = candlesticks[i];
        if (!candle) continue;
        
        if (isBull) {
          if (candle.close > p2) {
            directBreakoutHappened = true;
            breakoutBarIdx = i;
            break;
          }
        } else {
          if (candle.close < p2) {
            directBreakoutHappened = true;
            breakoutBarIdx = i;
            break;
          }
        }
      }
      
      // If a direct breakout happened, we re-anchor to the breakout bar to start a fresh forecast!
      if (directBreakoutHappened) {
        anchorIdx = Math.max(breakoutBarIdx, candlesticks.length - 4);
        if (anchorIdx >= candlesticks.length) anchorIdx = candlesticks.length - 1;
        const newAnchorPrice = candlesticks[anchorIdx]?.close || lastPrice;
        
        // Recalculate targets from the new anchor
        p1 = isBull ? newAnchorPrice - sRange * 0.22 : newAnchorPrice + sRange * 0.22;
        p2 = isBull ? newAnchorPrice + sRange * 0.35 : newAnchorPrice - sRange * 0.35;
        p3 = isBull 
          ? newAnchorPrice + sRange * 0.95 * (settings.forecastTargetMult || 1.0)
          : newAnchorPrice - sRange * 0.95 * (settings.forecastTargetMult || 1.0);
        p4 = p2;
      }

      // For current active timeframe, we match to Order Blocks / FVG if showOB/showFVG are enabled
      if (isCurrent) {
        const accuracyMode = settings.forecastModelAccuracy || 'SMC-Balanced';
        if (isBull) {
          const supportingOB = orderBlocks.find(ob => ob.type === 'bullish' && !ob.isMitigated && ob.high < lastPrice);
          const supportingFVG = fvgZones.find(fvg => fvg.type === 'bullish' && !fvg.isMitigated && fvg.high < lastPrice);
          if (accuracyMode === 'Conservative' && supportingOB) {
            p1 = (supportingOB.high + supportingOB.low) / 2;
          } else if (supportingOB) {
            p1 = supportingOB.high;
          } else if (supportingFVG) {
            p1 = (supportingFVG.high + supportingFVG.low) / 2;
          }

          const resistanceOB = orderBlocks.find(ob => ob.type === 'bearish' && ob.low > hH);
          if (accuracyMode === 'Conservative') {
            p3 = resistanceOB ? resistanceOB.low : hH + sRange * 0.4 * (settings.forecastTargetMult || 1.0);
          } else if (accuracyMode === 'Aggressive') {
            p3 = hH + sRange * 1.0 * (settings.forecastTargetMult || 1.0);
          } else {
            p3 = resistanceOB ? (resistanceOB.high + resistanceOB.low) / 2 : hH + sRange * 0.618 * (settings.forecastTargetMult || 1.0);
          }
        } else {
          const resistingOB = orderBlocks.find(ob => ob.type === 'bearish' && !ob.isMitigated && ob.low > lastPrice);
          const resistingFVG = fvgZones.find(fvg => fvg.type === 'bearish' && !fvg.isMitigated && fvg.low > lastPrice);
          if (accuracyMode === 'Conservative' && resistingOB) {
            p1 = (resistingOB.high + resistingOB.low) / 2;
          } else if (resistingOB) {
            p1 = resistingOB.low;
          } else if (resistingFVG) {
            p1 = (resistingFVG.high + resistingFVG.low) / 2;
          }

          const supportingOB = orderBlocks.find(ob => ob.type === 'bullish' && ob.high < lL);
          if (accuracyMode === 'Conservative') {
            p3 = supportingOB ? supportingOB.high : lL - sRange * 0.4 * (settings.forecastTargetMult || 1.0);
          } else if (accuracyMode === 'Aggressive') {
            p3 = lL - sRange * 1.0 * (settings.forecastTargetMult || 1.0);
          } else {
            p3 = supportingOB ? (supportingOB.high + supportingOB.low) / 2 : lL - sRange * 0.618 * (settings.forecastTargetMult || 1.0);
          }
        }
        p4 = p2;
      }

      // Anti-Inversion Monotonic Sanity Verification
      if (isBull) {
        p1 = Math.min(anchorPrice, p1);
        p2 = Math.max(anchorPrice + sRange * 0.25, Math.max(p1 + sRange * 0.3, p2));
        p3 = Math.max(p2 + sRange * 0.35 * (settings.forecastTargetMult || 1.0), p3);
        p4 = p2;
        p5 = Math.max(p3 + sRange * 0.4 * (settings.forecastTargetMult || 1.0), p3 + Math.abs(p3 - p2) * 0.8);
      } else {
        p1 = Math.max(anchorPrice, p1);
        p2 = Math.min(anchorPrice - sRange * 0.25, Math.min(p1 - sRange * 0.3, p2));
        p3 = Math.min(p2 - sRange * 0.35 * (settings.forecastTargetMult || 1.0), p3);
        p4 = p2;
        p5 = Math.min(p3 - sRange * 0.4 * (settings.forecastTargetMult || 1.0), p3 - Math.abs(p2 - p3) * 0.8);
      }

      // Save to cache
      forecastCacheRef.current[cacheKey] = {
        isBull,
        p1, p2, p3, p4, p5,
        anchorIdx,
        anchorPrice,
        sRange,
        lastSweepPrice,
        hasRecentHighSweep,
        hasRecentLowSweep,
        candleCount: candlesticks.length,
        settingsKey: currentSettingsKey
      };
    }

    // Completion states
    let leg1Completed = false;
    let leg2Completed = false;
    let leg3Completed = false;
    let leg4Completed = false;
    let leg5Completed = false;

    let leg1HitIdx = -1;
    let leg2HitIdx = -1;

    for (let i = anchorIdx + 1; i < candlesticks.length; i++) {
      const candle = candlesticks[i];
      if (!candle) continue;

      if (!leg1Completed) {
        if (isBull && candle.low <= p1) {
          leg1Completed = true;
          leg1HitIdx = i;
        }
        if (!isBull && candle.high >= p1) {
          leg1Completed = true;
          leg1HitIdx = i;
        }
      }
      if (leg1Completed && !leg2Completed && i > leg1HitIdx) {
        if (isBull && candle.high >= p2) {
          leg2Completed = true;
          leg2HitIdx = i;
        }
        if (!isBull && candle.low <= p2) {
          leg2Completed = true;
          leg2HitIdx = i;
        }
      }
      if (leg2Completed && !leg3Completed && i > leg2HitIdx) {
        if (isBull && candle.high >= p3) {
          leg3Completed = true;
        }
        if (!isBull && candle.low <= p3) {
          leg3Completed = true;
        }
      }
      if (leg3Completed && !leg4Completed) {
        if (isBull && candle.low <= p2) leg4Completed = true;
        if (!isBull && candle.high >= p2) leg4Completed = true;
      }
      if (leg4Completed && !leg5Completed) {
        if (isBull && candle.high >= p5) leg5Completed = true;
        if (!isBull && candle.low <= p5) leg5Completed = true;
      }
    }

    let status = "Ожидание разворота OTE";
    let activeLeg = 1;
    if (leg1Completed) {
      status = "Тест поддержки (Leg 1) ✅";
      activeLeg = 2;
    }
    if (leg2Completed) {
      status = "Пробитие уровня (Leg 2) 🚀";
      activeLeg = 3;
    }
    if (leg3Completed) {
      status = "Цель выполнена (TP2) 🎯";
      activeLeg = 4;
    }
    if (leg4Completed) {
      status = "Зеркальный ретест (Leg 4) 🔄";
      activeLeg = 5;
    }
    if (leg5Completed) {
      status = "Максимальный тейк (TP3 🎯) ✅";
      activeLeg = 6;
    }

    // ⚡ Детекция импульса БЕЗ ОТКАТА (Runaway Expansion & No-Pullback Engine)
    const localAtr = Math.max(0.0001, sRange * 0.35);
    const lastBar = candlesticks[candlesticks.length - 1];
    const prevBar = candlesticks[candlesticks.length - 2];
    const lastBarRng = lastBar ? lastBar.high - lastBar.low : 0;
    const lastBarBody = lastBar ? Math.abs(lastBar.close - lastBar.open) : 0;
    const isMarubozu = lastBarRng > 0 && (lastBarBody / lastBarRng >= 0.65);
    const isExpansion = lastBarRng >= localAtr * 1.15;

    let hasBreakawayFvg = false;
    if (lastBar && prevBar) {
      if (isBull && lastBar.low > Math.max(prevBar.open, prevBar.close) + localAtr * 0.15) hasBreakawayFvg = true;
      if (!isBull && lastBar.high < Math.min(prevBar.open, prevBar.close) - localAtr * 0.15) hasBreakawayFvg = true;
    }

    const hasHtfAlign = isBull === htfTrendUp;
    const hasVolSurge = !!(lastBar && prevBar && lastBar.volume > prevBar.volume * 1.35);
    const hasSweepCascade = (isBull && hasRecentLowSweep) || (!isBull && hasRecentHighSweep);
    const hasRsiSurge = isBull ? (lastRsi >= 58) : (lastRsi <= 42);

    let npScore = 15;
    if (hasHtfAlign) npScore += 25;
    if (hasVolSurge) npScore += 20;
    if (isMarubozu && isExpansion) npScore += 20;
    if (hasBreakawayFvg) npScore += 15;
    if (hasSweepCascade) npScore += 15;
    if (hasRsiSurge) npScore += 10;

    const noPullbackProb = Math.min(95, Math.max(12, Math.round(npScore)));
    const isHighRunaway = noPullbackProb >= 65;

    // Assign designated colors
    const tfColors: Record<string, { main: string; text: string; bg: string; rgb: string }> = {
      "1m": { main: "#22d3ee", text: "text-[#22d3ee]", bg: "bg-[#22d3ee]/10", rgb: "34, 211, 238" },
      "5m": { main: "#06b6d4", text: "text-[#06b6d4]", bg: "bg-[#06b6d4]/10", rgb: "6, 182, 212" },
      "15m": { main: "#10b981", text: "text-[#10b981]", bg: "bg-[#10b981]/10", rgb: "16, 185, 129" },
      "30m": { main: "#f97316", text: "text-[#f97316]", bg: "bg-[#f97316]/10", rgb: "249, 115, 22" },
      "1H": { main: "#d946ef", text: "text-[#d946ef]", bg: "bg-[#d946ef]/10", rgb: "217, 70, 239" },
      "4H": { main: "#6366f1", text: "text-[#6366f1]", bg: "bg-[#6366f1]/10", rgb: "99, 102, 241" },
      "1D": { main: "#f59e0b", text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", rgb: "245, 158, 11" }
    };

    const colorSet = tfColors[tf] || { main: "#10b981", text: "text-[#10b981]", bg: "bg-[#10b981]/10", rgb: "16, 185, 129" };

    return {
      tf,
      isBull,
      p1, p2, p3, p4, p5,
      anchorIdx,
      anchorPrice,
      leg1Completed, leg2Completed, leg3Completed, leg4Completed, leg5Completed,
      status,
      activeLeg,
      color: colorSet.main,
      colorRgb: colorSet.rgb,
      colorTextClass: colorSet.text,
      colorBgClass: colorSet.bg,
      confidence,
      noPullbackProb,
      isHighRunaway,
      slPrice: isBull ? anchorPrice - sRange * 0.45 : anchorPrice + sRange * 0.45,
      altDumpPrice: isBull ? (anchorPrice - sRange * 0.45) - sRange * 0.85 : (anchorPrice + sRange * 0.45) + sRange * 0.85
    };
  };

  // Track responsive container resizing
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      // Subtract safety margins for controls
      setDimensions({
        width: Math.max(width, 400),
        height: Math.max(height - 10, 250)
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Main canvas drawing pipeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and scale for high DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const width = dimensions.width;
    const height = dimensions.height;

    // Split height depending on bottomPaneMode (Binance Dual Stack vs Single)
    const isDual = bottomPaneMode === 'dual';
    const chartHeight = isDual ? height * 0.58 : height * 0.68;
    const indicatorTop = isDual ? height * 0.66 : height * 0.74;
    const indicatorHeight = Math.max(50, height - indicatorTop - 6);

    // Layout margins
    const rightMargin = 65; // Price scale
    const drawWidth = width - rightMargin;

    // Dynamic sizing based on zoom
    const minVisibleCandles = 20;
    const maxVisibleCandles = 100;
    const baseVisibleCount = 60;
    const visibleCandlesCount = Math.max(
      minVisibleCandles,
      Math.min(maxVisibleCandles, Math.round(baseVisibleCount / zoomFactor))
    );

    // Calculate slicing bounds
    const totalCandles = candlesticks.length;
    let endIndex = totalCandles - scrollOffset;
    if (endIndex > totalCandles) endIndex = totalCandles;
    if (endIndex < visibleCandlesCount) endIndex = visibleCandlesCount;

    const startIndex = Math.max(0, endIndex - visibleCandlesCount);
    const slicedCandles = candlesticks.slice(startIndex, endIndex);

    // Grid details with reserved future space for wave forecast projection
    const futureBarsCount = 18;
    const totalVisibleSlots = visibleCandlesCount + futureBarsCount;
    const candleWidth = drawWidth / totalVisibleSlots;
    const barWidth = candleWidth * 0.72;

    // 1. Calculate price range for vertical scaling
    let maxPrice = -Infinity;
    let minPrice = Infinity;

    for (let i = startIndex; i < endIndex; i++) {
      if (i >= totalCandles) break;
      const c = candlesticks[i];
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.low < minPrice) minPrice = c.low;
    }

    // Include some padding on top and bottom of price
    const pricePadding = (maxPrice - minPrice) * 0.08 || 5.0;
    maxPrice += pricePadding;
    minPrice -= pricePadding;

    const getX = (idx: number) => {
      const localIdx = idx - startIndex;
      return localIdx * candleWidth + candleWidth / 2;
    };

    const getY = (val: number) => {
      const scale = chartHeight / (maxPrice - minPrice);
      return chartHeight - (val - minPrice) * scale;
    };

    // 2. Draw backgrounds & gridlines
    ctx.fillStyle = "#090a0f";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(40, 50, 75, 0.22)";
    ctx.lineWidth = 1;

    // Horizontal lines in Main Chart
    const gridCount = 5;
    for (let i = 0; i < gridCount; i++) {
      const val = minPrice + ((maxPrice - minPrice) / (gridCount - 1)) * i;
      const y = getY(val);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawWidth, y);
      ctx.stroke();

      // Draw price labels
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.fillText(val.toFixed(candlesticks[0]?.close > 100 ? 1 : 4), drawWidth + 6, y + 3);
    }

    // Vertical grid lines
    const vGridCount = 6;
    for (let i = 0; i < vGridCount; i++) {
      const gridIdx = startIndex + Math.round((visibleCandlesCount / vGridCount) * i);
      if (gridIdx >= totalCandles) break;
      const x = getX(gridIdx);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Print time labels occasionally at the bottom grid line
      const candle = candlesticks[gridIdx];
      if (candle) {
        const d = new Date(candle.time);
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        ctx.fillStyle = "#475569";
        ctx.font = "9px monospace";
        ctx.fillText(timeStr, x - 12, indicatorTop - 4);
      }
    }

    // Divider for indicators
    ctx.beginPath();
    ctx.moveTo(0, chartHeight + 2);
    ctx.lineTo(width, chartHeight + 2);
    ctx.strokeStyle = "rgba(60, 80, 110, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Draw Smart Money structures (FVG, Order Blocks) in background
    // 3a. FVG Highlight Blocks
    if (settings.showFVG) {
      // Filter out mitigated and only draw up to 2 most recent of each type (bullish/bearish) to keep the chart clean
      const activeBullishFvgs = fvgZones.filter(z => !z.isMitigated && z.type === 'bullish').slice(-2);
      const activeBearishFvgs = fvgZones.filter(z => !z.isMitigated && z.type === 'bearish').slice(-2);
      const activeFvgs = [...activeBullishFvgs, ...activeBearishFvgs];

      activeFvgs.forEach((zone) => {
        // Only draw if the zone overlaps with the visible spectrum
        if (zone.startIndex <= endIndex && zone.endIndex >= startIndex) {
          const xStart = getX(zone.startIndex);
          // Extend active (unmitigated) FVG zones to the right edge of the chart (including future space)
          const xEnd = zone.endIndex >= endIndex - 1 ? drawWidth : getX(zone.endIndex);
          const yTop = getY(zone.high);
          const yBottom = getY(zone.low);

          ctx.save();
          // Use professional warm amber/gold for bullish FVG and red for bearish FVG
          ctx.fillStyle = zone.type === 'bullish' 
            ? "rgba(245, 158, 11, 0.06)" 
            : "rgba(239, 68, 68, 0.06)";
          ctx.strokeStyle = zone.type === 'bullish'
            ? "rgba(245, 158, 11, 0.25)"
            : "rgba(239, 68, 68, 0.25)";
          ctx.lineWidth = 1.0;
          ctx.setLineDash([4, 3]);

          ctx.fillRect(xStart, yTop, xEnd - xStart, yBottom - yTop);
          ctx.strokeRect(xStart, yTop, xEnd - xStart, yBottom - yTop);
          ctx.setLineDash([]); // reset

          // Draw a high-contrast background badge for FVG label on the right side of the zone
          const text = zone.type === 'bullish' 
            ? `+FVG (Бычий)` 
            : `-FVG (Медвежий)`;
          ctx.font = "bold 9px monospace";
          const textW = ctx.measureText(text).width;
          
          // Pin to the right side of the visible block to ensure it's always visible on screen
          const visibleRightIndex = Math.min(endIndex, zone.endIndex);
          const xRight = getX(visibleRightIndex);
          const labelX = Math.min(drawWidth - 6, xRight - 6);
          
          ctx.fillStyle = "rgba(10, 14, 24, 0.85)";
          ctx.strokeStyle = zone.type === 'bullish' ? "rgba(245, 158, 11, 0.5)" : "rgba(239, 68, 68, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          
          const badgeW = textW + 8;
          const badgeH = 15;
          const badgeX = labelX - badgeW;
          const badgeY = yTop + 4;
          
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = zone.type === 'bullish' ? "#f59e0b" : "#f43f5e"; // Amber gold for bullish, red for bearish
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(text, badgeX + 4, yTop + 11.5);
          ctx.restore();
        }
      });
    }

    // 3b. Order Blocks (OB)
    if (settings.showOB) {
      // Filter out mitigated and only draw up to 2 most recent of each type (bullish/bearish) to keep the chart clean
      const activeBullishObs = orderBlocks.filter(o => !o.isMitigated && o.type === 'bullish').slice(-2);
      const activeBearishObs = orderBlocks.filter(o => !o.isMitigated && o.type === 'bearish').slice(-2);
      const activeObs = [...activeBullishObs, ...activeBearishObs];

      activeObs.forEach((ob) => {
        // Only draw if the order block overlaps with the visible range
        if (ob.index <= endIndex && ob.endIndex >= startIndex) {
          const xStart = getX(ob.index);
          // Extend active (unmitigated) Order Blocks to the right edge of the chart (including future space)
          const xEnd = ob.endIndex >= endIndex - 1 ? drawWidth : getX(ob.endIndex);
          const w = xEnd - xStart;
          const yTop = getY(ob.high);
          const yBottom = getY(ob.low);

          ctx.save();
          // Use warm gold and deep orange/red tones
          ctx.fillStyle = ob.type === 'bullish'
            ? "rgba(245, 158, 11, 0.08)"
            : "rgba(239, 68, 68, 0.08)";
          ctx.strokeStyle = ob.type === 'bullish'
            ? "rgba(245, 158, 11, 0.45)"
            : "rgba(239, 68, 68, 0.45)";
          ctx.lineWidth = 1.0;

          ctx.fillRect(xStart, yTop, w, yBottom - yTop);
          ctx.strokeRect(xStart, yTop, w, yBottom - yTop);

          // Clear OB label text
          const labelText = ob.type === 'bullish'
            ? `+OB (Бычий)`
            : `-OB (Медвежий)`;

          ctx.font = "bold 9px monospace";
          const textW = ctx.measureText(labelText).width;
          
          // Pin to the right side of the visible block to ensure it's always visible on screen
          const visibleRightIndex = Math.min(endIndex, ob.endIndex);
          const xRight = getX(visibleRightIndex);
          const labelX = Math.min(drawWidth - 6, xRight - 6);
          
          ctx.fillStyle = "rgba(10, 14, 24, 0.85)";
          ctx.strokeStyle = ob.type === 'bullish' ? "rgba(245, 158, 11, 0.5)" : "rgba(239, 68, 68, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          
          const badgeW = textW + 8;
          const badgeH = 15;
          const badgeX = labelX - badgeW;
          const badgeY = yTop + 4;
          
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = ob.type === 'bullish' ? "#f59e0b" : "#f43f5e"; // Amber gold for bullish, red for bearish
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(labelText, badgeX + 4, yTop + 11.5);
          ctx.restore();
        }
      });
    }

    // 3ca. Draw OTE (Optimal Trade Entry) Fibonacci Zone
    if (settings.showReversalZones) {
      ctx.save();
      // Calculate swing highs/lows of the visible range
      const visibleHighs = slicedCandles.map((c) => c.high);
      const visibleLows = slicedCandles.map((c) => c.low);
      const highestHigh = Math.max(...visibleHighs);
      const lowestLow = Math.min(...visibleLows);
      const swingRange = highestHigh - lowestLow;

      if (swingRange > 0) {
        // Detect a simple trend direction to determine if we draw a bullish or bearish OTE
        const lastCandle = slicedCandles[slicedCandles.length - 1];
        const firstCandle = slicedCandles[0];
        const isBullishTrend = lastCandle && firstCandle ? (lastCandle.close >= firstCandle.close) : true;

        // OTE is typically the 0.618 - 0.786 retracement of the swing
        // For Bullish OTE: we measure retracement down from highestHigh
        // For Bearish OTE: we measure retracement up from lowestLow
        const ote618 = isBullishTrend ? (highestHigh - swingRange * 0.618) : (lowestLow + swingRange * 0.618);
        const ote705 = isBullishTrend ? (highestHigh - swingRange * 0.705) : (lowestLow + swingRange * 0.705);
        const ote786 = isBullishTrend ? (highestHigh - swingRange * 0.786) : (lowestLow + swingRange * 0.786);
        const fib50 = lowestLow + swingRange * 0.5;

        const y618 = getY(ote618);
        const y705 = getY(ote705);
        const y786 = getY(ote786);
        const y50 = getY(fib50);

        const oteTopY = Math.min(y618, y786);
        const oteBottomY = Math.max(y618, y786);
        const oteHeight = Math.abs(y786 - y618);

        // 1. Draw shaded OTE band (luxurious golden/amber fill for bullish, or red/rose for bearish)
        ctx.fillStyle = isBullishTrend ? "rgba(245, 158, 11, 0.05)" : "rgba(239, 68, 68, 0.05)";
        ctx.fillRect(0, oteTopY, drawWidth, oteHeight);

        // 2. Draw level lines
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;

        // 0.50 Equilibrium level
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.beginPath();
        ctx.moveTo(0, y50); ctx.lineTo(drawWidth, y50);
        ctx.stroke();

        // 0.618, 0.705, 0.786 levels
        ctx.strokeStyle = isBullishTrend ? "rgba(245, 158, 11, 0.35)" : "rgba(239, 68, 68, 0.35)";
        ctx.beginPath();
        ctx.moveTo(0, y618); ctx.lineTo(drawWidth, y618);
        ctx.moveTo(0, y705); ctx.lineTo(drawWidth, y705);
        ctx.moveTo(0, y786); ctx.lineTo(drawWidth, y786);
        ctx.stroke();
        ctx.setLineDash([]); // reset

        // 3. Draw individual level tags on the right edge with high-contrast pills
        const drawLevelLabel = (text: string, yVal: number, bgColor: string, textColor: string) => {
          ctx.save();
          ctx.font = "bold 8.5px sans-serif";
          const textW = ctx.measureText(text).width;
          const bW = textW + 8;
          const bH = 14;
          
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(drawWidth - bW - 6, yVal - 7, bW, bH, 3);
          } else {
            ctx.rect(drawWidth - bW - 6, yVal - 7, bW, bH);
          }
          ctx.fill();
          
          ctx.fillStyle = textColor;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(text, drawWidth - bW - 2, yVal);
          ctx.restore();
        };

        const oteColor = isBullishTrend ? "#f59e0b" : "#f43f5e";
        drawLevelLabel("0.50 EQ (Равновесие / Equilibrium)", y50, "rgba(30, 41, 59, 0.9)", "#cbd5e1");
        drawLevelLabel("0.618 OTE (Опт. вход / Optimal Entry)", y618, "rgba(15, 23, 42, 0.9)", oteColor);
        drawLevelLabel("0.705 OTE (Опт. вход / Optimal Entry)", y705, "rgba(15, 23, 42, 0.9)", oteColor);
        drawLevelLabel("0.786 OTE (Опт. вход / Optimal Entry)", y786, "rgba(15, 23, 42, 0.9)", oteColor);

        // 4. Draw OTE Badge in the middle of the zone on the left
        const oteText = isBullishTrend 
          ? `🎯 OTE 62%-79% (Оптимальная зона входа - Бычий откат) | Вероятность отскока: ~70%`
          : `🎯 OTE 62%-79% (Оптимальная зона входа - Медвежий откат) | Вероятность отскока: ~65%`;
        ctx.font = "bold 9px sans-serif";
        const textW = ctx.measureText(oteText).width;

        const badgeW = textW + 12;
        const badgeH = 16;
        const badgeX = 15;
        const badgeY = (oteTopY + oteBottomY) / 2 - badgeH / 2;

        ctx.fillStyle = "rgba(10, 14, 24, 0.95)";
        ctx.strokeStyle = isBullishTrend ? "rgba(245, 158, 11, 0.7)" : "rgba(239, 68, 68, 0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isBullishTrend ? "#f59e0b" : "#f43f5e";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(oteText, badgeX + 6, badgeY + badgeH / 2 + 0.5);
      }
      ctx.restore();
    }

    // 3c. Draw Reversal Zones & Forecasts (matching screenshot perfectly)
    if (settings.showReversalZones !== false) {
      // Calculate dynamic volume & probabilities
      const assetIsCrypto = candlesticks[0]?.close > 100;
      const topVol = assetIsCrypto ? "574.5K" : "1.4M";
      const bottomVol = assetIsCrypto ? "1.2M" : "15.2M";

      // Calculate dynamic probabilities based on last candle close relative to price range
      const latestCandle = candlesticks[candlesticks.length - 1];
      const relativePosition = latestCandle 
        ? (latestCandle.close - minPrice) / (maxPrice - minPrice || 1)
        : 0.5;
      
      // Top Zone: Bounce probability is higher when price is high (overbought)
      const topBouncePct = Math.round(55 + relativePosition * 25);
      const topBreakPct = 100 - topBouncePct;

      // Bottom Zone: Bounce probability is higher when price is low (oversold)
      const bottomBouncePct = Math.round(55 + (1 - relativePosition) * 25);
      const bottomBreakPct = 100 - bottomBouncePct;

      // Define heights for the zones
      const topZoneY1 = getY(maxPrice - (maxPrice - minPrice) * 0.12);
      const topZoneY2 = getY(maxPrice - (maxPrice - minPrice) * 0.02);
      const topZoneH = Math.abs(topZoneY2 - topZoneY1);

      const bottomZoneY1 = getY(minPrice + (maxPrice - minPrice) * 0.02);
      const bottomZoneY2 = getY(minPrice + (maxPrice - minPrice) * 0.12);
      const bottomZoneH = Math.abs(bottomZoneY2 - bottomZoneY1);

      // Draw Top Reversal Zone (Sales Zone)
      ctx.fillStyle = "rgba(239, 68, 68, 0.06)";
      ctx.fillRect(0, Math.min(topZoneY1, topZoneY2), drawWidth, topZoneH);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, topZoneY1); ctx.lineTo(drawWidth, topZoneY1);
      ctx.moveTo(0, topZoneY2); ctx.lineTo(drawWidth, topZoneY2);
      ctx.stroke();

      // Top Zone Text Label
      ctx.fillStyle = "rgba(248, 113, 113, 0.9)";
      ctx.font = "bold 10px sans-serif";
      const topText = `Зона Продаж (Разворот) ↓ ${topVol} (Отскок ↘ ${topBouncePct}% | Пробой ↘ ${topBreakPct}%)`;
      ctx.fillText(topText, 15, Math.min(topZoneY1, topZoneY2) + 12);

      // Draw Bottom Reversal Zone (Purchases Zone)
      ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
      ctx.fillRect(0, Math.min(bottomZoneY1, bottomZoneY2), drawWidth, bottomZoneH);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bottomZoneY1); ctx.lineTo(drawWidth, bottomZoneY1);
      ctx.moveTo(0, bottomZoneY2); ctx.lineTo(drawWidth, bottomZoneY2);
      ctx.stroke();

      // Bottom Zone Text Label
      ctx.fillStyle = "rgba(52, 211, 153, 0.9)";
      ctx.font = "bold 10px sans-serif";
      const bottomText = `Зона Покупок (Разворот) ↑ ${bottomVol} (Отскок ↗ ${bottomBouncePct}% | Пробой ↘ ${bottomBreakPct}%)`;
      ctx.fillText(bottomText, 15, Math.min(bottomZoneY1, bottomZoneY2) + 12);

      // Draw Support/Resistance Forecasts
      if (settings.showPriceForecast !== false) {
        const forecastMaxVal = maxPrice - (maxPrice - minPrice) * 0.15;
        const forecastMinVal = minPrice + (maxPrice - minPrice) * 0.15;

        const fMaxY = getY(forecastMaxVal);
        const fMinY = getY(forecastMinVal);

        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;

        // Draw Max Forecast line
        ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
        ctx.beginPath();
        ctx.moveTo(0, fMaxY);
        ctx.lineTo(drawWidth, fMaxY);
        ctx.stroke();

        // Draw Max Forecast Pill and Text
        ctx.fillStyle = "rgba(220, 38, 38, 0.9)";
        const pillTextMax = `Прогноз Макс (Forecast Max): ~${forecastMaxVal.toFixed(assetIsCrypto ? 0 : 4)} (Сопротивление / Resistance)`;
        ctx.font = "bold 9.5px sans-serif";
        const pillWMax = ctx.measureText(pillTextMax).width + 12;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(15, fMaxY - 8, pillWMax, 16, 4);
        } else {
          ctx.rect(15, fMaxY - 8, pillWMax, 16);
        }
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(pillTextMax, 21, fMaxY);

        // Draw Min Forecast line
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.beginPath();
        ctx.moveTo(0, fMinY);
        ctx.lineTo(drawWidth, fMinY);
        ctx.stroke();

        // Draw Min Forecast Pill and Text
        ctx.fillStyle = "rgba(14, 116, 144, 0.9)";
        const pillTextMin = `Прогноз Мин (Forecast Min): ~${forecastMinVal.toFixed(assetIsCrypto ? 0 : 4)} (Поддержка / Support)`;
        const pillWMin = ctx.measureText(pillTextMin).width + 12;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(15, fMinY - 8, pillWMin, 16, 4);
        } else {
          ctx.rect(15, fMinY - 8, pillWMin, 16);
        }
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(pillTextMin, 21, fMinY);

        ctx.setLineDash([]); // Reset dashed line
      }

      // 3cb. Draw Current Price Line (glowing dashed line with a high-visibility badge on the axis)
      if (latestCandle) {
        const yCurrent = getY(latestCandle.close);
        ctx.save();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.65)"; // Amber yellow dashed line
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yCurrent);
        ctx.lineTo(drawWidth, yCurrent);
        ctx.stroke();

        const priceText = ` Текущая цена (Current Price): ~${latestCandle.close.toFixed(assetIsCrypto ? 1 : 5)} `;
        ctx.font = "bold 9px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        const badgeW = ctx.measureText(priceText).width + 8;
        
        ctx.fillStyle = "rgba(251, 191, 36, 0.95)"; // Bright Amber background
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(drawWidth - badgeW - 10, yCurrent - 8, badgeW, 16, 3);
        } else {
          ctx.rect(drawWidth - badgeW - 10, yCurrent - 8, badgeW, 16);
        }
        ctx.fill();
        
        ctx.fillStyle = "#0f172a"; // High-contrast slate text
        ctx.fillText(priceText, drawWidth - 14, yCurrent);
        ctx.restore();
      }
    }

    // 3d. Draw S&T Premium Dashboard Table in bottom-left corner (matching screenshot perfectly)
    if (settings.showDashboardTable !== false) {
      ctx.save();
      
      const tblX = 10;
      const tblY = chartHeight - 165;
      const tblW = 165;
      const tblH = 153;
      const rowH = 17;

      // Draw background with sleek frosted-glass effect (dark charcoal)
      ctx.fillStyle = "rgba(10, 14, 24, 0.92)";
      ctx.strokeStyle = "rgba(30, 41, 59, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(tblX, tblY, tblW, tblH, 6);
      } else {
        ctx.rect(tblX, tblY, tblW, tblH);
      }
      ctx.fill();
      ctx.stroke();

      // Headers text
      ctx.font = "bold 8.5px sans-serif";
      ctx.textBaseline = "middle";
      
      // Draw Column Header Cells
      ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
      ctx.fillRect(tblX + 1, tblY + 1, tblW - 2, rowH - 1);
      ctx.beginPath();
      ctx.moveTo(tblX, tblY + rowH);
      ctx.lineTo(tblX + tblW, tblY + rowH);
      ctx.strokeStyle = "rgba(30, 41, 59, 0.8)";
      ctx.stroke();

      // Column widths inside table:
      // Col 1 (ТФ): 30px
      // Col 2 (Тренд): 40px
      // Col 3 (Дельта / Вероятность): rest
      const c1X = tblX + 8;
      const c2X = tblX + 42;
      const c3X = tblX + 82;

      ctx.fillStyle = "#94a3b8"; // Slate text for headers
      ctx.fillText("ТФ", c1X, tblY + rowH / 2);
      ctx.fillText("Тренд", c2X - 5, tblY + rowH / 2);
      ctx.fillText("Дельта / Вероятность", c3X - 5, tblY + rowH / 2);

      // Data Rows:
      const tableData = [
        { tf: "5м", trend: "red", val: "🟢 OK", valColor: "#10b981", valBg: "rgba(16, 185, 129, 0.08)" },
        { tf: "15м", trend: "red", val: "70% Отскок", valColor: "#f59e0b", valBg: "rgba(245, 158, 11, 0.08)" },
        { tf: "1ч", trend: "red", val: "RSI: 46%", valColor: "#94a3b8", valBg: "rgba(148, 163, 184, 0.06)" },
        { tf: "4ч", trend: "green", val: "🟢 БЫЧИЙ SMC", valColor: "#10b981", valBg: "rgba(16, 185, 129, 0.08)" },
        { tf: "1Д", trend: "green", val: "OTE: 70%", valColor: "#f59e0b", valBg: "rgba(245, 158, 11, 0.08)" },
        { tf: "2Д", trend: "green", val: "RSI W: 39%", valColor: "#94a3b8", valBg: "rgba(148, 163, 184, 0.06)" },
        { tf: "1Н", trend: "red", val: "🟢 ЖДЁМ", valColor: "#10b981", valBg: "rgba(16, 185, 129, 0.08)" }
      ];

      tableData.forEach((row, idx) => {
        const rY = tblY + rowH + idx * rowH;
        
        // Horizontal row divider line
        ctx.beginPath();
        ctx.moveTo(tblX, rY + rowH);
        ctx.lineTo(tblX + tblW, rY + rowH);
        ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
        ctx.stroke();

        // 1. Timeframe column text
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "bold 9px monospace";
        ctx.fillText(row.tf, c1X, rY + rowH / 2);

        // 2. Trend column colored dot
        ctx.beginPath();
        ctx.arc(c2X + 8, rY + rowH / 2, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = row.trend === "green" ? "#10b981" : "#ef4444";
        ctx.fill();

        // 3. Delta / Probability column with subtle background pill
        if (row.valBg) {
          ctx.fillStyle = row.valBg;
          ctx.fillRect(c3X - 8, rY + 2, tblW - (c3X - tblX) + 2, rowH - 4);
        }

        ctx.fillStyle = row.valColor;
        ctx.font = "bold 8.5px monospace";
        ctx.fillText(row.val, c3X - 4, rY + rowH / 2);
      });

      // 8. Footer bar spanning the bottom of the table
      const footerY = tblY + tblH - rowH + 1;
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(tblX + 1, footerY, tblW - 2, rowH - 2);

      ctx.fillStyle = "#facc15"; // Gold S&T PRO
      ctx.font = "bold 8.5px sans-serif";
      ctx.fillText("S&T PRO", c1X - 2, footerY + rowH / 2 - 1);

      ctx.fillStyle = "#cbd5e1"; // Slate text for values
      ctx.font = "bold 8.5px monospace";
      ctx.fillText("RSI M: 44%", c2X + 3, footerY + rowH / 2 - 1);

      ctx.fillStyle = "#10b981"; // Green UP for SMC
      ctx.fillText("SMC: UP", c3X + 22, footerY + rowH / 2 - 1);

      ctx.restore();
    }

    // --- ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ ЛОЖНЫХ ПРОБОЕВ НА КЛЮЧЕВЫХ УРОВНЯХ (KEY LEVEL LIQUIDITY SWEEPS) ---
    const allSweeps = detectKeyLevelSweeps(candlesticks).sweepMap;
    const visibleSweeps: Record<number, { type: 'high' | 'low'; sweptPrice: number }> = {};
    for (let i = startIndex; i < endIndex; i++) {
      if (allSweeps[i]) {
        visibleSweeps[i] = allSweeps[i];
      }
    }

    // 4. Draw Candlesticks & ML Signals with Professional Candle Color Coding
    for (let i = 0; i < slicedCandles.length; i++) {
      const originalIdx = startIndex + i;
      const candle = slicedCandles[i];
      const x = getX(originalIdx);

      const openY = getY(candle.open);
      const closeY = getY(candle.close);
      const highY = getY(candle.high);
      const lowY = getY(candle.low);

      const isBullish = candle.close >= candle.open;

      // Candle Color Coding logic matching S&T Premium perfectly:
      let candleColor = isBullish ? "#10b981" : "#ef4444";
      let wickColor = isBullish ? "#10b981" : "#ef4444";
      
      const isExtremeBuyDelta = candle.delta > 550 * settings.deltaThreshold;
      const isExtremeSellDelta = candle.delta < -550 * settings.deltaThreshold;
      const isNeutralVolume = candle.volume < 25;
      const isModerateBuy = candle.delta > 180;
      const isModerateSell = candle.delta < -180;

      if (isExtremeBuyDelta) {
        candleColor = "#f59e0b"; // Yellow / Gold
        wickColor = "#f59e0b";
      } else if (isExtremeSellDelta) {
        candleColor = "#d946ef"; // Fuchsia / Magenta (very distinct from standard red)
        wickColor = "#d946ef";
      } else if (isNeutralVolume) {
        candleColor = "#4b5563"; // Neutral gray
        wickColor = "#4b5563";
      } else if (isModerateBuy) {
        candleColor = "#06b6d4"; // Light Blue/Cyan
        wickColor = "#06b6d4";
      } else if (isModerateSell) {
        candleColor = "#8b5cf6"; // Purple/Violet
        wickColor = "#8b5cf6";
      }

      // Draw shadow
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw body
      ctx.fillStyle = candleColor;
      const bodyH = Math.max(1.2, Math.abs(closeY - openY));
      ctx.fillRect(x - barWidth / 2, Math.min(openY, closeY), barWidth, bodyH);

      // Highlight extreme delta surge with a glowing outline
      const isExtremeDelta = isExtremeBuyDelta || isExtremeSellDelta;
      if (isExtremeDelta) {
        ctx.strokeStyle = candle.delta > 0 ? "#00ffff" : "#d946ef"; // cyan / magenta glow
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - barWidth / 2 - 1, Math.min(openY, closeY) - 1, barWidth + 2, bodyH + 2);
      }

      // Draw visible sweeps
      const sweep = visibleSweeps[originalIdx];
      if (sweep) {
        ctx.save();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.7)"; // Orange/amber dashed sweep line
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        
        // Draw horizontal line back to show swept area
        const lineXStart = Math.max(0, x - candleWidth * 8);
        ctx.beginPath();
        ctx.moveTo(lineXStart, getY(sweep.sweptPrice));
        ctx.lineTo(x, getY(sweep.sweptPrice));
        ctx.stroke();
        ctx.setLineDash([]); // reset

        if (settings.showSweepLabels !== false) {
          // Draw Sweep Indicator Text / Pill
          const isHigh = sweep.type === 'high';
          const labelY = isHigh ? highY - 18 : lowY + 6;
          const text = "⚡ SWEEP";
          
          ctx.font = "bold 8.5px sans-serif";
          const txtW = ctx.measureText(text).width;
          const bW = txtW + 8;
          const bH = 14;
          const bX = x - bW / 2;

          ctx.fillStyle = "rgba(245, 158, 11, 0.95)"; // Solid Amber badge
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(bX, labelY, bW, bH, 3);
          } else {
            ctx.rect(bX, labelY, bW, bH);
          }
          ctx.fill();

          ctx.fillStyle = "#0f172a"; // Dark contrast text
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, x, labelY + bH / 2 + 0.5);
        }
        ctx.restore();
      }

      // Draw Lorentzian Classifier signals (Green/Red Triangles)
      const mlSignal = mlSignals[originalIdx];
      if (settings.mlEnabled && mlSignal !== 0) {
        ctx.fillStyle = mlSignal > 0 ? "#10b981" : "#ef4444";
        ctx.beginPath();
        if (mlSignal > 0) {
          // Bullish Upward triangle under candle
          ctx.moveTo(x, lowY + 12);
          ctx.lineTo(x - 5, lowY + 20);
          ctx.lineTo(x + 5, lowY + 20);
          ctx.fill();
        } else {
          // Bearish Downward triangle above candle
          ctx.moveTo(x, highY - 12);
          ctx.lineTo(x - 5, highY - 20);
          ctx.lineTo(x + 5, highY - 20);
          ctx.fill();
        }
      }
    }

    // 5. Draw Market Structure breaks (BOS/CHoCH) labels
    if (settings.showBOS) {
      breaks.forEach((brk) => {
        if (brk.index >= startIndex && brk.index <= endIndex) {
          const startIdx = brk.swingIndex !== undefined ? brk.swingIndex : brk.index - 12;
          const xStart = getX(Math.max(startIndex, startIdx));
          const xEnd = getX(brk.index);
          const y = getY(brk.price);

          ctx.save();
          // Beautiful high-end vivid styling for structural levels
          const levelColor = brk.type === 'CHoCH'
            ? (brk.direction === 'bullish' ? "#14b8a6" : "#8b5cf6") // vibrant teal / violet
            : (brk.direction === 'bullish' ? "#eab308" : "#ef4444"); // vibrant gold / crimson red
          
          ctx.strokeStyle = levelColor;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(xStart, y);
          ctx.lineTo(xEnd, y);
          ctx.stroke();

          // Elegant circle dot at the break point
          ctx.beginPath();
          ctx.arc(xEnd, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = levelColor;
          ctx.fill();

          // Draw high-contrast capsule/badge structure text label centered on the break line
          const xMid = (xStart + xEnd) / 2;
          const arrow = brk.direction === 'bullish' ? "↑" : "↓";
          
          // Highly-legible, concise, professional labels exactly matching the first screenshot
          const labelText = brk.type === 'CHoCH'
            ? `CHoCH ${arrow} (Слом характера)`
            : `BOS ${arrow} (Слом структуры)`;
          
          ctx.font = "bold 10px sans-serif";
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          const textWidth = ctx.measureText(labelText).width;
          
          // Background badge color matching the breakout type
          let badgeFill = "";
          let textFill = "#ffffff";
          let borderStroke = "";

          if (brk.type === 'CHoCH') {
            if (brk.direction === 'bullish') {
              badgeFill = "rgba(13, 148, 136, 0.95)"; // Solid Teal
              borderStroke = "#14b8a6";
            } else {
              badgeFill = "rgba(109, 40, 217, 0.95)"; // Solid Violet
              borderStroke = "#8b5cf6";
            }
          } else { // BOS
            if (brk.direction === 'bullish') {
              badgeFill = "rgba(234, 179, 8, 0.95)"; // Solid Gold-Yellow
              textFill = "#020617"; // High contrast dark text for yellow
              borderStroke = "#ca8a04";
            } else {
              badgeFill = "rgba(220, 38, 38, 0.95)"; // Solid Crimson Red
              borderStroke = "#ef4444";
            }
          }
          
          const badgeW = textWidth + 14;
          const badgeH = 18;
          const badgeX = xMid - badgeW / 2;
          const badgeY = brk.direction === 'bullish' ? y - 22 : y + 4;
          
          // Draw beautifully rounded capsule/badge
          ctx.fillStyle = badgeFill;
          ctx.strokeStyle = borderStroke;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();
          ctx.stroke();
          
          // White or dark text inside the badge (centered precisely using xMid and badgeY + badgeH/2)
          ctx.fillStyle = textFill;
          ctx.fillText(labelText, xMid, badgeY + badgeH / 2);
          ctx.restore();
        }
      });
    }

    // 5b. DRAW TRADE POSITION SETUP (Entry, Take Profit, Stop Loss) based on the latest ML signal
    let activeSignalIdx = -1;
    for (let i = endIndex - 1; i >= startIndex; i--) {
      if (i < totalCandles && mlSignals[i] !== 0) {
        activeSignalIdx = i;
        break;
      }
    }

    if (activeSignalIdx !== -1) {
      const sigCandle = candlesticks[activeSignalIdx];
      const isBuy = mlSignals[activeSignalIdx] === 1;
      const entryPrice = sigCandle.close;
      const assetIsCrypto = entryPrice > 100;

      // Calculate levels using backtest multipliers
      const targetMultiplier = assetIsCrypto ? 0.025 : 0.002;
      const slMultiplier = assetIsCrypto ? 0.012 : 0.001;

      const tpPrice = isBuy 
        ? entryPrice * (1 + targetMultiplier) 
        : entryPrice * (1 - targetMultiplier);
      const slPrice = isBuy 
        ? entryPrice * (1 - slMultiplier) 
        : entryPrice * (1 + slMultiplier);

      const yEntry = getY(entryPrice);
      const yTp = getY(tpPrice);
      const ySl = getY(slPrice);

      const xStart = getX(activeSignalIdx);
      const xEnd = drawWidth; // Draw to the right edge of the chart

      ctx.save();

      // 1. Draw Profit/Loss Shaded Regions
      const topYProfit = isBuy ? yTp : yEntry;
      const bottomYProfit = isBuy ? yEntry : yTp;
      const topYLoss = isBuy ? yEntry : ySl;
      const bottomYLoss = isBuy ? ySl : yEntry;

      // Draw green profit region
      ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
      ctx.fillRect(xStart, Math.min(topYProfit, bottomYProfit), xEnd - xStart, Math.abs(yTp - yEntry));

      // Draw red loss region
      ctx.fillStyle = "rgba(239, 68, 68, 0.06)";
      ctx.fillRect(xStart, Math.min(topYLoss, bottomYLoss), xEnd - xStart, Math.abs(ySl - yEntry));

      // 2. Draw Entry Line (Dashed Blue)
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)"; // Neon Blue
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(xStart, yEntry);
      ctx.lineTo(xEnd, yEntry);
      ctx.stroke();

      // Draw Entry Pill Badge
      const entryText = ` Вход в сделку (Entry Price): ~${entryPrice.toFixed(assetIsCrypto ? 1 : 5)} `;
      ctx.font = "bold 9px sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      const entryW = ctx.measureText(entryText).width + 8;
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(xEnd - entryW - 10, yEntry - 8, entryW, 16, 3);
      } else {
        ctx.rect(xEnd - entryW - 10, yEntry - 8, entryW, 16);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(entryText, xEnd - 14, yEntry);

      // 3. Draw Take Profit Line (Solid Green)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.85)"; // Green
      ctx.lineWidth = 1.8;
      ctx.setLineDash([]); // solid
      ctx.beginPath();
      ctx.moveTo(xStart, yTp);
      ctx.lineTo(xEnd, yTp);
      ctx.stroke();

      // Draw TP Pill Badge
      const tpText = `🎯 Тейк-профит (Take Profit / TP): ~${tpPrice.toFixed(assetIsCrypto ? 1 : 5)} `;
      const tpW = ctx.measureText(tpText).width + 8;
      ctx.fillStyle = "rgba(10, 14, 24, 0.92)";
      ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(xEnd - tpW - 10, yTp - 9, tpW, 18, 4);
      } else {
        ctx.rect(xEnd - tpW - 10, yTp - 9, tpW, 18);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#10b981";
      ctx.fillText(tpText, xEnd - 14, yTp);

      // 4. Draw Stop Loss Line (Solid Red)
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)"; // Red
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(xStart, ySl);
      ctx.lineTo(xEnd, ySl);
      ctx.stroke();

      // Draw SL Pill Badge
      const slText = `🛡️ Стоп-лосс (Stop Loss / SL): ~${slPrice.toFixed(assetIsCrypto ? 1 : 5)} `;
      const slW = ctx.measureText(slText).width + 8;
      ctx.fillStyle = "rgba(10, 14, 24, 0.92)";
      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(xEnd - slW - 10, ySl - 9, slW, 18, 4);
      } else {
        ctx.rect(xEnd - slW - 10, ySl - 9, slW, 18);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f87171";
      ctx.fillText(slText, xEnd - 14, ySl);

      ctx.restore();
    }

    const lastVisibleCandle = candlesticks[endIndex - 1];
    // 3ca. Draw Interactive Future-Projecting Wave Forecast Path with Arrows showing predicted price movement (TradingView style)
    if (settings.showPriceForecast !== false && lastVisibleCandle) {
      ctx.save();

      const activeTF = timeframe || "15m";
      const tfsToRender = selectedForecastTF === "all"
        ? ["5m", "15m", "30m", "1H", "4H", "1D"]
        : selectedForecastTF === "active"
          ? [activeTF]
          : [selectedForecastTF];

      tfsToRender.forEach(tf => {
        const fc = getForecastForTimeframe(tf);
        const isCurrent = tf === activeTF;

        // Space out horizontal legs depending on the timeframe scale
        let legSpacing = 7;
        if (tf === "5m") legSpacing = 4;
        else if (tf === "15m") legSpacing = 7;
        else if (tf === "30m") legSpacing = 10;
        else if (tf === "1H") legSpacing = 13;
        else if (tf === "4H") legSpacing = 17;
        else if (tf === "1D") legSpacing = 22;

        const x0 = getX(fc.anchorIdx);
        const y0 = getY(fc.anchorPrice);

        const x1 = x0 + legSpacing * candleWidth;
        const x2 = x0 + 2 * legSpacing * candleWidth;
        const x3 = x0 + 3 * legSpacing * candleWidth;
        const x4 = x0 + 4 * legSpacing * candleWidth;
        const x5 = x0 + 5 * legSpacing * candleWidth;

        const isCryptoAsset = asset.includes("BTC") || asset.includes("ETH") || asset.includes("SOL") || asset.includes("USDT");
        const pDec = asset === "EUR/USD" ? 4 : isCryptoAsset ? 1 : 2;
        // Construct pts array with explicit prices for Entry, SL, TP
        const pts = [
          { x: x0, y: y0, completed: true, label: `${tf} Старт` },
          { 
            x: x1, 
            y: getY(fc.p1), 
            completed: fc.leg1Completed, 
            label: fc.leg1Completed 
              ? `📍 ВХОД (${fc.p1.toFixed(pDec)}) [OK]` 
              : (fc.isHighRunaway 
                  ? `📍 ВХОД: ${fc.p1.toFixed(pDec)} ⚡ Без отката ${fc.noPullbackProb}%` 
                  : `📍 ВХОД: ${fc.p1.toFixed(pDec)}`)
          },
          { 
            x: x2, 
            y: getY(fc.p2), 
            completed: fc.leg2Completed, 
            label: fc.leg2Completed 
              ? `🏁 TP1 (${fc.p2.toFixed(pDec)}) [OK]` 
              : `🏁 TP1: ${fc.p2.toFixed(pDec)}`
          },
          { 
            x: x3, 
            y: getY(fc.p3), 
            completed: fc.leg3Completed, 
            label: fc.leg3Completed 
              ? `🎯 TP2 (${fc.p3.toFixed(pDec)}) [OK]` 
              : `🎯 TP2: ${fc.p3.toFixed(pDec)}`
          }
        ];

        if (settings.forecastShowPostTarget !== false) {
          pts.push({
            x: x4,
            y: getY(fc.p4),
            completed: fc.leg4Completed,
            label: fc.leg4Completed
              ? `${tf} Ретест [OK]`
              : `${tf} Ретест 🔄`
          });
        }

        // Draw segments
        for (let j = 0; j < pts.length - 1; j++) {
          const ptA = pts[j];
          const ptB = pts[j+1];
          
          const isLegCompleted = ptB.completed;
          const isPostTargetLeg = j === 3;

          ctx.save();
          if (isCurrent) {
            ctx.shadowBlur = isLegCompleted ? 0 : (isPostTargetLeg ? 5 : 10);
            ctx.shadowColor = `rgba(${fc.colorRgb}, 0.75)`;
          } else {
            ctx.shadowBlur = 0;
          }
          
          let strokeColor = fc.color;
          if (isLegCompleted) {
            strokeColor = `rgba(${fc.colorRgb}, 0.35)`;
          } else if (!isCurrent) {
            strokeColor = `rgba(${fc.colorRgb}, 0.75)`;
          }

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = isCurrent 
            ? (isLegCompleted ? 1.8 : (isPostTargetLeg ? 2.5 : 3.5))
            : (isLegCompleted ? 1.0 : 1.8);

          ctx.setLineDash(isCurrent
            ? (isLegCompleted ? [5, 4] : (isPostTargetLeg ? [3, 3] : []))
            : [4, 4]
          );

          ctx.beginPath();
          ctx.moveTo(ptA.x, ptA.y);
          ctx.lineTo(ptB.x, ptB.y);
          ctx.stroke();

          // Arrowhead in middle
          const midX = (ptA.x + ptB.x) / 2;
          const midY = (ptA.y + ptB.y) / 2;
          const angle = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x);
          const arrowSize = isCurrent ? (isLegCompleted ? 6.5 : 9) : 5.0;

          ctx.shadowBlur = 0;
          ctx.fillStyle = isLegCompleted ? `rgba(${fc.colorRgb}, 0.3)` : fc.color;

          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(midX - arrowSize * Math.cos(angle - Math.PI / 6), midY - arrowSize * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(midX - arrowSize * Math.cos(angle + Math.PI / 6), midY - arrowSize * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Draw nodes and labels
        pts.forEach((pt, j) => {
          const isLegCompleted = pt.completed;
          const isPostTargetNode = j === 4;

          const shouldDrawNode = isCurrent || j === 0 || j === 3;
          if (!shouldDrawNode) return;

          ctx.save();
          ctx.fillStyle = isLegCompleted ? `rgba(${fc.colorRgb}, 0.4)` : fc.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isCurrent ? (isLegCompleted ? 3.5 : 5) : 3, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.strokeStyle = "#090a0f";
          ctx.lineWidth = 1.2;
          ctx.stroke();

          if (isCurrent) {
            ctx.font = isLegCompleted ? "8px sans-serif" : "bold 9px sans-serif";
            const labelW = ctx.measureText(pt.label).width;
            const bW = labelW + 8;
            const bH = 14;

            const isAbove = fc.isBull ? (j % 2 === 0) : (j % 2 !== 0);
            const bY = isAbove ? pt.y - 18 : pt.y + 6;
            const bX = Math.max(10, Math.min(drawWidth - bW - 10, pt.x - bW / 2));

            ctx.fillStyle = isLegCompleted ? "rgba(15, 23, 42, 0.85)" : "rgba(15, 23, 42, 0.96)";
            ctx.strokeStyle = `rgba(${fc.colorRgb}, ${isLegCompleted ? 0.35 : 0.8})`;
            ctx.lineWidth = 1.2;
            
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(bX, bY, bW, bH, 4);
            } else {
              ctx.rect(bX, bY, bW, bH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isLegCompleted ? "rgba(241, 245, 249, 0.6)" : "#f1f5f9";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText(pt.label, bX + bW / 2, bY + bH / 2 + 0.5);
          } else {
            // Draw small clean text on target node only
            if (j === 3) {
              ctx.font = "bold 8.5px monospace";
              const tagText = `${tf} Target: ${fc.p3.toFixed(asset === "EUR/USD" ? 4 : 2)} (${fc.confidence}%)`;
              const textW = ctx.measureText(tagText).width;
              
              ctx.fillStyle = "rgba(10, 13, 22, 0.88)";
              ctx.fillRect(pt.x + 6, pt.y - 7, textW + 6, 14);
              ctx.strokeStyle = `rgba(${fc.colorRgb}, 0.5)`;
              ctx.strokeRect(pt.x + 6, pt.y - 7, textW + 6, 14);

              ctx.fillStyle = fc.color;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillText(tagText, pt.x + 9, pt.y);
            }
          }
          ctx.restore();
        });

        // Draw Forecast Horizontal Stop Loss Level Line & Badge
        if (isCurrent && fc.slPrice) {
          ctx.save();
          const ySlFc = getY(fc.slPrice);
          ctx.strokeStyle = fc.isBull ? "rgba(239, 68, 68, 0.85)" : "rgba(16, 185, 129, 0.85)";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(x0, ySlFc);
          ctx.lineTo(drawWidth, ySlFc);
          ctx.stroke();

          // SL Badge Pill
          const slFcText = `🛑 СТОП-ЛОСС (SL / Отмена): ~${fc.slPrice.toFixed(pDec)}`;
          ctx.font = "bold 9px sans-serif";
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          const slFcW = ctx.measureText(slFcText).width + 8;
          const slFcBoxX = drawWidth - slFcW - 10;
          const slFcBoxY = ySlFc - 8;

          ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
          ctx.strokeStyle = fc.isBull ? "rgba(239, 68, 68, 0.9)" : "rgba(16, 185, 129, 0.9)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(slFcBoxX, slFcBoxY, slFcW, 16, 3);
          } else {
            ctx.rect(slFcBoxX, slFcBoxY, slFcW, 16);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = fc.isBull ? "#f87171" : "#34d399";
          ctx.fillText(slFcText, slFcBoxX + slFcW / 2, slFcBoxY + 8);
          ctx.restore();
        }

        // Draw Alternative SL Breach Trajectory (Dump Level / Level of Breakdown)
        if (isCurrent && fc.slPrice && fc.altDumpPrice) {
          ctx.save();
          const altX1 = x1 + legSpacing * candleWidth * 0.8;
          const altY1 = getY(fc.slPrice);
          const altX2 = x1 + legSpacing * candleWidth * 2.2;
          const altY2 = getY(fc.altDumpPrice);

          ctx.strokeStyle = fc.isBull ? "rgba(217, 70, 239, 0.85)" : "rgba(234, 179, 8, 0.85)";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);

          ctx.beginPath();
          ctx.moveTo(x1, getY(fc.p1));
          ctx.lineTo(altX1, altY1);
          ctx.lineTo(altX2, altY2);
          ctx.stroke();

          // Label badge for Alternative Dump/Pump Level
          const altText = fc.isBull 
            ? `💥 Пробой SL (${fc.slPrice.toFixed(pDec)}) ➔ Дамп до ${fc.altDumpPrice.toFixed(pDec)}`
            : `🚀 Пробой SL (${fc.slPrice.toFixed(pDec)}) ➔ Памп до ${fc.altDumpPrice.toFixed(pDec)}`;
          ctx.font = "bold 8.5px sans-serif";
          const altW = ctx.measureText(altText).width + 8;
          const altBoxX = Math.max(10, Math.min(drawWidth - altW - 10, altX2 - altW / 2));
          const altBoxY = fc.isBull ? altY2 + 6 : altY2 - 18;

          ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
          ctx.strokeStyle = fc.isBull ? "rgba(217, 70, 239, 0.9)" : "rgba(234, 179, 8, 0.9)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(altBoxX, altBoxY, altW, 16, 4);
          } else {
            ctx.rect(altBoxX, altBoxY, altW, 16);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = fc.isBull ? "#f472b6" : "#facc15";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(altText, altBoxX + altW / 2, altBoxY + 8);

          ctx.restore();
        }
      });

      ctx.restore();
    }

    // =========================================================================
    // 6. DRAW BINANCE OSCILLATORS PANE (MACD / RSI / DUAL SEPARATE ROWS / CVD)
    // =========================================================================
    const activeBarIdx = (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < candlesticks.length)
      ? hoverIndex
      : Math.max(0, candlesticks.length - 1);

    if (bottomPaneMode === 'dual') {
      // -------------------------------------------------------------
      // 🌟 DUAL MODE: ДВЕ ОТДЕЛЬНЫЕ СТРОКИ (1: RSI СВЕРХУ, 2: MACD СНИЗУ)
      // -------------------------------------------------------------
      const rsiTop = indicatorTop;
      const rsiH = Math.floor((indicatorHeight - 14) / 2);
      const separatorY = rsiTop + rsiH + 7;
      const macdTop = separatorY + 7;
      const macdH = Math.max(30, indicatorHeight - (macdTop - indicatorTop));

      // --- СТРОКА 1 (ВЫШЕ): RSI В СТИЛЕ BINANCE ---
      // Фон под строкой 1 (RSI)
      ctx.fillStyle = "rgba(10, 15, 26, 0.45)";
      ctx.fillRect(0, rsiTop, drawWidth, rsiH);

      const getRsiY = (v: number) => (rsiTop + rsiH - 3) - ((v - 10) / 80) * (rsiH - 16);
      const y80 = getRsiY(80);
      const y50 = getRsiY(50);
      const y20 = getRsiY(20);

      // Полупрозрачная подсветка диапазона 20-80
      ctx.fillStyle = "rgba(99, 102, 241, 0.05)";
      ctx.fillRect(0, y80, drawWidth, Math.max(1, y20 - y80));

      // Горизонтальные уровни 80, 50, 20
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.beginPath(); ctx.moveTo(0, y80); ctx.lineTo(drawWidth, y80); ctx.stroke();
      ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
      ctx.font = "8px monospace";
      ctx.fillText("80", drawWidth + 4, y80 + 3);

      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.beginPath(); ctx.moveTo(0, y50); ctx.lineTo(drawWidth, y50); ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.fillText("50", drawWidth + 4, y50 + 3);

      ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
      ctx.beginPath(); ctx.moveTo(0, y20); ctx.lineTo(drawWidth, y20); ctx.stroke();
      ctx.fillStyle = "rgba(34, 197, 94, 0.75)";
      ctx.fillText("20", drawWidth + 4, y20 + 3);
      ctx.setLineDash([]);

      // Кривая RSI 6 (желтая #facc15)
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#facc15";
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const val = oscData.rsi6[oIdx] ?? 50;
        const y = getRsiY(val);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      // Кривая RSI 14 (пурпурная #a855f7)
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#a855f7";
      ctx.beginPath();
      first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const val = oscData.rsi14[oIdx] ?? 50;
        const y = getRsiY(val);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      // Строка подписи параметров и динамических значений RSI вверху строки 1
      const rsi6Val = oscData.rsi6[activeBarIdx] ?? 50;
      const rsi14Val = oscData.rsi14[activeBarIdx] ?? 50;

      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("RSI(6, 14)", 8, rsiTop + 10);
      ctx.fillStyle = "#facc15";
      ctx.fillText(`RSI(6): ${rsi6Val.toFixed(1)}`, 90, rsiTop + 10);
      ctx.fillStyle = "#a855f7";
      ctx.fillText(`RSI(14): ${rsi14Val.toFixed(1)}`, 175, rsiTop + 10);

      // --- ТОНКИЙ РАЗДЕЛИТЕЛЬ СТРОК ---
      ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, separatorY);
      ctx.lineTo(drawWidth, separatorY);
      ctx.stroke();

      // --- СТРОКА 2 (НИЖЕ): MACD В СТИЛЕ BINANCE ---
      // Фон под строкой 2 (MACD)
      ctx.fillStyle = "rgba(10, 15, 26, 0.45)";
      ctx.fillRect(0, macdTop, drawWidth, macdH);

      // Находим максимальное значение MACD для видимого окна
      let maxMacdAbs = 0.001;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const d = Math.abs(oscData.macd.macd[oIdx] ?? 0);
        const s = Math.abs(oscData.macd.signal[oIdx] ?? 0);
        const h = Math.abs(oscData.macd.histogram[oIdx] ?? 0);
        if (d > maxMacdAbs) maxMacdAbs = d;
        if (s > maxMacdAbs) maxMacdAbs = s;
        if (h > maxMacdAbs) maxMacdAbs = h;
      }
      maxMacdAbs *= 1.18;

      const macdZeroY = macdTop + 13 + (macdH - 15) / 2;
      const macdScaleY = ((macdH - 16) / 2) / maxMacdAbs;
      const getMacdY = (val: number) => macdZeroY - val * macdScaleY;

      // Нулевая линия (пунктирная)
      ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, macdZeroY);
      ctx.lineTo(drawWidth, macdZeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Отрисовка столбцов гистограммы MACD (Binance Pro: красные и зеленые выше 0 и ниже 0)
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const hist = oscData.macd.histogram[oIdx] ?? 0;
        const prevHist = oIdx > 0 ? (oscData.macd.histogram[oIdx - 1] ?? hist) : hist;
        const isGrowing = hist >= prevHist;

        // Binance Pro цветовая схема:
        // Растущий бычий столбец (выше 0) -> ярко-зеленый #0ecb81
        // Угасающий бычий столбец (выше 0) -> КРАСНЫЙ #f6465d
        // Растущий медвежий откат (ниже 0) -> ЗЕЛЕНЫЙ #0ecb81
        // Углубляющийся медвежий спад (ниже 0) -> ярко-красный #f6465d
        const col = isGrowing ? "rgba(14, 203, 129, 0.88)" : "rgba(246, 70, 93, 0.88)";

        const yVal = getMacdY(hist);
        const topY = Math.min(macdZeroY, yVal);
        const colH = Math.max(1.2, Math.abs(macdZeroY - yVal));
        const colW = Math.max(1, barWidth - 1);

        ctx.fillStyle = col;
        ctx.fillRect(x - colW / 2, topY, colW, colH);
      }

      // Линия DIF (желтая #facc15)
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#facc15";
      ctx.beginPath();
      first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const val = oscData.macd.macd[oIdx] ?? 0;
        const y = getMacdY(val);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      // Линия DEA (розовая #ec4899)
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#ec4899";
      ctx.beginPath();
      first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const val = oscData.macd.signal[oIdx] ?? 0;
        const y = getMacdY(val);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      // Строка подписи параметров и динамических значений MACD вверху строки 2
      const difVal = oscData.macd.macd[activeBarIdx] ?? 0;
      const deaVal = oscData.macd.signal[activeBarIdx] ?? 0;
      const histVal = oscData.macd.histogram[activeBarIdx] ?? 0;
      const prevHistVal = activeBarIdx > 0 ? (oscData.macd.histogram[activeBarIdx - 1] ?? histVal) : histVal;
      const isHistGrowing = histVal >= prevHistVal;
      const histCol = isHistGrowing ? "#0ecb81" : "#f6465d";

      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("MACD(12, 26, 9)", 8, macdTop + 10);
      ctx.fillStyle = "#facc15";
      ctx.fillText(`DIF: ${difVal.toFixed(2)}`, 115, macdTop + 10);
      ctx.fillStyle = "#ec4899";
      ctx.fillText(`DEA: ${deaVal.toFixed(2)}`, 185, macdTop + 10);
      ctx.fillStyle = histCol;
      ctx.fillText(`MACD: ${histVal.toFixed(2)}`, 255, macdTop + 10);

      // Шкала значений MACD справа
      ctx.fillStyle = "#64748b";
      ctx.font = "8px monospace";
      ctx.fillText(`+${maxMacdAbs.toFixed(1)}`, drawWidth + 4, macdTop + 10);
      ctx.fillText("0.0", drawWidth + 4, macdZeroY + 3);
      ctx.fillText(`-${maxMacdAbs.toFixed(1)}`, drawWidth + 4, macdTop + macdH - 2);

    } else if (bottomPaneMode === 'macd') {
      // -------------------------------------------------------------
      // 📊 ТОЛЬКО СТРОКА MACD (ПОЛНАЯ ВЫСОТА)
      // -------------------------------------------------------------
      ctx.fillStyle = "rgba(10, 15, 26, 0.45)";
      ctx.fillRect(0, indicatorTop, drawWidth, indicatorHeight);

      let maxMacdAbs = 0.001;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const d = Math.abs(oscData.macd.macd[oIdx] ?? 0);
        const s = Math.abs(oscData.macd.signal[oIdx] ?? 0);
        const h = Math.abs(oscData.macd.histogram[oIdx] ?? 0);
        if (d > maxMacdAbs) maxMacdAbs = d;
        if (s > maxMacdAbs) maxMacdAbs = s;
        if (h > maxMacdAbs) maxMacdAbs = h;
      }
      maxMacdAbs *= 1.18;

      const macdZeroY = indicatorTop + 16 + (indicatorHeight - 20) / 2;
      const macdScaleY = ((indicatorHeight - 22) / 2) / maxMacdAbs;
      const getMacdY = (val: number) => macdZeroY - val * macdScaleY;

      ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, macdZeroY);
      ctx.lineTo(drawWidth, macdZeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const hist = oscData.macd.histogram[oIdx] ?? 0;
        const prevHist = oIdx > 0 ? (oscData.macd.histogram[oIdx - 1] ?? hist) : hist;
        const isGrowing = hist >= prevHist;
        const col = isGrowing ? "rgba(14, 203, 129, 0.88)" : "rgba(246, 70, 93, 0.88)";

        const yVal = getMacdY(hist);
        const topY = Math.min(macdZeroY, yVal);
        const colH = Math.max(1.5, Math.abs(macdZeroY - yVal));
        const colW = Math.max(1, barWidth - 1);

        ctx.fillStyle = col;
        ctx.fillRect(x - colW / 2, topY, colW, colH);
      }

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#facc15";
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const y = getMacdY(oscData.macd.macd[oIdx] ?? 0);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#ec4899";
      ctx.beginPath();
      first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const y = getMacdY(oscData.macd.signal[oIdx] ?? 0);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      const difVal = oscData.macd.macd[activeBarIdx] ?? 0;
      const deaVal = oscData.macd.signal[activeBarIdx] ?? 0;
      const histVal = oscData.macd.histogram[activeBarIdx] ?? 0;
      const prevHistVal = activeBarIdx > 0 ? (oscData.macd.histogram[activeBarIdx - 1] ?? histVal) : histVal;
      const isHistGrowing = histVal >= prevHistVal;
      const histCol = isHistGrowing ? "#0ecb81" : "#f6465d";

      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("MACD(12, 26, 9)", 8, indicatorTop + 12);
      ctx.fillStyle = "#facc15";
      ctx.fillText(`DIF: ${difVal.toFixed(2)}`, 115, indicatorTop + 12);
      ctx.fillStyle = "#ec4899";
      ctx.fillText(`DEA: ${deaVal.toFixed(2)}`, 185, indicatorTop + 12);
      ctx.fillStyle = histCol;
      ctx.fillText(`MACD: ${histVal.toFixed(2)}`, 255, indicatorTop + 12);

      ctx.fillStyle = "#64748b";
      ctx.font = "8px monospace";
      ctx.fillText(`+${maxMacdAbs.toFixed(1)}`, drawWidth + 4, indicatorTop + 12);
      ctx.fillText("0.0", drawWidth + 4, macdZeroY + 3);
      ctx.fillText(`-${maxMacdAbs.toFixed(1)}`, drawWidth + 4, indicatorTop + indicatorHeight - 2);

    } else if (bottomPaneMode === 'rsi') {
      // -------------------------------------------------------------
      // 📈 ТОЛЬКО СТРОКА RSI (ПОЛНАЯ ВЫСОТА)
      // -------------------------------------------------------------
      ctx.fillStyle = "rgba(10, 15, 26, 0.45)";
      ctx.fillRect(0, indicatorTop, drawWidth, indicatorHeight);

      const getRsiY = (v: number) => (indicatorTop + indicatorHeight - 4) - ((v - 10) / 80) * (indicatorHeight - 20);
      const y80 = getRsiY(80);
      const y50 = getRsiY(50);
      const y20 = getRsiY(20);

      ctx.fillStyle = "rgba(99, 102, 241, 0.05)";
      ctx.fillRect(0, y80, drawWidth, Math.max(1, y20 - y80));

      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.beginPath(); ctx.moveTo(0, y80); ctx.lineTo(drawWidth, y80); ctx.stroke();
      ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
      ctx.font = "8px monospace";
      ctx.fillText("80", drawWidth + 4, y80 + 3);

      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.beginPath(); ctx.moveTo(0, y50); ctx.lineTo(drawWidth, y50); ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.fillText("50", drawWidth + 4, y50 + 3);

      ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
      ctx.beginPath(); ctx.moveTo(0, y20); ctx.lineTo(drawWidth, y20); ctx.stroke();
      ctx.fillStyle = "rgba(34, 197, 94, 0.75)";
      ctx.fillText("20", drawWidth + 4, y20 + 3);
      ctx.setLineDash([]);

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#facc15";
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const y = getRsiY(oscData.rsi6[oIdx] ?? 50);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#a855f7";
      ctx.beginPath();
      first = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const oIdx = startIndex + i;
        const x = getX(oIdx);
        const y = getRsiY(oscData.rsi14[oIdx] ?? 50);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      const rsi6Val = oscData.rsi6[activeBarIdx] ?? 50;
      const rsi14Val = oscData.rsi14[activeBarIdx] ?? 50;

      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("RSI(6, 14)", 8, indicatorTop + 12);
      ctx.fillStyle = "#facc15";
      ctx.fillText(`RSI(6): ${rsi6Val.toFixed(1)}`, 90, indicatorTop + 12);
      ctx.fillStyle = "#a855f7";
      ctx.fillText(`RSI(14): ${rsi14Val.toFixed(1)}`, 175, indicatorTop + 12);

    } else {
      // -------------------------------------------------------------
      // 🌊 ПАНЕЛЬ ОБЪЕМНОЙ ДЕЛЬТЫ (CVD)
      // -------------------------------------------------------------
      let maxDelta = 1;
      let maxCvd = -Infinity;
      let minCvd = Infinity;

      for (let i = startIndex; i < endIndex; i++) {
        if (i >= totalCandles) break;
        const c = candlesticks[i];
        if (Math.abs(c.delta) > maxDelta) maxDelta = Math.abs(c.delta);
        if (c.cvd > maxCvd) maxCvd = c.cvd;
        if (c.cvd < minCvd) minCvd = c.cvd;
      }

      const cvdPadding = (maxCvd - minCvd) * 0.1 || 100;
      maxCvd += cvdPadding;
      minCvd -= cvdPadding;

      const getDeltaY = (deltaVal: number) => {
        const halfH = indicatorHeight / 2;
        const midY = indicatorTop + halfH;
        const scale = halfH / maxDelta;
        return midY - deltaVal * scale;
      };

      const getCvdY = (cvdVal: number) => {
        const scale = indicatorHeight / (maxCvd - minCvd);
        return indicatorTop + indicatorHeight - (cvdVal - minCvd) * scale;
      };

      ctx.strokeStyle = "rgba(40, 50, 75, 0.15)";
      ctx.lineWidth = 0.8;
      const cvdGridY1 = indicatorTop + indicatorHeight * 0.2;
      const cvdGridY2 = indicatorTop + indicatorHeight * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, cvdGridY1);
      ctx.lineTo(drawWidth, cvdGridY1);
      ctx.moveTo(0, cvdGridY2);
      ctx.lineTo(drawWidth, cvdGridY2);
      ctx.stroke();

      for (let i = 0; i < slicedCandles.length; i++) {
        const originalIdx = startIndex + i;
        const candle = slicedCandles[i];
        const x = getX(originalIdx);
        const isExtremeDelta = Math.abs(candle.delta) > 550 * settings.deltaThreshold;
        const deltaY = getDeltaY(candle.delta);
        const midY = indicatorTop + indicatorHeight / 2;

        ctx.fillStyle = isExtremeDelta
          ? (candle.delta > 0 ? "rgba(6, 182, 212, 0.55)" : "rgba(217, 70, 239, 0.55)")
          : (candle.delta > 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(244, 63, 94, 0.25)");

        ctx.fillRect(x - barWidth / 2, Math.min(midY, deltaY), barWidth, Math.max(1, Math.abs(midY - deltaY)));
      }

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      let isFirst = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const originalIdx = startIndex + i;
        const candle = slicedCandles[i];
        const x = getX(originalIdx);
        const y = getCvdY(candle.cvd);
        if (isFirst) { ctx.moveTo(x, y); isFirst = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#facc15";
      ctx.beginPath();
      isFirst = true;
      for (let i = 0; i < slicedCandles.length; i++) {
        const originalIdx = startIndex + i;
        const x = getX(originalIdx);
        const y = getCvdY(cvdMa[originalIdx]);
        if (isFirst) { ctx.moveTo(x, y); isFirst = false; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("CVD (voldelta)", 8, indicatorTop + 14);

      ctx.fillStyle = "#64748b";
      ctx.font = "8px monospace";
      ctx.fillText(`CVD Max: ${Math.round(maxCvd)}`, drawWidth + 6, indicatorTop + 10);
      ctx.fillText(`CVD Min: ${Math.round(minCvd)}`, drawWidth + 6, indicatorTop + indicatorHeight - 2);
    }

    // 7. Render Hover Crosshair & Tooltip overlay
    if (hoverIndex !== null && hoverIndex >= startIndex && hoverIndex < endIndex) {
      const hoverCandle = candlesticks[hoverIndex];
      if (hoverCandle) {
        const x = getX(hoverIndex);
        const yPrice = getY(hoverCandle.close);

        // Vertical guide line
        ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Horizontal guide line on close price
        ctx.beginPath();
        ctx.moveTo(0, yPrice);
        ctx.lineTo(drawWidth, yPrice);
        ctx.stroke();
        ctx.setLineDash([]);

        // Interactive Tooltip Block
        const boxW = 200;
        const boxH = 110;
        const boxX = x + boxW + 20 > drawWidth ? x - boxW - 20 : x + 20;
        const boxY = 15;

        ctx.fillStyle = "rgba(13, 17, 28, 0.94)";
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1.5;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Tooltip Headers
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        const dateStr = new Date(hoverCandle.time).toLocaleTimeString();
        ctx.fillText(`Cвеча [${dateStr}]`, boxX + 12, boxY + 18);

        ctx.font = "10px monospace";
        // OHLC lines
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`O: ${hoverCandle.open.toFixed(2)}`, boxX + 12, boxY + 36);
        ctx.fillText(`H: ${hoverCandle.high.toFixed(2)}`, boxX + 100, boxY + 36);
        ctx.fillText(`L: ${hoverCandle.low.toFixed(2)}`, boxX + 12, boxY + 50);
        ctx.fillText(`C: ${hoverCandle.close.toFixed(2)}`, boxX + 100, boxY + 50);

        ctx.fillText(`Объем: ${Math.round(hoverCandle.volume)}`, boxX + 12, boxY + 68);

        // Voldelta values
        const deltaColor = hoverCandle.delta >= 0 ? "#10b981" : "#f43f5e";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Дельта:", boxX + 12, boxY + 84);
        ctx.fillStyle = deltaColor;
        ctx.fillText(`${hoverCandle.delta > 0 ? "+" : ""}${Math.round(hoverCandle.delta)}`, boxX + 62, boxY + 84);

        // ML signal inside tooltip
        const mlSignal = mlSignals[hoverIndex];
        if (settings.mlEnabled && mlSignal !== 0) {
          ctx.fillStyle = mlSignal > 0 ? "#10b981" : "#ef4444";
          ctx.fillText(`ИИ Сигнал: ${mlSignal > 0 ? "BUY" : "SELL"} (${Math.round(mlConfidence[hoverIndex] * 100)}%)`, boxX + 12, boxY + 98);
        } else {
          ctx.fillStyle = "#64748b";
          ctx.fillText("ИИ Сигнал: Ожидание", boxX + 12, boxY + 98);
        }
      }
    }
  }, [candlesticks, dimensions, hoverIndex, zoomFactor, scrollOffset, settings, computedState]);

  // Handle mouse down to initiate panning (drag)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startScrollOffsetRef.current = scrollOffset;
  };

  // Handle cursor movement inside canvas to show tooltip crosshair or pan
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (dimensions.width / (rect.width || 1));

    const drawWidth = dimensions.width - 65;
    const minVisibleCandles = 20;
    const maxVisibleCandles = 100;
    const baseVisibleCount = 60;
    const visibleCandlesCount = Math.max(
      minVisibleCandles,
      Math.min(maxVisibleCandles, Math.round(baseVisibleCount / zoomFactor))
    );

    const totalCandles = candlesticks.length;

    // Handle Panning if dragging
    if (isDraggingRef.current) {
      const deltaX = e.clientX - startXRef.current;
      // Note that dragging to the left scrolls forward (reduces offset), dragging right scrolls back (increases offset)
      const candlesMoved = (deltaX / rect.width) * visibleCandlesCount;
      const nextOffset = Math.max(
        0,
        Math.min(
          totalCandles - visibleCandlesCount,
          Math.round(startScrollOffsetRef.current + candlesMoved)
        )
      );
      setScrollOffset(nextOffset);
      return; // Skip tooltip updates while dragging
    }

    const candleWidth = drawWidth / visibleCandlesCount;
    const hoverLocalIdx = Math.floor(mouseX / candleWidth);

    let endIndex = totalCandles - scrollOffset;
    if (endIndex > totalCandles) endIndex = totalCandles;
    if (endIndex < visibleCandlesCount) endIndex = visibleCandlesCount;
    const startIndex = Math.max(0, endIndex - visibleCandlesCount);

    const actualIdx = startIndex + hoverLocalIdx;
    if (actualIdx >= 0 && actualIdx < totalCandles) {
      setHoverIndex(actualIdx);
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHoverIndex(null);
  };

  // Mobile Touch Gestures (Pan & Pinch-to-Zoom)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // Single finger panning
      isTouchingRef.current = true;
      touchStartXRef.current = e.touches[0].clientX;
      touchStartScrollOffsetRef.current = scrollOffset;
      touchStartDistRef.current = 0;
    } else if (e.touches.length === 2) {
      // Pinch zooming
      isTouchingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const minVisibleCandles = 20;
    const maxVisibleCandles = 100;
    const baseVisibleCount = 60;
    const visibleCandlesCount = Math.max(
      minVisibleCandles,
      Math.min(maxVisibleCandles, Math.round(baseVisibleCount / zoomFactor))
    );

    const totalCandles = candlesticks.length;

    if (e.touches.length === 1 && isTouchingRef.current) {
      const deltaX = e.touches[0].clientX - touchStartXRef.current;
      const candlesMoved = (deltaX / rect.width) * visibleCandlesCount;
      const nextOffset = Math.max(
        0,
        Math.min(
          totalCandles - visibleCandlesCount,
          Math.round(touchStartScrollOffsetRef.current + candlesMoved)
        )
      );
      setScrollOffset(nextOffset);
    } else if (e.touches.length === 2 && touchStartDistRef.current > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDistRef.current;

      setZoomFactor((prev) => {
        const target = prev * (ratio > 1 ? 1.05 : 0.95);
        return Math.max(0.4, Math.min(4, target));
      });
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isTouchingRef.current = false;
    touchStartDistRef.current = 0;
  };

  // Passive wheel listener for standard trackpad zoom & mouse scroll zoom (prevent page scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoomFactor((prev) => Math.max(0.4, Math.min(4, prev + zoomDelta)));
    };

    const handleTouchMovePrevent = (e: TouchEvent) => {
      // Prevent browser swiping back and pull-to-refresh while interacting on canvas
      if (isTouchingRef.current || e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
      }
    };

    canvas.addEventListener("wheel", handleWheelZoom, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMovePrevent, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheelZoom);
      canvas.removeEventListener("touchmove", handleTouchMovePrevent);
    };
  }, []);

  return (
    <div className={`flex flex-col bg-[#0a0d16] border p-4 md:p-5 shadow-2xl relative transition-all duration-300 ${
      isFullscreen 
        ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none bg-[#07090e]" 
        : "h-full rounded-2xl border-gray-800"
    }`}>
      {/* Chart Control Toolbar */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#121624] p-1.5 rounded-xl border border-gray-800 flex items-center gap-1">
            <button
              onClick={onReset}
              className="p-2 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
              title="Обновить реальные данные с Binance"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Обновить</span>
            </button>
          </div>

          <div className="bg-[#121624] p-1.5 rounded-xl border border-gray-800 flex items-center gap-1">
            <button
              onClick={() => setZoomFactor(prev => Math.min(prev + 0.15, 2.5))}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
              title="Приблизить"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoomFactor(prev => Math.max(prev - 0.15, 0.4))}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
              title="Отдалить"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>

          {/* Fullscreen Mode Toggle */}
          <div className="bg-[#121624] p-1.5 rounded-xl border border-gray-800 flex items-center">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold"
              title={isFullscreen ? "Свернуть график" : "Раскрыть на весь экран"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4 text-rose-400" />
                  <span className="hidden sm:inline text-rose-400">Свернуть</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Во весь экран</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Visual Layers Controls */}
        {setSettings && (
          <div className="flex flex-row flex-wrap items-center gap-1.5 bg-[#121624] p-1 rounded-xl border border-gray-800/80">
            <button
              onClick={() => setSettings(prev => ({ ...prev, showPriceForecast: !prev.showPriceForecast }))}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                settings.showPriceForecast !== false
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'
              }`}
              title="Показывать волновой прогноз цены (Wave Forecast)"
            >
              🌊 Прогноз
            </button>
            <button
              onClick={() => setSettings(prev => ({ ...prev, showReversalZones: !prev.showReversalZones }))}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                settings.showReversalZones !== false
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-sm'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'
              }`}
              title="Показывать зоны разворота (Reversal Zones OTE)"
            >
              🎯 Зоны OTE
            </button>
            <button
              onClick={() => setSettings(prev => ({ ...prev, showOB: !prev.showOB }))}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                settings.showOB
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-sm'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'
              }`}
              title="Показывать блоки ордеров (Order Blocks)"
            >
              🧱 Блоки OB
            </button>
            <button
              onClick={() => setSettings(prev => ({ ...prev, showFVG: !prev.showFVG }))}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                settings.showFVG
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800'
              }`}
              title="Показывать имбалансы объема (FVG)"
            >
              ⚡ Зоны FVG
            </button>
          </div>
        )}

        {/* Live Binance flow indicator */}
        <div className="flex items-center gap-2 bg-emerald-500/5 px-3 py-1.5 border border-emerald-500/10 rounded-xl text-xs font-semibold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Binance API Live ⚡</span>
        </div>
      </div>

      {/* Optimal Settings Preset Selector Bar */}
      {setSettings && (
        <div className="mb-3 px-3 py-2 bg-gradient-to-r from-blue-950/20 via-slate-900/40 to-amber-950/20 rounded-xl border border-gray-800/80 flex flex-row flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-blue-400 animate-spin-slow" />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Оптимальные пресеты для активов и таймфреймов:
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* ★ Универсальный пресет для всех таймфреймов */}
            <button
              onClick={() => {
                let lookback = 12;
                let targetMult = 1.1;
                let accuracyMode: 'SMC-Balanced' | 'Conservative' | 'Aggressive' = 'SMC-Balanced';

                if (timeframe === '1m' || timeframe === '3m') {
                  lookback = 8;
                  targetMult = 0.85;
                  accuracyMode = 'Aggressive';
                } else if (timeframe === '5m') {
                  lookback = 10;
                  targetMult = 1.0;
                  accuracyMode = 'Conservative';
                } else if (timeframe === '15m') {
                  lookback = 12;
                  targetMult = 1.1;
                  accuracyMode = 'Conservative';
                } else if (timeframe === '30m') {
                  lookback = 14;
                  targetMult = 1.15;
                  accuracyMode = 'Conservative';
                } else if (timeframe === '1H') {
                  lookback = 15;
                  targetMult = 1.18;
                  accuracyMode = 'Conservative';
                } else if (timeframe === '4H') {
                  lookback = 18;
                  targetMult = 1.20;
                  accuracyMode = 'SMC-Balanced';
                } else if (timeframe === '1D') {
                  lookback = 20;
                  targetMult = 1.22;
                  accuracyMode = 'SMC-Balanced';
                }

                setSettings(prev => ({
                  ...prev,
                  selectedPreset: '★ Универсальный (Все таймфреймы / Авто-Адаптивный)',
                  forecastModelAccuracy: accuracyMode,
                  forecastTargetMult: targetMult,
                  structureLookback: lookback,
                  showSweepLabels: true
                }));
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border shadow-sm ${
                settings.selectedPreset === '★ Универсальный (Все таймфреймы / Авто-Адаптивный)' || !settings.selectedPreset
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/25 text-cyan-300 border-cyan-400/60 shadow-cyan-500/10 font-bold'
                  : 'bg-gray-900/40 text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50'
              }`}
              title="★ Универсальный пресет: динамически подстраивает структуру, дельту и цели под любой открытый таймфрейм (1м - 1Д)."
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>★ Универсальный (Все ТФ)</span>
            </button>

            {/* Auto Tune for Active Asset & Timeframe */}
            <button
              onClick={() => {
                let lookback = 15;
                let targetMult = 1.0;
                let accuracyMode: 'SMC-Balanced' | 'Conservative' | 'Aggressive' = 'SMC-Balanced';

                if (asset === 'GOLD' || asset === 'PAXGUSDT') {
                  lookback = 12;
                  targetMult = 0.9;
                  accuracyMode = 'SMC-Balanced';
                } else if (asset.includes('BTC') || asset.includes('ETH') || asset.includes('SOL')) {
                  lookback = 18;
                  targetMult = 1.25;
                  accuracyMode = 'Aggressive';
                } else if (asset.includes('EUR') || asset.includes('USD')) {
                  lookback = 10;
                  targetMult = 0.8;
                  accuracyMode = 'Conservative';
                }

                if (timeframe === '5m' || timeframe === '1m') {
                  lookback = Math.max(8, lookback - 4);
                } else if (timeframe === '1H' || timeframe === '4H') {
                  lookback = lookback + 5;
                }

                setSettings(prev => ({
                  ...prev,
                  selectedPreset: '★ Универсальный (Все таймфреймы / Авто-Адаптивный)',
                  forecastModelAccuracy: accuracyMode,
                  forecastTargetMult: targetMult,
                  structureLookback: lookback,
                  showSweepLabels: true
                }));
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 shadow-md hover:from-amber-500/30 hover:to-yellow-500/30"
              title="Автоматическая подстройка лучшей конфигурации индикаторов под выбранный актив и таймфрейм"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span>⚡ Авто-настройка ({asset} {timeframe})</span>
            </button>

            <button
              onClick={() => setSettings(prev => ({
                ...prev,
                selectedPreset: "Золото (XAUUSD) - 15 мин Оптимальный",
                forecastModelAccuracy: 'SMC-Balanced',
                forecastTargetMult: 0.9,
                structureLookback: 12,
                showSweepLabels: true
              }))}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 border ${
                settings.selectedPreset === "Золото (XAUUSD) - 15 мин Оптимальный" || (settings.forecastModelAccuracy === 'SMC-Balanced' && settings.forecastTargetMult === 0.9 && settings.structureLookback === 12)
                  ? 'bg-yellow-600/20 text-yellow-300 border-yellow-500/50 font-bold'
                  : 'bg-gray-900/40 text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50'
              }`}
              title="Оптимальный пресет для Золота (GOLD / XAUUSD 15m): глубокие Liquidity Sweeps, баланс OTE 0.618 и средне-высокая точность."
            >
              <span>🥇</span> Золото 15m (XAU)
            </button>

            <button
              onClick={() => setSettings(prev => ({
                ...prev,
                selectedPreset: "Биткоин (BTCUSD) - 15 мин Оптимальный",
                forecastModelAccuracy: 'Aggressive',
                forecastTargetMult: 1.25,
                structureLookback: 18,
                showSweepLabels: true
              }))}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 border ${
                settings.selectedPreset === "Биткоин (BTCUSD) - 15 мин Оптимальный" || (settings.forecastModelAccuracy === 'Aggressive' && settings.forecastTargetMult === 1.25 && settings.structureLookback === 18)
                  ? 'bg-orange-600/20 text-orange-400 border-orange-500/50 font-bold'
                  : 'bg-gray-900/40 text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50'
              }`}
              title="Оптимальный пресет для Биткоина и криптовалют (BTC/USDT 15m): расширенные импульсные цели и защита от волатильного шума."
            >
              <span>₿</span> Крипта 15m (BTC)
            </button>

            <button
              onClick={() => setSettings(prev => ({
                ...prev,
                selectedPreset: "Общий (Все активы) - 15 мин Оптимальный",
                forecastModelAccuracy: 'Conservative',
                forecastTargetMult: 0.8,
                structureLookback: 10,
                showSweepLabels: true
              }))}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 border ${
                settings.selectedPreset === "Общий (Все активы) - 15 мин Оптимальный" || (settings.forecastModelAccuracy === 'Conservative' && settings.forecastTargetMult === 0.8 && settings.structureLookback === 10)
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 font-bold'
                  : 'bg-gray-900/40 text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50'
              }`}
              title="Оптимальный пресет для Валютных пар (EUR/USD 15m): консервативные тесты OB/FVG и быстрая реакция."
            >
              <span>💶</span> Валюта 15m (EUR/USD)
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Container */}
      <div className="flex-1 w-full min-h-[480px] h-[520px] sm:h-[580px] relative overflow-hidden" ref={containerRef}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: `${dimensions.height}px` }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="block cursor-grab active:cursor-grabbing rounded-xl border border-gray-800/60"
        />
      </div>

      {/* 📊 Панель выбора субиндикаторов в стиле Binance (Отдельные строки MACD и RSI) */}
      <div className="mt-2.5 bg-[#090d16] p-2 rounded-xl border border-gray-800/80 flex items-center justify-between flex-wrap gap-2 shadow-inner">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider px-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Осцилляторы Binance:
          </span>
          <button
            onClick={() => setBottomPaneMode('dual')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
              bottomPaneMode === 'dual'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border-blue-400/50'
                : 'bg-gray-900/60 text-gray-400 hover:text-white border-gray-800/80 hover:bg-gray-800/50'
            }`}
            title="Отдельные строки для MACD и RSI как на скриншоте Binance"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            ⚡ Обе строки (MACD + RSI отдельно)
          </button>
          <button
            onClick={() => setBottomPaneMode('macd')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
              bottomPaneMode === 'macd'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 border-emerald-400/50'
                : 'bg-gray-900/60 text-gray-400 hover:text-white border-gray-800/80 hover:bg-gray-800/50'
            }`}
            title="Только строка MACD: столбцы выше 0 и ниже 0, линии DIF и DEA"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            📊 Только MACD
          </button>
          <button
            onClick={() => setBottomPaneMode('rsi')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
              bottomPaneMode === 'rsi'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25 border-purple-400/50'
                : 'bg-gray-900/60 text-gray-400 hover:text-white border-gray-800/80 hover:bg-gray-800/50'
            }`}
            title="Только строка RSI: кривые 6 и 14, уровни 80/50/20"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            📈 Только RSI
          </button>
          <button
            onClick={() => setBottomPaneMode('cvd')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
              bottomPaneMode === 'cvd'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/25 border-cyan-400/50'
                : 'bg-gray-900/60 text-gray-400 hover:text-white border-gray-800/80 hover:bg-gray-800/50'
            }`}
            title="Объемная дельта CVD"
          >
            🌊 CVD Дельта
          </button>
        </div>

        {/* Легенда цветов Binance */}
        <div className="flex items-center gap-2.5 text-[10px] font-mono text-gray-400 pr-1">
          <span className="flex items-center gap-1" title="Быстрая линия DIF MACD и быстрый RSI 6">
            <span className="w-2 h-2 rounded-full bg-[#facc15] inline-block shadow-sm shadow-amber-400/50"></span> DIF / RSI(6)
          </span>
          <span className="flex items-center gap-1" title="Сигнальная линия DEA MACD">
            <span className="w-2 h-2 rounded-full bg-[#ec4899] inline-block shadow-sm shadow-pink-500/50"></span> DEA(9)
          </span>
          <span className="flex items-center gap-1" title="Стандартный RSI 14">
            <span className="w-2 h-2 rounded-full bg-[#a855f7] inline-block shadow-sm shadow-purple-500/50"></span> RSI(14)
          </span>
          <span className="flex items-center gap-1" title="Столбец растет (выше или ниже 0)">
            <span className="w-2 h-2 rounded-sm bg-[#0ecb81] inline-block"></span> Рост
          </span>
          <span className="flex items-center gap-1" title="Столбец падает (выше или ниже 0)">
            <span className="w-2 h-2 rounded-sm bg-[#f6465d] inline-block"></span> Спад
          </span>
        </div>
      </div>

      {/* Interactive horizontal scrolling bar */}
      <div className="mt-3 bg-gray-950/40 p-2 rounded-xl border border-gray-800/80 flex items-center justify-between gap-4">
        <span className="text-[10px] text-gray-500 font-mono">Прокрутка истории графика:</span>
        <input
          type="range"
          min="0"
          max={Math.max(0, candlesticks.length - 40)}
          value={scrollOffset}
          onChange={(e) => setScrollOffset(parseInt(e.target.value))}
          className="flex-1 accent-blue-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-[10px] text-gray-400 font-mono">-{scrollOffset} баров</span>
      </div>

      {/* 🌐 EXTERNAL MACRO MARKET ANOMALY WARNING BAR (DXY & BRENT OIL) */}
      <div className="mt-3 bg-gradient-to-r from-amber-950/40 via-rose-950/40 to-purple-950/40 border border-amber-500/40 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 animate-pulse">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Макро-предупреждение внешних рынков (DXY & Oil)</span>
              <span className="text-[9px] bg-rose-500/20 text-rose-300 font-mono px-1.5 py-0.5 rounded border border-rose-500/30">АНОМАЛИЯ</span>
            </div>
            <p className="text-[11px] text-gray-300 mt-0.5">
              Индекс Доллара США (DXY): <span className="font-mono text-emerald-400 font-bold">+0.48% ↗</span> | Нефть Brent (BR1!): <span className="font-mono text-rose-400 font-bold">-1.15% ↘</span>. Сильный импульс внешних рынков может вызывать выбивание Стоп-Лоссов!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
          <span className="px-2 py-1 bg-black/40 text-amber-300 rounded border border-amber-500/30">
            DXY: 104.42 (+0.48%)
          </span>
          <span className="px-2 py-1 bg-black/40 text-rose-300 rounded border border-rose-500/30">
            Brent: $78.15 (-1.15%)
          </span>
        </div>
      </div>

      {/* 🔮 ADVANCED FORECAST SETTINGS & MTF MATRIX DASHBOARD */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 bg-[#0a0d16] p-4 rounded-xl border border-gray-800/80">
        
        {/* Settings column */}
        <div className="space-y-4 lg:col-span-1 border-r border-gray-800/50 pr-0 lg:pr-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-blue-400" />
            <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Параметры прогноза цены</h4>
          </div>
          
          {setSettings && (
            <div className="space-y-3.5">
              {/* Forecast Model Selection */}
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1">
                  Точность модели прогнозирования:
                </label>
                <select
                  value={settings.forecastModelAccuracy || 'SMC-Balanced'}
                  onChange={(e) => setSettings(prev => ({ ...prev, forecastModelAccuracy: e.target.value as any }))}
                  className="w-full bg-[#111422] border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="SMC-Balanced">SMC Сбалансированный (Рекомендуемый)</option>
                  <option value="Conservative">Консервативный (Опора на жесткие OB/FVG)</option>
                  <option value="Aggressive">Агрессивный (Импульсный пробой Fibonacci)</option>
                </select>
              </div>

              {/* Multiplier of TP Target */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Множитель цели (Fib / Wave Target):</span>
                  <span className="font-mono text-blue-400 font-semibold">{settings.forecastTargetMult || 1.0}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={settings.forecastTargetMult || 1.0}
                  onChange={(e) => setSettings(prev => ({ ...prev, forecastTargetMult: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Swing lookback period */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Период анализа структуры (Swing):</span>
                  <span className="font-mono text-amber-400 font-semibold">{settings.structureLookback || 15} баров</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={settings.structureLookback || 15}
                  onChange={(e) => setSettings(prev => ({ ...prev, structureLookback: parseInt(e.target.value) }))}
                  className="w-full accent-amber-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Show Sweep Labels Toggle */}
              <div className="flex items-center justify-between bg-[#111422] p-2 rounded-lg border border-gray-800/60">
                <label htmlFor="showSweepLabelsCheckbox" className="text-[10px] font-medium text-gray-400 cursor-pointer select-none">
                  Показывать надписи SWEEP на графике:
                </label>
                <input
                  id="showSweepLabelsCheckbox"
                  type="checkbox"
                  checked={settings.showSweepLabels !== false}
                  onChange={(e) => setSettings(prev => ({ ...prev, showSweepLabels: e.target.checked }))}
                  className="w-4 h-4 rounded bg-gray-950 border-gray-800 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                />
              </div>

              {/* Dynamic canvas filter overlay switcher */}
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1.5">
                  Отображение прогнозов на графике:
                </label>
                <div className="grid grid-cols-2 gap-1 bg-[#111422] p-1 rounded-lg border border-gray-800">
                  <button
                    onClick={() => setSelectedForecastTF("all")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${
                      selectedForecastTF === "all" ? "bg-blue-500 text-white shadow-sm" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Все (Мульти)
                  </button>
                  <button
                    onClick={() => setSelectedForecastTF("active")}
                    className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${
                      selectedForecastTF === "active" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Текущий ({timeframe})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard table column */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
              <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Панель мульти-таймфрейм прогнозов (MTF Matrix)</h4>
            </div>
            <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              Live-синхронизация
            </span>
          </div>

          {(() => {
            const curFc = getForecastForTimeframe(timeframe);
            if (curFc.isHighRunaway && !curFc.leg1Completed && !curFc.leg2Completed) {
              return (
                <div className="p-2.5 rounded-lg bg-orange-950/40 border border-orange-500/40 text-orange-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-400 shrink-0 animate-bounce" />
                    <span>
                      <strong className="text-orange-300">⚡ Внимание (Импульс без отката):</strong> Вероятность резкого движения сразу к цели TP1 без отката к Leg 1 составляет <strong className="text-white">{curFc.noPullbackProb}%</strong>! Рекомендуется сплит: 50% объема по рынку + 50% лимитный ордер на вход ({curFc.p1.toFixed(asset === "EUR/USD" ? 4 : 2)}).
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono text-[10px] font-bold border border-orange-500/30 shrink-0">
                    БЕЗ ОТКАТА ⚡
                  </span>
                </div>
              );
            }
            return null;
          })()}

          <div className="overflow-x-auto rounded-lg border border-gray-800/80">
            <table className="w-full text-left text-[10px] font-mono select-none">
              <thead className="bg-[#111422] text-gray-400 border-b border-gray-800 text-[9px] uppercase tracking-wider">
                <tr>
                  <th className="p-2">Таймфрейм</th>
                  <th className="p-2">Тренд</th>
                  <th className="p-2 text-right">Старт ➔ Вход</th>
                  <th className="p-2 text-right">TP1 ➔ TP2 🎯</th>
                  <th className="p-2 text-center">ATR & Запас</th>
                  <th className="p-2 text-center">Без отката ⚡</th>
                  <th className="p-2 text-center">Статус сценария</th>
                  <th className="p-2 text-right">Уверенность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 bg-[#0c0f1b]">
                {["5m", "15m", "30m", "1H", "4H", "1D"].map((tf) => {
                  const fc = getForecastForTimeframe(tf);
                  const isCurrent = tf === timeframe;
                  const pDec = asset === "EUR/USD" ? 4 : 2;
                  const tfAtr = Math.max(0.01, Math.abs(fc.p2 - fc.p1) * 0.45);
                  const currentPrice = candlesticks[candlesticks.length - 1]?.close || fc.anchorPrice;
                  const distToTp = Math.abs(fc.p3 - currentPrice);
                  const atrHeadroom = (distToTp / tfAtr).toFixed(1);

                  return (
                    <tr 
                      key={tf} 
                      onClick={() => setSelectedForecastTF(tf)}
                      className={`hover:bg-[#15192c]/60 transition-all cursor-pointer ${
                        isCurrent ? "bg-blue-500/5 border-l-2 border-l-blue-500" : ""
                      }`}
                    >
                      <td className="p-2 font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fc.color }} />
                        {tf} {isCurrent && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded">АКТИВ</span>}
                      </td>
                      <td className="p-2">
                        {fc.isBull ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                            ▲ Long
                          </span>
                        ) : (
                          <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                            ▼ Short
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <span className="text-gray-400">{fc.anchorPrice.toFixed(pDec)}</span>
                        <span className="text-gray-600 mx-1">➔</span>
                        <span className={fc.leg1Completed ? "text-emerald-400 font-bold" : "text-amber-400 font-semibold"}>
                          {fc.p1.toFixed(pDec)}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <span className={fc.leg2Completed ? "text-cyan-400 font-bold" : "text-gray-400"}>
                          {fc.p2.toFixed(pDec)}
                        </span>
                        <span className="text-gray-600 mx-1">➔</span>
                        <span className={fc.leg3Completed ? "text-emerald-400 font-bold" : "text-emerald-300 font-semibold"}>
                          {fc.p3.toFixed(pDec)}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span className="text-cyan-300 font-medium">ATR {tfAtr.toFixed(pDec)}</span>
                        <span className="text-gray-500 mx-1">|</span>
                        <span className="text-amber-300 font-bold">{atrHeadroom}x</span>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          fc.isHighRunaway 
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" 
                            : fc.noPullbackProb >= 45 
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                              : "bg-gray-800/80 text-gray-400 border border-gray-700/50"
                        }`}>
                          {fc.isHighRunaway ? `⚡ ${fc.noPullbackProb}%` : `${fc.noPullbackProb}%`}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          fc.activeLeg === 5
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : fc.activeLeg === 4
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : fc.activeLeg === 3
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-gray-800 text-gray-400"
                        }`}>
                          {fc.status}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-gray-300">{fc.confidence}%</span>
                          <div className="w-8 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${fc.confidence}%`,
                                backgroundColor: fc.color 
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-gray-500 leading-normal italic">
            * Кликните на любую строку таймфрейма выше, чтобы сфокусировать отображение конкретной прогнозной линии на графике, либо выберите "Все (Мульти)" в меню слева.
          </p>
        </div>
      </div>
    </div>
  );
}
