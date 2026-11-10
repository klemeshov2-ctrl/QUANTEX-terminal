import {
  computeVolumeProfile,
  computeSessionLevels,
  detectLiquidityPools,
  computeOrderFlow,
  computeAdr,
  buildPropContext,
  CandleLike
} from "../server/propContextEngine";
import { getSessionSchedule } from "../src/lib/marketSessions";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log("=== RUNNING PROP CONTEXT ENGINE TESTS ===");

// 1. computeVolumeProfile: POC on synthetic peak volume and VA ≈ 70% ±5%
{
  const candles: CandleLike[] = [];
  const basePrice = 4000;
  // Create 100 bars around 4000-4100 with a Gaussian-like volume peak around 4050
  for (let i = 0; i < 100; i++) {
    const center = 4000 + (i / 100) * 100; // 4000 to 4100
    const dist = Math.abs(center - 4050);
    const vol = Math.round(100 + 1000 * Math.exp(-((dist * dist) / (2 * 15 * 15))));
    candles.push({
      time: 1700000000000 + i * 900000,
      open: center - 1,
      high: center + 2,
      low: center - 2,
      close: center + 1,
      volume: vol
    });
  }

  const vp = computeVolumeProfile(candles, 100, 48);
  assert(vp !== null, "Volume Profile computed successfully");
  if (vp) {
    assert(Math.abs(vp.poc - 4050) < 15, `POC is near 4050 (got ${vp.poc})`);
    assert(vp.val <= vp.poc && vp.vah >= vp.poc, `VAL <= POC <= VAH (val=${vp.val}, poc=${vp.poc}, vah=${vp.vah})`);

    // Sum volume inside Value Area
    let vaVol = 0;
    for (const b of vp.bins) {
      if (b.price >= vp.val && b.price <= vp.vah) {
        vaVol += b.volume;
      }
    }
    const vaPct = (vaVol / vp.totalVolume) * 100;
    assert(vaPct >= 65 && vaPct <= 76, `Value Area volume is approx 70% ±5% (got ${vaPct.toFixed(1)}%)`);
  }
}

// 2. detectLiquidityPools: EQH from swings 4078.50 and 4078.80 at tol 0.0008
{
  // 4078.80 - 4078.50 = 0.30 -> diff = 0.30 / 4078.80 = 0.0000735 <= 0.0008
  const candles: CandleLike[] = [];
  for (let i = 0; i < 40; i++) {
    candles.push({
      time: 1700000000000 + i * 60000,
      open: 4050,
      high: 4060,
      low: 4040,
      close: 4055,
      volume: 100
    });
  }

  // Make swing 1 at index 10: high = 4078.50
  candles[10].high = 4078.50;
  // Make swing 2 at index 25: high = 4078.80
  candles[25].high = 4078.80;

  const pools = detectLiquidityPools(candles, 0.0008);
  const eqh = pools.find(p => p.type === "EQH");
  assert(Boolean(eqh), "Detected EQH pool from swings 4078.50 and 4078.80");
  if (eqh) {
    assert(Math.abs(eqh.price - 4078.65) < 0.1, `EQH price is midpoint 4078.65 (got ${eqh.price})`);
    assert(eqh.swept === false, "EQH is not swept yet");
  }

  // Now add a bar that sweeps 4078.65
  candles[35].high = 4085.0;
  const poolsAfterSweep = detectLiquidityPools(candles, 0.0008);
  const eqhSwept = poolsAfterSweep.find(p => p.type === "EQH");
  assert(Boolean(eqhSwept && eqhSwept.swept), "EQH marked as swept after candle wicks above level");
}

// 3. computeOrderFlow: Divergence HH price + LH delta -> "BEARISH"
{
  const candles: CandleLike[] = [];
  // 20 bars: first 10 has moderate price and huge positive volume delta (close at top)
  for (let i = 0; i < 10; i++) {
    candles.push({
      time: 1700000000000 + i * 60000,
      open: 4000 + i,
      high: 4010 + i, // max = 4019
      low: 4000 + i,
      close: 4009.9 + i, // close right at high -> large positive delta
      volume: 5000
    });
  }
  // next 10 bars: price makes Higher High (up to 4040), but close is near low -> weak/negative delta
  for (let i = 10; i < 20; i++) {
    candles.push({
      time: 1700000000000 + i * 60000,
      open: 4020 + i,
      high: 4030 + i, // max = 4049 (HH)
      low: 4015 + i,
      close: 4016 + i, // close near low -> negative/low delta (LH)
      volume: 500
    });
  }

  const of = computeOrderFlow(candles);
  assert(of !== null, "Order flow computed");
  if (of) {
    assert(of.deltaDivergence === "BEARISH", `Detected BEARISH delta divergence (got ${of.deltaDivergence})`);
  }
}

// 4. computeOrderFlow: Absorption bar detected
{
  const candles: CandleLike[] = [];
  // 20 normal bars
  for (let i = 0; i < 20; i++) {
    candles.push({
      time: 1700000000000 + i * 60000,
      open: 4000,
      high: 4005,
      low: 3995,
      close: 4001,
      volume: 100
    });
  }
  // Bar with huge volume, large delta, but very small body (e.g. range 20, body 2, volume 3000)
  candles.push({
    time: 1700000000000 + 20 * 60000,
    open: 4001,
    high: 4011,
    low: 3991,
    close: 4002, // body = 1, range = 20 -> body/range = 0.05 < 0.35
    volume: 5000 // huge volume
  });

  const of = computeOrderFlow(candles);
  assert(of !== null && of.absorption !== null, "Absorption event detected");
  if (of?.absorption) {
    assert(of.absorption.barsAgo === 0, `Absorption bar detected at index 0 bars ago (got ${of.absorption.barsAgo})`);
  }
}

// 5. buildPropContext: candles < 50 -> returns available: false and reason
{
  const fewCandles: CandleLike[] = [];
  for (let i = 0; i < 30; i++) {
    fewCandles.push({
      time: 1700000000000 + i * 60000,
      open: 4000,
      high: 4005,
      low: 3995,
      close: 4000,
      volume: 100
    });
  }
  const ctx = buildPropContext(fewCandles, 900, new Date());
  assert(ctx.available === false, "Context is unavailable when candles < 50");
  assert(ctx.volumeProfile === null, "Volume profile is null when candles < 50");
  assert(ctx.reason?.includes("Недостаточно данных") === true, `Reason states insufficient data (got ${ctx.reason})`);
}

// 6. buildPropContext: candles >= 50 -> complete context
{
  const fullCandles: CandleLike[] = [];
  for (let i = 0; i < 60; i++) {
    fullCandles.push({
      time: 1700000000000 + i * 60000,
      open: 4000 + i * 0.5,
      high: 4005 + i * 0.5,
      low: 3995 + i * 0.5,
      close: 4002 + i * 0.5,
      volume: 100
    });
  }
  const ctx = buildPropContext(fullCandles, 900, new Date());
  assert(ctx.available === true, "Context is available when candles >= 50");
  assert(ctx.volumeProfile !== null, "Volume profile is populated");
  assert(ctx.schedule !== null, "Session schedule is populated");
}

console.log("🎉 ALL PROP CONTEXT ENGINE TESTS PASSED SUCCESSFULLY!");
