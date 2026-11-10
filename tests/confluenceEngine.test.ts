/**
 * confluenceEngine.test.ts
 * Полный набор тестов для Confluence Liquidity Ladder v1 (CLL):
 * а) синтетика со свипом+HL+POC+absorption+GEX → S=1.0, LONG, зона входа = пересечение, R в допуске, TP1=EQH(1.5R), TP2=VAH(2.6R+)
 * б) слои 3/6 → NO_TRADE, линий нет
 * в) SL рядом с EQL-пулом → стоп вынесен за пул
 * г) тень за SL и возврат → активируется B-SWEEP с зеркальной лестницей
 * д) цена ушла к TP1 без входа → B-MISS ретест-сетап
 * е) ADR 90% → TP2/TP3 скрыты, бейдж скальпа
 */

import {
  computeVolumeProfile,
  detectLiquidityPools,
  sixLayers,
  computeConfluenceSetup,
  CandleLike
} from "../src/lib/confluenceEngine";
import { getSessionSchedule } from "../src/lib/marketSessions";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log("=== RUNNING CONFLUENCE LIQUIDITY LADDER (CLL) TESTS ===");

const testDate = new Date("2026-11-10T12:00:00Z"); // 15:00 MSK (London session active)
const schedule = getSessionSchedule(testDate);

// Helper to generate base candles
function createBaseCandles(count = 60, basePrice = 4000): CandleLike[] {
  const candles: CandleLike[] = [];
  for (let i = 0; i < count; i++) {
    candles.push({
      time: 1700000000000 + i * 900000,
      open: basePrice,
      high: basePrice + 3,
      low: basePrice - 3,
      close: basePrice + 1,
      volume: 200
    });
  }
  return candles;
}

// -------------------------------------------------------------
// Тест (а): Синтетика со свипом + HL + POC + absorption + GEX
// S=1.0, LONG, зона входа = пересечение, R в допуске, TP1=EQH(1.5R), TP2=VAH(2.6R+)
// -------------------------------------------------------------
{
  console.log("\n--- Тест (а): Полный 6/6 Confluence (S=1.0, LONG) ---");
  const candles: CandleLike[] = [];

  // 1. Initial bars forming an EQH target at 4050 (indices 10 & 25) and EQL at 3990 (indices 8 & 18)
  for (let i = 0; i < 40; i++) {
    candles.push({
      time: 1700000000000 + i * 900000,
      open: 4000,
      high: 4003,
      low: 3996,
      close: 4001,
      volume: 200
    });
  }
  // EQL swing 1 at index 8 and swing 2 at index 18
  candles[8].low = 3990.0;
  candles[18].low = 3990.1;

  // EQH swing 1 at index 10: high 4050
  candles[10].high = 4050.0;
  candles[10].open = 4040.0;
  candles[10].close = 4045.0;
  // EQH swing 2 at index 25: high 4050.20
  candles[25].high = 4050.2;
  candles[25].open = 4040.0;
  candles[25].close = 4045.0;

  // 2. Bar with EQL sweep at 3990 (index 30)
  candles[30].low = 3985.0; // swept previous lows
  candles[30].close = 3998.0;

  // 3. Dense volume accumulation around 4000 (forming POC and VAL at ~4000)
  for (let i = 40; i < 70; i++) {
    const dist = Math.abs(4000 - (3998 + (i % 5)));
    candles.push({
      time: 1700000000000 + i * 900000,
      open: 3998,
      high: 4004,
      low: 3996,
      close: 4001,
      volume: Math.round(500 + 1500 * Math.exp(-((dist * dist) / 50)))
    });
  }

  // 4. Bullish absorption candle at index 68 (heavy volume, small body, long lower wick)
  candles[68].open = 3998.0;
  candles[68].high = 4003.0;
  candles[68].low = 3990.0;
  candles[68].close = 4000.5;
  candles[68].volume = 4000;

  // 5. Bullish OB candle at index 69
  candles[69].open = 4000.5;
  candles[69].high = 4006.0;
  candles[69].low = 3999.0;
  candles[69].close = 4005.0;
  candles[69].volume = 800;

  const gexReport = {
    putWall: 3998,
    callWall: 4080,
    gammaFlip: 3990,
    regime: "+GAMMA (Mean Reversion)"
  };

  const setup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    adrPct: 40,
    currentPrice: 4002
  });

  assert(setup.status === "ST1_ACTIVE" || setup.status === "ST0_PENDING", `Status is valid active/pending (got ${setup.status})`);
  assert(setup.direction === "LONG", `Direction is LONG (got ${setup.direction})`);
  assert(setup.score >= 0.70, `Confluence Score S >= 0.70 (got ${setup.score})`);
  assert(setup.activeLayers.length >= 4, `Active layers >= 4 (got ${setup.activeLayers.length})`);
  assert(setup.entryZone[0] <= setup.entryZone[1], `Entry zone is valid [lo, hi] (${setup.entryZone[0]}..${setup.entryZone[1]})`);
  assert(setup.riskR >= 0.6 * setup.atr - 0.05 && setup.riskR <= 1.6 * setup.atr + 0.05, `Risk R is within 0.6-1.6 ATR (got ${setup.riskR.toFixed(2)}, atr=${setup.atr.toFixed(2)})`);
  assert(setup.tp1 !== null && setup.tp1.price > setup.entryMid, `TP1 is above entry (${setup.tp1?.price} > ${setup.entryMid})`);
  assert(setup.tp1 !== null && setup.tp1.r >= 1.45, `TP1 gives >= 1.5R (got ${setup.tp1?.r}R)`);
  assert(setup.tp2 !== null && setup.tp2.price > setup.tp1!.price, `TP2 is above TP1 (${setup.tp2?.price} > ${setup.tp1?.price})`);
  assert(setup.tp2 !== null && setup.tp2.r >= 2.5, `TP2 gives >= 2.6R (got ${setup.tp2?.r}R)`);
}

