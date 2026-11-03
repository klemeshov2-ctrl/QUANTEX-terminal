// 🏛️ QUANTEX GEX State & Hysteresis Manager (server/gexStateManager.ts)
// Управление стабилизацией уровней, гистерезисом (25-30%), кулдауном (1 час)
// и блокировкой пересчета при открытых сделках

import {
  GexMarketReport,
  ExpiryHorizon,
  getGexReportForAsset,
  clearGexEngineCache,
  findCallAndPutWalls,
  computeMaxPainWithRange,
  computeZeroGammaFlip
} from "./gexEngine";
import { getLevelRole, getExpirySuffix } from "../src/lib/gexLabels";

// Прототип функции проверки активной сделки из server.ts
type CheckActiveTradeFn = () => boolean;
let isTradeActiveChecker: CheckActiveTradeFn = () => false;

export function registerActiveTradeChecker(checker: CheckActiveTradeFn) {
  isTradeActiveChecker = checker;
}

export interface StabilizedGexRecord {
  asset: string;
  horizon: ExpiryHorizon;
  report: GexMarketReport;
  lastUpdatedAt: number;
  lastCwUpdatedAt: number;
  lastPwUpdatedAt: number;
  lastFlipUpdatedAt: number;
  lastPainUpdatedAt: number;
  callWallOi: number;
  putWallOi: number;
  gammaFlipGex: number;
  maxPainCost: number;
  isLockedByTrade: boolean;
}

export type StabilizerMigrationReason = "breach" | "cooldown+OI" | "new session" | "reset";

export interface StabilizerMigrationEntry {
  timestamp: string;
  asset: string;
  horizon: ExpiryHorizon;
  level: "CW" | "PW" | "FLIP" | "PAIN" | "ALL";
  oldValue: number | null;
  newValue: number;
  spotPrice?: number;
  reason: StabilizerMigrationReason;
  details: string;
  freshValues?: {
    callWall: number;
    putWall: number;
    gammaFlip: number;
    maxPain: number;
  };
  topOi?: {
    topCalls: Array<{ strike: number; oi: number }>;
    topPuts: Array<{ strike: number; oi: number }>;
  };
}

const MAX_MIGRATION_LOG_ENTRIES = 250;
const migrationAuditLog: StabilizerMigrationEntry[] = [];
const pendingResetKeys = new Set<string>();
let globalResetPending = false;

// Minimum cooldown period before considering a normal level shift (1 hour = 3600s)
export const MIN_LEVEL_COOLDOWN_MS = 60 * 60 * 1000;
// Hysteresis threshold: new level must have at least +25% greater volume/OI to trigger migration before cooldown
export const HYSTERESIS_THRESHOLD = 0.25;

export function recordStabilizerMigration(entry: StabilizerMigrationEntry): boolean {
  // STRICT COOLDOWN GUARD (Anti-Ping-Pong):
  // Two migrations of the same level with reason "cooldown+OI" within < 60 minutes are strictly prohibited
  if (entry.reason === "cooldown+OI") {
    const entryTime = new Date(entry.timestamp).getTime();
    const prevMigration = migrationAuditLog.slice().reverse().find(
      m => m.asset === entry.asset && m.horizon === entry.horizon && m.level === entry.level && m.reason === "cooldown+OI"
    );
    if (prevMigration) {
      const prevTime = new Date(prevMigration.timestamp).getTime();
      const diffMs = entryTime - prevTime;
      if (diffMs < MIN_LEVEL_COOLDOWN_MS) {
        console.warn(
          `[GEX Stabilizer] BLOCKED duplicate/premature cooldown+OI migration for ${entry.asset} ${entry.horizon} ${entry.level} (${entry.oldValue} -> ${entry.newValue}): only ${Math.round(diffMs / 60000)}m elapsed (< 60m)`
        );
        return false;
      }
    }
  }

  migrationAuditLog.push(entry);
  if (migrationAuditLog.length > MAX_MIGRATION_LOG_ENTRIES) {
    migrationAuditLog.splice(0, migrationAuditLog.length - MAX_MIGRATION_LOG_ENTRIES);
  }
  const transitionStr = entry.oldValue !== null ? `${entry.oldValue} -> ${entry.newValue}` : `init -> ${entry.newValue}`;
  const spotStr = entry.spotPrice !== undefined ? ` | spot=${entry.spotPrice}` : "";
  const freshStr = entry.freshValues
    ? ` | fresh=[CW:${entry.freshValues.callWall}, PW:${entry.freshValues.putWall}, Flip:${entry.freshValues.gammaFlip}, Pain:${entry.freshValues.maxPain}]`
    : "";
  const topOiStr = entry.topOi
    ? ` | topCalls=[${entry.topOi.topCalls.map(c => `${c.strike}:${c.oi}`).join(",")}] topPuts=[${entry.topOi.topPuts.map(p => `${p.strike}:${p.oi}`).join(",")}]`
    : "";
  console.log(
    `[GEX Stabilizer Migration] asset=${entry.asset} | horizon=${entry.horizon} | level=${entry.level} | ${transitionStr}${spotStr}${freshStr}${topOiStr} | reason=${entry.reason} | ${entry.details}`
  );
  return true;
}

