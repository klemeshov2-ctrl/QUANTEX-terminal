/**
 * unifiedMirror.test.ts
 * Комплексная верификация:
 * - Блок D (Г1–Г8): Инварианты лестницы UFE, SCALP, раннер-кап, честный ADR, managedSl, EXPIRED->nextSetup,
 *   дедупликация пулов ликвидности (макс 6 чипов), чистота браузерного хранилища (pure mirror).
 * - Блок 1–3 (Ручной режим ИИ-аналитика): AI_AUTONOMOUS_ENABLED=false, жесткие HTTP-ворота (401/403/200),
 *   30-минутный серверный кэш планов (forceRecalculate, смена spot/GEX, обход в чате),
 *   SHA-256 идентичность статического system-промпта и компактный DATA PAYLOAD,
 *   smoke-тест GET /api/forecast/unified и GET /api/server/version.
 */

process.env.QUANTEX_UNIT_TEST = "1";

import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {
  computeUnifiedForecast,
  validateLadderInvariant,
  deduplicatePoolsForChips,
  clearUfeAntiFlickerCache
} from "../src/lib/unifiedForecastEngine";
import { buildPropContext, CandleLike } from "../server/propContextEngine";
import { getSessionSchedule } from "../src/lib/marketSessions";
import {
  getStaticSeniorPropSystemPrompt,
  buildSlimDataPayload,
  buildCachedUserMessage,
  buildSeniorPropTraderSystemInstruction
} from "../server/seniorPropTraderPrompt";
import { signJwtToken } from "../server/middlewares/auth";

function makeCandles(count: number, basePrice = 4000, daysSpan = 12): CandleLike[] {
  const candles: CandleLike[] = [];
  const stepMs = Math.max(900_000, Math.floor((daysSpan * 86_400_000) / Math.max(1, count)));
  const startMs = Date.UTC(2026, 2, 1, 9, 0, 0);
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const t = startMs + i * stepMs;
    const wave = Math.sin(i / 6) * 8 + (i % 4 === 0 ? 4 : -2);
    const open = price;
    const close = price + wave;
    const high = Math.max(open, close) + 4;
    const low = Math.min(open, close) - 4;
    candles.push({
      time: t,
      open,
      high,
      low,
      close,
      volume: 500 + (i % 7) * 120
    });
    price = close;
  }
  return candles;
}

