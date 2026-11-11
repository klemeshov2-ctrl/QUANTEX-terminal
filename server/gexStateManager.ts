// 🏛️ QUANTEX GEX State & Hysteresis Manager (server/gexStateManager.ts)
// Управление стабилизацией уровней, гистерезисом (DAY 20%, WEEK 25%, MONTH 30%),
// кулдауном (DAY 30м, WEEK 60м, MONTH 120м), авто-миграцией при смене источника
// и блокировкой пересчета при открытых сделках

import Decimal from "decimal.js";
import {
  GexMarketReport,
  ExpiryHorizon,
  getGexReportForAsset,
  clearGexEngineCache,
  findCallAndPutWalls,
  computeMaxPainWithRange,
  computeZeroGammaFlip,
  roundToDecimals
} from "./gexEngine";
import {
  getLevelRole,
  getExpirySuffix,
  formatGexFreshDiffPreview,
  type GexFreshDiffPreview
} from "../src/lib/gexLabels";

export { formatGexFreshDiffPreview };
export type { GexFreshDiffPreview };

// Прототип функции проверки активной сделки из server.ts
type CheckActiveTradeFn = () => boolean;
let isTradeActiveChecker: CheckActiveTradeFn = () => false;

export function registerActiveTradeChecker(checker: CheckActiveTradeFn) {
  isTradeActiveChecker = checker;
}

export function isTradeActive(): boolean {
  return isTradeActiveChecker();
}

export interface CandidateStrikeRecord {
  strike: number;
  count: number;
  firstSeenAt: number;
}

export interface PreviousLevelRecord {
  value: number;
  migratedAt: number;
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
  dataSource?: string;

  // Persistence tracking for candidate strikes
  cwCandidate?: CandidateStrikeRecord;
  pwCandidate?: CandidateStrikeRecord;
  flipCandidate?: CandidateStrikeRecord;
  painCandidate?: CandidateStrikeRecord;

  // Drift candidate tracking (|stabilized - fresh| >= 2 steps)
  cwDriftCandidate?: CandidateStrikeRecord;
  pwDriftCandidate?: CandidateStrikeRecord;

  // Previous levels for Anti-Ping-Pong v2 no-revert window
  previousCw?: PreviousLevelRecord;
  previousPw?: PreviousLevelRecord;
  previousFlip?: PreviousLevelRecord;
  previousPain?: PreviousLevelRecord;

  // Migration tracking
  lastMigrationAt?: number;
  lastMigrationReason?: string;
}

export type StabilizerMigrationReason =
  | "breach"
  | "cooldown+OI"
  | "oi_leader_persistent"
  | "corridor_drift"
  | "new session"
  | "reset"
  | "source_switch";

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

/**
 * 2. Адаптивные ворота миграции по горизонтам:
 * DAY: cooldown 5 мин, oiMargin 1.10, persistCount 3, corridor 2.5%, noRevert 20 мин;
 * WEEK: 20 мин / 1.15 / 4 / 6% / 60 мин;
 * MONTH и ALL: 60 мин / 1.25 / 6 / 12% / 180 мин.
 */
export interface HorizonGateConfig {
  cooldownMs: number;
  oiMargin: number;
  persistCount: number;
  corridorRatio: number;
  noRevertMs: number;
}

export const HORIZON_GATES: Record<string, HorizonGateConfig> = {
  DAY: {
    cooldownMs: 5 * 60 * 1000,
    oiMargin: 1.10,
    persistCount: 3,
    corridorRatio: 0.025,
    noRevertMs: 20 * 60 * 1000
  },
  WEEK: {
    cooldownMs: 20 * 60 * 1000,
    oiMargin: 1.15,
    persistCount: 4,
    corridorRatio: 0.060,
    noRevertMs: 60 * 60 * 1000
  },
  MONTH: {
    cooldownMs: 60 * 60 * 1000,
    oiMargin: 1.25,
    persistCount: 6,
    corridorRatio: 0.120,
    noRevertMs: 180 * 60 * 1000
  },
  ALL: {
    cooldownMs: 60 * 60 * 1000,
    oiMargin: 1.25,
    persistCount: 6,
    corridorRatio: 0.120,
    noRevertMs: 180 * 60 * 1000
  }
};

export function getHorizonGateConfig(horizon?: ExpiryHorizon | string): HorizonGateConfig {
  const norm = (horizon || "").toUpperCase();
  if (norm === "DAY") return HORIZON_GATES.DAY;
  if (norm === "WEEK") return HORIZON_GATES.WEEK;
  return HORIZON_GATES.MONTH;
}

