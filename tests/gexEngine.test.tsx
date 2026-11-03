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
  GexStrikeData,
  GexMarketReport
} from "../server/gexEngine";
import { enrichReportWithStandardLabels } from "../server/gexStateManager";
import { GexProbabilityHero } from "../src/components/GexProbabilityHero";

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
  // TEST 5: При isSynthetic=true UI-компонент рендерит плашку-предупреждение + проверка свежести >1ч и плашки GLD ETF
  // ---------------------------------------------------------------------------
  {
    const now = Date.now();
    assert.equal(isOptionTimestampStale(now - 20 * 60 * 1000, now), false, "20m old timestamp should be fresh");
    assert.equal(isOptionTimestampStale(now - 65 * 60 * 1000, now), true, "65m old timestamp (>1h) should be stale");

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
        gexReport: { ...mockSyntheticReport, isSynthetic: false, isDataStale: false },
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
    console.log(
      `✅ [PASS] Test 5: При isSynthetic=true/isDataStale=true UI рендерит "Синтетическая модель • Данные устарели" и примечание "Опционы на ETF GLD, не на фьючерс золота COMEX GC"`
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
  // TEST 11: Антиколлизия лейблов графика с плавающими тегами оси цены (spot, EMA9, EMA21, EMA200)
  // на мобильной ширине (375px) — метка Flip на Неделе не перекрывается ими
  // ---------------------------------------------------------------------------
  {
    const { solveBadgeAntiCollision } = await import("../src/components/TradingViewZonesPrimitive");
    const mobileWidth = 375;
    const mobileHeight = 520;
    const minVertGap = 18;

    // Плавающие теги оси цены (spot, EMA9, EMA21, EMA200) сгруппированы около Y=240..256,
    // и метка Flip (Недельный) изначально попадает прямо в этот кластер (Y=244)
    const priceAxisObstacles = [
      { id: "spot", x: mobileWidth - 24, y: 242, isPriceAxisTag: true },
      { id: "EMA9", x: mobileWidth - 24, y: 246, isPriceAxisTag: true },
      { id: "EMA21", x: mobileWidth - 24, y: 252, isPriceAxisTag: true },
      { id: "EMA200", x: mobileWidth - 24, y: 290, isPriceAxisTag: true }
    ];

    const badges = [
      {
        id: "flip_line",
        label: "⚡ Флип (Flip, Недельный): 3955.0",
        x: 520, // extends past right edge before clamping on mobile
        y: 244,
        anchorY: 244
      },
      {
        id: "pain_line",
        label: "🎯 Магнит (Недельный): 3950–3960 (середина 3955)",
        x: 520,
        y: 248,
        anchorY: 248
      }
    ];

    const solved = solveBadgeAntiCollision(badges, priceAxisObstacles, mobileWidth, mobileHeight, minVertGap);
    const flipBadge = solved.find(b => b.id === "flip_line")!;
    const painBadge = solved.find(b => b.id === "pain_line")!;

    for (const obs of priceAxisObstacles) {
      const distFlip = Math.abs(flipBadge.y - obs.y);
      const distPain = Math.abs(painBadge.y - obs.y);
      assert.ok(
        distFlip >= minVertGap - 0.5,
        `Expected Flip badge (y=${flipBadge.y}) to be >= ${minVertGap}px away from ${obs.id} (y=${obs.y}), got ${distFlip}px`
      );
      assert.ok(
        distPain >= minVertGap - 0.5,
        `Expected Pain badge (y=${painBadge.y}) to be >= ${minVertGap}px away from ${obs.id} (y=${obs.y}), got ${distPain}px`
      );
    }
    assert.ok(
      Math.abs(flipBadge.y - painBadge.y) >= minVertGap - 0.5,
      `Expected Flip (y=${flipBadge.y}) and Pain (y=${painBadge.y}) not to overlap each other`
    );

    console.log(
      `✅ [PASS] Test 11: Антиколлизия на мобильной ширине (${mobileWidth}px) с тегами [spot, EMA9, EMA21, EMA200] → Flip разведен на y=${flipBadge.y}px (anchor=244), Pain на y=${painBadge.y}px (anchor=248)`
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

  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ: ${passed}/12 PASS`);
  console.log(`═══════════════════════════════════════════════════════════════════`);
}

runTests().catch((err) => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

