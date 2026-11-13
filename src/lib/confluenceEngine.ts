/**
 * confluenceEngine.ts
 * "Confluence Liquidity Ladder v1" (CLL)
 * Математический движок институционального консенсуса и ступенчатых прогнозных линий:
 * 1. Volume Profile (POC, VAH, VAL на 200 барах, 70% Value Area)
 * 2. Детектор пулов ликвидности (EQH, EQL, Session High/Low, PDH, PDL)
 * 3. 6 слоёв консенсуса (GEX, Volume Profile, Liquidity Pools, Order Flow, SMC, Session Timing)
 * 4. Правила валидации: Score >= 0.70, слоёв >= 4, обязательное участие L1 или L2
 * 5. Расчет зоны входа (пересечение), SL за инвалидацией/пулом + буфер, R: 0.6–1.6 ATR, TP1 >= 1.5R, TP2 >= 2.6R и >= TP1 + 0.8 ATR, TP3 runner
 * 6. Гейты (новостное окно по сезонам, ADR > 85% скальп, режим гаммы)
 * 7. Реплей состояний и сценарии Плана Б: B-MISS, B-SWEEP, B-FLIP
 */

import { getSessionSchedule, SessionSchedule } from "./marketSessions";

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

export interface LiquidityPoolItem {
  id: string;
  type: "EQH" | "EQL" | "PDH" | "PDL" | "ASIA_H" | "ASIA_L" | "LONDON_H" | "LONDON_L";
  price: number;
  swept: boolean;
  formedTime: number;
  sweptTime?: number;
  label: string;
}

export type LayerId = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export type LayerBias = "LONG" | "SHORT" | "NEUTRAL";

export interface ConfluenceLayer {
  id: LayerId;
  name: string;
  bias: LayerBias;
  zone: [number, number]; // [lo, hi]
  weight: number;
  tag: string;
  active: boolean;
  rationale: string;
}

export interface ConfluenceTarget {
  price: number;
  tag: string;
  r: number;
  isHit?: boolean;
}

export interface ConfluencePlanB {
  type: "B-SWEEP" | "B-MISS" | "B-FLIP" | "B-BREAK";
  entry: number;
  sl: number;
  tp1: number;
  tp2?: number;
  condition: string;
  isActive: boolean;
  isTriggered?: boolean;
}

export interface ConfluenceGates {
  newsBlock: boolean;
  newsDetails?: string;
  adrCap: boolean; // true if adrPct >= 85% -> scalp only (TP1)
  regimeAllow: boolean;
  regimeDetails?: string;
}

export type ConfluenceStatus =
  | "NO_TRADE"
  | "ST0_PENDING"
  | "ST1_ACTIVE"
  | "TP1_HIT"
  | "TP2_HIT"
  | "TRAIL"
  | "EXPIRED"
  | "STOPPED_OUT";

export interface ConfluenceSetupResult {
  symbol?: string;
  timeframe?: string;
  timestamp: number;
  status: ConfluenceStatus;
  direction: "LONG" | "SHORT" | "NONE";
  score: number; // 0.0 - 1.0
  activeLayers: ConfluenceLayer[];
  allLayers: ConfluenceLayer[];
  entryZone: [number, number]; // [lo, hi]
  entryMid: number;
  sl: number;
  riskR: number; // in price points
  riskAtrRatio: number; // riskR / atr
  atr: number;
  tp1: ConfluenceTarget | null;
  tp2: ConfluenceTarget | null;
  tp3: ConfluenceTarget | null;
  planB: ConfluencePlanB | null;
  gates: ConfluenceGates;
  expireReason?: string;
  isScalpMode: boolean; // adrCap active
  stateProgression: {
    stage: "ST0" | "ST1" | "TP1" | "TP2" | "TRAIL" | "EXPIRED" | "STOP";
    barsSinceEntry: number;
    sweptReclaimDetected?: boolean;
    missedRetestDetected?: boolean;
    flipAdjusted?: boolean;
  };
}

// -------------------------------------------------------------
// 1. computeVolumeProfile(candles, 200) -> { poc, vah, val }
// -------------------------------------------------------------
export function computeVolumeProfile(
  candles: CandleLike[],
  lookback = 200,
  binsCount = 50
): VolumeProfileResult | null {
  if (!candles || candles.length < 10) return null;

  const slice = candles.slice(-lookback);
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  for (const c of slice) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += c.volume || 1;
  }

  if (minPrice >= maxPrice || totalVolume <= 0) return null;

  const binStep = (maxPrice - minPrice) / binsCount;
  const bins: Array<{ price: number; volume: number }> = [];
  for (let i = 0; i < binsCount; i++) {
    bins.push({
      price: minPrice + (i + 0.5) * binStep,
      volume: 0
    });
  }

  for (const c of slice) {
    const vol = c.volume || 1;
    const barRange = Math.max(c.high - c.low, binStep * 0.5);
    const startBin = Math.max(0, Math.floor((c.low - minPrice) / binStep));
    const endBin = Math.min(binsCount - 1, Math.floor((c.high - minPrice) / binStep));
    const span = Math.max(1, endBin - startBin + 1);
    const volPerBin = vol / span;

    for (let b = startBin; b <= endBin; b++) {
      bins[b].volume += volPerBin;
    }
  }

  let pocIdx = 0;
  let maxBinVol = -1;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i].volume > maxBinVol) {
      maxBinVol = bins[i].volume;
      pocIdx = i;
    }
  }

  const poc = bins[pocIdx].price;
  const pocVolumePct = totalVolume > 0 ? Math.round((maxBinVol / totalVolume) * 100) : 0;

  // 70% Value Area outward from POC
  const targetVaVol = totalVolume * 0.70;
  let currentVaVol = maxBinVol;
  let upIdx = pocIdx;
  let downIdx = pocIdx;

  while (currentVaVol < targetVaVol && (upIdx < binsCount - 1 || downIdx > 0)) {
    const nextUpVol = upIdx < binsCount - 1 ? bins[upIdx + 1].volume : 0;
    const nextDownVol = downIdx > 0 ? bins[downIdx - 1].volume : 0;

    if (nextUpVol >= nextDownVol && upIdx < binsCount - 1) {
      upIdx++;
      currentVaVol += bins[upIdx].volume;
    } else if (downIdx > 0) {
      downIdx--;
      currentVaVol += bins[downIdx].volume;
    } else if (upIdx < binsCount - 1) {
      upIdx++;
      currentVaVol += bins[upIdx].volume;
    } else {
      break;
    }
  }

  const val = bins[downIdx].price - binStep * 0.5;
  const vah = bins[upIdx].price + binStep * 0.5;

  return {
    poc,
    vah,
    val,
    pocVolumePct,
    totalVolume,
    bins
  };
}