export function getHorizonCooldownMs(horizon?: ExpiryHorizon | string): number {
  return getHorizonGateConfig(horizon).cooldownMs;
}

export function getHorizonHysteresisThreshold(horizon?: ExpiryHorizon | string): number {
  return Math.round((getHorizonGateConfig(horizon).oiMargin - 1) * 100) / 100;
}

// Minimum cooldown period before considering a normal level shift (default fallback 5 min)
export const MIN_LEVEL_COOLDOWN_MS = 5 * 60 * 1000;
// Hysteresis threshold default: +10% for DAY
export const HYSTERESIS_THRESHOLD = 0.10;

export function recordStabilizerMigration(entry: StabilizerMigrationEntry): boolean {
  const gateConfig = getHorizonGateConfig(entry.horizon);
  const entryTime = new Date(entry.timestamp).getTime();

  // (а) МИНИМУМ-ИНТЕРВАЛ = cooldown горизонта для ЛЮБОЙ причины, кроме breach, reset и source_switch
  const isCooldownExempt =
    entry.reason === "breach" ||
    entry.reason === "reset" ||
    entry.reason === "source_switch";

  if (!isCooldownExempt) {
    const prevMigration = migrationAuditLog.slice().reverse().find(
      m => m.asset === entry.asset &&
           m.horizon === entry.horizon &&
           m.level === entry.level &&
           m.reason !== "reset"
    );
    if (prevMigration) {
      const prevTime = new Date(prevMigration.timestamp).getTime();
      const diffMs = entryTime - prevTime;
      const requiredCooldownMs = gateConfig.cooldownMs;
      if (diffMs < requiredCooldownMs) {
        console.warn(
          `[GEX Stabilizer] BLOCKED premature ${entry.reason} migration for ${entry.asset} ${entry.horizon} ${entry.level} (${entry.oldValue} -> ${entry.newValue}): only ${Math.round(diffMs / 60000)}m elapsed (< ${Math.round(requiredCooldownMs / 60000)}m)`
        );
        return false;
      }
    }
  }

  // (б) NO-REVERT WINDOW: возврат уровня к прежнему значению запрещён в течение noRevert минут,
  // кроме breach цены через прежнее значение.
  if (entry.reason !== "breach" && entry.oldValue !== null) {
    const prevDeparture = migrationAuditLog.slice().reverse().find(
      m => m.asset === entry.asset &&
           m.horizon === entry.horizon &&
           m.level === entry.level &&
           m.oldValue === entry.newValue &&
           m.reason !== "reset"
    );
    if (prevDeparture) {
      const departureTime = new Date(prevDeparture.timestamp).getTime();
      const timeSinceDeparture = entryTime - departureTime;
      const requiredNoRevertMs = gateConfig.noRevertMs;
      if (timeSinceDeparture < requiredNoRevertMs) {
        console.warn(
          `[GEX Stabilizer] BLOCKED ping-pong no-revert migration for ${entry.asset} ${entry.horizon} ${entry.level} (attempted return to ${entry.newValue}): only ${Math.round(timeSinceDeparture / 60000)}m elapsed within noRevert window (< ${Math.round(requiredNoRevertMs / 60000)}m)`
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
// Incremental strike cache map: key -> Map<strike, GexStrikeData> for fast, low-overhead updates
const incrementalStrikeCache = new Map<string, Map<number, any>>();

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
    lastMigrationAt: report.lastMigrationAt,
    lastMigrationReason: report.lastMigrationReason,
    nextMigrationAllowedAt: report.nextMigrationAllowedAt,
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
  spotPrice?: number,
  overrideFreshReport?: GexMarketReport,
  overrideNow?: number
): Promise<GexMarketReport> {
  const assetUpper = asset.toUpperCase();
  const horizonUpperKey = horizon.toUpperCase() as ExpiryHorizon;
  const key = `${assetUpper}_${horizonUpperKey}`;
  const now = typeof overrideNow === "number" ? overrideNow : Date.now();
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

  // Получаем свежий отчет от базового движка (или переданный override)
  const freshReport = overrideFreshReport || (await getGexReportForAsset(asset, horizon));

  // 0. Packet timestamp & out-of-order arrival validation
  if (cached && freshReport) {
    const freshTimestamp = freshReport.dataTimestamp || freshReport.timestamp;
    const cachedTimestamp = cached.report.dataTimestamp || cached.report.timestamp;
    if (freshTimestamp && cachedTimestamp) {
      const freshMs = new Date(freshTimestamp).getTime();
      const cachedMs = new Date(cachedTimestamp).getTime();
      if (isFinite(freshMs) && isFinite(cachedMs) && freshMs < cachedMs - 60000) {
        console.warn(
          `[GEX State Manager] Dropped stale/out-of-order packet for ${assetUpper} ${horizonUpperKey}: packet=${freshTimestamp} < cached=${cachedTimestamp}`
        );
        return enrichReportWithStandardLabels(cached.report, spotPrice);
      }
    }
  }

  // Incremental strike cache integration: merge changed strikes and maintain complete profile
  if (freshReport.strikes && freshReport.strikes.length > 0) {
    let bookMap = incrementalStrikeCache.get(key);
    if (!bookMap) {
      bookMap = new Map();
      incrementalStrikeCache.set(key, bookMap);
    }
    for (const s of freshReport.strikes) {
      if (s && isFinite(s.strike) && s.strike > 0) {
        bookMap.set(s.strike, { ...s });
      }
    }
    if (freshReport.strikes.length < bookMap.size) {
      freshReport.strikes = Array.from(bookMap.values()).sort((a, b) => a.strike - b.strike);
    }
  }

  // Если это первый запуск для данного актива и горизонта (или после ручного сброса) — инициализируем стабилизированную запись
  if (!cached) {
    const wasReset = globalResetPending || pendingResetKeys.has(key) || pendingResetKeys.has(assetUpper);
    const prevDiff = pendingResetDiffs.get(key) || pendingResetDiffs.get(assetUpper);
    if (wasReset || prevDiff) {
      pendingResetKeys.delete(key);
      pendingResetDiffs.delete(key);
      const diffCw = prevDiff ? `${prevDiff.cw} -> ${freshReport.callWall}` : `init -> ${freshReport.callWall}`;
      const diffPw = prevDiff ? `${prevDiff.pw} -> ${freshReport.putWall}` : `init -> ${freshReport.putWall}`;
      const diffFlip = prevDiff ? `${Math.round(prevDiff.flip)} -> ${Math.round(freshReport.gammaFlip)}` : `init -> ${Math.round(freshReport.gammaFlip)}`;
      const diffPain = prevDiff ? `${prevDiff.pain} -> ${freshReport.maxPain}` : `init -> ${freshReport.maxPain}`;
      const diffDetails = `Diff: [CW ${diffCw}, PW ${diffPw}, Flip ${diffFlip}, Pain ${diffPain}]`;

      recordStabilizerMigration({
        timestamp: new Date(now).toISOString(),
        asset: assetUpper,
        horizon: horizonUpperKey,
        level: "ALL",
        oldValue: prevDiff ? prevDiff.pain : null,
        newValue: freshReport.maxPain,
        reason: "reset",
        details: `Manual cache reset: ${diffDetails}`,
        freshValues: {
          callWall: freshReport.callWall,
          putWall: freshReport.putWall,
          gammaFlip: freshReport.gammaFlip,
          maxPain: freshReport.maxPain
        }
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
      isLockedByTrade: false,
      dataSource: freshReport.source || "unknown"
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

  // 1. Горизонтно-зависимые параметры стабилизатора (таблица адаптивных ворот):
  // DAY: cooldown 5 мин, oiMargin 1.10, persistCount 3, corridor 2.5%, noRevert 20 мин;
  // WEEK: 20 мин / 1.15 / 4 / 6% / 60 мин;
  // MONTH и ALL: 60 мин / 1.25 / 6 / 12% / 180 мин.
  const gateConfig = getHorizonGateConfig(horizonUpperKey);
  const horizonCooldownMs = gateConfig.cooldownMs;
  const maxCorridorRatio = gateConfig.corridorRatio;

  // Шаг сетки страйков для детекции сдвига >= 2 шагов
  let strikeStep = 10;
  if (freshReport.strikes && freshReport.strikes.length >= 2) {
    const sortedStrikes = freshReport.strikes.slice().sort((a, b) => a.strike - b.strike);
    let minStep = 10;
    for (let i = 1; i < sortedStrikes.length; i++) {
      const d = Math.abs(sortedStrikes[i].strike - sortedStrikes[i - 1].strike);
      if (d > 1e-6 && d < minStep) minStep = d;
    }
    strikeStep = minStep;
  }

  // 2. Авто-миграция reason="source_switch": если источник отчёта сменился
  // (CBOE→Yahoo, Yahoo→MOEX и т.п.) И свежие стены отличаются от стабилизированных больше чем на 2 шага сетки
  const prevSource = cached.dataSource || cached.report.source;
  const currentSource = freshReport.source;
  const isSourceSwitched = Boolean(prevSource && currentSource && prevSource !== currentSource);
  const isCwDiffSignificant = Math.abs(newCw - currentCw) >= 2 * strikeStep - 1e-6;
  const isPwDiffSignificant = Math.abs(newPw - currentPw) >= 2 * strikeStep - 1e-6;
  const isCwSourceSwitch = isSourceSwitched && isCwDiffSignificant;
  const isPwSourceSwitch = isSourceSwitched && isPwDiffSignificant;

  // 4. ПРОБОЙ УРОВНЕЙ (Breach Detection) & ВЫХОД ЗА ПРЕДЕЛЫ КОРИДОРА:
  const breachBufferPct = 0.0015; // 0.15% подтвержденного пробоя

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
  const isCwCooldownPassed = timeSinceCwUpdate >= horizonCooldownMs;
  const isSyntheticToRealCw = Boolean(cached.report.isSynthetic && !freshReport.isSynthetic);
  const isOldCwVanished = !currentCwStrikeInFresh || (currentCwStrikeInFresh.callOi || 0) === 0;

  // Track CW candidate for OI leader persistence
  if (newCw !== currentCw) {
    if (cached.cwCandidate && cached.cwCandidate.strike === newCw) {
      cached.cwCandidate.count += 1;
    } else {
      cached.cwCandidate = { strike: newCw, count: 1, firstSeenAt: now };
    }
  } else {
    cached.cwCandidate = undefined;
  }

  // Track CW candidate for corridor_drift (|stabilized - fresh| >= 2 * strikeStep)
  const isCwDiff2Steps = Math.abs(newCw - currentCw) >= 2 * strikeStep - 1e-6;
  if (isCwDiff2Steps) {
    if (cached.cwDriftCandidate && cached.cwDriftCandidate.strike === newCw) {
      cached.cwDriftCandidate.count += 1;
    } else {
      cached.cwDriftCandidate = { strike: newCw, count: 1, firstSeenAt: now };
    }
  } else {
    cached.cwDriftCandidate = undefined;
  }

  // 1a. Стабилизация Call Wall (Потолок):
  if (newCw !== currentCw) {
    const prevCwOi = cached.callWallOi;
    const isNewCwStronger = prevCwOi > 0
      ? new Decimal(newCwOi).gte(new Decimal(prevCwOi).times(new Decimal(gateConfig.oiMargin)))
      : newCwOi > 0;
    const isCwPersistent = Boolean(cached.cwCandidate && cached.cwCandidate.count >= gateConfig.persistCount);
    const isCwDriftPersistent = Boolean(cached.cwDriftCandidate && cached.cwDriftCandidate.count >= gateConfig.persistCount);

    const shouldMigrateCw =
      isCwSourceSwitch ||
      isCwBreached ||
      (isNewDaySession && isCwCooldownPassed) ||
      isSyntheticToRealCw ||
      isOldCwVanished ||
      (isCwCooldownPassed && (isNewCwStronger || isCwPersistent || isCwDriftPersistent));

    if (shouldMigrateCw) {
      let reason: StabilizerMigrationReason = "cooldown+OI";
      if (isCwSourceSwitch) {
        reason = "source_switch";
      } else if (isCwBreached || isOldCwVanished) {
        reason = "breach";
      } else if (isSyntheticToRealCw) {
        reason = "reset";
      } else if (isNewDaySession) {
        reason = "new session";
      } else if (isCwDriftPersistent) {
        reason = "corridor_drift";
      } else if (isCwPersistent && !isNewCwStronger) {
        reason = "oi_leader_persistent";
      } else {
        reason = "cooldown+OI";
      }

      if ((reason === "cooldown+OI" || reason === "oi_leader_persistent" || reason === "corridor_drift") && !isCwCooldownPassed) {
        console.warn(
          `[GEX Stabilizer] Blocked CW migration: cooldown not passed (${Math.round(timeSinceCwUpdate / 60000)}m < ${Math.round(horizonCooldownMs / 60000)}m)`
        );
      } else {
        const details =
          reason === "source_switch"
            ? `source switch (${prevSource} -> ${currentSource}): fresh CW=${newCw} differs from stabilized CW=${currentCw} by > 2 steps (${2 * strikeStep})`
            : reason === "breach"
            ? `spot=${spot} breached CW=${currentCw} (${isCwBreakout ? "breakout > +0.15%" : `corridor ratio ${(gateConfig.corridorRatio * 100).toFixed(1)}% exceeded`})`
            : reason === "new session"
            ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
            : reason === "reset"
            ? `synthetic-to-real transition: adopting exchange chain (CW=${newCw}, OI=${newCwOi})`
            : reason === "corridor_drift"
            ? `corridor_drift: |stabilized ${currentCw} - fresh ${newCw}| >= 2 steps (${2 * strikeStep}) held for ${cached.cwDriftCandidate?.count || gateConfig.persistCount} reports (cooldown=${Math.round(timeSinceCwUpdate / 60000)}m >= ${Math.round(horizonCooldownMs / 60000)}m)`
            : reason === "oi_leader_persistent"
            ? `oi_leader_persistent: new candidate CW=${newCw} held for ${cached.cwCandidate?.count || gateConfig.persistCount} reports (cooldown=${Math.round(timeSinceCwUpdate / 60000)}m >= ${Math.round(horizonCooldownMs / 60000)}m)`
            : `cooldown=${Math.round(timeSinceCwUpdate / 60000)}m>=${Math.round(horizonCooldownMs / 60000)}m & newCwOi=${newCwOi}>=prevCwOi=${prevCwOi}*${gateConfig.oiMargin.toFixed(2)}`;

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
          cached.previousCw = { value: currentCw, migratedAt: now };
          stabilizedCw = newCw;
          cached.callWallOi = newCwOi;
          cached.lastCwUpdatedAt = now;
          cached.lastUpdatedAt = now;
          cached.lastMigrationAt = now;
          cached.lastMigrationReason = reason;
          cached.cwCandidate = undefined;
          cached.cwDriftCandidate = undefined;
          wallMigrated = true;
          wallMigrationReason = reason;
        }
      }
    }
  }

  // Per-level cooldown evaluation for Put Wall:
  const timeSincePwUpdate = now - (cached.lastPwUpdatedAt || cached.lastUpdatedAt);
  const isPwCooldownPassed = timeSincePwUpdate >= horizonCooldownMs;
  const isSyntheticToRealPw = Boolean(cached.report.isSynthetic && !freshReport.isSynthetic);
  const isOldPwVanished = !currentPwStrikeInFresh || (currentPwStrikeInFresh.putOi || 0) === 0;

  // Track PW candidate for OI leader persistence
  if (newPw !== currentPw) {
    if (cached.pwCandidate && cached.pwCandidate.strike === newPw) {
      cached.pwCandidate.count += 1;
    } else {
      cached.pwCandidate = { strike: newPw, count: 1, firstSeenAt: now };
    }
  } else {
    cached.pwCandidate = undefined;
  }

  // Track PW candidate for corridor_drift (|stabilized - fresh| >= 2 * strikeStep)
  const isPwDiff2Steps = Math.abs(newPw - currentPw) >= 2 * strikeStep - 1e-6;
  if (isPwDiff2Steps) {
    if (cached.pwDriftCandidate && cached.pwDriftCandidate.strike === newPw) {
      cached.pwDriftCandidate.count += 1;
    } else {
      cached.pwDriftCandidate = { strike: newPw, count: 1, firstSeenAt: now };
    }
  } else {
    cached.pwDriftCandidate = undefined;
  }

  // 1b. Стабилизация Put Wall (Пол):
  if (newPw !== currentPw) {
    const prevPwOi = cached.putWallOi;
    const isNewPwStronger = prevPwOi > 0
      ? new Decimal(newPwOi).gte(new Decimal(prevPwOi).times(new Decimal(gateConfig.oiMargin)))
      : newPwOi > 0;
    const isPwPersistent = Boolean(cached.pwCandidate && cached.pwCandidate.count >= gateConfig.persistCount);
    const isPwDriftPersistent = Boolean(cached.pwDriftCandidate && cached.pwDriftCandidate.count >= gateConfig.persistCount);

    const shouldMigratePw =
      isPwSourceSwitch ||
      isPwBreached ||
      (isNewDaySession && isPwCooldownPassed) ||
      isSyntheticToRealPw ||
      isOldPwVanished ||
      (isPwCooldownPassed && (isNewPwStronger || isPwPersistent || isPwDriftPersistent));

    if (shouldMigratePw) {
      let reason: StabilizerMigrationReason = "cooldown+OI";
      if (isPwSourceSwitch) {
        reason = "source_switch";
      } else if (isPwBreached || isOldPwVanished) {
        reason = "breach";
      } else if (isSyntheticToRealPw) {
        reason = "reset";
      } else if (isNewDaySession) {
        reason = "new session";
      } else if (isPwDriftPersistent) {
        reason = "corridor_drift";
      } else if (isPwPersistent && !isNewPwStronger) {
        reason = "oi_leader_persistent";
      } else {
        reason = "cooldown+OI";
      }

      if ((reason === "cooldown+OI" || reason === "oi_leader_persistent" || reason === "corridor_drift") && !isPwCooldownPassed) {
        console.warn(
          `[GEX Stabilizer] Blocked PW migration: cooldown not passed (${Math.round(timeSincePwUpdate / 60000)}m < ${Math.round(horizonCooldownMs / 60000)}m)`
        );
      } else {
        const details =
          reason === "source_switch"
            ? `source switch (${prevSource} -> ${currentSource}): fresh PW=${newPw} differs from stabilized PW=${currentPw} by > 2 steps (${2 * strikeStep})`
            : reason === "breach"
            ? `spot=${spot} breached PW=${currentPw} (${isPwBreakout ? "breakout < -0.15%" : `corridor ratio ${(gateConfig.corridorRatio * 100).toFixed(1)}% exceeded`})`
            : reason === "new session"
            ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
            : reason === "reset"
            ? `synthetic-to-real transition: adopting exchange chain (PW=${newPw}, OI=${newPwOi})`
            : reason === "corridor_drift"
            ? `corridor_drift: |stabilized ${currentPw} - fresh ${newPw}| >= 2 steps (${2 * strikeStep}) held for ${cached.pwDriftCandidate?.count || gateConfig.persistCount} reports (cooldown=${Math.round(timeSincePwUpdate / 60000)}m >= ${Math.round(horizonCooldownMs / 60000)}m)`
            : reason === "oi_leader_persistent"
            ? `oi_leader_persistent: new candidate PW=${newPw} held for ${cached.pwCandidate?.count || gateConfig.persistCount} reports (cooldown=${Math.round(timeSincePwUpdate / 60000)}m >= ${Math.round(horizonCooldownMs / 60000)}m)`
            : `cooldown=${Math.round(timeSincePwUpdate / 60000)}m>=${Math.round(horizonCooldownMs / 60000)}m & newPwOi=${newPwOi}>=prevPwOi=${prevPwOi}*${gateConfig.oiMargin.toFixed(2)}`;

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
          cached.previousPw = { value: currentPw, migratedAt: now };
          stabilizedPw = newPw;
          cached.putWallOi = newPwOi;
          cached.lastPwUpdatedAt = now;
          cached.lastUpdatedAt = now;
          cached.lastMigrationAt = now;
          cached.lastMigrationReason = reason;
          cached.pwCandidate = undefined;
          cached.pwDriftCandidate = undefined;
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
  const isFlipCooldownPassed = timeSinceFlipUpdate >= horizonCooldownMs;

  if (newFlip !== currentFlip) {
    const flipShiftRatio = Math.abs(newFlip - currentFlip) / Math.max(0.0001, spot);
    const isFlipOutOfBounds = currentFlip < stabilizedPw || currentFlip > stabilizedCw;
    const isSignificantFlipShift = flipShiftRatio >= 0.005 || Math.abs(spot - currentFlip) / Math.max(0.0001, spot) > 0.008;
    const isFlipSourceSwitch = isSourceSwitched && Math.abs(newFlip - currentFlip) > 2 * strikeStep;
    if (wallMigrated || isFlipOutOfBounds || isNewDaySession || isFlipSourceSwitch || (isFlipCooldownPassed && isSignificantFlipShift)) {
      const reason: StabilizerMigrationReason = isFlipOutOfBounds
        ? "breach"
        : isNewDaySession
        ? "new session"
        : isFlipSourceSwitch
        ? "source_switch"
        : wallMigrated && wallMigrationReason
        ? wallMigrationReason
        : "cooldown+OI";
      const details = isFlipOutOfBounds
        ? `flip=${currentFlip} outside corridor [${stabilizedPw}, ${stabilizedCw}]`
        : isNewDaySession
        ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
        : isFlipSourceSwitch
        ? `source switch (${prevSource} -> ${currentSource}): flip shift > 2 steps`
        : wallMigrated
        ? `coupled wall migration (${wallMigrationReason})`
        : `cooldown>=${Math.round(horizonCooldownMs / 60000)}m & flipShift=${(flipShiftRatio * 100).toFixed(2)}%`;

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
        cached.previousFlip = { value: currentFlip, migratedAt: now };
        stabilizedFlip = newFlip;
        cached.lastFlipUpdatedAt = now;
        cached.lastUpdatedAt = now;
        cached.lastMigrationAt = now;
        cached.lastMigrationReason = reason;
      }
    }
  }

  const timeSincePainUpdate = now - (cached.lastPainUpdatedAt || cached.lastUpdatedAt);
  const isPainCooldownPassed = timeSincePainUpdate >= horizonCooldownMs;

  if (newPain !== currentPain) {
    const painShiftRatio = Math.abs(newPain - currentPain) / Math.max(0.0001, spot);
    const isPainOutOfBounds = currentPain <= stabilizedPw || currentPain >= stabilizedCw;
    const isSignificantPainShift = painShiftRatio >= 0.005;
    const isPainSourceSwitch = isSourceSwitched && Math.abs(newPain - currentPain) > 2 * strikeStep;
    if (wallMigrated || isPainOutOfBounds || isNewDaySession || isPainSourceSwitch || (isPainCooldownPassed && isSignificantPainShift)) {
      const reason: StabilizerMigrationReason = isPainOutOfBounds
        ? "breach"
        : isNewDaySession
        ? "new session"
        : isPainSourceSwitch
        ? "source_switch"
        : wallMigrated && wallMigrationReason
        ? wallMigrationReason
        : "cooldown+OI";
      const details = isPainOutOfBounds
        ? `pain=${currentPain} outside interior corridor (${stabilizedPw}, ${stabilizedCw})`
        : isNewDaySession
        ? `exchange(${exchangeTz}) session roll ${lastDateStr} -> ${nowDateStr}`
        : isPainSourceSwitch
        ? `source switch (${prevSource} -> ${currentSource}): pain shift > 2 steps`
        : wallMigrated
        ? `coupled wall migration (${wallMigrationReason})`
        : `cooldown>=${Math.round(horizonCooldownMs / 60000)}m & painShift=${(painShiftRatio * 100).toFixed(2)}%`;

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
        cached.previousPain = { value: currentPain, migratedAt: now };
        stabilizedPain = newPain;
        stabilizedPainRange = newPainRange;
        cached.lastPainUpdatedAt = now;
        cached.lastUpdatedAt = now;
        cached.lastMigrationAt = now;
        cached.lastMigrationReason = reason;
      }
    }
  } else {
    stabilizedPainRange = newPainRange;
  }

  // Обновляем текущий источник данных в кэше
  cached.dataSource = currentSource;

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
    lastMigrationAt: cached.lastMigrationAt,
    lastMigrationReason: cached.lastMigrationReason,
    nextMigrationAllowedAt: (cached.lastMigrationAt || now) + gateConfig.cooldownMs,
    timestamp: new Date().toISOString()
  };

  cached.report = finalReport;
  return enrichReportWithStandardLabels(finalReport, spotPrice);

}

export interface ResetGexCacheOptions {
  force?: boolean;
  freshValues?: {
    callWall: number;
    putWall: number;
    gammaFlip: number;
    maxPain: number;
  };
}

export interface ResetGexCacheResult {
  success: boolean;
  blocked?: boolean;
  warning?: string;
  message?: string;
  diff?: string;
}

// Stores previous stabilized levels before reset to compute full 4-level diff
const pendingResetDiffs = new Map<string, {
  cw: number;
  pw: number;
  flip: number;
  pain: number;
}>();

/**
 * 3. Guard кнопки reset: если есть активный locked-сетап (status ACTIVE_IN_TRADE или WAITING_FOR_ENTRY),
 * reset возвращает ответ с предупреждением и НЕ меняет уровни, пока не передан явный флаг force:true.
 * 5. В migration-log для reason=reset пиши diff до/после по всем четырём уровням.
 */
export function resetStabilizedGexCache(
  asset?: string,
  horizon?: ExpiryHorizon,
  options?: ResetGexCacheOptions
): ResetGexCacheResult {
  const isTradeActiveNow = isTradeActiveChecker();
  if (isTradeActiveNow && !options?.force) {
    const warning = "Активна сделка — уровни прыгнут под позицией. Продолжить?";
    console.warn(`[GEX Stabilizer] Reset BLOCKED: active trade/setup is running and force=false.`);
    return {
      success: false,
      blocked: true,
      warning,
      message: warning
    };
  }

  clearGexEngineCache();
  const nowIso = new Date().toISOString();
  let diffStr = "";

  if (asset) {
    const u = asset.toUpperCase();
    const targetHorizon = horizon ? (horizon.toUpperCase() as ExpiryHorizon) : undefined;
    pendingResetKeys.add(u);
    let clearedAny = false;

    for (const [k, rec] of Array.from(stabilizedCache.entries())) {
      const matchAsset = k.startsWith(u);
      const matchHorizon = !targetHorizon || rec.horizon === targetHorizon;
      if (matchAsset && matchHorizon) {
        pendingResetKeys.add(k);
        const prevLevels = {
          cw: rec.report.callWall,
          pw: rec.report.putWall,
          flip: rec.report.gammaFlip,
          pain: rec.report.maxPain
        };
        pendingResetDiffs.set(k, prevLevels);

        const fresh = options?.freshValues;
        const diffDetails = fresh
          ? `CW ${prevLevels.cw} -> ${fresh.callWall}, PW ${prevLevels.pw} -> ${fresh.putWall}, Flip ${Math.round(prevLevels.flip)} -> ${Math.round(fresh.gammaFlip)}, Pain ${prevLevels.pain} -> ${fresh.maxPain}`
          : `CW ${prevLevels.cw} -> pending, PW ${prevLevels.pw} -> pending, Flip ${Math.round(prevLevels.flip)} -> pending, Pain ${prevLevels.pain} -> pending`;

        diffStr = diffDetails;

        recordStabilizerMigration({
          timestamp: nowIso,
          asset: rec.asset,
          horizon: rec.horizon,
          level: "ALL",
          oldValue: rec.report.maxPain,
          newValue: fresh ? fresh.maxPain : 0,
          reason: "reset",
          details: `Manual stabilizer cache reset: Diff: [${diffDetails}]`,
          freshValues: fresh
        });
        stabilizedCache.delete(k);
        incrementalStrikeCache.delete(k);
        clearedAny = true;
      }
    }

    if (!clearedAny) {
      const fresh = options?.freshValues;
      const diffDetails = fresh
        ? `CW init -> ${fresh.callWall}, PW init -> ${fresh.putWall}, Flip init -> ${Math.round(fresh.gammaFlip)}, Pain init -> ${fresh.maxPain}`
        : `Stabilizer cache reset requested for ${u}`;
      diffStr = diffDetails;

      recordStabilizerMigration({
        timestamp: nowIso,
        asset: u,
        horizon: targetHorizon || "WEEK",
        level: "ALL",
        oldValue: null,
        newValue: fresh ? fresh.maxPain : 0,
        reason: "reset",
        details: `Manual reset requested: Diff: [${diffDetails}]`,
        freshValues: fresh
      });
    }
  } else {
    // Global reset
    globalResetPending = true;
    for (const [k, rec] of Array.from(stabilizedCache.entries())) {
      pendingResetKeys.add(k);
      const prevLevels = {
        cw: rec.report.callWall,
        pw: rec.report.putWall,
        flip: rec.report.gammaFlip,
        pain: rec.report.maxPain
      };
      pendingResetDiffs.set(k, prevLevels);

      const diffDetails = `CW ${prevLevels.cw} -> pending, PW ${prevLevels.pw} -> pending, Flip ${Math.round(prevLevels.flip)} -> pending, Pain ${prevLevels.pain} -> pending`;
      recordStabilizerMigration({
        timestamp: nowIso,
        asset: rec.asset,
        horizon: rec.horizon,
        level: "ALL",
        oldValue: rec.report.maxPain,
        newValue: 0,
        reason: "reset",
        details: `Global stabilizer cache reset: Diff: [${diffDetails}]`
      });
    }
    stabilizedCache.clear();
    incrementalStrikeCache.clear();
  }

  return {
    success: true,
    blocked: false,
    message: "Кэш стабилизатора успешно сброшен",
    diff: diffStr
  };
}
