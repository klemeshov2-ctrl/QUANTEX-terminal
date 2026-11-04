// 🏛️ QUANTEX Unified GEX Formatting & Dynamic Role Standard
// Единый стандарт именования и динамической смены ролей опционных уровней

export type GexLevelType = "CALL_WALL" | "PUT_WALL" | "GAMMA_FLIP" | "MAX_PAIN" | "SLEEPER_MAGNET";
export type GexHorizon = "DAY" | "WEEK" | "MONTH" | "ALL";

export interface GexRoleInfo {
  baseName: string;         // "Потолок (CW)", "Пол (PW)", "Флип (Flip)", "Магнит"
  fullName: string;         // e.g. "Потолок (CW, Дневной): 4030"
  role: string;             // e.g. "Сопротивление (Бывшая поддержка)"
  roleLabel: string;        // e.g. "Сопротивление (Бывшая поддержка)" (alias for role)
  shortRole: string;        // "Сопротивление" | "Поддержка" | "Нейтральный флип" | "Магнит"
  isBroken: boolean;        // Пробит ли уровень текущей ценой
  distancePts: number;      // Дистанция от спота в пунктах
  distancePct: number;      // Дистанция от спота в %
  directionFromSpot: "ABOVE" | "BELOW" | "AT_SPOT";
}

/**
 * Возвращает русское обозначение горизонта экспирации
 */
export function getExpirySuffix(horizon?: GexHorizon | string): string {
  if (!horizon) return "Недельный";
  const h = horizon.toUpperCase();
  if (h.includes("DAY") || h === "0DTE" || h === "1DTE" || h === "DAILY") return "Дневной";
  if (h.includes("MONTH") || h === "MONTHLY") return "Месячный";
  if (h.includes("ALL")) return "Все экспирации";
  return "Недельный";
}

/**
 * Базовое стандартизированное русское название уровня
 */
export function getBaseLevelName(type: GexLevelType | string): string {
  const norm = type.toUpperCase().replace(/[\s_-]/g, "");
  if (norm.includes("CALL") || norm === "CW") return "Потолок (CW)";
  if (norm.includes("PUT") || norm === "PW") return "Пол (PW)";
  if (norm.includes("FLIP") || norm.includes("ZERO")) return "Флип (Flip)";
  if (norm.includes("PAIN") || norm.includes("MAGNET")) return "Магнит";
  return "Опционный барьер";
}

export interface MaxPainPinningRange {
  low: number;
  high: number;
  mid?: number;
}

export function formatStrikeNumber(val: number): string {
  if (!isFinite(val)) return "0";
  if (Math.abs(val - Math.round(val)) < 1e-6) {
    return String(Math.round(val));
  }
  return val >= 1000 ? val.toFixed(1) : val.toFixed(2);
}

export function formatMaxPainRangeValue(
  levelPrice: number,
  maxPainRange?: MaxPainPinningRange | null
): string {
  if (
    maxPainRange &&
    isFinite(maxPainRange.low) &&
    isFinite(maxPainRange.high) &&
    maxPainRange.high > maxPainRange.low + 1e-6
  ) {
    const midVal = isFinite(maxPainRange.mid as number) ? (maxPainRange.mid as number) : levelPrice;
    return `${formatStrikeNumber(maxPainRange.low)}–${formatStrikeNumber(maxPainRange.high)} (середина ${formatStrikeNumber(midVal)})`;
  }
  return levelPrice >= 1000 ? levelPrice.toFixed(1) : levelPrice.toFixed(2);
}

/**
 * 3. Динамическая смена ролей (Level Role Engine)
 * Если цена пробила PW и находится ниже — уровень становится «Сопротивление (Бывшая поддержка)».
 * Если цена пробила CW и находится выше — уровень становится «Поддержка (Бывшее сопротивление)».
 */
export function getLevelRole(
  levelType: GexLevelType | string,
  levelPrice: number,
  spotPrice: number,
  horizon?: GexHorizon | string,
  maxPainRange?: MaxPainPinningRange | null
): GexRoleInfo {
  const baseName = getBaseLevelName(levelType);
  const expiry = getExpirySuffix(horizon);
  const diff = spotPrice - levelPrice;
  const absDiff = Math.abs(diff);
  const distancePct = levelPrice > 0 ? (absDiff / levelPrice) * 100 : 0;
  const directionFromSpot = Math.abs(diff) < 0.1 ? "AT_SPOT" : diff > 0 ? "BELOW" : "ABOVE";

  const normType = levelType.toUpperCase().replace(/[\s_-]/g, "");
  const isCw = normType.includes("CALL") || normType === "CW";
  const isPw = normType.includes("PUT") || normType === "PW";
  const isFlip = normType.includes("FLIP") || normType.includes("ZERO");
  const isMagnet = normType.includes("PAIN") || normType.includes("MAGNET");

  let role = "Институциональный барьер";
  let shortRole = "Уровень";
  let isBroken = false;

  const breakoutMargin = Math.max(0.01, levelPrice * 0.0015);

  if (isCw) {
    if (spotPrice > levelPrice + breakoutMargin) {
      // Цена пробила Call Wall вверх — уровень стал поддержкой
      isBroken = true;
      role = "Поддержка (Бывшее сопротивление)";
      shortRole = "Поддержка";
    } else {
      role = "Ключевое сопротивление дилеров";
      shortRole = "Сопротивление";
    }
  } else if (isPw) {
    if (spotPrice < levelPrice - breakoutMargin) {
      // Цена пробила Put Wall вниз — уровень стал сопротивлением
      isBroken = true;
      role = "Сопротивление (Бывшая поддержка)";
      shortRole = "Сопротивление";
    } else {
      role = "Институциональная поддержка (Пол)";
      shortRole = "Поддержка";
    }
  } else if (isFlip) {
    if (spotPrice >= levelPrice) {
      role = "Поддержка режима (+GEX, низкая волатильность)";
      shortRole = "Поддержка режима";
    } else {
      role = "Сопротивление режима (-GEX, ускорение волатильности)";
      shortRole = "Сопротивление режима";
    }
  } else if (isMagnet) {
    role = "Точка притяжения экспирации (Pinning Target)";
    shortRole = "Магнит";
  }

  const priceStr = isMagnet
    ? formatMaxPainRangeValue(levelPrice, maxPainRange)
    : levelPrice >= 1000
    ? levelPrice.toFixed(1)
    : levelPrice.toFixed(2);
  const titleWithExpiry = baseName.includes("(")
    ? baseName.replace(/\)$/, `, ${expiry})`)
    : `${baseName} (${expiry})`;
  const fullName = `${titleWithExpiry}: ${priceStr}`;

  return {
    baseName,
    fullName,
    role,
    roleLabel: role,
    shortRole,
    isBroken,
    distancePts: Math.round(absDiff * 100) / 100,
    distancePct: Math.round(distancePct * 100) / 100,
    directionFromSpot
  };
}

