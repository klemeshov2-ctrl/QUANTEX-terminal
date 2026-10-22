export interface Candlestick {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number; // Volume delta (buy volume - sell volume)
  cvd: number; // Cumulative Volume Delta
}

export interface FVGZone {
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  isMitigated: boolean;
}

export interface OrderBlock {
  index: number;
  endIndex: number;
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  isMitigated: boolean;
  testCount: number;
}

export interface StructureBreak {
  index: number;
  type: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  price: number;
  label: string;
  swingIndex?: number;
}

export interface IndicatorSettings {
  // Machine Learning (Lorentzian / KNN Classifier) parameters
  mlEnabled: boolean;
  featureCount: number; // Number of indicators in feature space (RSI, CCI, ADX, WT)
  neighborCount: number; // K neighbors
  lorentzianThreshold: number; // Signal strength threshold
  useRSI: boolean;
  useCCI: boolean;
  useADX: boolean;
  useWaveTrend: boolean;

  // voldelta (CVD) parameters
  deltaSmoothing: number; // MA length for delta
  deltaThreshold: number; // Percentile or multiplier for extreme delta

  // Market Narrative (SMC) parameters
  structureLookback: number; // Swing high/low lookback period
  showFVG: boolean;
  showOB: boolean;
  showBOS: boolean;
  
  // Reversal Zones and Forecasts (Pine Script v6 matching)
  showReversalZones: boolean;
  showPriceForecast: boolean;
  showProbabilities: boolean;
  showDashboardTable: boolean;
  
  // Wave Forecast customizable parameters
  forecastLookback: number; // max bars back to anchor
  forecastTargetMult: number; // multiplier for target expansions
  forecastShowPostTarget: boolean; // show Leg 4 post-target retests
  forecastModelAccuracy: 'SMC-Balanced' | 'Conservative' | 'Aggressive';
  showSweepLabels?: boolean; // toggle to hide SWEEP text/badge labels
  selectedPreset?: string;
  showDashboard?: boolean;
  orderBlockPeriod?: number;
  showOrderBlocks?: boolean;
  showFvg?: boolean;
  showWaveForecast?: boolean;
  showMlSignals?: boolean;
  mobileOptimized?: boolean;
  moexTableMode?: 'desktop' | 'mobile_compact' | 'mobile_mini' | 'mobile_ultra';
  superTableMode?: 'desktop' | 'mobile_compact' | 'mobile_mini' | 'mobile_ultra';
  mobileShortText?: boolean;
  moexOscillatorPane?: boolean;
  moexOscMode?: 'macd' | 'rsi' | 'both' | 'off';
  superOscillatorPane?: boolean;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  asset: string;
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  profit: number; // percentage profit or currency profit
  profitPct: number;
  status: 'OPEN' | 'CLOSED';
  reason: string; // e.g., "ML Buy Signal + Bearish OB Break"
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage
  profitFactor: number;
  netProfitPct: number;
  maxDrawdown: number;
  equityCurve: { name: string; equity: number }[];
}

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
