import { calculateGoldGex } from "../server/gexEngine.js";

async function testGoldGex() {
  const report = await calculateGoldGex("DAY");
  console.log("Report isSynthetic:", report.isSynthetic);
  console.log("Report isDataStale:", report.isDataStale);
  console.log("Report source:", report.source);
  console.log("Report dataTimestamp:", report.dataTimestamp);
  console.log("Report timestamp:", report.timestamp);
}

testGoldGex();
