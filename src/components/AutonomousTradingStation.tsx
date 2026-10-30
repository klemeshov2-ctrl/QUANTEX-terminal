import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  ColorType,
  LineStyle,
  createSeriesMarkers,
  TrackingModeExitMode
} from "lightweight-charts";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Bot,
  Brain,
  Calendar,
  BookOpen,
  Send,
  RefreshCw,
  Sliders,
  Shield,
  Flame,
  Activity,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Check,
  Copy,
  Download,
  Code2,
  Zap,
  BarChart2,
  FileText,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  PlusCircle,
  Clock,
  Radio,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  Settings,
  X,
  Minus,
  Plus,
  Palette,
  Compass,
  Info,
  GripHorizontal,
  Move,
  ExternalLink,
  Sliders as SlidersIcon,
  User,
  Crown,
  LogIn,
  LogOut,
  Menu
} from "lucide-react";
import { GexMarketReport, GexStrikeData } from "../../server/gexEngine";
import { getLevelRole, getExpirySuffix } from "../lib/gexLabels";
import { AutonomousAiAnalystPanel, MacroNewsItem } from "./AutonomousAiAnalystPanel";
import { GexAdvancedModules } from "./GexAdvancedModules";
import { GexProbabilityHero } from "./GexProbabilityHero";
import { UnifiedStationSettings, ThemeId, STATION_THEMES, UserAccountItem } from "./UnifiedStationSettings";

export const THEME_PALETTES: Record<ThemeId, {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  chartBg: string;
  chartGrid: string;
  accent: string;
  accentText: string;
  accentBg: string;
}> = {
  cyber_dark: {
    bg: "#07090e",
    surface: "#0b0e17",
    surfaceAlt: "#111624",
    border: "#1f293d",
    chartBg: "#080b12",
    chartGrid: "rgba(42, 46, 57, 0.4)",
    accent: "#06b6d4",
    accentText: "text-cyan-400",
    accentBg: "bg-cyan-500/20"
  },
  gold_bullion: {
    bg: "#090603",
    surface: "#140e06",
    surfaceAlt: "#1e1509",
    border: "#3d2a0d",
    chartBg: "#0d0904",
    chartGrid: "rgba(146, 64, 14, 0.3)",
    accent: "#f59e0b",
    accentText: "text-amber-400",
    accentBg: "bg-amber-500/20"
  },
  navy_pro: {
    bg: "#030712",
    surface: "#081026",
    surfaceAlt: "#0d1b3e",
    border: "#1e2e5c",
    chartBg: "#050c1e",
    chartGrid: "rgba(30, 58, 100, 0.35)",
    accent: "#38bdf8",
    accentText: "text-sky-400",
    accentBg: "bg-blue-500/20"
  },
  synthwave_violet: {
    bg: "#090514",
    surface: "#130a26",
    surfaceAlt: "#1e0f3b",
    border: "#3b1a6e",
    chartBg: "#0c061a",
    chartGrid: "rgba(88, 28, 135, 0.35)",
    accent: "#c084fc",
    accentText: "text-purple-400",
    accentBg: "bg-purple-500/20"
  },
  forest_alpha: {
    bg: "#030c07",
    surface: "#07170e",
    surfaceAlt: "#0b2416",
    border: "#163d28",
    chartBg: "#05120b",
    chartGrid: "rgba(6, 78, 59, 0.35)",
    accent: "#10b981",
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/20"
  },
  monokai_slate: {
    bg: "#000000",
    surface: "#0d0d0d",
    surfaceAlt: "#171717",
    border: "#2a2a2a",
    chartBg: "#050505",
    chartGrid: "rgba(45, 45, 45, 0.5)",
    accent: "#a3e635",
    accentText: "text-lime-400",
    accentBg: "bg-lime-500/20"
  }
};

export type AssetSymbol = "XAUUSD" | "PAXGUSDT" | "MOEX_GOLD" | "MOEX_MINI" | "GLDRUBF" | "MOEX_SI" | "MOEX_RI" | "MOEX_BR" | "MOEX_NG" | "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "XRPUSDT";
export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
export type ChartStyleType = "candles" | "bars" | "line" | "area";
export type StationModuleTab = "chart" | "gex" | "editor" | "ai_assistant" | "calendar" | "journal" | "settings";

interface TradeItem {
  id: string;
  date: string;
  asset: string;
  type: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  notes: string;
  gexZone: string;
}

// Math helper for EMA calculation
function calculateEMA(data: { close: number }[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  if (data.length === 0) return ema;
  let prev = data[0].close;
  ema.push(prev);
  for (let i = 1; i < data.length; i++) {
    const val = data[i].close * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

// EMA series with matching timestamps for Lightweight Charts LineSeries
function calculateEmaSeries(candles: { close: number; time: any }[], period: number): { time: any; value: number }[] {
  if (!candles || candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: { time: any; value: number }[] = [];
  let ema = candles[0].close;
  result.push({ time: candles[0].time, value: Math.round(ema * 100) / 100 });
  for (let i = 1; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: Math.round(ema * 100) / 100 });
  }
  return result;
}

// Relative Strength Index (RSI) for period 6 and 14 (aligned 100% with candles length for multi-pane sync)
function calculateRSI(candles: { close: number; time: any }[], period: number): { time: any; value: number }[] {
  if (!candles || candles.length === 0) return [];
  if (candles.length <= period) {
    return candles.map(c => ({ time: c.time, value: 50 }));
  }
  const result: { time: any; value: number }[] = [];
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRsi = Math.round((100 - (100 / (1 + rs))) * 10) / 10;

  // Pad the first period bars so RSI series has exact same length and time coordinates as candles
  for (let i = 0; i < period; i++) {
    result.push({ time: candles[i].time, value: firstRsi });
  }
  result.push({ time: candles[period].time, value: firstRsi });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    result.push({ time: candles[i].time, value: Math.round(rsi * 10) / 10 });
  }
  return result;
}

// Stochastic Oscillator (%K, %D) (aligned 100% with candles length for multi-pane sync)
function calculateStochastic(candles: { high: number; low: number; close: number; time: any }[], periodK = 14, smoothD = 3): {
  kData: { time: any; value: number }[];
  dData: { time: any; value: number }[];
} {
  if (!candles || candles.length === 0) return { kData: [], dData: [] };
  if (candles.length < periodK) {
    const dummy = candles.map(c => ({ time: c.time, value: 50 }));
    return { kData: dummy, dData: dummy };
  }
  const rawK: { time: any; k: number }[] = [];
  for (let i = periodK - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - periodK + 1; j <= i; j++) {
      if (candles[j].high > hh) hh = candles[j].high;
      if (candles[j].low < ll) ll = candles[j].low;
    }
    const range = hh - ll;
    const k = range === 0 ? 50 : ((candles[i].close - ll) / range) * 100;
    rawK.push({ time: candles[i].time, k });
  }

  const firstK = rawK.length > 0 ? Math.round(rawK[0].k * 10) / 10 : 50;
  const kData: { time: any; value: number }[] = [];
  for (let i = 0; i < periodK - 1; i++) {
    kData.push({ time: candles[i].time, value: firstK });
  }
  for (let i = 0; i < rawK.length; i++) {
    kData.push({ time: rawK[i].time, value: Math.round(rawK[i].k * 10) / 10 });
  }

  const rawD: { time: any; value: number }[] = [];
  for (let i = smoothD - 1; i < rawK.length; i++) {
    let sum = 0;
    for (let j = i - smoothD + 1; j <= i; j++) {
      sum += rawK[j].k;
    }
    rawD.push({ time: rawK[i].time, value: Math.round((sum / smoothD) * 10) / 10 });
  }

  const firstD = rawD.length > 0 ? rawD[0].value : firstK;
  const dData: { time: any; value: number }[] = [];
  const padDCount = (periodK - 1) + (smoothD - 1);
  for (let i = 0; i < padDCount && i < candles.length; i++) {
    dData.push({ time: candles[i].time, value: firstD });
  }
  for (let i = 0; i < rawD.length; i++) {
    dData.push({ time: rawD[i].time, value: rawD[i].value });
  }

  return { kData, dData };
}

// Format numbers according to Binance Russian locale: thousands separated by space, decimal by comma (e.g. 4 044,80)
function formatBinanceNumber(val: number | undefined | null, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return "-";
  const fixed = Number(val).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
}

// Binance STOCHRSI (Stochastic RSI: RSI 14, Stoch 14, %K 3, %D 3)
function calculateStochRsiSeries(
  candles: { close: number; time: any }[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
): {
  kData: { time: any; value: number }[];
  dData: { time: any; value: number }[];
} {
  if (!candles || candles.length === 0) return { kData: [], dData: [] };
  const rsiSeries = calculateRSI(candles, rsiPeriod);
  if (rsiSeries.length === 0) return { kData: [], dData: [] };

  const rawStoch: number[] = [];
  for (let i = 0; i < rsiSeries.length; i++) {
    if (i < stochPeriod - 1) {
      rawStoch.push(50);
      continue;
    }
    let minRsi = Infinity;
    let maxRsi = -Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const v = rsiSeries[j].value;
      if (v < minRsi) minRsi = v;
      if (v > maxRsi) maxRsi = v;
    }
    const range = maxRsi - minRsi;
    const rawVal = range === 0 ? 50 : ((rsiSeries[i].value - minRsi) / range) * 100;
    rawStoch.push(Math.max(0, Math.min(100, rawVal)));
  }

  // Smooth rawStoch with SMA(kPeriod) for %K (STOCHRSI)
  const kValues: number[] = [];
  for (let i = 0; i < rawStoch.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(rawStoch[i]);
      continue;
    }
    let sum = 0;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      sum += rawStoch[j];
    }
    kValues.push(sum / kPeriod);
  }

  // Smooth kValues with SMA(dPeriod) for %D (MASTOCHRSI)
  const dValues: number[] = [];
  for (let i = 0; i < kValues.length; i++) {
    if (i < dPeriod - 1) {
      dValues.push(kValues[i]);
      continue;
    }
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      sum += kValues[j];
    }
    dValues.push(sum / dPeriod);
  }

  const kData = candles.map((c, i) => ({
    time: c.time,
    value: Math.round((kValues[i] ?? 50) * 100) / 100
  }));
  const dData = candles.map((c, i) => ({
    time: c.time,
    value: Math.round((dValues[i] ?? 50) * 100) / 100
  }));

  return { kData, dData };
}

function calculateATR(candles: { high: number; low: number; close: number; open?: number }[], period = 14): number[] {
  const atrs: number[] = [];
  if (candles.length === 0) return atrs;
  let trSum = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1].close : (c.open || c.close);
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
    if (i < period) {
      trSum += tr;
      atrs.push(trSum / (i + 1));
    } else {
      const prevAtr = atrs[i - 1];
      const atr = (prevAtr * (period - 1) + tr) / period;
      atrs.push(atr);
    }
  }
  return atrs;
}

// Fallback calibrated candle generator with accurate timeframe step and volatility scaling
function generateFallbackCandles(symbol: AssetSymbol, interval: Timeframe = "15m", count = 140) {
  const basePrice = (symbol === "XAUUSD" || symbol === "PAXGUSDT")
    ? 4132.8
    : symbol === "MOEX_GOLD"
    ? 4204.8
    : symbol === "MOEX_MINI"
    ? 4203.3
    : symbol === "GLDRUBF"
    ? 8560.0
    : symbol === "MOEX_SI"
    ? 83846.0
    : symbol === "MOEX_RI"
    ? 93370.0
    : symbol === "MOEX_BR"
    ? 110.49
    : symbol === "MOEX_NG"
    ? 3.014
    : symbol === "BTCUSDT"
    ? 82200.0
    : symbol === "ETHUSDT"
    ? 2430.0
    : symbol === "SOLUSDT"
    ? 185.0
    : 1.30;
  const tfSecMap: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400
  };
  const step = tfSecMap[interval] || 900;
  const baseVol = (symbol === "XAUUSD" || symbol === "PAXGUSDT" || symbol === "MOEX_GOLD" || symbol === "MOEX_MINI")
    ? 4.5
    : symbol === "GLDRUBF"
    ? 18.0
    : symbol === "MOEX_SI"
    ? 65.0
    : symbol === "MOEX_RI"
    ? 85.0
    : symbol === "MOEX_BR"
    ? 0.35
    : symbol === "MOEX_NG"
    ? 0.025
    : symbol === "BTCUSDT"
    ? 180.0
    : symbol === "ETHUSDT"
    ? 6.0
    : symbol === "SOLUSDT"
    ? 1.5
    : 0.008;
  const volatility = baseVol * Math.max(0.4, Math.sqrt(step / 900));
  const now = Math.floor(Date.now() / 1000);
  const candles: any[] = [];

  let current = basePrice - count * 0.12 * (step / 900);
  for (let i = count; i >= 1; i--) {
    const t = now - i * step;
    const change = (Math.sin(i * 0.22) + (Math.random() - 0.48) * 1.4) * volatility;
    const open = Math.round(current * 100) / 100;
    const close = Math.round((current + change) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * volatility * 0.75) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * volatility * 0.75) * 100) / 100;
    const volume = Math.round(50 + Math.random() * 80);
    candles.push({ time: t, open, high, low, close, volume, _isFallback: true });
    current = close;
  }
  return candles;
}

import {
  TradingViewZonesPrimitive,
  ZoneBox,
  ForecastArrow,
  BosMarker,
  BoundedPriceLine,
  GexProfileBarItem,
  GexProfileData,
  CurrentPriceCountdown
} from "./TradingViewZonesPrimitive";
import {
  evaluateSuperIndicator,
  SuperIndicatorOutput,
  resetIndicatorForecast,
  hydrateSetupsFromServer
} from "../lib/pineSuperIndicatorEngine";

interface ChartOverlaysProps {
  chart: IChartApi | null;
  series: any;
  chartWrapperRef: React.RefObject<HTMLDivElement | null>;
  activeAsset: AssetSymbol;
  activeTf: Timeframe;
  marketStatus: {
    isOpen: boolean;
    isPremarket?: boolean;
    isClearing?: boolean;
    sessionType?: string;
    statusBadge?: string;
    statusText: string;
  };
  barCountdownFormatted: string;
  candles: any[];
  showTables?: boolean;
  isHudMinimized?: boolean;
  onToggleHudMinimize?: () => void;
  indicatorOutput?: SuperIndicatorOutput | null;
  showEma9?: boolean;
  showEma21?: boolean;
  showEma50?: boolean;
  showEma100?: boolean;
  showEma200?: boolean;
}

const ChartOverlays: React.FC<ChartOverlaysProps> = React.memo(({
  chart,
  series,
  chartWrapperRef,
  activeAsset,
  activeTf,
  marketStatus,
  barCountdownFormatted,
  candles,
  showTables,
  isHudMinimized,
  onToggleHudMinimize,
  indicatorOutput,
  showEma9 = true,
  showEma21 = true,
  showEma50 = true,
  showEma100 = true,
  showEma200 = true
}) => {
  const [hoveredCandle, setHoveredCandle] = useState<any | null>(null);
  const [priceCoordY, setPriceCoordY] = useState<number | null>(null);
  const candlesRef = useRef(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    if (!chart || !series) return;
    const handleCrosshairMove = (param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData?.get(series);
      if (data && typeof data === "object") {
        const fullCandle = candlesRef.current?.find((c) => c.time === param.time);
        const o = "open" in data ? (data as any).open : (fullCandle?.open ?? (data as any).value ?? 0);
        const h = "high" in data ? (data as any).high : (fullCandle?.high ?? o);
        const l = "low" in data ? (data as any).low : (fullCandle?.low ?? o);
        const c = "close" in data ? (data as any).close : (fullCandle?.close ?? (data as any).value ?? o);
        setHoveredCandle({
          time: Number(param.time),
          open: Number(o),
          high: Number(h),
          low: Number(l),
          close: Number(c),
          volume: fullCandle?.volume ?? 0
        });
      } else {
        setHoveredCandle(null);
      }
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      try { chart.unsubscribeCrosshairMove(handleCrosshairMove); } catch {}
    };
  }, [chart, series]);

  useEffect(() => {
    if (!series) return;
    const updateCoord = () => {
      const last = candlesRef.current && candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length - 1] : null;
      if (!last || !series) return;
      try {
        const y = series.priceToCoordinate(last.close);
        if (typeof y === "number" && !isNaN(y)) {
          setPriceCoordY(y);
        }
      } catch {}
    };
    updateCoord();
    if (chart) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(updateCoord);
      const interval = setInterval(updateCoord, 500);
      return () => {
        clearInterval(interval);
        try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateCoord); } catch {}
      };
    }
  }, [chart, series, candles]);

  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const displayCandle = hoveredCandle || latestCandle;
  const dec = (activeAsset === "XRPUSDT" || activeAsset === "MOEX_NG") ? 4 : (activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI") ? 0 : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI") ? 1 : 2;

  const emaDataMap = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    const e9 = calculateEMA(candles, 9);
    const e21 = calculateEMA(candles, 21);
    const e50 = calculateEMA(candles, 50);
    const e100 = calculateEMA(candles, 100);
    const e200 = calculateEMA(candles, 200);
    return { e9, e21, e50, e100, e200 };
  }, [candles]);

  const currentEmaValues = useMemo(() => {
    if (!displayCandle || !candles || candles.length === 0 || !emaDataMap) {
      return { ema9: 0, ema21: 0, ema50: 0, ema100: 0, ema200: 0 };
    }
    const idx = candles.findIndex(c => c.time === displayCandle.time);
    const targetIdx = idx !== -1 ? idx : candles.length - 1;
    return {
      ema9: emaDataMap.e9[targetIdx] ?? 0,
      ema21: emaDataMap.e21[targetIdx] ?? 0,
      ema50: emaDataMap.e50[targetIdx] ?? 0,
      ema100: emaDataMap.e100[targetIdx] ?? 0,
      ema200: emaDataMap.e200[targetIdx] ?? 0
    };
  }, [displayCandle, candles, emaDataMap]);

  let ohlcBlock = null;
  if (displayCandle) {
    const isHover = !!hoveredCandle;
    const o = displayCandle.open ?? displayCandle.close;
    const c = displayCandle.close;
    const h = displayCandle.high ?? Math.max(o, c);
    const l = displayCandle.low ?? Math.min(o, c);
    const chg = c - o;
    const chgPct = o !== 0 ? (chg / o) * 100 : 0;
    const isBull = c >= o;
    const toneClass = isBull ? "text-emerald-400" : "text-rose-400";
    const mskTimeStr = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(displayCandle.time * 1000)).replace(",", "") + " МСК";

    ohlcBlock = (
      <div className="absolute top-1.5 left-1.5 sm:left-2 z-20 flex flex-col gap-1 pointer-events-none select-none max-w-[calc(100%-12px)] sm:max-w-fit">
        {/* Row 1: Compact HUD Expand Pill */}
        {showTables && isHudMinimized && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={onToggleHudMinimize}
              className="pointer-events-auto flex items-center gap-1.5 bg-[#080d1a]/95 hover:bg-[#121c33] border border-cyan-500/50 text-cyan-300 px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-mono font-bold cursor-pointer transition shadow-md"
              title="Нажмите чтобы развернуть полную таблицу QUANTEX HUD"
            >
              <span className="font-extrabold text-cyan-400">📊 HUD:</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                indicatorOutput?.forecast.isBull
                  ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                  : "bg-rose-500/30 text-rose-300 border border-rose-500/40"
              }`}>
                {indicatorOutput?.forecast.isBull ? "LONG" : "SHORT"} {indicatorOutput?.forecast.probability || 74}%
              </span>
              <span className="text-gray-300 hidden xs:inline text-[9px]">
                Вход: <strong className="text-white">{indicatorOutput?.forecast.p1Entry?.toFixed(1) ?? "-"}</strong>
              </span>
              <span className="text-emerald-400 hidden xs:inline text-[9px]">
                TP1: <strong>{indicatorOutput?.forecast.p2Tp1?.toFixed(1) ?? "-"}</strong>
              </span>
              <span className="text-cyan-400 text-[9px] font-bold">▾</span>
            </button>
          </div>
        )}

        {/* Row 2: OHLC Candle Prices (Ultra-compact squeeze on mobile to fit 100% within screen width) */}
        <div className="flex items-center gap-1 sm:gap-2 text-[8px] xs:text-[8.5px] sm:text-[10.5px] font-mono tracking-tight bg-[#080c16]/96 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-800/90 shadow-md whitespace-nowrap select-none max-w-[calc(100vw-12px)] sm:max-w-fit overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5 sm:gap-1 font-bold shrink-0">
            <span className="text-white tracking-tight text-[8px] xs:text-[9px] sm:text-[11px]">{activeAsset}</span>
            <span className="text-cyan-300 bg-cyan-950/90 px-1 py-0.2 rounded text-[7.5px] xs:text-[8px] sm:text-[9.5px] border border-cyan-700/60 font-mono">{activeTf}</span>
            {marketStatus.isPremarket ? (
              <span className="text-[7.5px] sm:text-[8.5px] px-1 py-0.2 rounded bg-amber-500/25 text-amber-200 border border-amber-400/50 font-sans font-bold hidden sm:inline">
                Премаркет
              </span>
            ) : !marketStatus.isOpen ? (
              <span className="text-[7.5px] sm:text-[8.5px] px-1 py-0.2 rounded bg-slate-800/95 text-slate-300 border border-slate-700 font-sans font-bold hidden sm:inline">
                Закрыто
              </span>
            ) : (
              <span className="text-[7.5px] sm:text-[8.5px] px-1 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800/60 font-sans font-bold hidden sm:inline">
                Онлайн
              </span>
            )}
            {isHover && (
              <span className="text-[7.5px] sm:text-[8.5px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hidden xs:inline">
                Свеча
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 shrink-0">
            <span className="text-slate-400">О:<span className={`font-semibold ${toneClass}`}>{o.toFixed(dec)}</span></span>
            <span className="text-slate-400">В:<span className={`font-semibold ${toneClass}`}>{h.toFixed(dec)}</span></span>
            <span className="text-slate-400">Н:<span className={`font-semibold ${toneClass}`}>{l.toFixed(dec)}</span></span>
            <span className="text-slate-400">З:<span className={`font-bold ${toneClass}`}>{c.toFixed(dec)}</span></span>
            <span className={`font-bold ${toneClass}`}>
              <span className="inline sm:hidden">{chg >= 0 ? "+" : ""}{chgPct.toFixed(2)}%</span>
              <span className="hidden sm:inline">{chg >= 0 ? "+" : ""}{chg.toFixed(dec)} ({chg >= 0 ? "+" : ""}{chgPct.toFixed(2)}%)</span>
            </span>
            {displayCandle.volume ? (
              <span className="text-slate-400 hidden lg:inline">
                Объём: <span className="text-slate-200">{displayCandle.volume.toLocaleString("ru-RU")}</span>
              </span>
            ) : null}
            <span className="text-cyan-300/90 text-[9px] sm:text-[10px] hidden md:flex items-center gap-1 border-l border-slate-700/80 pl-1">
              <span>{mskTimeStr}</span>
            </span>
          </div>
        </div>

        {/* Row 3: Binance 5-EMA Legend Overlay */}
        {(showEma9 || showEma21 || showEma50 || showEma100 || showEma200) && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[8px] xs:text-[8.5px] sm:text-[10px] font-mono tracking-tight bg-[#080c16]/95 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-800/90 shadow-md max-w-[calc(100vw-12px)] sm:max-w-fit select-none overflow-x-auto scrollbar-none">
            {showEma9 && (
              <span className="font-semibold" style={{ color: "#f0b90b" }}>
                EMA(9): <span className="font-mono">{formatBinanceNumber(currentEmaValues.ema9, dec)}</span>
              </span>
            )}
            {showEma21 && (
              <span className="font-semibold" style={{ color: "#ec4899" }}>
                EMA(21): <span className="font-mono">{formatBinanceNumber(currentEmaValues.ema21, dec)}</span>
              </span>
            )}
            {showEma50 && (
              <span className="font-semibold" style={{ color: "#3b82f6" }}>
                EMA(50): <span className="font-mono">{formatBinanceNumber(currentEmaValues.ema50, dec)}</span>
              </span>
            )}
            {showEma100 && (
              <span className="font-semibold" style={{ color: "#22c55e" }}>
                EMA(100): <span className="font-mono">{formatBinanceNumber(currentEmaValues.ema100, dec)}</span>
              </span>
            )}
            {showEma200 && (
              <span className="font-semibold" style={{ color: "#be185d" }}>
                EMA(200): <span className="font-mono">{formatBinanceNumber(currentEmaValues.ema200, dec)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  const maxH = chartWrapperRef.current?.clientHeight || 600;
  const isBadgeVisible = priceCoordY !== null && priceCoordY >= 5 && priceCoordY <= (maxH - 20);

  return (
    <>
      {ohlcBlock}
      {isBadgeVisible && (
        <div
          className="absolute z-20 pointer-events-none select-none flex justify-center"
          style={{
            top: `${Math.round(priceCoordY + 13)}px`,
            right: "2px",
            width: typeof window !== "undefined" && window.innerWidth < 768 ? "46px" : (marketStatus.isOpen ? "60px" : "80px")
          }}
          title={marketStatus.isOpen ? `Отсчёт времени закрытия бара ${activeTf}: ${barCountdownFormatted}` : marketStatus.statusText}
        >
          {marketStatus.isOpen ? (
            <div className="bg-[#090d16] border border-cyan-500/80 shadow-lg px-0.5 sm:px-1 py-0.5 rounded text-[8.5px] sm:text-[10px] font-mono font-bold text-cyan-300 flex items-center justify-center gap-0.5 sm:gap-1 w-full text-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <span>{barCountdownFormatted}</span>
            </div>
          ) : marketStatus.isPremarket ? (
            <div className="bg-[#181209] border border-amber-500/80 shadow-lg px-1 py-0.5 rounded text-[9.5px] font-sans font-bold text-amber-300 flex items-center justify-center gap-1 w-full text-center">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
              <span>Премаркет</span>
            </div>
          ) : marketStatus.isClearing ? (
            <div className="bg-[#181509] border border-yellow-500/80 shadow-lg px-1 py-0.5 rounded text-[9.5px] font-sans font-bold text-yellow-300 flex items-center justify-center gap-0.5 w-full text-center">
              <span>⏸ Клиринг</span>
            </div>
          ) : (
            <div className="bg-[#181209] border border-amber-500/80 shadow-lg px-1 py-0.5 rounded text-[9.5px] font-sans font-bold text-amber-300 flex items-center justify-center gap-0.5 w-full text-center">
              <span>⏸ {marketStatus.statusBadge || "Стоп"}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
});

const STATION_PREFS_KEY = "quantex_user_preferences";

const getActiveUsername = (): string => {
  try {
    const savedUser = typeof window !== "undefined" ? localStorage.getItem("quantex_active_user") : null;
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed?.username) return String(parsed.username).trim().toLowerCase();
    }
  } catch {}
  return "admin";
};

// Load cached preferences synchronously for instant zero-flicker render
const loadInitialPreferences = (): Record<string, any> => {
  try {
    if (typeof window === "undefined") return {};
    const u = getActiveUsername();
    const userSpecificRaw = localStorage.getItem(`${STATION_PREFS_KEY}_${u}`);
    if (userSpecificRaw) {
      const parsed = JSON.parse(userSpecificRaw);
      if (parsed && typeof parsed === "object") return parsed;
    }
    const globalRaw = localStorage.getItem(STATION_PREFS_KEY);
    if (globalRaw) {
      const parsed = JSON.parse(globalRaw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  return {};
};

const initialCachedPrefs = loadInitialPreferences();

function getInitialPref<T>(key: string, legacyKey: string | null, defaultValue: T): T {
  if (initialCachedPrefs && initialCachedPrefs[key] !== undefined) {
    return initialCachedPrefs[key] as T;
  }
  if (legacyKey && typeof window !== "undefined") {
    try {
      const legacyVal = localStorage.getItem(legacyKey);
      if (legacyVal !== null) {
        if (typeof defaultValue === "boolean") {
          return (legacyVal === "true") as unknown as T;
        }
        if (typeof defaultValue === "number") {
          const num = Number(legacyVal);
          if (!isNaN(num)) return num as unknown as T;
        }
        return legacyVal as unknown as T;
      }
    } catch {}
  }
  return defaultValue;
}

export interface AutonomousTradingStationProps {
  currentUser?: UserAccountItem;
  onUserChange?: (user: UserAccountItem) => void;
  onOpenAuthModal?: () => void;
  onNavigateToTab?: (tab: "station" | "gold_deepseek" | "server_deploy" | "ai_learning" | "indicator_stats") => void;
}

export const AutonomousTradingStation: React.FC<AutonomousTradingStationProps> = ({
  currentUser: propUser,
  onUserChange: propOnUserChange,
  onOpenAuthModal,
  onNavigateToTab
}) => {
  // Navigation & Asset State
  const [activeAsset, setActiveAsset] = useState<AssetSymbol>(() =>
    getInitialPref("activeAsset", "quantex_active_asset", "XAUUSD")
  );
  const [activeTf, setActiveTf] = useState<Timeframe>(() =>
    getInitialPref("activeTf", "quantex_active_tf", "15m")
  );
  const [activeTab, setActiveTab] = useState<StationModuleTab>(() =>
    getInitialPref("activeTab", "quantex_active_tab", "chart")
  );
  const [chartStyle, setChartStyle] = useState<ChartStyleType>(() =>
    getInitialPref("chartStyle", "quantex_chart_style", "candles")
  );
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState<boolean>(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMobileTfOpen, setIsMobileTfOpen] = useState<boolean>(false);
  const [isGexHorizonDropdownOpen, setIsGexHorizonDropdownOpen] = useState<boolean>(false);
  const assetDropdownRef = useRef<HTMLDivElement | null>(null);
  const mobileAssetDropdownRef = useRef<HTMLDivElement | null>(null);
  const indicatorsDropdownRef = useRef<HTMLDivElement | null>(null);
  const mobileIndicatorsDropdownRef = useRef<HTMLDivElement | null>(null);
  const moreToolsRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileTfRef = useRef<HTMLDivElement | null>(null);
  const gexHorizonDropdownRef = useRef<HTMLDivElement | null>(null);
  const desktopGexHorizonDropdownRef = useRef<HTMLDivElement | null>(null);

  // Short human-friendly label for ultra-compact mobile header (~6" screens)
  const getShortAssetLabel = (asset: AssetSymbol): string => {
    switch (asset) {
      case "XAUUSD": return "XAUUSD";
      case "PAXGUSDT": return "PAXG";
      case "MOEX_GOLD": return moexContracts?.large?.secId || "GDZ6";
      case "MOEX_MINI": return moexContracts?.mini?.secId || "GNZ6";
      case "GLDRUBF": return "GLDRUBF";
      case "MOEX_SI": return moexContracts?.si?.secId || "SiZ6";
      case "MOEX_RI": return moexContracts?.ri?.secId || "RIZ6";
      case "MOEX_BR": return moexContracts?.br?.secId || "BRX6";
      case "MOEX_NG": return moexContracts?.ng?.secId || "NGV6";
      case "BTCUSDT": return "BTC";
      case "ETHUSDT": return "ETH";
      case "SOLUSDT": return "SOL";
      case "XRPUSDT": return "XRP";
      default: return asset;
    }
  };

  // Active theme and RBAC user state
  const [stationTheme, setStationTheme] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem("quantex_theme");
      if (saved && STATION_THEMES.some(t => t.id === saved)) {
        return saved as ThemeId;
      }
    } catch {}
    return "cyber_dark";
  });

  const [stationUser, setStationUser] = useState<UserAccountItem>(() => {
    if (propUser) return propUser;
    try {
      const saved = localStorage.getItem("quantex_active_user");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      id: "usr-admin",
      username: "admin",
      role: "admin",
      allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings"],
      createdAt: "2026-10-21"
    };
  });

  // Sync propUser if it changes externally
  useEffect(() => {
    if (propUser && propUser.username !== stationUser.username) {
      setStationUser(propUser);
    }
  }, [propUser]);

  const handleUpdateActiveUser = (user: UserAccountItem) => {
    setStationUser(user);
    try {
      localStorage.setItem("quantex_active_user", JSON.stringify(user));
    } catch {}
    if (propOnUserChange) {
      propOnUserChange(user);
    }
  };

  // Safe tab fallback: if activeTab is not in stationUser.allowedTabs
  useEffect(() => {
    if (stationUser?.allowedTabs && stationUser.allowedTabs.length > 0) {
      if (activeTab !== "settings" && !stationUser.allowedTabs.includes(activeTab)) {
        setActiveTab((stationUser.allowedTabs[0] as StationModuleTab) || "chart");
      }
    }
  }, [stationUser, activeTab]);

  // Moving averages (EMA 9, 21, 50, 100, 200 - Binance standard, enabled by default)
  const [showEma9, setShowEma9] = useState<boolean>(() =>
    getInitialPref("showEma9", "quantex_show_ema9", true)
  );
  const [showEma21, setShowEma21] = useState<boolean>(() =>
    getInitialPref("showEma21", "quantex_show_ema21", true)
  );
  const [showEma50, setShowEma50] = useState<boolean>(() =>
    getInitialPref("showEma50", "quantex_show_ema50", true)
  );
  const [showEma100, setShowEma100] = useState<boolean>(() =>
    getInitialPref("showEma100", "quantex_show_ema100", true)
  );
  const [showEma200, setShowEma200] = useState<boolean>(() =>
    getInitialPref("showEma200", "quantex_show_ema200", true)
  );

  // Sub-pane indicators (RSI 6 & 14, STOCHRSI - Binance standard, enabled by default)
  const [showRsiPane, setShowRsiPane] = useState<boolean>(() =>
    getInitialPref("showRsiPane", "quantex_show_rsi_pane", true)
  );
  const [showStochPane, setShowStochPane] = useState<boolean>(() =>
    getInitialPref("showStochPane", "quantex_show_stoch_pane", true)
  );

  // Sub-pane adjustable heights in pixels (MACD, RSI, Stochastic)
  const [macdPaneHeight, setMacdPaneHeight] = useState<number>(() =>
    getInitialPref("macdPaneHeight", "quantex_macd_height", 110)
  );
  const [rsiPaneHeight, setRsiPaneHeight] = useState<number>(() =>
    getInitialPref("rsiPaneHeight", "quantex_rsi_height", 95)
  );
  const [stochPaneHeight, setStochPaneHeight] = useState<number>(() =>
    getInitialPref("stochPaneHeight", "quantex_stoch_height", 95)
  );

  const handleStartResizePane = (pane: "macd" | "rsi" | "stoch", e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const initialH = pane === "macd" ? macdPaneHeight : pane === "rsi" ? rsiPaneHeight : stochPaneHeight;

    const onMove = (moveEv: MouseEvent | TouchEvent) => {
      const curY = "touches" in moveEv ? moveEv.touches[0].clientY : moveEv.clientY;
      const deltaY = startY - curY; // Dragging UP expands height
      const nextH = Math.max(55, Math.min(350, Math.round(initialH + deltaY)));
      if (pane === "macd") {
        setMacdPaneHeight(nextH);
        try { localStorage.setItem("quantex_macd_height", String(nextH)); } catch {}
      } else if (pane === "rsi") {
        setRsiPaneHeight(nextH);
        try { localStorage.setItem("quantex_rsi_height", String(nextH)); } catch {}
      } else if (pane === "stoch") {
        setStochPaneHeight(nextH);
        try { localStorage.setItem("quantex_stoch_height", String(nextH)); } catch {}
      }
    };

    const onEnd = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  };

  // Popup Modals for ALL users:
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState<boolean>(false);
  const [isUserSettingsModalOpen, setIsUserSettingsModalOpen] = useState<boolean>(false);

  // HUD Table scale & styling (Available to ALL users)
  const [hudScale, setHudScale] = useState<number>(() =>
    getInitialPref("hudScale", "quantex_hud_scale", 100)
  );
  const [hudFontSize, setHudFontSize] = useState<number>(() =>
    getInitialPref("hudFontSize", "quantex_hud_font_size", 11)
  );
  const [chartLabelScale, setChartLabelScale] = useState<string>(() =>
    getInitialPref("chartLabelScale", "quantex_chart_label_scale", "normal")
  );
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() =>
    getInitialPref("soundAlertsEnabled", "quantex_sound_alerts", true)
  );

  const [settingsInitialSection, setSettingsInitialSection] = useState<string>("telegram");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isInsideAsset =
        (assetDropdownRef.current && assetDropdownRef.current.contains(e.target as Node)) ||
        (mobileAssetDropdownRef.current && mobileAssetDropdownRef.current.contains(e.target as Node));
      if (!isInsideAsset) {
        setIsAssetDropdownOpen(false);
      }

      const isInsideIndicators =
        (indicatorsDropdownRef.current && indicatorsDropdownRef.current.contains(e.target as Node)) ||
        (mobileIndicatorsDropdownRef.current && mobileIndicatorsDropdownRef.current.contains(e.target as Node));
      if (!isInsideIndicators) {
        setIsIndicatorsModalOpen(false);
      }

      if (moreToolsRef.current && !moreToolsRef.current.contains(e.target as Node)) {
        setIsMoreToolsOpen(false);
      }
      if (mobileTfRef.current && !mobileTfRef.current.contains(e.target as Node)) {
        setIsMobileTfOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
      const isInsideGex =
        (gexHorizonDropdownRef.current && gexHorizonDropdownRef.current.contains(e.target as Node)) ||
        (desktopGexHorizonDropdownRef.current && desktopGexHorizonDropdownRef.current.contains(e.target as Node));
      if (!isInsideGex) {
        setIsGexHorizonDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Market & GEX Data
  // Fast hydration: retrieve cached real server candles from sessionStorage to eliminate split-second fallback flash
  const [candles, setCandles] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("quantex_real_candles_XAUUSD_15m");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0]?._isFallback) {
            return parsed;
          }
        }
      } catch {}
    }
    return [];
  });
  const [candlesKey, setCandlesKey] = useState<string>("XAUUSD_15m");
  const activeAssetRef = useRef<AssetSymbol>(activeAsset);
  const activeTfRef = useRef<Timeframe>(activeTf);
  useEffect(() => {
    activeAssetRef.current = activeAsset;
    activeTfRef.current = activeTf;
  }, [activeAsset, activeTf]);
  const fetchSeqRef = useRef<number>(0);
  const clientCandlesCacheRef = useRef<Map<string, any[]>>(new Map());

  // Populate in-memory cache from sessionStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const initialStored = sessionStorage.getItem("quantex_real_candles_XAUUSD_15m");
        if (initialStored) {
          const parsed = JSON.parse(initialStored);
          if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0]?._isFallback) {
            clientCandlesCacheRef.current.set("XAUUSD_15m", parsed);
          }
        }
      } catch {}
    }
  }, []);

  // Instant hydration and cache lookup for timeframe switching
  const handleSelectTimeframe = (tf: Timeframe) => {
    if (tf === activeTf) return;
    activeTfRef.current = tf;
    const key = `${activeAsset}_${tf}`;
    let cached = clientCandlesCacheRef.current.get(key);
    if (!cached && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("quantex_real_candles_" + key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0]?._isFallback) {
            cached = parsed;
            clientCandlesCacheRef.current.set(key, cached);
          }
        }
      } catch {}
    }
    if (cached && cached.length > 0) {
      setCandles(cached);
      setCandlesKey(key);
    }
    setActiveTf(tf);
  };

  // Instant hydration and cache lookup for asset switching
  const handleSelectAsset = (asset: AssetSymbol) => {
    if (asset === activeAsset) return;
    activeAssetRef.current = asset;
    const key = `${asset}_${activeTf}`;
    let cached = clientCandlesCacheRef.current.get(key);
    if (!cached && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("quantex_real_candles_" + key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0]?._isFallback) {
            cached = parsed;
            clientCandlesCacheRef.current.set(key, cached);
          }
        }
      } catch {}
    }
    if (cached && cached.length > 0) {
      setCandles(cached);
      setCandlesKey(key);
    }
    setActiveAsset(asset);
  };

  const [gexReport, setGexReport] = useState<GexMarketReport | null>(null);
  const [dayGexReport, setDayGexReport] = useState<GexMarketReport | null>(null);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);
  const [isLoadingGex, setIsLoadingGex] = useState<boolean>(false);
  const [lastUpdatedMsk, setLastUpdatedMsk] = useState<string>("");
  const [moexContracts, setMoexContracts] = useState<{
    large?: any;
    mini?: any;
    rub?: any;
    si?: any;
    ri?: any;
    br?: any;
    ng?: any;
    allQuarterly?: any[];
  } | null>(null);
  const [oandaData, setOandaData] = useState<{
    price: number;
    bid: number;
    ask: number;
    volume: number;
    high: number;
    low: number;
    change: number;
    isWeekend: boolean;
  } | null>(null);
  const [activeContractInfo, setActiveContractInfo] = useState<{
    secId?: string;
    shortName?: string;
    source?: string;
    quarterLabel?: string;
    openPosition?: number;
    volToday?: number;
    marketOpen?: boolean;
    isPremarket?: boolean;
    isClearing?: boolean;
    sessionType?: string;
    statusBadge?: string;
    marketStatusText?: string;
  }>({ marketOpen: true, statusBadge: "Торги идут", marketStatusText: "Торги идут" });
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    isPremarket?: boolean;
    isClearing?: boolean;
    sessionType?: string;
    statusBadge?: string;
    statusText: string;
  }>({ isOpen: true, statusBadge: "Торги идут", statusText: "Торги идут в реальном времени" });
  const [popoverActiveTab, setPopoverActiveTab] = useState<"ALL" | "GOLD" | "MOEX" | "CRYPTO">("ALL");

  // Dynamic chart font size & mobile badge border preferences
  const [chartLabelFontSize, setChartLabelFontSize] = useState<number>(() =>
    getInitialPref(
      "chartLabelFontSize",
      "quantex_chart_font_size",
      typeof window !== "undefined" && window.innerWidth < 640 ? 8 : 10
    )
  );

  const [showChartBadgeBorders, setShowChartBadgeBorders] = useState<boolean>(() =>
    getInitialPref("showChartBadgeBorders", "quantex_chart_badge_borders", false)
  );

  const handleUpdateChartFontSize = (sz: number) => {
    setChartLabelFontSize(sz);
    try {
      localStorage.setItem("quantex_chart_font_size", String(sz));
    } catch {}
  };

  const handleToggleChartBadgeBorders = (val: boolean) => {
    setShowChartBadgeBorders(val);
    try {
      localStorage.setItem("quantex_chart_badge_borders", String(val));
    } catch {}
  };

  // Live indicator values displayed at top of each pane (Binance-style)
  const [liveIndicatorValues, setLiveIndicatorValues] = useState<{
    macd?: { dif: number; dea: number; hist: number };
    rsi?: { rsi6: number; rsi14: number };
    stoch?: { k: number; d: number };
  }>({});

  // Time scale synchronization across main chart and indicator sub-panes
  const isSyncingTimeScaleRef = useRef<boolean>(false);

  const syncTimeScales = (sourceChart: IChartApi, targetCharts: () => (IChartApi | null)[]) => {
    try {
      sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncingTimeScaleRef.current || !range) return;
        isSyncingTimeScaleRef.current = true;
        try {
          const targets = targetCharts();
          for (const target of targets) {
            if (target && target !== sourceChart) {
              try {
                target.timeScale().setVisibleLogicalRange(range);
              } catch {}
            }
          }
        } finally {
          isSyncingTimeScaleRef.current = false;
        }
      });
    } catch {}
  };

  // 1-second live ticker for TradingView bar close countdown
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentStepSec = useMemo(() => {
    const tfSecMap: Record<string, number> = {
      "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400
    };
    return tfSecMap[activeTf] || 900;
  }, [activeTf]);

  const barCountdown = useMemo(() => {
    const last = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    if (!last) return { formatted: "00:00", seconds: 0 };
    const closeTime = last.time + currentStepSec;
    let diff = closeTime - currentTimeSec;
    if (diff <= 0 || diff > currentStepSec * 2) {
      // Synchronize with wall-clock rollover like in TradingView
      diff = currentStepSec - (currentTimeSec % currentStepSec);
    }
    const s = Math.max(0, diff);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    let formatted: string;
    if (currentStepSec >= 3600 || hours > 0) {
      formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    } else {
      formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return { formatted, seconds: diff };
  }, [candles, currentStepSec, currentTimeSec]);

  // Candle reference for sub-features
  const candlesRef = useRef<any[]>(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Autonomous AI Analyst Docked Panel State (Collapsed by default on mobile/tablets so the chart gets 100% width)
  const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState<boolean>(() =>
    getInitialPref(
      "isAiPanelCollapsed",
      "quantex_is_ai_panel_collapsed",
      typeof window !== "undefined" ? window.innerWidth < 1024 : false
    )
  );
  const [isHudMinimized, setIsHudMinimized] = useState<boolean>(() =>
    getInitialPref(
      "isHudMinimized",
      "quantex_is_hud_minimized",
      typeof window !== "undefined" ? window.innerWidth < 768 : false
    )
  );
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(() =>
    getInitialPref("aiPanelWidth", "quantex_ai_panel_width", 380)
  );
  const [isDraggingAiWidth, setIsDraggingAiWidth] = useState<boolean>(false);
  const dragAiStartXRef = useRef<number>(0);
  const dragAiStartWidthRef = useRef<number>(380);

  const handleStartResizeAi = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingAiWidth(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragAiStartXRef.current = clientX;
    dragAiStartWidthRef.current = aiPanelWidth;
  };

  useEffect(() => {
    if (!isDraggingAiWidth) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const deltaX = dragAiStartXRef.current - clientX;
      const maxW = Math.max(300, window.innerWidth - 220);
      const newWidth = Math.max(240, Math.min(maxW, dragAiStartWidthRef.current + deltaX));
      setAiPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingAiWidth(false);
      try {
        localStorage.setItem("quantex_ai_panel_width", String(aiPanelWidth));
      } catch {}
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDraggingAiWidth, aiPanelWidth]);

  // Draggable HUD State
  const [hudPos, setHudPos] = useState<{ x: number; y: number } | null>(() =>
    getInitialPref("hudPos", null, null)
  );
  const [isDraggingHud, setIsDraggingHud] = useState<boolean>(false);
  const hudDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
  });
  const hudCardRef = useRef<HTMLDivElement | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  // Dragging HUD panel listeners
  useEffect(() => {
    if (!isDraggingHud) return;

    const handleMouseMove = (e: MouseEvent) => {
      const parentEl = chartWrapperRef.current;
      if (!parentEl) return;
      const parentRect = parentEl.getBoundingClientRect();
      const hudEl = hudCardRef.current;
      const hudW = hudEl ? hudEl.offsetWidth : 320;
      const hudH = hudEl ? hudEl.offsetHeight : 220;

      const deltaX = e.clientX - hudDragRef.current.startX;
      const deltaY = e.clientY - hudDragRef.current.startY;
      let nextX = hudDragRef.current.initialX + deltaX;
      let nextY = hudDragRef.current.initialY + deltaY;

      const maxX = Math.max(10, parentRect.width - hudW - 10);
      const maxY = Math.max(10, parentRect.height - hudH - 10);
      nextX = Math.max(6, Math.min(nextX, maxX));
      nextY = Math.max(6, Math.min(nextY, maxY));

      setHudPos({ x: nextX, y: nextY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const parentEl = chartWrapperRef.current;
      if (!parentEl) return;
      const parentRect = parentEl.getBoundingClientRect();
      const hudEl = hudCardRef.current;
      const hudW = hudEl ? hudEl.offsetWidth : 320;
      const hudH = hudEl ? hudEl.offsetHeight : 220;

      const deltaX = touch.clientX - hudDragRef.current.startX;
      const deltaY = touch.clientY - hudDragRef.current.startY;
      let nextX = hudDragRef.current.initialX + deltaX;
      let nextY = hudDragRef.current.initialY + deltaY;

      const maxX = Math.max(10, parentRect.width - hudW - 10);
      const maxY = Math.max(10, parentRect.height - hudH - 10);
      nextX = Math.max(6, Math.min(nextX, maxX));
      nextY = Math.max(6, Math.min(nextY, maxY));

      setHudPos({ x: nextX, y: nextY });
    };

    const handleEnd = () => {
      setIsDraggingHud(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDraggingHud]);

  const handleHudMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const hudEl = hudCardRef.current;
    const parentEl = chartWrapperRef.current;
    if (!hudEl || !parentEl) return;
    const rect = hudEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const curX = hudPos ? hudPos.x : (rect.left - parentRect.left);
    const curY = hudPos ? hudPos.y : (rect.top - parentRect.top);
    hudDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: curX,
      initialY: curY
    };
    setIsDraggingHud(true);
  };

  const handleHudTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const touch = e.touches[0];
    const hudEl = hudCardRef.current;
    const parentEl = chartWrapperRef.current;
    if (!hudEl || !parentEl) return;
    const rect = hudEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const curX = hudPos ? hudPos.x : (rect.left - parentRect.left);
    const curY = hudPos ? hudPos.y : (rect.top - parentRect.top);
    hudDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: curX,
      initialY: curY
    };
    setIsDraggingHud(true);
  };

  // Countdown is rendered efficiently via DOM overlays & headers to prevent full canvas re-renders every 1s

  // ========================================================
  // ⚙️ INPUTS EXACTLY MATCHING QUANTEX PREMIUM v8 PINE SCRIPT v6
  // ========================================================
  // gp_presets: "⚙️ Оптимальные Пресеты QUANTEX"
  const [presetSel, setPresetSel] = useState<string>(() =>
    getInitialPref("presetSel", "quantex_preset_sel", "★ Универсальный (Все таймфреймы / Авто-Адаптивный)")
  );

  // gp_ui: "📱 Настройки Мобильной Оптимизации"
  const [showTables, setShowTables] = useState<boolean>(() =>
    getInitialPref("showTables", "quantex_show_tables", true)
  );
  const [tblViewMode, setTblViewMode] = useState<string>(() =>
    getInitialPref("tblViewMode", "quantex_tbl_view_mode", "💻 Стандартный (ПК / Полный HUD)")
  );
  const [hudTextDensity, setHudTextDensity] = useState<string>(() =>
    getInitialPref("hudTextDensity", "quantex_hud_text_density", "🖥️ ПК (Полный текст)")
  );
  const [tablePos, setTablePos] = useState<string>(() =>
    getInitialPref("tablePos", "quantex_table_pos", "Нижний левый")
  );
  const [tableTextSz, setTableTextSz] = useState<string>(() =>
    getInitialPref("tableTextSz", "quantex_table_text_sz", "Маленький (size.small)")
  );
  const [textSzOpt, setTextSzOpt] = useState<string>(() =>
    getInitialPref("textSzOpt", "quantex_text_sz_opt", "Маленький")
  );
  const [labelOffset, setLabelOffset] = useState<number>(15);
  const [lineLen, setLineLen] = useState<number>(20);
  const [cleanOb, setCleanOb] = useState<boolean>(() =>
    getInitialPref("cleanOb", "quantex_clean_ob", true)
  );
  const [mergeObFvg, setMergeObFvg] = useState<boolean>(() =>
    getInitialPref("mergeObFvg", "quantex_merge_ob_fvg", true)
  );
  const [showSweeps, setShowSweeps] = useState<boolean>(() =>
    getInitialPref("showSweeps", "quantex_show_sweeps", false)
  );
  const [useAntiRound, setUseAntiRound] = useState<boolean>(() =>
    getInitialPref("useAntiRound", "quantex_use_anti_round", true)
  );

  // gp_delta: "📊 Volume Delta & MTF"
  const [vdSmoothing, setVdSmoothing] = useState<number>(14);
  const [extremeTh, setExtremeTh] = useState<number>(1.0);

  // gp_smc: "🏛️ SMC & S&R"
  const [lbSt, setLbSt] = useState<number>(5);
  const [lbIt, setLbIt] = useState<number>(12);
  const [lbLt, setLbLt] = useState<number>(28);
  const [showBos, setShowBos] = useState<boolean>(() =>
    getInitialPref("showBos", "quantex_show_bos", true)
  );
  const [showOb, setShowOb] = useState<boolean>(() =>
    getInitialPref("showOb", "quantex_show_ob", true)
  );
  const [showFvg, setShowFvg] = useState<boolean>(() =>
    getInitialPref("showFvg", "quantex_show_fvg", true)
  );
  const [obLimit, setObLimit] = useState<number>(3);
  const [showSrZones, setShowSrZones] = useState<boolean>(() =>
    getInitialPref("showSrZones", "quantex_show_sr_zones", true)
  );
  const [maxSrBoxes, setMaxSrBoxes] = useState<number>(3);
  const [mergeSr, setMergeSr] = useState<boolean>(true);
  const [mergeDist, setMergeDist] = useState<number>(0.65);

  // gp_fib: "🎯 Волновой Прогноз Цены"
  const [fibPeriod, setFibPeriod] = useState<number>(() =>
    getInitialPref("fibPeriod", "quantex_fib_period", 15)
  );
  const [showProbs, setShowProbs] = useState<boolean>(() =>
    getInitialPref("showProbs", "quantex_show_probs", true)
  );
  const [dirMode, setDirMode] = useState<string>(() =>
    getInitialPref("dirMode", "quantex_dir_mode", "Авто-Структура")
  );
  const [showReversal, setShowReversal] = useState<boolean>(() =>
    getInitialPref("showReversal", "quantex_show_reversal", true)
  );
  const [showForecast, setShowForecast] = useState<boolean>(() =>
    getInitialPref("showForecast", "quantex_show_forecast", true)
  );
  const [showAltWave, setShowAltWave] = useState<boolean>(() =>
    getInitialPref("showAltWave", "quantex_show_alt_wave", true)
  );
  const [slBreakMode, setSlBreakMode] = useState<string>("Закрытие бара (Фильтр шпилек / SMC)");
  const [filterPlanBMtf, setFilterPlanBMtf] = useState<boolean>(true);
  const [fcLookback, setFcLookback] = useState<number>(() =>
    getInitialPref("fcLookback", "quantex_fc_lookback", 30)
  );
  const [fcTargetMult, setFcTargetMult] = useState<number>(() =>
    getInitialPref("fcTargetMult", "quantex_fc_target_mult", 1.0)
  );
  const [fcPostTarget, setFcPostTarget] = useState<boolean>(true);
  const [fcModelAcc, setFcModelAcc] = useState<string>("SMC-Balanced");
  const [fcUseMtf, setFcUseMtf] = useState<boolean>(true);
  const [fcMtfMode, setFcMtfMode] = useState<string>("Авто-Адаптивный (Рекомендуется)");
  const [fcMtfTf, setFcMtfTf] = useState<string>("60");
  const [fcHtfIntrabar, setFcHtfIntrabar] = useState<boolean>(true);
  const [fcFastRejection, setFcFastRejection] = useState<boolean>(true);

  // gp_sig: "⚡ Торговые Сигналы QUANTEX"
  const [showSignals, setShowSignals] = useState<boolean>(() =>
    getInitialPref("showSignals", "quantex_show_signals", false)
  );
  const [signalMode, setSignalMode] = useState<string>(() =>
    getInitialPref("signalMode", "quantex_signal_mode", "Консервативный")
  );

  // gp_colors: "🎨 Тематическое Оформление"
  const [themeMode, setThemeMode] = useState<string>("Золотой Слейт");

  // gp_trend: "📈 Динамическая Линия Тренда"
  const [showTrendL, setShowTrendL] = useState<boolean>(() =>
    getInitialPref("showTrendL", "quantex_show_trend_l", true)
  );
  const [trendType, setTrendType] = useState<string>(() =>
    getInitialPref("trendType", "quantex_trend_type", "EMA")
  );
  const [trendLen, setTrendLen] = useState<number>(() =>
    getInitialPref("trendLen", "quantex_trend_len", 200)
  );

  // gp_trail: "🛡️ Адаптивный Трейлинг-Стоп (Anti-Whipsaw)"
  const [useTrailing, setUseTrailing] = useState<boolean>(() =>
    getInitialPref("useTrailing", "quantex_use_trailing", true)
  );
  const [trailMode, setTrailMode] = useState<string>(() =>
    getInitialPref("trailMode", "quantex_trail_mode", "🛡️ Институциональный (BE при TP1 + Защита 50%)")
  );
  const [trailBeTrigger, setTrailBeTrigger] = useState<string>("Строго при взятии TP1 (Рекомендовано)");
  const [trailBeBuff, setTrailBeBuff] = useState<number>(0.15);
  const [trailAtrDist, setTrailAtrDist] = useState<number>(2.20);
  const [trailResetsWave, setTrailResetsWave] = useState<boolean>(false);
  const [showTrailLine, setShowTrailLine] = useState<boolean>(() =>
    getInitialPref("showTrailLine", "quantex_show_trail_line", false)
  );

  // gp_osc: "📊 MACD (Binance) + RSI" (Enabled by default as requested)
  const [showMacdPane, setShowMacdPane] = useState<boolean>(() =>
    getInitialPref("showMacdPane", "quantex_show_macd_pane", true)
  );
  const [macdFast, setMacdFast] = useState<number>(() =>
    getInitialPref("macdFast", "quantex_macd_fast", 12)
  );
  const [macdSlow, setMacdSlow] = useState<number>(() =>
    getInitialPref("macdSlow", "quantex_macd_slow", 26)
  );
  const [macdSigLen, setMacdSigLen] = useState<number>(() =>
    getInitialPref("macdSigLen", "quantex_macd_sig_len", 9)
  );
  const [rsi6Len, setRsi6Len] = useState<number>(() =>
    getInitialPref("rsi6Len", "quantex_rsi6_len", 6)
  );
  const [rsi14Len, setRsi14Len] = useState<number>(() =>
    getInitialPref("rsi14Len", "quantex_rsi14_len", 14)
  );
  const [showOscMarks, setShowOscMarks] = useState<boolean>(false);
  const [showRsiDiv, setShowRsiDiv] = useState<boolean>(false);
  const [showDivLines, setShowDivLines] = useState<boolean>(false);
  const [divLookback, setDivLookback] = useState<number>(14);

  // gp_mtf_syn: "⚡ Мультитаймфреймовый Синтез (MTF)"
  const [showAllMtfCons, setShowAllMtfCons] = useState<boolean>(true);
  const [showMtfWave, setShowMtfWave] = useState<boolean>(false);
  const [showTpClusters, setShowTpClusters] = useState<boolean>(false);

  // gp_gex: "🏛️ GEX & Dealer Gamma Engine"
  const [useGex, setUseGex] = useState<boolean>(() =>
    getInitialPref("useGex", "quantex_use_gex", true)
  );
  const [gexAssetType, setGexAssetType] = useState<string>("Авто-Определение");
  const [gexAnchorMode, setGexAnchorMode] = useState<string>("🎯 Дневной якорь (рекомендовано)");
  const [flipSearchRange, setFlipSearchRange] = useState<number>(8);
  const [showGexWalls, setShowGexWalls] = useState<boolean>(() =>
    getInitialPref("showGexWalls", "quantex_show_gex_walls", true)
  );
  const [showGexFlip, setShowGexFlip] = useState<boolean>(() =>
    getInitialPref("showGexFlip", "quantex_show_gex_flip", true)
  );
  const [showGexPain, setShowGexPain] = useState<boolean>(() =>
    getInitialPref("showGexPain", "quantex_show_gex_pain", true)
  );
  const [showGexSleepers, setShowGexSleepers] = useState<boolean>(() =>
    getInitialPref("showGexSleepers", "quantex_show_gex_sleepers", false)
  );
  const [showGexEm, setShowGexEm] = useState<boolean>(() =>
    getInitialPref("showGexEm", "quantex_show_gex_em", false)
  );
  const [showGexBars, setShowGexBars] = useState<boolean>(() =>
    getInitialPref("showGexBars", "quantex_show_gex_bars", true)
  );
  const [gexRightLimit, setGexRightLimit] = useState<number>(80);
  const [gexAlignFc, setGexAlignFc] = useState<boolean>(true);
  const [manualPcr, setManualPcr] = useState<number>(0.0);
  const [manualRvIv, setManualRvIv] = useState<number>(0.0);

  // gp_gex_adv: "🎯 GEX Advanced (VP POC + Audit)"
  const [useVpPocWeight, setUseVpPocWeight] = useState<boolean>(true);
  const [vpLookbackBars, setVpLookbackBars] = useState<number>(200);
  const [useFridayBoost, setUseFridayBoost] = useState<boolean>(true);
  const [useGexAudit, setUseGexAudit] = useState<boolean>(true);

  // 100% synchronized indicator output (Engine single source of truth for both chart and HUD)
  const indicatorOutput = useMemo<SuperIndicatorOutput | null>(() => {
    if (!candles || candles.length < 10 || candlesKey !== `${activeAsset}_${activeTf}`) return null;
    return evaluateSuperIndicator(candles, activeAsset, activeTf, presetSel, {
      showOb,
      showFvg,
      showSr: showSrZones,
      showGex: useGex,
      showSignals,
      useFridayBoost,
      useGexAudit,
      manualPcr,
      manualRvIv,
      hudTextDensity,
      tblViewMode,
      externalGexReport: gexReport || dayGexReport
    });
  }, [
    candles,
    candlesKey,
    activeAsset,
    activeTf,
    presetSel,
    showOb,
    showFvg,
    showSrZones,
    useGex,
    showSignals,
    useFridayBoost,
    useGexAudit,
    manualPcr,
    manualRvIv,
    hudTextDensity,
    tblViewMode,
    dayGexReport,
    gexReport
  ]);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsActiveGroup, setSettingsActiveGroup] = useState<string>("presets");

  // Selected strike for GEX detail modal / breakdown
  const [selectedStrikeDetail, setSelectedStrikeDetail] = useState<GexStrikeData | null>(null);
  const [gexHorizon, setGexHorizon] = useState<"DAY" | "WEEK" | "MONTH" | "ALL">(() =>
    getInitialPref("gexHorizon", "quantex_gex_horizon", "DAY")
  );
  const gexHorizonRef = useRef<"DAY" | "WEEK" | "MONTH" | "ALL">(gexHorizon);
  useEffect(() => {
    gexHorizonRef.current = gexHorizon;
  }, [gexHorizon]);
  const [gexFilterMode, setGexFilterMode] = useState<"atm" | "all" | "walls">(() =>
    getInitialPref("gexFilterMode", "quantex_gex_filter_mode", "atm")
  );
  const [gexMetricMode, setGexMetricMode] = useState<"gex" | "oi" | "volume">(() =>
    getInitialPref("gexMetricMode", "quantex_gex_metric_mode", "gex")
  );
  const [gexExplTab, setGexExplTab] = useState<"simple" | "scenarios" | "guide" | "rules">("simple");

  // ========================================================
  // 💾 PERSISTENCE ENGINE: HYDRATE & DEBOUNCED AUTO-SYNC (PER-USER)
  // ========================================================
  const isHydratedFromServerRef = useRef<boolean>(false);
  const saveDebounceTimerRef = useRef<any>(null);
  const activeUsername = (stationUser?.username || "admin").trim().toLowerCase();

  const applyPreferencesToState = (p: Record<string, any>) => {
    if (p.activeAsset !== undefined) setActiveAsset(p.activeAsset);
    if (p.activeTf !== undefined) setActiveTf(p.activeTf);
    if (p.chartStyle !== undefined) setChartStyle(p.chartStyle);
    if (p.stationTheme !== undefined && STATION_THEMES.some(t => t.id === p.stationTheme)) {
      setStationTheme(p.stationTheme);
    }
    if (p.showEma9 !== undefined) setShowEma9(Boolean(p.showEma9));
    if (p.showEma21 !== undefined) setShowEma21(Boolean(p.showEma21));
    if (p.showEma50 !== undefined) setShowEma50(Boolean(p.showEma50));
    if (p.showEma100 !== undefined) setShowEma100(Boolean(p.showEma100));
    if (p.showEma200 !== undefined) setShowEma200(Boolean(p.showEma200));
    if (p.showRsiPane !== undefined) setShowRsiPane(Boolean(p.showRsiPane));
    if (p.showStochPane !== undefined) setShowStochPane(Boolean(p.showStochPane));
    if (p.macdPaneHeight !== undefined) setMacdPaneHeight(Number(p.macdPaneHeight));
    if (p.rsiPaneHeight !== undefined) setRsiPaneHeight(Number(p.rsiPaneHeight));
    if (p.stochPaneHeight !== undefined) setStochPaneHeight(Number(p.stochPaneHeight));
    if (p.hudScale !== undefined) setHudScale(Number(p.hudScale));
    if (p.hudFontSize !== undefined) setHudFontSize(Number(p.hudFontSize));
    if (p.chartLabelScale !== undefined) setChartLabelScale(String(p.chartLabelScale));
    if (p.soundAlertsEnabled !== undefined) setSoundAlertsEnabled(Boolean(p.soundAlertsEnabled));
    if (p.chartLabelFontSize !== undefined) setChartLabelFontSize(Number(p.chartLabelFontSize));
    if (p.showChartBadgeBorders !== undefined) setShowChartBadgeBorders(Boolean(p.showChartBadgeBorders));
    if (p.isHudMinimized !== undefined) setIsHudMinimized(Boolean(p.isHudMinimized));
    if (p.aiPanelWidth !== undefined) setAiPanelWidth(Number(p.aiPanelWidth));
    if (p.isAiPanelCollapsed !== undefined) setIsAiPanelCollapsed(Boolean(p.isAiPanelCollapsed));
    if (p.hudPos !== undefined) setHudPos(p.hudPos);
    if (p.presetSel !== undefined) setPresetSel(String(p.presetSel));
    if (p.showTables !== undefined) setShowTables(Boolean(p.showTables));
    if (p.tblViewMode !== undefined) setTblViewMode(String(p.tblViewMode));
    if (p.hudTextDensity !== undefined) setHudTextDensity(String(p.hudTextDensity));
    if (p.tablePos !== undefined) setTablePos(String(p.tablePos));
    if (p.tableTextSz !== undefined) setTableTextSz(String(p.tableTextSz));
    if (p.textSzOpt !== undefined) setTextSzOpt(String(p.textSzOpt));
    if (p.cleanOb !== undefined) setCleanOb(Boolean(p.cleanOb));
    if (p.mergeObFvg !== undefined) setMergeObFvg(Boolean(p.mergeObFvg));
    if (p.showSweeps !== undefined) setShowSweeps(Boolean(p.showSweeps));
    if (p.useAntiRound !== undefined) setUseAntiRound(Boolean(p.useAntiRound));
    if (p.showBos !== undefined) setShowBos(Boolean(p.showBos));
    if (p.showOb !== undefined) setShowOb(Boolean(p.showOb));
    if (p.showFvg !== undefined) setShowFvg(Boolean(p.showFvg));
    if (p.showSrZones !== undefined) setShowSrZones(Boolean(p.showSrZones));
    if (p.fibPeriod !== undefined) setFibPeriod(Number(p.fibPeriod));
    if (p.showProbs !== undefined) setShowProbs(Boolean(p.showProbs));
    if (p.dirMode !== undefined) setDirMode(String(p.dirMode));
    if (p.showReversal !== undefined) setShowReversal(Boolean(p.showReversal));
    if (p.showForecast !== undefined) setShowForecast(Boolean(p.showForecast));
    if (p.showAltWave !== undefined) setShowAltWave(Boolean(p.showAltWave));
    if (p.fcLookback !== undefined) setFcLookback(Number(p.fcLookback));
    if (p.fcTargetMult !== undefined) setFcTargetMult(Number(p.fcTargetMult));
    if (p.showSignals !== undefined) setShowSignals(Boolean(p.showSignals));
    if (p.signalMode !== undefined) setSignalMode(String(p.signalMode));
    if (p.showTrendL !== undefined) setShowTrendL(Boolean(p.showTrendL));
    if (p.trendType !== undefined) setTrendType(String(p.trendType));
    if (p.trendLen !== undefined) setTrendLen(Number(p.trendLen));
    if (p.useTrailing !== undefined) setUseTrailing(Boolean(p.useTrailing));
    if (p.trailMode !== undefined) setTrailMode(String(p.trailMode));
    if (p.showTrailLine !== undefined) setShowTrailLine(Boolean(p.showTrailLine));
    if (p.showMacdPane !== undefined) setShowMacdPane(Boolean(p.showMacdPane));
    if (p.macdFast !== undefined) setMacdFast(Number(p.macdFast));
    if (p.macdSlow !== undefined) setMacdSlow(Number(p.macdSlow));
    if (p.macdSigLen !== undefined) setMacdSigLen(Number(p.macdSigLen));
    if (p.rsi6Len !== undefined) setRsi6Len(Number(p.rsi6Len));
    if (p.rsi14Len !== undefined) setRsi14Len(Number(p.rsi14Len));
    if (p.useGex !== undefined) setUseGex(Boolean(p.useGex));
    if (p.showGexWalls !== undefined) setShowGexWalls(Boolean(p.showGexWalls));
    if (p.showGexFlip !== undefined) setShowGexFlip(Boolean(p.showGexFlip));
    if (p.showGexPain !== undefined) setShowGexPain(Boolean(p.showGexPain));
    if (p.showGexSleepers !== undefined) setShowGexSleepers(Boolean(p.showGexSleepers));
    if (p.showGexEm !== undefined) setShowGexEm(Boolean(p.showGexEm));
    if (p.showGexBars !== undefined) setShowGexBars(Boolean(p.showGexBars));
    if (p.gexHorizon !== undefined) setGexHorizon(p.gexHorizon);
    if (p.gexFilterMode !== undefined) setGexFilterMode(p.gexFilterMode);
    if (p.gexMetricMode !== undefined) setGexMetricMode(p.gexMetricMode);
  };

  // 1. Hydration from localStorage & server for active user
  useEffect(() => {
    let isCancelled = false;
    const u = activeUsername;

    // Load instantly from user's local storage cache
    try {
      const userCached = localStorage.getItem(`${STATION_PREFS_KEY}_${u}`);
      if (userCached) {
        const parsed = JSON.parse(userCached);
        if (parsed && typeof parsed === "object") {
          applyPreferencesToState(parsed);
        }
      }
    } catch {}

    // Hydrate latest persistent profile from server
    fetch(`/api/settings/user-preferences?username=${encodeURIComponent(u)}`)
      .then(res => res.json())
      .then(data => {
        if (isCancelled) return;
        if (data?.success && data.preferences && Object.keys(data.preferences).length > 0) {
          applyPreferencesToState(data.preferences);
          try {
            localStorage.setItem(`${STATION_PREFS_KEY}_${u}`, JSON.stringify(data.preferences));
            localStorage.setItem(STATION_PREFS_KEY, JSON.stringify(data.preferences));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        isHydratedFromServerRef.current = true;
      });

    return () => {
      isCancelled = true;
    };
  }, [activeUsername]);

  // 2. Debounced auto-sync to user's storage and station-settings.json on the server
  useEffect(() => {
    const u = activeUsername;
    const currentPrefs = {
      activeAsset,
      activeTf,
      chartStyle,
      stationTheme,
      showEma9,
      showEma21,
      showEma50,
      showEma100,
      showEma200,
      showRsiPane,
      showStochPane,
      macdPaneHeight,
      rsiPaneHeight,
      stochPaneHeight,
      hudScale,
      hudFontSize,
      chartLabelScale,
      soundAlertsEnabled,
      chartLabelFontSize,
      showChartBadgeBorders,
      isHudMinimized,
      aiPanelWidth,
      isAiPanelCollapsed,
      hudPos,
      presetSel,
      showTables,
      tblViewMode,
      hudTextDensity,
      tablePos,
      tableTextSz,
      textSzOpt,
      cleanOb,
      mergeObFvg,
      showSweeps,
      useAntiRound,
      showBos,
      showOb,
      showFvg,
      showSrZones,
      fibPeriod,
      showProbs,
      dirMode,
      showReversal,
      showForecast,
      showAltWave,
      fcLookback,
      fcTargetMult,
      showSignals,
      signalMode,
      showTrendL,
      trendType,
      trendLen,
      useTrailing,
      trailMode,
      showTrailLine,
      showMacdPane,
      macdFast,
      macdSlow,
      macdSigLen,
      rsi6Len,
      rsi14Len,
      useGex,
      showGexWalls,
      showGexFlip,
      showGexPain,
      showGexSleepers,
      showGexEm,
      showGexBars,
      gexHorizon,
      gexFilterMode,
      gexMetricMode
    };

    // Save immediately to user-specific localStorage (0ms lag, survives refresh)
    try {
      localStorage.setItem(`${STATION_PREFS_KEY}_${u}`, JSON.stringify(currentPrefs));
      localStorage.setItem(STATION_PREFS_KEY, JSON.stringify(currentPrefs));
      localStorage.setItem("quantex_theme", stationTheme);
      localStorage.setItem("quantex_hud_scale", String(hudScale));
      localStorage.setItem("quantex_hud_font_size", String(hudFontSize));
      localStorage.setItem("quantex_chart_font_size", String(chartLabelFontSize));
      localStorage.setItem("quantex_chart_badge_borders", String(showChartBadgeBorders));
      localStorage.setItem("quantex_sound_alerts", String(soundAlertsEnabled));
      localStorage.setItem("quantex_macd_height", String(macdPaneHeight));
      localStorage.setItem("quantex_rsi_height", String(rsiPaneHeight));
      localStorage.setItem("quantex_stoch_height", String(stochPaneHeight));
      localStorage.setItem("quantex_ai_panel_width", String(aiPanelWidth));
    } catch {}

    // Sync to server for this specific user
    if (isHydratedFromServerRef.current) {
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = setTimeout(() => {
        fetch("/api/settings/user-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: u,
            preferences: currentPrefs
          })
        }).catch(() => {});
      }, 500);
    }
  }, [
    activeUsername,
    activeAsset, activeTf, chartStyle, stationTheme,
    showEma9, showEma21, showEma50, showEma100, showEma200, showRsiPane, showStochPane,
    macdPaneHeight, rsiPaneHeight, stochPaneHeight,
    hudScale, hudFontSize, chartLabelScale, soundAlertsEnabled,
    chartLabelFontSize, showChartBadgeBorders, isHudMinimized,
    aiPanelWidth, isAiPanelCollapsed, hudPos, presetSel, showTables,
    tblViewMode, hudTextDensity, tablePos, tableTextSz, textSzOpt,
    cleanOb, mergeObFvg, showSweeps, useAntiRound, showBos, showOb,
    showFvg, showSrZones, fibPeriod, showProbs, dirMode, showReversal,
    showForecast, showAltWave, fcLookback, fcTargetMult, showSignals,
    signalMode, showTrendL, trendType, trendLen, useTrailing, trailMode,
    showTrailLine, showMacdPane, macdFast, macdSlow, macdSigLen,
    rsi6Len, rsi14Len, useGex, showGexWalls, showGexFlip, showGexPain,
    showGexSleepers, showGexEm, showGexBars, gexHorizon, gexFilterMode,
    gexMetricMode
  ]);

  // Pine Script v6 / QUANTEX Premium v8 Editor State
  const [indicatorCode, setIndicatorCode] = useState<string>("");
  const [isScriptSaved, setIsScriptSaved] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);

  // AI Assistant State
  const [aiPromptInput, setAiPromptInput] = useState<string>("");
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string; time: string }>>([
    {
      role: "assistant",
      text: "👋 Здравствуйте! Я автономный торговый ИИ-ассистент платформы QUANTEX. Все котировки, уровни Гаммы (GEX), дельта объемов и сетапы индикатора QUANTEX Pro v8 считываются непосредственно из автономного движка сервера без внешних сервисов и скриншотов.",
      time: "Автономно"
    }
  ]);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Economic Calendar State & Synchronization Metadata
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<string>("ALL");
  const [calendarSyncMeta, setCalendarSyncMeta] = useState<{ date: string; timeMsk: string; receivedAt?: string }>({
    date: new Date().toLocaleDateString("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    timeMsk:
      new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Moscow",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date()) + " МСК",
    receivedAt:
      new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Moscow",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date()) + " МСК"
  });

  // Macro News Feed State & Filters (Unified 5 sections: ALL | GOLD | GEOPOLITICS | MOEX | CRYPTO)
  const [marketNews, setMarketNews] = useState<MacroNewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState<boolean>(false);
  const [calendarSubTab, setCalendarSubTab] = useState<"news" | "calendar">("news");
  const [stationNewsCategory, setStationNewsCategory] = useState<string>("ALL");
  const [stationNewsSearch, setStationNewsSearch] = useState<string>("");
  const [stationNewsImpact, setStationNewsImpact] = useState<string>("ALL");

  // Client-side sanitizer to ensure no raw URLs or link artifacts ever appear in news titles/summaries
  const cleanNewsTextClient = (raw?: string): string => {
    if (!raw) return "";
    return raw
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/www\.\S+/gi, "")
      .replace(/\b[a-z0-9-]+\.(ru|com|org|net|io|info|me|co|uk)(\/\S*)?/gi, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  // Unified section matcher for both News and Daily Events: ALL | GOLD | GEOPOLITICS | MOEX | CRYPTO
  const matchesMarketSection = (item: any, targetSection: string): boolean => {
    if (!targetSection || targetSection === "ALL") return true;
    if (item.section === targetSection) return true;
    if (Array.isArray(item.sections) && item.sections.includes(targetSection)) return true;

    const text = `${item.title || ""} ${item.summary || ""} ${item.impact || ""} ${item.category || ""} ${item.currency || ""} ${(item.affectedAssets || []).join(" ")}`.toLowerCase();
    if (targetSection === "GEOPOLITICS") {
      return (
        item.category === "GEOPOLITICS" ||
        item.section === "GEOPOLITICS" ||
        /(геополит|военн|конфликт|санкци|ормуз|красн.*мор|хусит|ближн.*восток|нато|тайван|израиль|иран|украин|эмбарго|пошлин|тариф|переговор|оборон|безопасност)/i.test(text)
      );
    }
    if (targetSection === "MOEX") {
      return (
        item.category === "MOEX_MARKET" ||
        item.currency === "RUB" ||
        /(мосбирж|moex|цб рф|банк россии|рубл|gldrubf|si|ri|brent| росстат|минфин)/i.test(text)
      );
    }
    if (targetSection === "CRYPTO") {
      return (
        item.category === "CRYPTO" ||
        item.currency === "USDT" ||
        /(биткоин|bitcoin|btc|эфириум|ethereum|eth|solana|sol|xrp|крипт|crypto|deribit|etf)/i.test(text)
      );
    }
    if (targetSection === "GOLD") {
      return (
        item.category === "GOLD_MARKET" ||
        item.category === "FED_RATES" ||
        item.category === "INFLATION" ||
        item.category === "LABOR" ||
        item.category === "DXY" ||
        item.category === "GEOPOLITICS" ||
        /(золот|xauusd|oanda|фрс|fomc|инфляц|cpi|pce|dxy|us10y|трежерис|ввп|pmi)/i.test(text)
      );
    }
    return true;
  };

  const getSectionBadgeMeta = (item: any): { code: "GOLD" | "GEOPOLITICS" | "MOEX" | "CRYPTO"; label: string; className: string } => {
    const sec = item.section || (
      item.category === "GEOPOLITICS" || (matchesMarketSection(item, "GEOPOLITICS") && !item.category?.includes("FED")) ? "GEOPOLITICS" :
      matchesMarketSection(item, "MOEX") && !matchesMarketSection(item, "GOLD") ? "MOEX" :
      matchesMarketSection(item, "CRYPTO") && !matchesMarketSection(item, "GOLD") ? "CRYPTO" : "GOLD"
    );
    if (sec === "GEOPOLITICS") {
      return {
        code: "GEOPOLITICS",
        label: "🌍 Геополитика",
        className: "bg-red-500/20 text-red-300 border border-red-500/40"
      };
    }
    if (sec === "MOEX") {
      return {
        code: "MOEX",
        label: "🇷🇺 MOEX",
        className: "bg-sky-500/20 text-sky-300 border border-sky-500/40"
      };
    }
    if (sec === "CRYPTO") {
      return {
        code: "CRYPTO",
        label: "₿ Крипта",
        className: "bg-purple-500/20 text-purple-300 border border-purple-500/40"
      };
    }
    return {
      code: "GOLD",
      label: "🪙 Золото",
      className: "bg-amber-500/20 text-amber-300 border border-amber-500/40"
    };
  };

  const getNewsTimestampMs = (item: MacroNewsItem): number => {
    if (typeof (item as any).timestampMs === "number" && !isNaN((item as any).timestampMs)) {
      return (item as any).timestampMs;
    }
    if (item.publishedAt) {
      const parsed = new Date(item.publishedAt).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    // Fallback parse from DD.MM.YYYY • HH:MM МСК
    const m = (item.time || "").match(/(\d{2})\.(\d{2})\.(\d{4}).*?(\d{2}):(\d{2})/);
    if (m) {
      const [, dd, mm, yyyy, hh, min] = m;
      return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00+03:00`).getTime();
    }
    return 0;
  };

  const formatRelativeFreshness = (tsMs: number): string => {
    if (!tsMs) return "Свежая";
    const diffMin = Math.max(0, Math.floor((Date.now() - tsMs) / 60000));
    if (diffMin <= 2) return "Только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    const hours = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (hours < 24) return remMin > 0 ? `${hours} ч ${remMin} мин назад` : `${hours} ч назад`;
    return `${Math.floor(hours / 24)} дн назад`;
  };

  // Strictly sorted news feed: freshest news at the top, descending by timestamp
  const sortedMarketNews = useMemo(() => {
    return [...marketNews]
      .map((item) => ({
        ...item,
        title: cleanNewsTextClient(item.title) || item.title,
        summary: cleanNewsTextClient(item.summary) || item.summary,
        _tsMs: getNewsTimestampMs(item)
      }))
      .sort((a, b) => b._tsMs - a._tsMs);
  }, [marketNews]);

  // Trade Journal State
  const [journalTrades, setJournalTrades] = useState<TradeItem[]>([]);
  const [newTradeAsset, setNewTradeAsset] = useState<string>("XAUUSD");
  const [newTradeType, setNewTradeType] = useState<"BUY" | "SELL">("BUY");
  const [newTradeEntry, setNewTradeEntry] = useState<string>("");
  const [newTradeExit, setNewTradeExit] = useState<string>("");
  const [newTradeSize, setNewTradeSize] = useState<string>("1.0");
  const [newTradePnl, setNewTradePnl] = useState<string>("");
  const [newTradeNotes, setNewTradeNotes] = useState<string>("");

  // Lightweight Charts DOM Container & References
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const macdContainerRef = useRef<HTMLDivElement | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const stochContainerRef = useRef<HTMLDivElement | null>(null);

  const chartInstanceRef = useRef<IChartApi | null>(null);
  const macdChartInstanceRef = useRef<IChartApi | null>(null);
  const rsiChartInstanceRef = useRef<IChartApi | null>(null);
  const stochChartInstanceRef = useRef<IChartApi | null>(null);

  const seriesInstanceRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const trendLineSeriesRef = useRef<any>(null);

  // EMA series on main chart (Binance 5 EMAs: 9, 21, 50, 100, 200)
  const ema9SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);
  const ema50SeriesRef = useRef<any>(null);
  const ema100SeriesRef = useRef<any>(null);
  const ema200SeriesRef = useRef<any>(null);

  // MACD series
  const macdHistSeriesRef = useRef<any>(null);
  const macdFastSeriesRef = useRef<any>(null);
  const macdSlowSeriesRef = useRef<any>(null);

  // RSI series
  const rsi6SeriesRef = useRef<any>(null);
  const rsi14SeriesRef = useRef<any>(null);

  // Stochastic series
  const stochKSeriesRef = useRef<any>(null);
  const stochDSeriesRef = useRef<any>(null);

  const priceLinesRef = useRef<any[]>([]);
  const zonesPrimitiveRef = useRef<TradingViewZonesPrimitive | null>(null);
  const seriesMarkersRef = useRef<any>(null);
  const prevChartStyleRef = useRef<string>(chartStyle);
  const lastFittedKeyRef = useRef<string>("");
  const prevCleanCandlesRef = useRef<any[]>([]);

  // 1. Fetch Market Candles from local server
  const fetchCandles = async (symbol: AssetSymbol, interval: Timeframe) => {
    const mySeq = ++fetchSeqRef.current;
    try {
      setIsLoadingCandles(true);
      const res = await fetch(`/api/market/candles?symbol=${symbol}&interval=${interval}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        // Discard stale out-of-order responses if user switched asset or timeframe
        if (mySeq !== fetchSeqRef.current || symbol !== activeAssetRef.current || interval !== activeTfRef.current) {
          return;
        }
        if (data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
          const cleanBars: any[] = [];
          for (let i = 0; i < data.candles.length; i++) {
            const c = data.candles[i];
            if (!c || typeof c.time !== "number" || isNaN(c.time)) continue;
            if (cleanBars.length > 0 && c.time <= cleanBars[cleanBars.length - 1].time) {
              const last = cleanBars[cleanBars.length - 1];
              cleanBars[cleanBars.length - 1] = {
                time: last.time,
                open: Number(c.open ?? last.open),
                high: Math.max(Number(c.high ?? last.high), last.high),
                low: Math.min(Number(c.low ?? last.low), last.low),
                close: Number(c.close ?? last.close),
                volume: Number(c.volume || last.volume || 100)
              };
            } else {
              cleanBars.push({
                time: c.time,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume || 100)
              });
            }
          }
          const key = `${symbol}_${interval}`;
          const prevCached = clientCandlesCacheRef.current.get(key);
          let finalBars = cleanBars;
          if (!prevCached) {
            // First real server response for this symbol+timeframe (replacing initial fallback candles)
            lastFittedKeyRef.current = "";
          } else if (
            prevCached.length > 0 &&
            cleanBars.length > 0 &&
            prevCached[prevCached.length - 1].time >= cleanBars[0].time
          ) {
            // Preserve intra-bar high/low wick extremes on the live forming candle so wicks never shrink or flicker between polls
            const prevLast = prevCached[prevCached.length - 1];
            const newLast = cleanBars[cleanBars.length - 1];
            if (prevLast && newLast && prevLast.time === newLast.time) {
              cleanBars[cleanBars.length - 1] = {
                ...newLast,
                high: Math.max(newLast.high, prevLast.high),
                low: Math.min(newLast.low, prevLast.low)
              };
            }
            // Merge older session bars so cleanCandles[0].time stays anchored and never shifts on new candle rollovers
            const olderPrefix = prevCached.filter((b: any) => b.time < cleanBars[0].time);
            if (olderPrefix.length > 0 && olderPrefix.length + cleanBars.length <= 600) {
              finalBars = [...olderPrefix, ...cleanBars];
            }
          }
          clientCandlesCacheRef.current.set(key, finalBars);
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("quantex_real_candles_" + key, JSON.stringify(finalBars.slice(-300)));
            } catch {}
          }
          setCandles(finalBars);
          setCandlesKey(key);
          setLastUpdatedMsk(new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" }) + " МСК");
        }
        if (data.oandaData) {
          setOandaData(data.oandaData);
        }
        setMarketStatus({
          isOpen: data.marketOpen !== false,
          isPremarket: !!data.isPremarket,
          isClearing: !!data.isClearing,
          sessionType: data.sessionType || (data.marketOpen !== false ? "DAY" : "NIGHT"),
          statusBadge: data.statusBadge || (data.marketOpen !== false ? "Торги идут" : "Сейчас нет торгов"),
          statusText: data.marketStatusText || (data.marketOpen === false ? "Сейчас нет торгов" : "Торги открыты")
        });
        setActiveContractInfo({
          secId: data.moexSecId,
          shortName: data.shortName,
          source: data.source,
          quarterLabel: data.quarterLabel,
          openPosition: data.openPosition,
          volToday: data.volToday,
          marketOpen: data.marketOpen !== false,
          isPremarket: !!data.isPremarket,
          isClearing: !!data.isClearing,
          sessionType: data.sessionType,
          statusBadge: data.statusBadge,
          marketStatusText: data.marketStatusText || (data.marketOpen === false ? "Сейчас нет торгов" : "Торги идут")
        });
      }
    } catch (e: any) {
      console.warn("Candle fetch notice:", e.message);
    } finally {
      setIsLoadingCandles(false);
    }
  };

  // 1b. Fetch Real MOEX Quarterly Contracts (Auto-rollover GDZ6/GNZ6)
  const fetchMoexContracts = async () => {
    try {
      const res = await fetch("/api/market/moex/contracts");
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setMoexContracts(d);
        }
      }
    } catch (e) {
      console.warn("Notice loading MOEX contracts:", e);
    }
  };

  // 2. Fetch GEX Report from local server
  const fetchGexReport = async (symbol: AssetSymbol, horizon?: "DAY" | "WEEK" | "MONTH" | "ALL") => {
    const targetH = horizon || gexHorizonRef.current;
    try {
      setIsLoadingGex(true);
      const res = await fetch(`/api/gex/report?asset=${symbol}&horizon=${targetH}`);
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setGexReport(data.report);
          if (targetH === "DAY") {
            setDayGexReport(data.report);
          }
        }
      }
    } catch (e: any) {
      console.warn("GEX fetch notice:", e.message);
    } finally {
      setIsLoadingGex(false);
    }
  };

  // 2b. Fetch DAY GEX Report specifically for Station Chart & Indicator mathematical forecasts
  const fetchDayGexReport = async (symbol: AssetSymbol) => {
    try {
      const res = await fetch(`/api/gex/report?asset=${symbol}&horizon=DAY`);
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setDayGexReport(data.report);
        }
      }
    } catch (e: any) {
      console.warn("DAY GEX fetch notice:", e.message);
    }
  };

  const handleSelectGexHorizon = (horizon: "DAY" | "WEEK" | "MONTH" | "ALL") => {
    gexHorizonRef.current = horizon;
    setGexHorizon(horizon);
    fetchGexReport(activeAsset, horizon);
  };

  // 3. Fetch Economic Calendar from local server (with Moscow date & time synchronization)
  const fetchCalendar = async () => {
    try {
      const res = await fetch("/api/market/economic-calendar");
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          setCalendarEvents(data.events);
        }
        if (data.date || data.timeMsk || data.receivedAt) {
          setCalendarSyncMeta((prev) => ({
            date: data.date || prev.date,
            timeMsk: data.timeMsk ? (String(data.timeMsk).includes("МСК") ? data.timeMsk : `${data.timeMsk} МСК`) : prev.timeMsk,
            receivedAt: data.receivedAt || prev.receivedAt
          }));
        }
      }
    } catch (e: any) {
      console.warn("Calendar fetch notice:", e.message);
    }
  };

  // 3.1 Fetch Market News from local server
  const fetchMarketNews = async () => {
    try {
      const res = await fetch("/api/market/news");
      if (res.ok) {
        const data = await res.json();
        if (data.news && Array.isArray(data.news)) {
          setMarketNews(data.news);
        }
        if (data.date || data.timeMsk || data.receivedAt) {
          setCalendarSyncMeta((prev) => ({
            date: data.date || prev.date,
            timeMsk: data.timeMsk ? (String(data.timeMsk).includes("МСК") ? data.timeMsk : `${data.timeMsk} МСК`) : prev.timeMsk,
            receivedAt: data.receivedAt || prev.receivedAt
          }));
        }
      }
    } catch (e: any) {
      console.warn("Market news fetch notice:", e.message);
    }
  };

  // 3.2 Manual on-demand refresh of macro news from RSS sources + daily price-impacting events
  const refreshMarketNews = async () => {
    setIsNewsLoading(true);
    try {
      const [res, calRes] = await Promise.all([
        fetch("/api/market/news/refresh", { method: "POST" }),
        fetch("/api/market/economic-calendar")
      ]);
      if (res.ok) {
        const data = await res.json();
        if (data.news && Array.isArray(data.news)) {
          setMarketNews(data.news);
        }
        if (data.date || data.timeMsk || data.receivedAt) {
          setCalendarSyncMeta((prev) => ({
            date: data.date || prev.date,
            timeMsk: data.timeMsk ? (String(data.timeMsk).includes("МСК") ? data.timeMsk : `${data.timeMsk} МСК`) : prev.timeMsk,
            receivedAt: data.receivedAt || prev.receivedAt
          }));
        }
      }
      if (calRes.ok) {
        const calData = await calRes.json();
        if (calData.events && Array.isArray(calData.events)) {
          setCalendarEvents(calData.events);
        }
        if (calData.date || calData.timeMsk || calData.receivedAt) {
          setCalendarSyncMeta((prev) => ({
            date: calData.date || prev.date,
            timeMsk: calData.timeMsk ? (String(calData.timeMsk).includes("МСК") ? calData.timeMsk : `${calData.timeMsk} МСК`) : prev.timeMsk,
            receivedAt: calData.receivedAt || prev.receivedAt
          }));
        }
      }
    } catch (e: any) {
      console.warn("Market news refresh notice:", e.message);
    } finally {
      setIsNewsLoading(false);
    }
  };

  // 4. Fetch Trade Journal
  const fetchJournal = async () => {
    try {
      const res = await fetch("/api/journal/trades");
      if (res.ok) {
        const data = await res.json();
        if (data.trades) {
          setJournalTrades(data.trades);
        }
      }
    } catch (e: any) {
      console.warn("Journal fetch notice:", e.message);
    }
  };

  // 5. Fetch QUANTEX Premium v8 Pine Script code from server
  const fetchIndicatorCode = async () => {
    try {
      setIsLoadingCode(true);
      const res = await fetch("/api/indicator/st-premium-code");
      if (res.ok) {
        const data = await res.json();
        if (data.code && data.code.trim().length > 0) {
          setIndicatorCode(data.code);
          return;
        }
      }
    } catch (e) {
      console.warn("Notice loading indicator code:", e);
    } finally {
      setIsLoadingCode(false);
    }
  };

  // Save QUANTEX Premium v8 Code back to server
  const handleSaveIndicatorCode = async () => {
    try {
      setIsScriptSaved(true);
      const res = await fetch("/api/indicator/st-premium-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: indicatorCode })
      });
      const d = await res.json();
      if (d.success) {
        setSaveSuccessMsg("Скрипт QUANTEX Pro v8 успешно сохранен на сервере!");
      } else {
        setSaveSuccessMsg(`Ошибка: ${d.error || "Не удалось сохранить"}`);
      }
      setTimeout(() => {
        setIsScriptSaved(false);
        setSaveSuccessMsg("");
      }, 3000);
    } catch (e: any) {
      setSaveSuccessMsg(`Ошибка сети: ${e.message}`);
      setTimeout(() => {
        setIsScriptSaved(false);
        setSaveSuccessMsg("");
      }, 3000);
    }
  };

  // Initial Data Load & Auto-Refresh Interval
  useEffect(() => {
    hydrateSetupsFromServer().then((updated) => {
      if (updated) {
        setCandles((prev) => (prev && prev.length > 0 ? [...prev] : prev));
      }
    });
    fetchCandles(activeAsset, activeTf);
    fetchDayGexReport(activeAsset);
    fetchGexReport(activeAsset, gexHorizonRef.current);
    fetchCalendar();
    fetchMarketNews();
    fetchJournal();
    fetchIndicatorCode();
    fetchMoexContracts();

    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount += 1;
      fetchCandles(activeAsset, activeTf);
      if (tickCount % 3 === 0) {
        fetchMoexContracts();
      }
      if (tickCount % 8 === 0) {
        fetchDayGexReport(activeAsset);
        fetchGexReport(activeAsset, gexHorizonRef.current);
      }
      if (tickCount % 16 === 0) {
        fetchMarketNews();
        fetchCalendar();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeAsset, activeTf]);

  // Handle Preset Resolution exactly matching `f_resolve_preset` in Pine Script
  const applyPreset = (presetName: string, changeAsset = false) => {
    setPresetSel(presetName);
    if (presetName === "Золото (XAUUSD) - 5 мин Скальпинг") {
      if (changeAsset) handleSelectAsset("XAUUSD");
      handleSelectTimeframe("5m");
      setLbSt(2);
      setLbIt(8);
      setLbLt(18);
      setFibPeriod(12);
      setExtremeTh(1.0);
      setSignalMode("Консервативный");
      setFcTargetMult(0.95);
      setFcLookback(18);
    } else if (presetName === "Золото (XAUUSD) - 15 мин Оптимальный") {
      if (changeAsset) handleSelectAsset("XAUUSD");
      handleSelectTimeframe("15m");
      setLbSt(3);
      setLbIt(10);
      setLbLt(22);
      setFibPeriod(15);
      setExtremeTh(1.1);
      setSignalMode("Консервативный");
      setFcTargetMult(1.10);
      setFcLookback(25);
    } else if (presetName === "Золото (XAUUSD) - 30 мин Свинг-Интрадей") {
      if (changeAsset) handleSelectAsset("XAUUSD");
      handleSelectTimeframe("30m");
      setLbSt(4);
      setLbIt(12);
      setLbLt(26);
      setFibPeriod(18);
      setExtremeTh(1.2);
      setSignalMode("Консервативный");
      setFcTargetMult(1.15);
      setFcLookback(30);
    } else if (presetName === "Золото (XAUUSD) - 1 час Интрадей/Тренд") {
      if (changeAsset) handleSelectAsset("XAUUSD");
      handleSelectTimeframe("1h");
      setLbSt(4);
      setLbIt(13);
      setLbLt(28);
      setFibPeriod(20);
      setExtremeTh(1.3);
      setSignalMode("Консервативный");
      setFcTargetMult(1.18);
      setFcLookback(32);
    } else if (presetName === "Золото (XAUUSD) - 4 часа Свинг") {
      if (changeAsset) handleSelectAsset("XAUUSD");
      handleSelectTimeframe("4h");
      setLbSt(5);
      setLbIt(14);
      setLbLt(30);
      setFibPeriod(22);
      setExtremeTh(1.4);
      setSignalMode("Сверх-Надежный");
      setFcTargetMult(1.20);
      setFcLookback(35);
    } else if (presetName === "Золото (XAUUSD) - 1 день Инвестиционный/Дневной") {
      if (changeAsset) handleSelectAsset("XAUUSD");
      handleSelectTimeframe("1d");
      setLbSt(5);
      setLbIt(15);
      setLbLt(32);
      setFibPeriod(24);
      setExtremeTh(1.5);
      setSignalMode("Сверх-Надежный");
      setFcTargetMult(1.22);
      setFcLookback(38);
    } else if (presetName === "Биткоин (BTCUSD) - 15 мин Оптимальный") {
      if (changeAsset) handleSelectAsset("BTCUSDT");
      handleSelectTimeframe("15m");
      setLbSt(3);
      setLbIt(10);
      setLbLt(24);
      setFibPeriod(18);
      setExtremeTh(1.3);
      setSignalMode("Консервативный");
      setFcTargetMult(1.20);
      setFcLookback(25);
    } else if (presetName === "Общий (Все активы) - 1 мин Скальпинг") {
      handleSelectTimeframe("1m");
      setLbSt(2);
      setLbIt(5);
      setLbLt(14);
      setFibPeriod(10);
      setExtremeTh(0.9);
      setSignalMode("Агрессивный");
      setFcTargetMult(0.75);
      setFcLookback(12);
    } else if (presetName === "Общий (Все активы) - 5 мин Быстрый скальпинг") {
      handleSelectTimeframe("5m");
      setLbSt(3);
      setLbIt(8);
      setLbLt(18);
      setFibPeriod(14);
      setExtremeTh(1.1);
      setSignalMode("Агрессивный");
      setFcTargetMult(0.90);
      setFcLookback(18);
    } else if (presetName === "Общий (Все активы) - 15 мин Оптимальный") {
      handleSelectTimeframe("15m");
      setLbSt(4);
      setLbIt(10);
      setLbLt(24);
      setFibPeriod(16);
      setExtremeTh(1.2);
      setSignalMode("Консервативный");
      setFcTargetMult(1.10);
      setFcLookback(25);
    } else if (presetName === "Общий (Все активы) - 1 час Часовой тренд") {
      handleSelectTimeframe("1h");
      setLbSt(5);
      setLbIt(13);
      setLbLt(28);
      setFibPeriod(20);
      setExtremeTh(1.4);
      setSignalMode("Консервативный");
      setFcTargetMult(1.18);
      setFcLookback(30);
    } else if (presetName === "Общий (Все активы) - 4 часа Свинг-трейдинг") {
      handleSelectTimeframe("4h");
      setLbSt(5);
      setLbIt(14);
      setLbLt(30);
      setFibPeriod(22);
      setExtremeTh(1.5);
      setSignalMode("Сверх-Надежный");
      setFcTargetMult(1.20);
      setFcLookback(35);
    } else if (presetName === "★ Универсальный (Все таймфреймы / Авто-Адаптивный)") {
      const tfSecMap: Record<string, number> = {
        "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400
      };
      const tfSec = tfSecMap[activeTf] || 900;
      const b = tfSec <= 180 ? 0 : tfSec <= 300 ? 1 : tfSec <= 900 ? 2 : tfSec <= 1800 ? 3 : tfSec <= 7200 ? 4 : tfSec <= 28800 ? 5 : 6;
      if (b === 0) {
        setLbSt(2); setLbIt(6); setLbLt(16); setFibPeriod(10); setExtremeTh(1.00); setSignalMode("Агрессивный"); setFcTargetMult(0.85); setFcLookback(16);
      } else if (b === 1) {
        setLbSt(3); setLbIt(8); setLbLt(20); setFibPeriod(12); setExtremeTh(1.10); setSignalMode("Консервативный"); setFcTargetMult(1.00); setFcLookback(20);
      } else if (b === 2) {
        setLbSt(3); setLbIt(10); setLbLt(22); setFibPeriod(15); setExtremeTh(1.15); setSignalMode("Консервативный"); setFcTargetMult(1.10); setFcLookback(25);
      } else if (b === 3) {
        setLbSt(4); setLbIt(12); setLbLt(26); setFibPeriod(18); setExtremeTh(1.25); setSignalMode("Консервативный"); setFcTargetMult(1.15); setFcLookback(28);
      } else if (b === 4) {
        setLbSt(4); setLbIt(13); setLbLt(28); setFibPeriod(20); setExtremeTh(1.35); setSignalMode("Консервативный"); setFcTargetMult(1.18); setFcLookback(32);
      } else if (b === 5) {
        setLbSt(5); setLbIt(14); setLbLt(30); setFibPeriod(22); setExtremeTh(1.45); setSignalMode("Сверх-Надежный"); setFcTargetMult(1.20); setFcLookback(35);
      } else {
        setLbSt(5); setLbIt(15); setLbLt(32); setFibPeriod(24); setExtremeTh(1.50); setSignalMode("Сверх-Надежный"); setFcTargetMult(1.22); setFcLookback(38);
      }
    }
  };

  // Dynamic Auto-Adaptation per Timeframe (Pine Script f_resolve_preset 1:1)
  useEffect(() => {
    if (presetSel === "★ Универсальный (Все таймфреймы / Авто-Адаптивный)") {
      const tfSecMap: Record<string, number> = {
        "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400
      };
      const tfSec = tfSecMap[activeTf] || 900;
      const b = tfSec <= 180 ? 0 : tfSec <= 300 ? 1 : tfSec <= 900 ? 2 : tfSec <= 1800 ? 3 : tfSec <= 7200 ? 4 : tfSec <= 28800 ? 5 : 6;
      if (b === 0) {
        setLbSt(2); setLbIt(6); setLbLt(16); setFibPeriod(10); setExtremeTh(1.00); setSignalMode("Агрессивный"); setFcTargetMult(0.85); setFcLookback(16);
      } else if (b === 1) {
        setLbSt(3); setLbIt(8); setLbLt(20); setFibPeriod(12); setExtremeTh(1.10); setSignalMode("Консервативный"); setFcTargetMult(1.00); setFcLookback(20);
      } else if (b === 2) {
        setLbSt(3); setLbIt(10); setLbLt(22); setFibPeriod(15); setExtremeTh(1.15); setSignalMode("Консервативный"); setFcTargetMult(1.10); setFcLookback(25);
      } else if (b === 3) {
        setLbSt(4); setLbIt(12); setLbLt(26); setFibPeriod(18); setExtremeTh(1.25); setSignalMode("Консервативный"); setFcTargetMult(1.15); setFcLookback(28);
      } else if (b === 4) {
        setLbSt(4); setLbIt(13); setLbLt(28); setFibPeriod(20); setExtremeTh(1.35); setSignalMode("Консервативный"); setFcTargetMult(1.18); setFcLookback(32);
      } else if (b === 5) {
        setLbSt(5); setLbIt(14); setLbLt(30); setFibPeriod(22); setExtremeTh(1.45); setSignalMode("Сверх-Надежный"); setFcTargetMult(1.20); setFcLookback(35);
      } else {
        setLbSt(5); setLbIt(15); setLbLt(32); setFibPeriod(24); setExtremeTh(1.50); setSignalMode("Сверх-Надежный"); setFcTargetMult(1.22); setFcLookback(38);
      }
    }
  }, [activeTf, presetSel]);

  // 1. Initialize Main Lightweight Chart (ONCE on mount)
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.remove();
      } catch {}
      chartInstanceRef.current = null;
    }
    while (container.firstChild) {
      try {
        container.removeChild(container.firstChild);
      } catch {}
    }

    const width = container.clientWidth || 800;
    const height = Math.max(container.clientHeight || 380, 220);

    const curThemePal = THEME_PALETTES[stationTheme] || THEME_PALETTES.cyber_dark;
    let chart: IChartApi;
    try {
      chart = createChart(container, {
        width: Math.floor(width),
        height: Math.floor(height),
        layout: {
          background: { type: ColorType.Solid, color: curThemePal.chartBg },
          textColor: "#cbd5e1",
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? 9 : 12
        },
        grid: {
          vertLines: { color: "rgba(30, 41, 59, 0.45)" },
          horzLines: { color: "rgba(30, 41, 59, 0.45)" }
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: "rgba(148, 163, 184, 0.65)",
            width: 1,
            style: 3,
            labelBackgroundColor: "#0f172a"
          },
          horzLine: {
            color: "rgba(148, 163, 184, 0.65)",
            width: 1,
            style: 3,
            labelBackgroundColor: "#0f172a"
          }
        },
        localization: {
          locale: "ru-RU",
          dateFormat: "dd.MM.yyyy",
          timeFormatter: (time: any) => {
            const timestamp = typeof time === "number" ? (time < 1e11 ? time * 1000 : time) : Number(time) * 1000;
            const date = new Date(timestamp);
            return new Intl.DateTimeFormat("ru-RU", {
              timeZone: "Europe/Moscow",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            }).format(date).replace(",", "") + " МСК";
          }
        },
        rightPriceScale: {
          borderColor: "#1e293b",
          scaleMargins: { top: 0.10, bottom: 0.14 },
          entireTextOnly: false,
          ticksVisible: true,
          alignLabels: true,
          autoScale: true,
          minimumWidth: typeof window !== "undefined" && window.innerWidth < 768 ? 50 : 68
        },
        timeScale: {
          borderColor: "#1e293b",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: typeof window !== "undefined" && window.innerWidth < 768 ? 12 : 16,
          barSpacing: typeof window !== "undefined" && window.innerWidth < 768 ? 10 : 10.5,
          minBarSpacing: 2.5,
          fixLeftEdge: false,
          fixRightEdge: false,
          tickMarkFormatter: (time: any) => {
            const timestamp = typeof time === "number" ? (time < 1e11 ? time * 1000 : time) : Number(time) * 1000;
            const date = new Date(timestamp);
            return new Intl.DateTimeFormat("ru-RU", {
              timeZone: "Europe/Moscow",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            }).format(date).replace(",", "");
          }
        },
        trackingMode: {
          exitMode: TrackingModeExitMode.OnTouchEnd
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
          axisDoubleClickReset: {
            time: true,
            price: true,
          },
        },
        kineticScroll: {
          touch: true,
          mouse: true,
        }
      });
    } catch (e) {
      console.warn("Chart creation error:", e);
      return;
    }

    // Main Series (High-Contrast TradingView Pro Palette)
    let series: any;
    if (chartStyle === "bars") {
      series = chart.addSeries(BarSeries, {
        upColor: "#00c896",
        downColor: "#ff3b5c"
      });
    } else if (chartStyle === "area") {
      series = chart.addSeries(AreaSeries, {
        topColor: "rgba(14, 165, 233, 0.35)",
        bottomColor: "rgba(14, 165, 233, 0.0)",
        lineColor: "#38bdf8",
        lineWidth: 2
      });
    } else if (chartStyle === "line") {
      series = chart.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2
      });
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#00c896",
        downColor: "#ff3b5c",
        borderVisible: false,
        wickVisible: true,
        wickUpColor: "#00e6ac",
        wickDownColor: "#ff526f"
      });
    }

    // Attach native TradingView Zones & Forecast Primitive
    try {
      const zonesPrimitive = new TradingViewZonesPrimitive();
      series.attachPrimitive(zonesPrimitive);
      zonesPrimitiveRef.current = zonesPrimitive;
    } catch (e) {
      console.warn("Could not attach zones primitive:", e);
    }

    // Volume Series at bottom (dedicated invisible price scale)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume"
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false
    });

    // Binance 5 EMA Series (9 Yellow, 21 Pink, 50 Blue, 100 Green, 200 Crimson)
    const ema9Series = chart.addSeries(LineSeries, {
      color: "#f0b90b",
      lineWidth: 1,
      title: "EMA 9",
      visible: showEma9
    });
    const ema21Series = chart.addSeries(LineSeries, {
      color: "#ec4899",
      lineWidth: 1,
      title: "EMA 21",
      visible: showEma21
    });
    const ema50Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      title: "EMA 50",
      visible: showEma50
    });
    const ema100Series = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 1,
      title: "EMA 100",
      visible: showEma100
    });
    const ema200Series = chart.addSeries(LineSeries, {
      color: "#be185d",
      lineWidth: 2,
      title: "EMA 200",
      visible: showEma200
    });

    ema9SeriesRef.current = ema9Series;
    ema21SeriesRef.current = ema21Series;
    ema50SeriesRef.current = ema50Series;
    ema100SeriesRef.current = ema100Series;
    ema200SeriesRef.current = ema200Series;

    chartInstanceRef.current = chart;
    seriesInstanceRef.current = series;
    seriesMarkersRef.current = null;
    prevChartStyleRef.current = chartStyle;
    volumeSeriesRef.current = volumeSeries;
    trendLineSeriesRef.current = null;
    priceLinesRef.current = [];
    // Force full setData reload whenever the chart instance is recreated after a tab switch
    lastFittedKeyRef.current = "";
    prevCleanCandlesRef.current = [];

    // Responsive Resize Observer + immediate next-frame dimension sync after tab switch
    const syncDimensions = () => {
      if (!chartInstanceRef.current || !container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      if (newW > 50 && newH > 50) {
        try {
          chartInstanceRef.current.applyOptions({
            width: Math.floor(newW),
            height: Math.floor(Math.max(newH, 220))
          });
        } catch {}
      }
    };
    const rafId = requestAnimationFrame(syncDimensions);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartInstanceRef.current) return;
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 50 && newH > 50 && chartInstanceRef.current) {
          try {
            chartInstanceRef.current.applyOptions({
              width: Math.floor(newW),
              height: Math.floor(Math.max(newH, 220))
            });
          } catch {}
        }
      }
    });

    resizeObserver.observe(container);

    // 🚀 Synchronize horizontal timeScale across main chart and indicator sub-panes
    syncTimeScales(chart, () => [macdChartInstanceRef.current, rsiChartInstanceRef.current, stochChartInstanceRef.current]);

    // 🚀 Suppress TradingView attribution logos
    try {
      container.querySelectorAll('a[href*="tradingview"], #tv-attr-logo').forEach(el => el.remove());
    } catch {}

    // 🚀 TradingView Desktop Pro Interaction: Vertical Price Scale Mouse Wheel Zooming & Cursor
    const handlePriceScaleWheel = (e: WheelEvent) => {
      if (!chartInstanceRef.current) return;
      const rect = container.getBoundingClientRect();
      const ps = chart.priceScale("right");
      if (!ps) return;
      const scaleWidth = Math.max(ps.width() || 68, 50);
      const isOverRightScale = (
        e.clientX >= rect.right - scaleWidth &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );

      if (!isOverRightScale) {
        return; // Allow normal chart body wheel (timeScale horizontal zoom)
      }

      // Intercept wheel event on price scale
      e.preventDefault();
      e.stopPropagation();

      let from: number | null = null;
      let to: number | null = null;
      const curRange = ps.getVisibleRange();
      if (curRange && typeof curRange.from === "number" && typeof curRange.to === "number" && curRange.to > curRange.from) {
        from = curRange.from;
        to = curRange.to;
      } else if (seriesInstanceRef.current) {
        const pTop = seriesInstanceRef.current.coordinateToPrice(2);
        const pBottom = seriesInstanceRef.current.coordinateToPrice(Math.max(container.clientHeight - 30, 20));
        if (pTop != null && pBottom != null && pTop !== pBottom) {
          from = Math.min(Number(pTop), Number(pBottom));
          to = Math.max(Number(pTop), Number(pBottom));
        }
      }

      if (from == null || to == null || from >= to || !isFinite(from) || !isFinite(to)) return;

      const span = to - from;
      if (span <= 0) return;

      // TradingView convention:
      // deltaY < 0 (scroll UP): zoom IN vertically (expand candlesticks, reduce price span)
      // deltaY > 0 (scroll DOWN): zoom OUT vertically (compress candlesticks, increase price span)
      const factor = Math.max(0.65, Math.min(1.5, Math.exp(e.deltaY * 0.0018)));
      const newSpan = Math.max(span * factor, 1e-6);

      // Anchor price at mouse cursor position
      const mouseY = Math.max(0, Math.min(e.clientY - rect.top, container.clientHeight));
      const series = seriesInstanceRef.current;
      const priceAtMouse = series ? series.coordinateToPrice(mouseY) : null;

      let newFrom: number;
      let newTo: number;

      if (priceAtMouse != null && Number(priceAtMouse) >= from && Number(priceAtMouse) <= to) {
        const p = Number(priceAtMouse);
        const ratio = (p - from) / span;
        newFrom = p - newSpan * ratio;
        newTo = p + newSpan * (1 - ratio);
      } else {
        const center = (from + to) / 2;
        newFrom = center - newSpan / 2;
        newTo = center + newSpan / 2;
      }

      if (newFrom < newTo && isFinite(newFrom) && isFinite(newTo)) {
        try {
          ps.applyOptions({ autoScale: false });
          if (typeof (ps as any).setAutoScale === "function") {
            (ps as any).setAutoScale(false);
          }
          ps.setVisibleRange({ from: newFrom, to: newTo });
        } catch (err) {
          console.warn("[Chart] Failed to set price scale visible range:", err);
        }
      }
    };

    const handlePriceScaleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const ps = chart.priceScale("right");
      if (!ps) return;
      const scaleWidth = Math.max(ps.width() || 68, 50);
      const isOverRightScale = (
        e.clientX >= rect.right - scaleWidth &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );

      if (isOverRightScale) {
        if (container.style.cursor !== "ns-resize") {
          container.style.cursor = "ns-resize";
        }
      } else {
        if (container.style.cursor === "ns-resize") {
          container.style.cursor = "";
        }
      }
    };

    const handlePriceScaleMouseLeave = () => {
      if (container.style.cursor === "ns-resize") {
        container.style.cursor = "";
      }
    };

    const handlePriceScaleDblClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const ps = chart.priceScale("right");
      if (!ps) return;
      const scaleWidth = Math.max(ps.width() || 68, 50);
      const isOverRightScale = (
        e.clientX >= rect.right - scaleWidth &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );

      if (isOverRightScale) {
        e.preventDefault();
        e.stopPropagation();
        try {
          ps.applyOptions({ autoScale: true });
          if (typeof (ps as any).setAutoScale === "function") {
            (ps as any).setAutoScale(true);
          }
        } catch {}
      }
    };

    container.addEventListener("wheel", handlePriceScaleWheel, { passive: false, capture: true });
    container.addEventListener("mousemove", handlePriceScaleMouseMove);
    container.addEventListener("mouseleave", handlePriceScaleMouseLeave);
    container.addEventListener("dblclick", handlePriceScaleDblClick, { capture: true });

    return () => {
      try {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
      } catch {}
      container.removeEventListener("wheel", handlePriceScaleWheel, true);
      container.removeEventListener("mousemove", handlePriceScaleMouseMove);
      container.removeEventListener("mouseleave", handlePriceScaleMouseLeave);
      container.removeEventListener("dblclick", handlePriceScaleDblClick, true);
      lastFittedKeyRef.current = "";
      prevCleanCandlesRef.current = [];
      seriesMarkersRef.current = null;
      if (zonesPrimitiveRef.current && seriesInstanceRef.current) {
        try {
          seriesInstanceRef.current.detachPrimitive(zonesPrimitiveRef.current);
        } catch {}
        zonesPrimitiveRef.current = null;
      }
      if (chartInstanceRef.current) {
        const chartToDispose = chartInstanceRef.current;
        chartInstanceRef.current = null;
        seriesInstanceRef.current = null;
        volumeSeriesRef.current = null;
        trendLineSeriesRef.current = null;
        ema9SeriesRef.current = null;
        ema21SeriesRef.current = null;
        ema50SeriesRef.current = null;
        ema100SeriesRef.current = null;
        ema200SeriesRef.current = null;
        priceLinesRef.current = [];
        try {
          chartToDispose.remove();
        } catch {}
      }
    };
  }, []);

  // Responsive dimension sync when returning to chart tab (instant without recreating canvas)
  useEffect(() => {
    if (activeTab === "chart") {
      const raf = requestAnimationFrame(() => {
        if (chartInstanceRef.current && chartContainerRef.current) {
          const w = chartContainerRef.current.clientWidth;
          const h = chartContainerRef.current.clientHeight;
          if (w > 50 && h > 50) {
            try {
              chartInstanceRef.current.applyOptions({
                width: Math.floor(w),
                height: Math.floor(Math.max(h, 220))
              });
            } catch {}
          }
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeTab]);

  // Chart Navigation & Panning Handlers
  const handlePanLeft = () => {
    if (!chartInstanceRef.current) return;
    const ts = chartInstanceRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (range) {
      const shift = Math.max(8, Math.round((range.to - range.from) * 0.25));
      ts.setVisibleLogicalRange({ from: range.from - shift, to: range.to - shift });
    }
  };

  const handlePanRight = () => {
    if (!chartInstanceRef.current) return;
    const ts = chartInstanceRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (range) {
      const shift = Math.max(8, Math.round((range.to - range.from) * 0.25));
      ts.setVisibleLogicalRange({ from: range.from + shift, to: range.to + shift });
    }
  };

  const handleZoomIn = () => {
    if (!chartInstanceRef.current) return;
    const ts = chartInstanceRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const newSpan = Math.max(12, span * 0.75);
      const center = (range.from + range.to) / 2;
      ts.setVisibleLogicalRange({ from: center - newSpan / 2, to: center + newSpan / 2 });
    }
  };

  const handleZoomOut = () => {
    if (!chartInstanceRef.current) return;
    const ts = chartInstanceRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const newSpan = Math.min((candles?.length || 100) + 60, span * 1.35);
      const center = (range.from + range.to) / 2;
      ts.setVisibleLogicalRange({ from: center - newSpan / 2, to: center + newSpan / 2 });
    }
  };

  const handleResetChart = () => {
    if (!chartInstanceRef.current || !candles || candles.length === 0) return;
    const dynamicOffset = typeof window !== "undefined" && window.innerWidth < 768 ? 14 : 22;
    const visibleBars = typeof window !== "undefined" && window.innerWidth < 768 ? 42 : 65;
    const fromIdx = Math.max(0, candles.length - visibleBars);
    const toIdx = candles.length + dynamicOffset;
    try {
      chartInstanceRef.current.priceScale("right").applyOptions({ autoScale: true });
      chartInstanceRef.current.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
    } catch {}
  };

  const handleScrollToRealtime = () => {
    if (!chartInstanceRef.current) return;
    try {
      chartInstanceRef.current.priceScale("right").applyOptions({ autoScale: true });
      chartInstanceRef.current.timeScale().scrollToRealTime();
    } catch {}
  };

  // 2. Initialize MACD Sub-Panel (if showMacdPane is true)
  useEffect(() => {
    if (!showMacdPane) return;
    const container = macdContainerRef.current;
    if (!container) return;

    if (macdChartInstanceRef.current) {
      try {
        macdChartInstanceRef.current.remove();
      } catch {}
      macdChartInstanceRef.current = null;
    }
    while (container.firstChild) {
      try {
        container.removeChild(container.firstChild);
      } catch {}
    }

    const width = container.clientWidth || 800;
    const height = 110;

    const curTheme = THEME_PALETTES[stationTheme] || THEME_PALETTES.cyber_dark;
    let macdChart: IChartApi;
    try {
      macdChart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: curTheme.chartBg },
          textColor: "#64748b",
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? 9 : 11
        },
        grid: {
          vertLines: { color: curTheme.chartGrid },
          horzLines: { color: curTheme.chartGrid }
        },
        timeScale: {
          borderColor: "#1e293b",
          visible: true,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: typeof window !== "undefined" && window.innerWidth < 768 ? 12 : 16,
          barSpacing: typeof window !== "undefined" && window.innerWidth < 768 ? 10 : 10.5,
          minBarSpacing: 2.5,
          tickMarkFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return d.toLocaleTimeString("ru-RU", {
              timeZone: "Europe/Moscow",
              hour: "2-digit",
              minute: "2-digit"
            });
          }
        },
        localization: {
          locale: "ru-RU",
          timeFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return (
              d.toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              }) + " МСК"
            );
          }
        },
        rightPriceScale: {
          borderColor: "#1e293b",
          scaleMargins: { top: 0.1, bottom: 0.1 },
          autoScale: true,
          minimumWidth: typeof window !== "undefined" && window.innerWidth < 768 ? 50 : 68
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        handleScale: {
          axisPressedMouseMove: { time: true, price: true },
          mouseWheel: true,
          pinch: true,
          axisDoubleClickReset: { time: true, price: true }
        }
      });
    } catch {
      return;
    }

    const histSeries = macdChart.addSeries(CandlestickSeries, {
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: false,
      upColor: "transparent",
      downColor: "transparent",
      borderVisible: true,
      wickVisible: false,
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d"
    });
    const fastSeries = macdChart.addSeries(LineSeries, {
      color: "#facc15",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false
    });
    const slowSeries = macdChart.addSeries(LineSeries, {
      color: "#ec4899",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false
    });

    macdChartInstanceRef.current = macdChart;
    macdHistSeriesRef.current = histSeries;
    macdFastSeriesRef.current = fastSeries;
    macdSlowSeriesRef.current = slowSeries;
    lastFittedKeyRef.current = "";

    // 🚀 Synchronize horizontal timeScale with main chart and other indicator sub-panes
    syncTimeScales(macdChart, () => [chartInstanceRef.current, rsiChartInstanceRef.current, stochChartInstanceRef.current]);
    try {
      const curRange = chartInstanceRef.current?.timeScale().getVisibleLogicalRange();
      if (curRange) macdChart.timeScale().setVisibleLogicalRange(curRange);
      container.querySelectorAll('a[href*="tradingview"], #tv-attr-logo').forEach(el => el.remove());
    } catch {}

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW } = entry.contentRect;
        if (newW > 50 && macdChartInstanceRef.current) {
          try {
            macdChartInstanceRef.current.applyOptions({ width: newW });
          } catch {}
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      try {
        resizeObserver.disconnect();
      } catch {}
      if (macdChartInstanceRef.current) {
        const c = macdChartInstanceRef.current;
        macdChartInstanceRef.current = null;
        macdHistSeriesRef.current = null;
        macdFastSeriesRef.current = null;
        macdSlowSeriesRef.current = null;
        try {
          c.remove();
        } catch {}
      }
    };
  }, [showMacdPane]);

  // 2b. Initialize RSI Sub-Panel (RSI 6 and RSI 14)
  useEffect(() => {
    if (!showRsiPane) return;
    const container = rsiContainerRef.current;
    if (!container) return;

    if (rsiChartInstanceRef.current) {
      try { rsiChartInstanceRef.current.remove(); } catch {}
      rsiChartInstanceRef.current = null;
    }
    while (container.firstChild) {
      try { container.removeChild(container.firstChild); } catch {}
    }

    const curTheme = THEME_PALETTES[stationTheme] || THEME_PALETTES.cyber_dark;
    const width = container.clientWidth || 800;
    const height = 110;

    let rsiChart: IChartApi;
    try {
      rsiChart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: curTheme.chartBg },
          textColor: "#64748b",
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? 9 : 11
        },
        grid: {
          vertLines: { color: curTheme.chartGrid },
          horzLines: { color: curTheme.chartGrid }
        },
        timeScale: {
          borderColor: "#1e293b",
          visible: true,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: typeof window !== "undefined" && window.innerWidth < 768 ? 12 : 16,
          barSpacing: typeof window !== "undefined" && window.innerWidth < 768 ? 10 : 10.5,
          minBarSpacing: 2.5,
          tickMarkFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return d.toLocaleTimeString("ru-RU", {
              timeZone: "Europe/Moscow",
              hour: "2-digit",
              minute: "2-digit"
            });
          }
        },
        localization: {
          locale: "ru-RU",
          timeFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return (
              d.toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              }) + " МСК"
            );
          }
        },
        rightPriceScale: {
          borderColor: "#1e293b",
          scaleMargins: { top: 0.1, bottom: 0.1 },
          autoScale: true,
          minimumWidth: typeof window !== "undefined" && window.innerWidth < 768 ? 50 : 68
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        handleScale: {
          axisPressedMouseMove: { time: true, price: true },
          mouseWheel: true,
          pinch: true,
          axisDoubleClickReset: { time: true, price: true }
        }
      });
    } catch {
      return;
    }

    const rsi6Series = rsiChart.addSeries(LineSeries, {
      color: "#f0b90b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false
    });
    const rsi14Series = rsiChart.addSeries(LineSeries, {
      color: "#ec4899",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false
    });

    try {
      rsi6Series.createPriceLine({ price: 90, color: "rgba(255, 255, 255, 0.25)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "90,0" });
      rsi6Series.createPriceLine({ price: 50, color: "rgba(255, 255, 255, 0.25)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "50,0" });
      rsi6Series.createPriceLine({ price: 10, color: "rgba(255, 255, 255, 0.15)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "10,0" });
    } catch {}

    rsiChartInstanceRef.current = rsiChart;
    rsi6SeriesRef.current = rsi6Series;
    rsi14SeriesRef.current = rsi14Series;
    lastFittedKeyRef.current = "";

    // 🚀 Synchronize horizontal timeScale with main chart and other indicator sub-panes
    syncTimeScales(rsiChart, () => [chartInstanceRef.current, macdChartInstanceRef.current, stochChartInstanceRef.current]);
    try {
      const curRange = chartInstanceRef.current?.timeScale().getVisibleLogicalRange();
      if (curRange) rsiChart.timeScale().setVisibleLogicalRange(curRange);
      container.querySelectorAll('a[href*="tradingview"], #tv-attr-logo').forEach(el => el.remove());
    } catch {}

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW } = entry.contentRect;
        if (newW > 50 && rsiChartInstanceRef.current) {
          try { rsiChartInstanceRef.current.applyOptions({ width: newW }); } catch {}
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      try { resizeObserver.disconnect(); } catch {}
      if (rsiChartInstanceRef.current) {
        const c = rsiChartInstanceRef.current;
        rsiChartInstanceRef.current = null;
        rsi6SeriesRef.current = null;
        rsi14SeriesRef.current = null;
        try { c.remove(); } catch {}
      }
    };
  }, [showRsiPane]);

  // 2c. Initialize Stochastic Sub-Panel (%K 14, %D 3)
  useEffect(() => {
    if (!showStochPane) return;
    const container = stochContainerRef.current;
    if (!container) return;

    if (stochChartInstanceRef.current) {
      try { stochChartInstanceRef.current.remove(); } catch {}
      stochChartInstanceRef.current = null;
    }
    while (container.firstChild) {
      try { container.removeChild(container.firstChild); } catch {}
    }

    const curTheme = THEME_PALETTES[stationTheme] || THEME_PALETTES.cyber_dark;
    const width = container.clientWidth || 800;
    const height = 110;

    let stochChart: IChartApi;
    try {
      stochChart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: curTheme.chartBg },
          textColor: "#64748b",
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? 9 : 11
        },
        grid: {
          vertLines: { color: curTheme.chartGrid },
          horzLines: { color: curTheme.chartGrid }
        },
        timeScale: {
          borderColor: "#1e293b",
          visible: true,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: typeof window !== "undefined" && window.innerWidth < 768 ? 12 : 16,
          barSpacing: typeof window !== "undefined" && window.innerWidth < 768 ? 10 : 10.5,
          minBarSpacing: 2.5,
          tickMarkFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return d.toLocaleTimeString("ru-RU", {
              timeZone: "Europe/Moscow",
              hour: "2-digit",
              minute: "2-digit"
            });
          }
        },
        localization: {
          locale: "ru-RU",
          timeFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return (
              d.toLocaleString("ru-RU", {
                timeZone: "Europe/Moscow",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              }) + " МСК"
            );
          }
        },
        rightPriceScale: {
          borderColor: "#1e293b",
          scaleMargins: { top: 0.1, bottom: 0.1 },
          autoScale: true,
          minimumWidth: typeof window !== "undefined" && window.innerWidth < 768 ? 50 : 68
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        handleScale: {
          axisPressedMouseMove: { time: true, price: true },
          mouseWheel: true,
          pinch: true,
          axisDoubleClickReset: { time: true, price: true }
        }
      });
    } catch {
      return;
    }

    const kSeries = stochChart.addSeries(LineSeries, {
      color: "#f0b90b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false
    });
    const dSeries = stochChart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false
    });

    try {
      kSeries.createPriceLine({ price: 90, color: "rgba(255, 255, 255, 0.25)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "90,0" });
      kSeries.createPriceLine({ price: 40, color: "rgba(255, 255, 255, 0.25)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "40,0" });
      kSeries.createPriceLine({ price: 10, color: "rgba(255, 255, 255, 0.15)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "10,0" });
    } catch {}

    stochChartInstanceRef.current = stochChart;
    stochKSeriesRef.current = kSeries;
    stochDSeriesRef.current = dSeries;
    lastFittedKeyRef.current = "";

    // 🚀 Synchronize horizontal timeScale with main chart and other indicator sub-panes
    syncTimeScales(stochChart, () => [chartInstanceRef.current, macdChartInstanceRef.current, rsiChartInstanceRef.current]);
    try {
      const curRange = chartInstanceRef.current?.timeScale().getVisibleLogicalRange();
      if (curRange) stochChart.timeScale().setVisibleLogicalRange(curRange);
      container.querySelectorAll('a[href*="tradingview"], #tv-attr-logo').forEach(el => el.remove());
    } catch {}

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW } = entry.contentRect;
        if (newW > 50 && stochChartInstanceRef.current) {
          try { stochChartInstanceRef.current.applyOptions({ width: newW }); } catch {}
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      try { resizeObserver.disconnect(); } catch {}
      if (stochChartInstanceRef.current) {
        const c = stochChartInstanceRef.current;
        stochChartInstanceRef.current = null;
        stochKSeriesRef.current = null;
        stochDSeriesRef.current = null;
        try { c.remove(); } catch {}
      }
    };
  }, [showStochPane]);

  // Dynamic Height Resizing Synchronizers for MACD, RSI, and Stochastic
  useEffect(() => {
    if (macdChartInstanceRef.current && macdContainerRef.current) {
      try {
        const w = macdContainerRef.current.clientWidth;
        macdChartInstanceRef.current.applyOptions({ height: macdPaneHeight, width: w > 50 ? w : undefined });
      } catch {}
    }
  }, [macdPaneHeight]);

  useEffect(() => {
    if (rsiChartInstanceRef.current && rsiContainerRef.current) {
      try {
        const w = rsiContainerRef.current.clientWidth;
        rsiChartInstanceRef.current.applyOptions({ height: rsiPaneHeight, width: w > 50 ? w : undefined });
      } catch {}
    }
  }, [rsiPaneHeight]);

  useEffect(() => {
    if (stochChartInstanceRef.current && stochContainerRef.current) {
      try {
        const w = stochContainerRef.current.clientWidth;
        stochChartInstanceRef.current.applyOptions({ height: stochPaneHeight, width: w > 50 ? w : undefined });
      } catch {}
    }
  }, [stochPaneHeight]);

  // Dynamic Width Synchronizer when AI Analyst panel width or collapsed state changes
  useEffect(() => {
    if (chartInstanceRef.current && chartContainerRef.current) {
      const w = chartContainerRef.current.clientWidth;
      const h = chartContainerRef.current.clientHeight;
      if (w > 50 && h > 50) {
        try {
          chartInstanceRef.current.applyOptions({ width: w, height: h });
        } catch {}
      }
    }
    if (macdChartInstanceRef.current && macdContainerRef.current) {
      try {
        const w = macdContainerRef.current.clientWidth;
        if (w > 50) macdChartInstanceRef.current.applyOptions({ width: w });
      } catch {}
    }
    if (rsiChartInstanceRef.current && rsiContainerRef.current) {
      try {
        const w = rsiContainerRef.current.clientWidth;
        if (w > 50) rsiChartInstanceRef.current.applyOptions({ width: w });
      } catch {}
    }
    if (stochChartInstanceRef.current && stochContainerRef.current) {
      try {
        const w = stochContainerRef.current.clientWidth;
        if (w > 50) stochChartInstanceRef.current.applyOptions({ width: w });
      } catch {}
    }
  }, [aiPanelWidth, isAiPanelCollapsed]);

  // Real-time Theme Colors Synchronizer across all Chart instances
  useEffect(() => {
    const meta = THEME_PALETTES[stationTheme] || THEME_PALETTES.cyber_dark;
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.applyOptions({
          layout: { background: { type: ColorType.Solid, color: meta.chartBg } },
          grid: { vertLines: { color: meta.chartGrid }, horzLines: { color: meta.chartGrid } }
        });
      } catch {}
    }
    if (macdChartInstanceRef.current) {
      try {
        macdChartInstanceRef.current.applyOptions({
          layout: { background: { type: ColorType.Solid, color: meta.chartBg } },
          grid: { vertLines: { color: meta.chartGrid }, horzLines: { color: meta.chartGrid } }
        });
      } catch {}
    }
    if (rsiChartInstanceRef.current) {
      try {
        rsiChartInstanceRef.current.applyOptions({
          layout: { background: { type: ColorType.Solid, color: meta.chartBg } },
          grid: { vertLines: { color: meta.chartGrid }, horzLines: { color: meta.chartGrid } }
        });
      } catch {}
    }
    if (stochChartInstanceRef.current) {
      try {
        stochChartInstanceRef.current.applyOptions({
          layout: { background: { type: ColorType.Solid, color: meta.chartBg } },
          grid: { vertLines: { color: meta.chartGrid }, horzLines: { color: meta.chartGrid } }
        });
      } catch {}
    }
  }, [stationTheme]);

  // Dynamic EMA Series Visibility Toggle
  useEffect(() => {
    try {
      ema9SeriesRef.current?.applyOptions({ visible: showEma9 });
      ema21SeriesRef.current?.applyOptions({ visible: showEma21 });
      ema50SeriesRef.current?.applyOptions({ visible: showEma50 });
      ema100SeriesRef.current?.applyOptions({ visible: showEma100 });
      ema200SeriesRef.current?.applyOptions({ visible: showEma200 });
    } catch {}
  }, [showEma9, showEma21, showEma50, showEma100, showEma200]);

  // 3. Handle Chart Style change smoothly without destroying main chart on mount
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    if (prevChartStyleRef.current === chartStyle && seriesInstanceRef.current) return;
    prevChartStyleRef.current = chartStyle;

    seriesMarkersRef.current = null;
    if (seriesInstanceRef.current) {
      if (zonesPrimitiveRef.current) {
        try {
          seriesInstanceRef.current.detachPrimitive(zonesPrimitiveRef.current);
        } catch {}
        zonesPrimitiveRef.current = null;
      }
      try {
        chart.removeSeries(seriesInstanceRef.current);
      } catch {}
      seriesInstanceRef.current = null;
    }

    let series: any;
    if (chartStyle === "bars") {
      series = chart.addSeries(BarSeries, {
        upColor: "#00c896",
        downColor: "#ff3b5c"
      });
    } else if (chartStyle === "area") {
      series = chart.addSeries(AreaSeries, {
        topColor: "rgba(14, 165, 233, 0.35)",
        bottomColor: "rgba(14, 165, 233, 0.0)",
        lineColor: "#38bdf8",
        lineWidth: 2
      });
    } else if (chartStyle === "line") {
      series = chart.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2
      });
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#00c896",
        downColor: "#ff3b5c",
        borderVisible: false,
        wickVisible: true,
        wickUpColor: "#00e6ac",
        wickDownColor: "#ff526f"
      });
    }
    try {
      const zonesPrimitive = new TradingViewZonesPrimitive();
      series.attachPrimitive(zonesPrimitive);
      zonesPrimitiveRef.current = zonesPrimitive;
    } catch (e) {
      console.warn("Could not re-attach zones primitive:", e);
    }
    seriesInstanceRef.current = series;
    priceLinesRef.current = [];
    lastFittedKeyRef.current = "";
    prevCleanCandlesRef.current = [];
  }, [chartStyle]);

  // 4. Update Market Data, MACD, Trend Lines, GEX Levels, Zones, and Forecast Lines
  useEffect(() => {
    const chart = chartInstanceRef.current;
    const series = seriesInstanceRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !series || !candles || candles.length === 0 || candles[0]?._isFallback) return;

    // Do NOT run until candles match the active asset and timeframe
    if (candlesKey !== `${activeAsset}_${activeTf}`) return;

    const currentKey = `${activeAsset}_${activeTf}_${chartStyle}`;
    const isNewAssetOrTf = lastFittedKeyRef.current !== currentKey;

    // Configure dynamic precision & minMove ONLY when switching asset/timeframe/style (prevents series option churn mid-pan)
    if (isNewAssetOrTf) {
      const assetDec = (activeAsset === "XRPUSDT" || activeAsset === "MOEX_NG") ? 4 : (activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI") ? 0 : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI") ? 1 : 2;
      const assetMinMove = (activeAsset === "XRPUSDT" || activeAsset === "MOEX_NG") ? 0.0001 : (activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI") ? 1 : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI") ? 0.1 : 0.01;
      try {
        series.applyOptions({
          priceFormat: {
            type: "price",
            precision: assetDec,
            minMove: assetMinMove
          }
        });
        chart.priceScale("right").applyOptions({
          autoScale: true
        });
      } catch {}
    }

    const cleanCandles = candles;
    const prevList = prevCleanCandlesRef.current;
    const isMobileW = typeof window !== "undefined" && window.innerWidth < 768;
    const dynamicOffset = Math.max(labelOffset + 4, isMobileW ? 12 : 18);

    const shouldResetViewport =
      isNewAssetOrTf ||
      !prevList ||
      prevList.length === 0 ||
      cleanCandles.length < 5;

    const didOldestBarShift =
      !shouldResetViewport &&
      (cleanCandles[0]?.time !== prevList[0]?.time ||
        Math.abs(cleanCandles.length - prevList.length) > 10);

    const isFullReload = shouldResetViewport || didOldestBarShift;

    // Find index from which to stream incremental updates (covers both forming candle and candle rollover)
    let startUpdIdx = Math.max(0, cleanCandles.length - 1);
    if (!isFullReload && prevList.length > 0) {
      const prevLastTime = prevList[prevList.length - 1].time;
      const foundIdx = cleanCandles.findIndex((c: any) => c.time >= prevLastTime);
      if (foundIdx !== -1) {
        startUpdIdx = foundIdx;
      } else {
        startUpdIdx = Math.max(0, cleanCandles.length - 2);
      }
    }

    try {
      if (isFullReload) {
        const savedLogicalRange = !shouldResetViewport
          ? chart.timeScale().getVisibleLogicalRange()
          : null;

        if (chartStyle === "candles" || chartStyle === "bars") {
          series.setData(
            cleanCandles.map(c => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close
            }))
          );
        } else {
          series.setData(cleanCandles.map(c => ({ time: c.time, value: c.close })));
        }

        if (volumeSeries) {
          volumeSeries.setData(
            cleanCandles.map(c => ({
              time: c.time,
              value: c.volume || 100,
              color: c.close >= c.open ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)"
            }))
          );
        }

        if (shouldResetViewport) {
          try {
            chart.timeScale().applyOptions({ rightOffset: dynamicOffset });
            const visibleCount = isMobileW ? 42 : 65;
            const fromIdx = Math.max(0, cleanCandles.length - visibleCount);
            const toIdx = cleanCandles.length + dynamicOffset;
            chart.priceScale("right").applyOptions({ autoScale: true });
            chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
            try { macdChartInstanceRef.current?.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx }); } catch {}
            try { rsiChartInstanceRef.current?.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx }); } catch {}
            try { stochChartInstanceRef.current?.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx }); } catch {}
          } catch {}
        } else if (savedLogicalRange) {
          try {
            chart.timeScale().setVisibleLogicalRange(savedLogicalRange);
            try { macdChartInstanceRef.current?.timeScale().setVisibleLogicalRange(savedLogicalRange); } catch {}
            try { rsiChartInstanceRef.current?.timeScale().setVisibleLogicalRange(savedLogicalRange); } catch {}
            try { stochChartInstanceRef.current?.timeScale().setVisibleLogicalRange(savedLogicalRange); } catch {}
          } catch {}
        }

        lastFittedKeyRef.current = currentKey;
        prevCleanCandlesRef.current = cleanCandles;
      } else {
        // Live streaming tick OR candle close + rollover on same symbol & timeframe
        // Updates both the just-closed bar and the newly opened bar WITHOUT resetting viewport or zoom!
        for (let idx = startUpdIdx; idx < cleanCandles.length; idx++) {
          const bar = cleanCandles[idx];
          if (chartStyle === "candles" || chartStyle === "bars") {
            series.update({
              time: bar.time,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close
            });
          } else {
            series.update({ time: bar.time, value: bar.close });
          }
          if (volumeSeries) {
            volumeSeries.update({
              time: bar.time,
              value: bar.volume || 100,
              color: bar.close >= bar.open ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)"
            });
          }
        }
        prevCleanCandlesRef.current = cleanCandles;
      }
    } catch (err) {
      console.warn("Notice updating series data:", err);
    }

    // 2. Set MACD data if pane is active (streaming update without timeScale recalculation)
    if (showMacdPane && macdChartInstanceRef.current && macdHistSeriesRef.current && cleanCandles.length >= 26) {
      try {
        const emaFast = calculateEMA(cleanCandles, macdFast);
        const emaSlow = calculateEMA(cleanCandles, macdSlow);
        const difValues = cleanCandles.map((_, i) => emaFast[i] - emaSlow[i]);
        const deaValues = calculateEMA(cleanCandles.map((_, i) => ({ close: difValues[i] })), macdSigLen);

        const formatMacdHollowCandle = (time: number, hist: number, prevHist: number) => {
          const roundedHist = Math.round(hist * 100) / 100;
          let borderColor: string;
          if (roundedHist >= 0) {
            borderColor = roundedHist >= prevHist ? "#0ecb81" : "rgba(14, 203, 129, 0.45)";
          } else {
            borderColor = roundedHist <= prevHist ? "#f6465d" : "rgba(246, 70, 93, 0.45)";
          }
          const openVal = 0;
          const closeVal = roundedHist === 0 ? 0.001 : roundedHist;
          return {
            time,
            open: openVal,
            high: Math.max(openVal, closeVal),
            low: Math.min(openVal, closeVal),
            close: closeVal,
            color: "transparent",
            borderColor,
            wickColor: "transparent"
          };
        };

        if (isFullReload) {
          const hollowBars = cleanCandles.map((c, i) => {
            const hist = difValues[i] - deaValues[i];
            const prevHist = i > 0 ? (difValues[i - 1] - deaValues[i - 1]) : hist;
            return formatMacdHollowCandle(c.time, hist, prevHist);
          });
          macdHistSeriesRef.current.setData(hollowBars);
          macdFastSeriesRef.current?.setData(cleanCandles.map((c, i) => ({ time: c.time, value: Math.round(difValues[i] * 100) / 100 })));
          macdSlowSeriesRef.current?.setData(cleanCandles.map((c, i) => ({ time: c.time, value: Math.round(deaValues[i] * 100) / 100 })));
        } else {
          for (let idx = startUpdIdx; idx < cleanCandles.length; idx++) {
            const hist = difValues[idx] - deaValues[idx];
            const prevHist = idx > 0 ? (difValues[idx - 1] - deaValues[idx - 1]) : hist;
            macdHistSeriesRef.current.update(formatMacdHollowCandle(cleanCandles[idx].time, hist, prevHist));
            macdFastSeriesRef.current?.update({ time: cleanCandles[idx].time, value: Math.round(difValues[idx] * 100) / 100 });
            macdSlowSeriesRef.current?.update({ time: cleanCandles[idx].time, value: Math.round(deaValues[idx] * 100) / 100 });
          }
        }
        const lastI = cleanCandles.length - 1;
        if (lastI >= 0) {
          const dif = difValues[lastI] ?? 0;
          const dea = deaValues[lastI] ?? 0;
          const hist = dif - dea;
          setLiveIndicatorValues(prev => ({
            ...prev,
            macd: { dif: Math.round(dif * 100) / 100, dea: Math.round(dea * 100) / 100, hist: Math.round(hist * 100) / 100 }
          }));
        }
      } catch {}
    }

    // 2b. Set RSI data if pane is active
    if (showRsiPane && rsiChartInstanceRef.current && rsi6SeriesRef.current && rsi14SeriesRef.current && cleanCandles.length >= 15) {
      try {
        const rsi6Data = calculateRSI(cleanCandles, rsi6Len);
        const rsi14Data = calculateRSI(cleanCandles, rsi14Len);
        if (isFullReload) {
          rsi6SeriesRef.current.setData(rsi6Data);
          rsi14SeriesRef.current.setData(rsi14Data);
        } else {
          for (let idx = startUpdIdx; idx < cleanCandles.length; idx++) {
            if (rsi6Data[idx]) rsi6SeriesRef.current.update(rsi6Data[idx]);
            if (rsi14Data[idx]) rsi14SeriesRef.current.update(rsi14Data[idx]);
          }
        }
        if (rsi6Data.length > 0 && rsi14Data.length > 0) {
          const r6 = rsi6Data[rsi6Data.length - 1].value;
          const r14 = rsi14Data[rsi14Data.length - 1].value;
          setLiveIndicatorValues(prev => ({
            ...prev,
            rsi: { rsi6: Math.round(r6 * 100) / 100, rsi14: Math.round(r14 * 100) / 100 }
          }));
        }
      } catch {}
    }

    // 2c. Set Stochastic (STOCHRSI) data if pane is active
    if (showStochPane && stochChartInstanceRef.current && stochKSeriesRef.current && stochDSeriesRef.current && cleanCandles.length >= 14) {
      try {
        const { kData, dData } = calculateStochRsiSeries(cleanCandles, 14, 14, 3, 3);
        if (isFullReload) {
          stochKSeriesRef.current.setData(kData);
          stochDSeriesRef.current.setData(dData);
        } else {
          for (let idx = startUpdIdx; idx < cleanCandles.length; idx++) {
            if (kData[idx]) stochKSeriesRef.current.update(kData[idx]);
            if (dData[idx]) stochDSeriesRef.current.update(dData[idx]);
          }
        }
        if (kData.length > 0 && dData.length > 0) {
          const kVal = kData[kData.length - 1].value;
          const dVal = dData[dData.length - 1].value;
          setLiveIndicatorValues(prev => ({
            ...prev,
            stoch: { k: Math.round(kVal * 100) / 100, d: Math.round(dVal * 100) / 100 }
          }));
        }
      } catch {}
    }

    // 2d. Set Binance 5 EMAs (9, 21, 50, 100, 200) data
    if (cleanCandles.length > 0) {
      const minTime = cleanCandles[startUpdIdx]?.time ?? 0;
      if (ema9SeriesRef.current) {
        try {
          const e9 = calculateEmaSeries(cleanCandles, 9);
          if (isFullReload) {
            ema9SeriesRef.current.setData(e9);
          } else {
            for (const pt of e9) {
              if (pt.time >= minTime) ema9SeriesRef.current.update(pt);
            }
          }
        } catch {}
      }
      if (ema21SeriesRef.current) {
        try {
          const e21 = calculateEmaSeries(cleanCandles, 21);
          if (isFullReload) {
            ema21SeriesRef.current.setData(e21);
          } else {
            for (const pt of e21) {
              if (pt.time >= minTime) ema21SeriesRef.current.update(pt);
            }
          }
        } catch {}
      }
      if (ema50SeriesRef.current) {
        try {
          const e50 = calculateEmaSeries(cleanCandles, 50);
          if (isFullReload) {
            ema50SeriesRef.current.setData(e50);
          } else {
            for (const pt of e50) {
              if (pt.time >= minTime) ema50SeriesRef.current.update(pt);
            }
          }
        } catch {}
      }
      if (ema100SeriesRef.current) {
        try {
          const e100 = calculateEmaSeries(cleanCandles, 100);
          if (isFullReload) {
            ema100SeriesRef.current.setData(e100);
          } else {
            for (const pt of e100) {
              if (pt.time >= minTime) ema100SeriesRef.current.update(pt);
            }
          }
        } catch {}
      }
      if (ema200SeriesRef.current) {
        try {
          const e200 = calculateEmaSeries(cleanCandles, 200);
          if (isFullReload) {
            ema200SeriesRef.current.setData(e200);
          } else {
            for (const pt of e200) {
              if (pt.time >= minTime) ema200SeriesRef.current.update(pt);
            }
          }
        } catch {}
      }
    }

    // 3. Clear old price lines
    priceLinesRef.current.forEach((pl) => {
      try {
        series.removePriceLine(pl);
      } catch {}
    });
    priceLinesRef.current = [];

    // 4. Dynamic Trend Line (EMA 200 by default)
    if (showTrendL && cleanCandles.length >= 20) {
      const len = Math.min(trendLen, cleanCandles.length);
      const trendValues = calculateEMA(cleanCandles, len);
      if (!trendLineSeriesRef.current) {
        try {
          trendLineSeriesRef.current = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 1,
            title: `Trend (${trendType} ${trendLen})`,
            priceLineVisible: false,
            lastValueVisible: true
          });
        } catch {}
      }
      if (trendLineSeriesRef.current) {
        try {
          if (isFullReload) {
            trendLineSeriesRef.current.setData(cleanCandles.map((c, idx) => ({ time: c.time, value: trendValues[idx] })));
          } else {
            for (let idx = startUpdIdx; idx < cleanCandles.length; idx++) {
              trendLineSeriesRef.current.update({ time: cleanCandles[idx].time, value: trendValues[idx] });
            }
          }
        } catch {}
      }
    } else if (!showTrendL && trendLineSeriesRef.current) {
      try {
        chart.removeSeries(trendLineSeriesRef.current);
      } catch {}
      trendLineSeriesRef.current = null;
    }

    // 5. Native Canvas Zones (OB, FVG, OTE) and Forecast Arrow bounded to bar indices
    const tfSecondsMap: Record<string, number> = {
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "30m": 1800,
      "1h": 3600,
      "4h": 14400,
      "1d": 86400
    };
    const tfSec = tfSecondsMap[activeTf] || 900;
    const lastIdx = cleanCandles.length - 1;
    const lastCandle = cleanCandles[lastIdx];

    const zoneBoxes: ZoneBox[] = [];

    // Order Blocks (+OB Demand & -OB Supply) - bounded by pivot bar and future offset
    if (showOb && cleanCandles.length >= 20) {
      const scanLen = Math.min(35, cleanCandles.length);
      const recent = cleanCandles.slice(-scanLen);
      let minIdx = lastIdx - scanLen;
      let maxIdx = lastIdx - scanLen;
      let minPrice = Infinity;
      let maxPrice = -Infinity;

      for (let k = 0; k < recent.length; k++) {
        const c = recent[k];
        const globalIdx = lastIdx - scanLen + k;
        if (c.low < minPrice) {
          minPrice = c.low;
          minIdx = globalIdx;
        }
        if (c.high > maxPrice) {
          maxPrice = c.high;
          maxIdx = globalIdx;
        }
      }

      const minCandle = cleanCandles[minIdx] || recent[0];
      const maxCandle = cleanCandles[maxIdx] || recent[0];

      // Bullish OB (+OB Demand) - bounds ending at current bar
      zoneBoxes.push({
        id: `ob_demand_${minCandle.time}`,
        type: "ob_bull",
        startTime: minCandle.time,
        endTime: lastCandle.time,
        startLogical: minIdx,
        endLogical: lastIdx,
        topPrice: minCandle.high,
        bottomPrice: minCandle.low,
        label: "+OB",
        fillColor: "rgba(8, 153, 129, 0.12)",
        borderColor: "rgba(8, 153, 129, 0.45)",
        borderStyle: "dashed"
      });

      // Bearish OB (-OB Supply) - bounds ending at current bar
      zoneBoxes.push({
        id: `ob_supply_${maxCandle.time}`,
        type: "ob_bear",
        startTime: maxCandle.time,
        endTime: lastCandle.time,
        startLogical: maxIdx,
        endLogical: lastIdx,
        topPrice: maxCandle.high,
        bottomPrice: maxCandle.low,
        label: "-OB",
        fillColor: "rgba(242, 54, 69, 0.12)",
        borderColor: "rgba(242, 54, 69, 0.45)",
        borderStyle: "dashed"
      });
    }

    // Fair Value Gaps (FVG) - 3-candle imbalance (ends at current bar)
    if (showFvg && cleanCandles.length >= 15) {
      for (let i = cleanCandles.length - 2; i >= Math.max(5, cleanCandles.length - 30); i--) {
        const c1 = cleanCandles[i - 2];
        const c3 = cleanCandles[i];
        if (c3.low > c1.high) {
          zoneBoxes.push({
            id: `fvg_bull_${c3.time}`,
            type: "fvg_bull",
            startTime: cleanCandles[i - 1].time,
            endTime: lastCandle.time,
            startLogical: i - 1,
            endLogical: lastIdx,
            topPrice: c3.low,
            bottomPrice: c1.high,
            label: "+FVG",
            fillColor: "rgba(14, 165, 233, 0.10)",
            borderColor: "rgba(14, 165, 233, 0.35)",
            borderStyle: "dotted"
          });
          break;
        } else if (c3.high < c1.low) {
          zoneBoxes.push({
            id: `fvg_bear_${c3.time}`,
            type: "fvg_bear",
            startTime: cleanCandles[i - 1].time,
            endTime: lastCandle.time,
            startLogical: i - 1,
            endLogical: lastIdx,
            topPrice: c1.low,
            bottomPrice: c3.high,
            label: "-FVG",
            fillColor: "rgba(242, 54, 69, 0.10)",
            borderColor: "rgba(242, 54, 69, 0.35)",
            borderStyle: "dotted"
          });
          break;
        }
      }
    }

    // OTE Reversal Zone (0.618 - 0.786 Fibonacci) & 0.50 EQ
    let eqData: { startTime: number; endTime: number; startLogical?: number; endLogical?: number; price: number; label: string } | null = null;
    if (showReversal && cleanCandles.length > 20) {
      const fibLen = Math.min(fibPeriod, 30);
      const recent = cleanCandles.slice(-fibLen);
      const highSw = Math.max(...recent.map(c => c.high));
      const lowSw = Math.min(...recent.map(c => c.low));
      const range = highSw - lowSw;
      const eq500 = lowSw + range * 0.5;
      const isBull = lastCandle.close >= eq500;

      const oteTop = isBull ? highSw - range * 0.618 : lowSw + range * 0.786;
      const oteBot = isBull ? highSw - range * 0.786 : lowSw + range * 0.618;

      const oteStartIdx = Math.max(0, lastIdx - lineLen);
      const oteEndIdx = lastIdx + labelOffset;
      const oteStartTime = cleanCandles[oteStartIdx]?.time ?? recent[0].time;
      const oteEndTime = lastCandle.time + tfSec * labelOffset;

      zoneBoxes.push({
        id: "ote_zone",
        type: "ote",
        startTime: oteStartTime,
        endTime: oteEndTime,
        startLogical: oteStartIdx,
        endLogical: oteEndIdx,
        topPrice: Math.max(oteTop, oteBot),
        bottomPrice: Math.min(oteTop, oteBot),
        label: `OTE (${Math.min(oteTop, oteBot).toFixed(1)}–${Math.max(oteTop, oteBot).toFixed(1)})`,
        fillColor: "rgba(234, 179, 8, 0.08)",
        borderColor: "rgba(234, 179, 8, 0.30)",
        borderStyle: "dashed"
      });

      eqData = {
        startTime: oteStartTime,
        endTime: oteEndTime,
        startLogical: oteStartIdx,
        endLogical: oteEndIdx,
        price: Math.round(eq500 * 100) / 100,
        label: `0.50 EQ (${(Math.round(eq500 * 10) / 10).toFixed(1)})`
      };
    }

    // S&R Liquidity Zones (Liq LT & Liq IT)
    if (showSrZones && cleanCandles.length >= 30) {
      const atrArr = calculateATR(cleanCandles, 14);
      const atrVal = atrArr.length > 0 ? atrArr[atrArr.length - 1] : ((lastCandle.high - lastCandle.low) || 10);
      const srHalfH = Math.max(atrVal * 0.08, 0.4);

      const ltRecent = cleanCandles.slice(-40);
      const phLt = Math.max(...ltRecent.map(c => c.high));
      const plLt = Math.min(...ltRecent.map(c => c.low));
      const ltOffset = 35;
      const srEndLogical = lastIdx + labelOffset;
      const srEndTime = lastCandle.time + tfSec * labelOffset;

      const ltStartLogical = Math.max(0, lastIdx - ltOffset);
      const ltStartTime = cleanCandles[ltStartLogical]?.time ?? cleanCandles[0].time;

      // Resistance (Liq LT Сопр.)
      zoneBoxes.push({
        id: "sr_res_lt",
        type: "sr",
        startTime: ltStartTime,
        endTime: srEndTime,
        startLogical: ltStartLogical,
        endLogical: srEndLogical,
        topPrice: phLt + srHalfH,
        bottomPrice: phLt - srHalfH,
        label: `Liq LT [${phLt > 1000 ? (phLt / 1000).toFixed(1) + "K" : phLt.toFixed(0)}] Сопр.`,
        fillColor: "rgba(242, 54, 69, 0.10)",
        borderColor: "rgba(242, 54, 69, 0.45)",
        borderStyle: "solid"
      });

      // Support (Liq LT Подд.)
      zoneBoxes.push({
        id: "sr_sup_lt",
        type: "sr",
        startTime: ltStartTime,
        endTime: srEndTime,
        startLogical: ltStartLogical,
        endLogical: srEndLogical,
        topPrice: plLt + srHalfH,
        bottomPrice: plLt - srHalfH,
        label: `Liq LT [${plLt > 1000 ? (plLt / 1000).toFixed(1) + "K" : plLt.toFixed(0)}] Подд.`,
        fillColor: "rgba(8, 153, 129, 0.10)",
        borderColor: "rgba(8, 153, 129, 0.45)",
        borderStyle: "solid"
      });

      // Intermediate Pivots (IT - offset 15)
      const itRecent = cleanCandles.slice(-18);
      const phIt = Math.max(...itRecent.map(c => c.high));
      const plIt = Math.min(...itRecent.map(c => c.low));
      if (Math.abs(phIt - phLt) / phLt > 0.003) {
        const itStartLogical = Math.max(0, lastIdx - 15);
        zoneBoxes.push({
          id: "sr_res_it",
          type: "sr",
          startTime: cleanCandles[itStartLogical]?.time ?? lastCandle.time,
          endTime: srEndTime,
          startLogical: itStartLogical,
          endLogical: srEndLogical,
          topPrice: phIt + srHalfH,
          bottomPrice: phIt - srHalfH,
          label: `Liq IT [${phIt > 1000 ? (phIt / 1000).toFixed(1) + "K" : phIt.toFixed(0)}]`,
          fillColor: "rgba(242, 54, 69, 0.08)",
          borderColor: "rgba(242, 54, 69, 0.35)",
          borderStyle: "dashed"
        });
      }
      if (Math.abs(plIt - plLt) / plLt > 0.003) {
        const itStartLogical = Math.max(0, lastIdx - 15);
        zoneBoxes.push({
          id: "sr_sup_it",
          type: "sr",
          startTime: cleanCandles[itStartLogical]?.time ?? lastCandle.time,
          endTime: srEndTime,
          startLogical: itStartLogical,
          endLogical: srEndLogical,
          topPrice: plIt + srHalfH,
          bottomPrice: plIt - srHalfH,
          label: `Liq IT [${plIt > 1000 ? (plIt / 1000).toFixed(1) + "K" : plIt.toFixed(0)}]`,
          fillColor: "rgba(8, 153, 129, 0.08)",
          borderColor: "rgba(8, 153, 129, 0.35)",
          borderStyle: "dashed"
        });
      }
    }

    // Wave Forecast Arrow on Canvas: Anchored to setup bar where signal was formed (Pine Script v8)
    let forecastData: ForecastArrow | null = null;
    let altForecastData: ForecastArrow | null = null;
    let computedTp1 = 0;
    let computedTp2 = 0;
    let computedSl = 0;
    let computedEntry = 0;

    let setupAnchorLog = lastIdx;
    let setupAnchorTime = lastCandle.time;
    let setupAnchorPrice = lastCandle.close;

    if (indicatorOutput) {
      const fc = indicatorOutput.forecast;
      computedEntry = fc.p1Entry;
      computedTp1 = fc.p2Tp1;
      computedTp2 = fc.p3Tp2;
      computedSl = fc.activeTrailingSl;

      const dec = (activeAsset === "XRPUSDT" || activeAsset === "MOEX_NG") ? 4 : (activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI") ? 0 : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI") ? 1 : 2;

      // Setup Anchor: start from the bar where signal originated (fc.startLogical or fc.startBar)
      // In the original Pine Script: x0 = fc_start_bar, y0 = fc_start_price
      // Lines remain anchored at this bar and only change when a target is reached, trailing SL hit, or invalidation occurs.
      setupAnchorLog = Math.max(0, Math.min(lastIdx, fc.startLogical ?? fc.startBar ?? lastIdx));
      setupAnchorTime = fc.startTime ?? cleanCandles[setupAnchorLog]?.time ?? lastCandle.time;
      setupAnchorPrice = (fc.startPrice && fc.startPrice > 0) ? fc.startPrice : (cleanCandles[setupAnchorLog]?.close ?? lastCandle.close);

      // Node coordinates following exact Pine Script vector projection:
      // x1 (Entry/Pullback): if leg1Hit, anchored at leg1Idx; if pending, projects into future whitespace
      let x1Log: number;
      let x1Time: number;
      if (fc.leg1Hit && fc.leg1Idx !== undefined && fc.leg1Idx <= lastIdx) {
        x1Log = fc.leg1Idx;
        x1Time = fc.leg1Time ?? (cleanCandles[x1Log]?.time ?? (setupAnchorTime + tfSec * Math.max(1, x1Log - setupAnchorLog)));
      } else {
        x1Log = Math.max(lastIdx + 3, setupAnchorLog + 3);
        x1Time = lastCandle.time + tfSec * 3;
      }

      // x2 (TP1): if leg2Hit, anchored at leg2Idx; if pending, projects forward beyond x1
      let x2Log: number;
      let x2Time: number;
      if (fc.leg2Hit && fc.leg2Idx !== undefined && fc.leg2Idx <= lastIdx) {
        x2Log = fc.leg2Idx;
        x2Time = fc.leg2Time ?? (cleanCandles[x2Log]?.time ?? (lastCandle.time + tfSec * 4));
      } else {
        x2Log = fc.leg1Hit ? Math.max(lastIdx + 7, (fc.leg1Idx ?? lastIdx) + 4) : x1Log + 7;
        x2Time = lastCandle.time + tfSec * Math.max(7, x2Log - lastIdx);
      }

      // x3 (TP2): if leg3Hit, anchored at leg3Idx; if pending, projects into future whitespace
      let x3Log: number;
      let x3Time: number;
      if (fc.leg3Hit && fc.leg3Idx !== undefined && fc.leg3Idx <= lastIdx) {
        x3Log = fc.leg3Idx;
        x3Time = fc.leg3Time ?? (cleanCandles[x3Log]?.time ?? (lastCandle.time + tfSec * 8));
      } else {
        x3Log = fc.leg2Hit ? Math.max(lastIdx + 12, (fc.leg2Idx ?? lastIdx) + 4) : x2Log + 7;
        x3Time = lastCandle.time + tfSec * Math.max(12, x3Log - lastIdx);
      }

      if (showForecast) {
        forecastData = {
          startTime: setupAnchorTime,
          startPrice: setupAnchorPrice,
          startLogical: setupAnchorLog,
          pullbackTime: x1Time,
          pullbackPrice: fc.p1Entry,
          pullbackLogical: x1Log,
          tp1Time: x2Time,
          tp1Price: fc.p2Tp1,
          tp1Logical: x2Log,
          tp2Time: x3Time,
          tp2Price: fc.p3Tp2,
          tp2Logical: x3Log,
          isBull: fc.isBull,
          labelStart: fc.isBull ? "🟢 Long" : "🔴 Short",
          leg1Hit: fc.leg1Hit,
          leg2Hit: fc.leg2Hit,
          leg3Hit: fc.leg3Hit
        };

        if (showAltWave) {
          const altStartLog = fc.isPlanBActive ? Math.min(lastIdx, setupAnchorLog + 2) : lastIdx;
          const altStartTime = cleanCandles[altStartLog]?.time ?? lastCandle.time;
          altForecastData = {
            startTime: altStartTime,
            startPrice: fc.activeTrailingSl,
            startLogical: altStartLog,
            tp1Time: lastCandle.time + tfSec * 6,
            tp1Price: fc.altTp1,
            tp1Logical: lastIdx + 6,
            tp2Time: lastCandle.time + tfSec * 11,
            tp2Price: fc.altTp2,
            tp2Logical: lastIdx + 11,
            isBull: !fc.isBull,
            labelTp1: `План Б: ${fc.altTp1.toFixed(dec)}`,
            labelTp2: `Цель 2: ${fc.altTp2.toFixed(dec)}`
          };
        }
      }
    }

    // BOS Marker
    let bosData: BosMarker | null = null;
    if (showBos && cleanCandles.length >= 16) {
      const bosIdx = cleanCandles.length - 12;
      const bosCandle = cleanCandles[bosIdx];
      bosData = {
        time: bosCandle.time,
        price: bosCandle.high,
        logical: bosIdx,
        isBull: true,
        label: "— BOS —"
      };
    }

    // 6. Bounded Price Lines (Entry, TP1, TP2, SL, CW, PW, Flip, Pain, Magnet, EM)
    // Anchored at setup start bar (fc_start_bar) and extending past current bar into right chart margin
    const boundedLines: BoundedPriceLine[] = [];
    const gx1 = Math.max(0, lastIdx - lineLen);
    const gx1Time = cleanCandles[gx1]?.time ?? lastCandle.time;
    const gx2Base = lastIdx + labelOffset + 8;
    const gx2BaseTime = lastCandle.time + tfSec * (labelOffset + 8);

    const dec = (activeAsset === "XRPUSDT" || activeAsset === "MOEX_NG") ? 4 : (activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI") ? 0 : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI") ? 1 : 2;

    if (showForecast && computedTp1 > 0) {
      // In original Pine Script: line_sl := line.new(x0, disp_active_sl, sl_end_x, disp_active_sl, ...)
      // where x0 = setupAnchorLog (bar where signal originated), and lineEnd extends forward into right margin
      const lineStartLog = setupAnchorLog;
      const lineEndLog = lastIdx + Math.max(labelOffset, 16);
      const lineStartTime = cleanCandles[lineStartLog]?.time ?? gx1Time;
      const lineEndTime = lastCandle.time + tfSec * Math.max(labelOffset, 16);

      const fc = indicatorOutput?.forecast;
      const isInitialSl = !fc?.trailingStageStr || fc.trailingStageStr.toLowerCase().includes("начальный");
      const trailingNote = (!isInitialSl && fc?.trailingStageStr) ? ` (${fc.trailingStageStr})` : "";

      // SL (Red dashed line)
      boundedLines.push({
        id: "sl_line",
        price: Number(computedSl.toFixed(dec)),
        startTime: lineStartTime,
        endTime: lineEndTime,
        startLogical: lineStartLog,
        endLogical: lineEndLog,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: "dashed",
        label: fc?.isPlanBActive ? `SL ВЫБИТ: ${computedSl.toFixed(dec)} [❌ СЛОМ]` : `SL: ${computedSl.toFixed(dec)}${trailingNote}`,
        labelBg: "rgba(30, 9, 13, 0.98)",
        labelBorderColor: "#f87171",
        labelTextColor: "#fecdd3"
      });

      // Вход (Amber dotted or solid green if hit)
      boundedLines.push({
        id: "entry_line",
        price: Number(computedEntry.toFixed(dec)),
        startTime: lineStartTime,
        endTime: lineEndTime,
        startLogical: lineStartLog,
        endLogical: lineEndLog,
        color: fc?.leg1Hit ? "#10b981" : "#f59e0b",
        lineWidth: 1,
        lineStyle: fc?.leg1Hit ? "solid" : "dotted",
        label: fc?.leg1Hit ? `ВХОД ВЗЯТ: ${computedEntry.toFixed(dec)} ✓` : `ВХОД: ${computedEntry.toFixed(dec)}`,
        labelBg: "rgba(24, 18, 6, 0.98)",
        labelBorderColor: fc?.leg1Hit ? "#34d399" : "#fbbf24",
        labelTextColor: "#fef3c7"
      });

      // TP1 (Green line)
      boundedLines.push({
        id: "tp1_line",
        price: Number(computedTp1.toFixed(dec)),
        startTime: lineStartTime,
        endTime: lineEndTime,
        startLogical: lineStartLog,
        endLogical: lineEndLog,
        color: fc?.leg2Hit ? "#059669" : "#10b981",
        lineWidth: 1,
        lineStyle: fc?.leg2Hit ? "solid" : "dotted",
        label: fc?.leg2Hit ? `TP1 ДОСТИГНУТ: ${computedTp1.toFixed(dec)} ✓` : `TP1: ${computedTp1.toFixed(dec)}`,
        labelBg: "rgba(6, 24, 16, 0.98)",
        labelBorderColor: "#34d399",
        labelTextColor: "#d1fae5"
      });

      // TP2 (Blue line)
      if (computedTp2 > 0) {
        boundedLines.push({
          id: "tp2_line",
          price: Number(computedTp2.toFixed(dec)),
          startTime: lineStartTime,
          endTime: lineEndTime,
          startLogical: lineStartLog,
          endLogical: lineEndLog,
          color: fc?.leg3Hit ? "#0284c7" : "#38bdf8",
          lineWidth: 1,
          lineStyle: fc?.leg3Hit ? "solid" : "dotted",
          label: fc?.leg3Hit ? `TP2 ДОСТИГНУТ: ${computedTp2.toFixed(dec)} ✓` : `TP2: ${computedTp2.toFixed(dec)}`,
          labelBg: "rgba(6, 18, 28, 0.98)",
          labelBorderColor: "#38bdf8",
          labelTextColor: "#e0f2fe"
        });
      }
    }

    // 8. Institutional GEX Levels (Synchronized with active GEX Analytics report)
    const isGexValidForAsset = (rep: any) => {
      if (!rep || !rep.callWall || !lastCandle || !lastCandle.close) return false;
      const ratio = rep.callWall / lastCandle.close;
      return ratio > 0.75 && ratio < 1.30;
    };
    const effectiveGex = isGexValidForAsset(gexReport)
      ? gexReport
      : isGexValidForAsset(dayGexReport)
      ? dayGexReport
      : isGexValidForAsset(indicatorOutput?.gex)
      ? indicatorOutput?.gex
      : null;

    if (useGex && effectiveGex) {
      if (showGexWalls) {
        boundedLines.push({
          id: "cw_line",
          price: effectiveGex.callWall,
          startTime: gx1Time,
          endTime: gx2BaseTime,
          startLogical: gx1,
          endLogical: gx2Base,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: "solid",
          label: `🏰 Потолок CW: ${effectiveGex.callWall}`,
          labelBg: "rgba(6, 24, 16, 0.98)",
          labelBorderColor: "#34d399",
          labelTextColor: "#d1fae5"
        });

        boundedLines.push({
          id: "pw_line",
          price: effectiveGex.putWall,
          startTime: gx1Time,
          endTime: gx2BaseTime,
          startLogical: gx1,
          endLogical: gx2Base,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: "solid",
          label: `🛡️ Поддержка PW: ${effectiveGex.putWall}`,
          labelBg: "rgba(30, 9, 13, 0.98)",
          labelBorderColor: "#f87171",
          labelTextColor: "#fecdd3"
        });
      }

      if (showGexFlip) {
        boundedLines.push({
          id: "flip_line",
          price: effectiveGex.gammaFlip,
          startTime: gx1Time,
          endTime: gx2BaseTime,
          startLogical: gx1,
          endLogical: gx2Base,
          color: "#a855f7",
          lineWidth: 1,
          lineStyle: "dashed",
          label: `⚡ Граница Гаммы: ${effectiveGex.gammaFlip}`,
          labelBg: "rgba(22, 10, 36, 0.98)",
          labelBorderColor: "#c084fc",
          labelTextColor: "#f3e8ff"
        });
      }

      if (showGexPain) {
        boundedLines.push({
          id: "pain_line",
          price: effectiveGex.maxPain,
          startTime: gx1Time,
          endTime: gx2BaseTime,
          startLogical: gx1,
          endLogical: gx2Base,
          color: "#06b6d4",
          lineWidth: 1,
          lineStyle: "dotted",
          label: `🎯 Магнит дня: ${effectiveGex.maxPain}`,
          labelBg: "rgba(8, 22, 28, 0.98)",
          labelBorderColor: "#22d3ee",
          labelTextColor: "#cffafe"
        });
      }

      if (showGexSleepers) {
        const sleeperPrice = effectiveGex.sleeperMagnet || Math.round(effectiveGex.spotPrice * 1.035 * 10) / 10;
        boundedLines.push({
          id: "sleeper_line",
          price: sleeperPrice,
          startTime: gx1Time,
          endTime: gx2BaseTime,
          startLogical: gx1,
          endLogical: gx2Base,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: "dashed",
          label: `🧲 Спящий магнит: ${sleeperPrice}`
        });
      }

      if (showGexEm) {
        const gx1Em = Math.max(0, lastIdx - Math.min(18, lineLen));
        const gx1EmTime = cleanCandles[gx1Em]?.time ?? lastCandle.time;
        const gx2Em = gx2Base + 38;
        const gx2EmTime = lastCandle.time + tfSec * (labelOffset + 46);

        boundedLines.push({
          id: "em_h68",
          price: effectiveGex.expectedMove68.high,
          startTime: gx1EmTime,
          endTime: gx2EmTime,
          startLogical: gx1Em,
          endLogical: gx2Em,
          color: "#38bdf8",
          lineWidth: 1,
          lineStyle: "dashed",
          label: `📐 Диапазон ММ 68% (Вверх): ${effectiveGex.expectedMove68.high}`
        });
        boundedLines.push({
          id: "em_l68",
          price: effectiveGex.expectedMove68.low,
          startTime: gx1EmTime,
          endTime: gx2EmTime,
          startLogical: gx1Em,
          endLogical: gx2Em,
          color: "#38bdf8",
          lineWidth: 1,
          lineStyle: "dashed",
          label: `📐 Диапазон ММ 68% (Низ): ${effectiveGex.expectedMove68.low}`
        });
        boundedLines.push({
          id: "em_h95",
          price: effectiveGex.expectedMove95.high,
          startTime: gx1EmTime,
          endTime: gx2EmTime,
          startLogical: gx1Em,
          endLogical: gx2Em,
          color: "#fbbf24",
          lineWidth: 1,
          lineStyle: "dotted",
          label: `🚨 Диапазон ММ 95% (Макс): ${effectiveGex.expectedMove95.high}`
        });
        boundedLines.push({
          id: "em_l95",
          price: effectiveGex.expectedMove95.low,
          startTime: gx1EmTime,
          endTime: gx2EmTime,
          startLogical: gx1Em,
          endLogical: gx2Em,
          color: "#fbbf24",
          lineWidth: 1,
          lineStyle: "dotted",
          label: `🚨 Диапазон ММ 95% (Мин): ${effectiveGex.expectedMove95.low}`
        });
      }
    }

    // Update native canvas primitive with zones, forecast, bounded lines, and bar countdown
    zonesPrimitiveRef.current?.setData({
      zones: zoneBoxes,
      forecast: forecastData,
      altForecast: altForecastData,
      bos: bosData,
      eqLine: eqData,
      lines: boundedLines,
      gexProfile: null,
      chartFontSize: chartLabelFontSize,
      showBadgeBorders: showChartBadgeBorders,
      currentPriceCountdown: lastCandle ? {
        price: lastCandle.close,
        text: barCountdown.formatted,
        isBull: (lastCandle.close >= (cleanCandles[cleanCandles.length - 2]?.close ?? lastCandle.close))
      } : null
    });

    // 9. Signals & ML Markers (reuse single plugin instance instead of leaking primitives on every tick)
    if (showSignals && cleanCandles.length > 20) {
      const markers: any[] = [];
      const emaShort = calculateEMA(cleanCandles, 9);
      const emaMed = calculateEMA(cleanCandles, 21);
      for (let i = 12; i < cleanCandles.length; i++) {
        const prevBull = emaShort[i - 1] <= emaMed[i - 1];
        const currBull = emaShort[i] > emaMed[i];
        const prevBear = emaShort[i - 1] >= emaMed[i - 1];
        const currBear = emaShort[i] < emaMed[i];

        if (prevBull && currBull && cleanCandles[i].close > cleanCandles[i].open) {
          markers.push({
            time: cleanCandles[i].time,
            position: "belowBar",
            color: "#fbbf24",
            shape: "triangleUp",
            text: "LONG"
          });
        } else if (prevBear && currBear && cleanCandles[i].close < cleanCandles[i].open) {
          markers.push({
            time: cleanCandles[i].time,
            position: "aboveBar",
            color: "#ef4444",
            shape: "triangleDown",
            text: "SHORT"
          });
        }
      }
      try {
        if (!seriesMarkersRef.current) {
          seriesMarkersRef.current = createSeriesMarkers(series, markers);
        } else {
          seriesMarkersRef.current.setMarkers(markers);
        }
      } catch {}
    } else if (seriesMarkersRef.current) {
      try {
        seriesMarkersRef.current.setMarkers([]);
      } catch {}
    }

    // 10. Ensure fitted key reference is in sync
    lastFittedKeyRef.current = currentKey;
  }, [
    activeTab,
    candles,
    candlesKey,
    activeAsset,
    activeTf,
    chartStyle,
    useGex,
    showGexWalls,
    showGexFlip,
    showGexPain,
    showGexSleepers,
    showGexEm,
    showGexBars,
    showReversal,
    showForecast,
    showAltWave,
    fcTargetMult,
    showOb,
    showFvg,
    showSrZones,
    showTrendL,
    trendType,
    trendLen,
    showSignals,
    gexReport,
    dayGexReport,
    gexHorizon,
    showMacdPane,
    macdFast,
    macdSlow,
    macdSigLen,
    showRsiPane,
    rsi6Len,
    rsi14Len,
    showStochPane,
    showEma50,
    showEma100,
    showEma200,
    labelOffset,
    lineLen,
    indicatorOutput,
    chartLabelFontSize,
    showChartBadgeBorders
  ]);

  // AI Assistant Analysis Dispatcher
  const handleSendAiMessage = async (customText?: string) => {
    const textToSend = customText || aiPromptInput;
    if (!textToSend.trim()) return;

    const userMsg = {
      role: "user" as const,
      text: textToSend,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    };
    setAiChatMessages(prev => [...prev, userMsg]);
    if (!customText) setAiPromptInput("");
    setIsAiThinking(true);

    try {
      const res = await fetch("/api/gold/run-dual-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      const answer = data.report?.planMarkdown || 
        `📊 **Анализ по сетапу QUANTEX Premium v8 (${activeAsset})**:\n` +
        `• Спот: ${candles[candles.length - 1]?.close || 3995.8}\n` +
        `• Режим Гаммы: ${gexReport?.netGexRegime || "POSITIVE_GAMMA"}\n` +
        `• Call Wall (Потолок): ${gexReport?.callWall || 4028} | Put Wall (Поддержка): ${gexReport?.putWall || 3979}\n` +
        `• Рекомендация: Поиск лонг-реакции в зоне OTE с первичной целью на 0.50 EQ и расширением к Call Wall.`;

      setAiChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          text: answer,
          time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } catch (e: any) {
      setAiChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          text: `⚠️ Ошибка ИИ-ассистента: ${e.message}`,
          time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Add Trade to Journal
  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTradeEntry || !newTradePnl) return;
    try {
      const res = await fetch("/api/journal/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: newTradeAsset,
          type: newTradeType,
          entryPrice: newTradeEntry,
          exitPrice: newTradeExit,
          size: newTradeSize,
          pnl: newTradePnl,
          notes: newTradeNotes
        })
      });
      if (res.ok) {
        fetchJournal();
        setNewTradeEntry("");
        setNewTradeExit("");
        setNewTradePnl("");
        setNewTradeNotes("");
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const latestCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const priceChange = latestCandle && prevCandle ? latestCandle.close - prevCandle.close : 0;
  const priceChangePct = prevCandle ? (priceChange / prevCandle.close) * 100 : 0;

  // Closest single strike to real-time spot price (ATM)
  const closestStrikeToSpot = useMemo(() => {
    if (!gexReport?.strikes?.length || !gexReport.spotPrice) return null;
    let closest = gexReport.strikes[0].strike;
    let minDiff = Math.abs(closest - gexReport.spotPrice);
    for (const s of gexReport.strikes) {
      const diff = Math.abs(s.strike - gexReport.spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s.strike;
      }
    }
    return closest;
  }, [gexReport]);

  // Symmetrically sorted strikes for GEX display: strictly descending
  // Highest strike at top, Lowest strike at bottom (цена меньшая снизу, к верху выше)
  const gexStrikesDescending = useMemo(() => {
    if (!gexReport?.strikes) return [];
    const list = [...gexReport.strikes].sort((a, b) => b.strike - a.strike);
    if (!gexReport.spotPrice) return list;

    if (gexFilterMode === "atm") {
      const spot = gexReport.spotPrice;
      // ATM range: within ±3.5% of spotPrice, or at least 14 strikes around spot
      const filtered = list.filter(s => Math.abs(s.strike - spot) / spot <= 0.038);
      if (filtered.length >= 8) return filtered;
      // Fallback: take 16 strikes centered on spot
      const closestIdx = list.reduce((bestIdx, s, idx) => 
        Math.abs(s.strike - spot) < Math.abs(list[bestIdx].strike - spot) ? idx : bestIdx, 0);
      const start = Math.max(0, closestIdx - 8);
      const end = Math.min(list.length, closestIdx + 9);
      return list.slice(start, end);
    } else if (gexFilterMode === "walls") {
      // Key Walls mode: show exact key levels (Call Wall, Put Wall, Gamma Flip, Max Pain, and Spot strike)
      const keySet = new Set([
        gexReport.callWall,
        gexReport.putWall,
        gexReport.gammaFlip,
        gexReport.maxPain,
        closestStrikeToSpot
      ].filter(Boolean) as number[]);

      const filtered = list.filter(s => {
        return Array.from(keySet).some(lvl => Math.abs(s.strike - lvl) <= 10);
      });
      return filtered.length >= 3 ? filtered : list.slice(0, 8);
    }
    return list;
  }, [gexReport, gexFilterMode, closestStrikeToSpot]);

  const maxAbsGex = useMemo(() => {
    if (!gexStrikesDescending.length) return 1;
    let max = 0.1;
    for (const s of gexStrikesDescending) {
      if (gexMetricMode === "volume") {
        if ((s.callVolume || 0) > max) max = s.callVolume || 0;
        if ((s.putVolume || 0) > max) max = s.putVolume || 0;
      } else if (gexMetricMode === "oi") {
        if (s.callOi > max) max = s.callOi;
        if (s.putOi > max) max = s.putOi;
      } else {
        if (Math.abs(s.callGex) > max) max = Math.abs(s.callGex);
        if (Math.abs(s.putGex) > max) max = Math.abs(s.putGex);
      }
    }
    return max;
  }, [gexStrikesDescending, gexMetricMode]);

  // SMC & Market Structure state calculation for TradingView HUD table
  const smcStructure = useMemo(() => {
    if (candles.length < 15) return { trend: "BULLISH", text: "BOS Bullish ↑", color: "text-emerald-400" };
    const last10 = candles.slice(-10);
    const upCloses = last10.filter(c => c.close >= c.open).length;
    if (upCloses >= 7) return { trend: "BULLISH", text: "BOS Bullish ↑ (Импульс)", color: "text-emerald-400" };
    if (upCloses <= 3) return { trend: "BEARISH", text: "BOS Bearish ↓ (Снижение)", color: "text-rose-400" };
    return { trend: "CHOPPY", text: "CHoCH / Консолидация", color: "text-amber-400" };
  }, [candles]);

  const volumeDeltaState = useMemo(() => {
    if (!candles.length) return { delta: "+1,420", buyersPct: 58, sellersPct: 42, isPositive: true };
    const recent = candles.slice(-14);
    const buyVol = recent.reduce((sum, c) => sum + (c.close >= c.open ? c.volume || 60 : (c.volume || 60) * 0.4), 0);
    const sellVol = recent.reduce((sum, c) => sum + (c.close < c.open ? c.volume || 60 : (c.volume || 60) * 0.4), 0);
    const total = buyVol + sellVol || 1;
    const buyersPct = Math.round((buyVol / total) * 100);
    const sellersPct = 100 - buyersPct;
    const diff = Math.round(buyVol - sellVol);
    return {
      delta: diff >= 0 ? `+${diff}` : `${diff}`,
      buyersPct,
      sellersPct,
      isPositive: diff >= 0
    };
  }, [candles]);

  // Day of week verdict exactly from Pine Script `f_dow_verdict()`
  const dayOfWeekInfo = useMemo(() => {
    const d = new Date().getDay(); // 0 is Sunday, 1 Monday, ...
    const dowEmoji = d === 1 ? "🔵" : d === 2 ? "🔵" : d === 3 ? "🟡" : d === 4 ? "🟠" : d === 5 ? "🔴" : "⚪";
    const dowName = d === 1 ? "Пн" : d === 2 ? "Вт" : d === 3 ? "Ср" : d === 4 ? "Чт" : d === 5 ? "Пт" : d === 6 ? "Сб" : "Вс";
    const dowVerdict = d === 1 ? "Слабая гамма — жди ложных пробоев" :
                       d === 2 ? "Умеренная — короткие цели" :
                       d === 3 ? "Тренд зарождается — набирает силу" :
                       d === 4 ? "Сильная гамма — тренд работает" :
                       d === 5 ? "ЭКСПИРАЦИЯ — сквизы и пробои" : "Выходной";
    return { dowName, dowEmoji, dowVerdict };
  }, []);

  const activeThemeMeta = STATION_THEMES.find(t => t.id === stationTheme) || STATION_THEMES[0];
  const curPalette = THEME_PALETTES[stationTheme] || THEME_PALETTES["cyber_dark"];

  // 📋 Reusable Dropdown Content: Ticker Selection (13 Instruments)
  const renderTickerDropdownContent = (isMobile = false) => {
    const tickersList: {
      id: AssetSymbol;
      category: string[];
      code: string;
      badge: string;
      badgeTone: string;
      name: string;
      sub: string;
      price: string;
      meta: string;
    }[] = [
      {
        id: "XAUUSD",
        category: ["GOLD"],
        code: "OANDA:XAUUSD",
        badge: "OANDA SPOT",
        badgeTone: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        name: "Золото Спот (1 oz USD)",
        sub: "Эталон TradingView • symbols/XAUUSD",
        price: `$${(oandaData?.price || (activeAsset === "XAUUSD" && latestCandle ? latestCandle.close : 4132.35)).toFixed(2)}`,
        meta: `Bid/Ask: ${(oandaData?.bid || 4132.01).toFixed(2)}/${(oandaData?.ask || 4132.37).toFixed(2)}`
      },
      {
        id: "PAXGUSDT",
        category: ["GOLD", "CRYPTO"],
        code: "BINANCE:PAXGUSDT",
        badge: "SPOT 24/7",
        badgeTone: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
        name: "Крипто-золото PAX Gold",
        sub: "Binance Spot • 1 токен = 1 тройская унция",
        price: activeAsset === "PAXGUSDT" && latestCandle ? `$${latestCandle.close.toFixed(2)}` : "$4135.40",
        meta: "Торги 24/7"
      },
      {
        id: "MOEX_GOLD",
        category: ["GOLD", "MOEX"],
        code: `MOEX:${moexContracts?.large?.secId || "GDZ6"}`,
        badge: "MOEX FORTS",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: `Фьючерс Золото (${moexContracts?.large?.shortName || "GOLD-12.26"})`,
        sub: "МосБиржа • Контракт 1 унция (USD)",
        price: `$${Number(moexContracts?.large?.last || 4204.8).toFixed(1)}`,
        meta: `ОИ: ${Number(moexContracts?.large?.openPosition || 259088).toLocaleString("ru-RU")}`
      },
      {
        id: "MOEX_MINI",
        category: ["GOLD", "MOEX"],
        code: `MOEX:${moexContracts?.mini?.secId || "GNZ6"}`,
        badge: "MOEX FORTS",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: `Мини-фьючерс Золото (${moexContracts?.mini?.shortName || "GOLDM-12.26"})`,
        sub: "МосБиржа • Мини-контракт 0.1 унции (USD)",
        price: `$${Number(moexContracts?.mini?.last || 4203.3).toFixed(1)}`,
        meta: `ОИ: ${Number(moexContracts?.mini?.openPosition || 44702).toLocaleString("ru-RU")}`
      },
      {
        id: "GLDRUBF",
        category: ["GOLD", "MOEX"],
        code: "MOEX:GLDRUBF",
        badge: "MOEX ВЕЧНЫЙ",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: "Вечный фьючерс Золото (₽/г)",
        sub: "МосБиржа • Рублевое золото за 1 грамм",
        price: `${Number(moexContracts?.rub?.last || 8560).toLocaleString("ru-RU")} ₽`,
        meta: `ОИ: ${Number(moexContracts?.rub?.openPosition || 192400).toLocaleString("ru-RU")}`
      },
      {
        id: "MOEX_SI",
        category: ["MOEX"],
        code: `MOEX:${moexContracts?.si?.secId || "SiZ6"}`,
        badge: "MOEX FORTS",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: `Фьючерс USD/RUB (${moexContracts?.si?.shortName || "Si-12.26"})`,
        sub: "МосБиржа • Валютный фьючерс (1 000 USD в ₽)",
        price: `${Number(moexContracts?.si?.last || 83846).toLocaleString("ru-RU")} ₽`,
        meta: `ОИ: ${Number(moexContracts?.si?.openPosition || 9541598).toLocaleString("ru-RU")}`
      },
      {
        id: "MOEX_RI",
        category: ["MOEX"],
        code: `MOEX:${moexContracts?.ri?.secId || "RIZ6"}`,
        badge: "MOEX FORTS",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: `Фьючерс Индекс РТС (${moexContracts?.ri?.shortName || "RTS-12.26"})`,
        sub: "МосБиржа • Индексный фьючерс (пункты)",
        price: `${Number(moexContracts?.ri?.last || 93370).toLocaleString("ru-RU")} п.`,
        meta: `ОИ: ${Number(moexContracts?.ri?.openPosition || 106776).toLocaleString("ru-RU")}`
      },
      {
        id: "MOEX_BR",
        category: ["MOEX"],
        code: `MOEX:${moexContracts?.br?.secId || "BRX6"}`,
        badge: "MOEX FORTS",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: `Фьючерс Нефть Brent (${moexContracts?.br?.shortName || "BR-11.26"})`,
        sub: "МосБиржа • Товарный фьючерс (10 баррелей)",
        price: `$${Number(moexContracts?.br?.last || 110.49).toFixed(2)}`,
        meta: `ОИ: ${Number(moexContracts?.br?.openPosition || 504422).toLocaleString("ru-RU")}`
      },
      {
        id: "MOEX_NG",
        category: ["MOEX"],
        code: `MOEX:${moexContracts?.ng?.secId || "NGV6"}`,
        badge: "MOEX FORTS",
        badgeTone: "bg-red-500/20 text-red-300 border-red-500/40",
        name: `Фьючерс Природный газ (${moexContracts?.ng?.shortName || "NG-10.26"})`,
        sub: "МосБиржа • Товарный фьючерс (100 MMBtu)",
        price: `$${Number(moexContracts?.ng?.last || 3.014).toFixed(3)}`,
        meta: `ОИ: ${Number(moexContracts?.ng?.openPosition || 741722).toLocaleString("ru-RU")}`
      },
      {
        id: "BTCUSDT",
        category: ["CRYPTO"],
        code: "BINANCE:BTCUSDT",
        badge: "SPOT 24/7",
        badgeTone: "bg-orange-500/20 text-orange-300 border-orange-500/40",
        name: "Bitcoin Спот (BTC/USDT)",
        sub: "Binance Spot • Профиль Deribit GEX",
        price: activeAsset === "BTCUSDT" && latestCandle ? `$${latestCandle.close.toFixed(2)}` : "$82,200",
        meta: "24/7 Онлайн"
      },
      {
        id: "ETHUSDT",
        category: ["CRYPTO"],
        code: "BINANCE:ETHUSDT",
        badge: "SPOT 24/7",
        badgeTone: "bg-orange-500/20 text-orange-300 border-orange-500/40",
        name: "Ethereum Спот (ETH/USDT)",
        sub: "Binance Spot • Профиль Deribit GEX",
        price: activeAsset === "ETHUSDT" && latestCandle ? `$${latestCandle.close.toFixed(2)}` : "$2,430",
        meta: "24/7 Онлайн"
      },
      {
        id: "SOLUSDT",
        category: ["CRYPTO"],
        code: "BINANCE:SOLUSDT",
        badge: "SPOT 24/7",
        badgeTone: "bg-orange-500/20 text-orange-300 border-orange-500/40",
        name: "Solana Спот (SOL/USDT)",
        sub: "Binance Spot • Профиль GEX",
        price: activeAsset === "SOLUSDT" && latestCandle ? `$${latestCandle.close.toFixed(2)}` : "$185.00",
        meta: "24/7 Онлайн"
      },
      {
        id: "XRPUSDT",
        category: ["CRYPTO"],
        code: "BINANCE:XRPUSDT",
        badge: "SPOT 24/7",
        badgeTone: "bg-orange-500/20 text-orange-300 border-orange-500/40",
        name: "Ripple Спот (XRP/USDT)",
        sub: "Binance Spot • Профиль GEX",
        price: activeAsset === "XRPUSDT" && latestCandle ? `$${latestCandle.close.toFixed(4)}` : "$1.3000",
        meta: "24/7 Онлайн"
      }
    ];

    const filtered = tickersList.filter(
      (item) => popoverActiveTab === "ALL" || item.category.includes(popoverActiveTab)
    );

    return (
      <div className="flex flex-col max-h-[70vh] select-none text-left font-sans">
        {/* Category Filter Header */}
        <div className="p-2 border-b border-gray-800 bg-[#0d121f] shrink-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
              Инструменты ({filtered.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAssetDropdownOpen(false)}
              className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-[#070a12] p-0.5 rounded-lg border border-gray-800">
            {[
              { id: "ALL" as const, label: "Все" },
              { id: "GOLD" as const, label: "🥇 Золото" },
              { id: "MOEX" as const, label: "🇷🇺 MOEX" },
              { id: "CRYPTO" as const, label: "⚡ Крипто" }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setPopoverActiveTab(cat.id)}
                className={`flex-1 py-1 px-1 rounded text-[10.5px] font-bold transition cursor-pointer text-center whitespace-nowrap ${
                  popoverActiveTab === cat.id
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/50"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tickers Scroll List */}
        <div className="p-1.5 space-y-1 overflow-y-auto flex-1 min-h-0 divide-y divide-gray-800/40">
          {filtered.map((item) => {
            const isSelected = activeAsset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  handleSelectAsset(item.id);
                  setIsAssetDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition cursor-pointer border ${
                  isSelected
                    ? "bg-amber-500/15 border-amber-500/60 text-white"
                    : "bg-[#0f1422]/60 hover:bg-[#161d30] border-transparent text-gray-300"
                }`}
              >
                <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-white truncate">{item.code}</span>
                    <span className={`text-[8.5px] font-mono px-1 py-0.2 rounded border ${item.badgeTone}`}>
                      {item.badge}
                    </span>
                    {isSelected && <Check className="h-3 w-3 text-amber-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-gray-400 truncate">{item.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-xs text-white">{item.price}</div>
                  <div className="font-mono text-[9px] text-amber-400/90">{item.meta}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 🎛️ Reusable Dropdown Content: Indicator Toggles & Overlays
  const renderIndicatorsDropdownContent = (isMobile = false) => {
    return (
      <div className="flex flex-col max-h-[70vh] select-none text-left font-sans">
        {/* Dropdown Header */}
        <div className="p-2.5 border-b border-gray-800 bg-[#0d121f] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Индикаторы &amp; Оверлеи</span>
          </div>
          <button
            type="button"
            onClick={() => setIsIndicatorsModalOpen(false)}
            className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable Categories */}
        <div className="p-2.5 space-y-3 overflow-y-auto flex-1 min-h-0 text-xs">
          {/* Section 1: Trend EMA (Binance 5-EMA Standard) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-cyan-400" />
                <span>Скользящие средние (EMA Binance)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const allOn = showEma9 && showEma21 && showEma50 && showEma100 && showEma200;
                  const nextVal = !allOn;
                  setShowEma9(nextVal);
                  setShowEma21(nextVal);
                  setShowEma50(nextVal);
                  setShowEma100(nextVal);
                  setShowEma200(nextVal);
                }}
                className="text-[9.5px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer underline"
              >
                {showEma9 && showEma21 && showEma50 && showEma100 && showEma200 ? "Выкл все" : "Вкл все 5 EMA"}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => setShowEma9(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showEma9 ? "bg-amber-500/20 border-amber-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#f0b90b]" />
                  <span className="font-bold text-[10px]">EMA 9</span>
                </div>
                <span className="text-[8.5px] font-mono mt-0.5">{showEma9 ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEma21(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showEma21 ? "bg-pink-500/20 border-pink-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ec4899]" />
                  <span className="font-bold text-[10px]">EMA 21</span>
                </div>
                <span className="text-[8.5px] font-mono mt-0.5">{showEma21 ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEma50(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showEma50 ? "bg-blue-500/20 border-blue-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                  <span className="font-bold text-[10px]">EMA 50</span>
                </div>
                <span className="text-[8.5px] font-mono mt-0.5">{showEma50 ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEma100(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showEma100 ? "bg-emerald-500/20 border-emerald-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="font-bold text-[10px]">EMA 100</span>
                </div>
                <span className="text-[8.5px] font-mono mt-0.5">{showEma100 ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEma200(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showEma200 ? "bg-rose-500/20 border-rose-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#be185d]" />
                  <span className="font-bold text-[10px]">EMA 200</span>
                </div>
                <span className="text-[8.5px] font-mono mt-0.5">{showEma200 ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Oscillators */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Activity className="h-3 w-3 text-indigo-400" />
              <span>Осцилляторы (Подвальные Binance)</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setShowMacdPane(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showMacdPane ? "bg-indigo-500/20 border-indigo-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">MACD</span>
                <span className="text-[9px] font-mono text-gray-400">{showMacdPane ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRsiPane(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showRsiPane ? "bg-amber-500/20 border-amber-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">RSI (6 &amp; 14)</span>
                <span className="text-[9px] font-mono text-gray-400">{showRsiPane ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowStochPane(prev => !prev)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  showStochPane ? "bg-purple-500/20 border-purple-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">STOCHRSI</span>
                <span className="text-[9px] font-mono text-gray-400">{showStochPane ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>
            </div>
          </div>

          {/* Section 3: GEX & Smart Money */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Shield className="h-3 w-3 text-purple-400" />
              <span>Гамма GEX &amp; SMC Оверлеи</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setShowGexWalls(prev => !prev)}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                  showGexWalls ? "bg-purple-500/20 border-purple-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">GEX Стены</span>
                <span className="text-[9px] font-mono">{showGexWalls ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowForecast(prev => !prev)}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                  showForecast ? "bg-emerald-500/20 border-emerald-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">Прогноз TP/SL</span>
                <span className="text-[9px] font-mono">{showForecast ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOb(prev => !prev)}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                  showOb ? "bg-blue-500/20 border-blue-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">Ордер-блоки (OB)</span>
                <span className="text-[9px] font-mono">{showOb ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFvg(prev => !prev)}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                  showFvg ? "bg-teal-500/20 border-teal-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">FVG Имбаланс</span>
                <span className="text-[9px] font-mono">{showFvg ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReversal(prev => !prev)}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                  showReversal ? "bg-amber-500/20 border-amber-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">Зоны OTE (0.618)</span>
                <span className="text-[9px] font-mono">{showReversal ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTables(prev => !prev)}
                className={`p-1.5 rounded-lg border flex items-center justify-between text-left cursor-pointer transition ${
                  showTables ? "bg-cyan-500/20 border-cyan-400 text-white" : "bg-gray-900/60 border-gray-800 text-gray-400"
                }`}
              >
                <span className="font-bold text-[11px]">HUD Таблица</span>
                <span className="text-[9px] font-mono">{showTables ? "ВКЛ" : "ВЫКЛ"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Footer Actions */}
        <div className="p-2 border-t border-gray-800 bg-[#0d121f] shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setShowEma50(false);
              setShowEma100(false);
              setShowEma200(false);
              setShowRsiPane(false);
              setShowStochPane(false);
              setShowMacdPane(true);
              setShowGexWalls(true);
              setShowOb(true);
              setShowFvg(true);
              setShowTables(true);
            }}
            className="px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-[10px] cursor-pointer transition"
          >
            Сброс
          </button>
          <button
            type="button"
            onClick={() => setIsIndicatorsModalOpen(false)}
            className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] cursor-pointer transition"
          >
            Готово
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col flex-1 text-gray-100 min-h-0 h-full overflow-hidden font-sans transition-colors duration-200"
      style={{ backgroundColor: curPalette.bg }}
    >
      
      {/* 🧭 MOBILE TOP BAR: Ultra-compact single row (height ~42px) tailored for ~6" phones */}
      <div
        className="md:hidden border-b px-2 py-1.5 flex items-center justify-between gap-1.5 shrink-0 transition-colors duration-200 select-none z-50 relative overflow-visible"
        style={{ backgroundColor: curPalette.surface, borderColor: curPalette.border }}
      >
        {/* Left: Compact Ticker Trigger (e.g. XAUUSD, GDZ6, SiZ6) as Dropdown */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative shrink-0 z-50" ref={mobileAssetDropdownRef}>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsAssetDropdownOpen(prev => !prev);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#121622] hover:bg-[#1a2030] active:bg-[#20273c] border border-amber-500/60 text-amber-300 text-xs font-mono font-extrabold transition cursor-pointer shadow-xs shrink-0"
              title="Выбор торгового инструмента (нажмите для смены тикера)"
            >
              <span>{getShortAssetLabel(activeAsset)}</span>
              <ChevronDown className={`h-3 w-3 text-amber-400 transition-transform ${isAssetDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {isAssetDropdownOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1 z-50 w-[330px] max-w-[94vw] max-h-[75vh] flex flex-col bg-[#0c0f18] border border-amber-500/80 rounded-xl shadow-2xl overflow-hidden shadow-black/95 font-sans ring-1 ring-amber-500/50 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                {renderTickerDropdownContent(true)}
              </div>
            )}
          </div>

          {/* Live Price + Change % */}
          {latestCandle && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-mono text-xs font-extrabold text-white truncate">
                {activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI" || activeAsset === "GLDRUBF"
                  ? latestCandle.close.toLocaleString("ru-RU", { maximumFractionDigits: 1 })
                  : activeAsset === "MOEX_NG"
                  ? latestCandle.close.toFixed(3)
                  : activeAsset === "XRPUSDT"
                  ? latestCandle.close.toFixed(4)
                  : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI")
                  ? latestCandle.close.toFixed(1)
                  : latestCandle.close.toFixed(2)}
              </span>
              <span
                className={`font-mono text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                  priceChange >= 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChangePct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Mobile Drawer Trigger (☰) - Bar countdown and duplicate TF removed per user request */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className={`p-1.5 rounded-md border transition cursor-pointer ${
                isMobileMenuOpen
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                  : "bg-gray-900 text-gray-300 hover:text-white border-gray-700"
              }`}
              title="Меню терминала"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Mobile Actions Drawer / Popover */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 max-w-[85vw] bg-[#0c0f18]/98 border border-gray-700 rounded-xl shadow-2xl p-2.5 z-50 space-y-2 backdrop-blur-md">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-800">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Панель управления</span>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded text-gray-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Primary Navigation Tabs */}
                <div className="grid grid-cols-2 gap-1.5">
                  {stationUser.allowedTabs.includes("chart") && (
                    <button
                      onClick={() => {
                        setActiveTab("chart");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === "chart"
                          ? "bg-cyan-600 text-white"
                          : "bg-gray-900 text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <BarChart2 className="h-3.5 w-3.5 shrink-0" />
                      <span>График</span>
                    </button>
                  )}
                  {stationUser.allowedTabs.includes("gex") && (
                    <button
                      onClick={() => {
                        setActiveTab("gex");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === "gex"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-900 text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <Activity className="h-3.5 w-3.5 shrink-0" />
                      <span>GEX</span>
                    </button>
                  )}
                  {stationUser.allowedTabs.includes("calendar") && (
                    <button
                      onClick={() => {
                        setActiveTab("calendar");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === "calendar"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-900 text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Новости</span>
                    </button>
                  )}
                  {stationUser.allowedTabs.includes("settings") && (
                    <button
                      onClick={() => {
                        setSettingsInitialSection("telegram");
                        setActiveTab("settings");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === "settings"
                          ? "bg-amber-600 text-white"
                          : "bg-gray-900 text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <Settings className="h-3.5 w-3.5 shrink-0" />
                      <span>Настройки</span>
                    </button>
                  )}
                </div>

                {/* Chart Style Switcher for Mobile */}
                <div className="pt-1.5 border-t border-gray-800">
                  <div className="text-[10px] text-gray-400 mb-1 font-semibold">Стиль графика</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(["candles", "bars", "area", "line"] as ChartStyleType[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setChartStyle(st);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`px-1 py-1 rounded text-[10px] font-semibold text-center transition ${
                          chartStyle === st ? "bg-gray-800 text-cyan-300 border border-cyan-500/50" : "bg-gray-950 text-gray-400"
                        }`}
                      >
                        {st === "candles" ? "Свечи" : st === "bars" ? "Бары" : st === "area" ? "Зона" : "Линия"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Indicators & Tools Buttons */}
                <div className="pt-1.5 border-t border-gray-800 flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setIsIndicatorsModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Индикаторы & Уровни</span>
                    </span>
                    <span className="text-[10px] text-cyan-400">Настроить ⚙️</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsAiPanelCollapsed(prev => !prev);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700"
                  >
                    <span className="flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-cyan-400" />
                      <span>ИИ-Аналитик (Боковая панель)</span>
                    </span>
                    <span className="text-[10px] text-gray-400">{isAiPanelCollapsed ? "Закрыта" : "Открыта"}</span>
                  </button>

                  <button
                    onClick={() => {
                      fetchCandles(activeAsset, activeTf);
                      fetchDayGexReport(activeAsset);
                      fetchGexReport(activeAsset, gexHorizonRef.current);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCandles ? "animate-spin text-cyan-400" : ""}`} />
                    <span>Обновить данные</span>
                  </button>
                </div>

                {/* Market Status Footnote */}
                <div className="pt-1 border-t border-gray-800/80 text-[10px] text-gray-400 text-center font-mono">
                  {marketStatus.statusText}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🧭 DESKTOP TOP QUANTEX TERMINAL HEADER (Full rich controls for screens >= md / tablets / PCs) */}
      <div
        className="hidden md:flex border-b px-2 sm:px-3 py-1.5 items-center justify-between gap-2 flex-wrap shrink-0 transition-colors duration-200 relative z-40 overflow-visible"
        style={{ backgroundColor: curPalette.surface, borderColor: curPalette.border }}
      >
        
        {/* Left: Unified Ticker Selector Dropdown Trigger + Live Price & Market Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
          <div className="relative shrink-0 z-50" ref={assetDropdownRef}>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsAssetDropdownOpen(prev => !prev);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121622] hover:bg-[#1a2030] border border-amber-500/50 text-amber-300 text-xs font-bold transition cursor-pointer shadow-sm"
              title="Выбор торгового инструмента (Единый стандарт тикеров QUANTEX)"
            >
              <span>📋</span>
              <span className="font-mono tracking-tight">
                {activeAsset === "XAUUSD" ? "OANDA:XAUUSD • Золото Спот" :
                 activeAsset === "PAXGUSDT" ? "BINANCE:PAXGUSDT • Крипто-золото" :
                 activeAsset === "MOEX_GOLD" ? `MOEX:${moexContracts?.large?.secId || "GDZ6"} • Золото Фьюч` :
                 activeAsset === "MOEX_MINI" ? `MOEX:${moexContracts?.mini?.secId || "GNZ6"} • Мини-золото` :
                 activeAsset === "GLDRUBF" ? "MOEX:GLDRUBF • Золото (₽/г)" :
                 activeAsset === "MOEX_SI" ? `MOEX:${moexContracts?.si?.secId || "SiZ6"} • Курс USD/RUB` :
                 activeAsset === "MOEX_RI" ? `MOEX:${moexContracts?.ri?.secId || "RIZ6"} • Индекс РТС` :
                 activeAsset === "MOEX_BR" ? `MOEX:${moexContracts?.br?.secId || "BRX6"} • Нефть Brent` :
                 activeAsset === "MOEX_NG" ? `MOEX:${moexContracts?.ng?.secId || "NGV6"} • Природный газ` :
                 `BINANCE:${activeAsset} • ${activeAsset.replace("USDT", "/USDT")}`}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-amber-400 transition-transform ${isAssetDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isAssetDropdownOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1 z-50 w-[440px] max-w-[95vw] max-h-[75vh] flex flex-col bg-[#0c0f18] border border-amber-500/80 rounded-xl shadow-2xl overflow-hidden shadow-black/95 font-sans ring-1 ring-amber-500/50 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                {renderTickerDropdownContent(false)}
              </div>
            )}
          </div>

          {/* Live Price + Change % + Trading Status */}
          {latestCandle && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-sm sm:text-base font-extrabold text-white whitespace-nowrap">
                {activeAsset === "MOEX_SI" || activeAsset === "MOEX_RI" || activeAsset === "GLDRUBF"
                  ? latestCandle.close.toLocaleString("ru-RU", { maximumFractionDigits: 1 })
                  : activeAsset === "MOEX_NG"
                  ? latestCandle.close.toFixed(3)
                  : activeAsset === "XRPUSDT"
                  ? latestCandle.close.toFixed(4)
                  : (activeAsset === "MOEX_GOLD" || activeAsset === "MOEX_MINI")
                  ? latestCandle.close.toFixed(1)
                  : latestCandle.close.toFixed(2)}
                <span className="text-[10px] text-amber-400 ml-1 font-sans font-bold">
                  {activeAsset === "MOEX_SI" ? "₽" :
                   activeAsset === "GLDRUBF" ? "₽/г" :
                   activeAsset === "MOEX_RI" ? "п." :
                   activeAsset === "XAUUSD" ? "$ (OANDA:XAUUSD)" : "$"}
                </span>
              </span>

              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  priceChange >= 0
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChangePct.toFixed(2)}%
              </span>

              {marketStatus.isPremarket ? (
                <span
                  className="text-[10px] font-mono font-bold text-amber-200 bg-amber-500/25 px-2 py-0.5 rounded border border-amber-400/60 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  title={marketStatus.statusText}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>🟡 {marketStatus.statusBadge || "Премаркет"}</span>
                </span>
              ) : marketStatus.isClearing ? (
                <span
                  className="text-[10px] font-mono font-bold text-yellow-200 bg-yellow-500/20 px-2 py-0.5 rounded border border-yellow-400/50 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  title={marketStatus.statusText}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <span>⏸ {marketStatus.statusBadge || "Клиринг"}</span>
                </span>
              ) : marketStatus.sessionType === "POSTMARKET" ? (
                <span
                  className="text-[10px] font-mono font-bold text-indigo-200 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-400/50 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  title={marketStatus.statusText}
                >
                  <span>🏁 {marketStatus.statusBadge || "Постмаркет"}</span>
                </span>
              ) : marketStatus.isOpen ? (
                <span
                  className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  title={marketStatus.statusText}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🟢 {marketStatus.statusBadge || "Торги идут"}</span>
                </span>
              ) : (
                <span
                  className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                  title={marketStatus.statusText}
                >
                  <span>⏸ {marketStatus.statusBadge || "Сейчас нет торгов"}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: PRIMARY TABS (График, GEX, Новости, Настройки) + Dropdown Tools */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {stationUser.allowedTabs.includes("chart") && (
            <button
              onClick={() => setActiveTab("chart")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === "chart"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400/50"
                  : "bg-[#121622] text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-800"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5 shrink-0" />
              <span>График</span>
            </button>
          )}

          {stationUser.allowedTabs.includes("gex") && (
            <button
              onClick={() => setActiveTab("gex")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === "gex"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-400/50"
                  : "bg-[#121622] text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-800"
              }`}
            >
              <Activity className="h-3.5 w-3.5 shrink-0" />
              <span>GEX Аналитика</span>
            </button>
          )}

          {stationUser.allowedTabs.includes("calendar") && (
            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === "calendar"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/50"
                  : "bg-[#121622] text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-800"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Новости</span>
              {marketNews.length > 0 && (
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-500/30 text-blue-200 border border-blue-400/40">
                  {marketNews.length}
                </span>
              )}
            </button>
          )}

          {/* DEDICATED MAIN SETTINGS TAB (Unified for Telegram, AI API, Passwords, RBAC, Themes) */}
          {stationUser.allowedTabs.includes("settings") && (
            <button
              onClick={() => {
                setSettingsInitialSection("telegram");
                setActiveTab("settings");
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                activeTab === "settings"
                  ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-md shadow-amber-500/30 ring-1 ring-amber-400/50"
                  : "bg-[#121622] text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-800"
              }`}
              title="Открыть главную вкладку настроек (Telegram-бот, API ИИ, пароль сервера, пользователи, темы)"
            >
              <Settings className="h-3.5 w-3.5 shrink-0" />
              <span>Настройки</span>
            </button>
          )}

          {/* Secondary Tools Dropdown (Код Pro v8, Журнал) */}
          {(stationUser.allowedTabs.includes("editor") || stationUser.allowedTabs.includes("journal")) && (
            <div className="relative" ref={moreToolsRef}>
              <button
                onClick={() => setIsMoreToolsOpen(prev => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap border ${
                  activeTab === "editor" || activeTab === "journal"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-[#121622] text-gray-400 hover:text-white border-gray-800"
                }`}
                title="Дополнительные инструменты"
              >
                <span>
                  {activeTab === "editor"
                    ? "Код v8"
                    : activeTab === "journal"
                    ? "Журнал"
                    : "Ещё"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {isMoreToolsOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#0c0f18] border border-gray-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                  {stationUser.allowedTabs.includes("editor") && (
                    <button
                      onClick={() => {
                        setActiveTab("editor");
                        setIsMoreToolsOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === "editor"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5 text-amber-400" />
                      <span>Код QUANTEX Pro v8</span>
                    </button>
                  )}

                  {stationUser.allowedTabs.includes("journal") && (
                    <button
                      onClick={() => {
                        setActiveTab("journal");
                        setIsMoreToolsOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === "journal"
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Журнал сделок</span>
                    </button>
                  )}

                  {onNavigateToTab && (
                    <button
                      onClick={() => {
                        onNavigateToTab("indicator_stats");
                        setIsMoreToolsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-emerald-300 hover:bg-emerald-950/50 hover:text-white"
                      title="Постоянная статистика индикатора QUANTEX Pro v8 по всем 13 тикерам"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Статистика индикатора</span>
                    </button>
                  )}

                  {stationUser.role === "admin" && onNavigateToTab && (
                    <button
                      onClick={() => {
                        onNavigateToTab("ai_learning");
                        setIsMoreToolsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-purple-300 hover:bg-purple-950/50 hover:text-white border-t border-gray-800/80 mt-1 pt-1.5"
                      title="Самообучение ИИ, журнал прогнозов и статистика экспирации"
                    >
                      <Brain className="h-3.5 w-3.5 text-purple-400" />
                      <span>Самообучение ИИ</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>


      {/* 🚀 MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative">
        
        {/* ======================================================== */}
        {/* 1. CHART & QUANTEX GRAPHICAL ENGINE TAB                  */}
        {/* ======================================================== */}
        <div className={`flex-1 flex flex-col min-h-0 h-full relative ${activeTab === "chart" ? "" : "hidden"}`}>
            {/* 📱 MOBILE 1-TAP QUICK BAR: Direct Timeframe Pills + Indicators + AI Toggle (Visible on mobile < md) */}
            <div
              className="md:hidden border-b px-1.5 py-1 flex items-center justify-between gap-1 shrink-0 select-none relative z-40 overflow-visible"
              style={{ backgroundColor: curPalette.surfaceAlt, borderColor: curPalette.border }}
            >
              <div className="flex items-center gap-0.5 bg-[#060911] p-0.5 rounded-lg border border-slate-800 shrink-0 overflow-x-auto no-scrollbar max-w-[calc(100vw-180px)]">
                {(["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleSelectTimeframe(tf)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold transition cursor-pointer ${
                      activeTf === tf
                        ? "bg-cyan-600 text-white shadow-xs"
                        : "text-slate-400 active:text-white"
                    }`}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0 relative z-50">
                {/* Collapsible GEX Expiration Horizon Tab */}
                <div className="relative shrink-0" ref={gexHorizonDropdownRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGexHorizonDropdownOpen(!isGexHorizonDropdownOpen);
                    }}
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/40 flex items-center gap-0.5 cursor-pointer"
                    title="Горизонт экспирации опционов (GEX)"
                  >
                    <span>{gexHorizon === "DAY" ? "⚡ День" : gexHorizon === "WEEK" ? "📅 Неделя" : gexHorizon === "MONTH" ? "🗓️ Месяц" : "🌐 Все"}</span>
                    <ChevronDown className="h-2.5 w-2.5 text-purple-400" />
                  </button>
                  {isGexHorizonDropdownOpen && (
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-full right-0 mt-1.5 z-50 bg-[#0b0e17] border border-purple-500/80 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 min-w-[145px] font-mono ring-1 ring-purple-500/50"
                    >
                      {[
                        { id: "DAY", label: "⚡ День (0DTE)" },
                        { id: "WEEK", label: "📅 Неделя" },
                        { id: "MONTH", label: "🗓️ Месяц" },
                        { id: "ALL", label: "🌐 Все серии" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleSelectGexHorizon(item.id as any);
                            setIsGexHorizonDropdownOpen(false);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectGexHorizon(item.id as any);
                            setIsGexHorizonDropdownOpen(false);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold text-left transition flex items-center justify-between cursor-pointer ${
                            gexHorizon === item.id
                              ? "bg-purple-600 text-white font-extrabold"
                              : "text-gray-300 hover:bg-gray-800"
                          }`}
                        >
                          <span>{item.label}</span>
                          {gexHorizon === item.id && <span className="text-white text-[10px] font-black">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative shrink-0 z-50" ref={mobileIndicatorsDropdownRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsIndicatorsModalOpen(prev => !prev);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 cursor-pointer border ${
                      isIndicatorsModalOpen
                        ? "bg-cyan-500/30 text-white border-cyan-400 shadow-sm"
                        : "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                    }`}
                    title="Индикаторы и уровни"
                  >
                    <Sliders className="h-3 w-3 text-cyan-400" />
                    <span>Индик.</span>
                    <ChevronDown className={`h-2.5 w-2.5 text-cyan-400 transition-transform ${isIndicatorsModalOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isIndicatorsModalOpen && (
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-full right-0 mt-1.5 z-50 w-[320px] max-w-[92vw] max-h-[70vh] flex flex-col bg-[#0c0f18] border border-cyan-500/80 rounded-xl shadow-2xl overflow-hidden shadow-black/95 font-sans ring-1 ring-cyan-500/50 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      {renderIndicatorsDropdownContent(true)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsAiPanelCollapsed(!isAiPanelCollapsed)}
                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 border cursor-pointer ${
                    !isAiPanelCollapsed
                      ? "bg-purple-600 text-white border-purple-400"
                      : "bg-slate-900 text-slate-300 border-slate-700"
                  }`}
                  title="Открыть / скрыть панель ИИ-Аналитика"
                >
                  <Bot className="h-3 w-3 text-cyan-400" />
                  <span>ИИ</span>
                </button>
              </div>
            </div>

            {/* Chart Sub-Bar: Timeframes, Types, Overlays (Visible on desktop >= md) */}
            <div
              className="hidden md:flex border-b px-2 sm:px-3 py-1 items-center justify-between gap-1.5 shrink-0 transition-colors duration-200 relative z-40 overflow-visible"
              style={{ backgroundColor: curPalette.surfaceAlt, borderColor: curPalette.border }}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Timeframes */}
                <div className="flex items-center gap-0.5 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                  {(["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleSelectTimeframe(tf)}
                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold transition cursor-pointer ${
                        activeTf === tf ? "bg-cyan-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Chart Style Switcher */}
                <div className="flex items-center gap-0.5 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                  {(["candles", "bars", "area", "line"] as ChartStyleType[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => setChartStyle(st)}
                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold transition cursor-pointer whitespace-nowrap ${
                        chartStyle === st ? "bg-gray-800 text-cyan-300 shadow-sm" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {st === "candles" ? "Свечи" : st === "bars" ? "Бары" : st === "area" ? "Зона" : "Линия"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Indicators & HUD Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* GEX Expiration Horizon Dropdown Tab */}
                <div className="relative shrink-0 z-50" ref={desktopGexHorizonDropdownRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGexHorizonDropdownOpen(!isGexHorizonDropdownOpen);
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/40 hover:bg-purple-500/30 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
                    title="Горизонт экспирации опционов GEX (День, Неделя, Месяц, Все)"
                  >
                    <Calendar className="h-3.5 w-3.5 text-purple-400" />
                    <span>GEX: {gexHorizon === "DAY" ? "День" : gexHorizon === "WEEK" ? "Неделя" : gexHorizon === "MONTH" ? "Месяц" : "Все"}</span>
                    <ChevronDown className="h-3 w-3 text-purple-400" />
                  </button>
                  {isGexHorizonDropdownOpen && (
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-full right-0 mt-1 z-50 bg-[#0b0e17] border border-purple-500/80 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 min-w-[155px] font-mono ring-1 ring-purple-500/50"
                    >
                      {[
                        { id: "DAY", label: "⚡ День (0DTE)" },
                        { id: "WEEK", label: "📅 Неделя (Свинг)" },
                        { id: "MONTH", label: "🗓️ Месяц (Фонды)" },
                        { id: "ALL", label: "🌐 Все экспирации" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleSelectGexHorizon(item.id as any);
                            setIsGexHorizonDropdownOpen(false);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectGexHorizon(item.id as any);
                            setIsGexHorizonDropdownOpen(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition flex items-center justify-between cursor-pointer ${
                            gexHorizon === item.id
                              ? "bg-purple-600 text-white font-extrabold"
                              : "text-gray-300 hover:bg-gray-800"
                          }`}
                        >
                          <span>{item.label}</span>
                          {gexHorizon === item.id && <span className="text-white text-xs font-black">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Centralized Indicators Dropdown */}
                <div className="relative shrink-0 z-50" ref={indicatorsDropdownRef}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsIndicatorsModalOpen(prev => !prev);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-sm border ${
                      isIndicatorsModalOpen
                        ? "bg-cyan-500/30 text-white border-cyan-400 ring-1 ring-cyan-400/50"
                        : "bg-cyan-500/20 text-cyan-300 hover:text-white border-cyan-500/40 hover:bg-cyan-500/30"
                    }`}
                    title="Раскрыть список индикаторов и оверлеев (EMA, MACD, RSI, Стохастик, GEX, SMC, HUD)"
                  >
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Индикаторы</span>
                    <ChevronDown className={`h-3 w-3 text-cyan-400 transition-transform ${isIndicatorsModalOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isIndicatorsModalOpen && (
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-full right-0 mt-1 z-50 w-[380px] sm:w-[460px] max-w-[95vw] max-h-[75vh] flex flex-col bg-[#0c0f18] border border-cyan-500/80 rounded-xl shadow-2xl overflow-hidden shadow-black/95 font-sans ring-1 ring-cyan-500/50 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      {renderIndicatorsDropdownContent(false)}
                    </div>
                  )}
                </div>


                {/* Settings Tab Button for admins/privileged users */}
                {stationUser.allowedTabs.includes("settings") && (
                  <button
                    onClick={() => {
                      setSettingsInitialSection("indicator");
                      setActiveTab("settings");
                    }}
                    className="px-2 py-0.5 rounded-lg text-[11px] sm:text-xs font-bold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-1 transition cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                    title="Открыть параметры индикатора в Главной вкладке настроек"
                  >
                    <Settings className="h-3.5 w-3.5 text-gray-400" />
                    <span>Система</span>
                  </button>
                )}

                {/* AI Analyst Panel Toggle */}
                <button
                  onClick={() => setIsAiPanelCollapsed(!isAiPanelCollapsed)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-sm whitespace-nowrap shrink-0 ${
                    !isAiPanelCollapsed
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
                  }`}
                  title="Автономный ИИ-Аналитик справа от графика (Торговый план на день, GEX, макро-алерты)"
                >
                  <Bot className="h-3.5 w-3.5 text-cyan-400" />
                  <span>ИИ-Аналитик</span>
                </button>

                {/* Refresh */}
                <button
                  onClick={() => {
                    fetchCandles(activeAsset, activeTf);
                    fetchDayGexReport(activeAsset);
                    fetchGexReport(activeAsset, gexHorizonRef.current);
                  }}
                  className="p-1 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer shrink-0"
                  title="Обновить котировки и уровни"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCandles ? "animate-spin text-cyan-400" : ""}`} />
                </button>
              </div>
            </div>

            {/* Ensure Lightweight Charts canvas never intercepts mobile touch scrolling */}
            <style>{`
              .tv-lightweight-charts,
              .tv-lightweight-charts table,
              .tv-lightweight-charts canvas {
                touch-action: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
              }
            `}</style>

            {/* Chart Area + Autonomous AI Analyst Docked on the Right */}
            <div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden relative">
              {/* Canvas / Lightweight Chart Area */}
              <div className="flex-1 min-w-0 relative bg-[#070a12] h-full w-full overflow-hidden flex flex-col">
                <div ref={chartWrapperRef} className="w-full flex-1 relative min-h-[280px] sm:min-h-[400px] touch-none select-none">
                <div
                  ref={chartContainerRef}
                  className="w-full h-full absolute inset-0 cursor-crosshair active:cursor-grabbing touch-none select-none"
                  style={{ touchAction: "none" }}
                />

                {/* 📊 TRADINGVIEW-STYLE OHLC HOVER BAR & PRICE SCALE COUNTDOWN (ISOLATED AT 120 FPS) */}
                <ChartOverlays
                  chart={chartInstanceRef.current}
                  series={seriesInstanceRef.current}
                  chartWrapperRef={chartWrapperRef}
                  activeAsset={activeAsset}
                  activeTf={activeTf}
                  marketStatus={marketStatus}
                  barCountdownFormatted={barCountdown.formatted}
                  candles={candles}
                  showTables={showTables}
                  isHudMinimized={isHudMinimized}
                  onToggleHudMinimize={() => setIsHudMinimized(false)}
                  indicatorOutput={indicatorOutput}
                  showEma9={showEma9}
                  showEma21={showEma21}
                  showEma50={showEma50}
                  showEma100={showEma100}
                  showEma200={showEma200}
                />
              </div>

              {/* MACD Sub-Pane (Binance style with resizable height) */}
              {showMacdPane && (
                <div
                  className="border-t relative shrink-0 transition-colors duration-200 group/macd"
                  style={{ height: `${macdPaneHeight}px`, backgroundColor: curPalette.chartBg, borderColor: curPalette.border }}
                >
                  {/* Drag Resizer Bar */}
                  <div
                    onMouseDown={(e) => handleStartResizePane("macd", e)}
                    onTouchStart={(e) => handleStartResizePane("macd", e)}
                    className="h-2 w-full cursor-row-resize bg-transparent hover:bg-cyan-500/30 active:bg-cyan-500/60 transition-colors z-20 absolute top-0 left-0 flex items-center justify-center select-none"
                    title="Зажмите и тяните вверх/вниз для изменения высоты панели MACD"
                  >
                    <div className="w-16 h-1 rounded-full bg-gray-600/60 hover:bg-cyan-400 transition-all" />
                  </div>

                  {/* Binance-style compact top header with real-time values */}
                  <div className="absolute top-1 left-2.5 right-2 z-10 flex items-center justify-between select-none pointer-events-none">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 text-[8.5px] sm:text-[10px] font-mono tracking-tight overflow-x-auto scrollbar-none whitespace-nowrap bg-black/40 backdrop-blur-xs px-1.5 py-0.5 rounded border border-white/5">
                      <span className="font-semibold text-gray-300">MACD({macdFast},{macdSlow},{macdSigLen})</span>
                      <span className="text-[#facc15] font-medium">DIF: <span className="font-mono">{liveIndicatorValues.macd?.dif ?? "0.00"}</span></span>
                      <span className="text-[#ec4899] font-medium">DEA: <span className="font-mono">{liveIndicatorValues.macd?.dea ?? "0.00"}</span></span>
                      <span className={`${(liveIndicatorValues.macd?.hist ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"} font-medium`}>
                        MACD: <span className="font-mono">{liveIndicatorValues.macd?.hist ?? "0.00"}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 pointer-events-auto shrink-0 ml-1">
                      <div className="hidden sm:flex items-center gap-0.5 bg-gray-950/80 px-1 py-0.5 rounded border border-gray-800/80 text-[8.5px] font-mono">
                        <button
                          type="button"
                          onClick={() => setMacdPaneHeight(prev => Math.max(55, prev - 20))}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                          title="Уменьшить высоту"
                        >
                          -
                        </button>
                        <span
                          onClick={() => setMacdPaneHeight(110)}
                          className="text-gray-400 hover:text-cyan-300 cursor-pointer px-1 text-[8.5px]"
                          title="Сбросить высоту (110px)"
                        >
                          {macdPaneHeight}px
                        </span>
                        <button
                          type="button"
                          onClick={() => setMacdPaneHeight(prev => Math.min(350, prev + 20))}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                          title="Увеличить высоту"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMacdPane(false)}
                        className="w-4 h-4 flex items-center justify-center rounded bg-gray-950/80 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-gray-800/80 transition-colors cursor-pointer"
                        title="Скрыть панель MACD"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>

                  <div ref={macdContainerRef} className="w-full h-full" />
                </div>
              )}

              {/* RSI Sub-Pane (Separate 6 & 14 with resizable height) */}
              {showRsiPane && (
                <div
                  className="border-t relative shrink-0 transition-colors duration-200 group/rsi"
                  style={{ height: `${rsiPaneHeight}px`, backgroundColor: curPalette.chartBg, borderColor: curPalette.border }}
                >
                  {/* Drag Resizer Bar */}
                  <div
                    onMouseDown={(e) => handleStartResizePane("rsi", e)}
                    onTouchStart={(e) => handleStartResizePane("rsi", e)}
                    className="h-2 w-full cursor-row-resize bg-transparent hover:bg-amber-500/30 active:bg-amber-500/60 transition-colors z-20 absolute top-0 left-0 flex items-center justify-center select-none"
                    title="Зажмите и тяните вверх/вниз для изменения высоты панели RSI"
                  >
                    <div className="w-16 h-1 rounded-full bg-gray-600/60 hover:bg-amber-400 transition-all" />
                  </div>

                  {/* Binance-style compact top header with real-time values */}
                  <div className="absolute top-1 left-2.5 right-2 z-10 flex items-center justify-between select-none pointer-events-none">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 text-[8.5px] sm:text-[10px] font-mono tracking-tight overflow-x-auto scrollbar-none whitespace-nowrap bg-black/40 backdrop-blur-xs px-1.5 py-0.5 rounded border border-white/5">
                      <span style={{ color: "#f0b90b" }} className="font-semibold">RSI(6): <span className="font-mono">{formatBinanceNumber(liveIndicatorValues.rsi?.rsi6, 2)}</span></span>
                      <span style={{ color: "#ec4899" }} className="font-semibold">RSI(14): <span className="font-mono">{formatBinanceNumber(liveIndicatorValues.rsi?.rsi14, 2)}</span></span>
                    </div>

                    <div className="flex items-center gap-1 pointer-events-auto shrink-0 ml-1">
                      <div className="hidden sm:flex items-center gap-0.5 bg-gray-950/80 px-1 py-0.5 rounded border border-gray-800/80 text-[8.5px] font-mono">
                        <button
                          type="button"
                          onClick={() => setRsiPaneHeight(prev => Math.max(55, prev - 20))}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                          title="Уменьшить высоту"
                        >
                          -
                        </button>
                        <span
                          onClick={() => setRsiPaneHeight(95)}
                          className="text-gray-400 hover:text-amber-300 cursor-pointer px-1 text-[8.5px]"
                          title="Сбросить высоту (95px)"
                        >
                          {rsiPaneHeight}px
                        </span>
                        <button
                          type="button"
                          onClick={() => setRsiPaneHeight(prev => Math.min(350, prev + 20))}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                          title="Увеличить высоту"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRsiPane(false)}
                        className="w-4 h-4 flex items-center justify-center rounded bg-gray-950/80 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-gray-800/80 transition-colors cursor-pointer"
                        title="Скрыть панель RSI"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>

                  <div ref={rsiContainerRef} className="w-full h-full" />
                </div>
              )}

              {/* Stochastic Oscillator Sub-Pane (%K 14, %D 3 with resizable height) */}
              {showStochPane && (
                <div
                  className="border-t relative shrink-0 transition-colors duration-200 group/stoch"
                  style={{ height: `${stochPaneHeight}px`, backgroundColor: curPalette.chartBg, borderColor: curPalette.border }}
                >
                  {/* Drag Resizer Bar */}
                  <div
                    onMouseDown={(e) => handleStartResizePane("stoch", e)}
                    onTouchStart={(e) => handleStartResizePane("stoch", e)}
                    className="h-2 w-full cursor-row-resize bg-transparent hover:bg-rose-500/30 active:bg-rose-500/60 transition-colors z-20 absolute top-0 left-0 flex items-center justify-center select-none"
                    title="Зажмите и тяните вверх/вниз для изменения высоты панели Стохастик"
                  >
                    <div className="w-16 h-1 rounded-full bg-gray-600/60 hover:bg-rose-400 transition-all" />
                  </div>

                  {/* Binance-style compact top header with real-time values */}
                  <div className="absolute top-1 left-2.5 right-2 z-10 flex items-center justify-between select-none pointer-events-none">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 text-[8.5px] sm:text-[10px] font-mono tracking-tight overflow-x-auto scrollbar-none whitespace-nowrap bg-black/40 backdrop-blur-xs px-1.5 py-0.5 rounded border border-white/5">
                      <span style={{ color: "#f0b90b" }} className="font-semibold">STOCHRSI: <span className="font-mono">{formatBinanceNumber(liveIndicatorValues.stoch?.k, 2)}</span></span>
                      <span style={{ color: "#a855f7" }} className="font-semibold">MASTOCHRSI: <span className="font-mono">{formatBinanceNumber(liveIndicatorValues.stoch?.d, 2)}</span></span>
                    </div>

                    <div className="flex items-center gap-1 pointer-events-auto shrink-0 ml-1">
                      <div className="hidden sm:flex items-center gap-0.5 bg-gray-950/80 px-1 py-0.5 rounded border border-gray-800/80 text-[8.5px] font-mono">
                        <button
                          type="button"
                          onClick={() => setStochPaneHeight(prev => Math.max(55, prev - 20))}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                          title="Уменьшить высоту"
                        >
                          -
                        </button>
                        <span
                          onClick={() => setStochPaneHeight(95)}
                          className="text-gray-400 hover:text-rose-300 cursor-pointer px-1 text-[8.5px]"
                          title="Сбросить высоту (95px)"
                        >
                          {stochPaneHeight}px
                        </span>
                        <button
                          type="button"
                          onClick={() => setStochPaneHeight(prev => Math.min(350, prev + 20))}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                          title="Увеличить высоту"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStochPane(false)}
                        className="w-4 h-4 flex items-center justify-center rounded bg-gray-950/80 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-gray-800/80 transition-colors cursor-pointer"
                        title="Скрыть панель Стохастик"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>

                  <div ref={stochContainerRef} className="w-full h-full" />
                </div>
              )}

              {/* 📊 TRADINGVIEW-STYLE HUD TABLE OVERLAY (DRAGGABLE & COLLAPSIBLE FOR MOBILE) */}
              {showTables && !isHudMinimized && (
                <div
                  ref={hudCardRef}
                    style={{
                      left: hudPos ? `${hudPos.x}px` : undefined,
                      top: hudPos ? `${hudPos.y}px` : undefined,
                      bottom: hudPos ? undefined : (
                        (tablePos.startsWith("Нижний") || tablePos === "Внизу по центру")
                          ? (`${(showMacdPane ? macdPaneHeight : 0) + (showRsiPane ? rsiPaneHeight : 0) + (showStochPane ? stochPaneHeight : 0) + 20}px`)
                          : undefined
                      ),
                      touchAction: "none",
                      zIndex: isDraggingHud ? 40 : 25,
                      transform: hudScale !== 100 ? `scale(${hudScale / 100})` : undefined,
                      transformOrigin: "top left",
                      fontSize: `${hudFontSize}px`
                    }}
                    className={`absolute font-mono shadow-2xl rounded-xl border border-gray-700/80 bg-[#0f172a]/95 backdrop-blur-md text-xs select-none transition-shadow max-w-[calc(100vw-16px)] ${
                      isDraggingHud ? "shadow-cyan-500/20 ring-2 ring-cyan-500/50" : ""
                    } ${
                      hudPos ? "" : (
                        tablePos === "Верхний левый" ? "top-9 left-2 sm:top-3 sm:left-3" :
                        tablePos === "Верхний правый" ? "top-9 right-2 sm:top-3 sm:right-3" :
                        tablePos === "Вверху по центру" ? "top-9 left-1/2 -translate-x-1/2" :
                        tablePos === "Внизу по центру" ? "left-1/2 -translate-x-1/2" :
                        tablePos === "Нижний правый" ? "right-2 sm:right-3" :
                        "left-2 sm:left-3"
                      )
                    } ${tblViewMode.includes("Ультра-Микро") ? "w-64" : tblViewMode.includes("Мини") ? "w-80" : "w-[360px] sm:w-[420px]"}`}
                  >
                    {/* Table Draggable Header */}
                    <div
                      onMouseDown={handleHudMouseDown}
                      onTouchStart={handleHudTouchStart}
                      onDoubleClick={() => setHudPos(null)}
                      className="px-3 py-1.5 border-b border-gray-700 flex items-center justify-between bg-[#1e293b] rounded-t-xl text-[11px] cursor-grab active:cursor-grabbing select-none hover:bg-[#25334a] transition-colors"
                      title="Зажмите и перетаскивайте панель в любое место экрана. Двойной клик — сброс позиции"
                    >
                      <div className="flex items-center gap-1.5">
                        <GripHorizontal className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="text-[#38bdf8] font-bold">{activeAsset}</span>
                        <span className="text-gray-400 text-[10px]">
                          {new Intl.DateTimeFormat("ru-RU", {
                            timeZone: "Europe/Moscow",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                          }).format(new Date())} МСК
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-white font-bold bg-gray-800 px-1 py-0.2 rounded">{activeTf.toUpperCase()}</span>
                        <span className="text-emerald-400 font-bold">1Д🟢</span>
                        <span>{dayOfWeekInfo.dowName} {dayOfWeekInfo.dowEmoji}</span>
                        {hudPos && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHudPos(null);
                            }}
                            className="text-gray-400 hover:text-cyan-300 p-0.5 rounded cursor-pointer ml-1"
                            title="Сбросить положение таблицы (вернуть в угол)"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                        {/* Zoom / Scale HUD Table */}
                        <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700/80 rounded px-1 py-0.5 text-[9px] font-mono ml-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHudScale(prev => Math.max(70, prev - 10));
                            }}
                            className="text-gray-400 hover:text-white px-0.5 font-bold cursor-pointer transition hover:bg-gray-800 rounded"
                            title="Уменьшить масштаб таблицы (-10%)"
                          >
                            -
                          </button>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setHudScale(100);
                            }}
                            className="text-cyan-300 cursor-pointer font-bold px-0.5 hover:underline"
                            title="Сбросить масштаб (100%)"
                          >
                            {hudScale}%
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHudScale(prev => Math.min(150, prev + 10));
                            }}
                            className="text-gray-400 hover:text-white px-0.5 font-bold cursor-pointer transition hover:bg-gray-800 rounded"
                            title="Увеличить масштаб таблицы (+10%)"
                          >
                            +
                          </button>
                        </div>
                        {/* Settings Gear Button for HUD Options */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsUserSettingsModalOpen(true);
                          }}
                          className="text-gray-400 hover:text-amber-300 p-0.5 rounded cursor-pointer ml-0.5 hover:bg-gray-800 transition"
                          title="Настройки таблицы HUD (шрифт, масштаб, позиция, алерты)"
                        >
                          <Settings className="h-3 w-3" />
                        </button>
                        {/* Minimize / Collapse Button (in place of old close button) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsHudMinimized(true);
                          }}
                          className="text-cyan-400 hover:text-white hover:bg-cyan-500/20 p-1 rounded cursor-pointer ml-0.5 transition"
                          title="Свернуть таблицу HUD (освободить график)"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Table Content (Complete 11 Rows Matching Pine Script & GEX - all rows visible without scrolling) */}
                    <div className="p-2.5 space-y-1 divide-y divide-gray-800/80">
                      {/* Row 1: 🎯 СЕГОДНЯ & СТАТУС */}
                      <div className="pt-1 flex items-center justify-between gap-1">
                        <span className="text-gray-400 font-bold shrink-0">🎯 СЕГОДНЯ:</span>
                        <span
                          className="font-bold px-1.5 py-0.5 rounded text-[10px] text-right truncate"
                          style={{
                            backgroundColor: indicatorOutput?.forecast.isPlanBActive
                              ? "rgba(239, 68, 68, 0.2)"
                              : indicatorOutput?.forecast.leg3Hit
                              ? "rgba(16, 185, 129, 0.2)"
                              : indicatorOutput?.forecast.leg2Hit
                              ? "rgba(56, 189, 248, 0.2)"
                              : indicatorOutput?.forecast.leg1Hit
                              ? "rgba(251, 191, 36, 0.2)"
                              : "rgba(245, 158, 11, 0.2)",
                            color: indicatorOutput?.hud.recCol || "#ffffff"
                          }}
                        >
                          {indicatorOutput?.hud.recActionStr ||
                            `⏳ Ждём вход @${indicatorOutput?.forecast.p1Entry?.toFixed(1) ?? (candles && candles.length > 0 ? candles[candles.length - 1]?.close?.toFixed(1) : "-")} (${indicatorOutput?.forecast.isBull ? "LONG" : "SHORT"})`}
                        </span>
                      </div>

                      {/* Row 2: 📍 ПОЗИЦИЯ & УРОВНИ ВХОДА / ВЫХОДА */}
                      <div className="pt-1 flex items-center justify-between text-[10.5px]">
                        <span className="text-gray-400 font-bold flex items-center gap-1 shrink-0">
                          <span>📍 Позиция:</span>
                          <span className={`px-1 py-0.2 rounded text-[9.5px] font-bold ${
                            indicatorOutput?.forecast.isBull
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          }`}>
                            {indicatorOutput?.forecast.isBull ? "LONG" : "SHORT"} ({indicatorOutput?.forecast.probability || 84}%)
                          </span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-right">
                          <span className="text-gray-300" title="Точка входа">
                            Вход: <strong className="text-white">{indicatorOutput?.forecast.p1Entry?.toFixed(1) ?? "-"}</strong>
                          </span>
                          <span className="text-emerald-400" title="Тейк-профит 1">
                            TP1: <strong>{indicatorOutput?.forecast.p2Tp1?.toFixed(1) ?? "-"}</strong>
                          </span>
                          <span className="text-cyan-400" title="Тейк-профит 2">
                            TP2: <strong>{indicatorOutput?.forecast.p3Tp2?.toFixed(1) ?? "-"}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Row 3: 🛡️ СТОП & ТРЕЙЛИНГ */}
                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span className="text-gray-400 shrink-0">🛡️ Защита &amp; SL:</span>
                        <div className="flex items-center gap-1.5 text-right font-mono">
                          <span className="text-rose-400 font-bold">
                            SL: {indicatorOutput?.forecast.activeTrailingSl?.toFixed(1) || indicatorOutput?.forecast.invalidLevelSl?.toFixed(1) || "-"}
                          </span>
                          <span className="text-amber-300 text-[9.5px] bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/30">
                            {indicatorOutput?.forecast.trailingStageStr || "🛡️ Начальный SL"}
                          </span>
                          {indicatorOutput?.forecast.altTp1 && (
                            <span className="text-gray-400 text-[9px] hidden sm:inline" title="План Б при сломе стопа">
                              (План Б: {indicatorOutput.forecast.altTp1.toFixed(1)})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 4: 🏛️ Сила рынка & Режим GEX */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">🏛️ Сила рынка:</span>
                        <span
                          className="font-bold text-[10px] text-right truncate"
                          style={{ color: indicatorOutput?.hud.gexRegimeCol || "#10b981" }}
                        >
                          {indicatorOutput?.hud.gexRegimeStr ||
                            (gexReport?.netGexRegime === "POSITIVE_GAMMA"
                              ? "🟢 Положительная Гамма — дилеры гасят движение"
                              : "🔴 Отрицательная Гамма — дилеры ускоряют тренд")}
                        </span>
                      </div>

                      {/* Row 5: 🎯 Куда идёт (Стены Дилеров) */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">🎯 Куда идёт:</span>
                        <span
                          className="font-bold text-[10px] text-right truncate"
                          style={{ color: indicatorOutput?.hud.dayTargetCol || "#10b981" }}
                        >
                          {indicatorOutput?.hud.dayTargetStr ||
                            `🏰 Потолок ${dayGexReport?.callWall || gexReport?.callWall || 4200} | 🎯 Магнит ${dayGexReport?.maxPain || gexReport?.maxPain || 4150} | 🛡️ ${dayGexReport?.putWall || gexReport?.putWall || 4100}`}
                        </span>
                      </div>

                      {/* Row 6: 📐 Дневной коридор ММ (68% и 95%) */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">📐 Дневной коридор:</span>
                        <span className="text-[#38bdf8] font-bold text-[10px] text-right">
                          {indicatorOutput?.hud.dayRangeTxt
                            ? `${indicatorOutput.hud.dayRangeTxt} | 68% вероят.`
                            : `${(dayGexReport?.expectedMove68.low || gexReport?.expectedMove68.low || 4110).toFixed(1)}–${(dayGexReport?.expectedMove68.high || gexReport?.expectedMove68.high || 4210).toFixed(1)} | 68%`}
                        </span>
                      </div>

                      {/* Row 7: 📈 Контекст & Скорость */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">📈 Контекст:</span>
                        <span className="text-amber-300 font-semibold text-[10px] text-right truncate">
                          {indicatorOutput?.hud.speedStr || indicatorOutput?.hud.dowVerdictStr ||
                            `⚡ Ускорение тренда | ${dayOfWeekInfo.dowEmoji} ${dayOfWeekInfo.dowVerdict}`}
                        </span>
                      </div>

                      {/* Row 8: 📊 Направление рынка & Уклон */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">📊 Уклон:</span>
                        <span
                          className="font-bold text-[10px] text-right truncate"
                          style={{ color: indicatorOutput?.hud.dayBiasCol || "#10b981" }}
                        >
                          {indicatorOutput?.hud.dayBiasStr || "🟢 Уклон LONG (Гамма↑ + Макро↑) | Бычий 80%"}
                        </span>
                      </div>

                      {/* Row 9: 📊 Δ Поток (Delta / CVD) */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">📊 Δ Поток:</span>
                        <span className="font-bold text-[10px] text-right font-mono" style={{ color: indicatorOutput?.hud.flowsDeltaCol || "#10b981" }}>
                          {indicatorOutput?.hud.flowsDeltaStr ||
                            `${volumeDeltaState.isPositive ? "🟢" : "🔴"} Δ ${volumeDeltaState.delta} | CVD ↑ +3.8K`}
                        </span>
                      </div>

                      {/* Row 10: 📊 PCR & Vol */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">📊 PCR / Vol:</span>
                        <span className="text-amber-300 font-bold text-[10px] text-right font-mono" style={{ color: indicatorOutput?.hud.pcrRvCol || "#f59e0b" }}>
                          {indicatorOutput?.hud.pcrRvFull ||
                            `PCR ${(dayGexReport?.pcrOi || gexReport?.pcrOi || 0.85).toFixed(2)}🤖 | Vol ${(dayGexReport?.impliedVolAvg || gexReport?.impliedVolAvg || 0.85).toFixed(1)}%🤖`}
                        </span>
                      </div>

                      {/* Row 11: 🔬 GEX Audit */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-gray-400 shrink-0">🔬 GEX Audit:</span>
                        <span className="text-cyan-300 font-bold text-[10px] text-right font-mono" style={{ color: indicatorOutput?.hud.auditCol || "#06b6d4" }}>
                          {indicatorOutput?.hud.auditStr || "🎯 CW 78% | PW 82% | Flip 74% (n=142)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* 🎚️ Vertical Split Drag Resizer between Chart and AI Analyst (Desktop only) */}
            {!isAiPanelCollapsed && (
              <div
                onMouseDown={handleStartResizeAi}
                onTouchStart={handleStartResizeAi}
                className={`hidden md:flex w-1.5 h-full cursor-col-resize hover:bg-cyan-500/50 active:bg-cyan-400 transition-colors z-20 shrink-0 relative items-center justify-center select-none bg-gray-900 border-l border-r border-gray-800 ${
                  isDraggingAiWidth ? "bg-cyan-500 shadow-md shadow-cyan-500/50" : ""
                }`}
                title="Зажмите и тяните влево/вправо для изменения ширины панели ИИ-Аналитика"
              >
                <div className="h-8 w-0.5 rounded-full bg-gray-500 group-hover:bg-cyan-300" />
              </div>
            )}

            {/* Mobile Backdrop when AI Analyst Drawer is Open */}
            {!isAiPanelCollapsed && (
              <div
                onClick={() => setIsAiPanelCollapsed(true)}
                className="md:hidden fixed inset-0 bg-black/60 z-40"
              />
            )}

            {/* 🤖 AUTONOMOUS AI ANALYST (Full-width chart on mobile with slide-over drawer; docked on desktop) */}
            <div
              className={`${
                isAiPanelCollapsed
                  ? "hidden md:flex h-full shrink-0 relative z-10"
                  : "fixed inset-y-0 right-0 z-50 md:static md:z-10 flex h-full shrink-0 shadow-2xl md:shadow-none"
              }`}
              style={{
                width: isAiPanelCollapsed ? "48px" : `${aiPanelWidth}px`,
                maxWidth: isAiPanelCollapsed ? "48px" : "calc(100vw - 24px)"
              }}
            >
              <AutonomousAiAnalystPanel
                currentUser={propUser}
                activeAsset={activeAsset}
                activeTf={activeTf}
                currentPrice={latestCandle ? latestCandle.close : (activeAsset.includes("GOLD") || activeAsset.includes("XAU") ? 4006.0 : 67800.0)}
                candles={candles}
                indicatorOutput={indicatorOutput}
                gexReport={gexReport}
                dayGexReport={dayGexReport}
                calendarEvents={calendarEvents}
                newsItems={marketNews}
                isNewsLoading={isNewsLoading}
                onRefreshNews={refreshMarketNews}
                isCollapsed={isAiPanelCollapsed}
                onToggleCollapse={() => setIsAiPanelCollapsed(!isAiPanelCollapsed)}
                onOpenSettingsTab={() => {
                  setSettingsInitialSection("ai");
                  setActiveTab("settings");
                }}
                width={aiPanelWidth}
                onWidthChange={(w) => {
                  setAiPanelWidth(w);
                  try {
                    localStorage.setItem("quantex_ai_panel_width", String(w));
                  } catch {}
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. REAL-TIME GEX ANALYTICS TAB                           */}
        {/* ======================================================== */}
        {activeTab === "gex" && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            
            {/* Header & Source Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white shadow-md shadow-purple-500/20">
                    <Activity className="h-4 w-4" />
                  </div>
                  <h3 className="font-display font-bold text-base text-white tracking-wide flex items-center gap-2">
                    <span>Опционная GEX-Аналитика &amp; Стены Дилеров</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {activeAsset === "MOEX_GOLD"
                        ? `${moexContracts?.large?.secId || "GDZ6"} (FORTS)`
                        : activeAsset === "MOEX_MINI"
                        ? `${moexContracts?.mini?.secId || "GNZ6"} (Мини)`
                        : activeAsset === "XAUUSD"
                        ? "XAU/USD OANDA (24/7 Spot)"
                        : activeAsset}
                    </span>
                  </h3>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CME &amp; FORTS Institutional Flow
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Прямой расчет распределения дилерской Гаммы (Gamma Exposure), открытого интереса (OI), объемов торгов и магнитов экспирации
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setUseGex(true);
                    setShowGexWalls(true);
                    setShowGexFlip(true);
                    setShowGexPain(true);
                    setShowGexBars(true);
                    setActiveTab("chart");
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-md shadow-purple-600/20"
                  title="Открыть свечной график с автоматически наложенными линиями Call Wall, Put Wall, Gamma Flip и профилем"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>🕯️ Смотреть GEX на графике свечей</span>
                </button>

                <button
                  onClick={() => fetchGexReport(activeAsset, gexHorizon)}
                  disabled={isLoadingGex}
                  className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingGex ? "animate-spin text-purple-400" : ""}`} />
                  <span>Обновить GEX</span>
                </button>
              </div>
            </div>

            {/* Horizon Selection Bar (ДЕНЬ, НЕДЕЛЯ, МЕСЯЦ, ВСЕ) */}
            <div className="bg-[#0b0e17] border border-gray-800/90 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Горизонт экспирации опционов:
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Определяет плотность страйков, положение стен и открытый интерес
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#121624] p-1 rounded-xl border border-gray-800 text-xs font-semibold flex-wrap">
                <button
                  onClick={() => handleSelectGexHorizon("DAY")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    gexHorizon === "DAY"
                      ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-md shadow-amber-500/25"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="0DTE / Интрадей: ближайшие внутридневные опционы с шагом 5-10$ прямо у текущей цены"
                >
                  <span>⚡</span>
                  <span>ДЕНЬ (Интрадей)</span>
                </button>

                <button
                  onClick={() => handleSelectGexHorizon("WEEK")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    gexHorizon === "WEEK"
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md shadow-purple-500/25"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="Недельная серия: экспирация текущей пятницы — основной коридор для свингов на 2-5 дней"
                >
                  <span>📅</span>
                  <span>НЕДЕЛЯ (Свинг)</span>
                </button>

                <button
                  onClick={() => handleSelectGexHorizon("MONTH")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    gexHorizon === "MONTH"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-md shadow-cyan-500/25"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="Месячная серия: институциональные позиции фондов и хеджеров (шаг 20-25$)"
                >
                  <span>🗓️</span>
                  <span>МЕСЯЦ (Фонды)</span>
                </button>

                <button
                  onClick={() => handleSelectGexHorizon("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    gexHorizon === "ALL"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md shadow-emerald-500/25"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title="Все экспирации: совокупный открытый интерес всех серий книги заявок"
                >
                  <span>🌐</span>
                  <span>ВСЕ (Total GEX)</span>
                </button>
              </div>
            </div>

            {/* GEX Metrics Grid */}
            {gexReport ? (
              <div className="space-y-6">
                {/* 🟢/⚠️ Live Options / Synthetic Badge Banner */}
                {gexReport.source && (gexReport.source.includes("CBOE") || gexReport.source.includes("Yahoo Finance Real Options") || gexReport.source.includes("Real Option")) ? (
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-300 text-xs shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="font-extrabold text-white text-xs sm:text-sm tracking-wide">
                        🟢 Live Options (Реальные данные)
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-200 rounded border border-emerald-500/40 font-bold hidden sm:inline">
                        {gexReport.source.includes("CBOE") ? "CBOE Institutional Feed" : "Yahoo Finance"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400/80 truncate max-w-xs hidden md:inline">
                      {gexReport.source}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-amber-300 text-xs sm:text-sm tracking-wide">
                        ⚠️ Синтетическая модель (Резервный режим)
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/25 text-amber-300 rounded border border-amber-500/50 font-bold hidden sm:inline">
                        Реальный API недоступен
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400/80">
                      Спот: ${(gexReport.spotPrice || 4043).toFixed(1)}
                    </span>
                  </div>
                )}

                {/* 🎯 0. САМЫЙ ВЕРХНИЙ БЛОК ПРОГНОЗА: QUANT GEX PROBABILITY ENGINE & VISUAL CONE */}
                <GexProbabilityHero
                  gexReport={gexReport}
                  candles={candles}
                  activeAsset={activeAsset}
                />
                
                {/* 4 Key Institutional Diagnostic Cards (With Concise '⚡ Сейчас для цены' & Compact Tooltips) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  {/* Card 1: Net GEX Regime (OI + Volume) */}
                  <div className="bg-[#0b0e17] border border-gray-800/90 rounded-xl p-3.5 flex flex-col justify-between gap-2 relative overflow-hidden">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Режим Дилеров</span>
                        <span className="text-[10px] text-cyan-400 font-mono">OI + Volume GEX</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded inline-block ${
                            gexReport.netGexRegime === "POSITIVE_GAMMA"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          }`}
                        >
                          {gexReport.netGexRegime === "POSITIVE_GAMMA" ? "🟢 +GEX (ШТИЛЬ)" : "🔴 -GEX (ШТОРМ)"}
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          {gexReport.netGexTotal > 0 ? `+${gexReport.netGexTotal}` : gexReport.netGexTotal} $M
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#101522] border border-gray-800/90 text-[11px] text-gray-200 leading-snug">
                      <b className="text-amber-300">⚡ Сейчас для цены:</b>{" "}
                      {gexReport.netGexRegime === "POSITIVE_GAMMA"
                        ? `Ложные пробои гасятся дилерами — работаем от границ $${gexReport.putWall}–$${gexReport.callWall} к магниту $${gexReport.maxPain}.`
                        : `Дилеры хеджируют по тренду — пробой уровней вызывает быстрый импульс без откатов.`}
                    </div>

                    <details className="group text-[10px] text-gray-400">
                      <summary className="cursor-pointer select-none text-gray-400 hover:text-white font-mono flex items-center justify-between">
                        <span>ℹ️ Суть метрики Net GEX</span>
                        <span className="group-open:rotate-180 transition-transform">▾</span>
                      </summary>
                      <p className="mt-1 text-gray-300 bg-black/40 p-2 rounded border border-gray-800 leading-relaxed">
                        Учитывает открытый интерес (OI) и внутридневной объем (Volume). В +GEX маркетмейкеры продают на росте и покупают на падении; в -GEX — усиливают направленный импульс.
                      </p>
                    </details>
                  </div>

                  {/* Card 2: Потолок (CW) */}
                  {(() => {
                    const cwRoleInfo = getLevelRole("CALL_WALL", gexReport.callWall, gexReport.spotPrice, gexReport.horizon);
                    return (
                      <div className="bg-[#0b0e17] border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between gap-2 relative overflow-hidden shadow-sm shadow-emerald-500/5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              🏰 {cwRoleInfo.baseName} ({getExpirySuffix(gexReport.horizon)})
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              cwRoleInfo.isBroken ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {cwRoleInfo.isBroken ? "ПРОБИТ ВВЕРХ" : `+${(((gexReport.callWall - gexReport.spotPrice) / gexReport.spotPrice) * 100).toFixed(2)}%`}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div className="text-2xl font-mono font-bold text-emerald-400">
                              {activeAsset === "MOEX_MINI" ? `${gexReport.callWall} ₽` : `$${gexReport.callWall}`}
                            </div>
                            <span className="text-[11px] font-mono text-emerald-300">
                              Дист: {gexReport.spotPrice > gexReport.callWall ? "-" : "+"}${Math.abs(gexReport.callWall - gexReport.spotPrice).toFixed(1)}
                            </span>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-emerald-950/25 border border-emerald-500/25 text-[11px] text-emerald-100 leading-snug">
                          <div className="flex items-center gap-1.5 mb-1">
                            <b className="text-emerald-300">Роль:</b>
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                              cwRoleInfo.isBroken ? "bg-amber-500/25 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                            }`}>
                              {cwRoleInfo.role}
                            </span>
                          </div>
                          {cwRoleInfo.isBroken
                            ? `Цена пробила уровень Потолок (CW) вверх. Теперь уровень действует как зеркальная поддержка при откате.`
                            : gexReport.callWall - gexReport.spotPrice <= 8
                            ? `Цена вплотную у потолка $${gexReport.callWall} — высокая вероятность торможения и отката, либо сквиза при закреплении выше.`
                            : `Главный целевой барьер сверху ($${gexReport.callWall}), где фиксируются лонги и включается продажа дилеров.`}
                        </div>

                        <details className="group text-[10px] text-gray-400">
                          <summary className="cursor-pointer select-none text-gray-400 hover:text-white font-mono flex items-center justify-between">
                            <span>ℹ️ Суть Потолка (CW)</span>
                            <span className="group-open:rotate-180 transition-transform">▾</span>
                          </summary>
                          <p className="mt-1 text-gray-300 bg-black/40 p-2 rounded border border-gray-800 leading-relaxed">
                            Страйк с максимальной гаммой и объемом Call выше спота. За его пределами сосредоточены стопы шортистов (Buy-Side Liquidity).
                          </p>
                        </details>
                      </div>
                    );
                  })()}

                  {/* Card 3: Пол (PW) */}
                  {(() => {
                    const pwRoleInfo = getLevelRole("PUT_WALL", gexReport.putWall, gexReport.spotPrice, gexReport.horizon);
                    return (
                      <div className="bg-[#0b0e17] border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between gap-2 relative overflow-hidden shadow-sm shadow-rose-500/5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              🛡️ {pwRoleInfo.baseName} ({getExpirySuffix(gexReport.horizon)})
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              pwRoleInfo.isBroken ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-rose-500/20 text-rose-300"
                            }`}>
                              {pwRoleInfo.isBroken ? "ПРОБИТ ВНИЗ" : `-${(((gexReport.spotPrice - gexReport.putWall) / gexReport.spotPrice) * 100).toFixed(2)}%`}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div className="text-2xl font-mono font-bold text-rose-400">
                              {activeAsset === "MOEX_MINI" ? `${gexReport.putWall} ₽` : `$${gexReport.putWall}`}
                            </div>
                            <span className="text-[11px] font-mono text-rose-300">
                              Дист: {gexReport.spotPrice < gexReport.putWall ? "+" : "-"}${Math.abs(gexReport.spotPrice - gexReport.putWall).toFixed(1)}
                            </span>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-rose-950/25 border border-rose-500/25 text-[11px] text-rose-100 leading-snug">
                          <div className="flex items-center gap-1.5 mb-1">
                            <b className="text-rose-300">Роль:</b>
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                              pwRoleInfo.isBroken ? "bg-rose-500/25 text-rose-200" : "bg-emerald-500/20 text-emerald-200"
                            }`}>
                              {pwRoleInfo.role}
                            </span>
                          </div>
                          {pwRoleInfo.isBroken
                            ? `Цена пробила уровень Пол (PW) вниз. Теперь уровень выступает как жесткое сопротивление (бывшая поддержка).`
                            : gexReport.spotPrice - gexReport.putWall <= 8
                            ? `Цена тестирует защиту $${gexReport.putWall} — зона лимитного выкупа дилерами (стоп выносить за ATR-буфер).`
                            : `Институциональное дно на $${gexReport.putWall}: проливы к уровню встречают алгоритмический откуп.`}
                        </div>

                        <details className="group text-[10px] text-gray-400">
                          <summary className="cursor-pointer select-none text-gray-400 hover:text-white font-mono flex items-center justify-between">
                            <span>ℹ️ Суть Пола (PW)</span>
                            <span className="group-open:rotate-180 transition-transform">▾</span>
                          </summary>
                          <p className="mt-1 text-gray-300 bg-black/40 p-2 rounded border border-gray-800 leading-relaxed">
                            Страйк максимальной концентрации Put-опционов ниже спота. Закрытие путов при подходе цены вынуждает дилеров выкупать фьючерс.
                          </p>
                        </details>
                      </div>
                    );
                  })()}

                  {/* Card 4: Флип (Flip) & Магнит */}
                  {(() => {
                    const flipRoleInfo = getLevelRole("GAMMA_FLIP", gexReport.gammaFlip, gexReport.spotPrice, gexReport.horizon);
                    const painRoleInfo = getLevelRole("MAX_PAIN", gexReport.maxPain, gexReport.spotPrice, "MONTH");
                    return (
                      <div className="bg-[#0b0e17] border border-purple-500/30 rounded-xl p-3.5 flex flex-col justify-between gap-2 relative overflow-hidden">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              ⚡ {flipRoleInfo.baseName} &amp; {painRoleInfo.baseName}
                            </span>
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              Магнит: ${gexReport.maxPain}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div className="text-2xl font-mono font-bold text-purple-400">
                              {activeAsset === "MOEX_MINI" ? `${gexReport.gammaFlip} ₽` : `$${gexReport.gammaFlip}`}
                            </div>
                            <span className={`text-[10px] font-mono font-bold ${gexReport.spotPrice >= gexReport.gammaFlip ? "text-emerald-400" : "text-rose-400"}`}>
                              {gexReport.spotPrice >= gexReport.gammaFlip ? "Выше Flip (+GEX)" : "Ниже Flip (-GEX)"}
                            </span>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-purple-950/25 border border-purple-500/25 text-[11px] text-purple-100 leading-snug">
                          <b className="text-purple-300">⚡ Роль и динамика:</b>{" "}
                          {gexReport.spotPrice >= gexReport.gammaFlip
                            ? `Цена выше Флипа $${gexReport.gammaFlip} (+GEX) — приоритет возврата к балансу Магнита $${gexReport.maxPain}.`
                            : `Цена ниже Флипа $${gexReport.gammaFlip} (-GEX) — риск ускорения распродаж к Полу (PW) $${gexReport.putWall}.`}
                        </div>

                        <details className="group text-[10px] text-gray-400">
                          <summary className="cursor-pointer select-none text-gray-400 hover:text-white font-mono flex items-center justify-between">
                            <span>ℹ️ Суть Флипа и Магнита</span>
                            <span className="group-open:rotate-180 transition-transform">▾</span>
                          </summary>
                          <p className="mt-1 text-gray-300 bg-black/40 p-2 rounded border border-gray-800 leading-relaxed">
                            Флип (Zero-Flip) разграничивает зоны рыночной волатильности (+GEX и -GEX). Магнит (Max Pain) — страйк, к которому цена тяготеет к моменту экспирации.
                          </p>
                        </details>
                      </div>
                    );
                  })()}
                </div>

                {/* Additional Institutional Flow Bar (PCR & IV vs RV with Live Price Action Takeaways) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-[#080b12] border border-gray-800/80 rounded-xl p-3 text-xs font-mono">
                  <div className="flex flex-col justify-between p-2 rounded-lg bg-[#0d111c] border border-gray-800/70">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px] uppercase">Put/Call Ratio (OI)</span>
                      <span className={`font-bold text-xs ${gexReport.pcrOi > 1.0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {gexReport.pcrOi.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10.5px] font-sans text-gray-300 mt-1">
                      <b className="text-cyan-300">⚡ Сейчас:</b>{" "}
                      {gexReport.pcrOi > 1.15
                        ? "Рынок перегружен путами (хедж) — прочный пол Put Wall."
                        : gexReport.pcrOi < 0.85
                        ? "Перевес коллов — сильное сопротивление у Call Wall."
                        : "Баланс открытого интереса нейтрален."}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between p-2 rounded-lg bg-[#0d111c] border border-gray-800/70">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px] uppercase">Put/Call (Объем торгов)</span>
                      <span className={`font-bold text-xs ${(gexReport.pcrVol || 0.94) > 1.0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {(gexReport.pcrVol || 0.94).toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10.5px] font-sans text-gray-300 mt-1">
                      <b className="text-cyan-300">⚡ Сейчас:</b>{" "}
                      {(gexReport.pcrVol || 0.94) > 1.1
                        ? "Агрессивная покупка Put внутри дня — давление продавцов."
                        : "Внутридневной поток в пользу Call — спрос на рост."}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between p-2 rounded-lg bg-[#0d111c] border border-gray-800/70">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px] uppercase">IV vs RV Волатильность</span>
                      <span className="font-bold text-xs text-amber-300">
                        IV {gexReport.impliedVolAvg.toFixed(1)}% / RV {gexReport.realizedVol30d.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[10.5px] font-sans text-gray-300 mt-1">
                      <b className="text-amber-300">⚡ Сейчас:</b>{" "}
                      {gexReport.impliedVolAvg > gexReport.realizedVol30d + 1.5
                        ? `IV > RV (+${(gexReport.impliedVolAvg - gexReport.realizedVol30d).toFixed(1)}%): опционы дорогие — рынок ждёт импульс или схлопывание IV к Max Pain.`
                        : gexReport.impliedVolAvg < gexReport.realizedVol30d - 1.0
                        ? `IV < RV: опционы недооценены — идет активный тренд с расширением диапазона.`
                        : `IV ≈ RV: волатильность в равновесии, движение в рамках 1σ.`}
                    </span>
                  </div>

                  <div className="flex flex-col justify-between p-2 rounded-lg bg-[#0d111c] border border-gray-800/70">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px] uppercase">Коридор 1σ (68% вер.)</span>
                      <span className="font-bold text-xs text-cyan-300">
                        ±{gexReport.expectedMove68.rangePct}%
                      </span>
                    </div>
                    <span className="text-[10.5px] font-sans text-gray-300 mt-1">
                      <b className="text-cyan-300">⚡ Сейчас:</b> Расчетный диапазон сессии{" "}
                      <b className="text-white font-mono">${gexReport.expectedMove68.low}–${gexReport.expectedMove68.high}</b>.
                    </span>
                  </div>
                </div>


                {/* ======================================================== */}
                {/* 1. САМЫЙ ВЕРХНИЙ БЛОК: Двусторонний Профиль Гаммы, ОИ и Объемов */}
                {/* ======================================================== */}
                <div className="bg-[#080a11] border border-gray-800/90 rounded-2xl p-4 md:p-5 space-y-4 shadow-2xl">
                  
                  {/* Controls Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-cyan-400" />
                        <h4 className="font-bold text-sm text-white">
                          Двусторонний Профиль Гаммы, Открытого Интереса и Объемов
                        </h4>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Вертикальная шкала цен: <b className="text-emerald-400">вверху высокие цены (сопротивление)</b>, <b className="text-rose-400">внизу низкие цены (поддержка)</b>. Кликните по любому страйку для подробного анализа.
                      </p>
                    </div>

                    {/* Filter & Metric Switchers */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Metric Mode */}
                      <div className="flex items-center bg-[#101420] p-0.5 rounded-lg border border-gray-800 text-xs">
                        <button
                          onClick={() => setGexMetricMode("gex")}
                          className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            gexMetricMode === "gex"
                              ? "bg-purple-600/40 text-purple-200 border border-purple-500/60 shadow-xs"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Гамма ($M/pt)
                        </button>
                        <button
                          onClick={() => setGexMetricMode("oi")}
                          className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            gexMetricMode === "oi"
                              ? "bg-cyan-600/40 text-cyan-200 border border-cyan-500/60 shadow-xs"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Открытый интерес (OI)
                        </button>
                        <button
                          onClick={() => setGexMetricMode("volume")}
                          className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            gexMetricMode === "volume"
                              ? "bg-emerald-600/40 text-emerald-200 border border-emerald-500/60 shadow-xs"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Объем (Volume)
                        </button>
                      </div>

                      {/* Strike Filter Mode */}
                      <div className="flex items-center bg-[#101420] p-0.5 rounded-lg border border-gray-800 text-xs">
                        <button
                          onClick={() => setGexFilterMode("atm")}
                          className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            gexFilterMode === "atm"
                              ? "bg-amber-500/30 text-amber-200 border border-amber-500/50"
                              : "text-gray-400 hover:text-white"
                          }`}
                          title="Около денег (ATM ±3.5%) — наиболее активные для внутридневной торговли"
                        >
                          ATM (±3.5%)
                        </button>
                        <button
                          onClick={() => setGexFilterMode("walls")}
                          className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            gexFilterMode === "walls"
                              ? "bg-amber-500/30 text-amber-200 border border-amber-500/50"
                              : "text-gray-400 hover:text-white"
                          }`}
                          title="Только ключевые опционные стены (Call Wall, Put Wall, Flip, Max Pain)"
                        >
                          Только Стены
                        </button>
                        <button
                          onClick={() => setGexFilterMode("all")}
                          className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                            gexFilterMode === "all"
                              ? "bg-amber-500/30 text-amber-200 border border-amber-500/50"
                              : "text-gray-400 hover:text-white"
                          }`}
                          title="Все страйковые уровни цепочки"
                        >
                          Все страйки ({gexReport.strikes?.length || 0})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Visual Chart Header Columns */}
                  <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 rounded-lg bg-[#0e121c] border border-gray-800/80 text-[10px] sm:text-[11px] font-mono text-gray-400">
                    <div className="flex items-center gap-1 text-rose-400 font-bold text-[9.5px] sm:text-xs">
                      <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block shrink-0" />
                      <span>
                        {gexMetricMode === "volume"
                          ? "◀ PUT VOL"
                          : gexMetricMode === "oi"
                          ? "◀ PUT OI"
                          : "◀ PUT GEX"}
                      </span>
                    </div>
                    <div className="text-center font-bold text-gray-200 text-[10px] sm:text-xs tracking-wider shrink-0">
                      СТРАЙК
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 font-bold text-[9.5px] sm:text-xs">
                      <span>
                        {gexMetricMode === "volume"
                          ? "CALL VOL ▶"
                          : gexMetricMode === "oi"
                          ? "CALL OI ▶"
                          : "CALL GEX ▶"}
                      </span>
                      <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block shrink-0" />
                    </div>
                  </div>

                  {/* Profile Rows (Top to Bottom: Strictly Descending Strike Price) */}
                  <div className="space-y-1 w-full max-w-full max-h-[580px] overflow-y-auto pr-0.5">
                    {gexStrikesDescending.map((s) => {
                      const isCallWall = s.strike === gexReport.callWall;
                      const isPutWall = s.strike === gexReport.putWall;
                      const isZeroFlip = s.strike === gexReport.gammaFlip;
                      const isMaxPain = s.strike === gexReport.maxPain;
                      const isSleeperMagnet = s.strike === gexReport.sleeperMagnet;
                      const isExactSpotStrike = s.strike === closestStrikeToSpot;

                      const putVal = gexMetricMode === "volume" ? (s.putVolume || 0) : gexMetricMode === "oi" ? s.putOi : Math.abs(s.putGex);
                      const callVal = gexMetricMode === "volume" ? (s.callVolume || 0) : gexMetricMode === "oi" ? s.callOi : s.callGex;

                      const putWidthPct = Math.min((putVal / maxAbsGex) * 100, 100);
                      const callWidthPct = Math.min((callVal / maxAbsGex) * 100, 100);

                      const distFromSpotPct = ((s.strike - gexReport.spotPrice) / gexReport.spotPrice) * 100;

                      return (
                        <div
                          key={s.strike}
                          onClick={() => setSelectedStrikeDetail(s)}
                          className={`flex items-center gap-1 sm:gap-2 py-1 px-1 sm:px-2 rounded-lg font-mono text-xs transition cursor-pointer relative group ${
                            isExactSpotStrike
                              ? "bg-amber-500/15 border border-amber-400/80 shadow-md shadow-amber-500/10"
                              : isCallWall
                              ? "bg-emerald-500/20 border border-emerald-400 shadow-md shadow-emerald-500/15"
                              : isPutWall
                              ? "bg-rose-500/20 border border-rose-400 shadow-md shadow-rose-500/15"
                              : isZeroFlip
                              ? "bg-purple-500/20 border border-purple-400/80 shadow-md shadow-purple-500/15"
                              : isMaxPain
                              ? "bg-cyan-500/20 border border-cyan-400/80 shadow-md shadow-cyan-500/15"
                              : isSleeperMagnet
                              ? "bg-amber-500/20 border border-amber-400/80 shadow-md shadow-amber-500/15"
                              : "hover:bg-[#121624] border border-transparent"
                          }`}
                        >
                          {/* Left: Put Bar (Grows from Center to Left) */}
                          <div className="flex-1 min-w-0 flex justify-end items-center h-5 sm:h-6 bg-[#0a0d16] rounded-l-md overflow-hidden border-r border-gray-700 relative">
                            <div
                              className={`h-full transition-all flex items-center justify-start pl-1 text-[9px] sm:text-[10px] font-bold text-white/90 ${
                                isPutWall
                                  ? "bg-gradient-to-l from-rose-500 via-rose-600 to-rose-700 shadow-sm shadow-rose-500/50"
                                  : "bg-gradient-to-l from-rose-600 to-rose-900"
                              }`}
                              style={{ width: `${putWidthPct}%` }}
                            >
                              {putWidthPct > 25 && (
                                <span className="drop-shadow-xs truncate">
                                  {gexMetricMode === "volume"
                                    ? `${(s.putVolume || 0).toLocaleString()}`
                                    : gexMetricMode === "oi"
                                    ? `${s.putOi.toLocaleString()}`
                                    : `${s.putGex}`}
                                </span>
                              )}
                            </div>
                            {putWidthPct <= 25 && (
                              <span className="text-[9px] sm:text-[10px] text-gray-500 pr-1 font-mono truncate hidden xs:inline">
                                {gexMetricMode === "volume"
                                  ? `${(s.putVolume || 0).toLocaleString()}`
                                  : gexMetricMode === "oi"
                                  ? `${s.putOi.toLocaleString()}`
                                  : `${s.putGex}`}
                              </span>
                            )}
                          </div>

                          {/* Center: Strike Price Column with Badges */}
                          <div className="w-20 sm:w-56 md:w-64 flex items-center justify-between px-1 sm:px-2.5 shrink-0 bg-[#0e121d] py-0.5 sm:py-1 rounded-md border border-gray-800 shadow-inner">
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`font-bold text-xs sm:text-sm ${
                                isCallWall
                                  ? "text-emerald-400 font-extrabold"
                                  : isPutWall
                                  ? "text-rose-400 font-extrabold"
                                  : isZeroFlip
                                  ? "text-purple-300 font-extrabold"
                                  : isMaxPain
                                  ? "text-cyan-300 font-extrabold"
                                  : isSleeperMagnet
                                  ? "text-amber-400 font-extrabold"
                                  : isExactSpotStrike
                                  ? "text-amber-300 font-extrabold"
                                  : "text-gray-200"
                              }`}>
                                {activeAsset === "MOEX_MINI" ? `${s.strike} ₽` : `$${s.strike}`}
                              </span>
                              <span className={`text-[8.5px] sm:text-[10px] font-mono hidden sm:inline ${distFromSpotPct > 0 ? "text-emerald-400/80" : distFromSpotPct < 0 ? "text-rose-400/80" : "text-amber-400"}`}>
                                {distFromSpotPct > 0 ? `+${distFromSpotPct.toFixed(1)}%` : `${distFromSpotPct.toFixed(1)}%`}
                              </span>
                            </div>

                            {/* Badges Container */}
                            <div className="flex items-center gap-0.5 sm:gap-1 justify-end flex-wrap max-w-[155px]">
                              {isCallWall && (
                                <span className="text-[8px] sm:text-[9px] bg-emerald-500 text-black font-extrabold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase tracking-wider shadow-xs" title="Потолок рынка (Call Wall)">
                                  <span className="sm:hidden">CW</span>
                                  <span className="hidden sm:inline">Потолок CW</span>
                                </span>
                              )}
                              {isPutWall && (
                                <span className="text-[8px] sm:text-[9px] bg-rose-500 text-white font-extrabold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase tracking-wider shadow-xs" title="Поддержка рынка (Put Wall)">
                                  <span className="sm:hidden">PW</span>
                                  <span className="hidden sm:inline">Поддержка PW</span>
                                </span>
                              )}
                              {isZeroFlip && (
                                <span className="text-[8px] sm:text-[9px] bg-purple-600 text-white font-extrabold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase tracking-wider shadow-xs border border-purple-400/50" title="Граница Гаммы (Gamma Flip)">
                                  <span className="sm:hidden">Flip</span>
                                  <span className="hidden sm:inline">⚡ Гамма</span>
                                </span>
                              )}
                              {isMaxPain && (
                                <span className="text-[8px] sm:text-[9px] bg-cyan-400 text-black font-extrabold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase tracking-wider shadow-xs" title="Магнит экспирации (Max Pain)">
                                  <span className="sm:hidden">Pain</span>
                                  <span className="hidden sm:inline">🎯 Магнит</span>
                                </span>
                              )}
                              {isSleeperMagnet && (
                                <span className="text-[8px] sm:text-[9px] bg-amber-500 text-black font-extrabold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase tracking-wider shadow-xs" title="Спящий магнит">
                                  🧲
                                </span>
                              )}
                              {isExactSpotStrike && (
                                <span className="text-[8px] sm:text-[9px] bg-amber-400 text-black font-extrabold px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase tracking-wider shadow-xs animate-pulse" title={`Текущая биржевая цена: $${gexReport.spotPrice}`}>
                                  📍
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Call Bar (Grows from Center to Right) */}
                          <div className="flex-1 min-w-0 flex justify-start items-center h-5 sm:h-6 bg-[#0a0d16] rounded-r-md overflow-hidden border-l border-gray-700 relative">
                            <div
                              className={`h-full transition-all flex items-center justify-end pr-1 text-[9px] sm:text-[10px] font-bold text-white/90 ${
                                isCallWall
                                  ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 shadow-sm shadow-emerald-500/50"
                                  : "bg-gradient-to-r from-emerald-600 to-emerald-900"
                              }`}
                              style={{ width: `${callWidthPct}%` }}
                            >
                              {callWidthPct > 25 && (
                                <span className="drop-shadow-xs truncate">
                                  {gexMetricMode === "volume"
                                    ? `${(s.callVolume || 0).toLocaleString()}`
                                    : gexMetricMode === "oi"
                                    ? `${s.callOi.toLocaleString()}`
                                    : `+${s.callGex}`}
                                </span>
                              )}
                            </div>
                            {callWidthPct <= 25 && (
                              <span className="text-[9px] sm:text-[10px] text-gray-500 pl-1 font-mono truncate hidden xs:inline">
                                {gexMetricMode === "volume"
                                  ? `${(s.callVolume || 0).toLocaleString()}`
                                  : gexMetricMode === "oi"
                                  ? `${s.callOi.toLocaleString()}`
                                  : `+${s.callGex}`}
                              </span>
                            )}
                          </div>

                          {/* Net GEX indicator at far right */}
                          <div className="w-24 text-right text-[11px] shrink-0 font-mono hidden sm:block">
                            <span className={s.netGex >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              {s.netGex > 0 ? `+${s.netGex}` : s.netGex} $M
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ======================================================== */}
                {/* 2. 🏛️ АНАЛИТИЧЕСКИЕ МОДУЛИ: ТЕРМОМЕТР, УДАРЫ, ЭКСПИРАЦИИ, ГАММА-ПРОФИЛЬ */}
                {/* ======================================================== */}
                <GexAdvancedModules
                  gexReport={gexReport}
                  dayGexReport={dayGexReport}
                  candles={candles}
                  activeAsset={activeAsset}
                  activeTf={activeTf}
                  marketStatus={marketStatus}
                />

                {/* ======================================================== */}
                {/* 3. 🏛️ ДИНАМИЧЕСКИЕ СЦЕНАРИИ, СЛОВАРЬ И ЧЕК-ЛИСТ ТРЕЙДЕРА */}
                {/* ======================================================== */}
                <div className="bg-[#0b0e17] border border-gray-800 rounded-2xl p-5 md:p-6 space-y-5 shadow-xl">
                  
                  {/* Explanations Header with Subtabs */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800 pb-4">
                    <div>
                      <h4 className="font-display font-bold text-base text-white flex items-center gap-2">
                        <Info className="h-5 w-5 text-amber-400" />
                        <span>Опционная Аналитика и Предположения Движения Цены</span>
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Понятные объяснения механики дилеров, расчетные сценарии движения и практический чек-лист
                      </p>
                    </div>

                    {/* Sub-tabs selector */}
                    <div className="flex items-center gap-1 bg-[#101420] p-1 rounded-xl border border-gray-800 text-xs font-semibold flex-wrap">
                      <button
                        onClick={() => setGexExplTab("simple")}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          gexExplTab === "simple"
                            ? "bg-amber-500/25 text-amber-200 border border-amber-500/50 shadow-xs"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>🧠</span>
                        <span>Простыми словами</span>
                      </button>
                      <button
                        onClick={() => setGexExplTab("scenarios")}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          gexExplTab === "scenarios"
                            ? "bg-cyan-500/25 text-cyan-200 border border-cyan-500/50 shadow-xs"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>🎯</span>
                        <span>Куда пойдет цена? (Сценарии)</span>
                      </button>
                      <button
                        onClick={() => setGexExplTab("guide")}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          gexExplTab === "guide"
                            ? "bg-purple-500/25 text-purple-200 border border-purple-500/50 shadow-xs"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>📖</span>
                        <span>Словарь уровней &amp; Логика</span>
                      </button>
                      <button
                        onClick={() => setGexExplTab("rules")}
                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          gexExplTab === "rules"
                            ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/50 shadow-xs"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>📋</span>
                        <span>Чек-лист трейдера</span>
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: КОМПАКТНЫЕ КАРТОЧКИ-ШПАРГАЛКИ (С АККОРДЕОНАМИ ВМЕСТО ДЛИННЫХ ТЕКСТОВ) */}
                  {gexExplTab === "simple" && (
                    <div className="space-y-3 text-xs leading-relaxed text-gray-300 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Level 1: Call Wall */}
                        <div className="p-3.5 rounded-xl bg-[#0e121c] border border-emerald-500/30 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-400 text-xs flex items-center gap-1">
                              🏰 Call Wall — ${gexReport.callWall}
                            </span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              Сопротивление
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-100 bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                            <b>⚡ Сейчас:</b> Фиксация лонгов у ${gexReport.callWall}; стопы шортистов стоят выше стены.
                          </div>
                          <details className="group text-[11px] text-gray-400">
                            <summary className="cursor-pointer select-none hover:text-white font-mono flex items-center justify-between">
                              <span>Как работает?</span>
                              <span className="group-open:rotate-180 transition-transform">▾</span>
                            </summary>
                            <p className="mt-1.5 text-gray-300 bg-black/40 p-2 rounded border border-gray-800">
                              Дилеры продают фьючерс при подходе к ${gexReport.callWall}, гася рост. Пробой стены с объемом запускает Gamma Squeeze вверх.
                            </p>
                          </details>
                        </div>

                        {/* Level 2: Put Wall */}
                        <div className="p-3.5 rounded-xl bg-[#0e121c] border border-rose-500/30 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-400 text-xs flex items-center gap-1">
                              🛡️ Put Wall — ${gexReport.putWall}
                            </span>
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              Пол рынка
                            </span>
                          </div>
                          <div className="text-[11px] text-rose-100 bg-rose-950/30 px-2.5 py-1.5 rounded-lg border border-rose-500/20">
                            <b>⚡ Сейчас:</b> Зона лимитного откупа от ${gexReport.putWall} со стопом за ATR-буфером.
                          </div>
                          <details className="group text-[11px] text-gray-400">
                            <summary className="cursor-pointer select-none hover:text-white font-mono flex items-center justify-between">
                              <span>Как работает?</span>
                              <span className="group-open:rotate-180 transition-transform">▾</span>
                            </summary>
                            <p className="mt-1.5 text-gray-300 bg-black/40 p-2 rounded border border-gray-800">
                              На этом страйке сосредоточены путы; дилеры выкупают проливы для закрытия короткой дельты.
                            </p>
                          </details>
                        </div>

                        {/* Level 3: Zero-Flip */}
                        <div className="p-3.5 rounded-xl bg-[#0e121c] border border-purple-500/30 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-400 text-xs flex items-center gap-1">
                              ⚡ Zero-Flip — ${gexReport.gammaFlip}
                            </span>
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              Рубеж режима
                            </span>
                          </div>
                          <div className="text-[11px] text-purple-100 bg-purple-950/30 px-2.5 py-1.5 rounded-lg border border-purple-500/20">
                            <b>⚡ Сейчас:</b> Выше ${gexReport.gammaFlip} — флэт/возврат, ниже — ускорение тренда.
                          </div>
                          <details className="group text-[11px] text-gray-400">
                            <summary className="cursor-pointer select-none hover:text-white font-mono flex items-center justify-between">
                              <span>Как работает?</span>
                              <span className="group-open:rotate-180 transition-transform">▾</span>
                            </summary>
                            <p className="mt-1.5 text-gray-300 bg-black/40 p-2 rounded border border-gray-800">
                              Точка нулевой гаммы, где дилеры меняют алгоритм с контртрендового (гашение) на трендовый (разгон).
                            </p>
                          </details>
                        </div>

                        {/* Level 4: Max Pain */}
                        <div className="p-3.5 rounded-xl bg-[#0e121c] border border-cyan-500/30 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-400 text-xs flex items-center gap-1">
                              🎯 Max Pain — ${gexReport.maxPain}
                            </span>
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              Магнит
                            </span>
                          </div>
                          <div className="text-[11px] text-cyan-100 bg-cyan-950/30 px-2.5 py-1.5 rounded-lg border border-cyan-500/20">
                            <b>⚡ Сейчас:</b> Точка притяжения цены (${gexReport.maxPain}) внутри коридора.
                          </div>
                          <details className="group text-[11px] text-gray-400">
                            <summary className="cursor-pointer select-none hover:text-white font-mono flex items-center justify-between">
                              <span>Как работает?</span>
                              <span className="group-open:rotate-180 transition-transform">▾</span>
                            </summary>
                            <p className="mt-1.5 text-gray-300 bg-black/40 p-2 rounded border border-gray-800">
                              Страйк, где суммарные выплаты по Call и Put (с учетом OI и Volume) минимальны к моменту экспирации.
                            </p>
                          </details>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: ЕДИНЫЙ ДИНАМИЧЕСКИЙ АКТИВНЫЙ СЦЕНАРИЙ (БЕЗ ДУБЛИРОВАНИЯ БЛОКОВ) */}
                  {gexExplTab === "scenarios" && (() => {
                    const spot = gexReport.spotPrice;
                    const cw = gexReport.callWall;
                    const pw = gexReport.putWall;
                    const flip = gexReport.gammaFlip;
                    const mp = gexReport.maxPain;

                    const nowMsk = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
                    const dayOfWeek = nowMsk.getDay();
                    const isWeekendNow = dayOfWeek === 0 || dayOfWeek === 6;
                    const isMarketClosed = Boolean(
                      !marketStatus?.isOpen ||
                      isWeekendNow ||
                      (marketStatus?.statusBadge && (marketStatus.statusBadge.includes("Выходной") || marketStatus.statusBadge.includes("Закрыт")))
                    );

                    const range = Math.max(1, cw - pw);
                    const distToPw = Math.abs(spot - pw);
                    const distToCw = Math.abs(spot - cw);
                    const proximityThreshold = Math.max(4, range * 0.16);

                    let dynamicVerdict = "";
                    let dynamicExplanation = "";
                    let dynamicBadge = "";
                    let dynamicCardBorder = "";
                    let dynamicCardBg = "";
                    let primaryAction = "";
                    let targetLevel = "";
                    let invalidationLevel = "";

                    if (spot < flip) {
                      dynamicVerdict = isMarketClosed
                        ? `Рынок закрыт под Zero-Flip ($${flip}). В фокусе открытия: реакция на Put Wall $${pw}.`
                        : `Активен сценарий отрицательной гаммы (-GEX): цена под Zero-Flip ($${flip}), риск ускорения к $${pw}.`;
                      dynamicExplanation = `Дилеры находятся в зоне отрицательной гаммы и хеджируют дельту продажами по ходу движения. Попытки раннего выкупа без возврата выше $${flip} несут повышенный риск.`;
                      dynamicBadge = isMarketClosed ? "💤 Закрытие под Flip" : "🚨 Активен: Импульс -GEX";
                      dynamicCardBorder = "border-rose-500/70";
                      dynamicCardBg = "bg-rose-950/20";
                      primaryAction = `Ждать теста Put Wall $${pw} для лимитного лонга либо возврата и закрепления выше Flip $${flip}.`;
                      targetLevel = `Поддержка $${pw} (при возврате выше $${flip} — цель $${mp})`;
                      invalidationLevel = `Уход и закрепление ниже $${pw} с объемом (каскад стопов SSL)`;
                    } else if (distToPw <= proximityThreshold || spot <= pw) {
                      dynamicVerdict = `Активен сценарий отскока от поддержки Put Wall ($${pw}) к магниту $${mp}.`;
                      dynamicExplanation = `Цена находится в зоне максимальной концентрации путов ($${pw}). Дилеры закрывают хедж покупками базового актива, формируя институциональный пол.`;
                      dynamicBadge = "🛡️ Активен: Защита Put Wall";
                      dynamicCardBorder = "border-emerald-500/70";
                      dynamicCardBg = "bg-emerald-950/20";
                      primaryAction = `Поиск Long-сетапа от зоны $${pw} с выносом стопа за динамический ATR-буфер.`;
                      targetLevel = `TP1: Zero-Flip $${flip} / Магнит $${mp} • TP2: Call Wall $${cw}`;
                      invalidationLevel = `Пробой и закрытие свечи ниже Put Wall $${pw} за пределами ATR-буфера`;
                    } else if (distToCw <= proximityThreshold || spot >= cw) {
                      dynamicVerdict = `Активен сценарий теста потолка Call Wall ($${cw}): фиксация лонгов или ожидание сквиза.`;
                      dynamicExplanation = `Цена подошла к верхнему барьеру Call Wall ($${cw}), где маркетмейкеры сдерживают рост продажами. При пробое стены с высоким Volume сработают стопы шортистов (BSL).`;
                      dynamicBadge = "🏰 Активен: Тест Call Wall";
                      dynamicCardBorder = "border-amber-500/70";
                      dynamicCardBg = "bg-amber-950/20";
                      primaryAction = `Фиксировать часть прибыли по лонгам у $${cw}. Новые покупки — только после подтвержденного пробоя $${cw}.`;
                      targetLevel = `При откате: возврат к Магниту $${mp} • При пробое: сквиз к $${gexReport.sleeperMagnet}`;
                      invalidationLevel = `Ложный закол $${cw} с возвратом под уровень`;
                    } else {
                      dynamicVerdict = `Активен коридорный сценарий (+GEX Штиль): баланс между $${pw} и $${cw} с тягой к $${mp}.`;
                      dynamicExplanation = `Цена (${spot.toFixed(1)}) находится выше Zero-Flip ($${flip}) внутри положительной гаммы. Дилеры гасят импульсы и возвращают котировки к равновесному страйку Max Pain ($${mp}).`;
                      dynamicBadge = "⚖️ Активен: Коридор +GEX";
                      dynamicCardBorder = "border-cyan-500/70";
                      dynamicCardBg = "bg-cyan-950/20";
                      primaryAction = `Работа от границ диапазона: лимитный Long у $${pw}, фиксация/Short у $${cw}.`;
                      targetLevel = `Магнит экспирации Max Pain $${mp} и границы $${pw} / $${cw}`;
                      invalidationLevel = `Пробой рубежа Zero-Flip $${flip} вниз (переход в режим -GEX)`;
                    }

                    return (
                      <div className="space-y-3 text-xs leading-relaxed text-gray-300 animate-in fade-in duration-150">
                        <div className={`p-4 rounded-xl border ${dynamicCardBorder} ${dynamicCardBg} space-y-3`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-black/60 border border-gray-700 text-white">
                                🎯 ЕДИНЫЙ АКТИВНЫЙ СЦЕНАРИЙ СЕЙЧАС
                              </span>
                              <span className="text-[11px] font-mono text-gray-300">
                                Спот: <b className="text-white">${spot.toFixed(1)}</b> • Flip: <b className="text-purple-300">${flip}</b> • Max Pain: <b className="text-cyan-300">${mp}</b>
                              </span>
                            </div>
                            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-black/50 border border-white/15 text-amber-300">
                              {dynamicBadge}
                            </span>
                          </div>

                          <div className="text-sm font-bold text-white">
                            {dynamicVerdict}
                          </div>
                          <p className="text-gray-200 text-xs leading-relaxed">
                            {dynamicExplanation}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            <div className="p-2.5 rounded-lg bg-black/45 border border-gray-800">
                              <span className="text-[10px] font-mono uppercase text-emerald-400 block font-bold">👉 Действие трейдера</span>
                              <span className="text-gray-200 text-[11.5px] font-medium">{primaryAction}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/45 border border-gray-800">
                              <span className="text-[10px] font-mono uppercase text-cyan-400 block font-bold">🎯 Целевые ориентиры</span>
                              <span className="text-gray-200 text-[11.5px] font-medium">{targetLevel}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/45 border border-gray-800">
                              <span className="text-[10px] font-mono uppercase text-rose-400 block font-bold">⚠️ Условие отмены / Риск</span>
                              <span className="text-gray-200 text-[11.5px] font-medium">{invalidationLevel}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 3: СЛОВАРЬ УРОВНЕЙ & ТОРГОВОЕ РУКОВОДСТВО */}
                  {gexExplTab === "guide" && (
                    <div className="space-y-4 text-xs leading-relaxed text-gray-300 animate-in fade-in duration-150">
                      <div className="bg-[#0e121c] p-3.5 rounded-xl border border-gray-800 text-gray-300 space-y-1">
                        <span className="font-bold text-white text-sm block">
                          📖 Практическое руководство по торговле опционными уровнями:
                        </span>
                        <p className="text-gray-400 text-xs">
                          Опционные уровни показывают не предположения аналитиков, а <b>реальные обязательства маркетмейкеров</b> по хеджированию миллиардных портфелей. В таблице ниже описано, как читать эти уровни и что делать в терминале:
                        </p>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-gray-800">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#121624] border-b border-gray-800 text-[11px] font-mono text-gray-400">
                              <th className="p-3 w-1/4">Биржевой уровень / Индикатор</th>
                              <th className="p-3 w-5/12 text-emerald-400">Что это значит простыми словами</th>
                              <th className="p-3 w-1/3 text-amber-300">Точное действие трейдера</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/60 font-sans">
                            <tr className="hover:bg-gray-900/40">
                              <td className="p-3 text-emerald-400 font-mono font-bold text-xs">
                                Call Wall (Потолок)
                              </td>
                              <td className="p-3 text-gray-300">
                                Страйк максимального скопления опционов Call. При приближении к нему маркетмейкеры обязаны агрессивно продавать золото/фьючерсы, останавливая рост цены.
                              </td>
                              <td className="p-3 text-emerald-300 font-semibold">
                                Фиксировать прибыль по покупкам. Искать вход в шорт при развороте со стопом за уровнем. Не покупать в лоб стены!
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-900/40">
                              <td className="p-3 text-rose-400 font-mono font-bold text-xs">
                                Put Wall (Поддержка)
                              </td>
                              <td className="p-3 text-gray-300">
                                Страйк максимального открытого интереса по путам. Здесь маркетмейкеры выкупают проливы своими миллиардами, выступая естественным железобетонным полом.
                              </td>
                              <td className="p-3 text-rose-300 font-semibold">
                                Идеальная зона для открытия лонгов. Стоп-лосс выставлять на 0.5–0.8% ниже уровня стены.
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-900/40">
                              <td className="p-3 text-purple-400 font-mono font-bold text-xs">
                                Gamma Flip (Zero Level)
                              </td>
                              <td className="p-3 text-gray-300">
                                Рубеж между спокойным рынком (положительная гамма) и лавинной паникой (отрицательная гамма). Выше него рынок стабилен, ниже — начинается бегство инвесторов.
                              </td>
                              <td className="p-3 text-purple-300 font-semibold">
                                Пока выше — смело торговать отскоки от уровней в канале. Если закрытие свечи ниже — отменить все покупки и ставить стопы.
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-900/40">
                              <td className="p-3 text-cyan-400 font-mono font-bold text-xs">
                                Max Pain (Точка боли)
                              </td>
                              <td className="p-3 text-gray-300">
                                Уровень максимального сгорания премий покупателей опционов. К экспирации цена притягивается к этому уровню, чтобы сжечь опционы толпы в ноль.
                              </td>
                              <td className="p-3 text-cyan-300 font-semibold">
                                К пятничной экспирации выставлять тейк-профиты вблизи этого страйка — туда с высокой вероятностью притянут цену.
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-900/40">
                              <td className="p-3 text-amber-300 font-mono font-bold text-xs">
                                Разница горизонтов (День / Неделя / Месяц)
                              </td>
                              <td className="p-3 text-gray-300">
                                Внутри дня (День/Неделя) опционы плотно сжаты вокруг текущей цены. В месячной серии участвуют крупные хеджи фондов с более широкими страйками (потолок выше, пол ниже).
                              </td>
                              <td className="p-3 text-amber-300 font-semibold">
                                Для интрадея используйте «ДЕНЬ» и «НЕДЕЛЯ». Для удержания позиций от 3 дней до месяца ориентируйтесь на «МЕСЯЦ».
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-900/40">
                              <td className="p-3 text-blue-300 font-mono font-bold text-xs">
                                Объем vs Открытый интерес (OI)
                              </td>
                              <td className="p-3 text-gray-300">
                                Открытый интерес (OI) — это накопленный капитал в позициях. Дневной объем (Volume) — активность именно за сегодняшнюю торговую сессию.
                              </td>
                              <td className="p-3 text-blue-300 font-semibold">
                                Всплеск объема на дальнем страйке означает, что крупный фонд начал готовить новый тренд. Переключайте вкладку «Объем (Volume)» для поиска аномалий.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ЧЕК-ЛИСТ ДЕЙСТВИЙ ТРЕЙДЕРА */}
                  {gexExplTab === "rules" && (
                    <div className="space-y-4 text-xs leading-relaxed text-gray-300 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Buying Rules */}
                        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-2">
                          <span className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                            🟢 Где и как безопасно покупать (Лонг):
                          </span>
                          <ul className="space-y-1.5 pl-1">
                            <li className="flex items-start gap-1.5">
                              <span>✅</span>
                              <span><b>Точка входа:</b> Откат цены вплотную к поддержке (Put Wall) <b>${gexReport.putWall}</b>.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span>✅</span>
                              <span><b>Стоп-лосс:</b> Выставлять строго на 0.5-0.8% ниже Put Wall (например, ${Math.round(gexReport.putWall * 0.993)}).</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span>✅</span>
                              <span><b>Тейк-профит:</b> Частичная фиксация на Zero Flip (${gexReport.gammaFlip}) и финальная у Call Wall (${gexReport.callWall}).</span>
                            </li>
                          </ul>
                        </div>

                        {/* Selling Rules */}
                        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-2">
                          <span className="font-bold text-rose-400 text-sm flex items-center gap-1.5">
                            🔴 Где и как продавать (Шорт / Фиксация):
                          </span>
                          <ul className="space-y-1.5 pl-1">
                            <li className="flex items-start gap-1.5">
                              <span>🛑</span>
                              <span><b>Точка фиксации:</b> При касании потолка (Call Wall) <b>${gexReport.callWall}</b> закрывать лонги.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span>🛑</span>
                              <span><b>Вход в шорт:</b> Отбой от Call Wall вниз с коротким стопом за уровнем (${Math.round(gexReport.callWall * 1.005)}).</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span>⚠️</span>
                              <span><b>Критическое правило:</b> Никогда не шортить в упор к Put Wall и не покупать в упор к Call Wall!</span>
                            </li>
                          </ul>
                        </div>

                      </div>

                      <div className="p-4 rounded-xl bg-[#0e121c] border border-amber-500/30 text-amber-200">
                        <b>Золотое правило сохранения депозита:</b> Если свеча закрылась ниже Gamma Flip (${gexReport.gammaFlip}), немедленно отмените все отложенные лонги. В этой зоне дилеры не спасают рынок, а усиливают падение до следующей мощной стены!
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-gray-500 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-purple-400" />
                <p>Загрузка реальных опционных данных COMEX/FORTS и расчет GEX-профиля...</p>
              </div>
            )}
          </div>
        )}


        {/* ======================================================== */}
        {/* 3. PINE SCRIPT v6 / QUANTEX PRO v8 EDITOR TAB            */}
        {/* ======================================================== */}
        {activeTab === "editor" && (
          <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 overflow-hidden h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3 shrink-0">
              <div>
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-amber-400" />
                  <span>Редактор Индикатора QUANTEX Pro v8 (Pine Script v6)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Полный предустановленный код QUANTEX Pro v8 с возможностью модификации и сохранения на сервере
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(indicatorCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? "Скопировано!" : "Копировать"}</span>
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([indicatorCode], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `QUANTEX_Pro_v8_${activeAsset}.pine`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Скачать .pine</span>
                </button>

                <button
                  onClick={fetchIndicatorCode}
                  className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                  title="Сбросить код к сохраненному на диске"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Сброс</span>
                </button>

                <button
                  onClick={handleSaveIndicatorCode}
                  disabled={isScriptSaved}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-md"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isScriptSaved ? "Сохранение..." : "💾 Сохранить на сервере"}</span>
                </button>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Code Textarea with Dark Terminal Theme */}
            <div className="flex-1 min-h-0 relative bg-black/90 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="bg-gray-900/90 px-4 py-2 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400 shrink-0">
                <span className="font-mono">QUANTEX_Pro_v8.pine (Pine Script v6)</span>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Встроен в автономную торговую станцию ({indicatorCode.split("\n").length} строк)</span>
                </span>
              </div>
              <textarea
                value={indicatorCode}
                onChange={(e) => setIndicatorCode(e.target.value)}
                className="flex-1 w-full p-4 bg-transparent text-gray-200 font-mono text-xs leading-relaxed resize-none focus:outline-none selection:bg-amber-500/30 overflow-y-auto"
                spellCheck={false}
                placeholder="Загрузка кода индикатора QUANTEX Pro v8..."
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 5. ECONOMIC CALENDAR & LIVE NEWS TAB                     */}
        {/* ======================================================== */}
        {activeTab === "calendar" && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  <span>Новости &amp; События Дня (Все • Золото • Геополитика • MOEX • Крипта)</span>
                  <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 normal-case">
                    🔄 Синхронизировано МСК: {calendarSyncMeta.date} • {calendarSyncMeta.timeMsk}
                  </span>
                  {calendarSyncMeta.receivedAt && (
                    <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 normal-case">
                      📥 Получено сборщиком: {calendarSyncMeta.receivedAt}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Московское время (UTC+3) • Двусторонний обмен данными и синхронизация • Сверху самые свежие новости и далее по убыванию • У каждой новости и события доступна прямая проверенная ссылка на первоисточник
                </p>
              </div>

              {/* Action & Sub-tab switches */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-[#0d1220] p-1 rounded-xl border border-gray-800">
                  <button
                    onClick={() => setCalendarSubTab("news")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      calendarSubTab === "news"
                        ? "bg-emerald-500 text-black shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5" />
                    <span>Лента новостей ({sortedMarketNews.length})</span>
                  </button>

                  <button
                    onClick={() => setCalendarSubTab("calendar")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      calendarSubTab === "calendar"
                        ? "bg-blue-500 text-black shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>События дня ({calendarEvents.length})</span>
                  </button>
                </div>

                {/* Refresh news button */}
                <button
                  onClick={refreshMarketNews}
                  disabled={isNewsLoading}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                    isNewsLoading
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95"
                  }`}
                  title="Обновить свежие новости и синхронизировать события дня"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isNewsLoading ? "animate-spin text-emerald-300" : ""}`} />
                  <span>{isNewsLoading ? "Синхронизация..." : "Обновить и синхронизировать"}</span>
                </button>
              </div>
            </div>

            {/* SUB-VIEW 1: LIVE NEWS FEED (STRICTLY SORTED NEWEST FIRST DESCENDING, DIVIDED INTO 4 SECTIONS: ВСЕ, ЗОЛОТО, MOEX, КРИПТА) */}
            {calendarSubTab === "news" && (
              <div className="space-y-4">
                {/* Key Price-Impacting Events of the Day Quick Strip (with Date & Original Source Badge) */}
                {calendarEvents.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-950/40 via-[#0d1324] to-indigo-950/40 border border-blue-500/30 rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-[10px] font-bold uppercase">
                          ⚡ Драйверы цены сегодня ({calendarSyncMeta.date})
                        </span>
                        <span className="text-xs font-bold text-white">
                          Ключевые события дня (Статистика, Геополитика, ФРС, МосБиржа и Крипторынок)
                        </span>
                      </div>
                      <button
                        onClick={() => setCalendarSubTab("calendar")}
                        className="text-xs font-mono font-bold text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <span>Все события дня ({calendarEvents.length})</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {calendarEvents
                        .filter((ev) => matchesMarketSection(ev, stationNewsCategory))
                        .slice(0, 3)
                        .map((ev) => {
                          const secBadge = getSectionBadgeMeta(ev);
                          return (
                            <div
                              key={ev.id}
                              onClick={() => setCalendarSubTab("calendar")}
                              className="p-2.5 rounded-xl bg-[#0a0e19]/90 border border-gray-800 hover:border-blue-500/40 transition cursor-pointer space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-cyan-300 font-bold">📅 {ev.date || calendarSyncMeta.date}</span>
                                  <span className="text-amber-400 font-bold">⏰ {ev.timeMsk}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${secBadge.className}`}>
                                    {secBadge.label}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                      ev.importance === "CRITICAL"
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    }`}
                                  >
                                    {ev.importance}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs font-bold text-white line-clamp-1">{ev.title}</div>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                                <span className="truncate">
                                  Прогноз: <span className="text-gray-200 font-mono">{ev.forecast}</span> • Пред:{" "}
                                  <span className="text-gray-300 font-mono">{ev.previous}</span>
                                </span>
                                <a
                                  href={ev.url || "https://ru.tradingview.com/economic-calendar/"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/30 font-mono text-[9px] font-bold transition shrink-0"
                                  title={`Перейти на оригинал источника: ${ev.source || "Официальный источник"}`}
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  <span>🔗 {ev.source || "Источник"}</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Search, Sort Indicator & 5-Section Filter Bar (Все, Золото, Геополитика, MOEX, Крипта) */}
                <div className="bg-[#0b0e17] border border-gray-800/90 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                      <input
                        type="text"
                        value={stationNewsSearch}
                        onChange={(e) => setStationNewsSearch(e.target.value)}
                        placeholder="Поиск по новостям (золото, ФРС, МосБиржа, биткоин, инфляция)..."
                        className="w-full bg-[#111625] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                      {stationNewsSearch && (
                        <button
                          onClick={() => setStationNewsSearch("")}
                          className="absolute right-2.5 top-2 text-gray-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold">
                      ↓ Сначала свежие (по убыванию)
                    </span>
                  </div>

                  {/* Unified 5-Section Filter Buttons: Все, Золото, Геополитика, MOEX, Крипта */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-mono">
                    {[
                      { id: "ALL", label: "🌐 Все", count: sortedMarketNews.length },
                      {
                        id: "GOLD",
                        label: "🪙 Золото",
                        count: sortedMarketNews.filter((n) => matchesMarketSection(n, "GOLD")).length
                      },
                      {
                        id: "GEOPOLITICS",
                        label: "🌍 Геополитика",
                        count: sortedMarketNews.filter((n) => matchesMarketSection(n, "GEOPOLITICS")).length
                      },
                      {
                        id: "MOEX",
                        label: "🇷🇺 MOEX",
                        count: sortedMarketNews.filter((n) => matchesMarketSection(n, "MOEX")).length
                      },
                      {
                        id: "CRYPTO",
                        label: "₿ Крипта",
                        count: sortedMarketNews.filter((n) => matchesMarketSection(n, "CRYPTO")).length
                      }
                    ].map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => {
                          setStationNewsCategory(sec.id);
                          setCalendarCategoryFilter(sec.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 font-bold flex items-center gap-1.5 ${
                          stationNewsCategory === sec.id
                            ? "bg-emerald-500 text-black shadow-sm"
                            : "bg-gray-800/80 text-gray-300 hover:text-white border border-gray-700/60"
                        }`}
                      >
                        <span>{sec.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            stationNewsCategory === sec.id ? "bg-black/20 text-black" : "bg-gray-900 text-gray-400"
                          }`}
                        >
                          {sec.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* News Cards List (Strictly Newest First -> Descending, with Compact Source Verification Link) */}
                <div className="space-y-3">
                  {(() => {
                    const filtered = sortedMarketNews.filter((n) => {
                      if (!matchesMarketSection(n, stationNewsCategory)) return false;
                      if (stationNewsSearch.trim()) {
                        const q = stationNewsSearch.toLowerCase();
                        const match =
                          n.title?.toLowerCase().includes(q) ||
                          n.summary?.toLowerCase().includes(q) ||
                          n.goldEffect?.toLowerCase().includes(q);
                        if (!match) return false;
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 rounded-2xl bg-gray-900/40 border border-dashed border-gray-800 text-center space-y-3">
                          <Flame className="h-8 w-8 text-emerald-400/60 mx-auto" />
                          <p className="text-gray-400 text-sm">
                            {isNewsLoading ? "Идет сбор свежих новостей..." : "Новости в выбранном разделе не найдены"}
                          </p>
                          <button
                            onClick={refreshMarketNews}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Собрать новости прямо сейчас</span>
                          </button>
                        </div>
                      );
                    }

                    return filtered.map((item, idx) => {
                      const secBadge = getSectionBadgeMeta(item);
                      const verifyUrl =
                        item.url ||
                        (secBadge.code === "GEOPOLITICS"
                          ? "https://tass.ru/mezhdunarodnaya-panorama"
                          : secBadge.code === "MOEX"
                          ? "https://www.moex.com/ru/derivatives/"
                          : secBadge.code === "CRYPTO"
                          ? "https://ru.tradingview.com/markets/cryptocurrencies/news/"
                          : "https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA");

                      return (
                        <div
                          key={item.id}
                          className={`bg-gray-900/60 border rounded-2xl p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 transition ${
                            idx === 0
                              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-gray-900/60 to-gray-900/60"
                              : "border-gray-800/90 hover:border-gray-700"
                          }`}
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {idx === 0 && (
                                <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500 text-black uppercase">
                                  🔥 Самая свежая
                                </span>
                              )}
                              <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${secBadge.className}`}>
                                {secBadge.label}
                              </span>
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" title="Дата и время публикации первоисточника">
                                📅 Опубликовано: {item.date && !item.time.includes(item.date) ? `${item.date} • ${item.time}` : item.time}
                              </span>
                              {item.receivedAt && (
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" title="Точное время получения сборщиком QUANTEX">
                                  📥 Получено: {item.receivedAt}
                                </span>
                              )}
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                ⏱ {formatRelativeFreshness(item._tsMs)}
                              </span>
                              {item.source && (
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                                  {item.source}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  item.impact === "CRITICAL"
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                    : item.impact === "HIGH"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-blue-500/20 text-blue-300"
                                }`}
                              >
                                {item.impact}
                              </span>

                              {/* Small clickable source verification link badge */}
                              <a
                                href={verifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/30 font-mono text-[10px] font-bold transition cursor-pointer"
                                title={`Перейти на оригинал статьи (${item.source || "Первоисточник"}) и проверить`}
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span>🔗 Читать на {item.source || "источнике"}</span>
                              </a>
                            </div>

                            <h4 className="font-bold text-base text-white leading-snug">
                              {item.title}
                            </h4>

                            {item.summary && (
                              <p className="text-xs text-gray-300 leading-relaxed">
                                {item.summary}
                              </p>
                            )}

                            {item.goldEffect && (
                              <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
                                <span className="font-bold shrink-0">Влияние на цену:</span>
                                <span className="leading-relaxed">{item.goldEffect}</span>
                              </div>
                            )}
                          </div>

                          {/* Quick AI Action & Source Link */}
                          <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-2">
                            <button
                              onClick={() => {
                                setActiveTab("chart");
                                setIsAiPanelCollapsed(false);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                              title="Открыть график и передать новость ИИ-аналитику"
                            >
                              <Bot className="h-3.5 w-3.5 text-cyan-400" />
                              <span>ИИ-Анализ</span>
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: DAILY PRICE-IMPACTING MACROECONOMIC EVENTS (СОБЫТИЯ ДНЯ С ДАТОЙ, СИНХРОНИЗАЦИЕЙ И 4 РАЗДЕЛАМИ) */}
            {calendarSubTab === "calendar" && (
              <div className="space-y-4">
                {/* Filter & Synchronization Header for Daily Events */}
                <div className="bg-[#0b0e17] border border-gray-800/90 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>События дня, влияющие на цену активов</span>
                      <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        📅 Дата: {calendarSyncMeta.date}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        ⏰ МСК (UTC+3): {calendarSyncMeta.timeMsk}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Статистика динамики инфляции (CPI/PCE), ВВП, обсуждения ФРС США (FOMC), клиринги и статистика МосБиржи/ЦБ РФ, потоки Spot BTC/ETH ETF
                    </p>
                  </div>

                  {/* Unified 5-Section Filter Buttons: Все, Золото, Геополитика, MOEX, Крипта */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-mono">
                    {[
                      { id: "ALL", label: "🌐 Все", count: calendarEvents.length },
                      {
                        id: "GOLD",
                        label: "🪙 Золото",
                        count: calendarEvents.filter((ev) => matchesMarketSection(ev, "GOLD")).length
                      },
                      {
                        id: "GEOPOLITICS",
                        label: "🌍 Геополитика",
                        count: calendarEvents.filter((ev) => matchesMarketSection(ev, "GEOPOLITICS")).length
                      },
                      {
                        id: "MOEX",
                        label: "🇷🇺 MOEX",
                        count: calendarEvents.filter((ev) => matchesMarketSection(ev, "MOEX")).length
                      },
                      {
                        id: "CRYPTO",
                        label: "₿ Крипта",
                        count: calendarEvents.filter((ev) => matchesMarketSection(ev, "CRYPTO")).length
                      }
                    ].map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => {
                          setCalendarCategoryFilter(sec.id);
                          setStationNewsCategory(sec.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 font-bold flex items-center gap-1.5 ${
                          calendarCategoryFilter === sec.id
                            ? "bg-blue-500 text-black shadow-sm"
                            : "bg-gray-800/80 text-gray-300 hover:text-white border border-gray-700/60"
                        }`}
                      >
                        <span>{sec.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            calendarCategoryFilter === sec.id ? "bg-black/20 text-black" : "bg-gray-900 text-gray-400"
                          }`}
                        >
                          {sec.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Events Cards */}
                <div className="space-y-3">
                  {calendarEvents
                    .filter((ev) => matchesMarketSection(ev, calendarCategoryFilter))
                    .map((ev) => {
                      const secBadge = getSectionBadgeMeta(ev);
                      const verifyUrl =
                        ev.url ||
                        (secBadge.code === "GEOPOLITICS"
                          ? "https://tass.ru/mezhdunarodnaya-panorama"
                          : secBadge.code === "MOEX"
                          ? "https://www.moex.com/ru/derivatives/"
                          : secBadge.code === "CRYPTO"
                          ? "https://www.cmegroup.com/markets/cryptocurrencies/bitcoin/bitcoin.html"
                          : "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm");

                      return (
                        <div
                          key={ev.id}
                          className={`bg-gray-900/60 border rounded-2xl p-4 space-y-3 transition ${
                            ev.status === "NEXT"
                              ? "border-amber-500/50 bg-gradient-to-r from-amber-950/20 via-gray-900/60 to-gray-900/60"
                              : ev.importance === "CRITICAL"
                              ? "border-rose-500/30 hover:border-rose-500/50"
                              : "border-gray-800 hover:border-gray-700"
                          }`}
                        >
                          {/* Top row: Date, Moscow Time, Section, Status & Source Verification Badge + Forecast/Previous/Actual */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${secBadge.className}`}>
                                  {secBadge.label}
                                </span>
                                <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" title="Дата события">
                                  📅 {ev.date || calendarSyncMeta.date}
                                </span>
                                <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Московское время события">
                                  ⏰ {ev.timeMsk}
                                </span>
                                {(ev.receivedAt || calendarSyncMeta.receivedAt) && (
                                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" title="Точное время получения/синхронизации сборщиком">
                                    📥 Получено: {ev.receivedAt || calendarSyncMeta.receivedAt}
                                  </span>
                                )}
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {ev.currency}
                                </span>
                                {ev.categoryLabel && (
                                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {ev.categoryLabel}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                    ev.importance === "CRITICAL"
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                      : ev.importance === "HIGH"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                      : "bg-blue-500/20 text-blue-300"
                                  }`}
                                >
                                  {ev.importance === "CRITICAL" ? "🔥 КРИТИЧЕСКОЕ ВЛИЯНИЕ" : "⚡ ВЫСОКОЕ ВЛИЯНИЕ"}
                                </span>
                                {ev.statusLabel && (
                                  <span
                                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                      ev.status === "COMPLETED"
                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        : ev.status === "NEXT"
                                        ? "bg-amber-500 text-black font-extrabold"
                                        : "bg-gray-800 text-gray-300"
                                    }`}
                                  >
                                    {ev.statusLabel}
                                  </span>
                                )}
                                {ev.source && (
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                                    {ev.source}
                                  </span>
                                )}
                                {/* Small clickable source verification badge */}
                                <a
                                  href={verifyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/30 font-mono text-[10px] font-bold transition cursor-pointer"
                                  title={`Перейти на оригинал источника (${ev.source || "Официальный источник"}) и проверить`}
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                  <span>🔗 {ev.source || "Источник"}</span>
                                </a>
                              </div>

                              <h4 className="font-bold text-base text-white leading-snug">
                                {ev.title}
                              </h4>

                              {ev.dynamicsNote && (
                                <p className="text-xs text-cyan-300/90 font-mono">
                                  📊 {ev.dynamicsNote}
                                </p>
                              )}
                            </div>

                            {/* Macro Numbers Box: Actual / Forecast / Previous */}
                            <div className="grid grid-cols-3 gap-2 bg-[#0b0f1c] border border-gray-800 rounded-xl p-2.5 text-xs font-mono shrink-0 min-w-[260px]">
                              <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Факт / Статус:</span>
                                <span className="text-emerald-400 font-bold">{ev.actual || "Ожидается"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Прогноз:</span>
                                <span className="text-amber-300 font-bold">{ev.forecast || "—"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Предыдущее:</span>
                                <span className="text-gray-300">{ev.previous || "—"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Price Impact Description */}
                          <div className="p-2.5 rounded-xl bg-[#0c1222] border border-blue-500/20 text-xs text-gray-200 leading-relaxed">
                            <span className="font-bold text-blue-300 mr-1.5">Механика влияния на цену:</span>
                            {ev.impact}
                          </div>

                          {/* Bullish & Bearish Price Scenarios */}
                          {(ev.bullishScenario || ev.bearishScenario) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                              {ev.bullishScenario && (
                                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
                                  <span className="font-bold text-emerald-400 block mb-0.5">🟢 Бычий сценарий (Рост цены):</span>
                                  {ev.bullishScenario}
                                </div>
                              )}
                              {ev.bearishScenario && (
                                <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200">
                                  <span className="font-bold text-rose-400 block mb-0.5">🔴 Медвежий сценарий (Давление на цену):</span>
                                  {ev.bearishScenario}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Affected Tickers & Quick AI Action */}
                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono text-gray-400 uppercase">Затронутые активы:</span>
                              {(ev.affectedAssets || ["OANDA:XAUUSD", "DXY", "BTCUSDT"]).map((ticker: string) => (
                                <span
                                  key={ticker}
                                  className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-cyan-300 border border-gray-700"
                                >
                                  {ticker}
                                </span>
                              ))}
                            </div>

                            <button
                              onClick={() => {
                                setActiveTab("chart");
                                setIsAiPanelCollapsed(false);
                              }}
                              className="px-3 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Bot className="h-3.5 w-3.5 text-blue-400" />
                              <span>Разобрать влияние на графике</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 6. TRADE JOURNAL TAB                                     */}
        {/* ======================================================== */}
        {activeTab === "journal" && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-400" />
                  <span>Журнал Сделок и Аналитика</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Учет сделок по сетапам QUANTEX Pro v8 с фиксацией зон GEX и расчетом винрейта
                </p>
              </div>
            </div>

            {/* New Trade Entry Form */}
            <form onSubmit={handleAddTrade} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-white uppercase">Добавить сделку в журнал</span>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Актив</label>
                  <select
                    value={newTradeAsset}
                    onChange={(e) => setNewTradeAsset(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="XAUUSD">XAUUSD</option>
                    <option value="BTCUSDT">BTCUSDT</option>
                    <option value="ETHUSDT">ETHUSDT</option>
                    <option value="XRPUSDT">XRPUSDT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Направление</label>
                  <select
                    value={newTradeType}
                    onChange={(e) => setNewTradeType(e.target.value as any)}
                    className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="BUY">BUY (Лонг)</option>
                    <option value="SELL">SELL (Шорт)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Вход ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={newTradeEntry}
                    onChange={(e) => setNewTradeEntry(e.target.value)}
                    placeholder="4160.0"
                    className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Выход ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={newTradeExit}
                    onChange={(e) => setNewTradeExit(e.target.value)}
                    placeholder="4185.0"
                    className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">P&amp;L ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={newTradePnl}
                    onChange={(e) => setNewTradePnl(e.target.value)}
                    placeholder="+250"
                    className="w-full bg-black border border-gray-800 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold py-1.5 rounded text-xs transition cursor-pointer"
                  >
                    Записать
                  </button>
                </div>
              </div>
            </form>

            {/* Trades List */}
            <div className="bg-black/80 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="p-3">Дата</th>
                    <th className="p-3">Актив</th>
                    <th className="p-3">Тип</th>
                    <th className="p-3">Вход</th>
                    <th className="p-3">Выход</th>
                    <th className="p-3">P&amp;L</th>
                    <th className="p-3">GEX Зона</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {journalTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-900/30">
                      <td className="p-3 text-gray-400">{t.date}</td>
                      <td className="p-3 font-bold text-white">{t.asset}</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.type === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="p-3">${t.entryPrice}</td>
                      <td className="p-3">${t.exitPrice}</td>
                      <td className={`p-3 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.pnl >= 0 ? `+$${t.pnl}` : `-$${Math.abs(t.pnl)}`}
                      </td>
                      <td className="p-3 text-gray-400">{t.gexZone || "OTE / Gamma Flip"}</td>
                    </tr>
                  ))}
                  {journalTrades.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-500">
                        Пока нет записанных сделок. Добавьте первую сделку через форму выше.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ⚙️ UNIFIED STATION SETTINGS TAB                         */}
        {/* ======================================================== */}
        {activeTab === "settings" && (
          <UnifiedStationSettings
            initialSection={settingsInitialSection}
            currentTheme={stationTheme}
            onThemeChange={(th) => {
              setStationTheme(th);
              try {
                localStorage.setItem("quantex_theme", th);
              } catch {}
            }}
            currentUser={stationUser}
            onUserChange={(u) => {
              setStationUser(u);
              try {
                localStorage.setItem("quantex_active_user", JSON.stringify(u));
              } catch {}
            }}
            presetSel={presetSel}
            onApplyPreset={applyPreset}
            showTables={showTables}
            onToggleTables={setShowTables}
            tblViewMode={tblViewMode}
            onSelectTblViewMode={setTblViewMode}
            tablePos={tablePos}
            onSelectTablePos={setTablePos}
            useAntiRound={useAntiRound}
            onToggleAntiRound={setUseAntiRound}
            onNavigateToTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* ======================================================== */}
        {/* ℹ️ STRIKE DETAIL MODAL                                   */}
        {/* ======================================================== */}
        {selectedStrikeDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b0e17] border border-gray-700/80 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">Страйк ${selectedStrikeDetail.strike}</span>
                  {selectedStrikeDetail.strike === gexReport?.callWall && (
                    <span className="text-[10px] bg-emerald-500 text-black font-bold px-1.5 py-0.2 rounded">ПОТОЛОК (CW)</span>
                  )}
                  {selectedStrikeDetail.strike === gexReport?.putWall && (
                    <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded">ПОДДЕРЖКА (PW)</span>
                  )}
                  {selectedStrikeDetail.strike === gexReport?.gammaFlip && (
                    <span className="text-[10px] bg-purple-600 text-white font-bold px-1.5 py-0.2 rounded">ГАММА (FLIP)</span>
                  )}
                  {selectedStrikeDetail.strike === gexReport?.maxPain && (
                    <span className="text-[10px] bg-cyan-400 text-black font-bold px-1.5 py-0.2 rounded">МАГНИТ</span>
                  )}
                  {selectedStrikeDetail.strike === gexReport?.sleeperMagnet && (
                    <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.2 rounded">СПЯЩИЙ МАГНИТ</span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedStrikeDetail(null)}
                  className="p-1 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-gray-300">
                <div className="flex justify-between">
                  <span>Call GEX:</span>
                  <span className="text-emerald-400 font-bold">+{selectedStrikeDetail.callGex} $M</span>
                </div>
                <div className="flex justify-between">
                  <span>Put GEX:</span>
                  <span className="text-rose-400 font-bold">{selectedStrikeDetail.putGex} $M</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-1">
                  <span>Net GEX (Чистая Гамма):</span>
                  <span className={selectedStrikeDetail.netGex >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {selectedStrikeDetail.netGex > 0 ? `+${selectedStrikeDetail.netGex}` : selectedStrikeDetail.netGex} $M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Открытый интерес Call:</span>
                  <span>{selectedStrikeDetail.callOi.toLocaleString()} контр.</span>
                </div>
                <div className="flex justify-between">
                  <span>Открытый интерес Put:</span>
                  <span>{selectedStrikeDetail.putOi.toLocaleString()} контр.</span>
                </div>
                <div className="flex justify-between">
                  <span>Объем торгов (Call / Put):</span>
                  <span>{selectedStrikeDetail.callVolume} / {selectedStrikeDetail.putVolume}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStrikeDetail(null)}
                className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold transition cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}



        {/* ======================================================== */}
        {/* 🎚️ HUD & DISPLAY SETTINGS MODAL (Accessible to ALL users) */}
        {/* ======================================================== */}
        {isUserSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div
              className="border rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 font-sans text-xs relative overflow-hidden"
              style={{ backgroundColor: curPalette.surface, borderColor: curPalette.border }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: curPalette.border }}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/40">
                    <SlidersHorizontal className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Настройки таблицы HUD и экрана</h3>
                    <p className="text-[10.5px] text-gray-400">
                      Шрифты, масштабирование и параметры сводной панели QUANTEX
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUserSettingsModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Settings Body */}
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* 1. HUD Table Font Size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-300">
                      Размер шрифта строк HUD:
                    </label>
                    <span className="font-mono text-cyan-300 font-bold">{hudFontSize}px</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[9, 10, 11, 12, 13, 14].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setHudFontSize(sz)}
                        className={`py-1.5 rounded-lg border font-mono text-xs font-bold transition cursor-pointer ${
                          hudFontSize === sz
                            ? "bg-cyan-500/20 border-cyan-400 text-white"
                            : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. HUD Scale Percentage */}
                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: curPalette.border }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-300">
                      Масштаб таблицы HUD:
                    </label>
                    <span className="font-mono text-amber-300 font-bold">{hudScale}%</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[70, 80, 90, 100, 115, 130].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setHudScale(sc)}
                        className={`py-1.5 rounded-lg border font-mono text-xs font-bold transition cursor-pointer ${
                          hudScale === sc
                            ? "bg-amber-500/20 border-amber-400 text-white"
                            : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        {sc}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. View Mode (Полный / Мини / Ультра-Микро) */}
                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: curPalette.border }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-300">
                      Режим детализации таблицы HUD:
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "Полный", label: "Полный (Все 11 строк)" },
                      { id: "Мини", label: "Мини (Компактный)" },
                      { id: "Ультра-Микро", label: "Ультра-Микро" }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setTblViewMode(mode.id as any)}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition cursor-pointer text-center truncate ${
                          tblViewMode.includes(mode.id)
                            ? "bg-cyan-500/20 border-cyan-400 text-white"
                            : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Default HUD Position on Screen */}
                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: curPalette.border }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-300">
                      Положение HUD по умолчанию:
                    </label>
                    <button
                      type="button"
                      onClick={() => setHudPos(null)}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Сбросить к углу
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      "Верхний левый",
                      "Верхний правый",
                      "Внизу по центру",
                      "Нижний левый",
                      "Нижний правый"
                    ].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => {
                          setTablePos(pos as any);
                          setHudPos(null);
                        }}
                        className={`py-1.5 px-2 rounded-lg border text-[10.5px] font-bold transition cursor-pointer text-center truncate ${
                          tablePos === pos
                            ? "bg-amber-500/20 border-amber-400 text-white"
                            : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Chart Labels Font Size (Especially for Mobile) */}
                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: curPalette.border }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[11px] font-bold text-gray-300">
                        Размер надписей на графике:
                      </label>
                      <p className="text-[10px] text-gray-500">
                        SL, TP, зоны OTE/OB, уровни гаммы (для мобильных рекомендуется 7px или 8px)
                      </p>
                    </div>
                    <span className="font-mono text-cyan-300 font-bold">{chartLabelFontSize}px</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[7, 8, 9, 10, 11, 12].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleUpdateChartFontSize(sz)}
                        className={`py-1.5 rounded-lg border font-mono text-xs font-bold transition cursor-pointer ${
                          chartLabelFontSize === sz
                            ? "bg-cyan-500/20 border-cyan-400 text-white"
                            : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Chart Badge Borders */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-900/50 border border-gray-800 pt-2">
                  <div>
                    <div className="font-bold text-white text-xs">Рамки вокруг надписей на графике</div>
                    <div className="text-[10px] text-gray-400">На мобильных устройствах отключены по умолчанию для компактности</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleChartBadgeBorders(!showChartBadgeBorders)}
                    className={`px-3 py-1 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                      showChartBadgeBorders
                        ? "bg-cyan-500/20 border border-cyan-400 text-cyan-300"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {showChartBadgeBorders ? "ВКЛ" : "ВЫКЛ"}
                  </button>
                </div>

                {/* 7. Sound Alerts */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-900/50 border border-gray-800 pt-2">
                  <div>
                    <div className="font-bold text-white text-xs">Звуковые алерты уровней</div>
                    <div className="text-[10px] text-gray-400">Оповещения при пробое Call/Put Wall или смене тренда</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundAlertsEnabled(prev => !prev)}
                    className={`px-3 py-1 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                      soundAlertsEnabled
                        ? "bg-emerald-500/20 border border-emerald-400 text-emerald-300"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {soundAlertsEnabled ? "ВКЛ" : "ВЫКЛ"}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: curPalette.border }}>
                <span className="text-[10.5px] text-gray-400">
                  💾 Сохраняются в браузере и на сервере (data/station-settings.json)
                </span>
                <button
                  type="button"
                  onClick={() => setIsUserSettingsModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] cursor-pointer transition shadow-md"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
