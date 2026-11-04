import fs from "fs";
import path from "path";

// --- PERSISTENT GEX LEVEL MIGRATION & SHIFT TRACKER ---
export interface GexTrackerSnapshot {
  ticker: string;
  timestamp: number;
  timeMsk: string;
  dayCallWall: number;
  dayPutWall: number;
  monthCallWall: number;
  monthPutWall: number;
  gammaFlip: number;
  maxPain: number;
  spotPrice: number;
}

export const GEX_TRACKERS_HISTORY_FILE = path.join(process.cwd(), "data", "gex-trackers-history.json");
export const gexTrackersHistory: Map<string, GexTrackerSnapshot[]> = new Map();
export const lastGexSnapshotRecordedTime: Map<string, number> = new Map();
const GEX_HISTORY_MAX_CAP = 200;
let gexHistorySaveDebounceTimer: NodeJS.Timeout | null = null;

export function loadGexTrackersHistoryFromDisk() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(GEX_TRACKERS_HISTORY_FILE)) {
      const raw = fs.readFileSync(GEX_TRACKERS_HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [ticker, list] of Object.entries(parsed)) {
          if (Array.isArray(list)) {
            gexTrackersHistory.set(ticker.toUpperCase().trim(), list.slice(-GEX_HISTORY_MAX_CAP));
          }
        }
      }
      console.log(`[GEX Tracker] Loaded persistent GEX trackers history for ${gexTrackersHistory.size} assets from disk.`);
    }
  } catch (err: any) {
    console.warn("[GEX Tracker] Notice loading trackers history:", err.message);
  }
}

export function saveGexTrackersHistoryDebounced() {
  if (gexHistorySaveDebounceTimer) {
    clearTimeout(gexHistorySaveDebounceTimer);
  }
  gexHistorySaveDebounceTimer = setTimeout(() => {
    saveGexTrackersHistorySync();
  }, 5000);
}

export function saveGexTrackersHistorySync() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const serializable: Record<string, GexTrackerSnapshot[]> = {};
    for (const [ticker, list] of gexTrackersHistory.entries()) {
      serializable[ticker] = list.slice(-GEX_HISTORY_MAX_CAP);
    }
    fs.writeFileSync(GEX_TRACKERS_HISTORY_FILE, JSON.stringify(serializable, null, 2), "utf-8");
  } catch (err: any) {
    console.error("[GEX Tracker] Error saving trackers history:", err);
  }
}

export function clearGexTrackersHistory(ticker?: string) {
  if (ticker) {
    const t = ticker.toUpperCase().trim();
    gexTrackersHistory.delete(t);
    lastGexSnapshotRecordedTime.delete(t);
  } else {
    gexTrackersHistory.clear();
    lastGexSnapshotRecordedTime.clear();
  }
  saveGexTrackersHistorySync();
}

export function recordGexMigrationSnapshot(
  ticker: string,
  levels: {
    dayCw?: number;
    dayPw?: number;
    monthCw?: number;
    monthPw?: number;
    flip?: number;
    pain?: number;
    spot?: number;
    timestamp?: number;
  },
  force = false
): GexTrackerSnapshot | null {
  if (!ticker) return null;
  const normTicker = ticker.toUpperCase().trim();
  const now = levels.timestamp || Date.now();
  const lastRecorded = lastGexSnapshotRecordedTime.get(normTicker) || 0;

  // Throttling: not more often than 1 record per 60 seconds per ticker
  if (!force && now - lastRecorded < 60000) {
    return null;
  }

  const spotPrice = Number(levels.spot ?? 0);
  const dayCallWall = Number(levels.dayCw ?? 0);
  const dayPutWall = Number(levels.dayPw ?? 0);
  const monthCallWall = Number(levels.monthCw ?? 0);
  const monthPutWall = Number(levels.monthPw ?? 0);
  const gammaFlip = Number(levels.flip ?? 0);
  const maxPain = Number(levels.pain ?? 0);

  // Require at least spotPrice or one valid barrier
  if (!dayCallWall && !monthCallWall && !spotPrice) {
    return null;
  }

  const timeMsk = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(now));

  const snapshot: GexTrackerSnapshot = {
    ticker: normTicker,
    timestamp: now,
    timeMsk,
    dayCallWall,
    dayPutWall,
    monthCallWall,
    monthPutWall,
    gammaFlip,
    maxPain,
    spotPrice
  };

  let list = gexTrackersHistory.get(normTicker);
  if (!list) {
    list = [];
    gexTrackersHistory.set(normTicker, list);
  }

  list.push(snapshot);
  if (list.length > GEX_HISTORY_MAX_CAP) {
    list.shift();
  }

  lastGexSnapshotRecordedTime.set(normTicker, now);
  saveGexTrackersHistoryDebounced();

  return snapshot;
}

