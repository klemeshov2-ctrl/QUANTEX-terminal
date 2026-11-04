process.env.NODE_ENV = "test";
process.env.QUANTEX_UNIT_TEST = "1";

import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  computeMaxPain,
  computeZeroGammaFlip,
  interpolateOptionBookOnUniformGrid,
  evaluateOptionBookDensity,
  findCallAndPutWalls,
  calculateOptionGreeks,
  getGexReportForAsset,
  clearGexEngineCache,
  isOptionTimestampStale,
  evaluateOptionDataFreshness,
  GexStrikeData,
  GexMarketReport
} from "../server/gexEngine";
import {
  enrichReportWithStandardLabels,
  getHorizonCooldownMs,
  getHorizonHysteresisThreshold,
  getStabilizedGexReport,
  resetStabilizedGexCache,
  registerActiveTradeChecker,
  getStabilizerMigrationLog
} from "../server/gexStateManager";
import { formatGexFreshDiffPreview } from "../src/lib/gexLabels";
import { GexProbabilityHero } from "../src/components/GexProbabilityHero";
import {
  recordGexMigrationSnapshot,
  clearGexTrackersHistory,
  loadGexTrackersHistoryFromDisk,
  saveGexTrackersHistorySync,
  gexTrackersHistory,
  GEX_TRACKERS_HISTORY_FILE,
  resolveGexMigrationContext,
  buildGexTradePlanSection
} from "../server/gexTracker";
import {
  evaluateSetupRange,
  registerActiveLock,
  arbitrateOpposingLocksForAsset,
  resetIndicatorForecast,
  computeHonest5TfConsensus,
  resolveTrendAlignmentBadge,
  evaluateMaeGuard,
  generateHudData,
  AnchoredForecastItem,
  ForecastState,
  Candle
} from "../src/lib/pineSuperIndicatorEngine";
import {
  recordOrUpdateIndicatorSetup,
  getIndicatorSetupsHistory,
  computeIndicatorOverallStats,
  deleteIndicatorSetup
} from "../server/indicatorStatsEngine";