async function runTests() {
  console.log("=== [QUANTEX] Запуск unifiedMirror.test.ts ===");

  // Г1. validateLadderInvariant: LONG (sl < entryMid < tp1 < tp2 < tp3) & SHORT (sl > entryMid > tp1 > tp2 > tp3)
  assert.strictEqual(validateLadderInvariant("LONG", 4000, 3980, 4020, 4040, 4070), true, "Валидный LONG должен проходить");
  assert.strictEqual(validateLadderInvariant("LONG", 4000, 4010, 4020, 4040, 4070), false, "LONG со SL >= entryMid должен падать");
  assert.strictEqual(validateLadderInvariant("LONG", 4000, 3980, 4020, 4015, 4070), false, "LONG со TP2 <= TP1 должен падать");
  assert.strictEqual(validateLadderInvariant("SHORT", 4000, 4020, 3980, 3960, 3930), true, "Валидный SHORT должен проходить");
  assert.strictEqual(validateLadderInvariant("SHORT", 4000, 3990, 3980, 3960, 3930), false, "SHORT со SL <= entryMid должен падать");
  assert.strictEqual(validateLadderInvariant("SHORT", 4000, 4020, 3980, 3985, 3930), false, "SHORT со TP2 >= TP1 должен падать");
  console.log("✅ Г1: validateLadderInvariant (LONG/SHORT инварианты) OK");

  // Г2. SCALP скрывает TP2 и TP3
  clearUfeAntiFlickerCache();
  const candles80 = makeCandles(80, 4000, 14);
  const scalpRes = computeUnifiedForecast({
    candles: candles80,
    symbol: "XAUUSD",
    timeframe: "15m",
    adr: { available: true, adr14: 40, todayRange: 38, usedPct: 95 },
    adrPct: 95,
    gexReport: { callWall: 4060, putWall: 3940, gammaFlip: 3990, maxPain: 4000, regime: "POSITIVE_GAMMA" },
    legacyWave: { direction: "LONG", entry: 4000, sl: 3985, tp1: 4025, tp2: 4050, confidence: 78 },
    now: Date.UTC(2026, 2, 18, 12, 0, 0)
  });
  if (scalpRes.isScalpMode) {
    assert.strictEqual(scalpRes.tp2, null, "В SCALP режиме tp2 должен быть null");
    assert.strictEqual(scalpRes.tp3, null, "В SCALP режиме tp3 должен быть null");
  }
  console.log("✅ Г2: SCALP скрытие TP2/TP3 OK (isScalpMode=" + scalpRes.isScalpMode + ")");

  // Г3. Раннер-кап TP3 <= min(6R, 3*ATR, corridor)
  clearUfeAntiFlickerCache();
  const cappedRes = computeUnifiedForecast({
    candles: candles80,
    symbol: "XAUUSD",
    timeframe: "15m",
    gexReport: { callWall: 4025, putWall: 3990, gammaFlip: 4000, maxPain: 4005, regime: "POSITIVE_GAMMA" }, // corridor = 35
    now: Date.UTC(2026, 2, 18, 12, 5, 0)
  });
  const corridor = Math.abs(4025 - 3990);
  const maxAllowedRunner = Math.min(6 * cappedRes.riskR, 3 * cappedRes.atr, corridor);
  if (cappedRes.tp3) {
    assert.ok(
      Math.abs(cappedRes.tp3.price - cappedRes.entryMid) <= maxAllowedRunner + 1e-6,
      `TP3 dist (${Math.abs(cappedRes.tp3.price - cappedRes.entryMid)}) должен быть <= maxAllowedRunner (${maxAllowedRunner})`
    );
  }
  console.log("✅ Г3: Раннер-кап TP3 <= min(6R, 3*ATR, corridor) OK");

  // Г4. Честный ADR (4 дня -> available=false; 12 дней -> available=true)
  const candles4Days = makeCandles(80, 4000, 4);
  const ctx4 = buildPropContext({ symbol: "XAUUSD", timeframe: "15m", candles: candles4Days });
  assert.strictEqual(ctx4.adr?.available, false, "При 4 дневных корзинах adr.available должен быть false");
  assert.strictEqual(ctx4.adr?.adr14, null, "При 4 дневных корзинах adr14 должен быть null");

  const candles12Days = makeCandles(180, 4000, 12);
  const ctx12 = buildPropContext({ symbol: "XAUUSD", timeframe: "15m", candles: candles12Days });
  assert.strictEqual(ctx12.adr?.available, true, "При 12 дневных корзинах adr.available должен быть true");
  assert.ok(ctx12.adr?.adr14 !== null && ctx12.adr.adr14 > 0, "При 12 дневных корзинах adr14 > 0");
  console.log("✅ Г4: Честный расчёт ADR (4 дня vs 12 дней) OK");

  // Г5. Управляемый стоп (managedSl) на стадиях ST0 -> TP1 -> TP2/TRAIL
  clearUfeAntiFlickerCache();
  const baseGex = { callWall: 4080, putWall: 3920, gammaFlip: 3990, maxPain: 4000, regime: "POSITIVE_GAMMA" };
  const st0 = computeUnifiedForecast({
    candles: candles80,
    symbol: "XAUUSD",
    timeframe: "15m",
    gexReport: baseGex,
    stateProgressionOverride: { stage: "ST0", barsSinceEntry: 0 },
    now: Date.UTC(2026, 2, 18, 13, 0, 0)
  });
  assert.strictEqual(st0.managedSl, st0.sl, "На стадии ST0 managedSl === sl");

  clearUfeAntiFlickerCache();
  const tp1Stage = computeUnifiedForecast({
    candles: candles80,
    symbol: "XAUUSD",
    timeframe: "15m",
    gexReport: baseGex,
    stateProgressionOverride: { stage: "TP1", barsSinceEntry: 5 },
    now: Date.UTC(2026, 2, 18, 13, 1, 0)
  });
  if (tp1Stage.direction === "LONG") {
    assert.ok(tp1Stage.managedSl > tp1Stage.entryMid, "На стадии TP1 LONG managedSl переводится в BE + 0.15R > entryMid");
  } else if (tp1Stage.direction === "SHORT") {
    assert.ok(tp1Stage.managedSl < tp1Stage.entryMid, "На стадии TP1 SHORT managedSl переводится в BE - 0.15R < entryMid");
  }

  clearUfeAntiFlickerCache();
  const trailStage = computeUnifiedForecast({
    candles: candles80,
    symbol: "XAUUSD",
    timeframe: "15m",
    gexReport: baseGex,
    stateProgressionOverride: { stage: "TRAIL", barsSinceEntry: 12 },
    now: Date.UTC(2026, 2, 18, 13, 2, 0)
  });
  assert.notStrictEqual(trailStage.managedSl, trailStage.sl, "На стадии TRAIL managedSl сдвинут от начального sl");
  console.log("✅ Г5: Прогрессия managedSl (ST0 -> TP1 -> TRAIL) OK");

  // Г6. EXPIRED включает nextSetup
  clearUfeAntiFlickerCache();
  const expiredRes = computeUnifiedForecast({
    candles: candles80,
    symbol: "XAUUSD",
    timeframe: "15m",
    gexReport: baseGex,
    stateProgressionOverride: { stage: "EXPIRED", barsSinceEntry: 35 },
    now: Date.UTC(2026, 2, 18, 14, 0, 0)
  });
  assert.strictEqual(expiredRes.permission.state, "EXPIRED", "Состояние должно быть EXPIRED");
  assert.ok(expiredRes.nextSetup !== null && expiredRes.nextSetup !== undefined, "В EXPIRED должен формироваться nextSetup");
  assert.notStrictEqual(expiredRes.nextSetup?.permission.state, "EXPIRED", "nextSetup не должен быть EXPIRED");
  console.log("✅ Г6: EXPIRED + nextSetup OK");

  // Г7. Дедупликация пулов ликвидности: кластеризация близких пулов и лимит макс 6 чипов
  const rawPools = [
    { type: "EQH", price: 4010.0, volume: 300, swept: false },
    { type: "PDH", price: 4010.5, volume: 700, swept: false }, // сливается с 4010.0 (порог max(2.0, 0.02%)=2.0)
    { type: "EQL", price: 3990.0, volume: 500, swept: false },
    { type: "PDL", price: 3980.0, volume: 400, swept: false },
    { type: "ASIA_H", price: 4020.0, volume: 350, swept: false },
    { type: "ASIA_L", price: 3970.0, volume: 250, swept: false },
    { type: "EQH", price: 4040.0, volume: 600, swept: false },
    { type: "EQL", price: 3960.0, volume: 550, swept: false },
    { type: "EQH", price: 4050.0, volume: 200, swept: true } // сметенный пул исключается
  ];
  const chips = deduplicatePoolsForChips(rawPools, 4000);
  assert.ok(chips.length <= 6, `Максимум 6 чипов (получено ${chips.length})`);
  const mergedCluster = chips.find(c => Math.abs(c.price - 4010.35) < 0.6);
  assert.ok(mergedCluster && mergedCluster.volume === 1000 && mergedCluster.type === "PDH", "Близкие пулы должны объединиться с суммой объёма 1000 и доминантой PDH");
  console.log("✅ Г7: deduplicatePoolsForChips (кластеризация + макс 6 чипов) OK");

  // Г8. Проверка гигиены браузерного хранилища: никаких рыночных свечей/прогнозов/GEX в localStorage/sessionStorage
  const srcRoot = path.resolve(process.cwd(), "src");
  const forbiddenWriteKeys = ["gex_snapshot", "market_candles", "ufe_forecast", "candlesticks_cache", "gex_report"];
  const walkFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...walkFiles(full));
      else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) out.push(full);
    }
    return out;
  };
  for (const file of walkFiles(srcRoot)) {
    const txt = fs.readFileSync(file, "utf8");
    for (const bad of forbiddenWriteKeys) {
      assert.ok(!txt.includes(`setItem("${bad}`) && !txt.includes(`setItem('${bad}`), `Запрещённая запись ${bad} в storage в файле ${file}`);
    }
  }
  console.log("✅ Г8: Чистота браузерного storage (никаких свечей/прогнозов/GEX в localStorage/sessionStorage) OK");

  // =========================================================================
  // БЛОК 1–3: Ручной ИИ-аналитик, кэширование планов, Context Cache, HTTP-ворота
  // =========================================================================
  const serverModule = await import("../server");
  const { app, AI_AUTONOMOUS_ENABLED, clearManualPlanCache, buildPlanStateSignature } = serverModule;

  assert.strictEqual(AI_AUTONOMOUS_ENABLED, false, "Серверный AI_AUTONOMOUS_ENABLED должен быть строго false");
  const panelCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/AutonomousAiAnalystPanel.tsx"), "utf8");
  assert.ok(panelCode.includes("AI_AUTONOMOUS_ENABLED = false"), "Клиентская панель должна экспортировать AI_AUTONOMOUS_ENABLED = false");
  console.log("✅ Блок 1.1: AI_AUTONOMOUS_ENABLED === false на сервере и клиенте OK");

  // Блок 3: Проверка побайтовой (SHA-256) идентичности статического system-промпта для Context Cache
  const modes = ["short", "detailed", "audit", "chat"] as const;
  for (const m of modes) {
    const p1 = getStaticSeniorPropSystemPrompt(m);
    const p2 = getStaticSeniorPropSystemPrompt(m);
    const h1 = crypto.createHash("sha256").update(p1, "utf8").digest("hex");
    const h2 = crypto.createHash("sha256").update(p2, "utf8").digest("hex");
    assert.strictEqual(h1, h2, `SHA-256 хэши статического system-промпта режима ${m} должны совпадать`);
    assert.ok(!p1.includes("XAUUSD") && !p1.includes("BTCUSDT") && !p1.includes("4000") && !p1.includes("2026"), `Статический префикс ${m} не должен содержать тикеры/цены/даты`);
  }

  const schedNormal = getSessionSchedule(new Date(Date.UTC(2026, 4, 6, 12, 0, 0))); // обычная летняя неделя (isDesyncWeek=false)
  const schedDesync = getSessionSchedule(new Date(Date.UTC(2026, 2, 16, 12, 0, 0))); // март, рассинхрон США/Европа (isDesyncWeek=true)

  const slimClean = buildSlimDataPayload({
    ticker: "XAUUSD",
    timeframe: "15m",
    currentPrice: 3012.345,
    schedule: schedNormal,
    isDangerWindow: false,
    propContext: ctx12,
    gex: {
      regime: "POSITIVE_GAMMA",
      dayCw: 3050.12,
      dayPw: 2980.89,
      monthCw: 3100,
      monthPw: 2900,
      flip: 3005.55,
      pain: 3010.0,
      migrationLog: [
        { level: "CW", from: 3030, to: 3040, reason: "breach" },
        { level: "CW", from: 3040, to: 3050, reason: "corridor_drift" },
        { level: "PW", from: 2970, to: 2980, reason: "oi_leader_persistent" }
      ]
    },
    consensus5Line: "5/5 BULL (1D:3000 4H:3005 1H:3008 30M:3010 15M:3012)",
    ufe: st0
  });

  if (!schedNormal.isDesyncWeek) {
    assert.ok(!slimClean.includes("SCHEDULE["), "При обычной неделе и чистом фоне SCHEDULE не должен передаваться");
  }
  const poolMatches = slimClean.match(/POOLS\(top5\):([^\n]+)/);
  if (poolMatches) {
    assert.ok(poolMatches[1].split(",").length <= 5, "В DATA PAYLOAD должно быть <= 5 пулов ликвидности");
  }
  assert.ok(!slimClean.includes("CW:3030.0->3040.0"), "В MIGR_LAST2 должны попадать только 2 последние записи (старая запись отрезается)");
  assert.ok(slimClean.includes("CW:3040.0->3050.0"), "В MIGR_LAST2 должна быть предпоследняя запись");
  assert.ok(slimClean.includes("PW:2970.0->2980.0"), "В MIGR_LAST2 должна быть последняя запись");

  const slimDesync = buildSlimDataPayload({
    ticker: "BTCUSDT",
    timeframe: "15m",
    currentPrice: 95123.4,
    schedule: schedDesync,
    isDangerWindow: true,
    propContext: null,
    gex: { regime: "NEGATIVE_GAMMA", dayCw: 98000, dayPw: 92000, flip: 95500, pain: 95000 }
  });
  assert.ok(slimDesync.includes("SCHEDULE["), "При isDesyncWeek или isDangerWindow блок SCHEDULE должен включаться");

  // Проверка экономии размера: slimPayload + userDirective << старый тяжелый промпт
  const legacyHeavy = buildSeniorPropTraderSystemInstruction({
    ticker: "XAUUSD",
    schedule: schedDesync,
    propContext: ctx12,
    ufeResult: st0
  });
  const cachedUserMsg = buildCachedUserMessage("Сформируй план", slimClean);
  assert.ok(cachedUserMsg.length < legacyHeavy.length * 0.5, `Slim DATA PAYLOAD (${cachedUserMsg.length}) должен быть существенно компактнее legacy промпта (${legacyHeavy.length})`);
  console.log(`✅ Блок 3: Context Cache SHA-256 + Slim Payload (${cachedUserMsg.length} симв. vs legacy ${legacyHeavy.length}) OK`);

  // Поднимаем реальный Express app на эфемерном порту для HTTP-тестов
  const srv = http.createServer(app);
  await new Promise<void>(resolve => srv.listen(0, "127.0.0.1", resolve));
  const addr = srv.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const token = signJwtToken({
    id: "usr-test",
    username: "tester",
    role: "admin",
    allowedTabs: ["chart", "gex", "calendar", "settings"]
  });

  try {
    clearManualPlanCache();

    // 1. /api/server/version
    const verRes = await fetch(`${baseUrl}/api/server/version`);
    assert.strictEqual(verRes.status, 200);
    const verJson: any = await verRes.json();
    assert.ok(verJson.buildId && verJson.serverTimeMs, "/api/server/version должен возвращать buildId и serverTimeMs");

    // 2. /api/forecast/unified
    const ufeHttpRes = await fetch(`${baseUrl}/api/forecast/unified?symbol=XAUUSD&interval=15m`);
    assert.strictEqual(ufeHttpRes.status, 200, "GET /api/forecast/unified должен отвечать 200");
    const ufeJson: any = await ufeHttpRes.json();
    assert.strictEqual(ufeJson.success, true);
    assert.ok(ufeJson.buildId && ufeJson.forecast && ufeJson.forecast.state, "GET /api/forecast/unified должен возвращать forecast.state");
    assert.ok(ufeJson.forecast.managedSl !== undefined, "GET /api/forecast/unified должен возвращать forecast.managedSl");

    // 3. POST /api/ai-analyst/generate-plan без JWT -> 401
    const noAuthRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual_button", ticker: "XAUUSD" })
    });
    assert.strictEqual(noAuthRes.status, 401, "Без JWT должен возвращаться 401");

    // 4. POST /api/ai-analyst/generate-plan с запрещённым source -> 403 { error: "autonomous mode disabled" }
    for (const badSource of [undefined, "schedule", "auto", "event", "feedback"]) {
      const forbiddenRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ source: badSource, ticker: "XAUUSD", currentPrice: 4000 })
      });
      assert.strictEqual(forbiddenRes.status, 403, `source=${String(badSource)} должен блокироваться с 403`);
      const fj: any = await forbiddenRes.json();
      assert.strictEqual(fj.error, "autonomous mode disabled");
    }

    // 5. POST /api/ai-analyst/send-telegram без source=manual_button -> 403
    const tgBadRes = await fetch(`${baseUrl}/api/ai-analyst/send-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ source: "auto", plan: "test" })
    });
    assert.strictEqual(tgBadRes.status, 403, "Отправка в Telegram не с кнопки должна блокироваться 403");

    // 6. POST /api/ai-analyst/generate-plan (manual_button) -> 200 cached=false, повтор -> cached=true
    const baseBody = {
      source: "manual_button",
      ticker: "XAUUSD",
      timeframe: "15m",
      currentPrice: 4005.0,
      responseStyle: "autonomous",
      gex: { callWall: 4050, putWall: 3960, gammaFlip: 4000, maxPain: 4005, regime: "POSITIVE_GAMMA" },
      dayGex: { callWall: 4050, putWall: 3960, gammaFlip: 4000, maxPain: 4005, regime: "POSITIVE_GAMMA" },
      monthGex: { callWall: 4100, putWall: 3900 },
      candles: candles80
    };

    const firstRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(baseBody)
    });
    assert.strictEqual(firstRes.status, 200);
    const firstJson: any = await firstRes.json();
    assert.strictEqual(firstJson.cached, false, "Первый вызов должен быть не из кэша (cached=false)");
    assert.ok(firstJson.cachedAt && firstJson.stateSignature, "Должны вернуться cachedAt и stateSignature");

    const secondRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(baseBody)
    });
    assert.strictEqual(secondRes.status, 200);
    const secondJson: any = await secondRes.json();
    assert.strictEqual(secondJson.cached, true, "Повторный вызов при тех же условиях должен попасть в кэш (cached=true)");
    assert.strictEqual(secondJson.plan, firstJson.plan, "План из кэша должен совпадать с первым");

    // 7. forceRecalculate: true -> обходит кэш (cached=false)
    const forceRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ ...baseBody, forceRecalculate: true })
    });
    assert.strictEqual(forceRes.status, 200);
    const forceJson: any = await forceRes.json();
    assert.strictEqual(forceJson.cached, false, "forceRecalculate=true должен принудительно пересчитывать план");

    // 8. Смена спота > 0.2% или стены GEX -> cache miss
    const shiftedRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        ...baseBody,
        currentPrice: 4030.0,
        gex: { callWall: 4080, putWall: 3960, gammaFlip: 4000, maxPain: 4005, regime: "POSITIVE_GAMMA" },
        dayGex: { callWall: 4080, putWall: 3960, gammaFlip: 4000, maxPain: 4005, regime: "POSITIVE_GAMMA" }
      })
    });
    assert.strictEqual(shiftedRes.status, 200);
    const shiftedJson: any = await shiftedRes.json();
    assert.strictEqual(shiftedJson.cached, false, "При сдвиге цены >0.2% или стены GEX кэш должен промахнуться");
    assert.notStrictEqual(shiftedJson.stateSignature, firstJson.stateSignature);

    // 9. Чат-запрос всегда обходит кэш
    const chatRes = await fetch(`${baseUrl}/api/ai-analyst/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        ...baseBody,
        source: "chat_message",
        userQuery: "Где сейчас ключевой пул ликвидности?"
      })
    });
    assert.strictEqual(chatRes.status, 200);
    const chatJson: any = await chatRes.json();
    assert.strictEqual(chatJson.cached, false, "Чат-сообщение никогда не берётся из кэша планов");

    // Verify signature helper sensitivity
    const sig1 = buildPlanStateSignature({ ticker: "XAUUSD", spot: 4000, direction: "LONG", permissionState: "TRADEABLE", callWall: 4050, putWall: 3950, gammaFlip: 4000, isDangerWindow: false });
    const sig2 = buildPlanStateSignature({ ticker: "XAUUSD", spot: 4015, direction: "LONG", permissionState: "TRADEABLE", callWall: 4050, putWall: 3950, gammaFlip: 4000, isDangerWindow: false });
    assert.notStrictEqual(sig1, sig2, "Сдвиг цены >0.2% должен менять stateSignature");

    console.log("✅ Блок 1–2 HTTP-ворота (401/403/200), 30-мин кэш, forceRecalculate, chat bypass и UFE endpoint OK");
  } finally {
    await new Promise<void>(resolve => srv.close(() => resolve()));
  }

  console.log("=== [QUANTEX] ВСЕ ТЕСТЫ unifiedMirror.test.ts ПРОЙДЕНЫ УСПЕШНО! ===");
}

runTests().catch(err => {
  console.error("❌ Тест провален:", err);
  process.exit(1);
});