export function getStabilizerMigrationLog(asset?: string, horizon?: ExpiryHorizon): StabilizerMigrationEntry[] {
  const normAsset = asset ? asset.toUpperCase() : undefined;
  const normHorizon = horizon ? (horizon.toUpperCase() as ExpiryHorizon) : undefined;
  return migrationAuditLog.filter(
    e => (!normAsset || e.asset === normAsset) && (!normHorizon || e.horizon === normHorizon)
  );
}

// In-memory cache of stabilized GEX states by `${asset}_${horizon}`
const stabilizedCache = new Map<string, StabilizedGexRecord>();

/**
 * Определяет часовой пояс основной биржи актива для точного расчета смены торговой сессии (EOD Roll):
 * - MOEX FORTS (Золото GD/GN, Si, RI, BR, NG): Europe/Moscow
 * - CME / COMEX (XAUUSD, PAXGUSDT): America/New_York
 * - Криптовалютный рынок Deribit (BTC, ETH, SOL, XRP): UTC
 */
export function getExchangeTimezoneForAsset(asset: string): string {
  const norm = (asset || "").toUpperCase();
  if (
    norm.includes("MOEX") ||
    norm === "GD" ||
    norm === "GN" ||
    norm.includes("GLDRUB") ||
    norm.includes("SI") ||
    norm.includes("RI") ||
    norm.includes("RTS") ||
    norm.includes("BR") ||
    norm.includes("NG")
  ) {
    return "Europe/Moscow";
  }
  if (norm.includes("XAU") || norm.includes("GOLD") || norm.includes("PAXG") || norm.includes("GC")) {
    return "America/New_York";
  }
  return "UTC";
}

function formatExchangeDate(timestampMs: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toISOString().slice(0, 10);
  }
}

/**
 * Обогащает отчет стандартизированными полями согласно новым требованиям (совместимость API сохраняется)
 */
