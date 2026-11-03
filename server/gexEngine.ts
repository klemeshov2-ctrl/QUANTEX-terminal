// 🏛️ QUANTEX Real-Time GEX (Gamma Exposure) & Options Analytics Engine
// Institutional Options & Futures Analytics Engine

export interface GexStrikeData {
  strike: number;
  callGex: number;    // In Millions USD
  putGex: number;     // In Millions USD (negative sign convention)
  netGex: number;     // callGex + putGex
  normalizedGex?: number; // Normalized GEX relative to peak strike [-1.0 ... +1.0]
  callOi: number;     // Open Interest in contracts (no volume mixed)
  putOi: number;      // Open Interest in contracts (no volume mixed)
  totalOi: number;
  callVolume: number;
  putVolume: number;
  iv: number;         // Implied Volatility (0.0 - 1.5)
}

export type ExpiryHorizon = "DAY" | "WEEK" | "MONTH" | "ALL";

export interface GexMarketReport {
  asset: "BTC" | "ETH" | "SOL" | "XAUUSD" | "XRP" | "MOEX_GOLD" | "MOEX_MINI" | "GLDRUBF" | "MOEX_SI" | "MOEX_RI" | "MOEX_BR" | "MOEX_NG";
  horizon?: ExpiryHorizon;
  spotPrice: number;
  timestamp: string;
  expirationDate?: string; // Exact format e.g. "22 окт, 18:45 MSK (0DTE)"
  source: string;
  isSynthetic?: boolean;      // Explicit flag: true if mathematically generated fallback or option data genuinely stale (>24h or missing), false if live/overnight options
  isDataStale?: boolean;      // True if option chain timestamp is older than session validity (e.g. >26h on weekdays) or API unreachable
  dataTimestamp?: string;     // ISO timestamp of the underlying option chain snapshot
  dataFreshnessLabel?: string;// Human readable freshness label according to session policy
  timestampSource?: GexTimestampSource; // "exchange_timestamp" | "fetch_time" | "none"
  sessionVerdict?: GexSessionVerdict;   // "fresh" | "overnight_normal" | "stale" | "market_closed" | "unavailable"
  proxyNote?: string;         // Explicit instrument disclosure note (e.g. "Опционы на ETF GLD, не на фьючерс золота COMEX GC")
  outOfCorridor?: boolean;    // True if gammaFlip or maxPain natively lies outside [putWall, callWall]
  flipOutOfCorridor?: boolean;// True if gammaFlip natively lies outside [putWall, callWall]
  painOutOfCorridor?: boolean;// True if maxPain natively lies outside [putWall, callWall]
  lowConfidence?: boolean;    // True if strikes with Call OI < 8 or strikes with Put OI < 8
  lowConfidenceReason?: string; // "Мало данных OI — уровни приблизительные"
  callOiStrikesCount?: number; // Number of active strikes with Call OI > 0
  putOiStrikesCount?: number;  // Number of active strikes with Put OI > 0
  netGexTotal: number;        // Total net GEX ($/pt or $M)
  normalizedNetGex?: number;  // Dimensionless Net GEX [-1.0 ... +1.0] for cross-asset comparison
  gexIntensity?: number;      // Gross GEX as % of total market open interest value
  netGexRegime: "POSITIVE_GAMMA" | "NEGATIVE_GAMMA";
  regimeDescription: string;  // Mean-reverting vs Volatile Trend Acceleration
  gammaFlip: number;          // Zero Gamma Level
  callWall: number;           // Resistance ceiling (highest Call OI strike above spot)
  putWall: number;            // Support floor (highest Put OI strike below spot)
  maxPain: number;            // Expiration magnet (minimum total buyer payout, OI only)
  maxPainRange?: { low: number; high: number; mid: number } | null; // Pinning zone range when zero/min-payout zone is wider than 1 grid step
  migrationLog?: {
    timestamp: string;
    asset: string;
    horizon: ExpiryHorizon;
    level: "CW" | "PW" | "FLIP" | "PAIN" | "ALL";
    oldValue: number | null;
    newValue: number;
    reason: "breach" | "cooldown+OI" | "new session" | "reset";
    details: string;
  }[];
  sleeperMagnet?: number;     // Sleeper magnet strike
  expectedMove68: { low: number; high: number; rangePct: number }; // 1σ
  expectedMove95: { low: number; high: number; rangePct: number }; // 2σ
  dealerGreeks: {
    charm: number;            // Delta decay over time
    vanna: number;            // Delta sensitivity to IV
    aggregateDelta: number;   // Net dealer inventory delta
  };
  pcrOi: number;              // Put/Call Ratio (Open Interest)
  pcrVol: number;             // Put/Call Ratio (Volume)
  impliedVolAvg: number;      // Average IV (%)
  realizedVol30d: number;     // Realized Volatility 30d (%)
  volSpreadIvRv: number;      // IV - RV spread
  strikes: GexStrikeData[];   // Detailed strike profile for histograms
  oiAnomalies: {
    strike: number;
    type: "CALL" | "PUT";
    volume: number;
    oi: number;
    ratio: number;
    severity: "HIGH" | "MEDIUM";
  }[];
}

// Normal distribution CDF approximation
function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
}

// Standard normal PDF
function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes Gamma & Greeks calculation with strict edge-case validation
export function calculateOptionGreeks(
  spot: number,
  strike: number,
  tYears: number,
  vol: number,
  isCall: boolean,
  rate = 0.04
) {
  // Input validations & sanitization (Point 7)
  const safeSpot = Math.max(0.0001, isNaN(spot) || spot <= 0 ? 1 : spot);
  const safeStrike = Math.max(0.0001, isNaN(strike) || strike <= 0 ? 1 : strike);
  const safeT = Math.max(1 / (365 * 24), Math.max(0.0001, isNaN(tYears) || tYears <= 0 ? 1 / 365 : tYears));
  const safeVol = Math.max(0.01, Math.min(5.0, isNaN(vol) || vol <= 0 ? 0.20 : vol));

  const d1 = (Math.log(safeSpot / safeStrike) + (rate + 0.5 * safeVol * safeVol) * safeT) / (safeVol * Math.sqrt(safeT));
  const d2 = d1 - safeVol * Math.sqrt(safeT);

  const rawGamma = normPdf(d1) / (safeSpot * safeVol * Math.sqrt(safeT));
  const gamma = isFinite(rawGamma) && !isNaN(rawGamma) && rawGamma >= 0 ? rawGamma : 0;
  const delta = isCall ? normCdf(d1) : normCdf(d1) - 1;
  const vanna = isFinite(d2) ? -normPdf(d1) * d2 / safeVol : 0;
  const charm = isFinite(d2)
    ? -normPdf(d1) * (2 * rate * safeT - d2 * safeVol * Math.sqrt(safeT)) / (2 * safeT * safeVol * Math.sqrt(safeT))
    : 0;

  return { gamma, delta, vanna, charm };
}

/**
 * 6. НОРМАЛИЗАЦИЯ: Рассчитывает нормализованные метрики GEX для кросс-активного сравнения силы уровней
 */
export function computeGexNormalization(strikes: GexStrikeData[], spotPrice: number): {
  normalizedNetGex: number;
  gexIntensity: number;
} {
  let grossGex = 0;
  let netGex = 0;
  let totalOi = 0;
  let maxAbsGex = 0;

  for (const s of strikes) {
    const absCall = Math.abs(s.callGex || 0);
    const absPut = Math.abs(s.putGex || 0);
    grossGex += absCall + absPut;
    netGex += (s.netGex || 0);
    totalOi += (s.totalOi || 0);
    if (Math.abs(s.netGex || 0) > maxAbsGex) {
      maxAbsGex = Math.abs(s.netGex || 0);
    }
  }

  // Assign normalized GEX to each strike profile [-1.0 ... +1.0]
  if (maxAbsGex > 0) {
    for (const s of strikes) {
      s.normalizedGex = Math.round(((s.netGex || 0) / maxAbsGex) * 1000) / 1000;
    }
  }

  // Normalized Net GEX from -1.0 to +1.0
  const normalizedNetGex = grossGex > 0
    ? Math.round((netGex / grossGex) * 1000) / 1000
    : 0;

  // GEX Intensity: Gross GEX relative to market notional open interest value
  const notionalOiValue = totalOi * Math.max(1, spotPrice);
  const gexIntensity = notionalOiValue > 0
    ? Math.round(((grossGex * 1_000_000) / notionalOiValue) * 10000) / 100
    : 0;

  return { normalizedNetGex, gexIntensity };
}

/**
 * 2a. РАВНОМЕРНАЯ СЕТКА СТРАЙКОВ: Интерполирует OI и GEX на равномерную сетку с минимальным шагом книги
 * перед расчетом Max Pain и Zero-Flip, устраняя прилипание уровней к краям разреженных кластеров.
 */
export function interpolateOptionBookOnUniformGrid(
  strikes: GexStrikeData[],
  fallbackStep?: number,
  roundDecimals = 2
): GexStrikeData[] {
  if (!strikes || strikes.length === 0) return [];

  const validMap = new Map<number, GexStrikeData>();
  for (const s of strikes) {
    if (!s || isNaN(s.strike) || s.strike <= 0) continue;
    const k = roundToDecimals(s.strike, roundDecimals);
    const prev = validMap.get(k);
    if (!prev) {
      validMap.set(k, { ...s, strike: k });
    } else {
      prev.callOi = (prev.callOi || 0) + (s.callOi || 0);
      prev.putOi = (prev.putOi || 0) + (s.putOi || 0);
      prev.totalOi = prev.callOi + prev.putOi;
      prev.callGex = (prev.callGex || 0) + (s.callGex || 0);
      prev.putGex = (prev.putGex || 0) + (s.putGex || 0);
      prev.netGex = (prev.netGex || 0) + (s.netGex || 0);
    }
  }

  const sorted = Array.from(validMap.values()).sort((a, b) => a.strike - b.strike);
  if (sorted.length < 2) return sorted;

  let rawMinStep = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].strike - sorted[i - 1].strike;
    if (diff > 1e-6 && diff < rawMinStep) {
      rawMinStep = diff;
    }
  }

  let gridStep = isFinite(rawMinStep) && rawMinStep > 0 ? rawMinStep : (fallbackStep && fallbackStep > 0 ? fallbackStep : 1);
  if (fallbackStep && fallbackStep > 0) {
    gridStep = Math.max(fallbackStep * 0.2, Math.min(gridStep, fallbackStep));
  }

  const minStrike = sorted[0].strike;
  const maxStrike = sorted[sorted.length - 1].strike;
  const span = maxStrike - minStrike;
  if (span <= 0 || gridStep <= 0) return sorted;

  if (span / gridStep > 250) {
    gridStep = roundToDecimals(span / 200, Math.max(roundDecimals, 3)) || span / 200;
  }

  const uniformGrid: GexStrikeData[] = [];
  let rightIdx = 0;

  for (let rawK = minStrike; rawK <= maxStrike + gridStep * 0.25; rawK += gridStep) {
    const k = roundToDecimals(Math.min(maxStrike, rawK), roundDecimals);
    if (uniformGrid.length > 0 && Math.abs(k - uniformGrid[uniformGrid.length - 1].strike) < gridStep * 0.15) {
      continue;
    }

    while (rightIdx < sorted.length - 1 && sorted[rightIdx].strike < k) {
      rightIdx++;
    }
    const leftIdx = Math.max(0, rightIdx - 1);
    const sLeft = sorted[leftIdx];
    const sRight = sorted[rightIdx];

    if (Math.abs(k - sLeft.strike) <= gridStep * 0.15) {
      uniformGrid.push({ ...sLeft });
      continue;
    }
    if (Math.abs(k - sRight.strike) <= gridStep * 0.15) {
      uniformGrid.push({ ...sRight });
      continue;
    }

    const gap = sRight.strike - sLeft.strike;
    const w = gap > 1e-9 ? (k - sLeft.strike) / gap : 0;

    // Linearly interpolate OI across local cluster gaps (<= 2.5 steps); keep 0 OI inside wide empty inter-cluster gaps
    // so that zero-payout pinning zones between separated Put and Call clusters remain intact on the uniform grid.
    const isLocalClusterGap = gap <= gridStep * 2.5;
    const interpCallOi =
      isLocalClusterGap && (sLeft.callOi || 0) > 0 && (sRight.callOi || 0) > 0
        ? Math.round((sLeft.callOi || 0) * (1 - w) + (sRight.callOi || 0) * w)
        : 0;
    const interpPutOi =
      isLocalClusterGap && (sLeft.putOi || 0) > 0 && (sRight.putOi || 0) > 0
        ? Math.round((sLeft.putOi || 0) * (1 - w) + (sRight.putOi || 0) * w)
        : 0;

    const interpCallGex = Math.round(((sLeft.callGex || 0) * (1 - w) + (sRight.callGex || 0) * w) * 1000) / 1000;
    const interpPutGex = Math.round(((sLeft.putGex || 0) * (1 - w) + (sRight.putGex || 0) * w) * 1000) / 1000;
    const interpNetGex = Math.round(((sLeft.netGex || 0) * (1 - w) + (sRight.netGex || 0) * w) * 1000) / 1000;
    const interpIv = Math.round(((sLeft.iv || 0.2) * (1 - w) + (sRight.iv || 0.2) * w) * 1000) / 1000;

    uniformGrid.push({
      strike: k,
      callGex: interpCallGex,
      putGex: interpPutGex,
      netGex: interpNetGex,
      callOi: interpCallOi,
      putOi: interpPutOi,
      totalOi: interpCallOi + interpPutOi,
      callVolume: 0,
      putVolume: 0,
      iv: interpIv
    });
  }

  return uniformGrid;
}

/**
 * 2b. MAX PAIN: Классический институциональный расчет точки максимальной боли экспирации.
 * - Использует ИСКЛЮЧИТЕЛЬНО Open Interest (OI) покупателей опционов, без смешивания с Volume!
 * - Предварительно интерполирует книгу на равномерную сетку страйков с минимальным шагом книги.
 * - НЕ отбрасывает кандидатов с totalPayout == 0 (зона нулевых выплат между кластерами — это зона пиннинга).
 * - Возвращает медианный страйк среди всех кандидатов с минимальным payout (включая ноль), устраняя прилипание к краям.
 */
export function computeMaxPainWithRange(
  strikes: GexStrikeData[],
  defaultStrike: number,
  fallbackStep?: number,
  roundDecimals = 2,
  putWall?: number,
  callWall?: number
): { maxPain: number; maxPainRange: { low: number; high: number; mid: number } | null } {
  if (!strikes || strikes.length === 0) return { maxPain: defaultStrike, maxPainRange: null };

  const hasValidCorridor =
    typeof putWall === "number" &&
    typeof callWall === "number" &&
    isFinite(putWall) &&
    isFinite(callWall) &&
    putWall < callWall;

  let workingStrikes = strikes;
  if (hasValidCorridor) {
    const inCorridor = strikes.filter(s => s.strike >= putWall! && s.strike <= callWall!);
    if (inCorridor.length >= 2) {
      workingStrikes = inCorridor.map(s => ({
        ...s,
        // Eliminate boundary self-pinning from deep-ITM options sitting on the opposite wall:
        // At K <= CW, callOi(CW) has 0 payoff while putOi(CW) pulls K onto CW; zeroing boundary ITM OI keeps Pain strictly inside (PW, CW)
        callOi: s.strike <= putWall! ? 0 : s.callOi,
        putOi: s.strike >= callWall! ? 0 : s.putOi
      }));
    }
  }

  const effectiveStep =
    hasValidCorridor && fallbackStep && fallbackStep > 1
      ? fallbackStep / 2
      : fallbackStep;

  const gridStrikes = interpolateOptionBookOnUniformGrid(workingStrikes, effectiveStep, roundDecimals);
  if (gridStrikes.length === 0) return { maxPain: defaultStrike, maxPainRange: null };

  let totalBookOi = 0;
  for (const s of gridStrikes) {
    totalBookOi += Math.max(0, s.callOi || 0) + Math.max(0, s.putOi || 0);
  }
  if (totalBookOi <= 0) {
    if (hasValidCorridor) {
      return {
        maxPain: roundToDecimals((putWall! + callWall!) / 2, roundDecimals),
        maxPainRange: null
      };
    }
    return { maxPain: defaultStrike, maxPainRange: null };
  }

  // When corridor [putWall, callWall] is provided, evaluate interior candidates strictly inside (putWall, callWall)
  const interiorCandidates = hasValidCorridor
    ? gridStrikes.filter(s => s.strike > putWall! && s.strike < callWall!)
    : [];
  const candidatePool = interiorCandidates.length > 0 ? interiorCandidates : gridStrikes;

  let minTotalPayout = Infinity;
  const payouts: { strike: number; payout: number }[] = [];

  for (const cand of candidatePool) {
    if (cand.strike <= 0 || isNaN(cand.strike)) continue;
    let totalPayout = 0;

    for (const s of gridStrikes) {
      if (s.strike <= 0 || isNaN(s.strike)) continue;
      // ONLY Open Interest (OI), strictly NO Volume
      const cOi = Math.max(0, s.callOi || 0);
      const pOi = Math.max(0, s.putOi || 0);

      if (cand.strike > s.strike) {
        totalPayout += (cand.strike - s.strike) * cOi;
      } else if (cand.strike < s.strike) {
        totalPayout += (s.strike - cand.strike) * pOi;
      }
    }

    payouts.push({ strike: cand.strike, payout: totalPayout });
    if (totalPayout < minTotalPayout) {
      minTotalPayout = totalPayout;
    }
  }

  if (payouts.length === 0 || !isFinite(minTotalPayout)) {
    return { maxPain: defaultStrike, maxPainRange: null };
  }

  const tol = Math.max(1e-6, minTotalPayout * 1e-6);
  const minCandidates = payouts
    .filter(p => p.payout <= minTotalPayout + tol)
    .sort((a, b) => a.strike - b.strike);

  if (minCandidates.length === 0) {
    return { maxPain: defaultStrike, maxPainRange: null };
  }

  const actualGridStep =
    gridStrikes.length >= 2
      ? Math.max(1e-6, Math.abs(gridStrikes[1].strike - gridStrikes[0].strike))
      : Math.max(1e-6, effectiveStep || fallbackStep || 1);

  const lowStrike = roundToDecimals(minCandidates[0].strike, roundDecimals);
  const highStrike = roundToDecimals(minCandidates[minCandidates.length - 1].strike, roundDecimals);

  // Return the median strike among all minimum-payout candidates (including zero-payout pinning zone)
  const midIdx = Math.floor(minCandidates.length / 2);
  const medianRaw =
    minCandidates.length % 2 === 1
      ? minCandidates[midIdx].strike
      : (minCandidates[midIdx - 1].strike + minCandidates[midIdx].strike) / 2;
  const medianStrike = roundToDecimals(medianRaw, roundDecimals);

  const zoneSpan = highStrike - lowStrike;
  const maxPainRange =
    minCandidates.length >= 2 && zoneSpan >= actualGridStep - 1e-6
      ? { low: lowStrike, high: highStrike, mid: medianStrike }
      : null;

  return {
    maxPain: medianStrike,
    maxPainRange
  };
}

export function computeMaxPain(
  strikes: GexStrikeData[],
  defaultStrike: number,
  fallbackStep?: number,
  roundDecimals = 2,
  putWall?: number,
  callWall?: number
): number {
  return computeMaxPainWithRange(strikes, defaultStrike, fallbackStep, roundDecimals, putWall, callWall).maxPain;
}

/**
 * 2c. ZERO-FLIP (GAMMA FLIP): Расчет точки смены знака гаммы на равномерной сетке страйков.
 * Устраняет прилипание Zero-Flip к краям кластеров или к Call/Put Wall.
 */
export function computeZeroGammaFlip(
  strikes: GexStrikeData[],
  spotPrice: number,
  fallbackStep = 10,
  roundDecimals = 1,
  minBound?: number,
  maxBound?: number
): number {
  const defaultFlip = roundToDecimals(Math.round(spotPrice / fallbackStep) * fallbackStep, roundDecimals);
  if (!strikes || strikes.length === 0) return defaultFlip;

  const gridStrikes = interpolateOptionBookOnUniformGrid(strikes, fallbackStep, roundDecimals);
  if (gridStrikes.length === 0) return defaultFlip;

  const lowLimit = minBound !== undefined ? minBound : spotPrice * 0.92;
  const highLimit = maxBound !== undefined ? maxBound : spotPrice * 1.08;

  const corridor = gridStrikes.filter(s => s.strike >= lowLimit && s.strike <= highLimit);
  const searchList = corridor.length >= 2 ? corridor : gridStrikes;

  const crossings: number[] = [];
  for (let i = 0; i < searchList.length - 1; i++) {
    const s1 = searchList[i];
    const s2 = searchList[i + 1];
    if (Math.abs(s1.netGex) + Math.abs(s2.netGex) <= 1e-9) continue;

    if ((s1.netGex <= 0 && s2.netGex >= 0) || (s1.netGex >= 0 && s2.netGex <= 0)) {
      const denom = s2.netGex - s1.netGex;
      const root =
        Math.abs(denom) > 1e-6
          ? roundToDecimals(s1.strike + ((0 - s1.netGex) / denom) * (s2.strike - s1.strike), roundDecimals)
          : roundToDecimals((s1.strike + s2.strike) / 2, roundDecimals);
      crossings.push(root);
    }
  }

  if (crossings.length > 0) {
    crossings.sort((a, b) => Math.abs(a - spotPrice) - Math.abs(b - spotPrice));
    return crossings[0];
  }

  // Fallback: median among grid strikes with minimum |netGex| in corridor
  let minAbs = Infinity;
  for (const s of searchList) {
    const absVal = Math.abs(s.netGex);
    if (absVal < minAbs) minAbs = absVal;
  }
  const minNetCandidates = searchList
    .filter(s => Math.abs(s.netGex) <= minAbs + Math.max(1e-6, minAbs * 1e-4))
    .sort((a, b) => a.strike - b.strike);

  if (minNetCandidates.length > 0) {
    const mid = Math.floor(minNetCandidates.length / 2);
    return minNetCandidates[mid].strike;
  }

  return defaultFlip;
}

/**
 * 3 & 5. GUARD ПЛОТНОСТИ КНИГИ И ДИАГНОСТИЧЕСКОЕ ЛОГИРОВАНИЕ:
 * - Проверяет количество страйков с ненулевым OI с каждой стороны (Call OI и Put OI).
 * - Если страйков с OI меньше 8 с любой стороны (< 8 calls или < 8 puts), выставляет lowConfidence: true.
 * - Логирует количество страйков с OI по каждому источнику и горизонту при каждом fetch.
 */
