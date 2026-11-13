/**
 * propContextEngine.ts
 * Серверный движок институционального контекста (Prop Desk Context).
 * Чистые математические функции поверх реальных свечей:
 * 1. Профиль объёма (Volume Profile, POC, VAH, VAL)
 * 2. Уровни сессий (Asia, London, New York, PDH, PDL) с учётом текущего сезона
 * 3. Пулы ликвидности (EQH, EQL, PDH, PDL, ASIA_H, ASIA_L, флаг swept)
 * 4. Поток ордеров (Order Flow: дельты, CVD, дивергенции, поглощение/absorption)
 * 5. ADR (Average Daily Range 14, использованный диапазон, usedPct)
 * 6. Свинг-структура (HH/HL/LH/LL, BOS, тренд)
 */

import { getSessionSchedule, SessionSchedule } from "../src/lib/marketSessions";

export interface CandleLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumeProfileResult {
  poc: number;
  vah: number;
  val: number;
  pocVolumePct: number;
  totalVolume: number;
  bins: Array<{ price: number; volume: number }>;
}

export interface SessionStats {
  open: number;
  high: number;
  low: number;
  close: number;
  active: boolean;
}

export interface SessionLevelsResult {
  asia: SessionStats | null;
  london: SessionStats | null;
  ny: SessionStats | null;
  pdh: number | null;
  pdl: number | null;
  currentDayHigh: number | null;
  currentDayLow: number | null;
}

export interface LiquidityPool {
  id: string;
  type: "EQH" | "EQL" | "PDH" | "PDL" | "ASIA_H" | "ASIA_L";
  price: number;
  swept: boolean;
  formedTime: number;
  sweptTime?: number;
  label: string;
}

export interface AbsorptionEvent {
  side: "BUY" | "SELL";
  price: number;
  barsAgo: number;
  delta: number;
  volume: number;
}

export interface OrderFlowResult {
  cvd: number;
  recentDelta: number;
  deltaDivergence: "BULLISH" | "BEARISH" | "NONE";
  divergenceDetails?: string;
  absorption: AbsorptionEvent | null;
}

export interface AdrResult {
  available: boolean;
  adr14: number | null;
  todayRange: number;
  usedPct: number | null;
}

export interface StructureSwing {
  time: number;
  price: number;
  type: "HH" | "HL" | "LH" | "LL";
  isHigh: boolean;
}

export interface StructureResult {
  swings: StructureSwing[];
  trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  lastBos: string | null;
}

export interface PropDeskContext {
  available: boolean;
  reason?: string;
  timestamp: number;
  symbol?: string;
  timeframe?: string;
  schedule: SessionSchedule;
  volumeProfile: VolumeProfileResult | null;
  sessionLevels: SessionLevelsResult | null;
  liquidityPools: LiquidityPool[];
  orderFlow: OrderFlowResult | null;
  adr: AdrResult | null;
  structure: StructureResult | null;
  gex?: any;
}

/**
 * 1. Volume Profile (POC, VAH, VAL 70%)
 */