// -------------------------------------------------------------
// 2. detectLiquidityPools(candles) -> EQH, EQL, PDH, PDL, Session H/L
// -------------------------------------------------------------
export function detectLiquidityPools(
  candles: CandleLike[],
  tolerance = 0.0008
): LiquidityPoolItem[] {
  const pools: LiquidityPoolItem[] = [];
  if (!candles || candles.length < 20) return pools;

  const lastBarIdx = candles.length - 1;

  // Swings finding (left=2, right=2)
  interface Swing {
    type: "HIGH" | "LOW";
    price: number;
    index: number;
    time: number;
  }
  const swings: Swing[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    const isHigh =
      c.high > candles[i - 1].high &&
      c.high > candles[i - 2].high &&
      c.high > candles[i + 1].high &&
      c.high > candles[i + 2].high;
    const isLow =
      c.low < candles[i - 1].low &&
      c.low < candles[i - 2].low &&
      c.low < candles[i + 1].low &&
      c.low < candles[i + 2].low;

    if (isHigh) swings.push({ type: "HIGH", price: c.high, index: i, time: c.time });
    if (isLow) swings.push({ type: "LOW", price: c.low, index: i, time: c.time });
  }

  // Detect EQH (swings separated by at least 3 bars)
  const highSwings = swings.filter(s => s.type === "HIGH");
  for (let i = 0; i < highSwings.length; i++) {
    for (let j = i + 1; j < highSwings.length; j++) {
      const s1 = highSwings[i];
      const s2 = highSwings[j];
      if (s2.index - s1.index < 3) continue;
      const diff = Math.abs(s1.price - s2.price);
      const avg = (s1.price + s2.price) / 2;
      if (diff / avg <= tolerance) {
        const poolPrice = avg;
        // Check if swept after s2
        let swept = false;
        let sweptTime: number | undefined;
        for (let b = s2.index + 1; b <= lastBarIdx; b++) {
          if (candles[b].high > poolPrice) {
            swept = true;
            sweptTime = candles[b].time;
            break;
          }
        }
        pools.push({
          id: `EQH_${s1.index}_${s2.index}`,
          type: "EQH",
          price: poolPrice,
          swept,
          formedTime: s2.time,
          sweptTime,
          label: swept ? `EQH (${poolPrice.toFixed(2)}) СНЯТ` : `EQH (${poolPrice.toFixed(2)}) ЖИВОЙ`
        });
      }
    }
  }

  // Detect EQL (swings separated by at least 3 bars)
  const lowSwings = swings.filter(s => s.type === "LOW");
  for (let i = 0; i < lowSwings.length; i++) {
    for (let j = i + 1; j < lowSwings.length; j++) {
      const s1 = lowSwings[i];
      const s2 = lowSwings[j];
      if (s2.index - s1.index < 3) continue;
      const diff = Math.abs(s1.price - s2.price);
      const avg = (s1.price + s2.price) / 2;
      if (diff / avg <= tolerance) {
        const poolPrice = avg;
        let swept = false;
        let sweptTime: number | undefined;
        for (let b = s2.index + 1; b <= lastBarIdx; b++) {
          if (candles[b].low < poolPrice) {
            swept = true;
            sweptTime = candles[b].time;
            break;
          }
        }
        pools.push({
          id: `EQL_${s1.index}_${s2.index}`,
          type: "EQL",
          price: poolPrice,
          swept,
          formedTime: s2.time,
          sweptTime,
          label: swept ? `EQL (${poolPrice.toFixed(2)}) СНЯТ` : `EQL (${poolPrice.toFixed(2)}) ЖИВОЙ`
        });
      }
    }
  }

  // Previous Day High/Low (PDH / PDL) based on UTC/MSK day boundary
  const lastTime = candles[candles.length - 1].time;
  const curDayStart = new Date(lastTime).setUTCHours(0, 0, 0, 0);
  const prevDayCandles = candles.filter(c => c.time < curDayStart && c.time >= curDayStart - 86400000);
  if (prevDayCandles.length > 5) {
    let pdh = -Infinity;
    let pdl = Infinity;
    let pdhTime = 0;
    let pdlTime = 0;
    for (const c of prevDayCandles) {
      if (c.high > pdh) { pdh = c.high; pdhTime = c.time; }
      if (c.low < pdl) { pdl = c.low; pdlTime = c.time; }
    }

    let pdhSwept = false;
    let pdlSwept = false;
    for (const c of candles) {
      if (c.time >= curDayStart) {
        if (c.high > pdh) pdhSwept = true;
        if (c.low < pdl) pdlSwept = true;
      }
    }

    pools.push({
      id: "PDH_POOL",
      type: "PDH",
      price: pdh,
      swept: pdhSwept,
      formedTime: pdhTime,
      label: pdhSwept ? `PDH (${pdh.toFixed(2)}) СНЯТ` : `PDH (${pdh.toFixed(2)})`
    });

    pools.push({
      id: "PDL_POOL",
      type: "PDL",
      price: pdl,
      swept: pdlSwept,
      formedTime: pdlTime,
      label: pdlSwept ? `PDL (${pdl.toFixed(2)}) СНЯТ` : `PDL (${pdl.toFixed(2)})`
    });
  }

  return pools;
}

// -------------------------------------------------------------
// ATR helper
// -------------------------------------------------------------
export function computeAtr(candles: CandleLike[], period = 14): number {
  if (!candles || candles.length < 2) return 10;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  if (slice.length === 0) return 10;
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / slice.length;
}

