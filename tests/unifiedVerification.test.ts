/**
 * unifiedVerification.test.ts
 * Полный набор верификационных тестов для Блоков 1, 2, 3:
 * 4.1. Проверка сессионного TTL движка GEX
 * 4.2. Проверка передачи Prop Desk Context в промпт Senior Prop Trader
 * 4.3. Проверка состояний UFE v1 (TRADEABLE, CONDITIONAL, BLOCKED, SCALP, DEGRADED, Anti-flicker)
 * 4.4. Адаптация весов 7 слоёв в data/unified-layer-weights.json
 */

import assert from "node:assert";
import {
  getGexCacheTtlMs,
  isUsOptionsSessionActive,
  isMoexSessionActive,
  getSessionSchedule
} from "../src/lib/marketSessions";
import {
  buildPropContext,
  CandleLike
} from "../server/propContextEngine";
import {
  buildSeniorPropTraderSystemInstruction,
  formatPropContextForPrompt,
  formatUfeForPrompt
} from "../server/seniorPropTraderPrompt";
import {
  computeUnifiedForecast,
  clearUfeAntiFlickerCache,
  DEFAULT_UFE_WEIGHTS
} from "../src/lib/unifiedForecastEngine";
import {
  recordUnifiedLayerOutcome,
  getUnifiedLayerWeights,
  getUnifiedLayerWeightsReport,
  resetUnifiedLayerWeights
} from "../server/indicatorStatsEngine";