export function computeVolumeProfile(
  candles: CandleLike[],
  lookback: number = 200,
  binsCount: number = 48
): VolumeProfileResult | null {
  if (!candles || candles.length < 10) return null;

  const slice = candles.slice(-lookback);
  let minLow = Infinity;
  let maxHigh = -Infinity;
  let totalVolume = 0;

  for (const c of slice) {
    if (c.low < minLow) minLow = c.low;
    if (c.high > maxHigh) maxHigh = c.high;
    totalVolume += c.volume || 1;
  }

  if (!isFinite(minLow) || !isFinite(maxHigh) || maxHigh <= minLow || totalVolume <= 0) {
    return null;
  }

  const binStep = (maxHigh - minLow) / binsCount;
  const binVols = new Float64Array(binsCount);

  for (const c of slice) {
    const vol = c.volume || 1;
    // Распределяем объем свечи по бинам, которые она перекрывает
    const startIdx = Math.max(0, Math.min(binsCount - 1, Math.floor((c.low - minLow) / binStep)));
    const endIdx = Math.max(0, Math.min(binsCount - 1, Math.floor((c.high - minLow) / binStep)));
    const span = Math.max(1, endIdx - startIdx + 1);
    const volPerBin = vol / span;

    for (let i = startIdx; i <= endIdx; i++) {
      binVols[i] += volPerBin;
    }
  }

  // Находим POC (бино с максимальным объемом)
  let maxBinIdx = 0;
  let maxBinVol = -1;
  for (let i = 0; i < binsCount; i++) {
    if (binVols[i] > maxBinVol) {
      maxBinVol = binVols[i];
      maxBinIdx = i;
    }
  }

  const poc = Number((minLow + (maxBinIdx + 0.5) * binStep).toFixed(2));
  const pocVolumePct = Number(((maxBinVol / totalVolume) * 100).toFixed(1));

  // Value Area (70% от общего объема, расширение от POC)
  const targetVaVol = totalVolume * 0.7;
  let vaVol = binVols[maxBinIdx];
  let upIdx = maxBinIdx;
  let downIdx = maxBinIdx;

  while (vaVol < targetVaVol && (upIdx < binsCount - 1 || downIdx > 0)) {
    const nextUpVol = upIdx < binsCount - 1 ? binVols[upIdx + 1] : -1;
    const nextDownVol = downIdx > 0 ? binVols[downIdx - 1] : -1;

    if (nextUpVol >= nextDownVol && nextUpVol >= 0) {
      upIdx++;
      vaVol += nextUpVol;
    } else if (nextDownVol >= 0) {
      downIdx--;
      vaVol += nextDownVol;
    } else {
      break;
    }
  }

  const vah = Number((minLow + (upIdx + 1) * binStep).toFixed(2));
  const val = Number((minLow + downIdx * binStep).toFixed(2));

  const bins = [];
  for (let i = 0; i < binsCount; i++) {
    bins.push({
      price: Number((minLow + (i + 0.5) * binStep).toFixed(2)),
      volume: Number(binVols[i].toFixed(1))
    });
  }

  return {
    poc,
    vah,
    val,
    pocVolumePct,
    totalVolume: Math.round(totalVolume),
    bins
  };
}

/**
 * Вспомогательное получение времени в МСК (минуты от 00:00 и день YYYY-MM-DD)
 */
function getMskTimeInfo(timeMs: number): { dayKey: string; mskMins: number } {
  // MSK = UTC+3 круглый год
  const mskMs = timeMs + 3 * 3600 * 1000;
  const d = new Date(mskMs);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  const h = d.getUTCHours();
  const mins = d.getUTCMinutes();
  return {
    dayKey: `${y}-${m}-${day}`,
    mskMins: h * 60 + mins
  };
}

/**
 * 2. Session Levels (Asia 00:00-08:00, London, NY, PDH, PDL)
 */