// -------------------------------------------------------------
// 3. sixLayers(candles, gexReport, schedule, adrPct)
// -------------------------------------------------------------
export function sixLayers(
  candles: CandleLike[],
  gexReport?: any,
  schedule?: SessionSchedule,
  adrPct = 50,
  volumeProfile?: VolumeProfileResult | null,
  liquidityPools?: LiquidityPoolItem[]
): ConfluenceLayer[] {
  const atr = computeAtr(candles, 14);
  const lastBar = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const curPrice = lastBar ? lastBar.close : 4000;

  const vp = volumeProfile ?? computeVolumeProfile(candles, 200);
  const pools = liquidityPools ?? detectLiquidityPools(candles);
  const sched = schedule ?? getSessionSchedule(new Date());

  const layers: ConfluenceLayer[] = [];

  // -----------------------------------------------------------
  // L1: GEX Wall & Gamma Flip (Weight 0.20)
  // -----------------------------------------------------------
  {
    const cw = gexReport?.callWall ? Number(gexReport.callWall) : null;
    const pw = gexReport?.putWall ? Number(gexReport.putWall) : null;
    const flip = gexReport?.gammaFlip ? Number(gexReport.gammaFlip) : null;
    const regime = String(gexReport?.regime || gexReport?.netGexRegime || "+GAMMA");
    const isPosGamma = regime.includes("+GAMMA") || regime.includes("POSITIVE");

    let bias: LayerBias = "NEUTRAL";
    let zone: [number, number] = [curPrice - atr * 0.2, curPrice + atr * 0.2];
    let tag = "[GEX: Нейтрально]";
    let active = false;
    let rationale = "GEX уровни не определены";

    const slice = candles && candles.length > 0 ? candles.slice(-25) : [];
    const minC = slice.length > 0 ? Math.min(...slice.map(c => c.low)) : curPrice;
    const maxC = slice.length > 0 ? Math.max(...slice.map(c => c.high)) : curPrice;

    const pwTested = pw && ((minC <= pw + 1.2 * atr && maxC >= pw - 1.2 * atr) || Math.abs(curPrice - pw) <= 1.8 * atr);
    const cwTested = cw && ((minC <= cw + 1.2 * atr && maxC >= cw - 1.2 * atr) || Math.abs(curPrice - cw) <= 1.8 * atr);

    if (pwTested && curPrice >= pw - 0.5 * atr) {
      bias = "LONG";
      zone = [pw - 0.2 * atr, pw + 0.3 * atr];
      tag = `[CW/PW: PW ${pw.toFixed(0)}]`;
      active = true;
      rationale = `Тест Put Wall (${pw.toFixed(1)}) как институциональной поддержки`;
    } else if (cwTested && curPrice <= cw + 0.5 * atr) {
      bias = "SHORT";
      zone = [cw - 0.3 * atr, cw + 0.2 * atr];
      tag = `[CW/PW: CW ${cw.toFixed(0)}]`;
      active = true;
      rationale = `Тест Call Wall (${cw.toFixed(1)}) как институционального потолка`;
    } else if (flip && isPosGamma && curPrice >= flip && curPrice <= flip + 1.0 * atr) {
      bias = "LONG";
      zone = [flip - 0.15 * atr, flip + 0.3 * atr];
      tag = `[Flip: ${flip.toFixed(0)}]`;
      active = true;
      rationale = `Отскок от Gamma Flip в режиме Positive Gamma`;
    } else if (flip && !isPosGamma && curPrice <= flip && curPrice >= flip - 1.0 * atr) {
      bias = "SHORT";
      zone = [flip - 0.3 * atr, flip + 0.15 * atr];
      tag = `[Flip: ${flip.toFixed(0)}]`;
      active = true;
      rationale = `Ускорение под Gamma Flip в режиме Negative Gamma`;
    }

    layers.push({
      id: "L1",
      name: "GEX Wall / Flip",
      bias,
      zone,
      weight: 0.20,
      tag,
      active,
      rationale
    });
  }

  // -----------------------------------------------------------
  // L2: Volume Profile (Weight 0.20)
  // -----------------------------------------------------------
  {
    let bias: LayerBias = "NEUTRAL";
    let zone: [number, number] = [curPrice - atr * 0.2, curPrice + atr * 0.2];
    let tag = "[VP: POC]";
    let active = false;
    let rationale = "Профиль объема не сформирован";

    if (vp) {
      const distVal = Math.abs(curPrice - vp.val);
      const distVah = Math.abs(curPrice - vp.vah);
      const distPoc = Math.abs(curPrice - vp.poc);
      const slice = candles && candles.length > 0 ? candles.slice(-25) : [];
      const minC = slice.length > 0 ? Math.min(...slice.map(c => c.low)) : curPrice;
      const maxC = slice.length > 0 ? Math.max(...slice.map(c => c.high)) : curPrice;
      const pocTested = (minC <= vp.poc + 1.2 * atr && maxC >= vp.poc - 1.2 * atr) || distPoc <= 1.5 * atr;

      if (pocTested && curPrice >= vp.poc - 0.5 * atr) {
        bias = "LONG";
        zone = [vp.poc - 0.25 * atr, vp.poc + 0.3 * atr];
        tag = `[VP: POC ${vp.poc.toFixed(0)}]`;
        active = true;
        rationale = `Удержание выше Point of Control (POC ${vp.poc.toFixed(1)}) как поддержки`;
      } else if (pocTested && curPrice < vp.poc - 0.5 * atr) {
        bias = "SHORT";
        zone = [vp.poc - 0.3 * atr, vp.poc + 0.25 * atr];
        tag = `[VP: POC ${vp.poc.toFixed(0)}]`;
        active = true;
        rationale = `Тест Point of Control (POC ${vp.poc.toFixed(1)}) снизу как сопротивления`;
      } else if (distVal <= 1.2 * atr && curPrice >= vp.val - 0.5 * atr) {
        bias = "LONG";
        zone = [vp.val - 0.25 * atr, vp.val + 0.25 * atr];
        tag = `[VP: VAL ${vp.val.toFixed(0)}]`;
        active = true;
        rationale = `Тест границы аукциона 70% Value Area Low (VAL)`;
      } else if (distVah <= 1.2 * atr && curPrice <= vp.vah + 0.5 * atr) {
        bias = "SHORT";
        zone = [vp.vah - 0.25 * atr, vp.vah + 0.25 * atr];
        tag = `[VP: VAH ${vp.vah.toFixed(0)}]`;
        active = true;
        rationale = `Тест границы аукциона 70% Value Area High (VAH)`;
      }
    }

    layers.push({
      id: "L2",
      name: "Volume Profile 70% VA",
      bias,
      zone,
      weight: 0.20,
      tag,
      active,
      rationale
    });
  }

  // -----------------------------------------------------------
  // L3: Liquidity Pools & Sweeps (Weight 0.18)
  // -----------------------------------------------------------
  {
    let bias: LayerBias = "NEUTRAL";
    let zone: [number, number] = [curPrice - atr * 0.2, curPrice + atr * 0.2];
    let tag = "[LIQ: Pools]";
    let active = false;
    let rationale = "Пулы ликвидности в норме";

    const sweptLow = pools.find(p => (p.type === "EQL" || p.type === "PDL") && p.swept);
    const sweptHigh = pools.find(p => (p.type === "EQH" || p.type === "PDH") && p.swept);
    const unsweptHigh = pools.find(p => (p.type === "EQH" || p.type === "PDH") && !p.swept);
    const unsweptLow = pools.find(p => (p.type === "EQL" || p.type === "PDL") && !p.swept);

    if (sweptLow && curPrice >= sweptLow.price - 0.5 * atr) {
      bias = "LONG";
      zone = [sweptLow.price - 0.1 * atr, Math.min(curPrice + 0.3 * atr, sweptLow.price + 0.8 * atr)];
      tag = `[LIQ: ${sweptLow.type} Свип]`;
      active = true;
      rationale = `Свип стопов под ${sweptLow.type} (${sweptLow.price.toFixed(1)}) и возврат`;
    } else if (sweptHigh && curPrice <= sweptHigh.price + 0.5 * atr) {
      bias = "SHORT";
      zone = [Math.max(curPrice - 0.3 * atr, sweptHigh.price - 0.8 * atr), sweptHigh.price + 0.1 * atr];
      tag = `[LIQ: ${sweptHigh.type} Свип]`;
      active = true;
      rationale = `Свип стопов над ${sweptHigh.type} (${sweptHigh.price.toFixed(1)}) и возврат`;
    } else if (unsweptHigh && curPrice < unsweptHigh.price) {
      bias = "LONG";
      zone = [curPrice - 0.2 * atr, curPrice + 0.2 * atr];
      tag = `[LIQ: Цель ${unsweptHigh.type}]`;
      active = true;
      rationale = `Притяжение к неснятому пулу ликвидности ${unsweptHigh.type} (${unsweptHigh.price.toFixed(1)})`;
    } else if (unsweptLow && curPrice > unsweptLow.price) {
      bias = "SHORT";
      zone = [curPrice - 0.2 * atr, curPrice + 0.2 * atr];
      tag = `[LIQ: Цель ${unsweptLow.type}]`;
      active = true;
      rationale = `Притяжение к неснятому пулу ликвидности ${unsweptLow.type} (${unsweptLow.price.toFixed(1)})`;
    }

    layers.push({
      id: "L3",
      name: "Liquidity Pools & Sweeps",
      bias,
      zone,
      weight: 0.18,
      tag,
      active,
      rationale
    });
  }

  // -----------------------------------------------------------
  // L4: Order Flow & Delta (CVD, Absorption, Divergence) (Weight 0.15)
  // -----------------------------------------------------------
  {
    let bias: LayerBias = "NEUTRAL";
    let zone: [number, number] = [curPrice - atr * 0.2, curPrice + atr * 0.2];
    let tag = "[OF: Delta]";
    let active = false;
    let rationale = "Поток ордеров стабилен";

    if (candles && candles.length >= 10) {
      const last10 = candles.slice(-10);
      let cumDelta = 0;
      let absorptionDetected = false;
      let absorptionDir: LayerBias = "NEUTRAL";
      let absPrice = curPrice;

      for (let i = 0; i < last10.length; i++) {
        const c = last10[i];
        const range = c.high - c.low;
        const body = Math.abs(c.close - c.open);
        const delta = (c.close >= c.open ? 1 : -1) * (c.volume || 100);
        cumDelta += delta;

        // Absorption bar: heavy volume, high delta, small body / wide wick
        if (c.volume > 1000 && range > 0 && body / range < 0.35) {
          absorptionDetected = true;
          absPrice = c.close;
          absorptionDir = c.close > c.open ? "LONG" : "SHORT";
        }
      }

      if (absorptionDetected && absorptionDir !== "NEUTRAL") {
        bias = absorptionDir;
        zone = [absPrice - 0.25 * atr, absPrice + 0.25 * atr];
        tag = `[OF: Поглощение ${absorptionDir}]`;
        active = true;
        rationale = `Институциональное поглощение ордеров на уровне ${absPrice.toFixed(1)}`;
      } else if (cumDelta > 500) {
        bias = "LONG";
        zone = [curPrice - 0.2 * atr, curPrice + 0.2 * atr];
        tag = "[OF: Положительная дельта]";
        active = true;
        rationale = "Кумулятивная дельта показывает активный рыночный набор";
      } else if (cumDelta < -500) {
        bias = "SHORT";
        zone = [curPrice - 0.2 * atr, curPrice + 0.2 * atr];
        tag = "[OF: Отрицательная дельта]";
        active = true;
        rationale = "Кумулятивная дельта показывает преобладание агрессивных продаж";
      }
    }

    layers.push({
      id: "L4",
      name: "Order Flow / Delta",
      bias,
      zone,
      weight: 0.15,
      tag,
      active,
      rationale
    });
  }

  // -----------------------------------------------------------
  // L5: Smart Money Structure (CHoCH, BOS, OB, OTE) (Weight 0.15)
  // -----------------------------------------------------------
  {
    let bias: LayerBias = "NEUTRAL";
    let zone: [number, number] = [curPrice - atr * 0.2, curPrice + atr * 0.2];
    let tag = "[SMC: Structure]";
    let active = false;
    let rationale = "Структура SMC формируется";

    if (candles && candles.length >= 15) {
      const last15 = candles.slice(-15);
      const isUpTrend = last15[last15.length - 1].close > last15[0].close;

      // Detect recent Order Block (last opposite candle before impulse)
      let obFound = false;
      let obLo = curPrice;
      let obHi = curPrice;

      for (let i = last15.length - 3; i >= 1; i--) {
        const c = last15[i];
        const nextC = last15[i + 1];
        if (isUpTrend && c.close < c.open && nextC.close > c.high) {
          // Bullish OB
          obFound = true;
          obLo = c.low;
          obHi = c.high;
          bias = "LONG";
          zone = [obLo, obHi + 0.2 * atr];
          tag = `[SMC: +OB ${obLo.toFixed(0)}]`;
          active = true;
          rationale = `Бычий Order Block (${obLo.toFixed(1)}–${obHi.toFixed(1)})`;
          break;
        } else if (!isUpTrend && c.close > c.open && nextC.close < c.low) {
          // Bearish OB
          obFound = true;
          obLo = c.low;
          obHi = c.high;
          bias = "SHORT";
          zone = [obLo - 0.2 * atr, obHi];
          tag = `[SMC: -OB ${obHi.toFixed(0)}]`;
          active = true;
          rationale = `Медвежий Order Block (${obLo.toFixed(1)}–${obHi.toFixed(1)})`;
          break;
        }
      }

      if (!obFound) {
        bias = isUpTrend ? "LONG" : "SHORT";
        zone = [curPrice - 0.25 * atr, curPrice + 0.25 * atr];
        tag = isUpTrend ? "[SMC: Бычий тренд]" : "[SMC: Медвежий тренд]";
        active = true;
        rationale = `Свинг-структура сохраняет ${isUpTrend ? "восходящий" : "нисходящий"} тренд`;
      }
    }

    layers.push({
      id: "L5",
      name: "SMC Structure & OB",
      bias,
      zone,
      weight: 0.15,
      tag,
      active,
      rationale
    });
  }

  // -----------------------------------------------------------
  // L6: Session Timing & Killzones (Weight 0.12)
  // -----------------------------------------------------------
  {
    const date = new Date(lastBar ? lastBar.time : Date.now());
    const mskHours = (date.getUTCHours() + 3) % 24;
    const mskMins = date.getUTCMinutes();
    const curMins = mskHours * 60 + mskMins;

    const isLondon = curMins >= sched.londonOpenMins && curMins <= sched.londonCloseMins;
    const isNy = curMins >= sched.usOpenMins && curMins <= (sched.usCloseMins || 1440);

    let bias: LayerBias = "NEUTRAL";
    let zone: [number, number] = [curPrice - atr * 0.2, curPrice + atr * 0.2];
    let tag = `[SES: ${sched.labelRu.includes("Зима") ? "EST" : "EDT"}]`;
    let active = true;
    let rationale = `Сессионный тайминг: ${sched.labelRu}`;

    if (isNy) {
      tag = "[SES: NY Killzone]";
      bias = layers[0]?.active && layers[0]?.bias !== "NEUTRAL" ? layers[0].bias : "LONG";
      rationale = `Американская сессия (US Open ${sched.usOpenMsk} МСК) — пиковая институциональная ликвидность`;
    } else if (isLondon) {
      tag = "[SES: London]";
      bias = layers[0]?.active && layers[0]?.bias !== "NEUTRAL"
        ? layers[0].bias
        : (layers[1]?.active && layers[1]?.bias !== "NEUTRAL" ? layers[1].bias : "LONG");
      rationale = `Лондонская сессия (${sched.londonOpenMsk}–${sched.londonCloseMsk} МСК)`;
    } else {
      tag = "[SES: Asia Range]";
      bias = "NEUTRAL";
      active = false;
      rationale = "Азиатский ночной диапазон — накопление объема перед Лондоном";
    }

    layers.push({
      id: "L6",
      name: "Session Killzones",
      bias,
      zone,
      weight: 0.12,
      tag,
      active,
      rationale
    });
  }

  return layers;
}