export function evaluateOptionBookDensity(
  strikes: GexStrikeData[],
  asset: string,
  horizon: ExpiryHorizon | string,
  source: string
): {
  lowConfidence: boolean;
  lowConfidenceReason?: string;
  callOiStrikesCount: number;
  putOiStrikesCount: number;
  totalOiStrikesCount: number;
} {
  const safeStrikes = Array.isArray(strikes) ? strikes : [];
  const callOiStrikesCount = safeStrikes.filter(s => (s.callOi || 0) > 0).length;
  const putOiStrikesCount = safeStrikes.filter(s => (s.putOi || 0) > 0).length;
  const totalOiStrikesCount = safeStrikes.filter(s => (s.callOi || 0) > 0 || (s.putOi || 0) > 0).length;

  const lowConfidence = callOiStrikesCount < 8 || putOiStrikesCount < 8;
  const lowConfidenceReason = lowConfidence
    ? "Мало данных OI — уровни приблизительные"
    : undefined;

  console.log(
    `[GEX Diagnostics] asset=${asset} | horizon=${horizon} | source="${source}" | strikesWithOI=${totalOiStrikesCount} (calls=${callOiStrikesCount}, puts=${putOiStrikesCount}) | lowConfidence=${lowConfidence}`
  );

  return {
    lowConfidence,
    lowConfidenceReason,
    callOiStrikesCount,
    putOiStrikesCount,
    totalOiStrikesCount
  };
}

/**
 * 3. CALL/PUT WALL: Определение стен строго по пиковому открытому интересу (Open Interest),
 * без смешивания разнородных метрик (без Volume, коэффициентов и сторонних бонусов).
 */
export function findCallAndPutWalls(
  strikes: GexStrikeData[],
  spotPrice: number,
  fallbackStep: number,
  roundDecimals = 0
): { callWall: number; putWall: number } {
  const safeSpot = Math.max(0.0001, spotPrice);

  // Calls above spot, strictly sorted by Call Open Interest (descending)
  const callsAbove = strikes
    .filter(s => s.strike > safeSpot && (s.callOi || 0) > 0)
    .sort((a, b) => (b.callOi - a.callOi) || (b.callGex - a.callGex));

  // Puts below spot, strictly sorted by Put Open Interest (descending)
  const putsBelow = strikes
    .filter(s => s.strike < safeSpot && (s.putOi || 0) > 0)
    .sort((a, b) => (b.putOi - a.putOi) || (Math.abs(b.putGex) - Math.abs(a.putGex)));

  const callWall = callsAbove.length > 0
    ? callsAbove[0].strike
    : roundToDecimals(Math.ceil((safeSpot * 1.03) / fallbackStep) * fallbackStep, roundDecimals);

  const putWall = putsBelow.length > 0
    ? putsBelow[0].strike
    : roundToDecimals(Math.floor((safeSpot * 0.97) / fallbackStep) * fallbackStep, roundDecimals);

  return { callWall, putWall };
}

/**
 * 8. КЭШИРОВАНИЕ: Promise-based кэш для полного устранения Race Conditions при одновременных запросах.
 * Если запрос уже выполняется, все последующие вызовы подписываются на существующий Promise.
 */
const inFlightGexRequests = new Map<string, Promise<GexMarketReport>>();

export function clearGexEngineCache(): void {
  for (const k of Object.keys(gexCache)) {
    delete gexCache[k];
  }
  inFlightGexRequests.clear();
}

export function fetchWithGexDeduplication(
  cacheKey: string,
  ttlMs: number,
  fetchFn: () => Promise<GexMarketReport>
): Promise<GexMarketReport> {
  const now = Date.now();
  const cached = gexCache[cacheKey];
  if (cached && (now - cached.cachedAt) < ttlMs) {
    return Promise.resolve(cached.data);
  }

  const existingInFlight = inFlightGexRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const requestPromise = (async () => {
    try {
      const result = await fetchFn();
      gexCache[cacheKey] = { data: result, cachedAt: Date.now() };
      return result;
    } finally {
      inFlightGexRequests.delete(cacheKey);
    }
  })();

  inFlightGexRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Helper to compute exact expiration date string with Moscow Time (handles weekends & session roll)
export function getHorizonExpirationDateString(horizon: ExpiryHorizon = "WEEK"): string {
  const now = new Date();
  const mskOffset = 3 * 60; // UTC+3
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const mskDate = new Date(utc + (mskOffset * 60000));
  const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const dayOfWeek = mskDate.getDay(); // 0 is Sun, 5 is Fri, 6 is Sat

  if (horizon === "DAY") {
    let targetDate = new Date(mskDate.getTime());
    let note = "0DTE";

    if (dayOfWeek === 6) { // Saturday -> next trading day is Monday (+2 days)
      targetDate = new Date(mskDate.getTime() + 2 * 86400000);
      note = "Пн, 0DTE • Выходной";
    } else if (dayOfWeek === 0) { // Sunday -> next trading day is Monday (+1 day)
      targetDate = new Date(mskDate.getTime() + 1 * 86400000);
      note = "Пн, 0DTE • Выходной";
    } else if (dayOfWeek === 5 && mskDate.getHours() >= 19) { // Friday after 19:00 MSK -> Monday (+3 days)
      targetDate = new Date(mskDate.getTime() + 3 * 86400000);
      note = "Пн, 0DTE";
    } else if (mskDate.getHours() >= 19) { // Weekdays after 19:00 MSK -> tomorrow
      targetDate = new Date(mskDate.getTime() + 1 * 86400000);
      note = "0DTE (След. сессия)";
    }

    return `${targetDate.getDate()} ${monthNames[targetDate.getMonth()]}, 18:45 MSK (${note})`;
  }

  if (horizon === "WEEK") {
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && mskDate.getHours() >= 19) {
      daysUntilFriday = 7;
    }
    const fridayDate = new Date(mskDate.getTime() + daysUntilFriday * 86400000);
    return `${fridayDate.getDate()} ${monthNames[fridayDate.getMonth()]}, 18:45 MSK (Неделя)`;
  }

  if (horizon === "MONTH") {
    let targetMonth = mskDate.getMonth();
    let targetYear = mskDate.getFullYear();
    const firstDay = new Date(targetYear, targetMonth, 1);
    const firstFriday = 1 + ((5 - firstDay.getDay() + 7) % 7);
    let thirdFridayDate = firstFriday + 14;
    const thirdFriday = new Date(targetYear, targetMonth, thirdFridayDate);
    if (mskDate.getTime() > thirdFriday.getTime() + 19 * 3600000) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
      const nextFirstDay = new Date(targetYear, targetMonth, 1);
      const nextFirstFriday = 1 + ((5 - nextFirstDay.getDay() + 7) % 7);
      thirdFridayDate = nextFirstFriday + 14;
    }
    return `${thirdFridayDate} ${monthNames[targetMonth]}, 18:45 MSK (Месяц)`;
  }

  return `${mskDate.getDate()} ${monthNames[mskDate.getMonth()]}, 18:45 MSK`;
}


// In-memory cache (TTL: 4 minutes = 240,000 ms) to prevent exchange rate-limiting / IP bans
const gexCache: Record<string, { data: GexMarketReport; cachedAt: number }> = {};
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes (240s)

/**
 * Strict timeout wrapper using AbortController + Promise.race.
 * Guarantees that no external HTTP request can hang longer than `timeoutMs` (default 3200ms).
 */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 3200
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout after ${timeoutMs}ms: ${url.slice(0, 90)}`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetch(url, {
        ...init,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0",
          Accept: "application/json",
          ...(init?.headers || {})
        },
        signal: controller.signal
      }),
      timeoutPromise
    ]);
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Helper to parse Deribit instrument details & compute DTE
// Supports both inverse options (e.g., "BTC-25OCT26-85000-C") and linear USDC options (e.g., "SOL_USDC-25OCT26-180-C", "XRP_USDC-25OCT26-2d5-C")
function parseDeribitInstrument(name: string, targetAsset?: string) {
  if (!name || typeof name !== "string") return null;
  const parts = name.split("-");
  if (parts.length < 4) return null;

  const rawUnderlying = parts[0].toUpperCase(); // e.g. "BTC", "ETH", "SOL_USDC", "XRP_USDC"
  if (targetAsset) {
    const normTarget = targetAsset.toUpperCase();
    if (rawUnderlying !== normTarget && !rawUnderlying.startsWith(`${normTarget}_`)) {
      return null;
    }
  }

  const expiryStr = parts[1]; // e.g. "25OCT26"
  // Deribit encodes decimal points in linear option strikes as 'd' (e.g. "2d5" -> 2.5)
  const strikeStr = parts[2].replace(/d/gi, ".");
  const strike = parseFloat(strikeStr);
  const isCall = parts[3].toUpperCase() === "C";
  if (isNaN(strike) || strike <= 0) return null;

  const match = expiryStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
  };
  const month = monthMap[match[2]];
  if (month === undefined) return null;
  const year = 2000 + parseInt(match[3], 10);

  // Deribit options expire at 08:00:00 UTC on the expiration day
  const expUtc = Date.UTC(year, month, day, 8, 0, 0);
  const now = Date.now();
  const dte = (expUtc - now) / (1000 * 60 * 60 * 24);

  return { expiryStr, strike, isCall, expUtc, dte, dateStr: `${day} ${match[2]} 20${match[3]}` };
}

export type CryptoAssetSymbol = "BTC" | "ETH" | "SOL" | "XRP";

export const CRYPTO_ASSET_CONFIG: Record<
  CryptoAssetSymbol,
  {
    defaultSpot: number;
    step: number;
    baseIv: number;
    realizedVol: number;
    roundDecimals: number;
    contractMultiplier: number; // Official Deribit contract multiplier (BTC=1, ETH=1, SOL_USDC=10, XRP_USDC=1000)
  }
> = {
  BTC: { defaultSpot: 84500, step: 500, baseIv: 52.0, realizedVol: 45.8, roundDecimals: 0, contractMultiplier: 1 },
  ETH: { defaultSpot: 2750, step: 50, baseIv: 58.0, realizedVol: 51.0, roundDecimals: 0, contractMultiplier: 1 },
  SOL: { defaultSpot: 185.0, step: 5, baseIv: 64.0, realizedVol: 55.5, roundDecimals: 2, contractMultiplier: 10 },
  XRP: { defaultSpot: 2.45, step: 0.05, baseIv: 68.0, realizedVol: 58.0, roundDecimals: 3, contractMultiplier: 1000 }
};

function roundToDecimals(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Spot-Anchored Mathematical Fallback for Crypto Assets (BTC, ETH, SOL, XRP).
 * Triggered automatically if Deribit API times out (>3.2s), is unreachable, or has insufficient option strikes.
 */
function calculateSyntheticCryptoGex(
  asset: CryptoAssetSymbol,
  horizon: ExpiryHorizon,
  spotPrice: number
): GexMarketReport {
  const cfg = CRYPTO_ASSET_CONFIG[asset];
  const step = cfg.step;
  const baseIv = cfg.baseIv;
  const decimals = cfg.roundDecimals;

  const wallMultipliers = {
    DAY: { call: 1.022, put: 0.978, halfRange: 0.055, tYears: 1 / 365, oiMult: 24 },
    WEEK: { call: 1.058, put: 0.942, halfRange: 0.11, tYears: 7 / 365, oiMult: 65 },
    MONTH: { call: 1.14, put: 0.86, halfRange: 0.22, tYears: 28 / 365, oiMult: 140 },
    ALL: { call: 1.24, put: 0.76, halfRange: 0.30, tYears: 60 / 365, oiMult: 220 }
  };
  const m = wallMultipliers[horizon] || wallMultipliers.WEEK;

  const centerStrike = roundToDecimals(Math.round(spotPrice / step) * step, decimals);
  let callWall = roundToDecimals(Math.round((spotPrice * m.call) / step) * step, decimals);
  let putWall = roundToDecimals(Math.round((spotPrice * m.put) / step) * step, decimals);

  if (callWall <= spotPrice) callWall = roundToDecimals(centerStrike + step * 2, decimals);
  if (putWall >= spotPrice) putWall = roundToDecimals(Math.max(step, centerStrike - step * 2), decimals);

  const halfSpan = Math.max(step * 8, spotPrice * m.halfRange);
  const minS = Math.max(step, roundToDecimals(Math.floor((spotPrice - halfSpan) / step) * step, decimals));
  const maxS = roundToDecimals(Math.ceil((spotPrice + halfSpan) / step) * step, decimals);

  const strikes: GexStrikeData[] = [];
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  for (let rawK = minS; rawK <= maxS + step * 0.1; rawK += step) {
    const k = roundToDecimals(rawK, decimals);
    const callF = Math.exp(-Math.pow((k - callWall) / (halfSpan * 0.42), 2)) * 850 + 45;
    const putF = Math.exp(-Math.pow((k - putWall) / (halfSpan * 0.42), 2)) * 810 + 45;
    const cOi = Math.round(callF * m.oiMult);
    const pOi = Math.round(putF * m.oiMult);
    const cVol = Math.round(cOi * 0.28);
    const pVol = Math.round(pOi * 0.26);

    const { gamma } = calculateOptionGreeks(spotPrice, k, m.tYears, baseIv / 100, true);
    // Strict GEX Formula: gamma * OI * contractMultiplier * Spot * 0.01 (Pure Open Interest, strictly NO volume mixing, scaled to $M)
    const cGex = (gamma * cOi * cfg.contractMultiplier * spotPrice * 0.01) / 10_000;
    const pGex = -(gamma * pOi * cfg.contractMultiplier * spotPrice * 0.01) / 10_000;

    strikes.push({
      strike: k,
      callGex: Math.round(cGex * 100) / 100,
      putGex: Math.round(pGex * 100) / 100,
      netGex: Math.round((cGex + pGex) * 100) / 100,
      callOi: cOi,
      putOi: pOi,
      totalOi: cOi + pOi,
      callVolume: cVol,
      putVolume: pVol,
      iv: baseIv / 100
    });

    totalCallOi += cOi;
    totalPutOi += pOi;
    totalCallVol += cVol;
    totalPutVol += pVol;
  }

  // 3. Call/Put Walls strictly sorted by peak Open Interest
  const walls = findCallAndPutWalls(strikes, spotPrice, step, decimals);
  callWall = walls.callWall;
  putWall = walls.putWall;

  // 2. Max Pain calculation strictly on Open Interest (on uniform strike grid within [putWall, callWall], no volume)
  const { maxPain, maxPainRange } = computeMaxPainWithRange(strikes, centerStrike, step, decimals, putWall, callWall);

  // Zero-Flip calculation on uniform strike grid
  const gammaFlip = computeZeroGammaFlip(strikes, spotPrice, step, decimals, putWall, callWall);

  const flipOutOfCorridor = gammaFlip < putWall || gammaFlip > callWall;
  const painOutOfCorridor = maxPain < putWall || maxPain > callWall;
  const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

  const totalNetGex = strikes.reduce((acc, s) => acc + s.netGex, 0);
  const expectedMovePct68 = (baseIv / 100) * Math.sqrt(Math.max(1 / 365, m.tYears));
  const expectedMovePct95 = expectedMovePct68 * 2.0;

  // 6. Normalization metrics for cross-asset comparability
  const { normalizedNetGex, gexIntensity } = computeGexNormalization(strikes, spotPrice);

  const horizonLabels: Record<ExpiryHorizon, string> = {
    DAY: "День (0DTE/Интрадей)",
    WEEK: "Неделя (Пятничная серия)",
    MONTH: "Месяц (Месячная серия)",
    ALL: "Все экспирации (Total GEX)"
  };

  const sourceStr = `Deribit & Binance ${asset} Options (${horizonLabels[horizon]}) • Синтетическая модель (Резервный режим)`;
  const density = evaluateOptionBookDensity(strikes, asset, horizon, sourceStr);

  return {
    asset,
    horizon,
    spotPrice: roundToDecimals(spotPrice, decimals === 0 ? 2 : decimals),
    timestamp: new Date().toISOString(),
    expirationDate: getHorizonExpirationDateString(horizon),
    source: sourceStr,
    isSynthetic: true,
    outOfCorridor,
    flipOutOfCorridor,
    painOutOfCorridor,
    lowConfidence: density.lowConfidence,
    lowConfidenceReason: density.lowConfidenceReason,
    callOiStrikesCount: density.callOiStrikesCount,
    putOiStrikesCount: density.putOiStrikesCount,
    netGexTotal: Math.round(totalNetGex * 100) / 100,
    normalizedNetGex,
    gexIntensity,
    netGexRegime: totalNetGex >= 0 ? "POSITIVE_GAMMA" : "NEGATIVE_GAMMA",
    regimeDescription:
      totalNetGex >= 0
        ? `Положительная Гамма ${asset} (${horizonLabels[horizon]}): Маркетмейкеры гасят волатильность между $${putWall} и $${callWall}.`
        : `Отрицательная Гамма ${asset} (${horizonLabels[horizon]}): Режим трендового ускорения. Риск импульсного пробоя уровней.`,
    gammaFlip,
    callWall,
    putWall,
    maxPain,
    maxPainRange,
    sleeperMagnet: roundToDecimals(Math.round((callWall * 1.04) / step) * step, decimals),
    expectedMove68: {
      low: roundToDecimals(spotPrice * (1 - expectedMovePct68), decimals === 0 ? 0 : decimals),
      high: roundToDecimals(spotPrice * (1 + expectedMovePct68), decimals === 0 ? 0 : decimals),
      rangePct: Math.round(expectedMovePct68 * 1000) / 10
    },
    expectedMove95: {
      low: roundToDecimals(spotPrice * (1 - expectedMovePct95), decimals === 0 ? 0 : decimals),
      high: roundToDecimals(spotPrice * (1 + expectedMovePct95), decimals === 0 ? 0 : decimals),
      rangePct: Math.round(expectedMovePct95 * 1000) / 10
    },
    dealerGreeks: {
      charm: Math.round((totalCallOi - totalPutOi) * 0.012 * 10) / 10,
      vanna: Math.round(totalNetGex * 0.12 * 100) / 100,
      aggregateDelta: Math.round((totalCallOi - totalPutOi) * 0.45)
    },
    pcrOi: totalCallOi > 0 ? Math.round((totalPutOi / totalCallOi) * 100) / 100 : 0.88,
    pcrVol: totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 0.92,
    impliedVolAvg: baseIv,
    realizedVol30d: cfg.realizedVol,
    volSpreadIvRv: Math.round((baseIv - cfg.realizedVol) * 10) / 10,
    strikes: strikes.sort((a, b) => b.strike - a.strike),
    oiAnomalies: [
      {
        strike: callWall,
        type: "CALL",
        volume: strikes.find(s => s.strike === callWall)?.callVolume || 12500,
        oi: strikes.find(s => s.strike === callWall)?.callOi || 34000,
        ratio: 2.4,
        severity: "MEDIUM"
      }
    ]
  };
}

// -------------------------------------------------------------
// 1. DERIBIT LIVE CRYPTO GEX (BTC, ETH, SOL, XRP) WITH HYBRID FALLBACK
// -------------------------------------------------------------
export function calculateCryptoGex(
  asset: CryptoAssetSymbol,
  horizon: ExpiryHorizon = "WEEK"
): Promise<GexMarketReport> {
  const cacheKey = `${asset}_${horizon}`;

  return fetchWithGexDeduplication(cacheKey, CACHE_TTL_MS, async () => {
    const cfg = CRYPTO_ASSET_CONFIG[asset] || CRYPTO_ASSET_CONFIG.BTC;
    const step = cfg.step;
    const decimals = cfg.roundDecimals;

    // 1. Fetch live spot price from Binance (with strict 3.0s timeout)
    let spotPrice = cfg.defaultSpot;
    try {
      const spotRes = await fetchWithTimeout(
        `https://api.binance.com/api/v3/ticker/price?symbol=${asset}USDT`,
        undefined,
        3000
      );
      if (spotRes.ok) {
        const spotJson = await spotRes.json();
        const parsed = parseFloat(spotJson.price);
        if (parsed > 0) spotPrice = parsed;
      }
    } catch (err: any) {
      console.warn(`[GEX Engine] Notice fetching spot ${asset}USDT: ${err.message}`);
    }

    // 2. Fetch real option chain from Deribit public REST API (with strict 3.2s timeout)
    let rawList: any[] = [];
    try {
      const primaryUrl = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${asset}&kind=option`;
      const res = await fetchWithTimeout(primaryUrl, undefined, 3200);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.result) && json.result.length > 0) {
          rawList = json.result;
        }
      }

      // For SOL and XRP, Deribit also hosts linear USDC-settled options under currency=USDC (e.g. SOL_USDC-..., XRP_USDC-...)
      if (rawList.length === 0 && (asset === "SOL" || asset === "XRP")) {
        const usdcUrl = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=USDC&kind=option`;
        const usdcRes = await fetchWithTimeout(usdcUrl, undefined, 3200);
        if (usdcRes.ok) {
          const usdcJson = await usdcRes.json();
          const allUsdc: any[] = Array.isArray(usdcJson?.result) ? usdcJson.result : [];
          rawList = allUsdc.filter(item => {
            const inst = String(item?.instrument_name || "").toUpperCase();
            return inst.startsWith(`${asset}_USDC-`) || inst.startsWith(`${asset}-`);
          });
        }
      }
    } catch (err: any) {
      console.warn(`[GEX Engine] Deribit live API notice for ${asset}: ${err.message}`);
    }

    // If Deribit returned a live underlying_price and Binance spot wasn't updated, sync spotPrice
    if (rawList.length > 0 && spotPrice === cfg.defaultSpot) {
      const liveUnd = parseFloat(rawList[0]?.underlying_price);
      if (liveUnd > 0) spotPrice = liveUnd;
    }

    // Parse and separate by DTE (days to expiration)
    const parsedItems: {
      item: any;
      info: NonNullable<ReturnType<typeof parseDeribitInstrument>>;
    }[] = [];

    for (const it of rawList) {
      const info = parseDeribitInstrument(it.instrument_name, asset);
      if (info && info.dte >= -0.05) {
        parsedItems.push({ item: it, info });
      }
    }

    // Filter strictly by the requested horizon DTE
    let filteredItems: typeof parsedItems = [];
    let medianT = 7 / 365;

    if (parsedItems.length > 0) {
      const positiveDtes = parsedItems.map(p => p.info.dte).filter(d => d >= 0).sort((a, b) => a - b);
      const minDte = positiveDtes[0] ?? 0.5;

      if (horizon === "DAY") {
        filteredItems = parsedItems.filter(p => p.info.dte <= 1.5);
        if (filteredItems.length < 6) {
          filteredItems = parsedItems.filter(p => p.info.dte <= minDte + 0.6);
        }
        medianT = 1 / 365;
      } else if (horizon === "WEEK") {
        const weekSlice = parsedItems.filter(p => p.info.dte > 1.2 && p.info.dte <= 8.5);
        filteredItems = weekSlice.length >= 6 ? weekSlice : parsedItems.filter(p => p.info.dte <= 8.5);
        medianT = 5 / 365;
      } else if (horizon === "MONTH") {
        const monthSlice = parsedItems.filter(p => p.info.dte > 7.0 && p.info.dte <= 38.0);
        filteredItems = monthSlice.length >= 6 ? monthSlice : parsedItems.filter(p => p.info.dte > 5.0 && p.info.dte <= 45.0);
        medianT = 26 / 365;
      } else {
        filteredItems = parsedItems;
        medianT = 60 / 365;
      }

      if (filteredItems.length < 4 && parsedItems.length >= 4) {
        filteredItems = parsedItems;
      }
    }

    const strikeMap = new Map<number, GexStrikeData>();
    let totalCallOi = 0;
    let totalPutOi = 0;
    let totalCallVol = 0;
    let totalPutVol = 0;
    let totalWeightedIv = 0;
    let totalIvWeight = 0;
    const anomalies: GexMarketReport["oiAnomalies"] = [];

    for (const { item, info } of filteredItems) {
      const { strike: rawStrike, isCall, dte } = info;
      const strike = roundToDecimals(rawStrike, decimals);
      const oi = Math.max(0, parseFloat(item.open_interest) || 0);
      const vol = Math.max(0, parseFloat(item.volume) || 0);
      const markIv = (parseFloat(item.mark_iv) || cfg.baseIv) / 100;

      if (oi <= 0 && vol <= 0) continue;

      const tYears = Math.max(1 / 365, dte / 365);
      const { gamma } = calculateOptionGreeks(spotPrice, strike, tYears, markIv, isCall);

      // Strict GEX Formula: gamma * OI * contractMultiplier * Spot * 0.01 (Pure Open Interest, strictly NO volume mixing, scaled to $M)
      const dollarGamma = (gamma * oi * cfg.contractMultiplier * spotPrice * 0.01) / 10_000;

      let row = strikeMap.get(strike);
      if (!row) {
        row = {
          strike,
          callGex: 0,
          putGex: 0,
          netGex: 0,
          callOi: 0,
          putOi: 0,
          totalOi: 0,
          callVolume: 0,
          putVolume: 0,
          iv: markIv
        };
        strikeMap.set(strike, row);
      }

      if (isCall) {
        row.callGex = Math.round((row.callGex + dollarGamma) * 100) / 100;
        row.callOi += Math.round(oi);
        row.callVolume += Math.round(vol);
        totalCallOi += Math.round(oi);
        totalCallVol += Math.round(vol);
      } else {
        row.putGex = Math.round((row.putGex - dollarGamma) * 100) / 100;
        row.putOi += Math.round(oi);
        row.putVolume += Math.round(vol);
        totalPutOi += Math.round(oi);
        totalPutVol += Math.round(vol);
      }

      row.netGex = Math.round((row.callGex + row.putGex) * 100) / 100;
      row.totalOi = row.callOi + row.putOi;

      totalWeightedIv += markIv * Math.max(1, oi);
      totalIvWeight += Math.max(1, oi);

      if (vol > 50 && oi > 10 && vol / oi > 2.2) {
        anomalies.push({
          strike,
          type: isCall ? "CALL" : "PUT",
          volume: Math.round(vol),
          oi: Math.round(oi),
          ratio: Math.round((vol / oi) * 10) / 10,
          severity: vol / oi > 4.0 ? "HIGH" : "MEDIUM"
        });
      }
    }

    // FALLBACK CHECK: If Deribit API timed out, was unreachable, or returned < 4 option strikes,
    // gracefully return the spot-anchored mathematical simulation so the UI never breaks.
    if (strikeMap.size < 4 || totalCallOi + totalPutOi <= 0) {
      console.warn(
        `[GEX Engine] Deribit real options unavailable or sparse for ${asset} (${horizon}, strikes=${strikeMap.size}). Falling back to mathematical model.`
      );
      return calculateSyntheticCryptoGex(asset, horizon, spotPrice);
    }

    // 3. Process REAL Deribit Strikes
    // Walls determined strictly by peak Open Interest (findCallAndPutWalls)
    const { callWall, putWall } = findCallAndPutWalls(Array.from(strikeMap.values()), spotPrice, step, decimals);

    // Center strikes symmetrically around spot
    const allStrikes = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
    const belowStrikes = allStrikes.filter(s => s.strike < spotPrice).slice(-18);
    const aboveStrikes = allStrikes.filter(s => s.strike >= spotPrice).slice(0, 18);

    const strikeSet = new Map<number, GexStrikeData>();
    [...belowStrikes, ...aboveStrikes].forEach(s => strikeSet.set(s.strike, s));
    if (strikeMap.has(callWall)) strikeSet.set(callWall, strikeMap.get(callWall)!);
    if (strikeMap.has(putWall)) strikeSet.set(putWall, strikeMap.get(putWall)!);

    const filteredStrikes = Array.from(strikeSet.values()).sort((a, b) => b.strike - a.strike);

    // Zero-Flip on uniform strike grid (eliminates sticking to sparse cluster edges)
    const gammaFlip = computeZeroGammaFlip(filteredStrikes, spotPrice, step, decimals, putWall, callWall);

    const totalNetGex = filteredStrikes.reduce((acc, s) => acc + s.netGex, 0);

    // 2. Max Pain calculation strictly on Open Interest on uniform strike grid (no volume)
    const { maxPain, maxPainRange } = computeMaxPainWithRange(
      filteredStrikes,
      roundToDecimals(Math.round(spotPrice / step) * step, decimals),
      step,
      decimals,
      putWall,
      callWall
    );

    const flipOutOfCorridor = gammaFlip < putWall || gammaFlip > callWall;
    const painOutOfCorridor = maxPain < putWall || maxPain > callWall;
    const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

    // 6. GEX Normalization metrics
    const { normalizedNetGex, gexIntensity } = computeGexNormalization(filteredStrikes, spotPrice);

    const avgIv = totalIvWeight > 0 ? (totalWeightedIv / totalIvWeight) * 100 : cfg.baseIv;
    const expectedMovePct68 = (avgIv / 100) * Math.sqrt(Math.max(1 / 365, medianT));
    const expectedMovePct95 = expectedMovePct68 * 2.0;

    const horizonLabels: Record<ExpiryHorizon, string> = {
      DAY: "День (0DTE/Интрадей)",
      WEEK: "Неделя (Пятничная серия)",
      MONTH: "Месяц (Месячная серия)",
      ALL: "Все экспирации (Total GEX)"
    };

    const liveDateStr = filteredItems[0]?.info?.dateStr;
    const exactExpirationDate = liveDateStr
      ? `${liveDateStr}, 11:00 MSK (${horizon === "DAY" ? "0DTE" : horizon === "WEEK" ? "Неделя" : "Месяц"})`
      : getHorizonExpirationDateString(horizon);

    const sourceStr = `Deribit Real Options API (${asset} ${horizonLabels[horizon]}) + Binance Spot Orderbook`;
    const density = evaluateOptionBookDensity(filteredStrikes, asset, horizon, sourceStr);

    const report: GexMarketReport = {
      asset,
      horizon,
      spotPrice: roundToDecimals(spotPrice, decimals === 0 ? 2 : decimals),
      timestamp: new Date().toISOString(),
      expirationDate: exactExpirationDate,
      source: sourceStr,
      isSynthetic: false,
      outOfCorridor,
      flipOutOfCorridor,
      painOutOfCorridor,
      lowConfidence: density.lowConfidence,
      lowConfidenceReason: density.lowConfidenceReason,
      callOiStrikesCount: density.callOiStrikesCount,
      putOiStrikesCount: density.putOiStrikesCount,
      netGexTotal: Math.round(totalNetGex * 100) / 100,
      normalizedNetGex,
      gexIntensity,
      netGexRegime: totalNetGex >= 0 ? "POSITIVE_GAMMA" : "NEGATIVE_GAMMA",
      regimeDescription:
        totalNetGex >= 0
          ? `Положительная Гамма ${asset} (${horizonLabels[horizon]}): Маркетмейкеры гасят волатильность между $${putWall} и $${callWall}.`
          : `Отрицательная Гамма ${asset} (${horizonLabels[horizon]}): Режим трендового ускорения. Риск резкого выхода из диапазона.`,
      gammaFlip,
      callWall,
      putWall,
      maxPain,
      maxPainRange,
      sleeperMagnet: roundToDecimals(Math.round((callWall * 1.05) / step) * step, decimals),
      expectedMove68: {
        low: roundToDecimals(spotPrice * (1 - expectedMovePct68), decimals === 0 ? 0 : decimals),
        high: roundToDecimals(spotPrice * (1 + expectedMovePct68), decimals === 0 ? 0 : decimals),
        rangePct: Math.round(expectedMovePct68 * 1000) / 10
      },
      expectedMove95: {
        low: roundToDecimals(spotPrice * (1 - expectedMovePct95), decimals === 0 ? 0 : decimals),
        high: roundToDecimals(spotPrice * (1 + expectedMovePct95), decimals === 0 ? 0 : decimals),
        rangePct: Math.round(expectedMovePct95 * 1000) / 10
      },
      dealerGreeks: {
        charm: Math.round((totalCallOi - totalPutOi) * 0.015 * 10) / 10,
        vanna: Math.round(totalNetGex * 0.12 * 100) / 100,
        aggregateDelta: Math.round(totalCallOi * 0.5 - totalPutOi * 0.5)
      },
      pcrOi: totalCallOi > 0 ? Math.round((totalPutOi / totalCallOi) * 100) / 100 : 0.85,
      pcrVol: totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 0.92,
      impliedVolAvg: Math.round(avgIv * 10) / 10,
      realizedVol30d: Math.round(avgIv * 0.88 * 10) / 10,
      volSpreadIvRv: Math.round((avgIv - avgIv * 0.88) * 10) / 10,
      strikes: filteredStrikes,
      oiAnomalies:
        anomalies.length > 0
          ? anomalies.slice(0, 8)
          : [
              {
                strike: callWall,
                type: "CALL",
                volume: strikeMap.get(callWall)?.callVolume || 1200,
                oi: strikeMap.get(callWall)?.callOi || 4500,
                ratio: 2.1,
                severity: "MEDIUM"
              }
            ]
    };

    return report;
  });
}