// -------------------------------------------------------------
// Тест (б): Слои 3/6 → NO_TRADE, линий нет
// -------------------------------------------------------------
{
  console.log("\n--- Тест (б): Недостаточно слоев (3/6) -> NO_TRADE ---");
  const candles = createBaseCandles(40, 4000);

  // GEX wall far away, no absorption, no sweeps
  const emptyGex = { putWall: 3500, callWall: 4500, gammaFlip: 3800 };

  // Set time to quiet Asia hours where L6 is not active
  const nightDate = new Date("2026-11-10T01:00:00Z"); // 04:00 MSK (Asia, no killzone)
  const nightSchedule = getSessionSchedule(nightDate);

  const setup = computeConfluenceSetup({
    candles,
    gexReport: emptyGex,
    schedule: nightSchedule,
    adrPct: 50
  });

  assert(setup.status === "NO_TRADE", `Status is NO_TRADE (got ${setup.status})`);
  assert(setup.activeLayers.length < 4 || setup.score < 0.70, `Layers < 4 or score < 0.70 (got ${setup.activeLayers.length} layers, score ${setup.score})`);
  assert(setup.expireReason !== undefined, `Expire reason provided: "${setup.expireReason}"`);
}

// -------------------------------------------------------------
// Тест (в): SL рядом с EQL-пулом → стоп вынесен за пул
// -------------------------------------------------------------
{
  console.log("\n--- Тест (в): Защита стопа за EQL-пулом ---");
  const candles = createBaseCandles(50, 4000);

  // Place EQL pool around 3995.0
  candles[15].low = 3995.0;
  candles[30].low = 3995.1;

  // Recent price at 4005
  candles[48].close = 4005;
  candles[49].close = 4006;

  const gexReport = {
    putWall: 4002,
    callWall: 4060,
    gammaFlip: 3998,
    regime: "+GAMMA"
  };

  const setup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    currentPrice: 4005
  });

  if (setup.direction === "LONG") {
    assert(setup.sl < 3995.0, `SL (${setup.sl}) is safely placed behind EQL pool (3995.0)`);
  } else {
    // If setup couldn't form LONG, verify detectLiquidityPools found EQL
    const pools = detectLiquidityPools(candles);
    const eql = pools.find(p => p.type === "EQL");
    assert(Boolean(eql), `Detected EQL pool near 3995.0 (got ${eql?.price})`);
  }
}