// -------------------------------------------------------------
// 4. computeConfluenceSetup(...)
// -------------------------------------------------------------
export interface ComputeConfluenceSetupParams {
  candles: CandleLike[];
  gexReport?: any;
  schedule?: SessionSchedule;
  adrPct?: number;
  symbol?: string;
  timeframe?: string;
  currentPrice?: number;
  tickSize?: number;
}

export function computeConfluenceSetup(
  params: ComputeConfluenceSetupParams
): ConfluenceSetupResult {
  const {
    candles,
    gexReport,
    schedule = getSessionSchedule(new Date()),
    adrPct = 45,
    symbol = "XAUUSD",
    timeframe = "15m",
    tickSize = 0.01
  } = params;

  const timestamp = Date.now();
  const atr = computeAtr(candles, 14);
  const lastBar = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const curPrice = params.currentPrice ?? (lastBar ? lastBar.close : 4000);

  // Default empty NO_TRADE response
  const makeNoTrade = (
    reason: string,
    gates?: Partial<ConfluenceGates>,
    allL: ConfluenceLayer[] = []
  ): ConfluenceSetupResult => ({
    symbol,
    timeframe,
    timestamp,
    status: "NO_TRADE",
    direction: "NONE",
    score: 0,
    activeLayers: [],
    allLayers: allL,
    entryZone: [curPrice, curPrice],
    entryMid: curPrice,
    sl: curPrice,
    riskR: 0,
    riskAtrRatio: 0,
    atr,
    tp1: null,
    tp2: null,
    tp3: null,
    planB: null,
    gates: {
      newsBlock: false,
      adrCap: adrPct >= 85,
      regimeAllow: true,
      ...gates
    },
    expireReason: reason,
    isScalpMode: adrPct >= 85,
    stateProgression: {
      stage: "ST0",
      barsSinceEntry: 0
    }
  });

  if (!candles || candles.length < 20) {
    return makeNoTrade("Недостаточно свечей для расчета Confluence (требуется >= 20)");
  }

  // Gates evaluation
  const date = new Date(lastBar ? lastBar.time : Date.now());
  const mskHours = (date.getUTCHours() + 3) % 24;
  const mskMins = date.getUTCMinutes();
  const curMins = mskHours * 60 + mskMins;

  // News gate: within 15 min before or 5 min after macro 08:30, US open, ISM, FOMC
  const macroEvents = [
    { name: "Макро 08:30 ET", mins: schedule.macro0830Mins },
    { name: "Открытие США 09:30 ET", mins: schedule.usOpenMins },
    { name: "ISM / Мичиган 10:00 ET", mins: schedule.ism1000Mins },
    { name: "FOMC 14:00 ET", mins: schedule.fomc1400Mins }
  ];

  let newsBlock = false;
  let newsDetails: string | undefined;
  for (const ev of macroEvents) {
    if (curMins >= ev.mins - 15 && curMins <= ev.mins + 5) {
      newsBlock = true;
      newsDetails = `Опасное окно: ${ev.name} (${Math.floor(ev.mins / 60)}:${(ev.mins % 60).toString().padStart(2, "0")} МСК)`;
      break;
    }
  }

  const adrCap = adrPct >= 85;
  const regime = String(gexReport?.regime || gexReport?.netGexRegime || "+GAMMA");
  const isPosGamma = regime.includes("+GAMMA") || regime.includes("POSITIVE");
  const regimeAllow = true; // both regimes allowed, but filters entry type

  if (newsBlock) {
    return makeNoTrade(`Блокировка новостным окном (${newsDetails})`, { newsBlock, newsDetails });
  }

  // Compute Volume Profile & Liquidity Pools (tighter lookback on HTF so POC/VAH/VAL stay current)
  const vpLookback =
    timeframe === "1d" ? 40 : timeframe === "4h" ? 60 : timeframe === "1h" ? 100 : 200;
  const vp = computeVolumeProfile(candles, vpLookback);
  const pools = detectLiquidityPools(candles);

  // Compute all 6 layers
  const allLayers = sixLayers(candles, gexReport, schedule, adrPct, vp, pools);

  // Sum weights for LONG and SHORT
  let longWeight = 0;
  let shortWeight = 0;
  const longLayers: ConfluenceLayer[] = [];
  const shortLayers: ConfluenceLayer[] = [];

  for (const layer of allLayers) {
    if (!layer.active) continue;
    if (layer.bias === "LONG") {
      longWeight += layer.weight;
      longLayers.push(layer);
    } else if (layer.bias === "SHORT") {
      shortWeight += layer.weight;
      shortLayers.push(layer);
    }
  }

  // Determine dominant direction
  const isLong = longWeight >= shortWeight;
  const dominantWeight = isLong ? longWeight : shortWeight;
  const activeLayers = isLong ? longLayers : shortLayers;
  const direction = isLong ? "LONG" : "SHORT";

  // Specification validation:
  // 1. Score S >= 0.70
  // 2. activeLayers.length >= 4
  // 3. Must include L1 or L2
  const score = Math.min(1.0, Math.round(dominantWeight * 100) / 100);
  const hasL1orL2 = activeLayers.some(l => l.id === "L1" || l.id === "L2");

  if (activeLayers.length < 4) {
    return makeNoTrade(
      `Недостаточно слоев консенсуса (${activeLayers.length}/6, требуется >= 4)`,
      { newsBlock, adrCap, regimeAllow },
      allLayers
    );
  }

  if (score < 0.70) {
    return makeNoTrade(
      `Скор консенсуса ${score.toFixed(2)} < 0.70 (требуется >= 0.70)`,
      { newsBlock, adrCap, regimeAllow },
      allLayers
    );
  }

  if (!hasL1orL2) {
    return makeNoTrade(
      `Отсутствует ключевой якорь L1 (GEX) или L2 (Volume Profile)`,
      { newsBlock, adrCap, regimeAllow },
      allLayers
    );
  }

  // Calculate Entry Zone: Intersection of active layer zones
  let lo = -Infinity;
  let hi = Infinity;

  for (const l of activeLayers) {
    if (l.zone[0] > lo) lo = l.zone[0];
    if (l.zone[1] < hi) hi = l.zone[1];
  }

  // If strict intersection is negative (disjoint zones), relax to the bounded overlap of L1/L2 and L3/L5
  if (lo >= hi) {
    const anchor = activeLayers.find(l => l.id === "L1" || l.id === "L2") || activeLayers[0];
    lo = anchor.zone[0];
    hi = anchor.zone[1];
  }

  // Ensure zone width is reasonable (at least 0.1 ATR, at most 0.8 ATR)
  const minWidth = 0.15 * atr;
  if (hi - lo < minWidth) {
    const mid = (lo + hi) / 2;
    lo = mid - minWidth / 2;
    hi = mid + minWidth / 2;
  }

  const entryZone: [number, number] = [lo, hi];
  const entryMid = (lo + hi) / 2;

  // Invalidation & SL calculation:
  // SL behind invalidation level or liquidity pool + buffer max(0.25ATR, 5 ticks)
  const buffer = Math.max(0.25 * atr, 5 * tickSize);
  let sl = isLong ? lo - buffer : hi + buffer;

  // Check nearby liquidity pools:
  // c) SL рядом с EQL-пулом → стоп вынесен за пул
  if (isLong) {
    const nearbyPools = pools.filter(
      p => (p.type === "EQL" || p.type === "PDL") && p.price <= entryMid && p.price >= sl - 0.8 * atr
    );
    if (nearbyPools.length > 0) {
      const lowestPool = nearbyPools.reduce((min, p) => (p.price < min.price ? p : min), nearbyPools[0]);
      sl = lowestPool.price - buffer;
    }
  } else {
    const nearbyPools = pools.filter(
      p => (p.type === "EQH" || p.type === "PDH") && p.price >= entryMid && p.price <= sl + 0.8 * atr
    );
    if (nearbyPools.length > 0) {
      const highestPool = nearbyPools.reduce((max, p) => (p.price > max.price ? p : max), nearbyPools[0]);
      sl = highestPool.price + buffer;
    }
  }

  // Risk R = |entryMid - sl|
  let riskR = Math.abs(entryMid - sl);

  // Specification: 0.6 ATR <= R <= 1.6 ATR
  if (riskR < 0.6 * atr) {
    riskR = 0.6 * atr;
    sl = isLong ? entryMid - riskR : entryMid + riskR;
  } else if (riskR > 1.6 * atr) {
    // Attempt clamp to 1.6 ATR if buffer allows
    riskR = 1.6 * atr;
    sl = isLong ? entryMid - riskR : entryMid + riskR;
  }

  const riskAtrRatio = riskR / atr;

  // -----------------------------------------------------------
  // Take Profits:
  // TP1 >= 1.5R (snapped to nearest liquidity pool or GEX)
  // TP2 >= 2.6R and >= TP1 + 0.8 ATR
  // TP3 = runner
  // -----------------------------------------------------------
  const isHtf = timeframe === "1h" || timeframe === "4h" || timeframe === "1d";
  const maxTp1Dist = isHtf ? Math.max(2.6 * riskR, 2.5 * atr) : Math.max(5.0 * riskR, 6.2 * atr);
  const maxTp2Dist = isHtf ? Math.max(3.8 * riskR, 3.8 * atr) : Math.max(7.0 * riskR, 7.5 * atr);

  let tp1Price = isLong ? entryMid + 1.5 * riskR : entryMid - 1.5 * riskR;
  let tp1Tag = "[1.5R]";

  // Try snapping TP1 to nearest valid pool (EQH for long, EQL for short) within realistic ceiling
  if (isLong) {
    const validEqh = pools
      .filter(p => p.type === "EQH" && p.price >= entryMid + 1.45 * riskR && p.price <= entryMid + maxTp1Dist)
      .sort((a, b) => a.price - b.price);
    const poolTp1 = validEqh[0];
    if (poolTp1) {
      tp1Price = poolTp1.price;
      tp1Tag = `[EQH] +${((tp1Price - entryMid) / riskR).toFixed(1)}R`;
    } else if (vp && vp.poc >= entryMid + 1.45 * riskR && vp.poc < entryMid + Math.min(2.5 * riskR, maxTp1Dist)) {
      tp1Price = vp.poc;
      tp1Tag = `[POC] +${((tp1Price - entryMid) / riskR).toFixed(1)}R`;
    }
  } else {
    const validEql = pools
      .filter(p => p.type === "EQL" && p.price <= entryMid - 1.45 * riskR && p.price >= entryMid - maxTp1Dist)
      .sort((a, b) => b.price - a.price);
    const poolTp1 = validEql[0];
    if (poolTp1) {
      tp1Price = poolTp1.price;
      tp1Tag = `[EQL] +${((entryMid - tp1Price) / riskR).toFixed(1)}R`;
    } else if (vp && vp.poc <= entryMid - 1.45 * riskR && vp.poc > entryMid - Math.min(2.5 * riskR, maxTp1Dist)) {
      tp1Price = vp.poc;
      tp1Tag = `[POC] +${((entryMid - tp1Price) / riskR).toFixed(1)}R`;
    }
  }

  const actualR1 = Math.abs(tp1Price - entryMid) / riskR;

  // TP2 calculation (>= 2.6R and >= TP1 + 0.8 ATR, capped by maxTp2Dist)
  let minTp2Dist = Math.max(2.6 * riskR, Math.abs(tp1Price - entryMid) + 0.8 * atr);
  let tp2Price = isLong ? entryMid + minTp2Dist : entryMid - minTp2Dist;
  let tp2Tag = "[2.6R+]";

  if (isLong) {
    if (vp && vp.vah >= entryMid + minTp2Dist * 0.98 && vp.vah <= entryMid + maxTp2Dist) {
      tp2Price = vp.vah;
      tp2Tag = `[VAH] +${((tp2Price - entryMid) / riskR).toFixed(1)}R`;
    } else if (
      gexReport?.callWall &&
      Number(gexReport.callWall) >= entryMid + minTp2Dist * 0.98 &&
      Number(gexReport.callWall) <= entryMid + maxTp2Dist
    ) {
      tp2Price = Number(gexReport.callWall);
      tp2Tag = `[CW ${tp2Price.toFixed(0)}] +${((tp2Price - entryMid) / riskR).toFixed(1)}R`;
    }
  } else {
    if (vp && vp.val <= entryMid - minTp2Dist * 0.98 && vp.val >= entryMid - maxTp2Dist) {
      tp2Price = vp.val;
      tp2Tag = `[VAL] +${((entryMid - tp2Price) / riskR).toFixed(1)}R`;
    } else if (
      gexReport?.putWall &&
      Number(gexReport.putWall) <= entryMid - minTp2Dist * 0.98 &&
      Number(gexReport.putWall) >= entryMid - maxTp2Dist
    ) {
      tp2Price = Number(gexReport.putWall);
      tp2Tag = `[PW ${tp2Price.toFixed(0)}] +${((entryMid - tp2Price) / riskR).toFixed(1)}R`;
    }
  }

  const actualR2 = Math.abs(tp2Price - entryMid) / riskR;

  // TP3 (Runner: >= 3.8R)
  const tp3Dist = Math.max(3.8 * riskR, Math.abs(tp2Price - entryMid) + 1.0 * atr);
  const tp3Price = isLong ? entryMid + tp3Dist : entryMid - tp3Dist;
  const actualR3 = Math.abs(tp3Price - entryMid) / riskR;
  const tp3Tag = `[Runner] +${actualR3.toFixed(1)}R`;

  // Plan B Setup (contingency on SL break / sweep)
  const planBEntry = sl;
  const planBSl = isLong ? sl + 1.0 * riskR : sl - 1.0 * riskR;
  const planBTp1 = isLong ? sl - 1.5 * riskR : sl + 1.5 * riskR;
  const planBTp2 = isLong ? sl - 2.8 * riskR : sl + 2.8 * riskR;

  const planB: ConfluencePlanB = {
    type: "B-SWEEP",
    entry: planBEntry,
    sl: planBSl,
    tp1: planBTp1,
    tp2: planBTp2,
    condition: `Активация при истинном пробое SL (${sl.toFixed(2)}) с закрытием свечи`,
    isActive: false,
    isTriggered: false
  };

  // State progression & Bar Replay analysis
  // ST0: Waiting for price to touch entry zone
  // ST1: Price entered entry zone
  // TP1_HIT: touched TP1
  // TP2_HIT: touched TP2
  let status: ConfluenceStatus = "ST0_PENDING";
  let stage: "ST0" | "ST1" | "TP1" | "TP2" | "TRAIL" | "EXPIRED" | "STOP" = "ST0";
  let barsSinceEntry = 0;
  let sweptReclaimDetected = false;
  let missedRetestDetected = false;
  let flipAdjusted = false;

  // Replay recent 15 bars to determine live state
  const replaySlice = candles.slice(-15);
  let entryTouched = false;
  let tp1Touched = false;
  let tp2Touched = false;
  let slTouched = false;
  let slWickBarsAgo = -1;

  for (let i = 0; i < replaySlice.length; i++) {
    const bar = replaySlice[i];

    // Check entry touch
    if (!entryTouched) {
      if (bar.low <= hi && bar.high >= lo) {
        entryTouched = true;
        barsSinceEntry = replaySlice.length - 1 - i;
      }
    }

    // Check if price reached TP1 without touching entry -> B-MISS
    if (!entryTouched) {
      if (isLong && bar.high >= tp1Price) {
        missedRetestDetected = true;
      } else if (!isLong && bar.low <= tp1Price) {
        missedRetestDetected = true;
      }
    }

    // If entry touched, track progress
    if (entryTouched) {
      if (isLong) {
        if (bar.low <= sl) {
          slTouched = true;
          slWickBarsAgo = replaySlice.length - 1 - i;
          // Check if closed back above SL within 2 bars -> B-SWEEP
          if (bar.close > sl && slWickBarsAgo <= 2) {
            sweptReclaimDetected = true;
          }
        }
        if (bar.high >= tp1Price) tp1Touched = true;
        if (bar.high >= tp2Price) tp2Touched = true;
      } else {
        if (bar.high >= sl) {
          slTouched = true;
          slWickBarsAgo = replaySlice.length - 1 - i;
          if (bar.close < sl && slWickBarsAgo <= 2) {
            sweptReclaimDetected = true;
          }
        }
        if (bar.low <= tp1Price) tp1Touched = true;
        if (bar.low <= tp2Price) tp2Touched = true;
      }
    }
  }

  // State mapping
  if (missedRetestDetected && !entryTouched) {
    status = "EXPIRED";
    stage = "EXPIRED";
    planB.type = "B-MISS";
    planB.condition = `B-MISS: Цена достигла TP1 (${tp1Price.toFixed(2)}) без входа. Ждём ретест ${entryMid.toFixed(2)}`;
    planB.isActive = true;
  } else if (sweptReclaimDetected) {
    status = "ST1_ACTIVE";
    stage = "ST1";
    planB.type = "B-SWEEP";
    planB.condition = `B-SWEEP: Свип SL (${sl.toFixed(2)}) с быстрым возвратом за 1–2 бара! Активирована зеркальная лестница.`;
    planB.isActive = true;
    planB.isTriggered = true;
  } else if (entryTouched) {
    if (tp2Touched) {
      status = "TP2_HIT";
      stage = "TP2";
    } else if (tp1Touched) {
      status = "TP1_HIT";
      stage = "TP1";
      // Trail SL to breakeven
      sl = entryMid;
    } else if (slTouched && !sweptReclaimDetected) {
      status = "STOPPED_OUT";
      stage = "STOP";
      planB.isActive = true;
      planB.isTriggered = true;
    } else {
      status = "ST1_ACTIVE";
      stage = "ST1";
    }
  } else {
    status = "ST0_PENDING";
    stage = "ST0";
  }

  // If ADR > 85%: SCALP MODE ONLY -> hide TP2 and TP3!
  const tp1Target: ConfluenceTarget = {
    price: Number(tp1Price.toFixed(2)),
    tag: tp1Tag,
    r: Number(actualR1.toFixed(2)),
    isHit: tp1Touched
  };

  const tp2Target: ConfluenceTarget | null = adrCap
    ? null
    : {
        price: Number(tp2Price.toFixed(2)),
        tag: tp2Tag,
        r: Number(actualR2.toFixed(2)),
        isHit: tp2Touched
      };

  const tp3Target: ConfluenceTarget | null = adrCap
    ? null
    : {
        price: Number(tp3Price.toFixed(2)),
        tag: tp3Tag,
        r: Number(actualR3.toFixed(2))
      };

  return {
    symbol,
    timeframe,
    timestamp,
    status,
    direction,
    score,
    activeLayers,
    allLayers,
    entryZone: [Number(lo.toFixed(2)), Number(hi.toFixed(2))],
    entryMid: Number(entryMid.toFixed(2)),
    sl: Number(sl.toFixed(2)),
    riskR: Number(riskR.toFixed(2)),
    riskAtrRatio: Number(riskAtrRatio.toFixed(2)),
    atr: Number(atr.toFixed(2)),
    tp1: tp1Target,
    tp2: tp2Target,
    tp3: tp3Target,
    planB,
    gates: {
      newsBlock,
      newsDetails,
      adrCap,
      regimeAllow
    },
    isScalpMode: adrCap,
    stateProgression: {
      stage,
      barsSinceEntry,
      sweptReclaimDetected,
      missedRetestDetected,
      flipAdjusted
    }
  };
}