export function enrichReportWithStandardLabels(report: GexMarketReport, spotPrice?: number): GexMarketReport & {
  stabilized?: boolean;
  outOfCorridor?: boolean;
  flipOutOfCorridor?: boolean;
  painOutOfCorridor?: boolean;
  freshValues?: {
    callWall: number;
    putWall: number;
    gammaFlip: number;
    maxPain: number;
  };
  topOi?: {
    topCalls: Array<{ strike: number; oi: number }>;
    topPuts: Array<{ strike: number; oi: number }>;
  };
  cwLabel?: string;
  cwRole?: string;
  cwExpiry?: string;
  pwLabel?: string;
  pwRole?: string;
  pwExpiry?: string;
  flipLabel?: string;
  flipRole?: string;
  flipExpiry?: string;
  painLabel?: string;
  painRole?: string;
  painExpiry?: string;
} {
  const spot = spotPrice || report.spotPrice;
  const horizon = report.horizon || "WEEK";
  const expiry = getExpirySuffix(horizon);

  const cwRoleInfo = getLevelRole("CALL_WALL", report.callWall, spot, horizon);
  const pwRoleInfo = getLevelRole("PUT_WALL", report.putWall, spot, horizon);
  const flipRoleInfo = getLevelRole("GAMMA_FLIP", report.gammaFlip, spot, horizon);
  const painRoleInfo = getLevelRole("MAX_PAIN", report.maxPain, spot, horizon, report.maxPainRange);

  const flipOutOfCorridor = Boolean(
    report.flipOutOfCorridor ?? (report.gammaFlip < report.putWall || report.gammaFlip > report.callWall)
  );
  const painOutOfCorridor = Boolean(
    report.painOutOfCorridor ?? (report.maxPain < report.putWall || report.maxPain > report.callWall)
  );
  const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

  const flipCorridorWarning = flipOutOfCorridor
    ? ` ⚠️ [Вне коридора PW ${report.putWall}–CW ${report.callWall}]`
    : "";
  const painCorridorWarning = painOutOfCorridor
    ? ` ⚠️ [Вне коридора PW ${report.putWall}–CW ${report.callWall}]`
    : "";

  const recentMigrations = getStabilizerMigrationLog(report.asset, horizon).slice(-12);

  const safeSpot = spot || report.spotPrice;
  const topCalls = (report.strikes || [])
    .filter(s => s.strike > safeSpot && (s.callOi || 0) > 0)
    .sort((a, b) => (b.callOi || 0) - (a.callOi || 0))
    .slice(0, 3)
    .map(s => ({ strike: s.strike, oi: s.callOi }));

  const topPuts = (report.strikes || [])
    .filter(s => s.strike < safeSpot && (s.putOi || 0) > 0)
    .sort((a, b) => (b.putOi || 0) - (a.putOi || 0))
    .slice(0, 3)
    .map(s => ({ strike: s.strike, oi: s.putOi }));

  const freshWalls = report.strikes && report.strikes.length >= 2
    ? findCallAndPutWalls(report.strikes, safeSpot, 10, 2)
    : { callWall: report.callWall, putWall: report.putWall };

  const freshPain = report.strikes && report.strikes.length >= 2
    ? computeMaxPainWithRange(report.strikes, safeSpot, 10, 2, freshWalls.putWall, freshWalls.callWall)
    : { maxPain: report.maxPain, maxPainRange: report.maxPainRange };

  const freshFlip = report.strikes && report.strikes.length >= 2
    ? computeZeroGammaFlip(report.strikes, safeSpot, 10, 2, freshWalls.putWall, freshWalls.callWall)
    : report.gammaFlip;

  return {
    ...report,
    stabilized: true,
    outOfCorridor,
    flipOutOfCorridor,
    painOutOfCorridor,
    migrationLog: recentMigrations,
    freshValues: {
      callWall: freshWalls.callWall,
      putWall: freshWalls.putWall,
      gammaFlip: freshFlip,
      maxPain: freshPain.maxPain
    },
    topOi: {
      topCalls,
      topPuts
    },
    // Call Wall (Потолок)
    cwLabel: cwRoleInfo.fullName,
    cwRole: cwRoleInfo.role,
    cwExpiry: expiry,
    // Put Wall (Пол)
    pwLabel: pwRoleInfo.fullName,
    pwRole: pwRoleInfo.role,
    pwExpiry: expiry,
    // Gamma Flip (Флип)
    flipLabel: `${flipRoleInfo.fullName}${flipCorridorWarning}`,
    flipRole: flipOutOfCorridor
      ? `${flipRoleInfo.role} ⚠️ Уровень за пределами коридора [${report.putWall}–${report.callWall}]`
      : flipRoleInfo.role,
    flipExpiry: expiry,
    // Max Pain (Магнит)
    painLabel: `${painRoleInfo.fullName}${painCorridorWarning}`,
    painRole: painOutOfCorridor
      ? `${painRoleInfo.role} ⚠️ Магнит экспирации вне коридора [${report.putWall}–${report.callWall}]`
      : painRoleInfo.role,
    painExpiry: expiry
  };
}

/**
 * 1. Стабилизация GEX-уровней (гистерезис + кулдаун + блокировка при сделке)
 */
