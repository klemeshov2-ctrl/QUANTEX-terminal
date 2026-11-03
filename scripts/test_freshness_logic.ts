import assert from "node:assert/strict";

export type GexSessionVerdict =
  | "fresh"
  | "overnight_normal"
  | "stale"
  | "market_closed"
  | "unavailable";

export type GexTimestampSource =
  | "exchange_timestamp"
  | "fetch_time"
  | "none";

export interface OptionFreshnessEvaluation {
  sessionVerdict: GexSessionVerdict;
  dataFreshnessLabel: string;
  isDataStale: boolean;
  isSynthetic: boolean;
  ageMinutes: number | null;
  timestampSource: GexTimestampSource;
}

function getNewYorkDateTime(ms: number) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short"
  });
  const parts = formatter.formatToParts(new Date(ms));
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
  const year = parseInt(getPart("year"), 10);
  const month = parseInt(getPart("month"), 10);
  const day = parseInt(getPart("day"), 10);
  const hour = parseInt(getPart("hour"), 10);
  const minute = parseInt(getPart("minute"), 10);
  const second = parseInt(getPart("second"), 10);
  const weekday = getPart("weekday"); // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const minuteOfDay = hour * 60 + minute;
  return { year, month, day, hour, minute, second, weekday, minuteOfDay };
}

export function evaluateOptionDataFreshness(options: {
  timestampMs: number | null | undefined;
  timestampSource?: GexTimestampSource;
  marketType: "US_OPTIONS" | "CRYPTO_24_7" | "MOEX_FORTS";
  nowMs?: number;
  fetchFailed?: boolean;
  strikesCount?: number;
}): OptionFreshnessEvaluation {
  const nowMs = options.nowMs ?? Date.now();
  const strikesCount = options.strikesCount ?? 10;
  const fetchFailed = options.fetchFailed ?? false;
  const rawTs = options.timestampMs;

  if (fetchFailed || strikesCount < 4 || !rawTs || !isFinite(rawTs) || rawTs <= 0) {
    return {
      sessionVerdict: "unavailable",
      dataFreshnessLabel: "Биржевой API опционов недоступен",
      isDataStale: true,
      isSynthetic: true,
      ageMinutes: null,
      timestampSource: options.timestampSource || "none"
    };
  }

  const timestampSource: GexTimestampSource = options.timestampSource || "exchange_timestamp";
  const ageMs = Math.max(0, nowMs - rawTs);
  const ageMinutes = Math.round(ageMs / 60000);

  if (options.marketType === "US_OPTIONS") {
    const et = getNewYorkDateTime(nowMs);
    const isWeekend = et.weekday === "Sat" || et.weekday === "Sun";
    // US regular session: 09:30 to 16:00 ET (570 to 960 minutes of day)
    const isSessionOpen = !isWeekend && et.minuteOfDay >= 570 && et.minuteOfDay < 960;

    // Weekend evaluation
    if (isWeekend) {
      // Data is expected from Friday close (~up to 76 hours ago)
      if (ageMs <= 80 * 3600 * 1000) {
        return {
          sessionVerdict: "overnight_normal",
          dataFreshnessLabel: "Данные опционов: закрытие пятницы",
          isDataStale: false,
          isSynthetic: false,
          ageMinutes,
          timestampSource
        };
      }
      return {
        sessionVerdict: "stale",
        dataFreshnessLabel: "Данные опционов: устарели (>72ч)",
        isDataStale: true,
        isSynthetic: true,
        ageMinutes,
        timestampSource
      };
    }

    // Weekday during active session (09:30 - 16:00 ET)
    if (isSessionOpen) {
      if (ageMs <= 2 * 3600 * 1000) {
        return {
          sessionVerdict: "fresh",
          dataFreshnessLabel: "Рынок США открыт (Live • задержка 15 мин)",
          isDataStale: false,
          isSynthetic: false,
          ageMinutes,
          timestampSource
        };
      }
      return {
        sessionVerdict: "stale",
        dataFreshnessLabel: "Данные опционов: устарели (>2ч в ходе сессии)",
        isDataStale: true,
        isSynthetic: ageMs > 24 * 3600 * 1000,
        ageMinutes,
        timestampSource
      };
    }

    // Weekday outside active session (overnight pre-market or post-market)
    // Accept data from the last completed session (within 26 hours)
    if (ageMs <= 26 * 3600 * 1000) {
      return {
        sessionVerdict: "overnight_normal",
        dataFreshnessLabel: "Данные опционов: закрытие прошлой сессии США (норма до 16:30 МСК)",
        isDataStale: false,
        isSynthetic: false,
        ageMinutes,
        timestampSource
      };
    }

    // Truly stale weekday data (> 26 hours)
    return {
      sessionVerdict: "stale",
      dataFreshnessLabel: "Данные опционов: устарели (>24ч)",
      isDataStale: true,
      isSynthetic: true,
      ageMinutes,
      timestampSource
    };
  }

  if (options.marketType === "CRYPTO_24_7") {
    if (ageMinutes <= 30) {
      return {
        sessionVerdict: "fresh",
        dataFreshnessLabel: "Deribit Live API (потоковые данные)",
        isDataStale: false,
        isSynthetic: false,
        ageMinutes,
        timestampSource
      };
    }
    if (ageMinutes <= 60) {
      return {
        sessionVerdict: "fresh",
        dataFreshnessLabel: `Deribit Live API (${ageMinutes} мин)`,
        isDataStale: false,
        isSynthetic: false,
        ageMinutes,
        timestampSource
      };
    }
    return {
      sessionVerdict: "stale",
      dataFreshnessLabel: "Данные Deribit устарели (>1ч)",
      isDataStale: true,
      isSynthetic: ageMinutes > 24 * 60,
      ageMinutes,
      timestampSource
    };
  }

  // MOEX_FORTS
  const mskMs = nowMs + 3 * 3600 * 1000;
  const mskDate = new Date(mskMs);
  const mskDay = mskDate.getUTCDay(); // 0=Sun, 6=Sat
  const mskHour = mskDate.getUTCHours();
  const mskMinute = mskDate.getUTCMinutes();
  const mskMinuteOfDay = mskHour * 60 + mskMinute;
  const isMskWeekend = mskDay === 0 || mskDay === 6;
  const isMskSession = !isMskWeekend && mskMinuteOfDay >= 540 && mskMinuteOfDay < 1430;

  if (isMskWeekend) {
    return {
      sessionVerdict: "market_closed",
      dataFreshnessLabel: "МосБиржа FORTS: закрытие пятницы",
      isDataStale: false,
      isSynthetic: false,
      ageMinutes,
      timestampSource
    };
  }

  if (!isMskSession) {
    return {
      sessionVerdict: "market_closed",
      dataFreshnessLabel: "МосБиржа FORTS: рынок закрыт (ночь / клиринг)",
      isDataStale: false,
      isSynthetic: false,
      ageMinutes,
      timestampSource
    };
  }

  if (ageMinutes <= 30) {
    return {
      sessionVerdict: "fresh",
      dataFreshnessLabel: "МосБиржа FORTS (Live)",
      isDataStale: false,
      isSynthetic: false,
      ageMinutes,
      timestampSource
    };
  }

  return {
    sessionVerdict: "stale",
    dataFreshnessLabel: "МосБиржа FORTS: данные устарели (>30 мин)",
    isDataStale: true,
    isSynthetic: ageMinutes > 24 * 60,
    ageMinutes,
    timestampSource
  };
}

