/**
 * marketSessions.ts
 * Сезонно-осознанный движок расписания сессий и макро-событий в МСК.
 * Автоматически рассчитывает летнее/зимнее время (DST) США и Великобритании (UK)
 * без хардкода одного сезона. Изоморфен (работает и в Node.js / server, и в браузере / React).
 */

export type Season = "WINTER" | "SUMMER";

export interface SessionSchedule {
  seasonUs: Season;
  seasonUk: Season;
  etToMsk: number;     // Смещение ET к МСК в часах (+8 зима, +7 лето)
  ukToMsk: number;     // Смещение UK к МСК в часах (+3 зима, +2 лето)
  ctToMsk: number;     // Смещение CT (Чикаго, CME) к МСК (+9 зима, +8 лето)
  
  // Времена МСК в формате "HH:MM"
  usPremarketMsk: string;   // 04:00 ET -> зима 12:00 / лето 11:00 МСК
  usOpenMsk: string;        // 09:30 ET -> зима 17:30 / лето 16:30 МСК
  usCloseMsk: string;       // 16:00 ET -> зима 00:00 / лето 23:00 МСК
  macro0830Msk: string;     // 08:30 ET (CPI, NFP, Claims, PPI) -> зима 16:30 / лето 15:30 МСК
  ism1000Msk: string;       // 10:00 ET (ISM, Michigan) -> зима 18:00 / лето 17:00 МСК
  eia1030Msk: string;       // 10:30 ET (Запасы нефти EIA ср) -> зима 18:30 / лето 17:30 МСК
  fomc1400Msk: string;      // 14:00 ET (Решение ФРС) -> зима 22:00 / лето 21:00 МСК
  fomcPress1430Msk: string; // 14:30 ET (Пресс-конференция ФРС) -> зима 22:30 / лето 21:30 МСК
  auction1300Msk: string;   // 13:00 ET (Аукционы US10Y/30Y) -> зима 21:00 / лето 20:00 МСК
  cmeSunOpenMsk: string;    // 17:00 CT вс -> зима 02:00 МСК пн / лето 01:00 МСК пн
  londonOpenMsk: string;    // 08:00 UK -> зима 11:00 / лето 10:00 МСК
  londonCloseMsk: string;   // 16:30 UK -> зима 19:30 / лето 18:30 МСК

  // Времена в минутах от начала суток МСК (для удобства сравнений curMins)
  usOpenMins: number;
  usCloseMins: number;
  macro0830Mins: number;
  ism1000Mins: number;
  eia1030Mins: number;
  fomc1400Mins: number;
  fomcPress1430Mins: number;
  auction1300Mins: number;
  londonOpenMins: number;
  londonCloseMins: number;

  // Константы без DST
  asiaRangeMsk: string;     // 00:00–08:00 МСК
  tokyoOpenMsk: string;     // 03:00 МСК (09:00 JST)
  moexStartMsk: string;     // 07:00 МСК (аукцион 08:50, основная 10:00)
  moexClearingDayMsk: string;   // 14:00–14:05 МСК
  moexClearingEveMsk: string;   // 18:50–19:05 МСК
  moexCloseMsk: string;     // 23:50 МСК
  deribitDailyExpiryMsk: string; // 11:00 МСК (08:00 UTC)
  occOiPublicationMsk: string;   // 06:00–08:00 МСК следующего дня

  dangerWindowsMsk: string[];
  labelRu: string;
  isDesyncWeek: boolean;
  desyncNoteRu?: string;
}

/**
 * Правило перехода США на летнее время (Energy Policy Act of 2005):
 * ЛЕТО (EDT, UTC-4): со 2-го воскресенья марта 07:00 UTC (02:00 EST)
 * до 1-го воскресенья ноября 06:00 UTC (02:00 EDT).
 * В остальное время ЗИМА (EST, UTC-5).
 */