export async function getStabilizedGexReport(
  asset: string,
  horizon: ExpiryHorizon = "WEEK",
  spotPrice?: number
): Promise<GexMarketReport> {
  const assetUpper = asset.toUpperCase();
  const horizonUpperKey = horizon.toUpperCase() as ExpiryHorizon;
  const key = `${assetUpper}_${horizonUpperKey}`;
  const now = Date.now();
  const isTradeActive = isTradeActiveChecker();

  const cached = stabilizedCache.get(key);

  // 1. Обязательное условие: если открыта активная сделка — уровни вообще не пересчитываются!
  if (cached && isTradeActive) {
    const updatedSpotReport: GexMarketReport = {
      ...cached.report,
      spotPrice: spotPrice || cached.report.spotPrice,
      timestamp: new Date().toISOString()
    };
    return enrichReportWithStandardLabels(updatedSpotReport, spotPrice);
  }

  // Получаем свежий отчет от базового движка
  const freshReport = await getGexReportForAsset(asset, horizon);

  // Если это первый запуск для данного актива и горизонта (или после ручного сброса) — инициализируем стабилизированную запись
  if (!cached) {
    const wasReset = globalResetPending || pendingResetKeys.has(key) || pendingResetKeys.has(assetUpper);
    if (wasReset) {
      pendingResetKeys.delete(key);
      recordStabilizerMigration({
        timestamp: new Date(now).toISOString(),
        asset: assetUpper,
        horizon: horizonUpperKey,
        level: "ALL",
        oldValue: null,
        newValue: freshReport.maxPain,
        reason: "reset",
        details: `Manual cache reset: CW=${freshReport.callWall}, PW=${freshReport.putWall}, Flip=${freshReport.gammaFlip}, Pain=${freshReport.maxPain}`
      });
    }

    // Находим OI для текущих CW и PW в массиве страйков
    const cwStrike = freshReport.strikes?.find(s => s.strike === freshReport.callWall);
    const pwStrike = freshReport.strikes?.find(s => s.strike === freshReport.putWall);

    const record: StabilizedGexRecord = {
      asset: assetUpper,
      horizon,
      report: freshReport,
      lastUpdatedAt: now,
      lastCwUpdatedAt: now,
      lastPwUpdatedAt: now,
      lastFlipUpdatedAt: now,
      lastPainUpdatedAt: now,
      callWallOi: cwStrike ? cwStrike.callOi : (freshReport.callWall * 10),
      putWallOi: pwStrike ? pwStrike.putOi : (freshReport.putWall * 10),
      gammaFlipGex: Math.abs(freshReport.netGexTotal),
      maxPainCost: freshReport.maxPain,
      isLockedByTrade: false
    };
    stabilizedCache.set(key, record);
    return enrichReportWithStandardLabels(freshReport, spotPrice);
  }

  const currentCw = cached.report.callWall;
  const currentPw = cached.report.putWall;
  const currentFlip = cached.report.gammaFlip;
  const currentPain = cached.report.maxPain;
  const currentPainRange = cached.report.maxPainRange ?? null;

  let newCw = freshReport.callWall;
  let newPw = freshReport.putWall;
  let newFlip = freshReport.gammaFlip;
  let newPain = freshReport.maxPain;
  let newPainRange = freshReport.maxPainRange ?? null;

  if (
    typeof spotPrice === "number" &&
    spotPrice > 0 &&
    freshReport.strikes &&
    freshReport.strikes.length >= 2 &&
    Math.abs(spotPrice - freshReport.spotPrice) / Math.max(1, freshReport.spotPrice) > 0.001
  ) {
    const sortedStrikes = freshReport.strikes.slice().sort((a, b) => a.strike - b.strike);
    let minStep = 10;
    for (let i = 1; i < sortedStrikes.length; i++) {
      const d = Math.abs(sortedStrikes[i].strike - sortedStrikes[i - 1].strike);
      if (d > 1e-6 && d < minStep) minStep = d;
    }
    const reWalls = findCallAndPutWalls(freshReport.strikes, spotPrice, minStep, 2);
    newCw = reWalls.callWall;
    newPw = reWalls.putWall;
    const rePain = computeMaxPainWithRange(freshReport.strikes, spotPrice, minStep, 2, newPw, newCw);
    newPain = rePain.maxPain;
    newPainRange = rePain.maxPainRange;
    newFlip = computeZeroGammaFlip(freshReport.strikes, spotPrice, minStep, 2, newPw, newCw);
  }

  const spot = spotPrice || freshReport.spotPrice;
  const horizonUpper = (freshReport.horizon || "DAY").toUpperCase();

  // Top-3 Call OI and Put OI strikes for full audit transparency
  const topCalls = (freshReport.strikes || [])
    .filter(s => s.strike > spot && (s.callOi || 0) > 0)
    .sort((a, b) => (b.callOi || 0) - (a.callOi || 0))
    .slice(0, 3)
    .map(s => ({ strike: s.strike, oi: s.callOi }));

  const topPuts = (freshReport.strikes || [])
    .filter(s => s.strike < spot && (s.putOi || 0) > 0)
    .sort((a, b) => (b.putOi || 0) - (a.putOi || 0))
    .slice(0, 3)
    .map(s => ({ strike: s.strike, oi: s.putOi }));

  const freshValues = {
    callWall: newCw,
    putWall: newPw,
    gammaFlip: newFlip,
    maxPain: newPain
  };
  const topOi = { topCalls, topPuts };

  // Актуальный OI как на новых кандидатах, так и на текущих удерживаемых стенах
  const newCwStrike = freshReport.strikes?.find(s => s.strike === newCw);
  const newPwStrike = freshReport.strikes?.find(s => s.strike === newPw);
  const newCwOi = newCwStrike ? newCwStrike.callOi : 0;
  const newPwOi = newPwStrike ? newPwStrike.putOi : 0;

  const currentCwStrikeInFresh = freshReport.strikes?.find(s => s.strike === currentCw);
  const currentPwStrikeInFresh = freshReport.strikes?.find(s => s.strike === currentPw);
  if (currentCwStrikeInFresh && currentCwStrikeInFresh.callOi > 0) {
    cached.callWallOi = currentCwStrikeInFresh.callOi;
  }
  if (currentPwStrikeInFresh && currentPwStrikeInFresh.putOi > 0) {
    cached.putWallOi = currentPwStrikeInFresh.putOi;
  }

  // 4. ПРОБОЙ УРОВНЕЙ (Breach Detection) & ВЫХОД ЗА ПРЕДЕЛЫ КОРИДОРА:
  const breachBufferPct = 0.0015; // 0.15% подтвержденного пробоя
  const maxCorridorRatio =
    horizonUpper === "DAY"
      ? 0.055
      : horizonUpper === "WEEK"
      ? 0.100
      : horizonUpper === "MONTH"
      ? 0.200
      : 0.300;

  // Истинный пробой Call Wall вверх: спот физически превысил уровень с подтверждением
  const isCwBreakout = currentCw > 0 && spot > currentCw * (1 + breachBufferPct);
  // Выход за пределы рабочего коридора горизонта:
  const isCwStale = currentCw > 0 && Math.abs(currentCw - spot) / spot > maxCorridorRatio;
  const isCwBreached = isCwBreakout || isCwStale;

  // Истинный пробой Put Wall вниз: спот физически пробил уровень вниз с подтверждением
  const isPwBreakout = currentPw > 0 && spot < currentPw * (1 - breachBufferPct);
  const isPwStale = currentPw > 0 && Math.abs(spot - currentPw) / spot > maxCorridorRatio;
  const isPwBreached = isPwBreakout || isPwStale;

  // 2. Смена клиринговой сессии (EOD Roll) строго по таймзоне биржи актива
  const exchangeTz = getExchangeTimezoneForAsset(asset);
  const lastDateStr = formatExchangeDate(cached.lastUpdatedAt, exchangeTz);
  const nowDateStr = formatExchangeDate(now, exchangeTz);
  const isNewDaySession = nowDateStr !== lastDateStr;

  let stabilizedCw = currentCw;
  let stabilizedPw = currentPw;
  let stabilizedFlip = currentFlip;
  let stabilizedPain = currentPain;
  let stabilizedPainRange = currentPainRange;
  let wallMigrated = false;
  let wallMigrationReason: StabilizerMigrationReason | null = null;

  // Per-level cooldown evaluation:
  const timeSinceCwUpdate = now - (cached.lastCwUpdatedAt || cached.lastUpdatedAt);
  const isCwCooldownPassed = timeSinceCwUpdate >= MIN_LEVEL_COOLDOWN_MS;
  const isSyntheticToRealCw = Boolean(cached.report.isSynthetic && !freshReport.isSynthetic);
  const isOldCwVanished = !currentCwStrikeInFresh || (currentCwStrikeInFresh.callOi || 0) === 0;

  // 1a. Стабилизация Call Wall (Потолок):
  if (newCw !== currentCw) {
    const prevCwOi = cached.callWallOi;
    const isNewCwStronger = newCwOi >= prevCwOi * (1 + HYSTERESIS_THRESHOLD);
    const shouldMigrateCw =
      isCwBreached ||
      isNewDaySession ||
      isSyntheticToRealCw ||
      isOldCwVanished ||
      (isCwCooldownPassed && isNewCwStronger);

    if (shouldMigrateCw) {
      const reason: StabilizerMigrationReason = isCwBreached
        ? "breach"
        : isNewDaySession
        ? "new session"
        : isSyntheticToRealCw
        ? "reset"
        : "cooldown+OI";

      // Hard anti-ping-pong guard: if reason is cooldown+OI, cooldown MUST be passed!
      if (reason === "cooldown+OI" && !isCwCooldownPassed) {
        console.warn(
          `[GEX Stabilizer] Blocked CW migration: cooldown not passed (${Math.round(timeSinceCwUpdate / 60000)}m < 60m)`
        );
      } else {
        const details =
          reason === "breach"
            ? `spot=${spot} breached CW=${currentCw} (${isCwBreakout ? "breakout > +0.15%" : "corridor ratio exceeded"})`
            : reason === "new session"
            ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
            : reason === "reset"
            ? `synthetic-to-real transition: adopting exchange chain (CW=${newCw}, OI=${newCwOi})`
            : `cooldown=${Math.round(timeSinceCwUpdate / 60000)}m>=60m & newCwOi=${newCwOi}>=prevCwOi=${prevCwOi}*1.25`;

        const recorded = recordStabilizerMigration({
          timestamp: new Date(now).toISOString(),
          asset: assetUpper,
          horizon: horizonUpperKey,
          level: "CW",
          oldValue: currentCw,
          newValue: newCw,
          spotPrice: spot,
          reason,
          details,
          freshValues,
          topOi
        });

        if (recorded) {
          stabilizedCw = newCw;
          cached.callWallOi = newCwOi;
          cached.lastCwUpdatedAt = now;
          cached.lastUpdatedAt = now;
          wallMigrated = true;
          wallMigrationReason = reason;
        }
      }
    }
  }

  // Per-level cooldown evaluation for Put Wall:
  const timeSincePwUpdate = now - (cached.lastPwUpdatedAt || cached.lastUpdatedAt);
  const isPwCooldownPassed = timeSincePwUpdate >= MIN_LEVEL_COOLDOWN_MS;
  const isSyntheticToRealPw = Boolean(cached.report.isSynthetic && !freshReport.isSynthetic);
  const isOldPwVanished = !currentPwStrikeInFresh || (currentPwStrikeInFresh.putOi || 0) === 0;

  // 1b. Стабилизация Put Wall (Пол):
  if (newPw !== currentPw) {
    const prevPwOi = cached.putWallOi;
    const isNewPwStronger = newPwOi >= prevPwOi * (1 + HYSTERESIS_THRESHOLD);
    const shouldMigratePw =
      isPwBreached ||
      isNewDaySession ||
      isSyntheticToRealPw ||
      isOldPwVanished ||
      (isPwCooldownPassed && isNewPwStronger);

    if (shouldMigratePw) {
      const reason: StabilizerMigrationReason = isPwBreached
        ? "breach"
        : isNewDaySession
        ? "new session"
        : isSyntheticToRealPw
        ? "reset"
        : "cooldown+OI";

      // Hard anti-ping-pong guard: if reason is cooldown+OI, cooldown MUST be passed!
      if (reason === "cooldown+OI" && !isPwCooldownPassed) {
        console.warn(
          `[GEX Stabilizer] Blocked PW migration: cooldown not passed (${Math.round(timeSincePwUpdate / 60000)}m < 60m)`
        );
      } else {
        const details =
          reason === "breach"
            ? `spot=${spot} breached PW=${currentPw} (${isPwBreakout ? "breakout < -0.15%" : "corridor ratio exceeded"})`
            : reason === "new session"
            ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
            : reason === "reset"
            ? `synthetic-to-real transition: adopting exchange chain (PW=${newPw}, OI=${newPwOi})`
            : `cooldown=${Math.round(timeSincePwUpdate / 60000)}m>=60m & newPwOi=${newPwOi}>=prevPwOi=${prevPwOi}*1.25`;

        const recorded = recordStabilizerMigration({
          timestamp: new Date(now).toISOString(),
          asset: assetUpper,
          horizon: horizonUpperKey,
          level: "PW",
          oldValue: currentPw,
          newValue: newPw,
          spotPrice: spot,
          reason,
          details,
          freshValues,
          topOi
        });

        if (recorded) {
          stabilizedPw = newPw;
          cached.putWallOi = newPwOi;
          cached.lastPwUpdatedAt = now;
          cached.lastUpdatedAt = now;
          wallMigrated = true;
          if (!wallMigrationReason) wallMigrationReason = reason;
        }
      }
    }
  }

  // 3. Обновляем callWallOi и putWallOi в кэше при КАЖДОМ успешном fetch для актуальных стабилизированных стен
  const finalCwStrike = freshReport.strikes?.find(s => s.strike === stabilizedCw);
  const finalPwStrike = freshReport.strikes?.find(s => s.strike === stabilizedPw);
  if (finalCwStrike && finalCwStrike.callOi >= 0) {
    cached.callWallOi = finalCwStrike.callOi;
  }
  if (finalPwStrike && finalPwStrike.putOi >= 0) {
    cached.putWallOi = finalPwStrike.putOi;
  }

  // 1c. Стабилизация Zero Flip и Max Pain (Магнит):
  const timeSinceFlipUpdate = now - (cached.lastFlipUpdatedAt || cached.lastUpdatedAt);
  const isFlipCooldownPassed = timeSinceFlipUpdate >= MIN_LEVEL_COOLDOWN_MS;

  if (newFlip !== currentFlip) {
    const flipShiftRatio = Math.abs(newFlip - currentFlip) / Math.max(0.0001, spot);
    const isFlipOutOfBounds = currentFlip < stabilizedPw || currentFlip > stabilizedCw;
    const isSignificantFlipShift = flipShiftRatio >= 0.005 || Math.abs(spot - currentFlip) / Math.max(0.0001, spot) > 0.008;
    if (wallMigrated || isFlipOutOfBounds || isNewDaySession || (isFlipCooldownPassed && isSignificantFlipShift)) {
      const reason: StabilizerMigrationReason = isFlipOutOfBounds
        ? "breach"
        : isNewDaySession
        ? "new session"
        : wallMigrated && wallMigrationReason
        ? wallMigrationReason
        : "cooldown+OI";
      const details = isFlipOutOfBounds
        ? `flip=${currentFlip} outside corridor [${stabilizedPw}, ${stabilizedCw}]`
        : isNewDaySession
        ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
        : wallMigrated
        ? `coupled wall migration (${wallMigrationReason})`
        : `cooldown>=60m & flipShift=${(flipShiftRatio * 100).toFixed(2)}%`;

      const recorded = recordStabilizerMigration({
        timestamp: new Date(now).toISOString(),
        asset: assetUpper,
        horizon: horizonUpperKey,
        level: "FLIP",
        oldValue: currentFlip,
        newValue: newFlip,
        spotPrice: spot,
        reason,
        details,
        freshValues,
        topOi
      });

      if (recorded) {
        stabilizedFlip = newFlip;
        cached.lastFlipUpdatedAt = now;
        cached.lastUpdatedAt = now;
      }
    }
  }

  const timeSincePainUpdate = now - (cached.lastPainUpdatedAt || cached.lastUpdatedAt);
  const isPainCooldownPassed = timeSincePainUpdate >= MIN_LEVEL_COOLDOWN_MS;

  if (newPain !== currentPain) {
    const painShiftRatio = Math.abs(newPain - currentPain) / Math.max(0.0001, spot);
    const isPainOutOfBounds = currentPain <= stabilizedPw || currentPain >= stabilizedCw;
    const isSignificantPainShift = painShiftRatio >= 0.005;
    if (wallMigrated || isPainOutOfBounds || isNewDaySession || (isPainCooldownPassed && isSignificantPainShift)) {
      const reason: StabilizerMigrationReason = isPainOutOfBounds
        ? "breach"
        : isNewDaySession
        ? "new session"
        : wallMigrated && wallMigrationReason
        ? wallMigrationReason
        : "cooldown+OI";
      const details = isPainOutOfBounds
        ? `pain=${currentPain} outside interior corridor (${stabilizedPw}, ${stabilizedCw})`
        : isNewDaySession
        ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
        : wallMigrated
        ? `coupled wall migration (${wallMigrationReason})`
        : `cooldown>=60m & painShift=${(painShiftRatio * 100).toFixed(2)}%`;

      const recorded = recordStabilizerMigration({
        timestamp: new Date(now).toISOString(),
        asset: assetUpper,
        horizon: horizonUpperKey,
        level: "PAIN",
        oldValue: currentPain,
        newValue: newPain,
        spotPrice: spot,
        reason,
        details,
        freshValues,
        topOi
      });

      if (recorded) {
        stabilizedPain = newPain;
        stabilizedPainRange = newPainRange;
        cached.lastPainUpdatedAt = now;
        cached.lastUpdatedAt = now;
      }
    }
  } else {
    stabilizedPainRange = newPainRange;
  }

  const flipOutOfCorridor = stabilizedFlip < stabilizedPw || stabilizedFlip > stabilizedCw;
  const painOutOfCorridor = stabilizedPain < stabilizedPw || stabilizedPain > stabilizedCw;
  const outOfCorridor = flipOutOfCorridor || painOutOfCorridor;

  const finalReport: GexMarketReport = {
    ...freshReport,
    spotPrice: spotPrice || freshReport.spotPrice,
    callWall: stabilizedCw,
    putWall: stabilizedPw,
    gammaFlip: stabilizedFlip,
    maxPain: stabilizedPain,
    maxPainRange: stabilizedPainRange,
    outOfCorridor,
    flipOutOfCorridor,
    painOutOfCorridor,
    timestamp: new Date().toISOString()
  };

  cached.report = finalReport;
  return enrichReportWithStandardLabels(finalReport, spotPrice);
}

