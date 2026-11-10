import { getUsSeason, getUkSeason, getSessionSchedule } from "../src/lib/marketSessions";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log("=== RUNNING MARKET SESSIONS TIME ENGINE TESTS ===");

// 1. 2026-11-10 -> Winter season US and UK
{
  const d = new Date("2026-11-10T12:00:00Z");
  const s = getSessionSchedule(d);
  assert(s.seasonUs === "WINTER", "2026-11-10 seasonUs is WINTER");
  assert(s.seasonUk === "WINTER", "2026-11-10 seasonUk is WINTER");
  assert(s.usOpenMsk === "17:30", `2026-11-10 usOpenMsk is 17:30 (got ${s.usOpenMsk})`);
  assert(s.usCloseMsk === "00:00", `2026-11-10 usCloseMsk is 00:00 (got ${s.usCloseMsk})`);
  assert(s.macro0830Msk === "16:30", `2026-11-10 macro0830Msk is 16:30 (got ${s.macro0830Msk})`);
  assert(s.fomc1400Msk === "22:00", `2026-11-10 fomc1400Msk is 22:00 (got ${s.fomc1400Msk})`);
  assert(s.londonOpenMsk === "11:00", `2026-11-10 londonOpenMsk is 11:00 (got ${s.londonOpenMsk})`);
  assert(s.cmeSunOpenMsk === "02:00", `2026-11-10 cmeSunOpenMsk is 02:00 (got ${s.cmeSunOpenMsk})`);
  assert(s.labelRu.includes("Зима США (EST)"), `2026-11-10 labelRu contains 'Зима США (EST)' (got ${s.labelRu})`);
}

// 2. 2027-06-01 -> Summer season US and UK
{
  const d = new Date("2027-06-01T12:00:00Z");
  const s = getSessionSchedule(d);
  assert(s.seasonUs === "SUMMER", "2027-06-01 seasonUs is SUMMER");
  assert(s.seasonUk === "SUMMER", "2027-06-01 seasonUk is SUMMER");
  assert(s.usOpenMsk === "16:30", `2027-06-01 usOpenMsk is 16:30 (got ${s.usOpenMsk})`);
  assert(s.usCloseMsk === "23:00", `2027-06-01 usCloseMsk is 23:00 (got ${s.usCloseMsk})`);
  assert(s.macro0830Msk === "15:30", `2027-06-01 macro0830Msk is 15:30 (got ${s.macro0830Msk})`);
  assert(s.fomc1400Msk === "21:00", `2027-06-01 fomc1400Msk is 21:00 (got ${s.fomc1400Msk})`);
  assert(s.londonOpenMsk === "10:00", `2027-06-01 londonOpenMsk is 10:00 (got ${s.londonOpenMsk})`);
  assert(s.cmeSunOpenMsk === "01:00", `2027-06-01 cmeSunOpenMsk is 01:00 (got ${s.cmeSunOpenMsk})`);
}

// 3. Exact transition boundaries in 2027
// 2027-03-14T06:59Z -> WINTER; 2027-03-14T07:01Z -> SUMMER
{
  const dWinter = new Date("2027-03-14T06:59:00Z");
  const dSummer = new Date("2027-03-14T07:01:00Z");
  assert(getUsSeason(dWinter) === "WINTER", "2027-03-14T06:59Z is WINTER");
  assert(getUsSeason(dSummer) === "SUMMER", "2027-03-14T07:01Z is SUMMER");
}

// 4. Exact transition boundaries in autumn 2027
// 2027-11-07T05:59Z -> SUMMER; 2027-11-07T06:01Z -> WINTER
{
  const dSummer = new Date("2027-11-07T05:59:00Z");
  const dWinter = new Date("2027-11-07T06:01:00Z");
  assert(getUsSeason(dSummer) === "SUMMER", "2027-11-07T05:59Z is SUMMER");
  assert(getUsSeason(dWinter) === "WINTER", "2027-11-07T06:01Z is WINTER");
}

// 5. Desync week 2026-10-27 (UK switched to winter on Oct 25, US still in summer until Nov 1)
{
  const d = new Date("2026-10-27T12:00:00Z");
  const s = getSessionSchedule(d);
  assert(s.seasonUk === "WINTER", "2026-10-27 UK is WINTER");
  assert(s.seasonUs === "SUMMER", "2026-10-27 US is SUMMER");
  assert(s.londonOpenMsk === "11:00", `2026-10-27 londonOpenMsk is 11:00 (got ${s.londonOpenMsk})`);
  assert(s.usOpenMsk === "16:30", `2026-10-27 usOpenMsk is 16:30 (got ${s.usOpenMsk})`);
  assert(s.isDesyncWeek === true, "2026-10-27 isDesyncWeek is true");
  assert(Boolean(s.desyncNoteRu), "2026-10-27 desyncNoteRu is present");
}

console.log("🎉 ALL MARKET SESSIONS TESTS PASSED SUCCESSFULLY!");