export function computeSessionLevels(
  candles: CandleLike[],
  schedule: SessionSchedule
): SessionLevelsResult {
  if (!candles || candles.length === 0) {
    return {
      asia: null,
      london: null,
      ny: null,
      pdh: null,
      pdl: null,
      currentDayHigh: null,
      currentDayLow: null
    };
  }

  // Преобразуем строковые времена сессий в минуты МСК
  const parseMskMins = (hhMm: string) => {
    const [h, m] = hhMm.split(":").map(Number);
    return h * 60 + m;
  };

  const asiaStart = 0;
  const asiaEnd = 8 * 60; // 08:00 МСК
  const londonStart = parseMskMins(schedule.londonOpenMsk);
  const londonEnd = parseMskMins(schedule.londonCloseMsk);
  const nyStart = parseMskMins(schedule.usOpenMsk);
  const nyEnd = parseMskMins(schedule.usCloseMsk); // 00:00 = 1440 mins or 23:00 = 1380 mins

  // Группируем по дням МСК для вычисления PDH / PDL
  const daysMap = new Map<string, { high: number; low: number; candles: CandleLike[] }>();
  for (const c of candles) {
    const { dayKey } = getMskTimeInfo(c.time);
    let d = daysMap.get(dayKey);
    if (!d) {
      d = { high: -Infinity, low: Infinity, candles: [] };
      daysMap.set(dayKey, d);
    }
    if (c.high > d.high) d.high = c.high;
    if (c.low < d.low) d.low = c.low;
    d.candles.push(c);
  }

  const sortedDays = Array.from(daysMap.keys()).sort();
  const currentDayKey = sortedDays[sortedDays.length - 1];
  const currentDayData = daysMap.get(currentDayKey);
  const prevDayKey = sortedDays.length >= 2 ? sortedDays[sortedDays.length - 2] : null;
  const prevDayData = prevDayKey ? daysMap.get(prevDayKey) : null;

  const pdh = prevDayData ? Number(prevDayData.high.toFixed(2)) : null;
  const pdl = prevDayData ? Number(prevDayData.low.toFixed(2)) : null;
  const currentDayHigh = currentDayData ? Number(currentDayData.high.toFixed(2)) : null;
  const currentDayLow = currentDayData ? Number(currentDayData.low.toFixed(2)) : null;

  // Ищем бары сессий текущего или последнего дня
  const getSessionStatsForDay = (startMin: number, endMin: number): SessionStats | null => {
    // Берём последние 150 свечей
    const sub = candles.slice(-150);
    const sessionCandles: CandleLike[] = [];

    for (const c of sub) {
      const { mskMins } = getMskTimeInfo(c.time);
      let inSession = false;
      if (endMin > startMin) {
        inSession = mskMins >= startMin && mskMins < endMin;
      } else {
        // Пересекает полночь (например 17:30 - 00:00 или 17:30 - 01:00)
        inSession = mskMins >= startMin || mskMins < endMin;
      }
      if (inSession) {
        sessionCandles.push(c);
      }
    }

    if (sessionCandles.length === 0) return null;

    // Берём последнюю непрерывную группу свечей этой сессии
    let high = -Infinity;
    let low = Infinity;
    const open = sessionCandles[0].open;
    const close = sessionCandles[sessionCandles.length - 1].close;

    for (const sc of sessionCandles) {
      if (sc.high > high) high = sc.high;
      if (sc.low < low) low = sc.low;
    }

    const lastCandle = candles[candles.length - 1];
    const { mskMins: nowMins } = getMskTimeInfo(lastCandle.time);
    let active = false;
    if (endMin > startMin) {
      active = nowMins >= startMin && nowMins < endMin;
    } else {
      active = nowMins >= startMin || nowMins < endMin;
    }

    return {
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      active
    };
  };

  const asia = getSessionStatsForDay(asiaStart, asiaEnd);
  const london = getSessionStatsForDay(londonStart, londonEnd);
  const ny = getSessionStatsForDay(nyStart, nyEnd);

  return {
    asia,
    london,
    ny,
    pdh,
    pdl,
    currentDayHigh,
    currentDayLow
  };
}

/**
 * 3. Liquidity Pools (EQH, EQL, PDH, PDL, ASIA_H, ASIA_L, swept)
 */