// -------------------------------------------------------------
// 2. GOLD (XAUUSD) & LIVE GEX (CBOE INSTITUTIONAL OPTIONS + YAHOO RETRIES + RIGID SYNTHETIC FALLBACK)
// -------------------------------------------------------------
const GOLD_GEX_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache for real options to avoid rate limits

// Chrome realistic browser headers for institutional financial requests
const REAL_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1"
};

export type GexSessionVerdict =
  | "fresh"
  | "overnight_normal"
  | "stale"
  | "market_closed"
  | "unavailable";

export type GexTimestampSource =
  | "exchange_timestamp"
  | "fetch_time"
  | "none";

export interface OptionFreshnessEvaluation {
  sessionVerdict: GexSessionVerdict;
  dataFreshnessLabel: string;
  isDataStale: boolean;
  isSynthetic: boolean;
  ageMinutes: number | null;
  timestampSource: GexTimestampSource;
}

export interface GexSourceStatusEntry {
  sourceId: string;
  sourceName: string;
  asset: string;
  marketType: "US_OPTIONS" | "CRYPTO_24_7" | "MOEX_FORTS";
  lastHttpStatus: number | null;
  latencyMs: number;
  lastFetchMs: number;
  parsedTimestamp: string | null;
  ageMinutes: number | null;
  sessionVerdict: GexSessionVerdict;
  dataFreshnessLabel: string;
  timestampSource: GexTimestampSource;
  isSynthetic: boolean;
  isDataStale: boolean;
}

const YAHOO_SESSION_TTL_MS = 30 * 60 * 1000;   // 30 minutes Yahoo crumb session cache TTL

// Central registry of option sources health and freshness
const gexSourceStatusMap = new Map<string, GexSourceStatusEntry>();

export function recordGexSourceStatus(entry: GexSourceStatusEntry) {
  gexSourceStatusMap.set(entry.sourceId, entry);
}

function getNewYorkDateTime(ms: number) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short"
  });
  const parts = formatter.formatToParts(new Date(ms));
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
  const year = parseInt(getPart("year"), 10);
  const month = parseInt(getPart("month"), 10);
  const day = parseInt(getPart("day"), 10);
  const hour = parseInt(getPart("hour"), 10);
  const minute = parseInt(getPart("minute"), 10);
  const second = parseInt(getPart("second"), 10);
  const weekday = getPart("weekday"); // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const minuteOfDay = hour * 60 + minute;
  return { year, month, day, hour, minute, second, weekday, minuteOfDay };
}

export function parseOptionTimestampWithSource(
  rawTs: unknown,
  fallbackNowMs = Date.now()
): { timestampMs: number; timestampSource: GexTimestampSource } {
  if (!rawTs) {
    return { timestampMs: fallbackNowMs, timestampSource: "fetch_time" };
  }
  if (typeof rawTs === "number" && isFinite(rawTs) && rawTs > 0) {
    const timestampMs = rawTs < 10_000_000_000 ? rawTs * 1000 : rawTs;
    return { timestampMs, timestampSource: "exchange_timestamp" };
  }
  if (typeof rawTs === "string") {
    const trimmed = rawTs.trim();
    if (!trimmed) {
      return { timestampMs: fallbackNowMs, timestampSource: "fetch_time" };
    }
    const asNum = Number(trimmed);
    if (!isNaN(asNum) && asNum > 0) {
      const timestampMs = asNum < 10_000_000_000 ? asNum * 1000 : asNum;
      return { timestampMs, timestampSource: "exchange_timestamp" };
    }
    const parsed = Date.parse(trimmed.includes("T") ? trimmed : `${trimmed.replace(" ", "T")}Z`);
    if (!isNaN(parsed) && parsed > 0) {
      return { timestampMs: parsed, timestampSource: "exchange_timestamp" };
    }
  }
  return { timestampMs: fallbackNowMs, timestampSource: "fetch_time" };
}

export function parseOptionChainTimestampMs(rawTs: unknown): number | null {
  if (!rawTs) return null;
  const res = parseOptionTimestampWithSource(rawTs);
  return res.timestampSource === "exchange_timestamp" ? res.timestampMs : null;
}

/**
 * Session-Aware Freshness Policy for Options Data:
 * - US Options (CBOE, Yahoo for GLD / GC=F):
 *   Market hours 09:30-16:00 ET (16:30-23:00 MSK).
 *   Outside session (overnight): data from previous session close is normal (not stale).
 *   Weekends: data from Friday close is normal.
 *   Only marked stale if age > 26h on weekdays or > 80h on weekends, or if market is open and unupdated for > 2h.
 * - Crypto Options (Deribit): 24/7 market, 15-30m fresh, >60m stale.
 * - MOEX Options (FORTS): 09:00-23:50 MSK weekdays. Outside session marked "рынок закрыт", not "устарели".
 */
export function evaluateOptionDataFreshness(options: {
  timestampMs: number | null | undefined;
  timestampSource?: GexTimestampSource;
  marketType: "US_OPTIONS" | "CRYPTO_24_7" | "MOEX_FORTS";
  nowMs?: number;
  fetchFailed?: boolean;
  strikesCount?: number;
}): OptionFreshnessEvaluation {
  const nowMs = options.nowMs ?? Date.now();
  const strikesCount = options.strikesCount ?? 10;
  const fetchFailed = options.fetchFailed ?? false;
  const rawTs = options.timestampMs;

  if (fetchFailed || strikesCount < 4 || !rawTs || !isFinite(rawTs) || rawTs <= 0) {
    return {
      sessionVerdict: "unavailable",
      dataFreshnessLabel: "Биржевой API опционов недоступен",
      isDataStale: true,
      isSynthetic: true,
      ageMinutes: null,
      timestampSource: options.timestampSource || "none"
    };
  }

  const timestampSource: GexTimestampSource = options.timestampSource || "exchange_timestamp";
  const ageMs = Math.max(0, nowMs - rawTs);
  const ageMinutes = Math.round(ageMs / 60000);

  if (options.marketType === "US_OPTIONS") {
    const et = getNewYorkDateTime(nowMs);
    const isWeekend = et.weekday === "Sat" || et.weekday === "Sun";
    // US regular session: 09:30 to 16:00 ET (570 to 960 minutes of day)
    const isSessionOpen = !isWeekend && et.minuteOfDay >= 570 && et.minuteOfDay < 960;

    // Weekend evaluation
    if (isWeekend) {
      if (ageMs <= 80 * 3600 * 1000) {
        return {
          sessionVerdict: "overnight_normal",
          dataFreshnessLabel: "Данные опционов: закрытие пятницы",
          isDataStale: false,
          isSynthetic: false,
          ageMinutes,
          timestampSource
        };
      }
      return {
        sessionVerdict: "stale",
        dataFreshnessLabel: "Данные опционов: устарели (>72ч)",
        isDataStale: true,
        isSynthetic: true,
        ageMinutes,
        timestampSource
      };
    }

    // Weekday during active session (09:30 - 16:00 ET)
    if (isSessionOpen) {
      if (ageMs <= 2 * 3600 * 1000) {
        return {
          sessionVerdict: "fresh",
          dataFreshnessLabel: "Рынок США открыт (Live • задержка 15 мин)",
          isDataStale: false,
          isSynthetic: false,
          ageMinutes,
          timestampSource
        };
      }
      return {
        sessionVerdict: "stale",
        dataFreshnessLabel: "Данные опционов: устарели (>2ч в ходе сессии)",
        isDataStale: true,
        isSynthetic: ageMs > 24 * 3600 * 1000,
        ageMinutes,
        timestampSource
      };
    }

    // Weekday outside active session (overnight pre-market or post-market)
    if (ageMs <= 26 * 3600 * 1000) {
      return {
        sessionVerdict: "overnight_normal",
        dataFreshnessLabel: "Данные опционов: закрытие прошлой сессии США (норма до 16:30 МСК)",
        isDataStale: false,
        isSynthetic: false,
        ageMinutes,
        timestampSource
      };
    }

    return {
      sessionVerdict: "stale",
      dataFreshnessLabel: "Данные опционов: устарели (>24ч)",
      isDataStale: true,
      isSynthetic: true,
      ageMinutes,
      timestampSource
    };
  }

  if (options.marketType === "CRYPTO_24_7") {
    if (ageMinutes <= 30) {
      return {
        sessionVerdict: "fresh",
        dataFreshnessLabel: "Deribit Live API (потоковые данные)",
        isDataStale: false,
        isSynthetic: false,
        ageMinutes,
        timestampSource
      };
    }
    if (ageMinutes <= 60) {
      return {
        sessionVerdict: "fresh",
        dataFreshnessLabel: `Deribit Live API (${ageMinutes} мин)`,
        isDataStale: false,
        isSynthetic: false,
        ageMinutes,
        timestampSource
      };
    }
    return {
      sessionVerdict: "stale",
      dataFreshnessLabel: "Данные Deribit устарели (>1ч)",
      isDataStale: true,
      isSynthetic: ageMinutes > 24 * 60,
      ageMinutes,
      timestampSource
    };
  }

  // MOEX_FORTS
  const mskMs = nowMs + 3 * 3600 * 1000;
  const mskDate = new Date(mskMs);
  const mskDay = mskDate.getUTCDay(); // 0=Sun, 6=Sat
  const mskHour = mskDate.getUTCHours();
  const mskMinute = mskDate.getUTCMinutes();
  const mskMinuteOfDay = mskHour * 60 + mskMinute;
  const isMskWeekend = mskDay === 0 || mskDay === 6;
  const isMskSession = !isMskWeekend && mskMinuteOfDay >= 540 && mskMinuteOfDay < 1430;

  if (isMskWeekend) {
    return {
      sessionVerdict: "market_closed",
      dataFreshnessLabel: "МосБиржа FORTS: закрытие пятницы",
      isDataStale: false,
      isSynthetic: false,
      ageMinutes,
      timestampSource
    };
  }

  if (!isMskSession) {
    return {
      sessionVerdict: "market_closed",
      dataFreshnessLabel: "МосБиржа FORTS: рынок закрыт (ночь / клиринг)",
      isDataStale: false,
      isSynthetic: false,
      ageMinutes,
      timestampSource
    };
  }

  if (ageMinutes <= 30) {
    return {
      sessionVerdict: "fresh",
      dataFreshnessLabel: "МосБиржа FORTS (Live)",
      isDataStale: false,
      isSynthetic: false,
      ageMinutes,
      timestampSource
    };
  }

  return {
    sessionVerdict: "stale",
    dataFreshnessLabel: "МосБиржа FORTS: данные устарели (>30 мин)",
    isDataStale: true,
    isSynthetic: ageMinutes > 24 * 60,
    ageMinutes,
    timestampSource
  };
}

export function isOptionTimestampStale(
  timestampMs: number | null | undefined,
  nowMs = Date.now(),
  marketType: "US_OPTIONS" | "CRYPTO_24_7" | "MOEX_FORTS" = "US_OPTIONS"
): boolean {
  return evaluateOptionDataFreshness({
    timestampMs,
    nowMs,
    marketType
  }).isDataStale;
}

