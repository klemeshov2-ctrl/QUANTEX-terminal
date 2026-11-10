import { getSessionSchedule } from "../src/lib/marketSessions";
import { buildPropContext, CandleLike } from "../server/propContextEngine";
import {
  buildSeniorPropTraderSystemInstruction,
  buildSeniorPropTraderColleagueInstruction,
  formatPropContextForPrompt
} from "../server/seniorPropTraderPrompt";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log("=== RUNNING SENIOR PROP TRADER & PROMPT TESTS ===");

const testDate = new Date("2026-11-10T12:00:00Z"); // Winter season
const schedule = getSessionSchedule(testDate);

// 1. Check schedule formatting in Senior Prop Trader prompt
{
  const prompt = buildSeniorPropTraderSystemInstruction({
    ticker: "XAUUSD",
    schedule,
    propContext: null,
    isChatQuery: false,
    isShortMode: false
  });

  assert(prompt.includes("Senior Prop Trader"), "Contains Senior Prop Trader persona");
  assert(prompt.includes("Зима США (EST)"), "Contains winter schedule label");
  assert(prompt.includes(schedule.usOpenMsk), `Contains US Open time ${schedule.usOpenMsk}`);
  assert(prompt.includes(schedule.macro0830Msk), `Contains macro 08:30 time ${schedule.macro0830Msk}`);
  assert(prompt.includes(schedule.fomc1400Msk), `Contains FOMC time ${schedule.fomc1400Msk}`);
  assert(prompt.includes("SL < Вход < TP1 < TP2"), "Contains LONG mathematical invariant");
  assert(prompt.includes("SL > Вход > TP1 > TP2"), "Contains SHORT mathematical invariant");
  assert(prompt.includes("КАТЕГОРИЧЕСКИЙ ЗАПРЕТ НА ВХОД В ОПАСНЫЕ ОКНА"), "Contains danger window rule");
}

// 2. Check Prop Desk Context injection into system prompt
{
  const candles: CandleLike[] = [];
  for (let i = 0; i < 60; i++) {
    candles.push({
      time: 1700000000000 + i * 900000,
      open: 4000 + i * 0.5,
      high: 4006 + i * 0.5,
      low: 3994 + i * 0.5,
      close: 4002 + i * 0.5,
      volume: 150 + (i % 5) * 50
    });
  }

  const propCtx = buildPropContext(candles, 900, testDate, "XAUUSD", "15m");
  assert(propCtx.available === true, "Prop context available");

  const formattedCtx = formatPropContextForPrompt(propCtx);
  assert(formattedCtx.includes("Volume Profile 70% VA"), "Formatted context contains Volume Profile");
  assert(formattedCtx.includes("POC ="), "Formatted context contains POC");
  assert(formattedCtx.includes("ADR (14)"), "Formatted context contains ADR");

  const fullPrompt = buildSeniorPropTraderSystemInstruction({
    ticker: "XAUUSD",
    schedule,
    propContext: propCtx,
    isChatQuery: false,
    isShortMode: false,
    d1Trend: "BULL",
    h4Trend: "BULL",
    h1Trend: "BULL",
    m30Trend: "BULL",
    m15Trend: "BULL",
    consensus5Str: "5/5 БЫЧИЙ"
  });

  assert(fullPrompt.includes("Volume Profile 70% VA"), "Full prompt contains Volume Profile data");
  assert(fullPrompt.includes("POC ="), "Full prompt contains POC value");
  assert(fullPrompt.includes("5/5 БЫЧИЙ"), "Full prompt contains 5 TF consensus");
}

// 3. Check Chat Mode prompt
{
  const chatPrompt = buildSeniorPropTraderSystemInstruction({
    ticker: "XAUUSD",
    schedule,
    propContext: null,
    isChatQuery: true,
    userQuery: "Где сейчас институциональный POC?"
  });

  assert(chatPrompt.includes("РЕЖИМ: «ОТВЕТ В ЧАТЕ НА ВОПРОС ТРЕЙДЕРА»"), "Identifies chat query mode");
  assert(chatPrompt.includes("Где сейчас институциональный POC?"), "Contains user question");
  assert(chatPrompt.includes("Отвечай КРАТКО (2–4 емких предложения)"), "Enforces brevity in chat mode");
}

// 4. Check Colleague Instruction for /api/analyze-chart
{
  const colleaguePrompt = buildSeniorPropTraderColleagueInstruction(schedule, null, "XAUUSD", "15m");
  assert(colleaguePrompt.includes("Senior Prop Trader"), "Colleague prompt contains Senior Prop Trader persona");
  assert(colleaguePrompt.includes(schedule.labelRu), "Colleague prompt contains schedule label");
  assert(colleaguePrompt.includes("SL < Вход < TP1 < TP2"), "Colleague prompt enforces mathematical invariants");
}

console.log("🎉 ALL SENIOR PROP TRADER & PROMPT TESTS PASSED SUCCESSFULLY!");