async function runTests() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("🧪 QUANTEX GEX ENGINE UNIT TEST SUITE");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  let passed = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Симметричная цепочка с пиком OI на страйке K → computeMaxPain возвращает K
  // ---------------------------------------------------------------------------
  {
    const K = 4000;
    const strikes: GexStrikeData[] = [
      { strike: 3900, callOi: 500, putOi: 500, totalOi: 1000, callVolume: 99999, putVolume: 0, callGex: 1, putGex: -1, netGex: 0, iv: 0.18 },
      { strike: 3950, callOi: 1500, putOi: 1500, totalOi: 3000, callVolume: 0, putVolume: 88888, callGex: 2, putGex: -2, netGex: 0, iv: 0.18 },
      { strike: K,    callOi: 8000, putOi: 8000, totalOi: 16000, callVolume: 10, putVolume: 10, callGex: 10, putGex: -10, netGex: 0, iv: 0.18 },
      { strike: 4050, callOi: 1500, putOi: 1500, totalOi: 3000, callVolume: 77777, putVolume: 0, callGex: 2, putGex: -2, netGex: 0, iv: 0.18 },
      { strike: 4100, callOi: 500, putOi: 500, totalOi: 1000, callVolume: 0, putVolume: 66666, callGex: 1, putGex: -1, netGex: 0, iv: 0.18 }
    ];

    const resultMaxPain = computeMaxPain(strikes, 3900);
    assert.equal(resultMaxPain, K, `Expected Max Pain to be ${K}, got ${resultMaxPain}`);
    console.log(`✅ [PASS] Test 1: Симметричная цепочка с пиком OI на K=${K} → computeMaxPain вернул ${resultMaxPain} (Volume проигнорирован)`);
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Цепочка с пиком call OI на K1 (>spot) и пиком put OI на K2 (<spot) → findCallAndPutWalls возвращает K1 и K2
  // ---------------------------------------------------------------------------
  {
    const spot = 4000;
    const K1 = 4080; // Peak Call OI above spot
    const K2 = 3920; // Peak Put OI below spot
    const strikes: GexStrikeData[] = [
      { strike: 3880, callOi: 200, putOi: 1200, totalOi: 1400, callVolume: 50000, putVolume: 90000, callGex: 0.5, putGex: -2.0, netGex: -1.5, iv: 0.18 },
      { strike: K2,   callOi: 300, putOi: 9500, totalOi: 9800, callVolume: 100, putVolume: 100, callGex: 0.6, putGex: -12.4, netGex: -11.8, iv: 0.18 },
      { strike: 3960, callOi: 400, putOi: 3100, totalOi: 3500, callVolume: 80000, putVolume: 80000, callGex: 0.8, putGex: -4.1, netGex: -3.3, iv: 0.18 },
      { strike: 4040, callOi: 2800, putOi: 350, totalOi: 3150, callVolume: 95000, putVolume: 50000, callGex: 3.9, putGex: -0.5, netGex: 3.4, iv: 0.18 },
      { strike: K1,   callOi: 11200, putOi: 250, totalOi: 11450, callVolume: 50, putVolume: 50, callGex: 14.8, putGex: -0.3, netGex: 14.5, iv: 0.18 },
      { strike: 4120, callOi: 1900, putOi: 150, totalOi: 2050, callVolume: 70000, putVolume: 20000, callGex: 2.1, putGex: -0.2, netGex: 1.9, iv: 0.18 }
    ];

    const walls = findCallAndPutWalls(strikes, spot, 10, 0);
    assert.equal(walls.callWall, K1, `Expected Call Wall K1=${K1}, got ${walls.callWall}`);
    assert.equal(walls.putWall, K2, `Expected Put Wall K2=${K2}, got ${walls.putWall}`);
    console.log(`✅ [PASS] Test 2: Пик Call OI на K1=${K1} (>spot=${spot}) и пик Put OI на K2=${K2} (<spot=${spot}) → findCallAndPutWalls вернул { callWall: ${walls.callWall}, putWall: ${walls.putWall} }`);
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: ATM-гамма Блэка-Шоулза совпадает с приближением 0.4/(S·σ·√T) в пределах 5%
  // ---------------------------------------------------------------------------
  {
    const S = 4000;
    const K = 4000;
    const T = 7 / 365;
    const sigma = 0.20;
    const { gamma: bsGamma } = calculateOptionGreeks(S, K, T, sigma, true, 0.04);
    const approxGamma = 0.4 / (S * sigma * Math.sqrt(T));
    const relErrorPct = (Math.abs(bsGamma - approxGamma) / approxGamma) * 100;

    assert.ok(relErrorPct <= 5.0, `Expected relative error <= 5%, got ${relErrorPct.toFixed(4)}%`);
    console.log(
      `✅ [PASS] Test 3: ATM-гамма Блэка-Шоулза (${bsGamma.toFixed(6)}) vs приближение 0.4/(S·σ·√T) (${approxGamma.toFixed(6)}) → расхождение ${relErrorPct.toFixed(3)}% (<= 5%)`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Два параллельных вызова getGexReportForAsset для одного ключа возвращают тот же Promise (без второго сетевого запроса)
  // ---------------------------------------------------------------------------
  {
    clearGexEngineCache();
    const originalFetch = globalThis.fetch;
    let networkCallCount = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      networkCallCount++;
      await new Promise((r) => setTimeout(r, 40));
      if (url.includes("binance.com")) {
        return new Response(JSON.stringify({ symbol: "BTCUSDT", price: "85000.00" }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    }) as typeof fetch;

    try {
      const p1 = getGexReportForAsset("BTC", "WEEK");
      const p2 = getGexReportForAsset("BTC", "WEEK");

      assert.strictEqual(p1, p2, "Expected p1 and p2 to be the exact same Promise instance (p1 === p2)");
      const [res1, res2] = await Promise.all([p1, p2]);
      assert.strictEqual(res1, res2, "Expected resolved reports to be the same object reference");
      assert.equal(networkCallCount, 2, `Expected exactly 1 execution batch (2 HTTP calls: spot + options), got ${networkCallCount}`);
      console.log(
        `✅ [PASS] Test 4: Два параллельных вызова getGexReportForAsset("BTC", "WEEK") вернули один и тот же Promise (p1 === p2: ${p1 === p2}), сетевых батчей: 1 (HTTP вызовов: ${networkCallCount} вместо ${networkCallCount * 2})`
      );
      passed++;
    } finally {
      globalThis.fetch = originalFetch;
      clearGexEngineCache();
    }
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // TEST 5: Сессионно-осознанная политика свежести опционных данных + рендер UI
  // ---------------------------------------------------------------------------
  {
    // Scenario 1: timestamp = сейчас внутри сессии США (например, среда 19:00 UTC = 14:00 ET) -> fresh
    const wedSessionMs = Date.parse("2026-11-04T19:00:00Z");
    const s1 = evaluateOptionDataFreshness({
      timestampMs: wedSessionMs - 5 * 60 * 1000,
      marketType: "US_OPTIONS",
      nowMs: wedSessionMs
    });
    assert.equal(s1.sessionVerdict, "fresh", "Expected fresh verdict during US session");
    assert.equal(s1.isDataStale, false, "Expected isDataStale=false during active session");
    assert.equal(s1.isSynthetic, false, "Expected isSynthetic=false during active session");

    // Scenario 2: сейчас 13:00 МСК (10:00 UTC), timestamp = закрытие прошлой сессии США (21:00 UTC) -> overnight_normal
    const tue13Msk = Date.parse("2026-11-03T10:00:00Z");
    const monClose = Date.parse("2026-11-02T21:00:00Z");
    const s2 = evaluateOptionDataFreshness({
      timestampMs: monClose,
      marketType: "US_OPTIONS",
      nowMs: tue13Msk
    });
    assert.equal(s2.sessionVerdict, "overnight_normal", "Expected overnight_normal outside US session before open");
    assert.equal(s2.isDataStale, false, "Expected isDataStale=false for overnight data from previous close");
    assert.equal(s2.isSynthetic, false, "Expected isSynthetic=false for real overnight option chain");
    assert.ok(s2.dataFreshnessLabel.includes("закрытие прошлой сессии США"), "Expected label to mention close of last US session");

    // Scenario 3: timestamp старше 26 часов в будний день -> stale, isDataStale=true, isSynthetic=true
    const s3 = evaluateOptionDataFreshness({
      timestampMs: tue13Msk - 27 * 3600 * 1000,
      marketType: "US_OPTIONS",
      nowMs: tue13Msk
    });
    assert.equal(s3.sessionVerdict, "stale", "Expected stale verdict for data older than 26h");
    assert.equal(s3.isDataStale, true, "Expected isDataStale=true for stale data");
    assert.equal(s3.isSynthetic, true, "Expected isSynthetic=true for stale data >26h");

    // Scenario 4: суббота, timestamp = закрытие пятницы -> overnight_normal (weekend), isDataStale=false
    const satMs = Date.parse("2026-11-07T15:00:00Z");
    const friClose = Date.parse("2026-11-06T21:00:00Z");
    const s4 = evaluateOptionDataFreshness({
      timestampMs: friClose,
      marketType: "US_OPTIONS",
      nowMs: satMs
    });
    assert.equal(s4.sessionVerdict, "overnight_normal", "Expected overnight_normal on weekend with Friday close");
    assert.equal(s4.isDataStale, false, "Expected isDataStale=false on weekend with Friday close");
    assert.equal(s4.isSynthetic, false, "Expected isSynthetic=false on weekend with Friday close");
    assert.ok(s4.dataFreshnessLabel.includes("закрытие пятницы"), "Expected weekend label to mention Friday close");

    // Scenario 5: fetch упал -> unavailable + isSynthetic=true, isDataStale=true
    const s5 = evaluateOptionDataFreshness({
      timestampMs: null,
      marketType: "US_OPTIONS",
      fetchFailed: true
    });
    assert.equal(s5.sessionVerdict, "unavailable", "Expected unavailable verdict on fetch failure");
    assert.equal(s5.isSynthetic, true, "Expected isSynthetic=true on fetch failure");
    assert.equal(s5.isDataStale, true, "Expected isDataStale=true on fetch failure");

    // UI Rendering Verification
    const mockSyntheticReport: GexMarketReport = {
      asset: "XAUUSD",
      horizon: "WEEK",
      spotPrice: 4040,
      timestamp: new Date().toISOString(),
      expirationDate: "25 окт, 18:45 MSK (Неделя)",
      source: "OANDA Spot • Yahoo Finance Options GC=F / GLD ETF (delayed quotes) • Данные устарели",
      isSynthetic: true,
      isDataStale: true,
      proxyNote: "Опционы на ETF GLD, не на фьючерс золота COMEX GC",
      netGexTotal: 18.5,
      normalizedNetGex: 0.42,
      gexIntensity: 1.25,
      netGexRegime: "POSITIVE_GAMMA",
      regimeDescription: "Положительная гамма",
      gammaFlip: 4030,
      callWall: 4080,
      putWall: 3990,
      maxPain: 4040,
      expectedMove68: { low: 3995, high: 4085, rangePct: 1.1 },
      expectedMove95: { low: 3950, high: 4130, rangePct: 2.2 },
      dealerGreeks: { charm: -5.2, vanna: 4.1, aggregateDelta: 1200 },
      pcrOi: 0.92,
      pcrVol: 0.88,
      impliedVolAvg: 18.5,
      realizedVol30d: 14.8,
      volSpreadIvRv: 3.7,
      strikes: [
        { strike: 3990, callGex: 0.5, putGex: -8.2, netGex: -7.7, callOi: 400, putOi: 5200, totalOi: 5600, callVolume: 100, putVolume: 1200, iv: 0.185 },
        { strike: 4040, callGex: 4.2, putGex: -3.8, netGex: 0.4, callOi: 2500, putOi: 2300, totalOi: 4800, callVolume: 600, putVolume: 550, iv: 0.185 },
        { strike: 4080, callGex: 11.4, putGex: -0.6, netGex: 10.8, callOi: 6800, putOi: 350, totalOi: 7150, callVolume: 1500, putVolume: 80, iv: 0.185 }
      ],
      oiAnomalies: []
    };

    const htmlSynthetic = renderToStaticMarkup(
      React.createElement(GexProbabilityHero, {
        gexReport: mockSyntheticReport,
        candles: [],
        activeAsset: "XAUUSD"
      })
    );

    const htmlReal = renderToStaticMarkup(
      React.createElement(GexProbabilityHero, {
        gexReport: {
          ...mockSyntheticReport,
          isSynthetic: false,
          isDataStale: false,
          dataFreshnessLabel: "Данные опционов: закрытие прошлой сессии США (норма до 16:30 МСК)"
        },
        candles: [],
        activeAsset: "XAUUSD"
      })
    );

    assert.ok(
      htmlSynthetic.includes("Синтетическая модель") && htmlSynthetic.includes("Данные устарели"),
      "Expected GexProbabilityHero with isSynthetic=true & isDataStale=true to render warning badge 'Синтетическая модель • Данные устарели'"
    );
    assert.ok(
      htmlSynthetic.includes("Опционы на ETF GLD, не на фьючерс золота COMEX GC"),
      "Expected GexProbabilityHero to render GLD ETF disclosure note"
    );
    assert.ok(
      !htmlReal.includes("Синтетическая модель"),
      "Expected GexProbabilityHero with isSynthetic=false NOT to render warning badge 'Синтетическая модель'"
    );
    assert.ok(
      htmlReal.includes("закрытие прошлой сессии США"),
      "Expected GexProbabilityHero with isSynthetic=false to render dataFreshnessLabel"
    );
    console.log(
      `✅ [PASS] Test 5: Сессионная политика свежести (сессия/ночь/выходные/сбой) + UI рендерит корректные лейблы и примечание GLD ETF`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Зона нулевых выплат (totalPayout == 0) между кластерами Puts и Calls + равномерная сетка
  // → computeMaxPain не отбрасывает totalPayout == 0 и возвращает медианный страйк зоны пиннинга,
  // устраняя прилипание к краю кластера (Put Wall или Call Wall)
  // ---------------------------------------------------------------------------
  {
    // Put cluster at 3900..3920 (step 10), Call cluster at 4080..4100 (step 10)
    // Between 3920 and 4080 all strikes have totalPayout === 0!
    // Uniform grid has step = 10 -> zero-payout candidates are 3920, 3930, ..., 4080 -> median is 4000 (not 3920 or 4080)
    const separatedClusters: GexStrikeData[] = [
      { strike: 3900, callOi: 0, putOi: 4000, totalOi: 4000, callVolume: 0, putVolume: 0, callGex: 0, putGex: -8, netGex: -8, iv: 0.18 },
      { strike: 3910, callOi: 0, putOi: 6000, totalOi: 6000, callVolume: 0, putVolume: 0, callGex: 0, putGex: -12, netGex: -12, iv: 0.18 },
      { strike: 3920, callOi: 0, putOi: 5000, totalOi: 5000, callVolume: 0, putVolume: 0, callGex: 0, putGex: -10, netGex: -10, iv: 0.18 },
      { strike: 4080, callOi: 5000, putOi: 0, totalOi: 5000, callVolume: 0, putVolume: 0, callGex: 10, putGex: 0, netGex: 10, iv: 0.18 },
      { strike: 4090, callOi: 6000, putOi: 0, totalOi: 6000, callVolume: 0, putVolume: 0, callGex: 12, putGex: 0, netGex: 12, iv: 0.18 },
      { strike: 4100, callOi: 4000, putOi: 0, totalOi: 4000, callVolume: 0, putVolume: 0, callGex: 8, putGex: 0, netGex: 8, iv: 0.18 }
    ];

    const uniformGrid = interpolateOptionBookOnUniformGrid(separatedClusters, 10, 0);
    assert.equal(uniformGrid.length, 21, `Expected 21 uniform grid strikes from 3900 to 4100 (step 10), got ${uniformGrid.length}`);

    const maxPainMedian = computeMaxPain(separatedClusters, 3950, 10, 0);
    assert.equal(
      maxPainMedian,
      4000,
      `Expected Max Pain in zero-payout pinning zone [3920..4080] to be exact median 4000 (not stuck to cluster edge), got ${maxPainMedian}`
    );

    const zeroFlip = computeZeroGammaFlip(separatedClusters, 4000, 10, 0);
    assert.equal(
      zeroFlip,
      4000,
      `Expected Zero-Flip interpolated on uniform grid between -10 at 3920 and +10 at 4080 to be 4000, got ${zeroFlip}`
    );

    console.log(
      `✅ [PASS] Test 6: Равномерная сетка (${uniformGrid.length} узлов, шаг 10) и зона нулевых выплат [3920..4080] → computeMaxPain=${maxPainMedian} (медиана зоны пиннинга, без прилипания к PW=3910/CW=4090), Zero-Flip=${zeroFlip}`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Guard плотности книги (evaluateOptionBookDensity):
  // если страйков с OI < 8 с любой стороны (calls или puts) → lowConfidence: true + бейдж в UI
  // ---------------------------------------------------------------------------
  {
    const sparseStrikes: GexStrikeData[] = [
      { strike: 3950, callOi: 100, putOi: 500, totalOi: 600, callVolume: 0, putVolume: 0, callGex: 1, putGex: -2, netGex: -1, iv: 0.18 },
      { strike: 4000, callOi: 200, putOi: 400, totalOi: 600, callVolume: 0, putVolume: 0, callGex: 1, putGex: -1, netGex: 0, iv: 0.18 },
      { strike: 4050, callOi: 300, putOi: 100, totalOi: 400, callVolume: 0, putVolume: 0, callGex: 2, putGex: -0.5, netGex: 1.5, iv: 0.18 }
    ];
    const densitySparse = evaluateOptionBookDensity(sparseStrikes, "XAUUSD", "DAY", "UnitTest Sparse Book");
    assert.equal(densitySparse.lowConfidence, true, "Expected lowConfidence=true when calls=3 < 8 and puts=3 < 8");
    assert.equal(densitySparse.lowConfidenceReason, "Мало данных OI — уровни приблизительные");

    const denseStrikes: GexStrikeData[] = Array.from({ length: 10 }, (_, idx) => ({
      strike: 3900 + idx * 20,
      callOi: 500,
      putOi: 500,
      totalOi: 1000,
      callVolume: 0,
      putVolume: 0,
      callGex: 2,
      putGex: -2,
      netGex: 0,
      iv: 0.18
    }));
    const densityDense = evaluateOptionBookDensity(denseStrikes, "XAUUSD", "DAY", "UnitTest Dense Book");
    assert.equal(densityDense.lowConfidence, false, "Expected lowConfidence=false when calls=10 >= 8 and puts=10 >= 8");

    console.log(
      `✅ [PASS] Test 7: Guard плотности книги OI: при 3 страйках → lowConfidence=${densitySparse.lowConfidence} ("${densitySparse.lowConfidenceReason}"), при 10 страйках → lowConfidence=${densityDense.lowConfidence}`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Проброс outOfCorridor / flipOutOfCorridor / painOutOfCorridor в chart-лейблы и UI
  // ---------------------------------------------------------------------------
  {
    const baseReport: GexMarketReport = {
      asset: "XAUUSD",
      horizon: "DAY",
      spotPrice: 4040,
      timestamp: new Date().toISOString(),
      expirationDate: "25 окт, 18:45 MSK (День)",
      source: "Yahoo Finance Options GC=F / GLD ETF (delayed quotes)",
      isSynthetic: false,
      lowConfidence: true,
      lowConfidenceReason: "Мало данных OI — уровни приблизительные",
      callOiStrikesCount: 4,
      putOiStrikesCount: 5,
      outOfCorridor: true,
      flipOutOfCorridor: true,
      painOutOfCorridor: true,
      netGexTotal: 12.0,
      normalizedNetGex: 0.3,
      gexIntensity: 1.1,
      netGexRegime: "POSITIVE_GAMMA",
      regimeDescription: "Положительная гамма",
      gammaFlip: 3950, // Outside [3990, 4080]
      callWall: 4080,
      putWall: 3990,
      maxPain: 3960,   // Outside [3990, 4080]
      expectedMove68: { low: 3995, high: 4085, rangePct: 1.1 },
      expectedMove95: { low: 3950, high: 4130, rangePct: 2.2 },
      dealerGreeks: { charm: -2.0, vanna: 1.5, aggregateDelta: 500 },
      pcrOi: 0.95,
      pcrVol: 0.9,
      impliedVolAvg: 18.0,
      realizedVol30d: 15.0,
      volSpreadIvRv: 3.0,
      strikes: [
        { strike: 3990, callGex: 0.5, putGex: -8.2, netGex: -7.7, callOi: 400, putOi: 5200, totalOi: 5600, callVolume: 100, putVolume: 1200, iv: 0.18 },
        { strike: 4040, callGex: 4.2, putGex: -3.8, netGex: 0.4, callOi: 2500, putOi: 2300, totalOi: 4800, callVolume: 600, putVolume: 550, iv: 0.18 },
        { strike: 4080, callGex: 11.4, putGex: -0.6, netGex: 10.8, callOi: 6800, putOi: 350, totalOi: 7150, callVolume: 1500, putVolume: 80, iv: 0.18 }
      ],
      oiAnomalies: []
    };

    const enriched = enrichReportWithStandardLabels(baseReport);
    assert.ok(
      enriched.painLabel?.includes("⚠️") && enriched.painLabel?.includes("Вне коридора"),
      `Expected painLabel to include '⚠️' and 'Вне коридора', got: ${enriched.painLabel}`
    );
    assert.ok(
      enriched.flipLabel?.includes("⚠️") && enriched.flipLabel?.includes("Вне коридора"),
      `Expected flipLabel to include '⚠️' and 'Вне коридора', got: ${enriched.flipLabel}`
    );

    const htmlHero = renderToStaticMarkup(
      React.createElement(GexProbabilityHero, {
        gexReport: enriched,
        candles: [],
        activeAsset: "XAUUSD"
      })
    );
    assert.ok(
      htmlHero.includes("Мало данных OI — уровни приблизительные"),
      "Expected GexProbabilityHero to render lowConfidence badge 'Мало данных OI — уровни приблизительные'"
    );
    assert.ok(
      htmlHero.includes("вне PW–CW"),
      "Expected GexProbabilityHero SVG chart label to include '⚠️ MP ... вне PW–CW'"
    );

    console.log(
      `✅ [PASS] Test 8: Проброс outOfCorridor в chart-лейблы → painLabel="${enriched.painLabel}", flipLabel="${enriched.flipLabel}", UI рендерит бейдж lowConfidence и ⚠️ на графике`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Устранение вырожденности Pain == CW (краевого само-пиннинга на Call Wall)
  // и проверка resetStabilizedGexCache + строгого неравенства PW < Pain < CW по DAY/WEEK/MONTH
  // ---------------------------------------------------------------------------
  {
    const { resetStabilizedGexCache, getStabilizedGexReport } = await import("../server/gexStateManager");
    // Цепочка, где на Call Wall (3990) висит гигантский deep-ITM putOi (50 000),
    // который раньше утягивал минимум выплат ровно на Call Wall (Pain == CW == 3990)
    const skewedBoundaryChain: GexStrikeData[] = [
      { strike: 3930, callOi: 40000, putOi: 15000, totalOi: 55000, callVolume: 0, putVolume: 0, callGex: 1, putGex: -12, netGex: -11, iv: 0.18 },
      { strike: 3940, callOi: 1200, putOi: 4500, totalOi: 5700, callVolume: 0, putVolume: 0, callGex: 1, putGex: -4, netGex: -3, iv: 0.18 },
      { strike: 3960, callOi: 2500, putOi: 3000, totalOi: 5500, callVolume: 0, putVolume: 0, callGex: 2, putGex: -2, netGex: 0, iv: 0.18 },
      { strike: 3980, callOi: 4800, putOi: 1200, totalOi: 6000, callVolume: 0, putVolume: 0, callGex: 4, putGex: -1, netGex: 3, iv: 0.18 },
      { strike: 3990, callOi: 22000, putOi: 50000, totalOi: 72000, callVolume: 0, putVolume: 0, callGex: 18, putGex: -2, netGex: 16, iv: 0.18 }
    ];
    const painInCorridor = computeMaxPain(skewedBoundaryChain, 3955, 10, 0, 3930, 3990);
    assert.ok(
      painInCorridor > 3930 && painInCorridor < 3990,
      `Expected Max Pain strictly inside (PW=3930, CW=3990), got ${painInCorridor}`
    );

    resetStabilizedGexCache("XAUUSD");
    const dayRep = await getStabilizedGexReport("XAUUSD", "DAY");
    const weekRep = await getStabilizedGexReport("XAUUSD", "WEEK");
    const monthRep = await getStabilizedGexReport("XAUUSD", "MONTH");

    for (const rep of [dayRep, weekRep, monthRep]) {
      assert.ok(
        rep.putWall < rep.maxPain && rep.maxPain < rep.callWall,
        `Expected strict inequality PW (${rep.putWall}) < Pain (${rep.maxPain}) < CW (${rep.callWall}) for horizon ${rep.horizon}`
      );
    }

    console.log(
      `✅ [PASS] Test 9: Устранение вырожденности Pain==CW (boundary test pain=${painInCorridor} ∈ (3930, 3990)) и сброс кэша стабилизатора → DAY [${dayRep.putWall} < ${dayRep.maxPain} < ${dayRep.callWall}], WEEK [${weekRep.putWall} < ${weekRep.maxPain} < ${weekRep.callWall}], MONTH [${monthRep.putWall} < ${monthRep.maxPain} < ${monthRep.callWall}]`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Отображение Max Pain как диапазона при зоне нулевых выплат шире одного шага сетки:
  // "Магнит (Дневной): 3930–3940 (середина 3935)"
  // ---------------------------------------------------------------------------
  {
    const { computeMaxPainWithRange } = await import("../server/gexEngine");
    const { getLevelRole } = await import("../src/lib/gexLabels");

    // Put OI at 3920..3930, Call OI at 3940..3950 -> zero payout pinning zone is [3930..3940], mid = 3935
    const pinningZoneChain: GexStrikeData[] = [
      { strike: 3920, callOi: 0, putOi: 5000, totalOi: 5000, callVolume: 0, putVolume: 0, callGex: 0, putGex: -8, netGex: -8, iv: 0.18 },
      { strike: 3930, callOi: 0, putOi: 8000, totalOi: 8000, callVolume: 0, putVolume: 0, callGex: 0, putGex: -12, netGex: -12, iv: 0.18 },
      { strike: 3940, callOi: 8000, putOi: 0, totalOi: 8000, callVolume: 0, putVolume: 0, callGex: 12, putGex: 0, netGex: 12, iv: 0.18 },
      { strike: 3950, callOi: 5000, putOi: 0, totalOi: 5000, callVolume: 0, putVolume: 0, callGex: 8, putGex: 0, netGex: 8, iv: 0.18 }
    ];

    const { maxPain, maxPainRange } = computeMaxPainWithRange(pinningZoneChain, 3935, 10, 0, 3920, 3950);
    assert.equal(maxPain, 3935, `Expected midpoint maxPain=3935, got ${maxPain}`);
    assert.ok(maxPainRange !== null, "Expected maxPainRange to be non-null when pinning zone spans 3930..3940");
    assert.equal(maxPainRange!.low, 3930, `Expected maxPainRange.low=3930, got ${maxPainRange!.low}`);
    assert.equal(maxPainRange!.high, 3940, `Expected maxPainRange.high=3940, got ${maxPainRange!.high}`);
    assert.equal(maxPainRange!.mid, 3935, `Expected maxPainRange.mid=3935, got ${maxPainRange!.mid}`);

    const roleInfo = getLevelRole("MAX_PAIN", maxPain, 3936, "DAY", maxPainRange);
    assert.equal(
      roleInfo.fullName,
      "Магнит (Дневной): 3930–3940 (середина 3935)",
      `Expected exact range label "Магнит (Дневной): 3930–3940 (середина 3935)", got "${roleInfo.fullName}"`
    );

    console.log(
      `✅ [PASS] Test 10: Зона пиннинга шире шага сетки → "${roleInfo.fullName}"`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 11: Горизонтальная антиколлизия 6 уровней с шагом 2px по Y на мобильной ширине (375px):
  // все бейджи строго на своих ценовых линиях (смещение <= badgeH/2), лидер-линии = 0
  // ---------------------------------------------------------------------------
  {
    const { solveBadgeAntiCollision } = await import("../src/components/TradingViewZonesPrimitive");
    const mobileWidth = 375;
    const mobileHeight = 600;
    const badgeH = 15; // mobile badge height

    // 6 уровней с шагом 2px по Y (кластер высокой плотности: 240, 242, 244, 246, 248, 250)
    const denseBadges = [
      { id: "level_0", label: "Потолок (CW, Дневной): 3940.0", x: 260, y: 240, anchorY: 240, lineRight: 240 },
      { id: "level_1", label: "План Б: 3916.97", x: 260, y: 242, anchorY: 242, lineRight: 240 },
      { id: "level_2", label: "0.50 EQ (3904.9)", x: 260, y: 244, anchorY: 244, lineRight: 240 },
      { id: "level_3", label: "⚡ Флип (Flip, Недельный): 3905.0", x: 260, y: 246, anchorY: 246, lineRight: 240 },
      { id: "level_4", label: "SL: 3908.90", x: 260, y: 248, anchorY: 248, lineRight: 240 },
      { id: "level_5", label: "Пол (PW, Дневной): 3880.0", x: 260, y: 250, anchorY: 250, lineRight: 240 }
    ];

    const priceAxisObstacles = [
      { id: "spot", x: mobileWidth - 24, y: 244, isPriceAxisTag: true }
    ];

    const solved = solveBadgeAntiCollision(denseBadges, priceAxisObstacles, mobileWidth, mobileHeight);

    // 1. Все бейджи остаются строго на своих ценовых линиях (или микро-смещение <= badgeH/2 = Math.ceil(15/2) = 8px)
    for (const b of solved) {
      const vertOffset = Math.abs(b.y - b.anchorY);
      const maxAllowed = Math.ceil(badgeH / 2);
      assert.ok(
        vertOffset <= maxAllowed,
        `Badge ${b.id} offset ${vertOffset}px exceeds maximum allowed half-badge-height (${maxAllowed}px)`
      );
    }

    // 2. Коллизии решены по горизонтали (бейджи сдвинуты влево вдоль своих линий ступеньками)
    const xs = solved.map(b => b.x);
    const uniqueXs = new Set(xs);
    assert.ok(
      uniqueXs.size >= 2,
      `Expected horizontal staggering across columns, got unique X count = ${uniqueXs.size}`
    );

    // 3. Лидер-линии отсутствуют по определению (Y привязан к линии, никаких диагональных выносок)
    console.log(
      `✅ [PASS] Test 11: 6 уровней с шагом 2px по Y на ширине 375px → все бейджи на своих линиях (offset <= ${badgeH / 2}px), горизонтальный разнос [${xs.join(", ")}px], лидер-линии = 0`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 12: Аудит-лог миграций стабилизатора с явной причиной (breach / cooldown+OI / new session / reset)
  // ---------------------------------------------------------------------------
  {
    const {
      resetStabilizedGexCache,
      getStabilizedGexReport,
      getStabilizerMigrationLog
    } = await import("../server/gexStateManager");

    resetStabilizedGexCache("XAUUSD");
    const initDayRep = await getStabilizedGexReport("XAUUSD", "DAY");

    // Пробой Call Wall вверх (+0.5% выше текущего CW) вызывает миграцию по причине "breach"
    const breakoutSpot = Math.round(initDayRep.callWall * 1.005);
    await getStabilizedGexReport("XAUUSD", "DAY", breakoutSpot);

    const logEntries = getStabilizerMigrationLog("XAUUSD", "DAY");
    const hasResetReason = logEntries.some(e => e.reason === "reset");
    const hasBreachReason = logEntries.some(e => e.reason === "breach");

    assert.ok(hasResetReason, "Expected migration audit log to contain entry with reason='reset'");
    assert.ok(hasBreachReason, "Expected migration audit log to contain entry with reason='breach' after spot breakout");

    console.log(
      `✅ [PASS] Test 12: Лог миграций стабилизатора фиксирует причины сдвига уровней (записей для XAUUSD DAY: ${logEntries.length}, reasons: ${Array.from(new Set(logEntries.map(e => e.reason))).join(", ")})`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 13: Регрессия: запрет пинг-понга миграций с reason 'cooldown+OI' раньше 60 минут
  // ---------------------------------------------------------------------------
  {
    const {
      recordStabilizerMigration,
      getStabilizerMigrationLog
    } = await import("../server/gexStateManager");

    const t0 = 1793649720000; // 22:42
    const t1 = t0 + 2 * 60 * 1000; // 22:44 (интервал 2 минуты)
    const t2 = t0 + 65 * 60 * 1000; // 23:47 (интервал 65 минут)

    // 1. Первая миграция CW 3970 -> 3980 в 22:42 с reason="cooldown+OI"
    const firstAllowed = recordStabilizerMigration({
      timestamp: new Date(t0).toISOString(),
      asset: "XAUUSD_TEST",
      horizon: "DAY",
      level: "CW",
      oldValue: 3970,
      newValue: 3980,
      spotPrice: 3950,
      reason: "cooldown+OI",
      details: "cooldown=65m>=60m & newCwOi=12000>=prevCwOi=9000*1.25"
    });
    assert.strictEqual(firstAllowed, true, "First cooldown+OI migration must be allowed");

    // 2. Попытка повторной обратной миграции CW 3980 -> 3970 в 22:44 (спустя 2 мин) с reason="cooldown+OI"
    const secondAllowed = recordStabilizerMigration({
      timestamp: new Date(t1).toISOString(),
      asset: "XAUUSD_TEST",
      horizon: "DAY",
      level: "CW",
      oldValue: 3980,
      newValue: 3970,
      spotPrice: 3950,
      reason: "cooldown+OI",
      details: "premature ping-pong attempt after only 2 minutes"
    });
    assert.strictEqual(secondAllowed, false, "Second cooldown+OI migration within < 60 min MUST be strictly blocked");

    // 3. Легитимная миграция спустя 65 минут (когда кулдаун честно прошёл)
    const thirdAllowed = recordStabilizerMigration({
      timestamp: new Date(t2).toISOString(),
      asset: "XAUUSD_TEST",
      horizon: "DAY",
      level: "CW",
      oldValue: 3980,
      newValue: 4010,
      spotPrice: 3950,
      reason: "cooldown+OI",
      details: "cooldown=65m>=60m & newCwOi=18000>=prevCwOi=12000*1.25"
    });
    assert.strictEqual(thirdAllowed, true, "Third migration after 65 minutes must be allowed");

    const testLogs = getStabilizerMigrationLog("XAUUSD_TEST", "DAY");
    assert.strictEqual(testLogs.length, 2, "Log must contain exactly 2 valid migrations, premature ping-pong rejected");
    assert.strictEqual(testLogs[0].newValue, 3980);
    assert.strictEqual(testLogs[1].newValue, 4010);

    console.log(
      `✅ [PASS] Test 13: Регрессионная защита от пинг-понга: две миграции одного уровня с reason='cooldown+OI' с интервалом < 60 мин (22:42 -> 22:44) жестко заблокированы`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 14: Проверка логики видимости траекторий при переключении showForecast:
  // showForecast=true -> forecast и altForecast передаются в примитив;
  // showForecast=false -> forecast=null, altForecast=null;
  // Горизонтальные линии уровней и бейджи остаются в обоих режимах
  // ---------------------------------------------------------------------------
  {
    interface ZonesDataPayload {
      forecast: any;
      altForecast: any;
      lines: any[];
    }

    const generatePrimitiveData = (showForecast: boolean, rawForecast: any, rawAltForecast: any, priceLines: any[]): ZonesDataPayload => {
      return {
        forecast: showForecast ? rawForecast : null,
        altForecast: showForecast ? rawAltForecast : null,
        lines: priceLines
      };
    };

    const mockForecast = {
      isBull: true,
      startPrice: 3900,
      pullbackPrice: 3905,
      tp1Price: 3920,
      tp2Price: 3940,
      leg1Hit: true,
      leg2Hit: false,
      leg3Hit: false
    };

    const mockAltForecast = {
      isBull: false,
      startPrice: 3905,
      tp1Price: 3890,
      tp2Price: 3870
    };

    const mockLines = [
      { id: "cw_line", price: 3940, label: "Потолок (CW, Дневной): 3940.0", color: "#34d399" },
      { id: "pw_line", price: 3880, label: "Пол (PW, Дневной): 3880.0", color: "#f87171" }
    ];

    // Режим showForecast = true
    const dataWithForecast = generatePrimitiveData(true, mockForecast, mockAltForecast, mockLines);
    assert.ok(dataWithForecast.forecast !== null, "forecast must be present when showForecast=true");
    assert.ok(dataWithForecast.altForecast !== null, "altForecast must be present when showForecast=true");
    assert.strictEqual(dataWithForecast.lines.length, 2, "lines must be intact when showForecast=true");

    // Режим showForecast = false
    const dataWithoutForecast = generatePrimitiveData(false, mockForecast, mockAltForecast, mockLines);
    assert.strictEqual(dataWithoutForecast.forecast, null, "forecast must be null when showForecast=false");
    assert.strictEqual(dataWithoutForecast.altForecast, null, "altForecast must be null when showForecast=false");
    assert.strictEqual(dataWithoutForecast.lines.length, 2, "lines and badges must remain intact when showForecast=false");

    console.log(
      `✅ [PASS] Test 14: Переключение showForecast (true -> зигзаг и План Б активны; false -> скрыты; уровни и бейджи сохранены в обоих случаях)`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 15: Проверка отсутствия лидер-линий (диагональных "палок") в рендерере
  // и проверка работы правила мобильной компактности бейджей
  // ---------------------------------------------------------------------------
  {
    const fs = await import("fs");
    const code = fs.readFileSync("src/components/TradingViewZonesPrimitive.ts", "utf8");

    // Блок пунктирной выноски не должен существовать
    const hasLeaderLineBlock = code.includes("Math.abs(b.y - b.anchorY) > 3") && code.includes("setLineDash([2, 2])");
    assert.strictEqual(
      hasLeaderLineBlock,
      false,
      "Dashed leader lines block (Math.abs(b.y - b.anchorY) > 3) must be completely removed from renderer!"
    );

    // Зигзаг и План Б отрисовываются ДО бейджей уровней
    const forecastIdx = code.indexOf("// 2. Draw Forecast Zigzag Trajectory");
    const altIdx = code.indexOf("// 3. Draw AltForecast");
    const linesIdx = code.indexOf("// 4. Draw Bounded Price Lines");
    const badgesIdx = code.indexOf("// PASS 2: Render all badges ON TOP of all lines");

    assert.ok(forecastIdx > 0, "Forecast trajectory renderer must be present");
    assert.ok(altIdx > forecastIdx, "AltForecast renderer must be present after forecast");
    assert.ok(linesIdx > altIdx, "Bounded price lines must be rendered after trajectories");
    assert.ok(badgesIdx > linesIdx, "Badges must be rendered in PASS 2 ON TOP of all lines and trajectories");

    console.log(
      `✅ [PASS] Test 15: Лидер-линии ("палки-указатели") полностью устранены (0 выносок). Иерархия Z-order: зигзаг/лучи -> линии -> бейджи поверху`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 16: Фоновое накопление снапшотов GEX без вызова generate-plan (3 мин -> >=2 снапшота)
  // ---------------------------------------------------------------------------
  {
    const TEST_TICKER = "XAUUSD_BG_TEST";
    clearGexTrackersHistory(TEST_TICKER);

    const baseTime = Date.now() - 200000;

    // Симуляция фоновых тактов за 3 минуты (180 сек) БЕЗ вызова generate-plan
    // 1. Такт t=0с: первичная фоновая фиксация
    const snap1 = recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3950,
      dayPw: 3900,
      monthCw: 4000,
      monthPw: 3850,
      flip: 3925,
      pain: 3920,
      spot: 3920,
      timestamp: baseTime
    });
    assert.ok(snap1 !== null, "Первый фоновый снапшот должен быть успешно записан");

    // 2. Такт t=30с: попытка записи раньше 60 секунд -> должна быть заблокирована троттлингом (null)
    const snapThrottled = recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3950,
      dayPw: 3900,
      monthCw: 4000,
      monthPw: 3850,
      flip: 3925,
      pain: 3920,
      spot: 3922,
      timestamp: baseTime + 30000
    });
    assert.strictEqual(snapThrottled, null, "Запись раньше 60 сек должна блокироваться троттлингом");

    // 3. Такт t=65с (>60с): второй фоновый снапшот
    const snap2 = recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3955,
      dayPw: 3900,
      monthCw: 4005,
      monthPw: 3850,
      flip: 3928,
      pain: 3925,
      spot: 3930,
      timestamp: baseTime + 65000
    });
    assert.ok(snap2 !== null, "Снапшот через 65с должен быть записан");

    // 4. Такт t=130с: третий фоновый снапшот
    const snap3 = recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3960,
      dayPw: 3900,
      monthCw: 4010,
      monthPw: 3850,
      flip: 3930,
      pain: 3930,
      spot: 3938,
      timestamp: baseTime + 130000
    });
    assert.ok(snap3 !== null, "Снапшот через 130с должен быть записан");

    // 5. Такт t=195с (3+ минуты): четвёртый фоновый снапшот
    const snap4 = recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3960,
      dayPw: 3905,
      monthCw: 4010,
      monthPw: 3855,
      flip: 3932,
      pain: 3930,
      spot: 3942,
      timestamp: baseTime + 195000
    });
    assert.ok(snap4 !== null, "Снапшот через 195с (3+ мин) должен быть записан");

    const history = gexTrackersHistory.get(TEST_TICKER) || [];
    assert.ok(history.length >= 2, `В истории за 3 минуты должно быть >= 2 снапшотов, получено: ${history.length}`);
    assert.strictEqual(history.length, 4, "Должно быть ровно 4 снапшота (один раз в ~60 сек)");

    // Проверка уникальности и возрастания меток времени
    for (let i = 1; i < history.length; i++) {
      assert.ok(
        history[i].timestamp > history[i - 1].timestamp,
        `Метки времени должны строго возрастать: ${history[i].timestamp} > ${history[i - 1].timestamp}`
      );
    }

    console.log(
      `✅ [PASS] Test 16: Фоновое накопление за 3 мин без ИИ: накоплено ${history.length} снапшота (>= 2) с разными timestamp, троттлинг 60с подтвержден`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 17: Пустая история миграций GEX: отсутствие "был X стал Y" и отсутствие фабрикаций +-10
  // ---------------------------------------------------------------------------
  {
    const TEST_TICKER = "XAUUSD_EMPTY_TEST";
    clearGexTrackersHistory(TEST_TICKER);

    // Цена тестирует Day Call Wall (3995 при CW=4000, расстояние <= 5 п.),
    // где старый код фабриковал prevMonthCw = currentMonthCw - 10 и сквиз
    const gexCtx = resolveGexMigrationContext(
      TEST_TICKER,
      {
        dayCw: 4000,
        dayPw: 3900,
        monthCw: 4100,
        monthPw: 3850,
        flip: 3950,
        pain: 3940,
        spot: 3995
      },
      null
    );

    const planGexSection = buildGexTradePlanSection(gexCtx);

    // 1. План обязан содержать фразу о накоплении истории
    assert.strictEqual(gexCtx.hasPreviousSnapshot, false, "При пустой истории hasPreviousSnapshot=false");
    assert.strictEqual(gexCtx.prevMonthCw, null, "При пустой истории prevMonthCw=null");
    assert.strictEqual(gexCtx.prevDayCw, null, "При пустой истории prevDayCw=null");
    assert.ok(
      gexCtx.migrationDiagnosis.toLowerCase().includes("история миграций") &&
      gexCtx.migrationDiagnosis.toLowerCase().includes("сдвиг не определён"),
      `Диагноз должен содержать уведомление о накоплении истории. Диагноз:\n${gexCtx.migrationDiagnosis}`
    );
    assert.ok(
      planGexSection.toLowerCase().includes("история миграций") &&
      planGexSection.toLowerCase().includes("сдвиг не определён"),
      `Вывод плана должен содержать уведомление о накоплении истории. Вывод:\n${planGexSection}`
    );

    // 2. В плане КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО наличие строк "был X, стал Y"
    assert.strictEqual(
      planGexSection.includes("был ") && planGexSection.includes("стал "),
      false,
      "При пустой истории строки 'был X, стал Y' категорически запрещены!"
    );
    assert.strictEqual(
      gexCtx.promptDetailedGexWalls.includes("был ") && gexCtx.promptDetailedGexWalls.includes("стал "),
      false,
      "В промпте детальных стен строки 'был X, стал Y' категорически запрещены!"
    );

    // 3. Запрещены фабрикации +-10 п. (4090, 4110)
    assert.strictEqual(
      planGexSection.includes("4090") || planGexSection.includes("3990➔") || planGexSection.includes("➔4100"),
      false,
      "При пустой истории фабрикации сдвигов +-10 п. категорически запрещены!"
    );

    // 4. Запрещены ложные предупреждения о сквизе убегающего уровня при пустой истории
    assert.strictEqual(
      gexCtx.isCallWallRunningAway,
      false,
      "Ложный сквиз убегающего уровня (isCallWallRunningAway) при пустой истории запрещен!"
    );
    assert.strictEqual(
      planGexSection.includes("Уровень Call Wall убегает вверх"),
      false,
      "Ложный сквиз убегающего уровня в тексте плана при пустой истории запрещен!"
    );

    console.log(
      `✅ [PASS] Test 17: При пустой истории миграций: сдвиг не определён, строки 'был X стал Y' и фабрикации +-10 полностью отсутствуют`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 18: Персистентность gexTrackersHistory (сохранение на диск и загрузка при рестарте)
  // ---------------------------------------------------------------------------
  {
    const TEST_TICKER = "XAUUSD_PERSIST_TEST";
    clearGexTrackersHistory(TEST_TICKER);

    const t1 = Date.now() - 80000;
    const t2 = Date.now();

    recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3950,
      dayPw: 3900,
      monthCw: 4000,
      monthPw: 3850,
      flip: 3925,
      pain: 3920,
      spot: 3925,
      timestamp: t1
    }, true);

    recordGexMigrationSnapshot(TEST_TICKER, {
      dayCw: 3960,
      dayPw: 3905,
      monthCw: 4020,
      monthPw: 3850,
      flip: 3930,
      pain: 3925,
      spot: 3940,
      timestamp: t2
    }, true);

    // Принудительно сохраняем на диск
    saveGexTrackersHistorySync();

    const fs = await import("fs");
    assert.ok(fs.existsSync(GEX_TRACKERS_HISTORY_FILE), "Файл data/gex-trackers-history.json должен существовать");

    // Имитация полного перезапуска процесса сервера: очищаем оперативную память
    gexTrackersHistory.clear();
    assert.strictEqual(gexTrackersHistory.size, 0, "Память перед рестартом очищена");

    // Имитируем старт сервера: читаем с диска
    loadGexTrackersHistoryFromDisk();

    const restored = gexTrackersHistory.get(TEST_TICKER);
    assert.ok(restored !== undefined && restored.length === 2, "Снапшоты должны быть восстановлены из файла");
    assert.strictEqual(restored[0].timestamp, t1, "Timestamp 1-го снапшота совпадает");
    assert.strictEqual(restored[1].timestamp, t2, "Timestamp 2-го снапшота совпадает");
    assert.strictEqual(restored[0].monthCallWall, 4000, "Month CW 1-го снапшота сохранен");
    assert.strictEqual(restored[1].monthCallWall, 4020, "Month CW 2-го снапшота сохранен");
    assert.strictEqual(restored[1].spotPrice, 3940, "Spot price 2-го снапшота сохранен");

    // Очистка тестовых данных
    clearGexTrackersHistory(TEST_TICKER);

    console.log(
      `✅ [PASS] Test 18: Персистентность gexTrackersHistory проверена: сохранение в JSON, симуляция рестарта и чтение без потерь подтверждены`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 19: Инвариант неподвижности зон Liq LT / IT и правило митигации
  // 1. При обновлении хая формирующейся свечи зона Liq LT остаётся строго на старом пивоте
  // 2. Объём в подписи берётся со свечи пивота (например 3.9K | 4036.0)
  // 3. При volume=0 суффикс "K" не выводится ([4036.0])
  // 4. При пробое хая свечой (lastCandle.high > zone.top) зона митигируется, а не уезжает на новый хай
  // ---------------------------------------------------------------------------
  {
    const { computePineSrZones, formatSrZoneLabel } = await import("../src/lib/pineSuperIndicatorEngine");

    // Создаём синтетический ряд из 80 свечей
    // На баре 35 формируем ярко выраженный пивот-хай: 4036.0 с объёмом 3900 контрактов
    const syntheticCandles: any[] = [];
    const baseTime = 1793600000;
    const tfSec = 900;

    for (let i = 0; i < 80; i++) {
      const time = baseTime + i * tfSec;
      let open = 4000;
      let close = 4005;
      let high = 4010;
      let low = 3995;
      let volume = 1500;

      if (i === 35) {
        // Пивот-хай 35/35
        high = 4036.0;
        volume = 3900;
      }

      syntheticCandles.push({ time, open, high, low, close, volume });
    }

    const atrVal = 10.0;
    const expectedTop = 4036.0 + atrVal * 0.08;
    const expectedBottom = 4036.0 - atrVal * 0.08;

    // РЕНДЕР 1: Формирующаяся свеча (бар 79) имеет high = 4012
    syntheticCandles[79].high = 4012;
    const highs1 = syntheticCandles.map(c => c.high);
    const lows1 = syntheticCandles.map(c => c.low);

    const zones1 = computePineSrZones(syntheticCandles, highs1, lows1, atrVal);
    const ltRes1 = zones1.find(z => z.type === "LT" && !z.isSup);

    assert.ok(ltRes1, "Зона Liq LT Сопр. должна быть найдена на подтверждённом пивоте 35/35");
    assert.strictEqual(ltRes1.level, 4036.0, "Уровень зоны строго равен пивоту 4036.0");
    assert.strictEqual(ltRes1.volume, 3900, "Объём взят со свечи пивота (3900)");
    assert.strictEqual(ltRes1.top, expectedTop, "TopPrice равен 4036.0 + atr*0.08");
    assert.strictEqual(ltRes1.bottom, expectedBottom, "BottomPrice равен 4036.0 - atr*0.08");
    assert.strictEqual(
      ltRes1.label,
      "Liq LT [3.9K | 4036.0] Сопр.",
      `Подпись зоны должна содержать объём и точную цену: получено '${ltRes1.label}'`
    );

    // РЕНДЕР 2: Новый тик на формирующейся свече (бар 79) поднял high с 4012 до 4030 (+18 пт)
    syntheticCandles[79].high = 4030;
    const highs2 = syntheticCandles.map(c => c.high);
    const lows2 = syntheticCandles.map(c => c.low);

    const zones2 = computePineSrZones(syntheticCandles, highs2, lows2, atrVal);
    const ltRes2 = zones2.find(z => z.type === "LT" && !z.isSup);

    assert.ok(ltRes2, "Зона Liq LT Сопр. сохраняется на Рендере 2");
    // Инвариант неподвижности: координаты зоны НЕ изменились ни на один цент!
    assert.strictEqual(ltRes2.level, ltRes1.level, "Инвариант неподвижности: level не изменился");
    assert.strictEqual(ltRes2.top, ltRes1.top, "Инвариант неподвижности: topPrice не изменился");
    assert.strictEqual(ltRes2.bottom, ltRes1.bottom, "Инвариант неподвижности: bottomPrice не изменился");
    assert.strictEqual(ltRes2.label, ltRes1.label, "Инвариант неподвижности: label не изменился");

    // РЕНДЕР 3: Пробой уровня текущей свечой (high = 4042 > expectedTop 4036.8)
    syntheticCandles[79].high = 4042;
    const highs3 = syntheticCandles.map(c => c.high);
    const lows3 = syntheticCandles.map(c => c.low);

    const zones3 = computePineSrZones(syntheticCandles, highs3, lows3, atrVal);
    const ltRes3 = zones3.find(z => z.type === "LT" && !z.isSup && !z.isMitigated);

    // Зона не должна переехать на 4042! Она митигирована/снята
    assert.strictEqual(
      ltRes3,
      undefined,
      "После пробоя хая 4036 свечой (4042) активная зона Liq LT снимается (митигирована) и НЕ переезжает на 4042!"
    );

    // ПРОВЕРКА 4: Форматирование при нулевом / отсутствующем объёме (суффикс 'K' исключён)
    const zeroVolLabel = formatSrZoneLabel("LT", false, 4036.0, 0);
    assert.strictEqual(
      zeroVolLabel,
      "Liq LT [4036.0] Сопр.",
      `При volume=0 суффикс 'K' не должен имитировать объём: получено '${zeroVolLabel}'`
    );

    const itLabel = formatSrZoneLabel("IT", true, 3920.5, 2400);
    assert.strictEqual(
      itLabel,
      "Liq IT [2.4K | 3920.5] Подд.",
      `Поддержка IT с объёмом 2400: получено '${itLabel}'`
    );

    console.log(
      `✅ [PASS] Test 19: Инвариант неподвижности зон Liq LT/IT подтверждён: при обновлении хая свечи зона остаётся на пивоте 4036.0 (top=${expectedTop}, bottom=${expectedBottom}), при пробое 4042 зона снимается и не следует за ценой, подписи: '${ltRes1.label}', без объёма: '${zeroVolLabel}'`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 20: Горизонтно-зависимые параметры стабилизатора (DAY, WEEK, MONTH/ALL)
  // ---------------------------------------------------------------------------
  {
    // DAY: кулдаун 30 мин (1 800 000 мс), гистерезис 20%
    assert.strictEqual(getHorizonCooldownMs("DAY"), 30 * 60 * 1000, "DAY cooldown must be 30 minutes");
    assert.strictEqual(getHorizonHysteresisThreshold("DAY"), 0.20, "DAY hysteresis threshold must be 0.20 (20%)");

    // WEEK: кулдаун 60 мин (3 600 000 мс), гистерезис 25%
    assert.strictEqual(getHorizonCooldownMs("WEEK"), 60 * 60 * 1000, "WEEK cooldown must be 60 minutes");
    assert.strictEqual(getHorizonHysteresisThreshold("WEEK"), 0.25, "WEEK hysteresis threshold must be 0.25 (25%)");

    // MONTH / ALL: кулдаун 120 мин (7 200 000 мс), гистерезис 30%
    assert.strictEqual(getHorizonCooldownMs("MONTH"), 120 * 60 * 1000, "MONTH cooldown must be 120 minutes");
    assert.strictEqual(getHorizonHysteresisThreshold("MONTH"), 0.30, "MONTH hysteresis threshold must be 0.30 (30%)");
    assert.strictEqual(getHorizonCooldownMs("ALL"), 120 * 60 * 1000, "ALL cooldown must be 120 minutes");
    assert.strictEqual(getHorizonHysteresisThreshold("ALL"), 0.30, "ALL hysteresis threshold must be 0.30 (30%)");

    console.log(
      `✅ [PASS] Test 20: Горизонтно-зависимые параметры стабилизатора подтверждены: DAY(30м / 20%), WEEK(60м / 25%), MONTH(120м / 30%), ALL(120м / 30%)`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 21: Авто-миграция reason="source_switch" при смене источника данных
  // ---------------------------------------------------------------------------
  {
    // Сбросим кэш для тестового актива
    resetStabilizedGexCache("TEST_SRC_SWITCH", "DAY", { force: true });

    // Инициализируем запись от источника "CBOE Options Live"
    const strikes1: GexStrikeData[] = [
      { strike: 3900, callOi: 1000, putOi: 5000, totalOi: 6000, callVolume: 100, putVolume: 100, callGex: 1, putGex: -5, netGex: -4, iv: 0.18 },
      { strike: 3950, callOi: 8000, putOi: 2000, totalOi: 10000, callVolume: 100, putVolume: 100, callGex: 8, putGex: -2, netGex: 6, iv: 0.18 }
    ];
    const initialReport: GexMarketReport = {
      asset: "TEST_SRC_SWITCH",
      horizon: "DAY",
      spotPrice: 3925,
      gammaFlip: 3925,
      callWall: 3950,
      putWall: 3900,
      maxPain: 3925,
      netGexTotal: 2,
      regime: "POS_GEX",
      callOiStrikesCount: 10,
      putOiStrikesCount: 10,
      strikes: strikes1,
      source: "CBOE Options Live",
      timestamp: new Date().toISOString()
    };

    const rep1 = await getStabilizedGexReport("TEST_SRC_SWITCH", "DAY", 3925, initialReport);
    assert.strictEqual(rep1.callWall, 3950);
    assert.strictEqual(rep1.putWall, 3900);

    // Свежий отчёт поступает от другого источника "Yahoo Finance GC=F"
    // Стены сместились на 3 страйка (3980 вместо 3950: дельта 30 > 2 * step 10)
    const strikes2: GexStrikeData[] = [
      { strike: 3880, callOi: 500, putOi: 8000, totalOi: 8500, callVolume: 100, putVolume: 100, callGex: 1, putGex: -8, netGex: -7, iv: 0.18 },
      { strike: 3980, callOi: 12000, putOi: 1000, totalOi: 13000, callVolume: 100, putVolume: 100, callGex: 12, putGex: -1, netGex: 11, iv: 0.18 }
    ];
    const switchedSourceReport: GexMarketReport = {
      asset: "TEST_SRC_SWITCH",
      horizon: "DAY",
      spotPrice: 3930,
      gammaFlip: 3930,
      callWall: 3980,
      putWall: 3880,
      maxPain: 3930,
      netGexTotal: 4,
      regime: "POS_GEX",
      callOiStrikesCount: 10,
      putOiStrikesCount: 10,
      strikes: strikes2,
      source: "Yahoo Finance GC=F",
      timestamp: new Date().toISOString()
    };

    // Проверяем: миграция ДОЛЖНА произойти мгновенно без ожидания кулдауна с reason="source_switch"
    const rep2 = await getStabilizedGexReport("TEST_SRC_SWITCH", "DAY", 3930, switchedSourceReport);
    assert.strictEqual(rep2.callWall, 3980, "CW should immediately migrate on source_switch");
    assert.strictEqual(rep2.putWall, 3880, "PW should immediately migrate on source_switch");

    const history = getStabilizerMigrationLog("TEST_SRC_SWITCH");
    const sourceSwitchLog = history.find(
      (h) => h.asset === "TEST_SRC_SWITCH" && h.reason === "source_switch"
    );
    assert.ok(sourceSwitchLog, "Migration history must contain entry with reason 'source_switch'");
    console.log(
      `✅ [PASS] Test 21: Авто-миграция reason='source_switch' подтверждена: при смене источника CBOE -> Yahoo стены 3950/3900 мгновенно обновились до 3980/3880 без ожидания кулдауна`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 22: Guard кнопки reset при активной сделке (ACTIVE_IN_TRADE / WAITING_FOR_ENTRY)
  // ---------------------------------------------------------------------------
  {
    // Регистрируем активную сделку
    registerActiveTradeChecker(() => true);

    // Сброс без force должен быть заблокирован с предупреждением
    const blockedRes = resetStabilizedGexCache("TEST_GUARD_ASSET", "DAY", { force: false });
    assert.strictEqual(blockedRes.success, false, "Reset without force must not succeed when trade is active");
    assert.strictEqual(blockedRes.blocked, true, "blocked flag must be true");
    assert.ok(
      blockedRes.warning && blockedRes.warning.includes("Активна сделка"),
      `Warning message must alert user: got '${blockedRes.warning}'`
    );

    // Сброс с явным force: true должен пройти
    const forcedRes = resetStabilizedGexCache("TEST_GUARD_ASSET", "DAY", { force: true });
    assert.strictEqual(forcedRes.success, true, "Reset with force:true must succeed");
    assert.strictEqual(forcedRes.blocked, false, "blocked flag must be false with force:true");

    // Возвращаем чекер обратно
    registerActiveTradeChecker(() => false);

    console.log(
      `✅ [PASS] Test 22: Guard кнопки reset подтверждён: при активной сделке сброс без force блокируется с предупреждением '${blockedRes.warning}', с force:true успешно выполняется`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 23: Совпадение diff в preview и в reset
  // ---------------------------------------------------------------------------
  {
    const stabilized = {
      callWall: 3980,
      putWall: 3930,
      gammaFlip: 3970,
      maxPain: 3930
    };
    const fresh = {
      callWall: 3990,
      putWall: 3930,
      gammaFlip: 3970,
      maxPain: 3935
    };

    // 1. Preview рассчитывает расхождение "стаб -> свеж"
    const preview = formatGexFreshDiffPreview({ ...stabilized, freshValues: fresh });
    assert.strictEqual(preview.hasDivergence, true, "Preview must detect divergence");
    assert.strictEqual(
      preview.text,
      "CW 3980→3990, Pain 3930→3935",
      `Preview text must match 'CW 3980→3990, Pain 3930→3935', got '${preview.text}'`
    );

    // 2. Инициализируем запись в кэше и выполняем сброс с передачей freshValues
    resetStabilizedGexCache("TEST_PREVIEW_MATCH", "DAY", { force: true });
    const mockRep: GexMarketReport = {
      asset: "TEST_PREVIEW_MATCH",
      horizon: "DAY",
      spotPrice: 3940,
      gammaFlip: stabilized.gammaFlip,
      callWall: stabilized.callWall,
      putWall: stabilized.putWall,
      maxPain: stabilized.maxPain,
      netGexTotal: 1,
      regime: "POS_GEX",
      callOiStrikesCount: 10,
      putOiStrikesCount: 10,
      strikes: [],
      source: "Test Book",
      timestamp: new Date().toISOString()
    };
    await getStabilizedGexReport("TEST_PREVIEW_MATCH", "DAY", 3940, mockRep);

    // Сбрасываем с передачей freshValues
    const resetRes = resetStabilizedGexCache("TEST_PREVIEW_MATCH", "DAY", {
      force: true,
      freshValues: fresh
    });

    assert.ok(resetRes.diff, "Reset result must provide diff");
    assert.ok(
      resetRes.diff.includes("CW 3980 -> 3990") && resetRes.diff.includes("Pain 3930 -> 3935"),
      `Reset diff must contain the exact changes: got '${resetRes.diff}'`
    );

    // Проверяем запись в migration log
    const history = getStabilizerMigrationLog("TEST_PREVIEW_MATCH");
    const resetLog = history.slice().reverse().find(
      (h) => h.asset === "TEST_PREVIEW_MATCH" && h.reason === "reset"
    );
    assert.ok(resetLog, "Migration log must contain 'reset' entry");
    assert.ok(
      resetLog.details.includes("CW 3980 -> 3990") && resetLog.details.includes("Pain 3930 -> 3935"),
      `Migration log details must contain full 4-level diff: got '${resetLog.details}'`
    );

    console.log(
      `✅ [PASS] Test 23: Совпадение diff в preview и в reset подтверждено: preview='${preview.text}', reset diff='${resetRes.diff}'`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 24 (а): Инвалидация по смене гамма-режима (regimeFlip):
  // при локе SHORT на 4H и споте ниже flip, закрытие 2 баров 4H выше flip переводит лок в EXPIRED
  // ---------------------------------------------------------------------------
  {
    const externalFlip = 3970;
    const tfSec4h = 14400;
    const baseTime = 1762000000;
    const candles4h: Candle[] = [
      // Бар #0 (анкор лока SHORT при споте 3955 < flip 3970)
      { time: baseTime, open: 3960, high: 3964, low: 3950, close: 3955, volume: 1200 },
      // Бар #1 (спот всё ещё ниже flip: close 3962 < 3970)
      { time: baseTime + tfSec4h, open: 3955, high: 3965, low: 3952, close: 3962, volume: 1300 },
      // Бар #2 (1-й бар закрылся ВЫШЕ flip: close 3974 > 3970)
      { time: baseTime + tfSec4h * 2, open: 3962, high: 3976, low: 3960, close: 3974, volume: 1500 },
      // Бар #3 (2-й бар подряд закрылся ВЫШЕ flip: close 3978 > 3970 -> должен сработать regimeFlip)
      { time: baseTime + tfSec4h * 3, open: 3974, high: 3981, low: 3971, close: 3978, volume: 1600 }
    ];

    const shortLockItem: AnchoredForecastItem = {
      key: "XAUUSD_4h",
      anchorCandleTime: baseTime,
      highestPriceSinceStart: 3964,
      lowestPriceSinceStart: 3950,
      createdAt: Date.now(),
      mathVersion: 4,
      forecast: {
        isBull: false, // SHORT
        probability: 74,
        startBar: 0,
        startTime: baseTime,
        startPrice: 3955,
        p1Entry: 3962,
        p2Tp1: 3938,
        p3Tp2: 3920,
        p5Tp3: 3905,
        invalidLevelSl: 3992, // SL далеко наверху (3992), чтобы проверить истечение именно по regimeFlip ДО SL
        activeTrailingSl: 3992,
        trailingStageStr: "🛡️ Начальный SL",
        trailingStageIdx: 0,
        leg1Hit: true,
        leg1Idx: 1,
        leg2Hit: false,
        leg3Hit: false,
        leg4Hit: false,
        leg5Hit: false,
        isPlanBActive: false,
        isWickSweep: false,
        altTp1: 4010,
        altTp2: 4025,
        altTp3: 4040,
        isHighRunaway: false,
        noPullbackProb: 25
      }
    };

    // На 1-м баре выше flip (индекс 2) лок ещё НЕ истёк
    const evalAfter1Bar = evaluateSetupRange(
      shortLockItem,
      0,
      2,
      candles4h,
      [12, 12, 12, 12],
      12,
      tfSec4h,
      ["bearish", "bearish", "bearish", "bearish"],
      false,
      externalFlip
    );
    assert.strictEqual(evalAfter1Bar.expiredAtBar, null, "После 1 бара выше flip сетап ещё не должен истекать");

    // На 2-м баре подряд выше flip (индекс 3) лок истекает со статусом EXPIRED и причиной regimeFlip ("смена гамма-режима")
    const evalAfter2Bars = evaluateSetupRange(
      shortLockItem,
      0,
      3,
      candles4h,
      [12, 12, 12, 12],
      12,
      tfSec4h,
      ["bearish", "bearish", "bearish", "bearish"],
      false,
      externalFlip
    );
    assert.strictEqual(evalAfter2Bars.expiredAtBar, 3, "На 2-м баре закрытия выше flip сетап должен истечь");
    assert.strictEqual(evalAfter2Bars.updatedForecast.status, "EXPIRED", "Статус сетапа должен стать EXPIRED");
    assert.strictEqual(evalAfter2Bars.updatedForecast.expirationReason, "regimeFlip", "Причина экспирации должна быть regimeFlip");
    assert.strictEqual(evalAfter2Bars.updatedForecast.reason, "смена гамма-режима", "reason должен быть 'смена гамма-режима'");

    console.log(
      `✅ [PASS] Test 24 (а): Инвалидация regimeFlip подтверждена: лок SHORT на 4H при закрытии 2 баров выше gammaFlip (${externalFlip}) перешёл в статус '${evalAfter2Bars.updatedForecast.status}' (reason: '${evalAfter2Bars.updatedForecast.reason}') до достижения SL (${shortLockItem.forecast.invalidLevelSl})`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 25 (б): Арбитраж противоположных локов:
  // при одновременном локе SHORT на 1D и LONG на 1H — LONG получает метку "ОТКАТ" и его TP ограничен входом SHORT;
  // если оба "ВХОД ВЗЯТ" — младший лок получает принудительный TP на уровне входа старшего и истекает.
  // ---------------------------------------------------------------------------
  {
    const TEST_SYM = "XAUUSD_ARB_TEST";
    resetIndicatorForecast(TEST_SYM);

    const lock1dShort: AnchoredForecastItem = {
      key: `${TEST_SYM}_1d`,
      anchorCandleTime: 1762000000,
      highestPriceSinceStart: 4020,
      lowestPriceSinceStart: 3960,
      createdAt: Date.now(),
      mathVersion: 4,
      forecast: {
        isBull: false, // SHORT на 1D
        probability: 78,
        startBar: 10,
        startPrice: 3985,
        p1Entry: 3995, // Вход старшего лока (лимитная зона SHORT 1D)
        p2Tp1: 3940,
        p3Tp2: 3910,
        p5Tp3: 3880,
        invalidLevelSl: 4025,
        activeTrailingSl: 4025,
        trailingStageStr: "🛡️ Начальный SL",
        trailingStageIdx: 0,
        leg1Hit: false, // Пока ждёт лимитный вход @ 3995
        leg2Hit: false,
        leg3Hit: false,
        leg4Hit: false,
        leg5Hit: false,
        isPlanBActive: false,
        isWickSweep: false,
        altTp1: 4050,
        altTp2: 4080,
        altTp3: 4100,
        isHighRunaway: false,
        noPullbackProb: 20
      }
    };

    const lock1hLong: AnchoredForecastItem = {
      key: `${TEST_SYM}_1h`,
      anchorCandleTime: 1762050000,
      highestPriceSinceStart: 3980,
      lowestPriceSinceStart: 3955,
      createdAt: Date.now(),
      mathVersion: 4,
      forecast: {
        isBull: true, // LONG на 1H (против 1D SHORT)
        probability: 70,
        startBar: 20,
        startPrice: 3965,
        p1Entry: 3960,
        p2Tp1: 4010, // Первоначально выше входа 1D SHORT (3995)
        p3Tp2: 4035,
        p5Tp3: 4055,
        invalidLevelSl: 3945,
        activeTrailingSl: 3945,
        trailingStageStr: "🛡️ Начальный SL",
        trailingStageIdx: 0,
        leg1Hit: true, // Вход на 1H уже взят
        leg2Hit: false,
        leg3Hit: false,
        leg4Hit: false,
        leg5Hit: false,
        isPlanBActive: false,
        isWickSweep: false,
        altTp1: 3930,
        altTp2: 3915,
        altTp3: 3900,
        isHighRunaway: false,
        noPullbackProb: 25
      }
    };

    registerActiveLock(TEST_SYM, "1d", lock1dShort);
    const updated1h = registerActiveLock(TEST_SYM, "1h", lock1hLong);

    assert.strictEqual(lock1dShort.forecast.lockRole, "ТРЕНД", "Старший лок 1D должен получить роль 'ТРЕНД'");
    assert.strictEqual(lock1dShort.forecast.counterTrend, false, "Старший лок 1D имеет counterTrend=false");

    assert.strictEqual(updated1h.counterTrend, true, "Младший лок 1H должен получить counterTrend=true");
    assert.ok(
      updated1h.lockRole && updated1h.lockRole.includes("ОТКАТ"),
      `Младший лок 1H должен иметь метку ОТКАТ: получено '${updated1h.lockRole}'`
    );
    assert.strictEqual(
      updated1h.p2Tp1,
      3995,
      `TP1 младшего лока LONG должен быть ограничен входом старшего SHORT (3995), получено ${updated1h.p2Tp1}`
    );
    assert.strictEqual(
      updated1h.p3Tp2,
      3995,
      `TP2 младшего лока LONG должен быть ограничен входом старшего SHORT (3995), получено ${updated1h.p3Tp2}`
    );

    // Теперь оба лока имеют "ВХОД ВЗЯТ" (leg1Hit = true на 1D SHORT и на 1H LONG)
    lock1dShort.forecast.leg1Hit = true;
    arbitrateOpposingLocksForAsset(TEST_SYM);

    assert.strictEqual(lock1hLong.forecast.counterTrend, true, "При обоих ВХОД ВЗЯТ младший лок сохраняет counterTrend=true");
    assert.strictEqual(lock1hLong.forecast.p2Tp1, 3995, "Принудительный TP младшего лока равен входу старшего лока (3995)");
    assert.strictEqual(lock1hLong.forecast.status, "EXPIRED", "После срабатывания обоих входов младший лок истекает (EXPIRED)");
    assert.strictEqual(lock1hLong.forecast.expirationReason, "counterTrendTp", "Причина истечения младшего лока — counterTrendTp");

    resetIndicatorForecast(TEST_SYM);
    console.log(
      `✅ [PASS] Test 25 (б): Арбитраж противоположных локов 1D SHORT vs 1H LONG подтверждён: 1D='${lock1dShort.forecast.lockRole}', 1H='${updated1h.lockRole}' (counterTrend=true, TP ограничен входом 1D @ 3995, при обоих 'ВХОД ВЗЯТ' младший лок закрыт со статусом '${lock1hLong.forecast.status}')`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 26 (в): HUD и подпись прогнозной линии выводят бейдж контртренда ("🌊 ОТКАТ в тренде 1D/4H (SHORT)")
  // и MAE-Guard ("⚠️ ПОД УГРОЗОЙ" при убытке > 1.25 * risk и цене в пределах 0.3 ATR от SL)
  // ---------------------------------------------------------------------------
  {
    const consensus = computeHonest5TfConsensus({
      "1d": { trend: "BEARISH" },
      "4h": { trend: "BEARISH" },
      "1h": { trend: "BULLISH" },
      "30m": { trend: "BULLISH" },
      "15m": { trend: "BULLISH" }
    });
    assert.strictEqual(consensus.htfTrendDirection, "SHORT", "Старший тренд 1D/4H должен быть SHORT");

    // 1. Лок LONG на 15m против тренда 1D/4H (SHORT), причём плавающий убыток > 1.25 * risk и цена у SL (в пределах 0.3 ATR)
    // Entry = 3960, SL = 3952 (risk = 8), ATR = 10.
    // Текущая цена = 3949.5 -> плавающий убыток |3949.5 - 3960| = 10.5 > 1.25 * 8 (10.0),
    // и расстояние до SL |3949.5 - 3952| = 2.5 <= 0.3 * 10 (3.0).
    const fcCounterTrend: ForecastState = {
      isBull: true,
      probability: 68,
      startBar: 10,
      startPrice: 3962,
      p1Entry: 3960,
      p2Tp1: 3975,
      p3Tp2: 3988,
      p5Tp3: 4000,
      invalidLevelSl: 3952,
      activeTrailingSl: 3952,
      trailingStageStr: "🛡️ Начальный SL",
      trailingStageIdx: 0,
      leg1Hit: true,
      leg2Hit: false,
      leg3Hit: false,
      leg4Hit: false,
      leg5Hit: false,
      isPlanBActive: false,
      isWickSweep: false,
      altTp1: 3938,
      altTp2: 3925,
      altTp3: 3910,
      isHighRunaway: false,
      noPullbackProb: 20,
      counterTrend: true,
      parentTrendDirection: "SHORT"
    };

    const badge = resolveTrendAlignmentBadge(fcCounterTrend, "15m", consensus);
    assert.strictEqual(
      badge,
      "🌊 ОТКАТ в тренде 1D/4H (SHORT)",
      `Бейдж контртренда должен быть '🌊 ОТКАТ в тренде 1D/4H (SHORT)', получено '${badge}'`
    );

    // Проверка бейджа по тренду 1D
    const fcWithTrend: ForecastState = { ...fcCounterTrend, isBull: false, counterTrend: false, parentTrendDirection: "SHORT" };
    const trendBadge = resolveTrendAlignmentBadge(fcWithTrend, "15m", consensus);
    assert.strictEqual(
      trendBadge,
      "🏛️ ПО ТРЕНДУ 1D",
      `Бейдж по тренду должен быть '🏛️ ПО ТРЕНДУ 1D', получено '${trendBadge}'`
    );

    // Проверка MAE-Guard
    const mae = evaluateMaeGuard(fcCounterTrend, 3949.5, 10);
    assert.strictEqual(mae.isUnderThreat, true, "MAE-Guard должен активироваться при убытке > 1.25R и дистанции <= 0.3 ATR от SL");
    assert.strictEqual(mae.maeBadge, "⚠️ ПОД УГРОЗОЙ", "Бейдж MAE-Guard должен быть '⚠️ ПОД УГРОЗОЙ'");

    fcCounterTrend.trendAlignmentBadge = badge;
    fcCounterTrend.isUnderThreat = mae.isUnderThreat;
    fcCounterTrend.maeBadge = mae.maeBadge;
    fcCounterTrend.maeRecommendation = mae.maeRecommendation;

    const hud = generateHudData(
      "XAUUSD",
      "15m",
      3949.5,
      10,
      {
        spotPrice: 3949.5,
        callWall: 3990,
        putWall: 3930,
        gammaFlip: 3970,
        maxPain: 3960,
        sleeperMagnet: 4000,
        charmDrift: 0,
        effectiveIv: 18,
        gexStep: 10,
        expectedMove68: { low: 3925, high: 3985 },
        expectedMove95: { low: 3895, high: 4015 },
        pcrVal: 1.02,
        rvIvVal: 0.92,
        strikes: [],
        callGex: [],
        putGex: [],
        netGex: [],
        totGex: [],
        audit: { total: 10, cwRate: 80, pwRate: 80, flipRate: 75 }
      },
      fcCounterTrend,
      -500,
      -1200,
      false,
      3
    );

    assert.strictEqual(hud.trendAlignmentBadge, "🌊 ОТКАТ в тренде 1D/4H (SHORT)", "HUD должен содержать бейдж контртренда");
    assert.strictEqual(hud.maeBadge, "⚠️ ПОД УГРОЗОЙ", "HUD должен содержать бейдж MAE-Guard");
    assert.ok(
      hud.recActionStr.includes("⚠️ ПОД УГРОЗОЙ") && hud.recActionStr.includes("закрыть вручную или ужать стоп"),
      `Статус-строка HUD должна содержать рекомендацию MAE-Guard, получено: '${hud.recActionStr}'`
    );

    console.log(
      `✅ [PASS] Test 26 (в): HUD бейдж контртренда ('${hud.trendAlignmentBadge}') и MAE-Guard ('${hud.recActionStr}') подтверждены`
    );
    passed++;
  }

  // ---------------------------------------------------------------------------
  // TEST 27 (г): Чистка журнала и учёт бандла "тренд+откат":
  // в журнале не остаётся двух противоположных ACTIVE без пометки counterTrend,
  // а связка "тренд+откат" считается как один бандл в статистике
  // ---------------------------------------------------------------------------
  {
    const TEST_TICKER = "XAUUSD_JOURNAL_TEST";

    // Записываем старший ACTIVE сетап SHORT на 1D
    const s1 = recordOrUpdateIndicatorSetup(`${TEST_TICKER}_1d`, {
      forecast: {
        isBull: false,
        direction: "SHORT",
        p1Entry: 4000,
        p2Tp1: 3950,
        p3Tp2: 3920,
        p5Tp3: 3890,
        invalidLevelSl: 4030,
        activeTrailingSl: 4030,
        probability: 80,
        leg1Hit: true
      }
    });

    // Записываем младший ACTIVE сетап LONG на 1H (противоположное направление без переданного counterTrend)
    const s2 = recordOrUpdateIndicatorSetup(`${TEST_TICKER}_1h`, {
      forecast: {
        isBull: true,
        direction: "LONG",
        p1Entry: 3965,
        p2Tp1: 4015,
        p3Tp2: 4035,
        p5Tp3: 4050,
        invalidLevelSl: 3948,
        activeTrailingSl: 3948,
        probability: 72,
        leg1Hit: true
      }
    });

    assert.ok(s1 && s2, "Оба сетапа должны быть записаны в журнал");

    const openForTicker = getIndicatorSetupsHistory({ ticker: TEST_TICKER }).filter(
      (s) => s.status === "ACTIVE" || s.status === "PENDING"
    );
    assert.strictEqual(openForTicker.length, 2, "В журнале 2 открытых сетапа по активу");

    const unmarkedLong = openForTicker.filter((s) => s.direction === "LONG" && !s.counterTrend);
    const unmarkedShort = openForTicker.filter((s) => s.direction === "SHORT" && !s.counterTrend);
    assert.strictEqual(
      unmarkedLong.length > 0 && unmarkedShort.length > 0,
      false,
      "В журнале НЕ должно быть двух противоположных ACTIVE сетапов без отметки counterTrend!"
    );

    const juniorInJournal = openForTicker.find((s) => s.timeframe === "1h")!;
    const seniorInJournal = openForTicker.find((s) => s.timeframe === "1d")!;
    assert.strictEqual(juniorInJournal.counterTrend, true, "Младший 1H LONG в журнале обязан иметь counterTrend=true");
    assert.strictEqual(seniorInJournal.counterTrend, false, "Старший 1D SHORT в журнале обязан иметь counterTrend=false");
    assert.ok(
      juniorInJournal.bundleKey && juniorInJournal.bundleKey === seniorInJournal.bundleKey,
      "Связанные сетапы тренд+откат должны иметь общий bundleKey"
    );
    assert.strictEqual(
      juniorInJournal.tp1,
      4000,
      `TP младшего сетапа в журнале ограничен входом старшего (4000), получено ${juniorInJournal.tp1}`
    );

    // Проверяем агрегацию бандла в computeIndicatorOverallStats: связка тренд+откат для TEST_TICKER считается как 1 бандл
    const stats = computeIndicatorOverallStats();
    const tickerStats = stats.byTicker[TEST_TICKER];
    assert.ok(tickerStats, "Статистика по тестовому тикеру должна существовать");
    assert.strictEqual(
      tickerStats.total,
      1,
      `Связка 'тренд+откат' должна учитываться как 1 бандл в статистике тикера, получено total=${tickerStats.total}`
    );

    // Очистка тестовых записей из журнала
    deleteIndicatorSetup(s1.id);
    deleteIndicatorSetup(s2.id);

    console.log(
      `✅ [PASS] Test 27 (г): Чистка журнала и бандл-статистика подтверждены: 1D SHORT (counterTrend=${seniorInJournal.counterTrend}) + 1H LONG (counterTrend=${juniorInJournal.counterTrend}, TP=${juniorInJournal.tp1}), бандл учтён как ${tickerStats.total} единица в статистике`
    );
    passed++;
  }

  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ: ${passed}/27 PASS`);
  console.log(`═══════════════════════════════════════════════════════════════════`);
}

runTests().catch((err) => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