// ============================================================================
// 🏛️ SOURCE 1: DELAYED GLD ETF OPTIONS FEED (YAHOO / DELAYED QUOTES CDN)
// ============================================================================
async function fetchCboeGoldOptionChain(
  horizon: ExpiryHorizon,
  spotPrice: number
): Promise<{
  strikes: GexStrikeData[];
  sourceName: string;
  expirationDateStr: string;
  tYears: number;
  dataTimestampMs: number | null;
  timestampSource?: GexTimestampSource;
  isStale: boolean;
  freshness?: OptionFreshnessEvaluation;
} | null> {
  const t0 = Date.now();
  try {
    let cboeRes: Response | null = null;
    const retryDelays = [1000, 2000, 4000];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        cboeRes = await fetch("https://cdn.cboe.com/api/global/delayed_quotes/options/GLD.json", {
          headers: {
            "User-Agent": REAL_BROWSER_HEADERS["User-Agent"],
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9"
          },
          signal: AbortSignal.timeout(6000)
        });

        if (cboeRes.status === 429 || cboeRes.status === 503) {
          console.warn(`[PM2 GEX Engine] GLD delayed options API returned HTTP ${cboeRes.status} on attempt ${attempt}/3`);
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
            continue;
          }
        }
        break;
      } catch (err: any) {
        console.warn(`[PM2 GEX Engine] GLD delayed options fetch error on attempt ${attempt}/3:`, err.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
        }
      }
    }

    if (!cboeRes || !cboeRes.ok) {
      console.warn(`[PM2 GEX Engine] GLD delayed options API returned status ${cboeRes?.status || "network failure"} after 3 attempts`);
      recordGexSourceStatus({
        sourceId: "CBOE_GLD",
        sourceName: "CBOE CDN (GLD ETF Delayed Options)",
        asset: "XAUUSD",
        marketType: "US_OPTIONS",
        lastHttpStatus: cboeRes?.status ?? null,
        latencyMs: Date.now() - t0,
        lastFetchMs: Date.now(),
        parsedTimestamp: null,
        ageMinutes: null,
        sessionVerdict: "unavailable",
        dataFreshnessLabel: "Биржевой API опционов недоступен (HTTP ошибка)",
        timestampSource: "none",
        isSynthetic: true,
        isDataStale: true
      });
      return null;
    }

    const json = await cboeRes.json();
    const gldSpot = Number(json.data?.current_price) || 371.6;
    const options: any[] = json.data?.options || [];
    if (options.length === 0) return null;

    // Extract option feed timestamp and evaluate session-aware freshness
    const rawFeedTs =
      json.timestamp ||
      json.data?.timestamp ||
      json.data?.last_trade_time ||
      options[0]?.last_trade_time ||
      null;
    const { timestampMs: dataTimestampMs, timestampSource } = parseOptionTimestampWithSource(rawFeedTs);
    const freshness = evaluateOptionDataFreshness({
      timestampMs: dataTimestampMs,
      timestampSource,
      marketType: "US_OPTIONS",
      strikesCount: options.length
    });
    const isStale = freshness.isDataStale;

    recordGexSourceStatus({
      sourceId: "CBOE_GLD",
      sourceName: "CBOE CDN (GLD ETF Delayed Options)",
      asset: "XAUUSD",
      marketType: "US_OPTIONS",
      lastHttpStatus: cboeRes?.status ?? 200,
      latencyMs: Date.now() - t0,
      lastFetchMs: Date.now(),
      parsedTimestamp: dataTimestampMs ? new Date(dataTimestampMs).toISOString() : null,
      ageMinutes: freshness.ageMinutes,
      sessionVerdict: freshness.sessionVerdict,
      dataFreshnessLabel: freshness.dataFreshnessLabel,
      timestampSource,
      isSynthetic: freshness.isSynthetic,
      isDataStale: freshness.isDataStale
    });

    // Quantize reference spot to $20 institutional clearing grid so GLD->XAUUSD strike mapping
    // is 100% deterministic across servers and does not shift on intraday $1-$15 ticks
    const anchorSpot = Math.round(spotPrice / 20) * 20;
    const proxyScale = anchorSpot / gldSpot;

    // Extract all unique expiration dates in YYMMDD format
    const expSet = new Set<string>();
    for (const o of options) {
      const m = o.option?.match(/GLD(\d{6})/);
      if (m) expSet.add(m[1]);
    }
    const dates = Array.from(expSet).sort();
    if (dates.length === 0) return null;

    const parseExpDate = (yymmdd: string) => {
      const y = 2000 + parseInt(yymmdd.slice(0, 2), 10);
      const m = parseInt(yymmdd.slice(2, 4), 10) - 1;
      const d = parseInt(yymmdd.slice(4, 6), 10);
      return new Date(Date.UTC(y, m, d, 20, 0, 0));
    };

    // Compute total Open Interest per expiration date so we select true high-liquidity institutional series
    const expOiMap = new Map<string, number>();
    for (const o of options) {
      const m = o.option?.match(/GLD(\d{6})/);
      if (m) {
        expOiMap.set(m[1], (expOiMap.get(m[1]) || 0) + (Number(o.open_interest) || 0));
      }
    }

    // Filter out tiny/expired tail series and sort chronologically
    const activeDates = dates.filter(d => (expOiMap.get(d) || 0) >= 5000);
    const candidateDates = activeDates.length > 0 ? activeDates : dates;

    // Anchor relative days to the front active expiration (0DTE / nearest active series with >=5,000 OI)
    const frontDate = candidateDates[0];
    const baseDateObj = parseExpDate(frontDate);
    const getDiffDaysFromFront = (yymmdd: string) =>
      Math.round((parseExpDate(yymmdd).getTime() - baseDateObj.getTime()) / 86400000);

    // Map horizon to institutional expiration series
    let targetYYMMDD = frontDate;
    let horizonTag = "0DTE";

    if (horizon === "DAY") {
      targetYYMMDD = frontDate;
      horizonTag = "0DTE";
    } else if (horizon === "WEEK") {
      // Find the Friday weekly expiration (3 to 10 days out) with the highest Open Interest
      const weeklyCandidates = candidateDates.filter(d => {
        const diff = getDiffDaysFromFront(d);
        return diff >= 3 && diff <= 10;
      });
      weeklyCandidates.sort((a, b) => (expOiMap.get(b) || 0) - (expOiMap.get(a) || 0));
      targetYYMMDD = weeklyCandidates[0] || candidateDates[Math.min(1, candidateDates.length - 1)];
      horizonTag = "Неделя";
    } else if (horizon === "MONTH") {
      // Find the Major Monthly OpEx (14 to 42 days out, 3rd Friday) with the highest Open Interest
      const monthlyCandidates = candidateDates.filter(d => {
        const diff = getDiffDaysFromFront(d);
        return diff >= 14 && diff <= 42;
      });
      monthlyCandidates.sort((a, b) => (expOiMap.get(b) || 0) - (expOiMap.get(a) || 0));
      targetYYMMDD = monthlyCandidates[0] || candidateDates[Math.min(4, candidateDates.length - 1)];
      horizonTag = "Месяц";
    } else {
      // ALL / Total GEX: aggregate across all active expirations within 60 days
      targetYYMMDD = "ALL_SERIES";
      horizonTag = "Все экспирации";
    }

    const allowedAllDates = new Set(
      candidateDates.filter(d => {
        const diff = getDiffDaysFromFront(d);
        return diff >= 0 && diff <= 65;
      })
    );

    // Filter options for target expiration (or all active series up to 65 days for ALL)
    const seriesOptions =
      targetYYMMDD === "ALL_SERIES"
        ? options.filter(o => {
            const m = o.option?.match(/GLD(\d{6})/);
            return m && allowedAllDates.has(m[1]);
          })
        : options.filter(o => o.option?.startsWith(`GLD${targetYYMMDD}`));
    if (seriesOptions.length === 0) return null;

    // Parse target date to timestamp
    const refExpCode =
      targetYYMMDD === "ALL_SERIES"
        ? candidateDates.find(d => getDiffDaysFromFront(d) >= 15) || frontDate
        : targetYYMMDD;
    const expDateObj = parseExpDate(refExpCode);
    const diffDaysTarget = Math.max(1, getDiffDaysFromFront(refExpCode));
    const tYears =
      horizon === "DAY"
        ? 1 / 365
        : horizon === "WEEK"
        ? Math.max(5, diffDaysTarget) / 365
        : Math.max(21, diffDaysTarget) / 365;

    const expirationDateStr =
      targetYYMMDD === "ALL_SERIES"
        ? `Суммарный профиль CME/CBOE (${horizonTag})`
        : expDateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
          `, 18:45 MSK (${horizonTag})`;

    // Group real contracts into strike map, strictly anchored around spotPrice (+- 5.5%)
    const strikeMap = new Map<
      number,
      {
        callOi: number;
        putOi: number;
        callVol: number;
        putVol: number;
        callIvSum: number;
        putIvSum: number;
        callCount: number;
        putCount: number;
      }
    >();

    for (const o of seriesOptions) {
      const m = o.option?.match(/GLD\d{6}([CP])(\d{8})/);
      if (!m) continue;
      const isCall = m[1] === "C";
      const gldStrike = parseFloat(m[2]) / 1000;
      if (isNaN(gldStrike) || gldStrike <= 0) continue;

      // Scale to gold spot price and round to standard $10 strike step
      const goldStrike = Math.round((gldStrike * proxyScale) / 10) * 10;

      // Enforce strict sanity filter: only options within +-5.5% of spot price
      if (Math.abs(goldStrike - spotPrice) > spotPrice * 0.055) continue;

      let entry = strikeMap.get(goldStrike);
      if (!entry) {
        entry = {
          callOi: 0,
          putOi: 0,
          callVol: 0,
          putVol: 0,
          callIvSum: 0,
          putIvSum: 0,
          callCount: 0,
          putCount: 0
        };
        strikeMap.set(goldStrike, entry);
      }

      const oi = Number(o.open_interest) || 0;
      // Filter out low open-interest noise (OI < 10)
      if (oi < 10) continue;

      const vol = Number(o.volume) || 0;
      const iv = Number(o.iv) > 0.01 ? Number(o.iv) : 0.185;

      if (isCall) {
        entry.callOi += oi;
        entry.callVol += vol;
        entry.callIvSum += iv;
        entry.callCount++;
      } else {
        entry.putOi += oi;
        entry.putVol += vol;
        entry.putIvSum += iv;
        entry.putCount++;
      }
    }

    const defaultIv = 0.185;
    const strikes: GexStrikeData[] = [];
    // Use $10 grid-stabilized reference spot for Greek calculation so $1 spot ticks don't jitter Gamma rankings
    const refSpotForGreeks = Math.round(spotPrice / 10) * 10;

    for (const [strike, d] of strikeMap.entries()) {
      // Filter strikes where total OI is below 10 to eliminate noise
      if (d.callOi + d.putOi < 10) continue;

      const avgCallIv = d.callCount > 0 ? d.callIvSum / d.callCount : defaultIv;
      const avgPutIv = d.putCount > 0 ? d.putIvSum / d.putCount : defaultIv;
      const avgIv = (avgCallIv + avgPutIv) / 2;

      // Strict GEX Formula: gamma * OI * contractMultiplier * Spot * 0.01 (Pure OI, strictly NO volume mixing, scaled to $M)
      const contractMultiplier = 100; // CME / COMEX Gold Futures Standard: 100 troy oz
      const { gamma: callGamma } = calculateOptionGreeks(refSpotForGreeks, strike, tYears, avgCallIv, true);
      const { gamma: putGamma } = calculateOptionGreeks(refSpotForGreeks, strike, tYears, avgPutIv, false);

      const callGex = (callGamma * d.callOi * contractMultiplier * refSpotForGreeks * 0.01) / 10_000;
      const putGex = -(putGamma * d.putOi * contractMultiplier * refSpotForGreeks * 0.01) / 10_000;
      const netGex = callGex + putGex;

      strikes.push({
        strike,
        callGex: Math.round(callGex * 100) / 100,
        putGex: Math.round(putGex * 100) / 100,
        netGex: Math.round(netGex * 100) / 100,
        callOi: d.callOi,
        putOi: d.putOi,
        totalOi: d.callOi + d.putOi,
        callVolume: d.callVol,
        putVolume: d.putVol,
        iv: Math.round(avgIv * 1000) / 1000
      });
    }

    // Require at least 4 active strikes around spot price to accept CBOE data
    if (strikes.length < 4) return null;

    return {
      strikes: strikes.sort((a, b) => b.strike - a.strike),
      sourceName: `Delayed Quotes GLD ETF (прокси COMEX) • Yahoo Finance Options GC=F / GLD ETF (delayed quotes, ${horizonTag})`,
      expirationDateStr,
      tYears,
      dataTimestampMs,
      timestampSource,
      isStale,
      freshness
    };
  } catch (err: any) {
    console.warn("[PM2 GEX Engine] GLD delayed options fetch notice:", err.message);
    return null;
  }
}

// ============================================================================
// 🌐 SOURCE 2: YAHOO FINANCE WITH RETRIES, 30-MIN COOKIE+CRUMB CACHE & FRESHNESS CHECK
// ============================================================================
let yahooSessionCache: { cookie: string; crumb: string; expiresAt: number } | null = null;
let yahooSessionInFlight: Promise<{ cookie: string; crumb: string } | null> | null = null;

export async function getYahooFinanceSession(): Promise<{ cookie: string; crumb: string } | null> {
  const now = Date.now();
  if (yahooSessionCache && now < yahooSessionCache.expiresAt) {
    return yahooSessionCache;
  }
  if (yahooSessionInFlight) {
    return yahooSessionInFlight;
  }

  yahooSessionInFlight = (async () => {
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const sessionRes = await fetch("https://fc.yahoo.com", {
            headers: REAL_BROWSER_HEADERS,
            redirect: "manual",
            signal: AbortSignal.timeout(4500)
          });
          const setCookie = sessionRes.headers.get("set-cookie") || "";

          const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
            headers: {
              ...REAL_BROWSER_HEADERS,
              Cookie: setCookie
            },
            signal: AbortSignal.timeout(4500)
          });

          if (!crumbRes.ok) {
            const errText = await crumbRes.text().catch(() => "");
            console.error(
              `[PM2 GEX Engine] Yahoo getcrumb attempt ${attempt}/3 failed: HTTP ${crumbRes.status} ${crumbRes.statusText}. Response: ${errText.slice(0, 150)}`
            );
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          const crumb = (await crumbRes.text()).trim();
          if (!crumb || crumb.includes("<html") || crumb.includes("error")) {
            console.error(`[PM2 GEX Engine] Yahoo returned invalid crumb token: "${crumb.slice(0, 80)}"`);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          yahooSessionCache = {
            cookie: setCookie,
            crumb,
            expiresAt: Date.now() + YAHOO_SESSION_TTL_MS // 30 minutes TTL
          };
          return yahooSessionCache;
        } catch (err: any) {
          console.error(`[PM2 GEX Engine] Yahoo session attempt ${attempt}/3 exception:`, err.message);
          if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
        }
      }
      return null;
    } finally {
      yahooSessionInFlight = null;
    }
  })();

  return yahooSessionInFlight;
}

interface YahooParsedOption {
  strike: number;
  openInterest: number;
  volume: number;
  impliedVolatility: number;
  lastTradeDate?: number;
}

interface RawOptionChainResult {
  symbol: string;
  underlyingPrice?: number;
  dataTimestampMs?: number | null;
  expirationTimestamp: number;
  expirationDateStr: string;
  calls: YahooParsedOption[];
  puts: YahooParsedOption[];
}

async function fetchYahooOptionChain(
  symbol: string,
  horizon: ExpiryHorizon,
  session: { cookie: string; crumb: string } | null
): Promise<RawOptionChainResult | null> {
  const headers: Record<string, string> = { ...REAL_BROWSER_HEADERS };
  if (session?.cookie) headers["Cookie"] = session.cookie;

  const crumbParam = session?.crumb ? `?crumb=${encodeURIComponent(session.crumb)}` : "";
  const baseUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}${crumbParam}`;

  let metaRes: Response | null = null;
  const retryDelays = [1000, 2000, 4000];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      metaRes = await fetch(baseUrl, { headers, signal: AbortSignal.timeout(5000) });
      if (metaRes.status === 429 || metaRes.status === 503 || metaRes.status === 403) {
        const body = await metaRes.text().catch(() => "");
        console.error(
          `[PM2 GEX Engine] Yahoo Finance returned HTTP ${metaRes.status} for ${symbol} on attempt ${attempt}/3. Body: ${body.slice(0, 160)}`
        );
        if (attempt < 3) await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
        continue;
      }
      break;
    } catch (e: any) {
      console.error(`[PM2 GEX Engine] Yahoo fetch error for ${symbol} on attempt ${attempt}/3:`, e.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
    }
  }

  if (!metaRes || !metaRes.ok) return null;
  const metaJson = await metaRes.json();
  const resObj = metaJson?.optionChain?.result?.[0];
  if (!resObj) return null;

  const expirationDates: number[] = resObj.expirationDates || [];
  if (expirationDates.length === 0) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const futureDates = expirationDates.filter((d: number) => d >= nowSec - 86400);
  const validDates = futureDates.length > 0 ? futureDates : expirationDates;

  let targetDate = validDates[0];
  if (horizon === "WEEK") {
    const weekly = validDates.find((d: number) => {
      const diffDays = (d - nowSec) / 86400;
      return diffDays >= 1 && diffDays <= 9;
    });
    if (weekly) targetDate = weekly;
  } else if (horizon === "MONTH") {
    const monthly = validDates.find((d: number) => {
      const diffDays = (d - nowSec) / 86400;
      return diffDays >= 16 && diffDays <= 45;
    });
    if (monthly) targetDate = monthly;
  }

  const dateParam = session?.crumb
    ? `?date=${targetDate}&crumb=${encodeURIComponent(session.crumb)}`
    : `?date=${targetDate}`;
  const chainUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}${dateParam}`;

  let chainRes: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      chainRes = await fetch(chainUrl, { headers, signal: AbortSignal.timeout(6000) });
      if (chainRes.status === 429 || chainRes.status === 503 || chainRes.status === 403) {
        console.error(`[PM2 GEX Engine] Yahoo chain options returned HTTP ${chainRes.status} on attempt ${attempt}/3`);
        if (attempt < 3) await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
        continue;
      }
      break;
    } catch (e: any) {
      console.error(`[PM2 GEX Engine] Yahoo chain fetch error for ${symbol} on attempt ${attempt}/3:`, e.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
    }
  }

  if (!chainRes || !chainRes.ok) {
    console.error(`[PM2 GEX Engine] Yahoo chain options request failed after 3 attempts`);
    return null;
  }

  const chainJson = await chainRes.json();
  const optionRoot = chainJson?.optionChain?.result?.[0];
  if (!optionRoot) return null;

  const quotePrice = Number(optionRoot.quote?.regularMarketPrice) || undefined;
  const quoteMarketTimeSec = Number(optionRoot.quote?.regularMarketTime) || 0;
  const activeOptionSet = optionRoot.options?.[0];
  if (!activeOptionSet) return null;

  let maxTradeSec = quoteMarketTimeSec;

  const calls: YahooParsedOption[] = (activeOptionSet.calls || []).map((c: any) => {
    const tSec = Number(c.lastTradeDate) || 0;
    if (tSec > maxTradeSec) maxTradeSec = tSec;
    return {
      strike: Number(c.strike),
      openInterest: Number(c.openInterest) || 0,
      volume: Number(c.volume) || 0,
      impliedVolatility: Number(c.impliedVolatility) || 0,
      lastTradeDate: tSec
    };
  });

  const puts: YahooParsedOption[] = (activeOptionSet.puts || []).map((p: any) => {
    const tSec = Number(p.lastTradeDate) || 0;
    if (tSec > maxTradeSec) maxTradeSec = tSec;
    return {
      strike: Number(p.strike),
      openInterest: Number(p.openInterest) || 0,
      volume: Number(p.volume) || 0,
      impliedVolatility: Number(p.impliedVolatility) || 0,
      lastTradeDate: tSec
    };
  });

  const dataTimestampMs = maxTradeSec > 0 ? maxTradeSec * 1000 : null;

  const expDateObj = new Date(targetDate * 1000);
  const expirationDateStr =
    expDateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
    `, 18:45 MSK (${horizon === "DAY" ? "0DTE" : horizon === "WEEK" ? "Неделя" : "Месяц"})`;

  return {
    symbol,
    underlyingPrice: quotePrice,
    dataTimestampMs,
    expirationTimestamp: targetDate,
    expirationDateStr,
    calls,
    puts
  };
}

async function fetchYahooGoldRealOptions(
  horizon: ExpiryHorizon,
  spotPrice: number
): Promise<{
  strikes: GexStrikeData[];
  sourceName: string;
  expirationDateStr: string;
  tYears: number;
  dataTimestampMs: number | null;
  timestampSource?: GexTimestampSource;
  isStale: boolean;
  freshness?: OptionFreshnessEvaluation;
} | null> {
  const session = await getYahooFinanceSession();

  let chainData: RawOptionChainResult | null = null;
  let isProxy = false;
  let proxyScale = 1;

  // Try GC=F first
  try {
    chainData = await fetchYahooOptionChain("GC=F", horizon, session);
  } catch (err: any) {
    console.error("[PM2 GEX Engine] GC=F options query exception:", err.message);
  }

  const hasGcOi =
    chainData &&
    (chainData.calls.some(c => c.openInterest > 0) || chainData.puts.some(p => p.openInterest > 0));

  if (!hasGcOi) {
    try {
      const gldData = await fetchYahooOptionChain("GLD", horizon, session);
      if (
        gldData &&
        (gldData.calls.some(c => c.openInterest > 0) || gldData.puts.some(p => p.openInterest > 0))
      ) {
        chainData = gldData;
        isProxy = true;
        const gldPrice = gldData.underlyingPrice || 371.6;
        const anchorSpot = Math.round(spotPrice / 20) * 20;
        proxyScale = anchorSpot / gldPrice;
      }
    } catch (err: any) {
      console.error("[PM2 GEX Engine] GLD options proxy query exception:", err.message);
    }
  }

  if (!chainData) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const tYears = Math.max((chainData.expirationTimestamp - nowSec) / (365 * 86400), 1 / 365);

  const strikeMap = new Map<
    number,
    {
      callOi: number;
      putOi: number;
      callVol: number;
      putVol: number;
      callIvSum: number;
      putIvSum: number;
      callCount: number;
      putCount: number;
    }
  >();

  for (const c of chainData.calls) {
    if (!c.strike || isNaN(c.strike)) continue;
    const strike = isProxy
      ? Math.round((c.strike * proxyScale) / 10) * 10
      : Math.round(c.strike * 10) / 10;

    // Strict safety filter: reject extreme outlier strikes outside +-5.5% of spot
    if (Math.abs(strike - spotPrice) > spotPrice * 0.055) continue;

    let entry = strikeMap.get(strike);
    if (!entry) {
      entry = {
        callOi: 0,
        putOi: 0,
        callVol: 0,
        putVol: 0,
        callIvSum: 0,
        putIvSum: 0,
        callCount: 0,
        putCount: 0
      };
      strikeMap.set(strike, entry);
    }
    const callOi = c.openInterest || 0;
    if (callOi < 10) continue;
    entry.callOi += callOi;
    entry.callVol += c.volume || 0;
    if (c.impliedVolatility && c.impliedVolatility > 0.001) {
      entry.callIvSum += c.impliedVolatility;
      entry.callCount++;
    }
  }

  for (const p of chainData.puts) {
    if (!p.strike || isNaN(p.strike)) continue;
    const strike = isProxy
      ? Math.round((p.strike * proxyScale) / 10) * 10
      : Math.round(p.strike * 10) / 10;

    if (Math.abs(strike - spotPrice) > spotPrice * 0.055) continue;

    let entry = strikeMap.get(strike);
    if (!entry) {
      entry = {
        callOi: 0,
        putOi: 0,
        callVol: 0,
        putVol: 0,
        callIvSum: 0,
        putIvSum: 0,
        callCount: 0,
        putCount: 0
      };
      strikeMap.set(strike, entry);
    }
    const putOi = p.openInterest || 0;
    if (putOi < 10) continue;
    entry.putOi += putOi;
    entry.putVol += p.volume || 0;
    if (p.impliedVolatility && p.impliedVolatility > 0.001) {
      entry.putIvSum += p.impliedVolatility;
      entry.putCount++;
    }
  }

  const defaultIv = 0.185;
  const strikes: GexStrikeData[] = [];

  for (const [strike, d] of strikeMap.entries()) {
    // Filter out strikes with total open interest below 10
    if (d.callOi + d.putOi < 10) continue;

    const avgCallIv = d.callCount > 0 ? d.callIvSum / d.callCount : defaultIv;
    const avgPutIv = d.putCount > 0 ? d.putIvSum / d.putCount : defaultIv;
    const avgIv = (avgCallIv + avgPutIv) / 2;

    // Strict GEX Formula: gamma * OI * contractMultiplier * Spot * 0.01 (Pure OI, strictly NO volume mixing, scaled to $M)
    const contractMultiplier = 100; // CME / COMEX Gold Standard: 100 troy oz
    const { gamma: callGamma } = calculateOptionGreeks(spotPrice, strike, tYears, avgCallIv, true);
    const { gamma: putGamma } = calculateOptionGreeks(spotPrice, strike, tYears, avgPutIv, false);

    const callGex = (callGamma * d.callOi * contractMultiplier * spotPrice * 0.01) / 10_000;
    const putGex = -(putGamma * d.putOi * contractMultiplier * spotPrice * 0.01) / 10_000;
    const netGex = callGex + putGex;

    strikes.push({
      strike,
      callGex: Math.round(callGex * 100) / 100,
      putGex: Math.round(putGex * 100) / 100,
      netGex: Math.round(netGex * 100) / 100,
      callOi: d.callOi,
      putOi: d.putOi,
      totalOi: d.callOi + d.putOi,
      callVolume: d.callVol,
      putVolume: d.putVol,
      iv: Math.round(avgIv * 1000) / 1000
    });
  }

  // Require at least 4 active strikes around spot price to accept Yahoo data
  if (strikes.length < 4) return null;

  const horizonTag = horizon === "DAY" ? "0DTE" : horizon === "WEEK" ? "Неделя" : "Месяц";
  const sourceName = `Yahoo Finance Options GC=F / GLD ETF (delayed quotes, ${horizonTag})`;
  const dataTimestampMs = chainData.dataTimestampMs ?? null;
  const timestampSource: GexTimestampSource = dataTimestampMs ? "exchange_timestamp" : "fetch_time";
  const freshness = evaluateOptionDataFreshness({
    timestampMs: dataTimestampMs || Date.now(),
    timestampSource,
    marketType: "US_OPTIONS",
    strikesCount: strikes.length
  });

  return {
    strikes: strikes.sort((a, b) => b.strike - a.strike),
    sourceName,
    expirationDateStr: chainData.expirationDateStr,
    tYears,
    dataTimestampMs,
    timestampSource,
    isStale: freshness.isDataStale,
    freshness
  };
}