// RUN BLOCK 3.1 TESTS
console.log("=== RUNNING BLOCK 3.1 UNIT TESTS ===");

// 1. timestamp = now inside US session (e.g. Wednesday 14:00 ET = 19:00 UTC)
const wedSessionMs = Date.parse("2026-11-04T19:00:00Z");
const t1 = evaluateOptionDataFreshness({
  timestampMs: wedSessionMs - 5 * 60 * 1000,
  marketType: "US_OPTIONS",
  nowMs: wedSessionMs
});
assert.equal(t1.sessionVerdict, "fresh");
assert.equal(t1.isDataStale, false);
assert.equal(t1.isSynthetic, false);
console.log("✅ Test 1 Passed: inside US session -> fresh");

// 2. now = 13:00 MSK (10:00 UTC Tuesday), timestamp = close of previous session (21:00 UTC Monday, 13h ago)
const tueMsk13Ms = Date.parse("2026-11-03T10:00:00Z"); // 13:00 MSK
const monCloseMs = Date.parse("2026-11-02T21:00:00Z"); // 16:00 ET Monday
const t2 = evaluateOptionDataFreshness({
  timestampMs: monCloseMs,
  marketType: "US_OPTIONS",
  nowMs: tueMsk13Ms
});
assert.equal(t2.sessionVerdict, "overnight_normal");
assert.equal(t2.isDataStale, false);
assert.equal(t2.isSynthetic, false);
assert.ok(t2.dataFreshnessLabel.includes("закрытие прошлой сессии США"));
console.log("✅ Test 2 Passed: 13:00 MSK overnight -> overnight_normal, isDataStale=false, isSynthetic=false");

// 3. timestamp older than 26h on a weekday -> stale
const t3 = evaluateOptionDataFreshness({
  timestampMs: tueMsk13Ms - 27 * 3600 * 1000,
  marketType: "US_OPTIONS",
  nowMs: tueMsk13Ms
});
assert.equal(t3.sessionVerdict, "stale");
assert.equal(t3.isDataStale, true);
assert.equal(t3.isSynthetic, true);
console.log("✅ Test 3 Passed: older than 26h on weekday -> stale");

// 4. Saturday, timestamp = Friday close -> overnight_normal (weekend)
const satMs = Date.parse("2026-11-07T15:00:00Z"); // Saturday
const friCloseMs = Date.parse("2026-11-06T21:00:00Z"); // Friday 16:00 ET
const t4 = evaluateOptionDataFreshness({
  timestampMs: friCloseMs,
  marketType: "US_OPTIONS",
  nowMs: satMs
});
assert.equal(t4.sessionVerdict, "overnight_normal");
assert.equal(t4.isDataStale, false);
assert.equal(t4.isSynthetic, false);
assert.ok(t4.dataFreshnessLabel.includes("закрытие пятницы"));
console.log("✅ Test 4 Passed: Saturday with Friday close -> overnight_normal (weekend)");

// 5. fetch failed -> unavailable + isSynthetic=true
const t5 = evaluateOptionDataFreshness({
  timestampMs: null,
  marketType: "US_OPTIONS",
  fetchFailed: true
});
assert.equal(t5.sessionVerdict, "unavailable");
assert.equal(t5.isSynthetic, true);
assert.equal(t5.isDataStale, true);
console.log("✅ Test 5 Passed: fetch failed -> unavailable + isSynthetic=true");

console.log("\n🎉 ALL FRESHNESS UNIT TESTS PASSED PERFECTLY!");