export function getUsSeason(date: Date = new Date()): Season {
  const year = date.getUTCFullYear();

  // 2-е воскресенье марта в 07:00 UTC
  // 1 марта:
  const march1Day = new Date(Date.UTC(year, 2, 1)).getUTCDay();
  // Первое воскресенье марта (day 0):
  const firstSunMarch = 1 + ((7 - march1Day) % 7);
  const secondSunMarch = firstSunMarch + 7;
  const startDstUtc = Date.UTC(year, 2, secondSunMarch, 7, 0, 0, 0);

  // 1-е воскресенье ноября в 06:00 UTC
  const nov1Day = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstSunNov = 1 + ((7 - nov1Day) % 7);
  const endDstUtc = Date.UTC(year, 10, firstSunNov, 6, 0, 0, 0);

  const t = date.getTime();
  return t >= startDstUtc && t < endDstUtc ? "SUMMER" : "WINTER";
}

/**
 * Правило перехода Великобритании (UK) на летнее время (BST):
 * ЛЕТО (BST, UTC+1): с последнего воскресенья марта 01:00 UTC
 * до последнего воскресенья октября 01:00 UTC.
 * В остальное время ЗИМА (GMT, UTC+0).
 */
export function getUkSeason(date: Date = new Date()): Season {
  const year = date.getUTCFullYear();

  // Последнее воскресенье марта в 01:00 UTC
  const march31Day = new Date(Date.UTC(year, 2, 31)).getUTCDay();
  const lastSunMarch = 31 - march31Day;
  const startDstUtc = Date.UTC(year, 2, lastSunMarch, 1, 0, 0, 0);

  // Последнее воскресенье октября в 01:00 UTC
  const oct31Day = new Date(Date.UTC(year, 9, 31)).getUTCDay();
  const lastSunOct = 31 - oct31Day;
  const endDstUtc = Date.UTC(year, 9, lastSunOct, 1, 0, 0, 0);

  const t = date.getTime();
  return t >= startDstUtc && t < endDstUtc ? "SUMMER" : "WINTER";
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function minsToHhMm(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Вычисляет полное сезонно-осознанное расписание торговых сессий и макро-событий в МСК.
 */
export function getSessionSchedule(date: Date = new Date()): SessionSchedule {
  const seasonUs = getUsSeason(date);
  const seasonUk = getUkSeason(date);

  // Смещения к МСК (МСК = UTC+3 круглый год):
  // US ET: зима EST = UTC-5 -> offset = +8 ч; лето EDT = UTC-4 -> offset = +7 ч
  const etToMsk = seasonUs === "SUMMER" ? 7 : 8;
  // US CT (CME Chicago): зима CST = UTC-6 -> +9 ч; лето CDT = UTC-5 -> +8 ч
  const ctToMsk = seasonUs === "SUMMER" ? 8 : 9;
  // UK: зима GMT = UTC+0 -> offset = +3 ч; лето BST = UTC+1 -> offset = +2 ч
  const ukToMsk = seasonUk === "SUMMER" ? 2 : 3;

  // Производные границы в минутах МСК
  // 04:00 ET
  const usPremarketMins = (4 + etToMsk) * 60;
  // 09:30 ET = 9*60 + 30 + etToMsk*60
  const usOpenMins = 9 * 60 + 30 + etToMsk * 60;
  // 16:00 ET = 16*60 + etToMsk*60 -> зима 24*60 = 1440 (00:00), лето 23*60 (23:00)
  const usCloseMins = 16 * 60 + etToMsk * 60;
  // 08:30 ET
  const macro0830Mins = 8 * 60 + 30 + etToMsk * 60;
  // 10:00 ET
  const ism1000Mins = 10 * 60 + etToMsk * 60;
  // 10:30 ET
  const eia1030Mins = 10 * 60 + 30 + etToMsk * 60;
  // 14:00 ET
  const fomc1400Mins = 14 * 60 + etToMsk * 60;
  // 14:30 ET
  const fomcPress1430Mins = 14 * 60 + 30 + etToMsk * 60;
  // 13:00 ET
  const auction1300Mins = 13 * 60 + etToMsk * 60;

  // CME воскресенье 17:00 CT -> зима 17+9 = 26 ч (02:00 пн), лето 17+8 = 25 ч (01:00 пн)
  const cmeSunOpenMins = (17 + ctToMsk) * 60; // 1560 (02:00) or 1500 (01:00)

  // London: 08:00 UK -> 8 + ukToMsk; 16:30 UK -> 16.5 + ukToMsk
  const londonOpenMins = (8 + ukToMsk) * 60;
  const londonCloseMins = 16 * 60 + 30 + ukToMsk * 60;

  const usPremarketMsk = minsToHhMm(usPremarketMins);
  const usOpenMsk = minsToHhMm(usOpenMins);
  const usCloseMsk = minsToHhMm(usCloseMins);
  const macro0830Msk = minsToHhMm(macro0830Mins);
  const ism1000Msk = minsToHhMm(ism1000Mins);
  const eia1030Msk = minsToHhMm(eia1030Mins);
  const fomc1400Msk = minsToHhMm(fomc1400Mins);
  const fomcPress1430Msk = minsToHhMm(fomcPress1430Mins);
  const auction1300Msk = minsToHhMm(auction1300Mins);
  const cmeSunOpenMsk = minsToHhMm(cmeSunOpenMins);
  const londonOpenMsk = minsToHhMm(londonOpenMins);
  const londonCloseMsk = minsToHhMm(londonCloseMins);

  const labelRu = seasonUs === "SUMMER"
    ? "☀️ Лето США (EDT): сессия 16:30–23:00 МСК"
    : "🌨️ Зима США (EST): сессия 17:30–00:00 МСК";

  // Опасные окна (dangerWindowsMsk) в зависимости от сезона
  const dangerWindowsMsk = seasonUs === "SUMMER"
    ? [
        "15:30–16:00 (макро США + пре-маркет)",
        "16:30–17:00 (открытие Нью-Йорка, сбор стопов)",
        "17:00–17:45 (ISM / EIA / Мичиган)",
        "20:55–21:45 (решение и пресс-конференция FOMC)",
        "22:30–23:30 (закрытие США, экспирационный пиннинг, unwind гаммы)"
      ]
    : [
        "16:30–17:00 (макро США + пре-маркет)",
        "17:30–18:00 (открытие Нью-Йорка, сбор стопов)",
        "18:00–18:45 (ISM / EIA / Мичиган)",
        "21:55–22:45 (решение и пресс-конференция FOMC)",
        "23:30–00:30 (закрытие США, экспирационный пиннинг, unwind гаммы)"
      ];

  const isDesyncWeek = seasonUs !== seasonUk;
  let desyncNoteRu: string | undefined;
  if (isDesyncWeek) {
    desyncNoteRu = `⚠️ Переходная неделя рассинхрона: Великобритания (${seasonUk === "SUMMER" ? "BST лето" : "GMT зима"}), США (${seasonUs === "SUMMER" ? "EDT лето" : "EST зима"}). Лондон открывается в ${londonOpenMsk} МСК, Нью-Йорк в ${usOpenMsk} МСК.`;
  }

  return {
    seasonUs,
    seasonUk,
    etToMsk,
    ukToMsk,
    ctToMsk,
    usPremarketMsk,
    usOpenMsk,
    usCloseMsk,
    macro0830Msk,
    ism1000Msk,
    eia1030Msk,
    fomc1400Msk,
    fomcPress1430Msk,
    auction1300Msk,
    cmeSunOpenMsk,
    londonOpenMsk,
    londonCloseMsk,

    usOpenMins,
    usCloseMins,
    macro0830Mins,
    ism1000Mins,
    eia1030Mins,
    fomc1400Mins,
    fomcPress1430Mins,
    auction1300Mins,
    londonOpenMins,
    londonCloseMins,

    asiaRangeMsk: "00:00–08:00 МСК",
    tokyoOpenMsk: "03:00 МСК",
    moexStartMsk: "07:00 МСК",
    moexClearingDayMsk: "14:00–14:05 МСК",
    moexClearingEveMsk: "18:50–19:05 МСК",
    moexCloseMsk: "23:50 МСК",
    deribitDailyExpiryMsk: "11:00 МСК",
    occOiPublicationMsk: "06:00–08:00 МСК",

    dangerWindowsMsk,
    labelRu,
    isDesyncWeek,
    desyncNoteRu
  };
}

/**
 * Форматирует расписание в виде текста для внедрения в системные промпты ИИ.
 */
export function formatScheduleForPrompt(schedule: SessionSchedule): string {
  const lines = [
    `- Активный режим времени: ${schedule.labelRu}`,
    `- Смещение ET к МСК: +${schedule.etToMsk} ч, UK к МСК: +${schedule.ukToMsk} ч, CT к МСК: +${schedule.ctToMsk} ч`,
    `- Азиатский диапазон ликвидности: ${schedule.asiaRangeMsk} (Токио 09:00 JST = ${schedule.tokyoOpenMsk})`,
    `- Лондонская сессия: ${schedule.londonOpenMsk}–${schedule.londonCloseMsk} МСК`,
    `- Премаркет США: ${schedule.usPremarketMsk} МСК`,
    `- Публикация макро-статистики США (CPI, NFP, PPI, Claims, Retail): ${schedule.macro0830Msk} МСК`,
    `- Открытие биржевой сессии США (US Open, Spot ETF): ${schedule.usOpenMsk} МСК`,
    `- Индексы деловой активности ISM / Мичиган: ${schedule.ism1000Msk} МСК`,
    `- Отчет по запасам нефти EIA (среда): ${schedule.eia1030Msk} МСК`,
    `- Аукционы казначейских облигаций США (US10Y/30Y): ${schedule.auction1300Msk} МСК`,
    `- Решение ФРС по ключевой ставке FOMC: ${schedule.fomc1400Msk} МСК, пресс-конференция: ${schedule.fomcPress1430Msk} МСК`,
    `- Закрытие сессии США: ${schedule.usCloseMsk} МСК`,
    `- Воскресное открытие CME Globex: ${schedule.cmeSunOpenMsk} МСК (в ночь на понедельник)`,
    `- Сессия срочного рынка МосБиржи (FORTS): утренний аукцион 08:50, клиринги ${schedule.moexClearingDayMsk} и ${schedule.moexClearingEveMsk}, закрытие ${schedule.moexCloseMsk}`,
    `- Экспирация опционов Deribit: ${schedule.deribitDailyExpiryMsk}`,
    `- Публикация отчетов OCC по опционному открытому интересу (OI): ${schedule.occOiPublicationMsk}`,
    `- Опасные окна повышенной волатильности / сбор стопов:`,
    ...schedule.dangerWindowsMsk.map(w => `    * ${w}`)
  ];

  if (schedule.isDesyncWeek && schedule.desyncNoteRu) {
    lines.push(`- ${schedule.desyncNoteRu}`);
  }

  return lines.join("\n");
}

/**
 * Проверяет, активна ли торговая сессия опционов США (CBOE / CME / OPRA).
 * Правило с учетом сезона:
 * - Зима (EST): 17:30–00:00 МСК (будни Mon-Fri)
 * - Лето (EDT): 16:30–23:00 МСК (будни Mon-Fri)
 */
export function isUsOptionsSessionActive(date: Date = new Date()): boolean {
  const sched = getSessionSchedule(date);
  // МСК = UTC+3 круглый год
  const mskTime = date.getTime() + 3 * 3600 * 1000;
  const mskDate = new Date(mskTime);
  const mskDay = mskDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  if (mskDay < 1 || mskDay > 5) return false;

  const mskMins = mskDate.getUTCHours() * 60 + mskDate.getUTCMinutes() + mskDate.getUTCSeconds() / 60;
  return mskMins >= sched.usOpenMins && mskMins < sched.usCloseMins;
}

/**
 * Проверяет, активна ли торговая сессия МосБиржи (FORTS / Валютный и Фондовый рынок):
 * По будням с 07:00 до 23:50 МСК.
 */
export function isMoexSessionActive(date: Date = new Date()): boolean {
  const mskTime = date.getTime() + 3 * 3600 * 1000;
  const mskDate = new Date(mskTime);
  const mskDay = mskDate.getUTCDay();
  if (mskDay < 1 || mskDay > 5) return false;

  const mskMins = mskDate.getUTCHours() * 60 + mskDate.getUTCMinutes() + mskDate.getUTCSeconds() / 60;
  return mskMins >= 7 * 60 && mskMins < 23 * 60 + 50;
}

/**
 * Определяет, относится ли инструмент к срочному рынку МосБиржи
 */
export function isMoexAsset(asset: string): boolean {
  const norm = (asset || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    norm.includes("MOEX") ||
    norm.startsWith("SI") ||
    norm.startsWith("RI") ||
    norm.startsWith("BR") ||
    norm.startsWith("NG") ||
    norm.startsWith("GD") ||
    norm.startsWith("GN") ||
    norm.includes("GLDRUB") ||
    norm.includes("FORTS")
  );
}

export function isCryptoAsset(asset: string): boolean {
  const norm = (asset || "").toUpperCase();
  return (
    norm.includes("BTC") ||
    norm.includes("ETH") ||
    norm.includes("SOL") ||
    norm.includes("XRP") ||
    norm.includes("USDT") ||
    norm.includes("DERIBIT")
  );
}

/**
 * Сессионный TTL кэша базового движка GEX:
 * - Crypto-активы (BTC, ETH, SOL, XRP) -> 15 минут (900 000 мс) в любое время
 * - US-сессия активна (будни, зима 17:30–00:00 / лето 16:30–23:00 МСК) -> 90 секунд (90 000 мс)
 * - MOEX-активы в торговые часы МосБиржи (07:00–23:50 МСК) -> 60 секунд (60 000 мс)
 * - Вне торговых сессий -> 15 минут (900 000 мс)
 */
export function getGexCacheTtlMs(asset: string, date: Date = new Date()): number {
  if (isCryptoAsset(asset)) {
    return 15 * 60 * 1000;
  }
  if (isMoexAsset(asset)) {
    return isMoexSessionActive(date) ? 60 * 1000 : 15 * 60 * 1000;
  }
  if (isUsOptionsSessionActive(date)) {
    return 90 * 1000;
  }
  return 15 * 60 * 1000;
}

/**
 * Детерминированный шаблон пре-ньюс предупреждения для графика и HUD (БЕЗ LLM).
 * Проверяет близость к ключевым окнам макро/сессий (US Open, Macro 08:30 ET, London Open, FOMC, MOEX clearing)
 * по времени МСК и возвращает строгий шаблон уведомления.
 */
export function getDeterministicPreNewsWarning(date: Date = new Date()): {
  active: boolean;
  windowName: string;
  timeMsk: string;
  minutesToEvent: number;
  text: string;
} | null {
  const sched = getSessionSchedule(date);
  const mskTime = date.getTime() + 3 * 3600 * 1000;
  const mskDate = new Date(mskTime);
  const mskDay = mskDate.getUTCDay();
  if (mskDay === 0 || mskDay === 6) return null;

  const curMins = mskDate.getUTCHours() * 60 + mskDate.getUTCMinutes();
  const candidates = [
    { name: "London Open", mins: sched.londonOpenMins, timeMsk: sched.londonOpenMsk },
    { name: "US Macro 08:30 ET", mins: sched.macro0830Mins, timeMsk: sched.macro0830Msk },
    { name: "US Cash Open", mins: sched.usOpenMins, timeMsk: sched.usOpenMsk },
    { name: "ISM / Michigan", mins: sched.ism1000Mins, timeMsk: sched.ism1000Msk },
    { name: "FOMC Rate", mins: sched.fomc1400Mins, timeMsk: sched.fomc1400Msk },
    { name: "MOEX Clearing (14:00)", mins: 14 * 60, timeMsk: "14:00" },
    { name: "MOEX Clearing (18:50)", mins: 18 * 60 + 50, timeMsk: "18:50" }
  ];

  for (const ev of candidates) {
    const diff = ev.mins - curMins;
    if (diff >= -15 && diff <= 15) {
      const mskNowStr = `${String(mskDate.getUTCHours()).padStart(2, "0")}:${String(mskDate.getUTCMinutes()).padStart(2, "0")} МСК`;
      const timingText = diff > 0
        ? `через ${diff} мин (${ev.timeMsk} МСК)`
        : diff === 0
        ? `сейчас (${ev.timeMsk} МСК)`
        : `идёт ${Math.abs(diff)} мин (окно ${ev.timeMsk} МСК)`;
      return {
        active: true,
        windowName: ev.name,
        timeMsk: mskNowStr,
        minutesToEvent: diff,
        text: `⚠️ ПРЕ-НЬЮС ОКНО (${mskNowStr}): ${ev.name} ${timingText} — повышенная волатильность, сбор стопов`
      };
    }
  }
  return null;
}