export interface GexMigrationContextResult {
  hasPreviousSnapshot: boolean;
  prevDayCw: number | null;
  prevDayPw: number | null;
  prevMonthCw: number | null;
  prevMonthPw: number | null;
  currentDayCw: number;
  currentDayPw: number;
  currentMonthCw: number;
  currentMonthPw: number;
  currentFlip: number;
  currentMaxPain: number;
  dayCwShift: number;
  monthCwShift: number;
  dayPwShift: number;
  monthPwShift: number;
  dayCwShiftLabel: string;
  monthCwShiftLabel: string;
  dayPwShiftLabel: string;
  monthPwShiftLabel: string;
  isPositiveGamma: boolean;
  isCallWallRunningAway: boolean;
  isPutWallRunningAway: boolean;
  migrationDiagnosis: string;
  migrationSummaryShort: string;
  gexDynamicRuleClause: string;
  promptShortGexLine: string;
  promptDetailedGexWalls: string;
  antiChopTrendClause: string;
}

export function resolveGexMigrationContext(
  ticker: string,
  currentLevels: {
    dayCw: number;
    dayPw: number;
    monthCw: number;
    monthPw: number;
    flip: number;
    pain: number;
    spot: number;
  },
  previousGexClient?: {
    monthCallWall?: number;
    dayCallWall?: number;
    monthPutWall?: number;
    dayPutWall?: number;
    timestamp?: number;
  } | null,
  marketRegimeContext?: any,
  consensus5Str = "нейтральный"
): GexMigrationContextResult {
  const normTicker = (ticker || "XAUUSD").toUpperCase().trim();
  const gexHistory = gexTrackersHistory.get(normTicker) || [];

  const currentDayCw = Number(currentLevels.dayCw);
  const currentDayPw = Number(currentLevels.dayPw);
  const currentMonthCw = Number(currentLevels.monthCw);
  const currentMonthPw = Number(currentLevels.monthPw);
  const currentFlip = Number(currentLevels.flip);
  const currentMaxPain = Number(currentLevels.pain);
  const currentPriceNum = Number(currentLevels.spot);

  let hasPreviousSnapshot = false;
  let prevDayCw: number | null = null;
  let prevDayPw: number | null = null;
  let prevMonthCw: number | null = null;
  let prevMonthPw: number | null = null;
  let prevTimestamp = 0;

  // Step 1: Read previous levels from persistent server history
  if (gexHistory.length >= 2) {
    const priorDiff = gexHistory.slice(0, -1).reverse().find(s =>
      (s.monthCallWall !== undefined && s.monthCallWall !== currentMonthCw) ||
      (s.dayCallWall !== undefined && s.dayCallWall !== currentDayCw) ||
      (s.monthPutWall !== undefined && s.monthPutWall !== currentMonthPw) ||
      (s.dayPutWall !== undefined && s.dayPutWall !== currentDayPw)
    );
    const chosenSnap = priorDiff || gexHistory[gexHistory.length - 2];
    if (chosenSnap) {
      prevMonthCw = chosenSnap.monthCallWall ?? null;
      prevDayCw = chosenSnap.dayCallWall ?? null;
      prevMonthPw = chosenSnap.monthPutWall ?? null;
      prevDayPw = chosenSnap.dayPutWall ?? null;
      prevTimestamp = chosenSnap.timestamp || 0;
      hasPreviousSnapshot = prevMonthCw !== null || prevDayCw !== null;
    }
  } else if (gexHistory.length === 1) {
    const singleSnap = gexHistory[0];
    const isDiff =
      (singleSnap.monthCallWall !== undefined && singleSnap.monthCallWall !== currentMonthCw) ||
      (singleSnap.dayCallWall !== undefined && singleSnap.dayCallWall !== currentDayCw) ||
      (singleSnap.monthPutWall !== undefined && singleSnap.monthPutWall !== currentMonthPw) ||
      (singleSnap.dayPutWall !== undefined && singleSnap.dayPutWall !== currentDayPw);
    if (isDiff) {
      prevMonthCw = singleSnap.monthCallWall ?? null;
      prevDayCw = singleSnap.dayCallWall ?? null;
      prevMonthPw = singleSnap.monthPutWall ?? null;
      prevDayPw = singleSnap.dayPutWall ?? null;
      prevTimestamp = singleSnap.timestamp || 0;
      hasPreviousSnapshot = prevMonthCw !== null || prevDayCw !== null;
    }
  }

  // Step 2: Client previousGex as override ONLY if fresher than server snapshot
  if (previousGexClient && (previousGexClient.monthCallWall || previousGexClient.dayCallWall)) {
    const clientTs = Number(previousGexClient.timestamp) || 0;
    if (clientTs > prevTimestamp) {
      if (previousGexClient.monthCallWall !== undefined && previousGexClient.monthCallWall !== null) {
        prevMonthCw = Number(previousGexClient.monthCallWall);
      }
      if (previousGexClient.dayCallWall !== undefined && previousGexClient.dayCallWall !== null) {
        prevDayCw = Number(previousGexClient.dayCallWall);
      }
      if (previousGexClient.monthPutWall !== undefined && previousGexClient.monthPutWall !== null) {
        prevMonthPw = Number(previousGexClient.monthPutWall);
      }
      if (previousGexClient.dayPutWall !== undefined && previousGexClient.dayPutWall !== null) {
        prevDayPw = Number(previousGexClient.dayPutWall);
      }
      hasPreviousSnapshot = prevMonthCw !== null || prevDayCw !== null;
    }
  }

  const dayCwShift = (hasPreviousSnapshot && prevDayCw !== null) ? (currentDayCw - prevDayCw) : 0;
  const monthCwShift = (hasPreviousSnapshot && prevMonthCw !== null) ? (currentMonthCw - prevMonthCw) : 0;
  const dayPwShift = (hasPreviousSnapshot && prevDayPw !== null) ? (currentDayPw - prevDayPw) : 0;
  const monthPwShift = (hasPreviousSnapshot && prevMonthPw !== null) ? (currentMonthPw - prevMonthPw) : 0;

  const formatShiftLabel = (diff: number) => {
    if (diff === 0) return "без сдвига";
    return diff > 0 ? `сдвиг +${diff} п. вверх ↗️` : `сдвиг ${diff} п. вниз ↘️`;
  };

  const dayCwShiftLabel = formatShiftLabel(dayCwShift);
  const monthCwShiftLabel = formatShiftLabel(monthCwShift);
  const dayPwShiftLabel = formatShiftLabel(dayPwShift);
  const monthPwShiftLabel = formatShiftLabel(monthPwShift);

  const isPositiveGamma = currentPriceNum >= currentFlip;
  const isCallWallRunningAway = hasPreviousSnapshot && (
    (monthCwShift > 0 || dayCwShift > 0) ||
    (prevDayCw !== null && currentPriceNum >= prevDayCw && monthCwShift >= 0 && (monthCwShift > 0 || dayCwShift > 0))
  );
  const isPutWallRunningAway = hasPreviousSnapshot && (
    (monthPwShift < 0 || dayPwShift < 0) ||
    (prevDayPw !== null && currentPriceNum <= prevDayPw && monthPwShift <= 0 && (monthPwShift < 0 || dayPwShift < 0))
  );

  const isRangeModeDetected = Boolean(marketRegimeContext?.isRangeMode);
  const rangeBounces = Number(marketRegimeContext?.totalBounces ?? 0);
  const rangeBreakouts = Number(marketRegimeContext?.totalBreakouts ?? 0);

  let antiChopTrendClause = "";
  if (isRangeModeDetected) {
    antiChopTrendClause = `Режим: Боковик. Уровни держат цену. Рекомендуется торговля от границ (отбой). (${rangeBounces} отскоков, ${rangeBreakouts} пробоев в коридоре [${currentDayPw} — ${currentDayCw}]).`;
  } else if (isCallWallRunningAway || isPutWallRunningAway) {
    antiChopTrendClause = `Режим: Сильный тренд (Gamma Squeeze). Уровни сдвигаются за ценой. Торговля против тренда (отбой) запрещена, ищи вход по тренду.`;
  } else {
    antiChopTrendClause = isPositiveGamma
      ? `Режим: Боковик. Уровни держат цену. Рекомендуется торговля от границ (отбой).`
      : `Режим: Сильный тренд (Gamma Squeeze). Уровни сдвигаются за ценой. Торговля против тренда (отбой) запрещена, ищи вход по тренду.`;
  }

  let migrationDiagnosis = "";
  let migrationSummaryShort = "";

  if (!hasPreviousSnapshot) {
    migrationDiagnosis = `ℹ️ История миграций ещё накапливается, сдвиг не определён. Текущие опционные уровни: Дневной CW ${currentDayCw}, PW ${currentDayPw}, Месячный CW ${currentMonthCw}, PW ${currentMonthPw}. Zero-Flip: ${currentFlip} [${isPositiveGamma ? "Positive Gamma (+GEX): уровни держат цену" : "Negative Gamma (-GEX): уровни пробиваются"}]. ${antiChopTrendClause}`;
    migrationSummaryShort = `История миграций ещё накапливается, сдвиг не определён (Дневной CW ${currentDayCw}, PW ${currentDayPw}). [${antiChopTrendClause}]`;
  } else if (isCallWallRunningAway) {
    migrationDiagnosis = `🚨 ВНИМАНИЕ: Уровень Call Wall убегает вверх! Месячный Call Wall: был ${prevMonthCw}, стал ${currentMonthCw} (${monthCwShiftLabel}). Дневной Call Wall: был ${prevDayCw}, стал ${currentDayCw} (${dayCwShiftLabel}).
Открытый интерес мигрирует выше вслед за ценой, дилеры вынуждены покупать базовый актив/фьючерсы для дельта-хеджа (Gamma Squeeze).
⚠️ Шорт от старого пробитого уровня (${prevDayCw}) КАТЕГОРИЧЕСКИ ЗАПРЕЩЕН! Старый Call Wall превращается в поддержку (Pullback / зеркальный уровень), а целью для LONG становится новый месячный уровень ${currentMonthCw}.
${antiChopTrendClause}`;
    migrationSummaryShort = `ВНИМАНИЕ: Уровень убегает вверх (Месячный CW: ${prevMonthCw} ➔ ${currentMonthCw}). Тренд сильный, шорт от пробитого уровня ${prevDayCw} опасен. Рекомендую искать вход по тренду (LONG) к цели ${currentMonthCw}. [${antiChopTrendClause}]`;
  } else if (isPutWallRunningAway) {
    migrationDiagnosis = `🚨 ВНИМАНИЕ: Уровень поддержки Put Wall убегает вниз! Месячный Put Wall: был ${prevMonthPw}, стал ${currentMonthPw} (${monthPwShiftLabel}). Дневной Put Wall: был ${prevDayPw}, стал ${currentDayPw} (${dayPwShiftLabel}).
Открытый интерес смещается вниз вслед за падением цены, дилеры хеджируются продажами фьючерсов (Negative Gamma Cascade).
⚠️ Попытка поймать отскок (ножи) КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНА! Старый Put Wall (${prevDayPw}) превращается в сопротивление, цель смещается к новому нижнему уровню ${currentMonthPw}.
${antiChopTrendClause}`;
    migrationSummaryShort = `ВНИМАНИЕ: Поддержка убегает вниз (Месячный PW: ${prevMonthPw} ➔ ${currentMonthPw}). Давление продаж высокое, ловля ножей опасна. Рекомендую работать по тренду (SHORT) к цели ${currentMonthPw}. [${antiChopTrendClause}]`;
  } else if (isRangeModeDetected || isPositiveGamma) {
    migrationDiagnosis = `✅ Режим Positive Gamma / Боковик (+GEX): цена ${currentPriceNum} выше рубежа Zero-Flip (${currentFlip}). Уровни стабильны: Дневной Call Wall ${currentDayCw}, Put Wall ${currentDayPw}.
${antiChopTrendClause}
В положительной гамме дилеры гасят волатильность (продают на хаях, выкупают просадки). Опционные уровни ДЕРЖАТ цену — торгуем на отбой/откат от границ к центру диапазона.`;
    migrationSummaryShort = `${antiChopTrendClause} Уровни держат цену (Дневной CW ${currentDayCw}, PW ${currentDayPw}). Торгуем на отбой от границ диапазона.`;
  } else {
    migrationDiagnosis = `⚠️ Режим Negative Gamma (-GEX): цена ${currentPriceNum} ниже рубежа Zero-Flip (${currentFlip}).
${antiChopTrendClause}
Дилеры находятся в отрицательной гамме и продают при падении, разгоняя тренд. Опционные уровни ПРОБИВАЮТСЯ, движения ускоряются. Торговля на отбой контртренд ЗАПРЕЩЕНА — работаем строго по тренду.`;
    migrationSummaryShort = `${antiChopTrendClause} Уровни пробиваются, тренд ускоряется. Работаем по тренду, контртренд запрещен.`;
  }

  const gexDynamicRuleClause = hasPreviousSnapshot
    ? `1. АНАЛИЗ ДИНАМИКИ УРОВНЕЙ (СДВИГ УРОВНЕЙ):
   - Оценивай не только текущий уровень GEX, но и предыдущий (например: «Месячный Call Wall: был ${prevMonthCw}, стал ${currentMonthCw}»).
   - Если уровень сдвигается в сторону движения цены (догоняет цену) — это признак сильного институционального тренда и вынужденного дельта-хеджирования дилеров (Gamma Squeeze).
   - В этом случае ты ОБЯЗАН написать в вердикте: «ВНИМАНИЕ: Уровень убегает. Тренд сильный, шорт от пробитого уровня опасен. Рекомендую искать вход по тренду (LONG)».`
    : `1. АНАЛИЗ ДИНАМИКИ УРОВНЕЙ (ИСТОРИЯ НАКАПЛИВАЕТСЯ):
   - История миграций ещё накапливается, сдвиг не определён.
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выводить строки «был X, стал Y», придумывать искусственные сдвиги ±10 или ложные предупреждения Gamma Squeeze. Оценивай текущие уровни как стабильные статические барьеры.`;

  const promptShortGexLine = hasPreviousSnapshot
    ? `2. GEX: Дневной CW ${currentDayCw} (Мес: ${prevMonthCw}➔${currentMonthCw} ${monthCwShiftLabel}), PW ${currentDayPw}, Flip ${currentFlip} [${isPositiveGamma ? "+GEX: Уровни держат" : "-GEX: Уровни пробиваются"}]. Консенсус ТФ: ${consensus5Str}.`
    : `2. GEX: Дневной CW ${currentDayCw} (Мес: ${currentMonthCw}), PW ${currentDayPw}, Flip ${currentFlip} [${isPositiveGamma ? "+GEX: Уровни держат" : "-GEX: Уровни пробиваются"}]. Консенсус ТФ: ${consensus5Str}.`;

  const promptDetailedGexWalls = hasPreviousSnapshot
    ? `   - Call Wall (Сопротивление): Дневной ${currentDayCw} (${dayCwShiftLabel}) | Месячный: был ${prevMonthCw}, стал ${currentMonthCw} (${monthCwShiftLabel})
   - Put Wall (Поддержка): Дневной ${currentDayPw} (${dayPwShiftLabel}) | Месячный: был ${prevMonthPw}, стал ${currentMonthPw} (${monthPwShiftLabel})`
    : `   - Call Wall (Сопротивление): Дневной ${currentDayCw} | Месячный: ${currentMonthCw} (история миграций ещё накапливается, сдвиг не определён)
   - Put Wall (Поддержка): Дневной ${currentDayPw} | Месячный: ${currentMonthPw} (история миграций ещё накапливается, сдвиг не определён)`;

  return {
    hasPreviousSnapshot,
    prevDayCw,
    prevDayPw,
    prevMonthCw,
    prevMonthPw,
    currentDayCw,
    currentDayPw,
    currentMonthCw,
    currentMonthPw,
    currentFlip,
    currentMaxPain,
    dayCwShift,
    monthCwShift,
    dayPwShift,
    monthPwShift,
    dayCwShiftLabel,
    monthCwShiftLabel,
    dayPwShiftLabel,
    monthPwShiftLabel,
    isPositiveGamma,
    isCallWallRunningAway,
    isPutWallRunningAway,
    migrationDiagnosis,
    migrationSummaryShort,
    gexDynamicRuleClause,
    promptShortGexLine,
    promptDetailedGexWalls,
    antiChopTrendClause
  };
}

export function buildGexTradePlanSection(
  gexCtx: GexMigrationContextResult
): string {
  const {
    currentDayCw,
    currentDayPw,
    currentMonthCw,
    currentMonthPw,
    currentFlip,
    currentMaxPain,
    isPositiveGamma,
    antiChopTrendClause,
    migrationDiagnosis,
    promptDetailedGexWalls
  } = gexCtx;

  return `2. 📊 Опционные уровни (GEX) и динамика миграции:
${promptDetailedGexWalls}
- Zero-Flip: ${currentFlip} | Max Pain: ${currentMaxPain}
- Гамма-режим: ${isPositiveGamma ? "Positive Gamma (+GEX, цена ВЫШЕ Flip — уровни ДЕРЖАТ цену, торгуем на отбой от границ)" : "Negative Gamma (-GEX, цена НИЖЕ Flip — уровни ПРОБИВАЮТСЯ, тренд ускоряется, торговля на отбой ЗАПРЕЩЕНА)"}
- Режим рынка (Anti-Chop & Trend): ${antiChopTrendClause}
- Динамика уровней:
  ${migrationDiagnosis}`;
}