export function detectLiquidityPools(
  candles: CandleLike[],
  tolPct: number = 0.0008,
  sessionLevels?: SessionLevelsResult | null
): LiquidityPool[] {
  if (!candles || candles.length < 20) return [];

  const pools: LiquidityPool[] = [];
  const n = candles.length;

  // Фракталы 5/5
  const swingHighs: Array<{ price: number; idx: number; time: number }> = [];
  const swingLows: Array<{ price: number; idx: number; time: number }> = [];

  for (let i = 5; i < n - 5; i++) {
    const cur = candles[i];
    let isSh = true;
    let isSl = true;

    for (let k = 1; k <= 5; k++) {
      if (candles[i - k].high >= cur.high || candles[i + k].high >= cur.high) isSh = false;
      if (candles[i - k].low <= cur.low || candles[i + k].low <= cur.low) isSl = false;
    }

    if (isSh) swingHighs.push({ price: cur.high, idx: i, time: cur.time });
    if (isSl) swingLows.push({ price: cur.low, idx: i, time: cur.time });
  }

  // Детекция EQH (Equal Highs)
  for (let i = 0; i < swingHighs.length; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const sh1 = swingHighs[i];
      const sh2 = swingHighs[j];
      const diff = Math.abs(sh1.price - sh2.price) / Math.max(sh1.price, sh2.price);
      if (diff <= tolPct) {
        const poolPrice = Number(((sh1.price + sh2.price) / 2).toFixed(2));
        // Проверяем, снят ли пул последующими свечами
        let swept = false;
        let sweptTime: number | undefined;
        for (let k = sh2.idx + 1; k < n; k++) {
          if (candles[k].high > poolPrice) {
            swept = true;
            sweptTime = candles[k].time;
            break;
          }
        }
        pools.push({
          id: `eqh-${sh1.time}-${sh2.time}`,
          type: "EQH",
          price: poolPrice,
          swept,
          formedTime: sh2.time,
          sweptTime,
          label: `⚡EQH ${poolPrice}`
        });
      }
    }
  }

  // Детекция EQL (Equal Lows)
  for (let i = 0; i < swingLows.length; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const sl1 = swingLows[i];
      const sl2 = swingLows[j];
      const diff = Math.abs(sl1.price - sl2.price) / Math.max(sl1.price, sl2.price);
      if (diff <= tolPct) {
        const poolPrice = Number(((sl1.price + sl2.price) / 2).toFixed(2));
        let swept = false;
        let sweptTime: number | undefined;
        for (let k = sl2.idx + 1; k < n; k++) {
          if (candles[k].low < poolPrice) {
            swept = true;
            sweptTime = candles[k].time;
            break;
          }
        }
        pools.push({
          id: `eql-${sl1.time}-${sl2.time}`,
          type: "EQL",
          price: poolPrice,
          swept,
          formedTime: sl2.time,
          sweptTime,
          label: `⚡EQL ${poolPrice}`
        });
      }
    }
  }

  // Добавляем сессионные пулы ликвидности
  if (sessionLevels) {
    const lastClose = candles[n - 1].close;

    if (sessionLevels.pdh !== null) {
      const p = sessionLevels.pdh;
      const swept = candles.slice(-40).some(c => c.high > p);
      pools.push({
        id: `pdh-${p}`,
        type: "PDH",
        price: p,
        swept,
        formedTime: candles[0].time,
        label: `⚡PDH ${p}`
      });
    }

    if (sessionLevels.pdl !== null) {
      const p = sessionLevels.pdl;
      const swept = candles.slice(-40).some(c => c.low < p);
      pools.push({
        id: `pdl-${p}`,
        type: "PDL",
        price: p,
        swept,
        formedTime: candles[0].time,
        label: `⚡PDL ${p}`
      });
    }

    if (sessionLevels.asia?.high) {
      const p = sessionLevels.asia.high;
      const swept = candles.slice(-40).some(c => c.high > p);
      pools.push({
        id: `asia-h-${p}`,
        type: "ASIA_H",
        price: p,
        swept,
        formedTime: candles[0].time,
        label: `⚡ASIA_H ${p}`
      });
    }

    if (sessionLevels.asia?.low) {
      const p = sessionLevels.asia.low;
      const swept = candles.slice(-40).some(c => c.low < p);
      pools.push({
        id: `asia-l-${p}`,
        type: "ASIA_L",
        price: p,
        swept,
        formedTime: candles[0].time,
        label: `⚡ASIA_L ${p}`
      });
    }
  }

  return pools;
}

/**
 * 4. Order Flow (дельты, CVD, дивергенция, поглощение)
 */
export function computeOrderFlow(candles: CandleLike[]): OrderFlowResult | null {
  if (!candles || candles.length < 20) return null;

  const n = candles.length;
  const barDeltas: number[] = [];
  let cvd = 0;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const range = Math.max(0.0001, c.high - c.low);
    // Синтетическая дельта свечи по соотношению верхнего и нижнего фитилей
    const delta = (c.volume || 1) * (((c.close - c.low) - (c.high - c.close)) / range);
    barDeltas.push(delta);
    cvd += delta;
  }

  // Расчёт дивергенции: последние 10 баров против предыдущих 10 баров
  const last10 = candles.slice(-10);
  const prev10 = candles.slice(-20, -10);
  const last10Deltas = barDeltas.slice(-10);
  const prev10Deltas = barDeltas.slice(-20, -10);

  const maxPriceLast10 = Math.max(...last10.map(c => c.high));
  const maxPricePrev10 = Math.max(...prev10.map(c => c.high));
  const minPriceLast10 = Math.min(...last10.map(c => c.low));
  const minPricePrev10 = Math.min(...prev10.map(c => c.low));

  const maxDeltaLast10 = Math.max(...last10Deltas);
  const maxDeltaPrev10 = Math.max(...prev10Deltas);
  const minDeltaLast10 = Math.min(...last10Deltas);
  const minDeltaPrev10 = Math.min(...prev10Deltas);

  let deltaDivergence: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  let divergenceDetails: string | undefined;

  // Медвежья дивергенция: цена сделала Higher High (HH), а дельта сделала Lower High (LH)
  if (maxPriceLast10 > maxPricePrev10 && maxDeltaLast10 < maxDeltaPrev10) {
    deltaDivergence = "BEARISH";
    divergenceDetails = `Медвежья дивергенция: цена обновила хай (${maxPriceLast10.toFixed(2)} > ${maxPricePrev10.toFixed(2)}), но пик дельты затухает (${Math.round(maxDeltaLast10)} < ${Math.round(maxDeltaPrev10)}). Признак ложного пробоя и истощения покупателей.`;
  }
  // Бычья дивергенция: цена сделала Lower Low (LL), а дельта сделала Higher Low (HL)
  else if (minPriceLast10 < minPricePrev10 && minDeltaLast10 > minDeltaPrev10) {
    deltaDivergence = "BULLISH";
    divergenceDetails = `Бычья дивергенция: цена обновила лоу (${minPriceLast10.toFixed(2)} < ${minPricePrev10.toFixed(2)}), но дельта показала растущее дно (${Math.round(minDeltaLast10)} > ${Math.round(minDeltaPrev10)}). Признак скрытого лимитного набора.`;
  }

  // Детекция поглощения (Absorption):
  // Бар с |delta| > 2 * SMA20(|delta|) и телом < 0.35 * range
  let absorption: AbsorptionEvent | null = null;
  const last20Deltas = barDeltas.slice(-20);
  const avgAbsDelta = last20Deltas.reduce((acc, d) => acc + Math.abs(d), 0) / Math.max(1, last20Deltas.length);

  for (let i = n - 1; i >= Math.max(0, n - 15); i--) {
    const c = candles[i];
    const delta = barDeltas[i];
    const range = c.high - c.low;
    const body = Math.abs(c.close - c.open);

    if (Math.abs(delta) > 2 * avgAbsDelta && range > 0 && body < 0.35 * range) {
      absorption = {
        side: delta > 0 ? "BUY" : "SELL",
        price: Number(c.close.toFixed(2)),
        barsAgo: n - 1 - i,
        delta: Math.round(delta),
        volume: Math.round(c.volume || 1)
      };
      break;
    }
  }

  return {
    cvd: Math.round(cvd),
    recentDelta: Math.round(barDeltas[n - 1] || 0),
    deltaDivergence,
    divergenceDetails,
    absorption
  };
}