/**
 * Единое стандартизированное форматирование для текстовых сводок и UI
 * Поддерживает как объект параметров { type, price, horizon, spotPrice, maxPainRange },
 * так и позиционные аргументы (type, price, horizon, spotPrice, maxPainRange).
 */
export function formatGexLevelLabel(
  typeOrParams:
    | GexLevelType
    | string
    | {
        type: GexLevelType | string;
        price: number;
        horizon?: GexHorizon | string;
        spotPrice?: number;
        maxPainRange?: MaxPainPinningRange | null;
      },
  priceArg?: number,
  horizonArg?: GexHorizon | string,
  spotPriceArg?: number,
  maxPainRangeArg?: MaxPainPinningRange | null
): string {
  let type: GexLevelType | string;
  let price: number;
  let horizon: GexHorizon | string | undefined = horizonArg;
  let spotPrice: number | undefined = spotPriceArg;
  let maxPainRange: MaxPainPinningRange | null | undefined = maxPainRangeArg;

  if (typeof typeOrParams === "object" && typeOrParams !== null) {
    type = typeOrParams.type;
    price = typeOrParams.price;
    horizon = typeOrParams.horizon;
    spotPrice = typeOrParams.spotPrice;
    maxPainRange = typeOrParams.maxPainRange;
  } else {
    type = typeOrParams as GexLevelType | string;
    price = priceArg ?? 0;
  }

  const base = getBaseLevelName(type);
  const exp = getExpirySuffix(horizon);
  const normType = type.toUpperCase().replace(/[\s_-]/g, "");
  const isMagnet = normType.includes("PAIN") || normType.includes("MAGNET");
  const pStr = isMagnet
    ? formatMaxPainRangeValue(price, maxPainRange)
    : price >= 1000
    ? price.toFixed(1)
    : price.toFixed(2);
  const titleWithExpiry = base.includes("(")
    ? base.replace(/\)$/, `, ${exp})`)
    : `${base} (${exp})`;

  if (typeof spotPrice === "number" && spotPrice > 0) {
    const roleInfo = getLevelRole(type, price, spotPrice, horizon, maxPainRange);
    if (roleInfo.isBroken) {
      return `${titleWithExpiry}: ${pStr} [${roleInfo.role}]`;
    }
  }

  return `${titleWithExpiry}: ${pStr}`;
}

export interface GexFreshDiffPreview {
  text: string;
  hasDivergence: boolean;
  diffs: string[];
}

/**
 * Рассчитывает расхождение "стаб → свеж" по CW/PW/Flip/Pain для предпросмотра в UI и логирования
 */
export function formatGexFreshDiffPreview(
  report?: {
    callWall?: number;
    putWall?: number;
    gammaFlip?: number;
    maxPain?: number;
    freshValues?: {
      callWall: number;
      putWall: number;
      gammaFlip: number;
      maxPain: number;
    };
  } | null
): GexFreshDiffPreview {
  if (!report || !report.freshValues) {
    return { text: "Синхронизировано", hasDivergence: false, diffs: [] };
  }
  const f = report.freshValues;
  const diffs: string[] = [];

  if (typeof report.callWall === "number" && typeof f.callWall === "number" && report.callWall !== f.callWall) {
    diffs.push(`CW ${report.callWall}→${f.callWall}`);
  }
  if (typeof report.putWall === "number" && typeof f.putWall === "number" && report.putWall !== f.putWall) {
    diffs.push(`PW ${report.putWall}→${f.putWall}`);
  }
  if (
    typeof report.gammaFlip === "number" &&
    typeof f.gammaFlip === "number" &&
    Math.round(report.gammaFlip) !== Math.round(f.gammaFlip)
  ) {
    diffs.push(`Flip ${Math.round(report.gammaFlip)}→${Math.round(f.gammaFlip)}`);
  }
  if (typeof report.maxPain === "number" && typeof f.maxPain === "number" && report.maxPain !== f.maxPain) {
    diffs.push(`Pain ${report.maxPain}→${f.maxPain}`);
  }

  if (diffs.length === 0) {
    return { text: "Синхронизировано", hasDivergence: false, diffs: [] };
  }
  return { text: diffs.join(", "), hasDivergence: true, diffs };
}