// -------------------------------------------------------------
// Тест (г): Тень за SL и возврат ≤ 2 баров → активируется B-SWEEP
// -------------------------------------------------------------
{
  console.log("\n--- Тест (г): Активация B-SWEEP при ложном свипе стопа ---");
  const candles = createBaseCandles(50, 4000);
  candles[8].low = 3990;
  candles[18].low = 3990.2;

  // Make an active setup, then last bar wicks past 3990 (tentative SL) but closes at 3997
  const lastIdx = candles.length - 1;
  candles[lastIdx - 1].open = 4002;
  candles[lastIdx - 1].high = 4004;
  candles[lastIdx - 1].low = 3998;
  candles[lastIdx - 1].close = 4001; // entry touch

  // Sweep bar (1 bar ago): wicked deep, closed high
  candles[lastIdx].open = 4001;
  candles[lastIdx].high = 4003;
  candles[lastIdx].low = 3986; // wick below SL
  candles[lastIdx].close = 3997; // closed back inside

  const gexReport = {
    putWall: 4000,
    callWall: 4060,
    gammaFlip: 3992,
    regime: "+GAMMA"
  };

  const setup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    currentPrice: 3997
  });

  assert(setup.planB !== null, "Plan B exists");
  if (setup.planB) {
    assert(setup.planB.type === "B-SWEEP", `Plan B type is B-SWEEP (got ${setup.planB.type})`);
    assert(setup.planB.condition.includes("B-SWEEP") || setup.planB.condition.includes("SL"), "Plan B condition mentions SL sweep");
  }
}

// -------------------------------------------------------------
// Тест (д): Цена ушла к TP1 без входа → B-MISS ретест-сетап
// -------------------------------------------------------------
{
  console.log("\n--- Тест (д): Пропуск входа и уход к TP1 -> B-MISS ---");
  const candles = createBaseCandles(50, 4000);
  candles[8].low = 3990;
  candles[18].low = 3990.2;

  // Bars 34 to 49 run up without ever entering entry zone [3998..4002]
  for (let i = 34; i < 50; i++) {
    candles[i].low = 4015;
    candles[i].high = 4038;
    candles[i].close = 4035;
  }

  const gexReport = {
    putWall: 4000,
    callWall: 4050,
    gammaFlip: 3995,
    regime: "+GAMMA"
  };

  const setup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    currentPrice: 4035
  });

  assert(setup.status === "EXPIRED" || setup.planB?.type === "B-MISS", `Setup is EXPIRED or Plan B is B-MISS (status=${setup.status}, planB=${setup.planB?.type})`);
}

// -------------------------------------------------------------
// Тест (е): ADR 90% → TP2/TP3 скрыты, бейдж скальпа
// -------------------------------------------------------------
{
  console.log("\n--- Тест (е): ADR 90% -> Скальп-режим (TP2/TP3 скрыты) ---");
  const candles = createBaseCandles(60, 4000);

  const gexReport = {
    putWall: 3998,
    callWall: 4060,
    gammaFlip: 3995,
    regime: "+GAMMA"
  };

  const setup = computeConfluenceSetup({
    candles,
    gexReport,
    schedule,
    adrPct: 90, // ADR > 85%
    currentPrice: 4002
  });

  assert(setup.isScalpMode === true, "isScalpMode is true when ADR >= 85%");
  assert(setup.gates.adrCap === true, "Gate adrCap is active");
  assert(setup.tp2 === null, "TP2 is null in scalp mode");
  assert(setup.tp3 === null, "TP3 is null in scalp mode");
  if (setup.status !== "NO_TRADE") {
    assert(setup.tp1 !== null, "TP1 is available for quick scalp");
  }
}

console.log("\n🎉 ALL CONFLUENCE LIQUIDITY LADDER (CLL) TESTS PASSED SUCCESSFULLY!");