/**
 * 5. ADR (Average Daily Range 14 дней, used today, usedPct)
 */
export function computeAdr(candles: CandleLike[]): AdrResult | null {
  if (!candles || candles.length < 20) return null;

  // Группируем по дням МСК
  const daysMap = new Map<string, { high: number; low: number }>();
  for (const c of candles) {
    const { dayKey } = getMskTimeInfo(c.time);
    let d = daysMap.get(dayKey);
    if (!d) {
      d = { high: -Infinity, low: Infinity };
      daysMap.set(dayKey, d);
    }
    if (c.high > d.high) d.high = c.high;
    if (c.low < d.low) d.low = c.low;
  }

  const sortedDays = Array.from(daysMap.keys()).sort();
  if (sortedDays.length === 0) return null;

  const currentDayKey = sortedDays[sortedDays.length - 1];
  const currentDay = daysMap.get(currentDayKey)!;
  const todayRange = Number((currentDay.high - currentDay.low).toFixed(2));

  // Предыдущие завершённые дни (без текущего незаконченного дня)
  const prevDays = sortedDays.slice(0, sortedDays.length - 1);

  // Требуется строго >= 10 полных дневных корзин МСК; иначе adr.available = false, usedPct = null
  if (prevDays.length < 10) {
    return {
      available: false,
      adr14: null,
      todayRange,
      usedPct: null
    };
  }

  // Расчёт среднего за последние 14 завершённых дней (без fallback на todayRange!)
  const adrDays = prevDays.slice(Math.max(0, prevDays.length - 14));
  let sumRanges = 0;
  for (const k of adrDays) {
    const d = daysMap.get(k)!;
    sumRanges += (d.high - d.low);
  }

  const adr14 = Number((sumRanges / adrDays.length).toFixed(2));
  const usedPct = adr14 > 0 ? Number(((todayRange / adr14) * 100).toFixed(1)) : null;

  return {
    available: true,
    adr14,
    todayRange,
    usedPct
  };
}

/**
 * 6. Свинг-структура (HH/HL/LH/LL, BOS, тренд)
 */
