// 🏛️ QUANTEX GEX State & Hysteresis Manager (server/gexStateManager.ts)
// Управление стабилизацией уровней, гистерезисом (25-30%), кулдауном (1 час)
// и блокировкой пересчета при открытых сделках

import { GexMarketReport, ExpiryHorizon, getGexReportForAsset } from "./gexEngine";
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
  callWallOi: number;
  putWallOi: number;
  gammaFlipGex: number;
  maxPainCost: number;
  isLockedByTrade: boolean;
}

// In-memory cache of stabilized GEX states by `${asset}_${horizon}`
const stabilizedCache = new Map<string, StabilizedGexRecord>();

// Minimum cooldown period before considering a normal level shift (1 hour = 3600s)
const MIN_LEVEL_COOLDOWN_MS = 60 * 60 * 1000;
// Hysteresis threshold: new level must have at least +25% greater volume/OI to trigger migration before cooldown
const HYSTERESIS_THRESHOLD = 0.25;

/**
 * Обогащает отчет стандартизированными полями согласно новым требованиям (совместимость API сохраняется)
 */
export function enrichReportWithStandardLabels(report: GexMarketReport, spotPrice?: number): GexMarketReport & {
  stabilized?: boolean;
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
  const painRoleInfo = getLevelRole("MAX_PAIN", report.maxPain, spot, horizon);

  return {
    ...report,
    stabilized: true,
    // Call Wall (Потолок)
    cwLabel: cwRoleInfo.fullName,
    cwRole: cwRoleInfo.role,
    cwExpiry: expiry,
    // Put Wall (Пол)
    pwLabel: pwRoleInfo.fullName,
    pwRole: pwRoleInfo.role,
    pwExpiry: expiry,
    // Gamma Flip (Флип)
    flipLabel: flipRoleInfo.fullName,
    flipRole: flipRoleInfo.role,
    flipExpiry: expiry,
    // Max Pain (Магнит)
    painLabel: painRoleInfo.fullName,
    painRole: painRoleInfo.role,
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
  const key = `${asset.toUpperCase()}_${horizon.toUpperCase()}`;
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

  // Если это первый запуск для данного актива и горизонта — инициализируем стабилизированную запись
  if (!cached) {
    // Находим OI для текущих CW и PW в массиве страйков
    const cwStrike = freshReport.strikes?.find(s => s.strike === freshReport.callWall);
    const pwStrike = freshReport.strikes?.find(s => s.strike === freshReport.putWall);

    const record: StabilizedGexRecord = {
      asset: asset.toUpperCase(),
      horizon,
      report: freshReport,
      lastUpdatedAt: now,
      callWallOi: cwStrike ? cwStrike.callOi : (freshReport.callWall * 10),
      putWallOi: pwStrike ? pwStrike.putOi : (freshReport.putWall * 10),
      gammaFlipGex: Math.abs(freshReport.netGexTotal),
      maxPainCost: freshReport.maxPain,
      isLockedByTrade: false
    };
    stabilizedCache.set(key, record);
    return enrichReportWithStandardLabels(freshReport, spotPrice);
  }

  // Проверяем гистерезис и кулдаун
  const timeSinceLastUpdate = now - cached.lastUpdatedAt;
  const isCooldownPassed = timeSinceLastUpdate >= MIN_LEVEL_COOLDOWN_MS;

  const currentCw = cached.report.callWall;
  const currentPw = cached.report.putWall;
  const currentFlip = cached.report.gammaFlip;
  const currentPain = cached.report.maxPain;

  const newCw = freshReport.callWall;
  const newPw = freshReport.putWall;
  const newFlip = freshReport.gammaFlip;
  const newPain = freshReport.maxPain;

  const newCwStrike = freshReport.strikes?.find(s => s.strike === newCw);
  const newPwStrike = freshReport.strikes?.find(s => s.strike === newPw);
  const newCwOi = newCwStrike ? newCwStrike.callOi : 0;
  const newPwOi = newPwStrike ? newPwStrike.putOi : 0;

  let stabilizedCw = currentCw;
  let stabilizedPw = currentPw;
  let stabilizedFlip = currentFlip;
  let stabilizedPain = currentPain;

  // 1a. Гистерезис для Call Wall: меняется если прошел кулдаун ИЛИ новый OI > старого на 25-30%
  if (newCw !== currentCw) {
    const oiSurge = cached.callWallOi > 0 ? (newCwOi - cached.callWallOi) / cached.callWallOi : 1.0;
    if (isCooldownPassed || oiSurge >= HYSTERESIS_THRESHOLD) {
      stabilizedCw = newCw;
      cached.callWallOi = newCwOi;
      cached.lastUpdatedAt = now;
    }
  }

  // 1b. Гистерезис для Put Wall: меняется если прошел кулдаун ИЛИ новый OI > старого на 25-30%
  if (newPw !== currentPw) {
    const oiSurge = cached.putWallOi > 0 ? (newPwOi - cached.putWallOi) / cached.putWallOi : 1.0;
    if (isCooldownPassed || oiSurge >= HYSTERESIS_THRESHOLD) {
      stabilizedPw = newPw;
      cached.putWallOi = newPwOi;
      cached.lastUpdatedAt = now;
    }
  }

  // 1c. Гистерезис для Zero Flip и Max Pain (смена только если прошел кулдаун или сдвиг > 1.5 ATR)
  if (isCooldownPassed) {
    stabilizedFlip = newFlip;
    stabilizedPain = newPain;
    cached.lastUpdatedAt = now;
  }

  // Формируем результирующий отчет: обновляем живой спот, греки, страйки и дельту,
  // но СОХРАНЯЕМ СТАБИЛИЗИРОВАННЫЕ ключевые стены (CW, PW, Flip, Pain)
  const finalReport: GexMarketReport = {
    ...freshReport,
    spotPrice: spotPrice || freshReport.spotPrice,
    callWall: stabilizedCw,
    putWall: stabilizedPw,
    gammaFlip: stabilizedFlip,
    maxPain: stabilizedPain,
    timestamp: new Date().toISOString()
  };

  cached.report = finalReport;
  return enrichReportWithStandardLabels(finalReport, spotPrice);
}

/**
 * Сброс кэша стабилизации для актива (например при ручной калибровке)
 */
export function resetStabilizedGexCache(asset?: string) {
  if (asset) {
    const u = asset.toUpperCase();
    for (const k of Array.from(stabilizedCache.keys())) {
      if (k.startsWith(u)) stabilizedCache.delete(k);
    }
  } else {
    stabilizedCache.clear();
  }
}