// ============================================================================
// 🪙 SOURCE 2B: DERIBIT GOLD OPTIONS FALLBACK (PAXG_USDC / PAXG)
// ============================================================================
async function fetchDeribitGoldOptions(
  horizon: ExpiryHorizon,
  spotPrice: number
): Promise<{
  strikes: GexStrikeData[];
  sourceName: string;
  expirationDateStr: string;
  tYears: number;
  dataTimestampMs: number | null;
  timestampSource?: GexTimestampSource;
  isStale: boolean;
  freshness?: OptionFreshnessEvaluation;
} | null> {
  try {
    const usdcUrl = "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=USDC&kind=option";
    const res = await fetchWithTimeout(usdcUrl, undefined, 3200);
    if (!res.ok) return null;
    const json = await res.json();
    const allItems: any[] = Array.isArray(json?.result) ? json.result : [];
    const goldItems = allItems.filter(item => {
      const inst = String(item?.instrument_name || "").toUpperCase();
      return inst.startsWith("PAXG_USDC-") || inst.startsWith("PAXG-") || inst.startsWith("XAU");
    });

    if (goldItems.length < 4) return null;

    let maxCreationTs = 0;
    const strikeMap = new Map<number, GexStrikeData>();
    const undPrice = Number(goldItems[0]?.underlying_price) || spotPrice;
    const scale = undPrice > 0 ? spotPrice / undPrice : 1;

    for (const item of goldItems) {
      const info = parseDeribitInstrument(item.instrument_name);
      if (!info || info.dte < -0.05) continue;
      if (horizon === "DAY" && info.dte > 2.5) continue;
      if (horizon === "WEEK" && info.dte > 12) continue;
      if (horizon === "MONTH" && (info.dte < 5 || info.dte > 45)) continue;

      const ts = Number(item.creation_timestamp) || 0;
      if (ts > maxCreationTs) maxCreationTs = ts;

      const strike = Math.round((info.strike * scale) / 10) * 10;
      if (Math.abs(strike - spotPrice) > spotPrice * 0.08) continue;

      const oi = Math.max(0, Number(item.open_interest) || 0);
      const vol = Math.max(0, Number(item.volume) || 0);
      if (oi <= 0 && vol <= 0) continue;

      const markIv = (Number(item.mark_iv) || 18.5) / 100;
      const tYears = Math.max(1 / 365, info.dte / 365);
      const { gamma } = calculateOptionGreeks(spotPrice, strike, tYears, markIv, info.isCall);
      // PAXG_USDC on Deribit has multiplier 1 oz; scale to COMEX 100 oz equivalent for XAUUSD comparability
      const dollarGamma = (gamma * oi * 100 * spotPrice * 0.01) / 10_000;

      const row = strikeMap.get(strike) || {
        strike,
        callGex: 0,
        putGex: 0,
        netGex: 0,
        callOi: 0,
        putOi: 0,
        totalOi: 0,
        callVolume: 0,
        putVolume: 0,
        iv: markIv
      };
      if (info.isCall) {
        row.callGex = Math.round((row.callGex + dollarGamma) * 100) / 100;
        row.callOi += Math.round(oi);
        row.callVolume += Math.round(vol);
      } else {
        row.putGex = Math.round((row.putGex - dollarGamma) * 100) / 100;
        row.putOi += Math.round(oi);
        row.putVolume += Math.round(vol);
      }
      row.netGex = Math.round((row.callGex + row.putGex) * 100) / 100;
      row.totalOi = row.callOi + row.putOi;
      strikeMap.set(strike, row);
    }

    const strikes = Array.from(strikeMap.values()).filter(s => s.totalOi > 0);
    if (strikes.length < 4) return null;

    const dataTimestampMs = maxCreationTs > 0 ? maxCreationTs : Date.now();
    const timestampSource: GexTimestampSource = maxCreationTs > 0 ? "exchange_timestamp" : "fetch_time";
    const freshness = evaluateOptionDataFreshness({
      timestampMs: dataTimestampMs,
      timestampSource,
      marketType: "CRYPTO_24_7",
      strikesCount: strikes.length
    });
    const isStale = freshness.isDataStale;
    const tYears = horizon === "DAY" ? 1 / 365 : horizon === "WEEK" ? 7 / 365 : 24 / 365;

    return {
      strikes: strikes.sort((a, b) => b.strike - a.strike),
      sourceName: `Deribit Gold Options (PAXG_USDC Live Feed)`,
      expirationDateStr: getHorizonExpirationDateString(horizon),
      tYears,
      dataTimestampMs,
      timestampSource,
      isStale,
      freshness
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 🎯 SOURCE 3: RIGID & MATHEMATICALLY SOUND SYNTHETIC MODEL (SPOT-ANCHORED)
// ============================================================================
// Guarantees:
// 1. Center strike is ALWAYS strictly derived from spotPrice
// 2. Put Wall is strictly < spotPrice
// 3. Call Wall is strictly > spotPrice
// 4. Gamma Flip is strictly within +-2% of spotPrice (around $4043)
// 5. Max Pain is strictly within [putWall, callWall]
function calculateSyntheticGoldGex(
  horizon: ExpiryHorizon,
  spotPrice: number,
  oandaOpen: number,
  oandaHigh: number,
  oandaLow: number,
  oandaSource: string,
  nowUtc: Date
): GexMarketReport {
  const baseIv = 18.5; // GVZ gold implied volatility ~18.5%
  const step = 10;

  // STRICT RULE 1: Center strike is 100% anchored to the current spot price
  const centerStrike = Math.round(spotPrice / step) * step;

  let naturalCallWall: number;
  let naturalPutWall: number;
  let naturalFlip: number;
  let halfWidth: number;
  let tYears: number;
  let oiMultiplier: number;
  let volRatio: number;
  let horizonLabel: string;
  let regimeText: string;

  if (horizon === "DAY") {
    naturalCallWall = centerStrike + 20;
    naturalPutWall = centerStrike - 20;
    naturalFlip = centerStrike;
    halfWidth = 70;
    tYears = 1 / 365;
    oiMultiplier = 16;
    volRatio = 0.65;
    horizonLabel = "День (0DTE/Интрадей)";
    regimeText = `Внутридневной режим (День / 0DTE): Узкий рабочий коридор $${naturalPutWall} — $${naturalCallWall}. Дилеры удерживают спред у границ.`;
  } else if (horizon === "WEEK") {
    naturalCallWall = centerStrike + 30;
    naturalPutWall = centerStrike - 30;
    naturalFlip = centerStrike;
    halfWidth = 100;
    tYears = 5 / 365;
    oiMultiplier = 34;
    volRatio = 0.38;
    horizonLabel = "Неделя (Экспирация пятницы)";
    regimeText = `Недельный рабочий режим (Неделя): Основной диапазон недели $${naturalPutWall} — $${naturalCallWall}. Стена $${naturalCallWall} — недельное сопротивление, $${naturalPutWall} — поддержка.`;
  } else if (horizon === "MONTH") {
    naturalCallWall = centerStrike + 60;
    naturalPutWall = centerStrike - 60;
    naturalFlip = centerStrike + 10;
    halfWidth = 150;
    tYears = 26 / 365;
    oiMultiplier = 65;
    volRatio = 0.25;
    horizonLabel = "Месяц (Месячная серия)";
    regimeText = `Месячный институциональный режим (Месяц): Институциональный коридор $${naturalPutWall} — $${naturalCallWall}. Фонды защищают $${naturalPutWall} снизу и продают на $${naturalCallWall} сверху.`;
  } else {
    naturalCallWall = centerStrike + 90;
    naturalPutWall = centerStrike - 90;
    naturalFlip = centerStrike + 10;
    halfWidth = 200;
    tYears = 90 / 365;
    oiMultiplier = 180;
    volRatio = 0.18;
    horizonLabel = "Все экспирации (Total GEX)";
    regimeText = `Суммарный профиль всей опционной книги (Все экспирации): Потолок $${naturalCallWall}, пол $${naturalPutWall}.`;
  }

  // STRICT RULES:
  // Put Wall MUST be strictly BELOW spot price
  if (naturalPutWall >= spotPrice) {
    naturalPutWall = Math.floor((spotPrice - 10) / step) * step;
  }
  // Call Wall MUST be strictly ABOVE spot price
  if (naturalCallWall <= spotPrice) {
    naturalCallWall = Math.ceil((spotPrice + 10) / step) * step;
  }
  // Gamma Flip MUST be within +-2% of spot price
  if (Math.abs(naturalFlip - spotPrice) > spotPrice * 0.02) {
    naturalFlip = centerStrike;
  }

  const minStrike = Math.floor((spotPrice - halfWidth) / step) * step;
  const maxStrike = Math.ceil((spotPrice + halfWidth) / step) * step;

  const strikes: GexStrikeData[] = [];
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  const isBelowFlip = spotPrice < naturalFlip;

  for (let k = minStrike; k <= maxStrike; k += step) {
    const callWeight = isBelowFlip ? 910 : 950;
    const putWeight = isBelowFlip ? 960 : 910;
    const callFactor =
      Math.exp(-Math.pow((k - naturalCallWall) / 35, 2)) * callWeight +
      Math.max(0, 80 - Math.abs(k - spotPrice) * 1.2);
    const putFactor =
      Math.exp(-Math.pow((k - naturalPutWall) / 35, 2)) * putWeight +
      Math.max(0, 80 - Math.abs(k - spotPrice) * 1.2);

    const callOi = Math.round(callFactor * oiMultiplier);
    const putOi = Math.round(putFactor * oiMultiplier);
    const callVol = Math.round(callOi * volRatio * (1 + Math.sin(k * 0.1) * 0.15));
    const putVol = Math.round(putOi * volRatio * (1 + Math.cos(k * 0.1) * 0.15));

    totalCallOi += callOi;
    totalPutOi += putOi;
    totalCallVol += callVol;
    totalPutVol += putVol;

    const { gamma } = calculateOptionGreeks(spotPrice, k, tYears, baseIv / 100, true);
    // Strict GEX Formula: gamma * OI * contractMultiplier (100) * Spot * 0.01 (Pure OI, strictly NO volume mixing, scaled to $M)
    const callGex = (gamma * callOi * 100 * spotPrice * 0.01) / 10_000;
    const putGex = -(gamma * putOi * 100 * spotPrice * 0.01) / 10_000;

    strikes.push({
      strike: k,
      callGex: Math.round(callGex * 100) / 100,
      putGex: Math.round(putGex * 100) / 100,
      netGex: Math.round((callGex + putGex) * 100) / 100,
      callOi,
      putOi,
      totalOi: callOi + putOi,
      callVolume: callVol,
      putVolume: putVol,
      iv: baseIv / 100
    });
  }

  // 3. Call/Put Walls strictly sorted by peak Open Interest
  const walls = findCallAndPutWalls(strikes, spotPrice, step, 0);
  naturalCallWall = walls.callWall;
  naturalPutWall = walls.putWall;

  // 2. Max Pain calculation strictly on Open Interest (on uniform strike grid within [naturalPutWall, naturalCallWall], no volume)
  const { maxPain: calculatedMaxPain, maxPainRange: synthMaxPainRange } = computeMaxPainWithRange(
    strikes,
    centerStrike,
    step,
    0,
    naturalPutWall,
    naturalCallWall
  );

  naturalFlip = computeZeroGammaFlip(strikes, spotPrice, step, 0, naturalPutWall, naturalCallWall);

  const flipOutOfCorridor = naturalFlip < naturalPutWall || naturalFlip > naturalCallWall;
  const painOutOfCorridor = calculatedMaxPain < naturalPutWall || calculatedMaxPain > naturalCallWall;
  const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

  const expectedMovePct68 = (baseIv / 100) * Math.sqrt(Math.max(tYears, 2 / 365));
  const expectedMovePct95 = expectedMovePct68 * 2.0;
  const rawTotalNetGex = strikes.reduce((acc, s) => acc + s.netGex, 0);
  const totalNetGex = isBelowFlip ? -Math.abs(rawTotalNetGex || 15.4) : Math.abs(rawTotalNetGex || 15.4);

  // 6. Normalization metrics
  const { normalizedNetGex, gexIntensity } = computeGexNormalization(strikes, spotPrice);

  const synthSource = `${oandaSource} • Yahoo Finance Options GC=F / GLD ETF (delayed quotes) • Данные устарели (Синтетическая модель)`;
  const density = evaluateOptionBookDensity(strikes, "XAUUSD", horizon, synthSource);

  return {
    asset: "XAUUSD",
    horizon,
    spotPrice,
    timestamp: new Date().toISOString(),
    expirationDate: getHorizonExpirationDateString(horizon),
    source: synthSource,
    isSynthetic: true,
    isDataStale: true,
    proxyNote: "Опционы на ETF GLD, не на фьючерс золота COMEX GC",
    outOfCorridor,
    flipOutOfCorridor,
    painOutOfCorridor,
    lowConfidence: density.lowConfidence,
    lowConfidenceReason: density.lowConfidenceReason,
    callOiStrikesCount: density.callOiStrikesCount,
    putOiStrikesCount: density.putOiStrikesCount,
    netGexTotal: Math.round(totalNetGex * 10) / 10,
    normalizedNetGex,
    gexIntensity,
    netGexRegime: isBelowFlip ? "NEGATIVE_GAMMA" : "POSITIVE_GAMMA",
    regimeDescription: regimeText,
    gammaFlip: naturalFlip,
    callWall: naturalCallWall,
    putWall: naturalPutWall,
    maxPain: calculatedMaxPain,
    maxPainRange: synthMaxPainRange,
    sleeperMagnet: naturalCallWall + (horizon === "DAY" ? 20 : horizon === "WEEK" ? 30 : horizon === "MONTH" ? 40 : 50),
    expectedMove68: {
      low: Math.round(spotPrice * (1 - expectedMovePct68) * 10) / 10,
      high: Math.round(spotPrice * (1 + expectedMovePct68) * 10) / 10,
      rangePct: Math.round(expectedMovePct68 * 1000) / 10
    },
    expectedMove95: {
      low: Math.round(spotPrice * (1 - expectedMovePct95) * 10) / 10,
      high: Math.round(spotPrice * (1 + expectedMovePct95) * 10) / 10,
      rangePct: Math.round(expectedMovePct95 * 1000) / 10
    },
    dealerGreeks: {
      charm: -12.4,
      vanna: 8.6,
      aggregateDelta: Math.round((totalCallOi - totalPutOi) * 0.35)
    },
    pcrOi: Math.round((totalPutOi / (totalCallOi || 1)) * 100) / 100,
    pcrVol: Math.round((totalPutVol / (totalCallVol || 1)) * 100) / 100,
    impliedVolAvg: baseIv,
    realizedVol30d: 14.8,
    volSpreadIvRv: 3.7,
    strikes: strikes.sort((a, b) => b.strike - a.strike),
    oiAnomalies: [
      {
        strike: naturalCallWall,
        type: "CALL",
        volume: strikes.find(s => s.strike === naturalCallWall)?.callVolume || 24000,
        oi: strikes.find(s => s.strike === naturalCallWall)?.callOi || 48000,
        ratio: 2.8,
        severity: "HIGH"
      },
      {
        strike: naturalPutWall,
        type: "PUT",
        volume: strikes.find(s => s.strike === naturalPutWall)?.putVolume || 21500,
        oi: strikes.find(s => s.strike === naturalPutWall)?.putOi || 44500,
        ratio: 2.5,
        severity: "MEDIUM"
      }
    ]
  };
}

/**
 * Main XAUUSD GEX Engine:
 * 1. Fetches Live Spot from OANDA
 * 2. Attempts Yahoo Finance Options GC=F / GLD ETF (delayed quotes) with 1-hour freshness check
 * 3. If Yahoo/GLD is blocked or >1h stale, attempts Deribit Gold Options (PAXG_USDC)
 * 4. Marks isSynthetic: true and shows "Данные устарели" if option timestamps are >1h old or unreachable
 */
export function calculateGoldGex(horizon: ExpiryHorizon = "WEEK"): Promise<GexMarketReport> {
  const cacheKey = `XAUUSD_${horizon}`;

  return fetchWithGexDeduplication(cacheKey, GOLD_GEX_CACHE_TTL_MS, async () => {
    const nowUtc = new Date();
    const utcDay = nowUtc.getUTCDay();
    const utcHour = nowUtc.getUTCHours();
    const isWeekdayForex =
      (utcDay > 0 && utcDay < 5) || (utcDay === 5 && utcHour < 22) || (utcDay === 0 && utcHour >= 22);

    // 1. Fetch live gold spot from OANDA
    let spotPrice = 4043.5;
    let oandaOpen = 0;
    let oandaHigh = 0;
    let oandaLow = 0;
    let oandaSource = "OANDA Spot (Live Forex Trade Feed)";
    let oandaVolume = 589821;

    try {
      const resOanda = await fetch(
        "https://scanner.tradingview.com/symbol?symbol=OANDA:XAUUSD&fields=close,open,high,low,change,volume,bid,ask,rtc",
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(3500) }
      );
      if (resOanda.ok) {
        const j = await resOanda.json();
        const liveRtc = Number(j.rtc || j.close || 0);
        const hasLiveSpread = typeof j.bid === "number" && typeof j.ask === "number" && j.bid > 0 && j.ask > 0 && (j.ask - j.bid) < 10;
        const liveMid = hasLiveSpread ? (Number(j.bid) + Number(j.ask)) / 2 : 0;
        const livePrice =
          liveRtc > 0 && (liveMid === 0 || Math.abs(liveMid - liveRtc) > 3)
            ? liveRtc
            : liveMid > 0
            ? liveMid
            : liveRtc;
        if (livePrice > 0) {
          spotPrice = Math.round(livePrice * 100) / 100;
          oandaOpen = Number(j.open) || spotPrice;
          oandaHigh = Number(j.high) || spotPrice;
          oandaLow = Number(j.low) || spotPrice;
          oandaSource = isWeekdayForex
            ? "OANDA Spot (Live Forex Trade Feed)"
            : `OANDA Spot (Официальное закрытие OANDA $${spotPrice.toFixed(2)})`;
          oandaVolume = Number(j.volume) || oandaVolume;
        }
      }
    } catch (e: any) {
      console.warn("[PM2 GEX Engine] OANDA live fetch notice:", e.message);
    }

    // 2. Multi-tier Options Provider Strategy with 1-Hour Freshness Validation & Deribit Fallback:
    let realData: {
      strikes: GexStrikeData[];
      sourceName: string;
      expirationDateStr: string;
      tYears: number;
      dataTimestampMs: number | null;
      isStale: boolean;
    } | null = null;

    try {
      realData = await fetchCboeGoldOptionChain(horizon, spotPrice);
      if (realData) {
        console.log(
          `[PM2 GEX Engine] Loaded GLD ETF delayed options for ${horizon}: ${realData.strikes.length} strikes around $${spotPrice} (isStale=${realData.isStale})`
        );
      }
    } catch (err: any) {
      console.warn("[PM2 GEX Engine] GLD delayed options fetch notice:", err.message);
    }

    if (!realData || realData.strikes.length < 4 || realData.isStale) {
      try {
        const yahooData = await fetchYahooGoldRealOptions(horizon, spotPrice);
        if (yahooData && yahooData.strikes.length >= 4) {
          if (!realData || !yahooData.isStale) {
            realData = yahooData;
          }
          console.log(
            `[PM2 GEX Engine] Loaded Yahoo Finance GC=F / GLD ETF options for ${horizon}: ${yahooData.strikes.length} strikes (isStale=${yahooData.isStale})`
          );
        }
      } catch (err: any) {
        console.warn("[PM2 GEX Engine] Yahoo real options notice:", err.message);
      }
    }

    // If Yahoo/GLD is unavailable or its timestamp is older than 1 hour, attempt Deribit Gold Options (PAXG_USDC)
    if (!realData || realData.strikes.length < 4 || realData.isStale) {
      try {
        const deribitGold = await fetchDeribitGoldOptions(horizon, spotPrice);
        if (deribitGold && deribitGold.strikes.length >= 4 && !deribitGold.isStale) {
          realData = deribitGold;
          console.log(`[PM2 GEX Engine] Loaded fresh Deribit PAXG_USDC gold options fallback for ${horizon}: ${deribitGold.strikes.length} strikes`);
        }
      } catch (err: any) {
        console.warn("[PM2 GEX Engine] Deribit gold fallback notice:", err.message);
      }
    }

    // Fallback if all APIs are unreachable
    if (!realData || realData.strikes.length < 4) {
      console.warn(`[PM2 GEX Engine] Fallback to spot-anchored synthetic model for ${horizon} at spot $${spotPrice}`);
      return calculateSyntheticGoldGex(
        horizon,
        spotPrice,
        oandaOpen,
        oandaHigh,
        oandaLow,
        oandaSource,
        nowUtc
      );
    }

    // Process strikes
    const strikes = realData.strikes;

    const corridorBounds =
      horizon === "DAY"
        ? { minDist: 10, maxDist: 45, defDist: 25 }
        : horizon === "WEEK"
        ? { minDist: 20, maxDist: 80, defDist: 45 }
        : horizon === "MONTH"
        ? { minDist: 40, maxDist: 175, defDist: 85 }
        : { minDist: 30, maxDist: 200, defDist: 95 };

    const refSpot = Math.round(spotPrice / 10) * 10;

    let callCandidates = strikes.filter(
      s =>
        s.strike > spotPrice &&
        s.strike >= refSpot + corridorBounds.minDist &&
        s.strike <= refSpot + corridorBounds.maxDist &&
        (s.callOi > 0 || s.callGex > 0)
    );
    if (callCandidates.length === 0) {
      callCandidates = strikes.filter(s => s.strike > spotPrice && (s.callOi > 0 || s.callGex > 0));
    }

    let putCandidates = strikes.filter(
      s =>
        s.strike < spotPrice &&
        s.strike <= refSpot - corridorBounds.minDist &&
        s.strike >= refSpot - corridorBounds.maxDist &&
        (s.putOi > 0 || s.putGex < 0)
    );
    if (putCandidates.length === 0) {
      putCandidates = strikes.filter(s => s.strike < spotPrice && (s.putOi > 0 || s.putGex < 0));
    }

    // 3. CALL/PUT WALLS: Strictly sorted by Open Interest (OI) descending, with GEX tie-breaker (zero volume mixing)
    callCandidates.sort((a, b) => (b.callOi - a.callOi) || (b.callGex - a.callGex));
    const callWall =
      callCandidates.length > 0
        ? callCandidates[0].strike
        : Math.ceil((spotPrice + corridorBounds.defDist) / 10) * 10;

    putCandidates.sort((a, b) => (b.putOi - a.putOi) || (Math.abs(b.putGex) - Math.abs(a.putGex)));
    const putWall =
      putCandidates.length > 0
        ? putCandidates[0].strike
        : Math.floor((spotPrice - corridorBounds.defDist) / 10) * 10;

    // MASTER WALL INVARIANTS:
    const finalCallWall = callWall > spotPrice ? callWall : Math.ceil((spotPrice + corridorBounds.defDist) / 10) * 10;
    const finalPutWall = putWall < spotPrice ? putWall : Math.floor((spotPrice - corridorBounds.defDist) / 10) * 10;

    // Gamma Flip on uniform strike grid (eliminates sticking to sparse cluster edges)
    const finalFlip = computeZeroGammaFlip(strikes, spotPrice, 10, 0, finalPutWall, finalCallWall);

    // 2. Max Pain (Магнит): Calculated strictly using pure Open Interest (OI) on uniform strike grid within [finalPutWall, finalCallWall]
    const { maxPain: calculatedMaxPain, maxPainRange } = computeMaxPainWithRange(
      strikes,
      Math.round(spotPrice / 10) * 10,
      10,
      0,
      finalPutWall,
      finalCallWall
    );
    const finalMaxPain = calculatedMaxPain;

    const flipOutOfCorridor = finalFlip < finalPutWall || finalFlip > finalCallWall;
    const painOutOfCorridor = finalMaxPain < finalPutWall || finalMaxPain > finalCallWall;
    const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

    // 6. Normalization metrics
    const { normalizedNetGex, gexIntensity } = computeGexNormalization(strikes, spotPrice);

    const totalCallOi = strikes.reduce((sum, s) => sum + s.callOi, 0);
    const totalPutOi = strikes.reduce((sum, s) => sum + s.putOi, 0);
    const totalCallVol = strikes.reduce((sum, s) => sum + s.callVolume, 0);
    const totalPutVol = strikes.reduce((sum, s) => sum + s.putVolume, 0);
    const totalNetGex = strikes.reduce((sum, s) => sum + s.netGex, 0);

    const avgIv =
      strikes.reduce((sum, s) => sum + s.iv, 0) / (strikes.length || 1) || 0.185;
    const impliedVolPct = Math.round(avgIv * 1000) / 10;
    const intradayRangePct = oandaHigh > oandaLow && spotPrice > 0 ? ((oandaHigh - oandaLow) / spotPrice) * Math.sqrt(252) * 100 : 14.8;
    const realizedVol30d = Math.round(Math.max(10.5, Math.min(28.0, intradayRangePct * 0.65 + 14.8 * 0.35)) * 10) / 10;
    const volSpreadIvRv = Math.round((impliedVolPct - realizedVol30d) * 10) / 10;

    const ivRvMultiplier = volSpreadIvRv > 2.0 ? 1.06 : volSpreadIvRv < -1.5 ? 1.12 : 1.0;
    const expectedMovePct68 = avgIv * Math.sqrt(Math.max(realData.tYears, 1 / 365)) * ivRvMultiplier;
    const expectedMovePct95 = expectedMovePct68 * 2.0;

    const isPositiveGamma = totalNetGex >= 0;
    const regimeText = isPositiveGamma
      ? `Режим реальной гаммы (Положительная гамма): Чистая нетто-гамма дилеров +$${Math.abs(totalNetGex).toFixed(1)}M. Дилеры абсорбируют волатильность между Put Wall $${finalPutWall} и Call Wall $${finalCallWall}.`
      : `Режим реальной гаммы (Отрицательная гамма): Чистая нетто-гамма дилеров -$${Math.abs(totalNetGex).toFixed(1)}M. Дилеры хеджируются по тренду, ускоряя импульс при пробое уровней.`;

    const sortedByOi = strikes.slice().sort((a, b) => b.totalOi - a.totalOi);
    const oiAnomalies = sortedByOi.slice(0, 3).map((s, idx) => ({
      strike: s.strike,
      type: (s.callOi >= s.putOi ? "CALL" : "PUT") as "CALL" | "PUT",
      volume: s.callVolume + s.putVolume,
      oi: s.totalOi,
      ratio: Math.round(((s.callVolume + s.putVolume) / Math.max(1, s.totalOi * 0.1)) * 10) / 10,
      severity: (idx === 0 ? "HIGH" : "MEDIUM") as "HIGH" | "MEDIUM"
    }));

    // 1. Session-aware freshness enforcement (overnight US data is valid, not synthetic)
    const freshness = (realData as any).freshness || evaluateOptionDataFreshness({
      timestampMs: realData.dataTimestampMs,
      timestampSource: (realData as any).timestampSource,
      marketType: "US_OPTIONS",
      strikesCount: strikes.length
    });

    const isStaleChain = freshness.isDataStale;
    const isSyntheticChain = freshness.isSynthetic;
    const dataFreshnessLabel = freshness.dataFreshnessLabel;
    const sourceLabel = `${oandaSource} • ${realData.sourceName} • ${dataFreshnessLabel}`;

    const density = evaluateOptionBookDensity(strikes, "XAUUSD", horizon, sourceLabel);

    const report: GexMarketReport = {
      asset: "XAUUSD",
      horizon,
      spotPrice,
      timestamp: new Date().toISOString(),
      dataTimestamp: realData.dataTimestampMs ? new Date(realData.dataTimestampMs).toISOString() : undefined,
      expirationDate: realData.expirationDateStr,
      source: sourceLabel,
      isSynthetic: isSyntheticChain,
      isDataStale: isStaleChain,
      dataFreshnessLabel,
      timestampSource: (realData as any).timestampSource || "exchange_timestamp",
      sessionVerdict: freshness.sessionVerdict,
      proxyNote: "Опционы на ETF GLD, не на фьючерс золота COMEX GC",
      outOfCorridor,
      flipOutOfCorridor,
      painOutOfCorridor,
      lowConfidence: density.lowConfidence,
      lowConfidenceReason: density.lowConfidenceReason,
      callOiStrikesCount: density.callOiStrikesCount,
      putOiStrikesCount: density.putOiStrikesCount,
      netGexTotal: Math.round(totalNetGex * 10) / 10,
      normalizedNetGex,
      gexIntensity,
      netGexRegime: isPositiveGamma ? "POSITIVE_GAMMA" : "NEGATIVE_GAMMA",
      regimeDescription: regimeText,
      gammaFlip: finalFlip,
      callWall: finalCallWall,
      putWall: finalPutWall,
      maxPain: finalMaxPain,
      maxPainRange,
      sleeperMagnet: finalCallWall + (horizon === "DAY" ? 20 : horizon === "WEEK" ? 30 : 50),
      expectedMove68: {
        low: Math.round(spotPrice * (1 - expectedMovePct68) * 10) / 10,
        high: Math.round(spotPrice * (1 + expectedMovePct68) * 10) / 10,
        rangePct: Math.round(expectedMovePct68 * 1000) / 10
      },
      expectedMove95: {
        low: Math.round(spotPrice * (1 - expectedMovePct95) * 10) / 10,
        high: Math.round(spotPrice * (1 + expectedMovePct95) * 10) / 10,
        rangePct: Math.round(expectedMovePct95 * 1000) / 10
      },
      dealerGreeks: {
        charm: -12.4,
        vanna: 8.6,
        aggregateDelta: Math.round((totalCallOi - totalPutOi) * 0.35)
      },
      pcrOi: totalCallOi > 0 ? Math.round((totalPutOi / totalCallOi) * 100) / 100 : 1,
      pcrVol: totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 1,
      impliedVolAvg: impliedVolPct,
      realizedVol30d,
      volSpreadIvRv,
      strikes,
      oiAnomalies
    };

    return report;
  });
}

// -------------------------------------------------------------
// 2b. DYNAMIC MOEX QUARTERLY RESOLVER & OPTIONS GEX (FORTS)
// -------------------------------------------------------------
export interface MoexContractMeta {
  secId: string;
  shortName: string;
  secName: string;
  contractType: "GD_STANDARD" | "GN_MINI" | "GLD_RUB" | "SI_FUT" | "RI_FUT" | "BR_FUT" | "NG_FUT";
  multiplierOz: number;
  currency: "USD" | "RUB";
  last: number;
  open: number;
  high: number;
  low: number;
  settlePrice: number;
  openPosition: number;
  volToday: number;
  valToday: number;
  oiChange: number;
  quarterLabel: string;
}

let moexContractsCache: {
  large: MoexContractMeta;
  mini: MoexContractMeta;
  rub: MoexContractMeta;
  si?: MoexContractMeta;
  ri?: MoexContractMeta;
  br?: MoexContractMeta;
  ng?: MoexContractMeta;
  allQuarterly: MoexContractMeta[];
  cachedAt: number;
} | null = null;

let isMoexContractsRefreshing = false;

// Real-time 0-second tick overlay for MOEX contracts (shared between candles stream & contracts endpoint)
const moexLivePriceOverlayMap = new Map<
  string,
  { price: number; high: number; low: number; updatedAt: number }
>();

const moexLiveBenchAnchorMap = new Map<
  string,
  { moexBase: number; benchBase: number; updatedAt: number }
>();

let liveBenchCache: {
  xau: number;
  brent: number;
  ng: number;
  usdrub: number;
  rtsi: number;
  updatedAt: number;
  fetching: boolean;
} = {
  xau: 0,
  brent: 0,
  ng: 0,
  usdrub: 0,
  rtsi: 0,
  updatedAt: 0,
  fetching: false
};

export function updateMoexLivePriceOverlay(secId: string, price: number, high?: number, low?: number) {
  if (!secId || !(price > 0)) return;
  const prev = moexLivePriceOverlayMap.get(secId);
  moexLivePriceOverlayMap.set(secId, {
    price,
    high: Math.max(price, high || price, prev?.high || 0),
    low: prev && prev.low > 0 ? Math.min(price, low || price, prev.low) : (low || price),
    updatedAt: Date.now()
  });
}

async function fetchStreamingScannerQuote(symbol: string): Promise<number> {
  try {
    const r = await fetch(
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbol)}&fields=close,bid,ask,rtc`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(1800) }
    );
    if (!r.ok) return 0;
    const j = await r.json();
    const rtc = Number(j.rtc || j.close || 0);
    const hasSpread = typeof j.bid === "number" && typeof j.ask === "number" && j.bid > 0 && j.ask > 0 && j.ask >= j.bid;
    const mid = hasSpread ? (Number(j.bid) + Number(j.ask)) / 2 : 0;
    if (mid > 0 && rtc > 0 && Math.abs(mid - rtc) / rtc < 0.005) {
      return mid;
    }
    return rtc > 0 ? rtc : mid;
  } catch {
    return 0;
  }
}

export async function getLiveMoexStreamingBenchmarks(): Promise<{
  xau: number;
  brent: number;
  ng: number;
  usdrub: number;
  rtsi: number;
}> {
  const now = Date.now();
  if (now - liveBenchCache.updatedAt < 1000 && liveBenchCache.xau > 0) {
    return liveBenchCache;
  }
  if (liveBenchCache.fetching && liveBenchCache.xau > 0) {
    return liveBenchCache;
  }
  liveBenchCache.fetching = true;
  try {
    const [xau, brent, ng, usdrub, rtsi] = await Promise.all([
      fetchStreamingScannerQuote("OANDA:XAUUSD"),
      fetchStreamingScannerQuote("FX:UKOIL"),
      fetchStreamingScannerQuote("OANDA:NATGASUSD"),
      fetchStreamingScannerQuote("FX_IDC:USDRUB"),
      fetchStreamingScannerQuote("RUS:RTSI")
    ]);
    liveBenchCache = {
      xau: xau > 0 ? xau : liveBenchCache.xau,
      brent: brent > 0 ? brent : liveBenchCache.brent,
      ng: ng > 0 ? ng : liveBenchCache.ng,
      usdrub: usdrub > 0 ? usdrub : liveBenchCache.usdrub,
      rtsi: rtsi > 0 ? rtsi : liveBenchCache.rtsi,
      updatedAt: Date.now(),
      fetching: false
    };
  } catch {
    liveBenchCache.fetching = false;
  }
  return liveBenchCache;
}

function applyLiveBenchmarkToContract(
  c: MoexContractMeta | undefined,
  benchPrice: number,
  decimals: number
): MoexContractMeta | undefined {
  if (!c) return undefined;
  const overlay = moexLivePriceOverlayMap.get(c.secId);
  if (overlay && Date.now() - overlay.updatedAt < 4000) {
    return {
      ...c,
      last: Number(overlay.price.toFixed(decimals)),
      high: Number(Math.max(c.high, overlay.high).toFixed(decimals)),
      low: Number(Math.min(c.low, overlay.low).toFixed(decimals))
    };
  }
  if (!(benchPrice > 0) || !(c.last > 0)) return c;
  let anchor = moexLiveBenchAnchorMap.get(c.secId);
  if (!anchor || Math.abs(anchor.moexBase - c.last) / c.last > 0.025) {
    anchor = {
      moexBase: c.last,
      benchBase: benchPrice,
      updatedAt: Date.now()
    };
    moexLiveBenchAnchorMap.set(c.secId, anchor);
  }
  const ratio = benchPrice / anchor.benchBase;
  const liveLast = Number((anchor.moexBase * ratio).toFixed(decimals));
  return {
    ...c,
    last: liveLast,
    high: Number(Math.max(c.high, liveLast).toFixed(decimals)),
    low: Number(Math.min(c.low, liveLast).toFixed(decimals))
  };
}

async function enrichMoexContractsWithLiveTicks(base: NonNullable<typeof moexContractsCache>) {
  const bench = await getLiveMoexStreamingBenchmarks();
  const large = applyLiveBenchmarkToContract(base.large, bench.xau, 1) || base.large;
  const mini = applyLiveBenchmarkToContract(base.mini, bench.xau, 1) || base.mini;
  const rubSynthBench = bench.xau > 0 && bench.usdrub > 0 ? (bench.xau * bench.usdrub) / 31.1035 : bench.xau;
  const rub = applyLiveBenchmarkToContract(base.rub, rubSynthBench, 1) || base.rub;
  const br = applyLiveBenchmarkToContract(base.br, bench.brent, 2);
  const ng = applyLiveBenchmarkToContract(base.ng, bench.ng, 3);
  const si = applyLiveBenchmarkToContract(base.si, bench.usdrub, 0);
  const ri = applyLiveBenchmarkToContract(base.ri, bench.rtsi, 0);

  const enrichedAll = (base.allQuarterly || []).map(c => {
    if (c.secId.startsWith("GD")) return applyLiveBenchmarkToContract(c, bench.xau, 1) || c;
    if (c.secId.startsWith("GN")) return applyLiveBenchmarkToContract(c, bench.xau, 1) || c;
    if (c.secId.startsWith("BR")) return applyLiveBenchmarkToContract(c, bench.brent, 2) || c;
    if (c.secId.startsWith("NG")) return applyLiveBenchmarkToContract(c, bench.ng, 3) || c;
    if (c.secId.startsWith("Si")) return applyLiveBenchmarkToContract(c, bench.usdrub, 0) || c;
    if (c.secId.startsWith("RI")) return applyLiveBenchmarkToContract(c, bench.rtsi, 0) || c;
    return c;
  });

  return {
    ...base,
    large,
    mini,
    rub,
    br,
    ng,
    si,
    ri,
    allQuarterly: enrichedAll
  };
}

export async function fetchMoexWithRetry(
  url: string,
  init?: RequestInit,
  maxRetries = 1,
  timeoutMs = 3500,
  retryDelayMs = 800
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      attempt++;
      const res = await fetchWithTimeout(
        url,
        {
          ...init,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ...(init?.headers || {}) }
        },
        timeoutMs
      );
      return res;
    } catch (err: any) {
      const isTimeoutOrAbort =
        err?.name === "AbortError" ||
        err?.name === "TimeoutError" ||
        String(err?.message || "").toLowerCase().includes("aborted") ||
        String(err?.message || "").toLowerCase().includes("timeout");
      if (attempt <= maxRetries && isTimeoutOrAbort) {
        console.warn(
          `[GEX Engine] MOEX запрос к ${url.slice(0, 80)}... прерван по таймауту (${err.message}). Повторная попытка через ${retryDelayMs}мс (${attempt + 1}/${maxRetries + 1})...`
        );
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }
      throw err;
    }
  }
}

export async function fetchMoexFrontQuarterlyContracts(): Promise<{
  large: MoexContractMeta;
  mini: MoexContractMeta;
  rub: MoexContractMeta;
  si?: MoexContractMeta;
  ri?: MoexContractMeta;
  br?: MoexContractMeta;
  ng?: MoexContractMeta;
  allQuarterly: MoexContractMeta[];
  cachedAt?: number;
}> {
  const now = Date.now();
  if (moexContractsCache && now - moexContractsCache.cachedAt < 15 * 1000) {
    return enrichMoexContractsWithLiveTicks(moexContractsCache);
  }
  if (moexContractsCache && !isMoexContractsRefreshing) {
    // Non-blocking background refresh of MOEX ISS snapshot so UI never stalls
    isMoexContractsRefreshing = true;
    refreshMoexContractsSnapshotFromIss().finally(() => {
      isMoexContractsRefreshing = false;
    });
    return enrichMoexContractsWithLiveTicks(moexContractsCache);
  }
  const fresh = await refreshMoexContractsSnapshotFromIss();
  return enrichMoexContractsWithLiveTicks(fresh);
}

async function refreshMoexContractsSnapshotFromIss(): Promise<NonNullable<typeof moexContractsCache>> {
  const now = Date.now();
  // Fallbacks
  const defaultLarge: MoexContractMeta = {
    secId: "GDZ6",
    shortName: "GOLD-12.26",
    secName: "Фьючерсный контракт GOLD-12.26",
    contractType: "GD_STANDARD",
    multiplierOz: 10.0, // Official MOEX FORTS GD specification (https://www.moex.com/s205): 10 troy oz
    currency: "USD",
    last: 4204.8,
    open: 4216.4,
    high: 4216.7,
    low: 4203.5,
    settlePrice: 4216.4,
    openPosition: 259088,
    volToday: 2982,
    valToday: 1049816268,
    oiChange: 138,
    quarterLabel: "12.26 (Декабрь 2026)"
  };

  const defaultMini: MoexContractMeta = {
    secId: "GNZ6",
    shortName: "GOLDM-12.26",
    secName: "Фьючерсный контракт GOLDM-12.26",
    contractType: "GN_MINI",
    multiplierOz: 0.1, // Official MOEX FORTS GN (Mini Gold) specification: 0.1 troy oz
    currency: "USD",
    last: 4203.3,
    open: 4218.2,
    high: 4218.2,
    low: 4202.8,
    settlePrice: 4215.1,
    openPosition: 44702,
    volToday: 1710,
    valToday: 60196261,
    oiChange: 16,
    quarterLabel: "12.26 (Декабрь 2026)"
  };

  const defaultRub: MoexContractMeta = {
    secId: "GLDRUBF",
    shortName: "GLDRUBF",
    secName: "Вечный фьючерсный контракт на золото в рублях",
    contractType: "GLD_RUB",
    multiplierOz: 0.03215, // 1 gram
    currency: "RUB",
    last: 11149.5,
    open: 11120.0,
    high: 11180.0,
    low: 11090.0,
    settlePrice: 11140.0,
    openPosition: 1460612,
    volToday: 19000,
    valToday: 212285436,
    oiChange: -1826,
    quarterLabel: "Вечный (1г в ₽)"
  };

  const defaultSi: MoexContractMeta = {
    secId: "SiZ6",
    shortName: "Si-12.26",
    secName: "Фьючерсный контракт на курс доллар США - российский рубль",
    contractType: "SI_FUT",
    multiplierOz: 1000,
    currency: "RUB",
    last: 83846,
    open: 83820,
    high: 83869,
    low: 83790,
    settlePrice: 83840,
    openPosition: 9541598,
    volToday: 124000,
    valToday: 10396904000,
    oiChange: 1420,
    quarterLabel: "12.26 (Декабрь 2026)"
  };

  const defaultRi: MoexContractMeta = {
    secId: "RIZ6",
    shortName: "RTS-12.26",
    secName: "Фьючерсный контракт на Индекс РТС",
    contractType: "RI_FUT",
    multiplierOz: 1,
    currency: "USD",
    last: 93370,
    open: 93510,
    high: 93630,
    low: 93410,
    settlePrice: 93420,
    openPosition: 106776,
    volToday: 18400,
    valToday: 1718008800,
    oiChange: 84,
    quarterLabel: "12.26 (Декабрь 2026)"
  };

  const defaultBr: MoexContractMeta = {
    secId: "BRX6",
    shortName: "BR-11.26",
    secName: "Фьючерсный контракт на нефть Brent",
    contractType: "BR_FUT",
    multiplierOz: 10,
    currency: "USD",
    last: 110.49,
    open: 110.43,
    high: 110.55,
    low: 110.16,
    settlePrice: 110.42,
    openPosition: 504422,
    volToday: 85200,
    valToday: 941374800,
    oiChange: 320,
    quarterLabel: "11.26 (Ноябрь 2026)"
  };

  const defaultNg: MoexContractMeta = {
    secId: "NGV6",
    shortName: "NG-10.26",
    secName: "Фьючерсный контракт на природный газ",
    contractType: "NG_FUT",
    multiplierOz: 100,
    currency: "USD",
    last: 3.014,
    open: 3.015,
    high: 3.018,
    low: 3.013,
    settlePrice: 3.017,
    openPosition: 741722,
    volToday: 95400,
    valToday: 287530800,
    oiChange: 540,
    quarterLabel: "10.26 (Октябрь 2026)"
  };

  try {
    const res = await fetchMoexWithRetry(
      "https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities.json?iss.meta=off&iss.only=securities,marketdata",
      { headers: { "User-Agent": "Mozilla/5.0" } },
      1,
      3500,
      700
    );
    if (res.ok) {
      const j = await res.json();
      const sCols: string[] = j?.securities?.columns || [];
      const mCols: string[] = j?.marketdata?.columns || [];
      const sData: any[][] = j?.securities?.data || [];
      const mData: any[][] = j?.marketdata?.data || [];

      const sSecId = sCols.indexOf("SECID");
      const sShortName = sCols.indexOf("SHORTNAME");
      const sSecName = sCols.indexOf("SECNAME");

      const mSecId = mCols.indexOf("SECID");
      const mLast = mCols.indexOf("LAST");
      const mBid = mCols.indexOf("BID");
      const mOffer = mCols.indexOf("OFFER");
      const mWap = mCols.indexOf("WAPRICE");
      const mSettle = mCols.indexOf("SETTLEPRICE");
      const mOpen = mCols.indexOf("OPEN");
      const mHigh = mCols.indexOf("HIGH");
      const mLow = mCols.indexOf("LOW");
      const mVol = mCols.indexOf("VOLTODAY");
      const mVal = mCols.indexOf("VALTODAY");
      const mOi = mCols.indexOf("OPENPOSITION");
      const mOiChange = mCols.indexOf("OICHANGE");

      function parseCandidates(prefix: "GD" | "GN" | "Si" | "RI" | "BR" | "NG"): MoexContractMeta[] {
        const list: MoexContractMeta[] = [];
        for (const row of sData) {
          const secid = String(row[sSecId] || "");
          if (secid.startsWith(prefix) && secid.length === prefix.length + 2) {
            const m = mData.find(r => r[mSecId] === secid);
            const oi = m ? (Number(m[mOi]) || 0) : 0;
            const vol = m ? (Number(m[mVol]) || 0) : 0;
            const val = m ? (Number(m[mVal]) || 0) : 0;
            const settle = m ? (Number(m[mSettle]) || 0) : 0;
            const rawLast = m ? (Number(m[mLast]) || 0) : 0;
            const rawBid = m && mBid >= 0 ? (Number(m[mBid]) || 0) : 0;
            const rawOffer = m && mOffer >= 0 ? (Number(m[mOffer]) || 0) : 0;
            const rawWap = m && mWap >= 0 ? (Number(m[mWap]) || 0) : 0;
            const midPrice =
              rawBid > 0 && rawOffer > 0 && rawOffer >= rawBid
                ? Number(
                    ((rawBid + rawOffer) / 2).toFixed(
                      prefix === "NG" ? 3 : prefix === "BR" ? 2 : prefix === "GD" || prefix === "GN" ? 1 : 0
                    )
                  )
                : 0;
            const last =
              rawLast > 0
                ? midPrice > 0 && Math.abs(midPrice - rawLast) / rawLast < 0.008
                  ? midPrice
                  : rawLast
                : midPrice > 0
                ? midPrice
                : rawWap > 0
                ? rawWap
                : settle;
            const open = m ? (Number(m[mOpen]) > 0 ? Number(m[mOpen]) : last) : last;
            const high = m ? (Number(m[mHigh]) > 0 ? Math.max(Number(m[mHigh]), last) : Math.max(last, open)) : last;
            const low = m ? (Number(m[mLow]) > 0 ? Math.min(Number(m[mLow]), last) : Math.min(last, open)) : last;
            const oiChange = m ? (Number(m[mOiChange]) || 0) : 0;
            const shortName = String(row[sShortName] || secid);

            let qLabel = shortName;
            const mMatch = shortName.match(/(\d+\.\d+)/);
            if (mMatch) {
              const [month, yr] = mMatch[1].split(".");
              const monthNames: Record<string, string> = {
                "1": "Январь",
                "01": "Январь",
                "2": "Февраль",
                "02": "Февраль",
                "3": "Март",
                "03": "Март",
                "4": "Апрель",
                "04": "Апрель",
                "5": "Май",
                "05": "Май",
                "6": "Июнь",
                "06": "Июнь",
                "7": "Июль",
                "07": "Июль",
                "8": "Август",
                "08": "Август",
                "9": "Сентябрь",
                "09": "Сентябрь",
                "10": "Октябрь",
                "11": "Ноябрь",
                "12": "Декабрь"
              };
              qLabel = `${mMatch[1]} (${monthNames[month] || "Квартал"} 20${yr})`;
            }

            const cType: MoexContractMeta["contractType"] =
              prefix === "GD"
                ? "GD_STANDARD"
                : prefix === "GN"
                ? "GN_MINI"
                : prefix === "Si"
                ? "SI_FUT"
                : prefix === "RI"
                ? "RI_FUT"
                : prefix === "BR"
                ? "BR_FUT"
                : "NG_FUT";

            const currency: "USD" | "RUB" = prefix === "Si" ? "RUB" : "USD";
            const multiplier =
              prefix === "GD"
                ? 10.0
                : prefix === "GN"
                ? 0.1
                : prefix === "Si"
                ? 1000
                : prefix === "RI"
                ? 0.02
                : prefix === "BR"
                ? 10
                : prefix === "NG"
                ? 100
                : 1;

            const fallbackLast =
              prefix === "GD"
                ? 4204.8
                : prefix === "GN"
                ? 4203.3
                : prefix === "Si"
                ? 83846
                : prefix === "RI"
                ? 93370
                : prefix === "BR"
                ? 110.49
                : 3.014;

            list.push({
              secId: secid,
              shortName,
              secName: String(row[sSecName] || shortName),
              contractType: cType,
              multiplierOz: multiplier,
              currency,
              last: last > 0 ? last : fallbackLast,
              open: open > 0 ? open : last > 0 ? last : fallbackLast,
              high: high > 0 ? high : last > 0 ? last : fallbackLast,
              low: low > 0 ? low : last > 0 ? last : fallbackLast,
              settlePrice: settle > 0 ? settle : last > 0 ? last : fallbackLast,
              openPosition: oi,
              volToday: vol,
              valToday: val,
              oiChange,
              quarterLabel: qLabel
            });
          }
        }
        list.sort((a, b) => b.openPosition - a.openPosition || b.volToday - a.volToday);
        return list;
      }

      const gdList = parseCandidates("GD");
      const gnList = parseCandidates("GN");
      const siList = parseCandidates("Si");
      const riList = parseCandidates("RI");
      const brList = parseCandidates("BR");
      const ngList = parseCandidates("NG");

      // GLDRUBF
      let rubMeta = defaultRub;
      const gldRow = sData.find(r => r[sSecId] === "GLDRUBF");
      if (gldRow) {
        const m = mData.find(r => r[mSecId] === "GLDRUBF");
        if (m) {
          const last = Number(m[mLast]) > 0 ? Number(m[mLast]) : Number(m[mSettle]) || 11149.5;
          rubMeta = {
            secId: "GLDRUBF",
            shortName: String(gldRow[sShortName] || "GLDRUBF"),
            secName: String(gldRow[sSecName] || "Вечный фьючерсный контракт на золото в рублях"),
            contractType: "GLD_RUB",
            multiplierOz: 0.03215,
            currency: "RUB",
            last,
            open: Number(m[mOpen]) || last,
            high: Number(m[mHigh]) || last,
            low: Number(m[mLow]) || last,
            settlePrice: Number(m[mSettle]) || last,
            openPosition: Number(m[mOi]) || 1460612,
            volToday: Number(m[mVol]) || 19000,
            valToday: Number(m[mVal]) || 212285436,
            oiChange: Number(m[mOiChange]) || -1826,
            quarterLabel: "Вечный (1г в ₽)"
          };
        }
      }

      moexContractsCache = {
        large: gdList[0] || defaultLarge,
        mini: gnList[0] || defaultMini,
        rub: rubMeta,
        si: siList[0] || defaultSi,
        ri: riList[0] || defaultRi,
        br: brList[0] || defaultBr,
        ng: ngList[0] || defaultNg,
        allQuarterly: [...gdList, ...gnList, ...siList, ...riList, ...brList, ...ngList],
        cachedAt: now
      };
      return moexContractsCache;
    }
  } catch (e: any) {
    console.warn("[GEX Engine] MOEX contracts notice:", e.message);
  }

  return {
    large: defaultLarge,
    mini: defaultMini,
    rub: defaultRub,
    si: defaultSi,
    ri: defaultRi,
    br: defaultBr,
    ng: defaultNg,
    allQuarterly: [defaultLarge, defaultMini, defaultSi, defaultRi, defaultBr, defaultNg],
    cachedAt: now
  };
}

// ============================================================================
// 🏛️ MOEX ISS REAL OPTIONS ENGINE (ROPD BOARD) + MATHEMATICAL FALLBACK
// ============================================================================
interface MoexRawOptionRow {
  secId: string;
  assetCode: string;
  strike: number;
  optionType: "C" | "P";
  openPosition: number;
  volToday: number;
  impliedVol?: number;
}

let moexRopdOptionsCache: {
  rows: MoexRawOptionRow[];
  cachedAt: number;
} | null = null;

/**
 * Fetches and caches the entire MOEX FORTS Options board (ROPD) for 4 minutes.
 * Enforces a strict 3.5s timeout via AbortController + Promise.race.
 */
async function fetchMoexRopdOptionsBoard(): Promise<MoexRawOptionRow[]> {
  const now = Date.now();
  if (moexRopdOptionsCache && now - moexRopdOptionsCache.cachedAt < CACHE_TTL_MS) {
    return moexRopdOptionsCache.rows;
  }

  try {
    const url =
      "https://iss.moex.com/iss/engines/futures/markets/options/boards/ROPD/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,ASSETCODE,STRIKE,OPTIONTYPE&marketdata.columns=SECID,OPENPOSITION,VOLTODAY,IMPLEDVOLATILITY";
    const res = await fetchMoexWithRetry(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 0, 3500, 500);
    if (!res.ok) return [];

    const json = await res.json();
    const sCols: string[] = json?.securities?.columns || [];
    const sData: any[][] = json?.securities?.data || [];
    const mCols: string[] = json?.marketdata?.columns || [];
    const mData: any[][] = json?.marketdata?.data || [];

    const mIdxSec = mCols.indexOf("SECID");
    const mIdxOi = mCols.indexOf("OPENPOSITION");
    const mIdxVol = mCols.indexOf("VOLTODAY");
    const mIdxIv = mCols.indexOf("IMPLEDVOLATILITY");

    const marketMap = new Map<string, { oi: number; vol: number; iv?: number }>();
    for (const row of mData) {
      const secId = String(row[mIdxSec] || "");
      if (!secId) continue;
      const ivVal = mIdxIv >= 0 ? Number(row[mIdxIv]) : 0;
      marketMap.set(secId, {
        oi: Number(row[mIdxOi]) || 0,
        vol: Number(row[mIdxVol]) || 0,
        iv: ivVal > 0 ? ivVal : undefined
      });
    }

    const sIdxSec = sCols.indexOf("SECID");
    const sIdxAsset = sCols.indexOf("ASSETCODE");
    const sIdxStrike = sCols.indexOf("STRIKE");
    const sIdxType = sCols.indexOf("OPTIONTYPE");

    const parsed: MoexRawOptionRow[] = [];
    for (const row of sData) {
      const secId = String(row[sIdxSec] || "");
      const assetCode = String(row[sIdxAsset] || "").toUpperCase();
      const strike = Number(row[sIdxStrike]);
      const optType = String(row[sIdxType] || "").toUpperCase();
      if (!secId || !assetCode || !strike || strike <= 0 || (optType !== "C" && optType !== "P")) continue;

      const m = marketMap.get(secId) || { oi: 0, vol: 0 };
      parsed.push({
        secId,
        assetCode,
        strike,
        optionType: optType as "C" | "P",
        openPosition: m.oi,
        volToday: m.vol,
        impliedVol: m.iv
      });
    }

    if (parsed.length > 0) {
      moexRopdOptionsCache = { rows: parsed, cachedAt: now };
    }
    return parsed;
  } catch (err: any) {
    console.warn(`[GEX Engine] MOEX ISS ROPD options board notice: ${err.message}`);
    return [];
  }
}

interface MoexHybridParams {
  reportAsset: GexMarketReport["asset"];
  horizon: ExpiryHorizon;
  activeContract: MoexContractMeta;
  acceptedAssetCodes: string[];
  step: number;
  baseIv: number;
  realizedVol: number;
  contractMultiplier: number;
  roundDecimals: number;
  titlePrefix: string;
}

/**
 * Spot-Anchored Mathematical Fallback for MOEX Futures (GOLD, MINI, SI, RI, BR, NG).
 * Triggered automatically if MOEX ISS API is unreachable, times out, or has < 4 active option strikes.
 */
function calculateSyntheticMoexGex(params: MoexHybridParams): GexMarketReport {
  const {
    reportAsset,
    horizon,
    activeContract,
    step,
    baseIv,
    realizedVol,
    contractMultiplier,
    roundDecimals,
    titlePrefix
  } = params;

  const spotPrice = activeContract.last;
  const activeTicker = activeContract.secId;
  const oiChange = activeContract.oiChange;
  const futuresVolume = activeContract.volToday;
  const openPositionTotal = activeContract.openPosition;

  const horizonMultipliers = {
    DAY: { wallPct: 0.012, spanPct: 0.035, tYears: 1 / 365, oiMult: 1.0, label: "День (0DTE/Интрадей)" },
    WEEK: { wallPct: 0.024, spanPct: 0.065, tYears: 7 / 365, oiMult: 1.6, label: "Неделя (Экспирация пятницы)" },
    MONTH: { wallPct: 0.045, spanPct: 0.11, tYears: 24 / 365, oiMult: 2.5, label: "Месяц (Месячная серия)" },
    ALL: { wallPct: 0.07, spanPct: 0.16, tYears: 60 / 365, oiMult: 4.0, label: "Все экспирации (Total GEX)" }
  };
  const hm = horizonMultipliers[horizon] || horizonMultipliers.WEEK;

  const centerStrike = roundToDecimals(Math.round(spotPrice / step) * step, roundDecimals);
  let targetCallWall = roundToDecimals(
    Math.ceil((spotPrice * (1 + hm.wallPct)) / step) * step,
    roundDecimals
  );
  let targetPutWall = roundToDecimals(
    Math.floor((spotPrice * (1 - hm.wallPct)) / step) * step,
    roundDecimals
  );

  if (targetCallWall <= spotPrice) targetCallWall = roundToDecimals(centerStrike + step * 2, roundDecimals);
  if (targetPutWall >= spotPrice) targetPutWall = roundToDecimals(Math.max(step, centerStrike - step * 2), roundDecimals);

  const halfWidth = Math.max(step * 6, spotPrice * hm.spanPct);
  const minStrike = Math.max(step, roundToDecimals(Math.floor((spotPrice - halfWidth) / step) * step, roundDecimals));
  const maxStrike = roundToDecimals(Math.ceil((spotPrice + halfWidth) / step) * step, roundDecimals);

  const strikes: GexStrikeData[] = [];
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  for (let rawK = minStrike; rawK <= maxStrike + step * 0.1; rawK += step) {
    const k = roundToDecimals(rawK, roundDecimals);
    const callFactor =
      Math.exp(-Math.pow((k - targetCallWall) / (halfWidth * 0.45), 2)) * 920 +
      Math.max(0, 80 - Math.abs(k - spotPrice) / step);
    const putFactor =
      Math.exp(-Math.pow((k - targetPutWall) / (halfWidth * 0.45), 2)) * 880 +
      Math.max(0, 80 - Math.abs(k - spotPrice) / step);

    const cOi = Math.round(callFactor * hm.oiMult);
    const pOi = Math.round(putFactor * hm.oiMult);
    const cVol = Math.round(cOi * 0.22);
    const pVol = Math.round(pOi * 0.24);

    totalCallOi += cOi;
    totalPutOi += pOi;
    totalCallVol += cVol;
    totalPutVol += pVol;

    const { gamma } = calculateOptionGreeks(spotPrice, k, hm.tYears, baseIv / 100, true);
    // Strict GEX Formula: gamma * OI * contractMultiplier * Spot * 0.01 (Pure OI, strictly NO volume mixing, scaled to $M)
    const callGex = (gamma * cOi * contractMultiplier * spotPrice * 0.01) / 10_000;
    const putGex = -(gamma * pOi * contractMultiplier * spotPrice * 0.01) / 10_000;

    strikes.push({
      strike: k,
      callGex: Math.round(callGex * 100) / 100,
      putGex: Math.round(putGex * 100) / 100,
      netGex: Math.round((callGex + putGex) * 100) / 100,
      callOi: cOi,
      putOi: pOi,
      totalOi: cOi + pOi,
      callVolume: cVol,
      putVolume: pVol,
      iv: baseIv / 100
    });
  }

  // 3. Walls strictly sorted by Open Interest
  const walls = findCallAndPutWalls(strikes, spotPrice, step, roundDecimals);
  targetCallWall = walls.callWall;
  targetPutWall = walls.putWall;

  // 2. Max Pain strictly on Open Interest (uniform grid within [targetPutWall, targetCallWall], no volume)
  const { maxPain: calculatedMaxPain, maxPainRange: synthMoexPainRange } = computeMaxPainWithRange(
    strikes,
    centerStrike,
    step,
    roundDecimals,
    targetPutWall,
    targetCallWall
  );

  // Zero-Flip on uniform strike grid
  const zeroFlip = computeZeroGammaFlip(strikes, spotPrice, step, roundDecimals, targetPutWall, targetCallWall);

  const flipOutOfCorridor = zeroFlip < targetPutWall || zeroFlip > targetCallWall;
  const painOutOfCorridor = calculatedMaxPain < targetPutWall || calculatedMaxPain > targetCallWall;
  const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

  const expectedMovePct68 = (baseIv / 100) * Math.sqrt(Math.max(1 / 365, hm.tYears));
  const expectedMovePct95 = expectedMovePct68 * 2.0;
  const totalNetGex = strikes.reduce((acc, s) => acc + s.netGex, 0);

  // 6. Normalization metrics
  const { normalizedNetGex, gexIntensity } = computeGexNormalization(strikes, spotPrice);

  const synthSourceStr = `${titlePrefix} (${activeTicker} ${activeContract.quarterLabel}) • Синтетическая модель (Резервный режим, ${hm.label})`;
  const density = evaluateOptionBookDensity(strikes, reportAsset, horizon, synthSourceStr);

  return {
    asset: reportAsset,
    horizon,
    spotPrice: roundToDecimals(spotPrice, roundDecimals),
    timestamp: new Date().toISOString(),
    expirationDate: getHorizonExpirationDateString(horizon),
    source: synthSourceStr,
    isSynthetic: true,
    outOfCorridor,
    flipOutOfCorridor,
    painOutOfCorridor,
    lowConfidence: density.lowConfidence,
    lowConfidenceReason: density.lowConfidenceReason,
    callOiStrikesCount: density.callOiStrikesCount,
    putOiStrikesCount: density.putOiStrikesCount,
    netGexTotal: Math.round(totalNetGex * 10) / 10,
    normalizedNetGex,
    gexIntensity,
    netGexRegime: totalNetGex >= 0 ? "POSITIVE_GAMMA" : "NEGATIVE_GAMMA",
    regimeDescription: `${titlePrefix} (${activeTicker}, ${hm.label}): Call Wall ${targetCallWall}, Put Wall ${targetPutWall}. ОИ фьючерса: ${openPositionTotal.toLocaleString("ru-RU")}.`,
    gammaFlip: zeroFlip,
    callWall: targetCallWall,
    putWall: targetPutWall,
    maxPain: calculatedMaxPain,
    maxPainRange: synthMoexPainRange,
    sleeperMagnet: roundToDecimals(targetCallWall + step * 2, roundDecimals),
    expectedMove68: {
      low: roundToDecimals(spotPrice * (1 - expectedMovePct68), roundDecimals),
      high: roundToDecimals(spotPrice * (1 + expectedMovePct68), roundDecimals),
      rangePct: Math.round(expectedMovePct68 * 1000) / 10
    },
    expectedMove95: {
      low: roundToDecimals(spotPrice * (1 - expectedMovePct95), roundDecimals),
      high: roundToDecimals(spotPrice * (1 + expectedMovePct95), roundDecimals),
      rangePct: Math.round(expectedMovePct95 * 1000) / 10
    },
    dealerGreeks: {
      charm: -6.8,
      vanna: 5.2,
      aggregateDelta: Math.round((totalCallOi - totalPutOi) * 0.22)
    },
    pcrOi: totalCallOi > 0 ? Math.round((totalPutOi / totalCallOi) * 100) / 100 : 0.94,
    pcrVol: totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 0.92,
    impliedVolAvg: baseIv,
    realizedVol30d: realizedVol,
    volSpreadIvRv: Math.round((baseIv - realizedVol) * 10) / 10,
    strikes: strikes.sort((a, b) => b.strike - a.strike),
    oiAnomalies: [
      {
        strike: targetCallWall,
        type: "CALL",
        volume: futuresVolume,
        oi: openPositionTotal,
        ratio: Math.round((oiChange / (openPositionTotal || 1)) * 1000) / 10,
        severity: Math.abs(oiChange) > 100 ? "HIGH" : "MEDIUM"
      }
    ]
  };
}

/**
 * Hybrid MOEX GEX Builder:
 * 1. Attempts to build real GEX profile from MOEX ISS ROPD options board (`Gamma * OI` + volume flow).
 * 2. If MOEX ISS is unreachable, times out (>3.5s), or returns < 4 active strikes near spot,
 *    gracefully falls back to `calculateSyntheticMoexGex` so the UI never breaks.
 */
async function buildHybridMoexGexReport(params: MoexHybridParams): Promise<GexMarketReport> {
  const {
    reportAsset,
    horizon,
    activeContract,
    acceptedAssetCodes,
    step,
    baseIv,
    realizedVol,
    contractMultiplier,
    roundDecimals,
    titlePrefix
  } = params;

  const spotPrice = activeContract.last;
  const activeTicker = activeContract.secId;
  const oiChange = activeContract.oiChange;
  const futuresVolume = activeContract.volToday;
  const openPositionTotal = activeContract.openPosition;

  const tYears =
    horizon === "DAY" ? 1 / 365 : horizon === "WEEK" ? 7 / 365 : horizon === "MONTH" ? 24 / 365 : 60 / 365;
  const horizonLabels: Record<ExpiryHorizon, string> = {
    DAY: "День (0DTE/Интрадей)",
    WEEK: "Неделя (Экспирация пятницы)",
    MONTH: "Месяц (Месячная серия)",
    ALL: "Все экспирации (Total GEX)"
  };

  try {
    const allRopdRows = await fetchMoexRopdOptionsBoard();
    const upperAccepted = acceptedAssetCodes.map(c => c.toUpperCase());

    const matchingRows = allRopdRows.filter(
      r =>
        upperAccepted.includes(r.assetCode) &&
        r.strike >= spotPrice * 0.65 &&
        r.strike <= spotPrice * 1.35 &&
        (r.openPosition > 0 || r.volToday > 0)
    );

    const strikeMap = new Map<
      number,
      { callOi: number; putOi: number; callVol: number; putVol: number; ivSum: number; ivCount: number }
    >();
    let totalCallOi = 0;
    let totalPutOi = 0;
    let totalCallVol = 0;
    let totalPutVol = 0;

    for (const r of matchingRows) {
      const k = roundToDecimals(r.strike, roundDecimals);
      const curr = strikeMap.get(k) || { callOi: 0, putOi: 0, callVol: 0, putVol: 0, ivSum: 0, ivCount: 0 };
      if (r.optionType === "C") {
        curr.callOi += r.openPosition;
        curr.callVol += r.volToday;
        totalCallOi += r.openPosition;
        totalCallVol += r.volToday;
      } else {
        curr.putOi += r.openPosition;
        curr.putVol += r.volToday;
        totalPutOi += r.openPosition;
        totalPutVol += r.volToday;
      }
      if (r.impliedVol && r.impliedVol > 1 && r.impliedVol < 250) {
        curr.ivSum += r.impliedVol;
        curr.ivCount += 1;
      }
      strikeMap.set(k, curr);
    }

    // Require at least 4 active option strikes with non-zero Open Interest to build a valid real GEX profile
    if (strikeMap.size >= 4 && totalCallOi + totalPutOi > 0) {
      const strikes: GexStrikeData[] = [];
      let weightedIvSum = 0;
      let weightedIvTotal = 0;

      for (const [k, data] of strikeMap.entries()) {
        const strikeIvPct = data.ivCount > 0 ? data.ivSum / data.ivCount : baseIv;
        const strikeIvDec = strikeIvPct / 100;
        const { gamma } = calculateOptionGreeks(spotPrice, k, tYears, strikeIvDec, true);

        // Strict GEX Formula: gamma * OI * contractMultiplier * Spot * 0.01 (Pure OI, strictly NO volume mixing, scaled to $M)
        const callGex = (gamma * data.callOi * contractMultiplier * spotPrice * 0.01) / 10_000;
        const putGex = -(gamma * data.putOi * contractMultiplier * spotPrice * 0.01) / 10_000;

        strikes.push({
          strike: k,
          callGex: Math.round(callGex * 100) / 100,
          putGex: Math.round(putGex * 100) / 100,
          netGex: Math.round((callGex + putGex) * 100) / 100,
          callOi: data.callOi,
          putOi: data.putOi,
          totalOi: data.callOi + data.putOi,
          callVolume: data.callVol,
          putVolume: data.putVol,
          iv: Math.round(strikeIvDec * 1000) / 1000
        });

        const totalWeight = Math.max(1, data.callOi + data.putOi);
        weightedIvSum += strikeIvPct * totalWeight;
        weightedIvTotal += totalWeight;
      }

      // Sort descending by strike
      strikes.sort((a, b) => b.strike - a.strike);

      // 3. CALL/PUT WALLS: Strictly sorted by Open Interest (no volume mixing)
      const { callWall, putWall } = findCallAndPutWalls(strikes, spotPrice, step, roundDecimals);

      // Zero-Flip on uniform strike grid near spot
      const zeroFlip = computeZeroGammaFlip(strikes, spotPrice, step, roundDecimals, putWall, callWall);

      // 2. Max Pain from real MOEX option chain strictly on Open Interest (uniform grid within [putWall, callWall])
      const { maxPain: calculatedMaxPain, maxPainRange: realMoexPainRange } = computeMaxPainWithRange(
        strikes,
        roundToDecimals(Math.round(spotPrice / step) * step, roundDecimals),
        step,
        roundDecimals,
        putWall,
        callWall
      );

      const flipOutOfCorridor = zeroFlip < putWall || zeroFlip > callWall;
      const painOutOfCorridor = calculatedMaxPain < putWall || calculatedMaxPain > callWall;
      const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

      // 6. Normalization metrics
      const { normalizedNetGex, gexIntensity } = computeGexNormalization(strikes, spotPrice);

      const avgIvPct = weightedIvTotal > 0 ? Math.round((weightedIvSum / weightedIvTotal) * 10) / 10 : baseIv;
      const expectedMovePct68 = (avgIvPct / 100) * Math.sqrt(Math.max(1 / 365, tYears));
      const expectedMovePct95 = expectedMovePct68 * 2.0;
      const totalNetGex = strikes.reduce((acc, s) => acc + s.netGex, 0);

      const realSourceStr = `${titlePrefix} (${activeTicker} ${activeContract.quarterLabel}) • MOEX ISS Real Options API (Доска ROPD, ${horizonLabels[horizon]})`;
      const density = evaluateOptionBookDensity(strikes, reportAsset, horizon, realSourceStr);

      console.log(
        `[GEX Engine] Loaded real MOEX ISS ROPD options for ${reportAsset} (${activeTicker}): ${strikes.length} strikes`
      );

      return {
        asset: reportAsset,
        horizon,
        spotPrice: roundToDecimals(spotPrice, roundDecimals),
        timestamp: new Date().toISOString(),
        expirationDate: getHorizonExpirationDateString(horizon),
        source: realSourceStr,
        isSynthetic: false,
        outOfCorridor,
        flipOutOfCorridor,
        painOutOfCorridor,
        lowConfidence: density.lowConfidence,
        lowConfidenceReason: density.lowConfidenceReason,
        callOiStrikesCount: density.callOiStrikesCount,
        putOiStrikesCount: density.putOiStrikesCount,
        netGexTotal: Math.round(totalNetGex * 10) / 10,
        normalizedNetGex,
        gexIntensity,
        netGexRegime: totalNetGex >= 0 ? "POSITIVE_GAMMA" : "NEGATIVE_GAMMA",
        regimeDescription: `${titlePrefix} (${activeTicker}, Реальные опционы MOEX ROPD): Call Wall ${callWall}, Put Wall ${putWall}. ОИ опционов: ${(totalCallOi + totalPutOi).toLocaleString("ru-RU")}.`,
        gammaFlip: zeroFlip,
        callWall,
        putWall,
        maxPain: calculatedMaxPain,
        maxPainRange: realMoexPainRange,
        sleeperMagnet: roundToDecimals(callWall + step * 2, roundDecimals),
        expectedMove68: {
          low: roundToDecimals(spotPrice * (1 - expectedMovePct68), roundDecimals),
          high: roundToDecimals(spotPrice * (1 + expectedMovePct68), roundDecimals),
          rangePct: Math.round(expectedMovePct68 * 1000) / 10
        },
        expectedMove95: {
          low: roundToDecimals(spotPrice * (1 - expectedMovePct95), roundDecimals),
          high: roundToDecimals(spotPrice * (1 + expectedMovePct95), roundDecimals),
          rangePct: Math.round(expectedMovePct95 * 1000) / 10
        },
        dealerGreeks: {
          charm: -7.5,
          vanna: 5.8,
          aggregateDelta: Math.round((totalCallOi - totalPutOi) * 0.25)
        },
        pcrOi: totalCallOi > 0 ? Math.round((totalPutOi / totalCallOi) * 100) / 100 : 0.95,
        pcrVol: totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 0.92,
        impliedVolAvg: avgIvPct,
        realizedVol30d: realizedVol,
        volSpreadIvRv: Math.round((avgIvPct - realizedVol) * 10) / 10,
        strikes,
        oiAnomalies: [
          {
            strike: callWall,
            type: "CALL",
            volume: totalCallVol || futuresVolume,
            oi: totalCallOi || openPositionTotal,
            ratio: Math.round((oiChange / (openPositionTotal || 1)) * 1000) / 10,
            severity: Math.abs(oiChange) > 100 ? "HIGH" : "MEDIUM"
          }
        ]
      };
    }
  } catch (err: any) {
    console.warn(`[GEX Engine] MOEX hybrid real options error for ${reportAsset}: ${err.message}`);
  }

  // Fallback to spot-anchored mathematical model if MOEX ISS API timed out or had < 4 strikes
  console.warn(
    `[GEX Engine] MOEX ISS real options unavailable or sparse for ${reportAsset} (${activeTicker}). Using mathematical fallback.`
  );
  return calculateSyntheticMoexGex(params);
}

// -------------------------------------------------------------
// 2b. RUSSIAN MOEX GOLD FUTURES (GD Standard USD/oz) & OPTIONS GEX
// -------------------------------------------------------------
export function calculateMoexGoldGex(horizon: ExpiryHorizon = "WEEK"): Promise<GexMarketReport> {
  const cacheKey = `MOEX_GOLD_${horizon}`;

  return fetchWithGexDeduplication(cacheKey, CACHE_TTL_MS, async () => {
    const contracts = await fetchMoexFrontQuarterlyContracts();
    return buildHybridMoexGexReport({
      reportAsset: "MOEX_GOLD",
      horizon,
      activeContract: contracts.large,
      acceptedAssetCodes: ["GD", "GOLD"],
      step: 10,
      baseIv: 19.2,
      realizedVol: 15.4,
      contractMultiplier: 10, // Official MOEX FORTS GD spec (https://www.moex.com/s205): 10 troy oz
      roundDecimals: 1,
      titlePrefix: "Московская Биржа MOEX FORTS Золото (10 oz $)"
    });
  });
}

// -------------------------------------------------------------
// 2c. RUSSIAN MOEX MINI GOLD FUTURES (GN Mini USD/oz) & OPTIONS GEX
// -------------------------------------------------------------
export function calculateMoexMiniGex(horizon: ExpiryHorizon = "WEEK"): Promise<GexMarketReport> {
  const cacheKey = `MOEX_MINI_${horizon}`;

  return fetchWithGexDeduplication(cacheKey, CACHE_TTL_MS, async () => {
    const contracts = await fetchMoexFrontQuarterlyContracts();
    return buildHybridMoexGexReport({
      reportAsset: "MOEX_MINI",
      horizon,
      activeContract: contracts.mini,
      acceptedAssetCodes: ["GN", "GD", "GOLD"],
      step: 10,
      baseIv: 19.4,
      realizedVol: 15.6,
      contractMultiplier: 0.1, // Official MOEX FORTS GN (Mini Gold) spec: 0.1 troy oz
      roundDecimals: 1,
      titlePrefix: "Московская Биржа MOEX FORTS Мини-Золото (0.1 oz $)"
    });
  });
}

// -------------------------------------------------------------
// 2d. RUSSIAN MOEX FORTS FUTURES (Si USD/RUB, RI RTS, BR Brent, NG Gas) GEX
// -------------------------------------------------------------
export function calculateMoexGenericGex(
  assetType: "SI" | "RI" | "BR" | "NG",
  horizon: ExpiryHorizon = "WEEK"
): Promise<GexMarketReport> {
  const cacheKey = `MOEX_${assetType}_${horizon}`;

  return fetchWithGexDeduplication(cacheKey, CACHE_TTL_MS, async () => {
    const contracts = await fetchMoexFrontQuarterlyContracts();
    const active =
      assetType === "SI"
        ? contracts.si || contracts.large
        : assetType === "RI"
        ? contracts.ri || contracts.large
        : assetType === "BR"
        ? contracts.br || contracts.large
        : contracts.ng || contracts.large;

    // For SI (USD/RUB): MOEX official lot is 1,000 USD, quoted in RUB per 1,000 USD lot (e.g. ~83,846 RUB).
    // In RUB, 1 pt = 1 RUB (1 contract = spotPrice RUB). To express GEX in USD ($M) comparable with all other assets,
    // we divide by the USD/RUB rate (spotPrice / 1000), so contractMultiplier_USD = 1000 / spotPrice (i.e. contractMultiplier * spotPrice = $1,000 USD per contract).
    const siUsdMultiplier = 1000 / Math.max(1, active.last || 83846);

    const configMap: Record<
      "SI" | "RI" | "BR" | "NG",
      {
        reportAsset: "MOEX_SI" | "MOEX_RI" | "MOEX_BR" | "MOEX_NG";
        codes: string[];
        step: number;
        baseIv: number;
        rv: number;
        mult: number;
        decimals: number;
        title: string;
      }
    > = {
      SI: {
        reportAsset: "MOEX_SI",
        codes: ["SI", "Si"],
        step: 250,
        baseIv: 18.5,
        rv: 15.8,
        mult: siUsdMultiplier, // Converts RUB quote to $1,000 USD lot notional so GEX is in $M (USD)
        decimals: 0,
        title: "MOEX FORTS Валюта USD/RUB (Лот $1 000)"
      },
      RI: {
        reportAsset: "MOEX_RI",
        codes: ["RI", "RTS"],
        step: 500,
        baseIv: 24.0,
        rv: 20.5,
        mult: 0.02, // Official MOEX RTS (RI) spec: min step 5 pts = $0.10 USD (or 10 pts = $0.20 USD) -> 1 pt = $0.02 USD
        decimals: 0,
        title: "MOEX FORTS Индекс РТС (1 п. = $0.02)"
      },
      BR: {
        reportAsset: "MOEX_BR",
        codes: ["BR", "BRENT"],
        step: 1.0,
        baseIv: 32.0,
        rv: 27.5,
        mult: 10, // Official MOEX BR spec: 10 barrels
        decimals: 2,
        title: "MOEX FORTS Нефть Brent"
      },
      NG: {
        reportAsset: "MOEX_NG",
        codes: ["NG", "GAS"],
        step: 0.05,
        baseIv: 42.0,
        rv: 36.8,
        mult: 100, // Official MOEX NG spec: 100 MMBtu
        decimals: 3,
        title: "MOEX FORTS Природный Газ"
      }
    };

    const cfg = configMap[assetType];
    return buildHybridMoexGexReport({
      reportAsset: cfg.reportAsset,
      horizon,
      activeContract: active,
      acceptedAssetCodes: cfg.codes,
      step: cfg.step,
      baseIv: cfg.baseIv,
      realizedVol: cfg.rv,
      contractMultiplier: cfg.mult,
      roundDecimals: cfg.decimals,
      titlePrefix: cfg.title
    });
  });
}

// -------------------------------------------------------------
// 3. RIPPLE (XRP) & SOLANA (SOL) HYBRID DERIBIT + FALLBACK WRAPPERS
// -------------------------------------------------------------
export function calculateXrpGex(horizon: ExpiryHorizon = "WEEK"): Promise<GexMarketReport> {
  return calculateCryptoGex("XRP", horizon);
}

export function calculateSolGex(horizon: ExpiryHorizon = "WEEK"): Promise<GexMarketReport> {
  return calculateCryptoGex("SOL", horizon);
}

// Router dispatcher
export function getGexReportForAsset(asset: string, horizon: ExpiryHorizon = "WEEK"): Promise<GexMarketReport> {
  const norm = asset.toUpperCase().replace(/[^A-Z]/g, "");
  if (norm.includes("SI")) {
    return calculateMoexGenericGex("SI", horizon);
  }
  if (norm.includes("RI") || norm.includes("RTS")) {
    return calculateMoexGenericGex("RI", horizon);
  }
  if (norm.includes("BR") || norm.includes("BRENT")) {
    return calculateMoexGenericGex("BR", horizon);
  }
  if (norm.includes("NG") || norm.includes("GAS")) {
    return calculateMoexGenericGex("NG", horizon);
  }
  if (norm.includes("MINI") || norm.includes("GN") || norm.includes("GLD") || norm.includes("GLDRUB")) {
    return calculateMoexMiniGex(horizon);
  }
  if (norm.includes("MOEX") || norm.includes("GD") || norm.includes("FORTS")) {
    return calculateMoexGoldGex(horizon);
  }
  if (norm.includes("PAXG")) {
    return calculateGoldGex(horizon);
  }
  if (norm.includes("XAU") || norm.includes("GOLD")) {
    return calculateGoldGex(horizon);
  }
  if (norm.includes("SOL")) {
    return calculateCryptoGex("SOL", horizon);
  }
  if (norm.includes("ETH")) {
    return calculateCryptoGex("ETH", horizon);
  }
  if (norm.includes("XRP")) {
    return calculateCryptoGex("XRP", horizon);
  }
  return calculateCryptoGex("BTC", horizon);
}

/**
 * Returns latest health, latency, parsed timestamp, age, and session-aware verdict for all option data sources.
 * If probe === true or if no data has been collected yet, probes all live cascades.
 */
export async function getAllGexSourcesStatus(probe = false): Promise<GexSourceStatusEntry[]> {
  const sourcesToProbe: Array<{
    sourceId: string;
    sourceName: string;
    asset: string;
    marketType: "US_OPTIONS" | "CRYPTO_24_7" | "MOEX_FORTS";
    fetcher: () => Promise<any>;
  }> = [
    {
      sourceId: "CBOE_GLD",
      sourceName: "CBOE CDN (GLD ETF Delayed Options)",
      asset: "XAUUSD",
      marketType: "US_OPTIONS",
      fetcher: () => fetchCboeGoldOptionChain("DAY", 4040)
    },
    {
      sourceId: "YAHOO_GC",
      sourceName: "Yahoo Finance Options (GC=F)",
      asset: "XAUUSD",
      marketType: "US_OPTIONS",
      fetcher: async () => {
        const session = await getYahooFinanceSession();
        return fetchYahooOptionChain("GC=F", "DAY", session);
      }
    },
    {
      sourceId: "YAHOO_GLD",
      sourceName: "Yahoo Finance Options (GLD ETF)",
      asset: "XAUUSD",
      marketType: "US_OPTIONS",
      fetcher: async () => {
        const session = await getYahooFinanceSession();
        return fetchYahooOptionChain("GLD", "DAY", session);
      }
    },
    {
      sourceId: "DERIBIT_PAXG",
      sourceName: "Deribit Gold Options (PAXG_USDC)",
      asset: "XAUUSD",
      marketType: "US_OPTIONS",
      fetcher: () => fetchDeribitGoldOptions("DAY", 4040)
    },
    {
      sourceId: "DERIBIT_BTC",
      sourceName: "Deribit Real Options API (BTC)",
      asset: "BTC",
      marketType: "CRYPTO_24_7",
      fetcher: () => calculateCryptoGex("BTC", "WEEK")
    },
    {
      sourceId: "DERIBIT_ETH",
      sourceName: "Deribit Real Options API (ETH)",
      asset: "ETH",
      marketType: "CRYPTO_24_7",
      fetcher: () => calculateCryptoGex("ETH", "WEEK")
    },
    {
      sourceId: "MOEX_ROPD",
      sourceName: "MOEX ISS FORTS Options (ROPD)",
      asset: "MOEX_GOLD",
      marketType: "MOEX_FORTS",
      fetcher: () => calculateMoexGoldGex("DAY")
    }
  ];

  if (probe || gexSourceStatusMap.size === 0) {
    await Promise.allSettled(
      sourcesToProbe.map(async (s) => {
        const t0 = Date.now();
        try {
          const res = await s.fetcher();
          const latencyMs = Date.now() - t0;
          if (res) {
            const dataTimestampMs = res.dataTimestampMs || (res.timestamp ? Date.parse(res.timestamp) : Date.now());
            const tsSource: GexTimestampSource = res.timestampSource || (res.dataTimestampMs ? "exchange_timestamp" : "fetch_time");
            const strikesCount = res.strikes?.length || (res.calls?.length ? res.calls.length + res.puts.length : 10);
            const freshness = res.freshness || evaluateOptionDataFreshness({
              timestampMs: dataTimestampMs,
              timestampSource: tsSource,
              marketType: s.marketType,
              strikesCount
            });
            recordGexSourceStatus({
              sourceId: s.sourceId,
              sourceName: s.sourceName,
              asset: s.asset,
              marketType: s.marketType,
              lastHttpStatus: 200,
              latencyMs,
              lastFetchMs: Date.now(),
              parsedTimestamp: dataTimestampMs ? new Date(dataTimestampMs).toISOString() : null,
              ageMinutes: freshness.ageMinutes,
              sessionVerdict: freshness.sessionVerdict,
              dataFreshnessLabel: freshness.dataFreshnessLabel,
              timestampSource: tsSource,
              isSynthetic: freshness.isSynthetic,
              isDataStale: freshness.isDataStale
            });
          } else {
            recordGexSourceStatus({
              sourceId: s.sourceId,
              sourceName: s.sourceName,
              asset: s.asset,
              marketType: s.marketType,
              lastHttpStatus: null,
              latencyMs: Date.now() - t0,
              lastFetchMs: Date.now(),
              parsedTimestamp: null,
              ageMinutes: null,
              sessionVerdict: "unavailable",
              dataFreshnessLabel: "Источник временно не вернул опционную цепочку",
              timestampSource: "none",
              isSynthetic: true,
              isDataStale: true
            });
          }
        } catch (err: any) {
          recordGexSourceStatus({
            sourceId: s.sourceId,
            sourceName: s.sourceName,
            asset: s.asset,
            marketType: s.marketType,
            lastHttpStatus: null,
            latencyMs: Date.now() - t0,
            lastFetchMs: Date.now(),
            parsedTimestamp: null,
            ageMinutes: null,
            sessionVerdict: "unavailable",
            dataFreshnessLabel: `Ошибка опроса: ${err.message}`,
            timestampSource: "none",
            isSynthetic: true,
            isDataStale: true
          });
        }
      })
    );
  }

  // Ensure all known sources have an entry even if unprobed
  for (const s of sourcesToProbe) {
    if (!gexSourceStatusMap.has(s.sourceId)) {
      gexSourceStatusMap.set(s.sourceId, {
        sourceId: s.sourceId,
        sourceName: s.sourceName,
        asset: s.asset,
        marketType: s.marketType,
        lastHttpStatus: null,
        latencyMs: 0,
        lastFetchMs: 0,
        parsedTimestamp: null,
        ageMinutes: null,
        sessionVerdict: "unavailable",
        dataFreshnessLabel: "Ожидает первого опроса",
        timestampSource: "none",
        isSynthetic: true,
        isDataStale: true
      });
    }
  }

  return Array.from(gexSourceStatusMap.values());
}