function generateTestCandles(count: number, basePrice = 4000): CandleLike[] {
  const candles: CandleLike[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const t = now - (count - i) * 900;
    const wave = Math.sin(i / 8) * 12 + (i % 5 === 0 ? 8 : -4);
    const open = price;
    const close = price + wave;
    const high = Math.max(open, close) + 3;
    const low = Math.min(open, close) - 3;
    const volume = 100 + Math.abs(wave) * 20;

    candles.push({ time: t, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

function generateHighConfluenceData() {
  const candles: CandleLike[] = [];
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
  candles[8].low = 3990.0;
  candles[18].low = 3990.1;
  candles[10].high = 4050.0;
  candles[10].open = 4040.0;
  candles[10].close = 4045.0;
  candles[25].high = 4050.2;
  candles[25].open = 4040.0;
  candles[25].close = 4045.0;
  candles[30].low = 3985.0;
  candles[30].close = 3998.0;

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

  candles[68].open = 3998.0;
  candles[68].high = 4003.0;
  candles[68].low = 3990.0;
  candles[68].close = 4000.5;
  candles[68].volume = 4000;

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

  return { candles, gexReport };
}

function generateTradeableData() {
  const { candles, gexReport } = generateHighConfluenceData();
  const lastTime = candles[candles.length - 1].time;
  // 16 свечей выше зоны входа, чтобы вход еще не был взят (ST0_PENDING -> TRADEABLE)
  for (let i = 1; i <= 16; i++) {
    candles.push({
      time: lastTime + i * 900000,
      open: 4020,
      high: 4025,
      low: 4016,
      close: 4022,
      volume: 400
    });
  }
  return { candles, gexReport };
}

function generateMacroBlockedData() {
  const { candles, gexReport } = generateTradeableData();
  // Время 16:30 МСК (13:30 UTC) -> окно макро-новости 08:30 ET
  const macroTime = new Date("2026-11-10T13:30:00Z").getTime();
  candles[candles.length - 1].time = macroTime;
  return { candles, gexReport };
}

async function runVerification() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("🧪 QUANTEX: UFE v1 & PROP CONTEXT INTEGRATION TEST SUITE (BLOCK 4)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  let passed = 0;

  // ---------------------------------------------------------------------------
  // 4.1. СЕССИОННЫЙ TTL GEX ДВИЖКА
  // ---------------------------------------------------------------------------
  {
    console.log("▶ [4.1] Проверка сессионного TTL движка GEX:");

    // 1. XAUUSD в 18:00 МСК зимой (15:00 UTC, четверг 15 января 2026) -> 90с (US активна)
    const winterUsActive = new Date("2026-01-15T15:00:00Z");
    const ttlXauActive = getGexCacheTtlMs("XAUUSD", winterUsActive);
    assert.strictEqual(ttlXauActive, 90_000, "XAUUSD в 18:00 МСК зимой -> 90 секунд");
    console.log("  ✓ XAUUSD в 18:00 МСК зимой (15:00 UTC) -> 90с (US активна)");

    // 2. XAUUSD в 12:00 МСК зимой (09:00 UTC, четверг 15 января 2026) -> 15 мин (US закрыта)
    const winterUsClosed = new Date("2026-01-15T09:00:00Z");
    const ttlXauClosed = getGexCacheTtlMs("XAUUSD", winterUsClosed);
    assert.strictEqual(ttlXauClosed, 15 * 60_000, "XAUUSD в 12:00 МСК зимой -> 15 минут");
    console.log("  ✓ XAUUSD в 12:00 МСК зимой (09:00 UTC) -> 15 мин (US закрыта)");

    // 3. MOEX_GOLD в 14:00 МСК в будни (11:00 UTC, четверг) -> 60с (МосБиржа активна)
    const moexActive = new Date("2026-01-15T11:00:00Z");
    const ttlMoex = getGexCacheTtlMs("MOEX_GOLD", moexActive);
    assert.strictEqual(ttlMoex, 60_000, "MOEX_GOLD в 14:00 МСК в будни -> 60 секунд");
    console.log("  ✓ MOEX_GOLD в 14:00 МСК в будни -> 60с (МосБиржа активна)");

    // 4. BTC в любое время -> 15 мин (для крипты нет торговых часов опционов США)
    const ttlBtc = getGexCacheTtlMs("BTC", winterUsActive);
    assert.strictEqual(ttlBtc, 15 * 60_000, "BTC в любое время -> 15 минут");
    console.log("  ✓ BTC в любое время -> 15 мин (крипта)");

    passed++;
  }

  // ---------------------------------------------------------------------------
  // 4.2. ПЕРЕДАЧА PROP DESK CONTEXT В ПРОМПТ ИИ-АНАЛИТИКА
  // ---------------------------------------------------------------------------
  {
    console.log("\n▶ [4.2] Проверка Prop Desk Context в промпте Senior Prop Trader:");

    const candles60 = generateTestCandles(60, 4000);
    const schedule = getSessionSchedule(new Date("2026-01-15T15:00:00Z"));

    const propCtx = buildPropContext({
      symbol: "XAUUSD",
      timeframe: "15m",
      candles: candles60,
      schedule,
      gexReport: {
        spotPrice: 4005,
        callWall: 4040,
        putWall: 3980,
        gammaFlip: 4000,
        netGexTotal: 50,
        regime: "+GAMMA (Mean Reversion)"
      }
    });

    assert.strictEqual(propCtx.available, true, "Prop context должен быть available при >= 50 свечах");

    const promptText = buildSeniorPropTraderSystemInstruction({
      ticker: "XAUUSD",
      schedule,
      propContext: propCtx,
      isChatQuery: false
    });

    // Проверяем наличие всех 6 обязательных институциональных разделов
    assert.ok(
      promptText.includes("PROP DESK CONTEXT (INSTITUTIONAL METRICS)"),
      "Промпт должен содержать заголовок PROP DESK CONTEXT (INSTITUTIONAL METRICS)"
    );
    assert.ok(promptText.includes("Режим сессии и DST-статус"), "Раздел 1: Режим сессии и DST-статус");
    assert.ok(promptText.includes("Опционный GEX-контекст"), "Раздел 2: Опционный GEX-контекст");
    assert.ok(promptText.includes("Volume Profile 70% VA"), "Раздел 3: Volume Profile");
    assert.ok(promptText.includes("Пулы ликвидности (Pools)"), "Раздел 4: Пулы ликвидности");
    assert.ok(promptText.includes("SMC & структура"), "Раздел 5: SMC & структура");
    assert.ok(promptText.includes("Order Flow & дельта"), "Раздел 6: Order Flow & дельта");

    // Проверяем обязательную жесткую инструкцию
    const expectedMandate = "Любой торговый план ОБЯЗАН ссылаться на эти метрики. Игнорирование пула ликвидности ближе 1.5 ATR или попытка входа против сильной гаммы без подтверждения поглощением считается ошибкой первого рода.";
    assert.ok(promptText.includes(expectedMandate), "Обязательная инструкция ИИ должна присутствовать в промпте");
    console.log("  ✓ Все 6 блоков Prop Context и жесткая инструкция ИИ присутствуют в промпте");

    // Проверка guard: < 50 свечей
    const candles30 = generateTestCandles(30, 4000);
    const guardedCtx = buildPropContext({
      symbol: "XAUUSD",
      timeframe: "15m",
      candles: candles30,
      schedule
    });
    assert.strictEqual(guardedCtx.available, false, "При < 50 свечах available === false");
    const guardedSummary = formatPropContextForPrompt(guardedCtx);
    assert.ok(
      guardedSummary.includes("Микроструктура (VP, пулы ликвидности, Order Flow) в процессе накопления свечей"),
      "При < 50 свечах промпт корректно выводит предупреждение о накоплении свечей"
    );
    console.log("  ✓ Guard <50 свечей подтвержден: propContext.available=false без падения системы");

    passed++;
  }

  // ---------------------------------------------------------------------------
  // 4.3. СОСТОЯНИЯ UFE v1 И СИСТЕМА ДОПУСКОВ
  // ---------------------------------------------------------------------------
  {
    console.log("\n▶ [4.3] Проверка состояний Unified Forecast Engine (UFE v1):");
    clearUfeAntiFlickerCache();

    const { candles: hcCandles, gexReport: hcGex } = generateHighConfluenceData();
    const { candles: tradeableCandles, gexReport: tradeableGex } = generateTradeableData();
    const testDate = new Date("2026-11-10T12:00:00Z"); // 15:00 MSK (London session active)
    const schedule = getSessionSchedule(testDate);

    // 4.3.1. TRADEABLE: Высокий score, согласие моделей (вход ожидается в зоне)
    const tradeableRes = computeUnifiedForecast({
      candles: tradeableCandles,
      gexReport: tradeableGex,
      schedule,
      adrPct: 40,
      symbol: "XAUUSD",
      timeframe: "15m",
      currentPrice: 4022,
      legacyWave: {
        direction: "LONG",
        entry: 4005,
        sl: 3995,
        tp1: 4030,
        tp2: 4050,
        confidence: 85
      }
    });

    assert.ok(tradeableRes.entryZone[0] < tradeableRes.entryZone[1], "Зона входа должна быть валидной");
    assert.ok(tradeableRes.sl > 0, "SL должен быть положительным");
    assert.ok(tradeableRes.tp1.price > tradeableRes.sl, "TP1 должен быть выше SL для LONG");
    if (tradeableRes.tp2) {
      assert.ok(tradeableRes.tp2.price > tradeableRes.tp1.price, "TP2 должен быть выше TP1");
    }
    assert.strictEqual(tradeableRes.permission.state, "TRADEABLE", "При согласии моделей и S>=0.70 состояние TRADEABLE");
    console.log(`  ✓ TRADEABLE: Согласие моделей -> S=${tradeableRes.permission.score.toFixed(2)}, state=${tradeableRes.permission.state}`);

    // 4.3.2. BLOCKED: Новостное макро-окно блокирует торговлю
    clearUfeAntiFlickerCache();
    const { candles: blockedCandles, gexReport: blockedGex } = generateMacroBlockedData();
    const blockedRes = computeUnifiedForecast({
      candles: blockedCandles,
      gexReport: blockedGex,
      schedule,
      adrPct: 40,
      symbol: "TEST_BLOCKED",
      timeframe: "15m",
      currentPrice: 4022,
      legacyWave: {
        direction: "LONG",
        entry: 4005,
        sl: 3995,
        tp1: 4030,
        tp2: 4050
      }
    });

    // Даже при BLOCKED линии ПОСТОЯННО ПРИСУТСТВУЮТ!
    assert.strictEqual(blockedRes.permission.state, "BLOCKED", "Состояние должно быть BLOCKED при макро-окне");
    assert.ok(Number.isFinite(blockedRes.entryMid), "Вход должен быть числом при BLOCKED");
    assert.ok(Number.isFinite(blockedRes.sl), "SL должен быть числом при BLOCKED");
    assert.ok(Number.isFinite(blockedRes.tp1.price), "TP1 должен быть числом при BLOCKED");
    assert.ok(blockedRes.tp2 === null || Number.isFinite(blockedRes.tp2.price), "TP2 должен быть числом или null (в SCALP) при BLOCKED");
    assert.ok(blockedRes.tp3 === null || Number.isFinite(blockedRes.tp3.price), "TP3 должен быть числом или null (если ограничен раннер-капом)");
    assert.ok(blockedRes.permission.primaryReason.length > 0, "Причина блокировки указана");
    assert.ok(blockedRes.permission.unblockTrigger.length > 0, "Триггер разблокировки указан");
    console.log(`  ✓ BLOCKED: Линии не исчезают, state=${blockedRes.permission.state}, причина="${blockedRes.permission.primaryReason}", триггер="${blockedRes.permission.unblockTrigger}"`);

    // 4.3.3. SCALP: ADR = 90%
    clearUfeAntiFlickerCache();
    const scalpRes = computeUnifiedForecast({
      candles: hcCandles,
      gexReport: hcGex,
      schedule,
      adrPct: 90,
      symbol: "TEST_SCALP",
      timeframe: "15m",
      currentPrice: 4002,
      legacyWave: {
        direction: "LONG",
        entry: 4002,
        sl: 3995,
        tp1: 4015,
        tp2: 4030
      }
    });
    assert.ok(scalpRes.isScalpMode, "isScalpMode должен быть true при ADR=90%");
    assert.ok(scalpRes.tp1.price > 0, "TP1 присутствует в режиме SCALP");
    console.log(`  ✓ SCALP: При ADR=90% включен режим скальпа, state=${scalpRes.permission.state}`);

    // 4.3.4. DEGRADED: < 50 свечей
    clearUfeAntiFlickerCache();
    const degradedRes = computeUnifiedForecast({
      candles: generateTestCandles(25, 4000),
      schedule,
      symbol: "TEST_DEGRADED",
      timeframe: "15m",
      currentPrice: 4000,
      legacyWave: {
        direction: "LONG",
        entry: 4000,
        sl: 3985,
        tp1: 4020,
        tp2: 4040,
        confidence: 70
      }
    });
    assert.strictEqual(degradedRes.permission.state, "DEGRADED", "При <50 свечах состояние DEGRADED");
    assert.strictEqual(degradedRes.permission.arbiterNote, "DEGRADED: только волновой анализ");
    assert.ok(degradedRes.entryMid > 0, "Линия входа на месте при DEGRADED");
    assert.ok(degradedRes.sl > 0, "Линия SL на месте при DEGRADED");
    assert.ok(degradedRes.tp1.price > 0, "Линия TP1 на месте при DEGRADED");
    console.log("  ✓ DEGRADED: При 25 свечах построена надежная лестница на базе Legacy Wave");

    // 4.3.5. АНТИ-ФЛИКЕР: Защита от дребезга TRADEABLE <-> BLOCKED
    clearUfeAntiFlickerCache();
    const t0 = 1700000000000;
    const sym = "TEST_FLICKER";

    // Опрос 1: стабильный сетап TRADEABLE
    const f1 = computeUnifiedForecast({
      candles: tradeableCandles,
      gexReport: tradeableGex,
      schedule,
      adrPct: 40,
      symbol: sym,
      timeframe: "15m",
      currentPrice: 4022,
      legacyWave: { direction: "LONG", entry: 4005, sl: 3995, tp1: 4030, tp2: 4050 },
      now: t0
    });
    assert.strictEqual(f1.permission.state, "TRADEABLE", "Опрос 1 инициализирует TRADEABLE");

    // Опрос 2 (+10 сек): одиночный ложный спайк блокировки (новостное окно)
    const { candles: spikeCandles, gexReport: spikeGex } = generateMacroBlockedData();
    const f2 = computeUnifiedForecast({
      candles: spikeCandles,
      gexReport: spikeGex,
      schedule,
      adrPct: 40,
      symbol: sym,
      timeframe: "15m",
      currentPrice: 4022,
      legacyWave: { direction: "LONG", entry: 4005, sl: 3995, tp1: 4030, tp2: 4050 },
      now: t0 + 10000
    });
    // Анти-фликер ДОЛЖЕН удержать прежнее состояние на 1-м спайке
    assert.strictEqual(f2.permission.state, "TRADEABLE", "Анти-фликер должен удерживать TRADEABLE на 1-м ложном спайке");

    // Опрос 3 (+20 сек): второй ложный опрос
    const f3 = computeUnifiedForecast({
      candles: spikeCandles,
      gexReport: spikeGex,
      schedule,
      adrPct: 40,
      symbol: sym,
      timeframe: "15m",
      currentPrice: 4022,
      legacyWave: { direction: "LONG", entry: 4005, sl: 3995, tp1: 4030, tp2: 4050 },
      now: t0 + 20000
    });
    assert.strictEqual(f3.permission.state, "TRADEABLE", "Анти-фликер удерживает TRADEABLE на 2-м опросе");

    // Опрос 4 (+30 сек): третий опрос подряд -> подтверждение перехода в BLOCKED!
    const f4 = computeUnifiedForecast({
      candles: spikeCandles,
      gexReport: spikeGex,
      schedule,
      adrPct: 40,
      symbol: sym,
      timeframe: "15m",
      currentPrice: 4022,
      legacyWave: { direction: "LONG", entry: 4005, sl: 3995, tp1: 4030, tp2: 4050 },
      now: t0 + 30000
    });
    assert.strictEqual(f4.permission.state, "BLOCKED", "На 3-й последовательный опрос переход в BLOCKED подтверждается");
    console.log("  ✓ Анти-фликер подтвержден: 1-2 ложных опроса отфильтрованы, 3-й опрос переключил состояние");

    passed++;
  }

  // ---------------------------------------------------------------------------
  // 4.4. АДАПТАЦИЯ ВЕСОВ 7 СЛОЕВ UFE v1
  // ---------------------------------------------------------------------------
  {
    console.log("\n▶ [4.4] Проверка адаптации весов 7 слоёв в data/unified-layer-weights.json:");
    resetUnifiedLayerWeights();

    const w0 = getUnifiedLayerWeights();
    assert.strictEqual(w0.L1, 0.18, "Дефолтный вес L1 равен 0.18");
    assert.strictEqual(w0.L7, 0.10, "Дефолтный вес L7 равен 0.10");

    // Регистрируем серию сделок
    recordUnifiedLayerOutcome(["L1", "L2", "L3"], "WIN");
    recordUnifiedLayerOutcome(["L1", "L2", "L3"], "WIN");
    recordUnifiedLayerOutcome(["L4", "L5"], "LOSS");

    const wReport = getUnifiedLayerWeightsReport();
    assert.ok(wReport.totalTrades >= 3, "Должно быть зарегистрировано >= 3 сделок");

    // Проверяем инварианты весов: коридор [0.05, 0.30] и сумма == 1.00
    let sum = 0;
    for (const [layerId, weight] of Object.entries(wReport.weights)) {
      assert.ok(weight >= 0.05 && weight <= 0.30, `Вес слоя ${layerId} (${weight}) должен быть в диапазоне [0.05, 0.30]`);
      sum += weight;
    }
    const roundedSum = Math.round(sum * 100) / 100;
    assert.strictEqual(roundedSum, 1.00, `Сумма весов всех 7 слоёв должна быть строго 1.00 (получено ${roundedSum})`);
    console.log(`  ✓ Веса 7 слоёв адаптированы: коридор [0.05, 0.30] соблюден, сумма=${roundedSum}`);

    passed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`🎉 ВСЕ ВЕРИФИКАЦИОННЫЕ ТЕСТЫ БЛОКА 4 УСПЕШНО ПРОЙДЕНЫ: ${passed}/4 PASS`);
  console.log("═══════════════════════════════════════════════════════════════════\n");
}

runVerification().catch(err => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