/**
 * Сброс кэша стабилизации для актива (например при ручной калибровке)
 */
export function resetStabilizedGexCache(asset?: string) {
  clearGexEngineCache();
  const nowIso = new Date().toISOString();
  if (asset) {
    const u = asset.toUpperCase();
    pendingResetKeys.add(u);
    let clearedAny = false;
    for (const [k, rec] of Array.from(stabilizedCache.entries())) {
      if (k.startsWith(u)) {
        pendingResetKeys.add(k);
        recordStabilizerMigration({
          timestamp: nowIso,
          asset: rec.asset,
          horizon: rec.horizon,
          level: "ALL",
          oldValue: rec.report.maxPain,
          newValue: 0,
          reason: "reset",
          details: `Stabilizer cache cleared for ${k} (previous CW=${rec.report.callWall}, PW=${rec.report.putWall}, Flip=${rec.report.gammaFlip}, Pain=${rec.report.maxPain})`
        });
        stabilizedCache.delete(k);
        clearedAny = true;
      }
    }
    if (!clearedAny) {
      recordStabilizerMigration({
        timestamp: nowIso,
        asset: u,
        horizon: "WEEK",
        level: "ALL",
        oldValue: null,
        newValue: 0,
        reason: "reset",
        details: `Stabilizer cache reset requested for ${u}`
      });
    }
  } else {
    globalResetPending = true;
    if (stabilizedCache.size > 0) {
      for (const [k, rec] of Array.from(stabilizedCache.entries())) {
        pendingResetKeys.add(k);
        recordStabilizerMigration({
          timestamp: nowIso,
          asset: rec.asset,
          horizon: rec.horizon,
          level: "ALL",
          oldValue: rec.report.maxPain,
          newValue: 0,
          reason: "reset",
          details: `Global stabilizer cache cleared for ${k} (previous CW=${rec.report.callWall}, PW=${rec.report.putWall}, Flip=${rec.report.gammaFlip}, Pain=${rec.report.maxPain})`
        });
      }
    } else {
      recordStabilizerMigration({
        timestamp: nowIso,
        asset: "ALL",
        horizon: "ALL",
        level: "ALL",
        oldValue: null,
        newValue: 0,
        reason: "reset",
        details: `Global stabilizer cache reset requested`
      });
    }
    stabilizedCache.clear();
  }
}