export function computeStructureSwings(candles: CandleLike[], len: number = 5): StructureResult | null {
  if (!candles || candles.length < len * 2 + 5) return null;

  const n = candles.length;
  const rawSwings: Array<{ time: number; price: number; isHigh: boolean }> = [];

  for (let i = len; i < n - len; i++) {
    const cur = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let k = 1; k <= len; k++) {
      if (candles[i - k].high >= cur.high || candles[i + k].high >= cur.high) isHigh = false;
      if (candles[i - k].low <= cur.low || candles[i + k].low <= cur.low) isLow = false;
    }

    if (isHigh) rawSwings.push({ time: cur.time, price: cur.high, isHigh: true });
    else if (isLow) rawSwings.push({ time: cur.time, price: cur.low, isHigh: false });
  }

  if (rawSwings.length < 2) return null;

  // Оставляем последние 6 свингов
  const last6 = rawSwings.slice(-6);
  const swings: StructureSwing[] = [];

  for (let i = 0; i < last6.length; i++) {
    const cur = last6[i];
    // Ищем предыдущий свинг того же типа
    let prevSame: { price: number } | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (last6[j].isHigh === cur.isHigh) {
        prevSame = last6[j];
        break;
      }
    }

    let type: "HH" | "HL" | "LH" | "LL";
    if (cur.isHigh) {
      type = !prevSame || cur.price >= prevSame.price ? "HH" : "LH";
    } else {
      type = !prevSame || cur.price >= prevSame.price ? "HL" : "LL";
    }

    swings.push({
      time: cur.time,
      price: Number(cur.price.toFixed(2)),
      type,
      isHigh: cur.isHigh
    });
  }

  // Оценка тренда по последним свингам
  const highs = swings.filter(s => s.isHigh);
  const lows = swings.filter(s => !s.isHigh);
  let trend: "BULLISH" | "BEARISH" | "SIDEWAYS" = "SIDEWAYS";

  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];

  if (lastHigh?.type === "HH" && lastLow?.type === "HL") {
    trend = "BULLISH";
  } else if (lastHigh?.type === "LH" && lastLow?.type === "LL") {
    trend = "BEARISH";
  }

  const lastBos = trend === "BULLISH"
    ? `BOS ВВЕРХ (выше ${lastHigh?.price || ""})`
    : trend === "BEARISH"
    ? `BOS ВНИЗ (ниже ${lastLow?.price || ""})`
    : null;

  return {
    swings,
    trend,
    lastBos
  };
}

/**
 * 7. Главный агрегатор: buildPropContext
 * Если candles.length < 50 -> все поля null и reason "Недостаточно данных".
 * Без фабрикаций и подмен.
 */
export function buildPropContext(
  candlesOrParams:
    | CandleLike[]
    | {
        candles: CandleLike[];
        symbol?: string;
        timeframe?: string;
        gexReport?: any;
        schedule?: SessionSchedule;
      },
  _tfSec?: number,
  date: Date = new Date(),
  symbol?: string,
  timeframe?: string
): PropDeskContext {
  let candles: CandleLike[];
  let gexReport: any = null;
  let scheduleOverride: SessionSchedule | null = null;

  if (candlesOrParams && !Array.isArray(candlesOrParams) && typeof candlesOrParams === "object" && "candles" in candlesOrParams) {
    const opts = candlesOrParams as {
      candles: CandleLike[];
      symbol?: string;
      timeframe?: string;
      gexReport?: any;
      schedule?: SessionSchedule;
    };
    candles = opts.candles;
    symbol = opts.symbol || symbol;
    timeframe = opts.timeframe || timeframe;
    gexReport = opts.gexReport || null;
    scheduleOverride = opts.schedule || null;
  } else {
    candles = candlesOrParams as CandleLike[];
  }

  const schedule = scheduleOverride || getSessionSchedule(date);

  if (!candles || candles.length < 50) {
    return {
      available: false,
      reason: "Недостаточно данных для prop-контекста (требуется >= 50 свечей)",
      timestamp: date.getTime(),
      symbol,
      timeframe,
      schedule,
      volumeProfile: null,
      sessionLevels: null,
      liquidityPools: [],
      orderFlow: null,
      adr: null,
      structure: null,
      gex: gexReport
    };
  }

  const volumeProfile = computeVolumeProfile(candles);
  const sessionLevels = computeSessionLevels(candles, schedule);
  const liquidityPools = detectLiquidityPools(candles, 0.0008, sessionLevels);
  const orderFlow = computeOrderFlow(candles);
  const adr = computeAdr(candles);
  const structure = computeStructureSwings(candles, 5);

  return {
    available: true,
    timestamp: date.getTime(),
    symbol,
    timeframe,
    schedule,
    volumeProfile,
    sessionLevels,
    liquidityPools,
    orderFlow,
    adr,
    structure,
    gex: gexReport
  };
}
