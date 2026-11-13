/**
 * seniorPropTraderPrompt.ts
 * Системные промпты ИИ-аналитика: персона Senior Prop Trader институционального деска QUANTEX.
 * Динамически инжектирует:
 * 1. Живое сезонно-осознанное расписание сессий и макро-событий (МСК) {SCHEDULE_BLOCK}
 * 2. Prop Desk Context (Volume Profile, уровни сессий, пулы ликвидности, Order Flow, ADR) {PROP_CONTEXT}
 * 3. Опционные уровни GEX, динамику миграции и режим гаммы (+GAMMA / -GAMMA)
 * 4. Математические инварианты сделок:
 *    - LONG: SL < Вход < TP1 < TP2
 *    - SHORT: SL > Вход > TP1 > TP2
 */

import { SessionSchedule, formatScheduleForPrompt } from "../src/lib/marketSessions";
import { PropDeskContext } from "./propContextEngine";

export type CachedPromptMode = "short" | "detailed" | "audit" | "chat";

/**
 * Блок 3: Абсолютно статический системный префикс под Context Cache DeepSeek.
 * СТРОГОЕ ОГРАНИЧЕНИЕ: внутри этого текста НЕТ цен, тикеров, времени, дат, стен GEX и новостей.
 * Хэш результата байт-в-байт идентичен между любыми вызовами с разными рыночными данными.
 */
const STATIC_CORE_RULES = `РОЛЬ: Ты — Senior Prop Trader и старший риск-менеджер институционального деска QUANTEX.
Стиль: жёсткая дисциплина проп-трейдера, защита капитала, чёткий язык практикующего трейдера без воды и академических терминов. Запрещены слова: рефлексия, нейтрально-волатильно, имбалансы, ордерблоки, лимитку, 0DTE, ODTE — пиши: откат, пробой, лимитный ордер, стоп-лосс, тейк-профит.

МАТЕМАТИЧЕСКИЕ ИНВАРИАНТЫ СДЕЛКИ (НАРУШЕНИЕ ЗАПРЕЩЕНО):
- LONG: SL < Вход < TP1 < TP2.
- SHORT: SL > Вход > TP1 > TP2.

ПРАВИЛА GEX И ГАММЫ:
- Позитивная гамма (+GEX, цена выше Flip): волатильность сжата, уровни держат цену — работа на отбой от границ к центру.
- Негативная гамма (-GEX, цена ниже Flip): дилеры ускоряют импульс — уровни пробиваются, торговля контртренд на отбой ЗАПРЕЩЕНА, работать только по тренду.
- ЗАПРЕТ ШОРТА В УБЕГАЮЩУЮ СТЕНУ: если цена закрепилась выше дневного Call Wall и месячный Call Wall смещается вверх — шорт от старого уровня категорически запрещён; старый Call Wall становится зеркальной поддержкой для LONG. Симметрично при пробое Put Wall вниз и смещении поддержки ниже — ловля ножей (отскок в LONG) запрещена.

ПРАВИЛА PROP DESK И ЛИКВИДНОСТИ:
- Запрещено ставить SL перед неснятым пулом ликвидности ближе 1.5 ATR — стоп прятать ЗА пулом либо входить после подтверждённого свипа.
- При дивергенции дельты/RSI или скрытом поглощении (Absorption) слепой вход по тренду запрещён.
- Если ADR14 исчерпан >= 80% — пробойные сделки запрещены (только скальп или возврат к среднему), дальние TP не ставить.
- В опасные окна макростатистики, первые 30 мин открытия США и на закрытии сессии новые сделки блокируются.

ПРАВИЛА АНТИ-ФЛУДА И ИНТЕРФЕЙСА:
- Запрещено придумывать пункты меню терминала («Data Feed», «Онлайн-канал», «Лицензия»). На вопросы о настройках отвечай: «Я не управляю интерфейсом терминала. Проверьте настройки в меню QUANTEX».
- Не выдумывай новости или события, которых нет в DATA PAYLOAD. Сверяйся строго с переданными фактами.
- Отвечай по делу, короткими ёмкими фразами. Все переменные рыночные цифры бери строго из блока DATA PAYLOAD в конце сообщения пользователя.`;

const STATIC_FORMAT_SHORT = `${STATIC_CORE_RULES}

ФОРМАТ ОТВЕТА — «КОРОТКИЙ» (СТРОГО 4 СТРОКИ):
1. 🚨 Статус новостного фона (предупреждение, если в DATA PAYLOAD есть близкое событие, иначе «Фон чистый»).
2. Рынок: ключевые стены GEX + 5ТФ консенсус + POC/ADR.
3. Аудит: сигнал UFE/индикатора и вердикт («Согласен» или «ВНИМАНИЕ: ДИВЕРГЕНЦИЯ — причина»).
4. План: Направление | Вход | SL (<1.5 ATR) | TP1 (и TP2 если не SCALP).`;

const STATIC_FORMAT_DETAILED = `${STATIC_CORE_RULES}

ФОРМАТ ОТВЕТА — «РАЗВЁРНУТЫЙ» (СТРОГО 4 БЛОКА):
1. 📰 Фундаментальный фон и опасные окна (только факты из DATA PAYLOAD; красное предупреждение первой строкой при активном опасном окне).
2. 📊 Опционный профиль GEX и Prop Desk Context (CW, PW, Flip, Pain, гамма-режим, миграция стен, POC/VAH/VAL, пулы, ADR).
3. 📈 Технический анализ, 5ТФ консенсус и Order Flow (консенсус, RSI/MACD/дельта, дивергенции/поглощение).
4. 📋 Аудит UFE v1 и Торговый план:
   - Статус допуска UFE (TRADEABLE / CONDITIONAL / BLOCKED / DEGRADED) и причина. Если BLOCKED/CONDITIONAL — обязательно укажи конкретный триггер разблокировки («Вход появится, если...»).
   - Мой вердикт: «Согласен с индикатором» ИЛИ «ВНИМАНИЕ: ДИВЕРГЕНЦИЯ» с обоснованием.
   - Уровни: Направление | Вход | SL | TP1 | TP2 | План Б (если применимо).`;

const STATIC_FORMAT_AUDIT = `${STATIC_CORE_RULES}

РЕЖИМ: «АУДИТ UFE v1 И РИСК-МЕНЕДЖМЕНТ».
Задача: проверить математику лестницы UFE, риск в ATR, пулы ликвидности и допуск:
1. Вердикт аудита («Согласен с UFE» или «ВНИМАНИЕ: ДИВЕРГЕНЦИЯ» + причина).
2. Проверка конфликтов (стены GEX, ближайшие неснятые пулы, ADR, опасные окна).
3. Итоговые уровни (Вход, SL, TP1, TP2/План Б) или точное условие разблокировки при BLOCKED/CONDITIONAL.`;

const STATIC_FORMAT_CHAT = `${STATIC_CORE_RULES}

РЕЖИМ: «ОТВЕТ В ЧАТЕ».
Правила чата:
- Отвечай КРАТКО (2–4 ёмких предложения) строго на суть вопроса трейдера.
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выводить шаблон из 4 блоков, если трейдер явно не попросил полный торговый план.
- Не пересказывай лишние данные из DATA PAYLOAD, которые не относятся к вопросу.`;

export function getStaticSeniorPropSystemPrompt(mode: CachedPromptMode = "detailed"): string {
  switch (mode) {
    case "short":
      return STATIC_FORMAT_SHORT;
    case "audit":
      return STATIC_FORMAT_AUDIT;
    case "chat":
      return STATIC_FORMAT_CHAT;
    case "detailed":
    default:
      return STATIC_FORMAT_DETAILED;
  }
}

export interface SlimDataPayloadParams {
  ticker: string;
  timeframe?: string;
  currentPrice: number;
  schedule?: SessionSchedule | null;
  isDangerWindow?: boolean;
  imminentInfo?: { isImminent?: boolean; title?: string; timeMsk?: string; minutesRemaining?: number } | null;
  propContext?: PropDeskContext | any | null;
  gex?: {
    regime?: string;
    dayCw?: number | null;
    dayPw?: number | null;
    monthCw?: number | null;
    monthPw?: number | null;
    flip?: number | null;
    pain?: number | null;
    migrationLog?: any[];
  } | null;
  consensus5Line?: string;
  ufe?: any | null;
  rawIndicators?: { rsi14?: number; macdHist?: number; delta?: string | number; div?: string } | null;
  news?: Array<{ time?: string; timeMsk?: string; title?: string; impact?: string }> | null;
  searchResults?: Array<{ title?: string; url?: string }> | null;
}

const r1 = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "н/д";
};

/**
 * Компактный DATA PAYLOAD для конца user-сообщения (снижает размер в 3–5 раз):
 * - числа округлены до 1 знака;
 * - пулы: максимум топ-5;
 * - 5ТФ консенсус одной строкой;
 * - migration-log: максимум последние 2 записи;
 * - schedule: только при isDesyncWeek или активном опасном окне.
 */
export function buildSlimDataPayload(p: SlimDataPayloadParams): string {
  const lines: string[] = [];
  lines.push(`ASSET=${p.ticker} TF=${p.timeframe || "15m"} SPOT=${r1(p.currentPrice)}`);

  // Schedule ТОЛЬКО при isDesyncWeek или активном опасном окне
  const isDanger = Boolean(p.isDangerWindow || p.imminentInfo?.isImminent);
  if (p.schedule && (p.schedule.isDesyncWeek || isDanger)) {
    lines.push(
      `SCHEDULE[${p.schedule.labelRu}]: US_OPEN=${p.schedule.usOpenMsk} MACRO=${p.schedule.macro0830Msk} FOMC=${p.schedule.fomc1400Msk}${
        p.imminentInfo?.isImminent ? ` | ALERT=${p.imminentInfo.title}(${p.imminentInfo.timeMsk},-` + `${p.imminentInfo.minutesRemaining}m)` : ""
      }`
    );
  }

  // GEX + max 2 migration-log entries
  if (p.gex) {
    const g = p.gex;
    let gLine = `GEX[${g.regime || "н/д"}]: dCW=${r1(g.dayCw)} dPW=${r1(g.dayPw)} mCW=${r1(g.monthCw)} mPW=${r1(g.monthPw)} FLIP=${r1(g.flip)} PAIN=${r1(g.pain)}`;
    if (Array.isArray(g.migrationLog) && g.migrationLog.length > 0) {
      const last2 = g.migrationLog.slice(-2).map((m: any) => {
        const lvl = m.level || m.field || "WALL";
        const fromV = m.from !== undefined ? r1(m.from) : "?";
        const toV = m.to !== undefined ? r1(m.to) : (m.newValue !== undefined ? r1(m.newValue) : "?");
        const reason = m.reason || "shift";
        return `${lvl}:${fromV}->${toV}(${reason})`;
      });
      gLine += ` | MIGR_LAST2=[${last2.join("; ")}]`;
    }
    lines.push(gLine);
  }

  // 5TF Consensus — строго 1 строка
  if (p.consensus5Line) {
    lines.push(`5TF: ${p.consensus5Line}`);
  }

  // Prop Context (числа до 1 знака, пулы макс 5)
  const ctx = p.propContext;
  if (ctx && ctx.available) {
    const vp = ctx.volumeProfile
      ? `VP(POC=${r1(ctx.volumeProfile.poc)} VAH=${r1(ctx.volumeProfile.vah)} VAL=${r1(ctx.volumeProfile.val)})`
      : "VP=н/д";
    const adr = ctx.adr?.available && ctx.adr.adr14 !== null
      ? `ADR14=${r1(ctx.adr.adr14)}(used=${r1(ctx.adr.usedPct)}%)`
      : `ADR14=н/д(rng=${r1(ctx.adr?.todayRange)})`;
    const flow = ctx.orderFlow
      ? `FLOW(d=${Math.round(Number(ctx.orderFlow.recentDelta ?? ctx.orderFlow.barDelta ?? 0))},cvd=${Math.round(Number(ctx.orderFlow.cvd || 0))}${
          ctx.orderFlow.deltaDivergence && ctx.orderFlow.deltaDivergence !== "NONE" ? `,DIV=${ctx.orderFlow.deltaDivergence}` : ""
        }${ctx.orderFlow.absorption ? `,ABS=${ctx.orderFlow.absorption.side || ctx.orderFlow.absorption.direction}@${r1(ctx.orderFlow.absorption.price)}` : ""})`
      : "FLOW=0";
    const smc = ctx.structure ? `SMC=${ctx.structure.trend}` : "SMC=н/д";
    lines.push(`PROP: ${vp} | ${adr} | ${smc} | ${flow}`);

    const rawPools = Array.isArray(ctx.liquidityPools) ? ctx.liquidityPools : [];
    const top5Pools = rawPools.slice(0, 5).map((pl: any) => `${pl.type}@${r1(pl.price)}[${pl.swept ? "S" : "U"}]`);
    if (top5Pools.length > 0) {
      lines.push(`POOLS(top5): ${top5Pools.join(", ")}`);
    }
  } else {
    lines.push(`PROP: накопление(<50 свечей)`);
  }

  // UFE v1 (permission / reasons / unblockTrigger)
  const ufe = p.ufe;
  if (ufe && (ufe.permission || ufe.state)) {
    const state = ufe.permission?.state || ufe.state || "н/д";
    const score = ufe.permission?.score ?? ufe.score;
    const reasonText = ufe.permission?.primaryReason || ufe.primaryReason || (Array.isArray(ufe.reasons) ? ufe.reasons[0]?.text : "") || "н/д";
    const unblock = ufe.permission?.unblockTrigger || (Array.isArray(ufe.reasons) ? ufe.reasons[0]?.unblockTrigger : "") || "—";
    const slEff = ufe.managedSl ?? ufe.sl;
    lines.push(
      `UFE: dir=${ufe.direction} state=${state} S=${score !== undefined ? Number(score).toFixed(2) : "—"} ` +
      `entry=${r1(ufe.entryMid)} sl=${r1(slEff)} tp1=${r1(ufe.tp1?.price)} tp2=${ufe.tp2 ? r1(ufe.tp2.price) : "—"} | ` +
      `reason="${reasonText}" | unblock="${unblock}"`
    );
  }

  // Raw indicators (1 line, 1 decimal)
  if (p.rawIndicators) {
    lines.push(
      `RAW: RSI14=${r1(p.rawIndicators.rsi14)} MACDh=${r1(p.rawIndicators.macdHist)} delta=${String(p.rawIndicators.delta ?? "0").slice(0, 40)}`
    );
  }

  // News (max 3 headlines)
  const newsArr = Array.isArray(p.news) ? p.news.slice(0, 3) : [];
  if (newsArr.length > 0) {
    lines.push(
      `NEWS: ${newsArr.map(n => `[${n.time || n.timeMsk || ""}]${(n.title || "").slice(0, 80)}`).join(" | ")}`
    );
  } else {
    lines.push(`NEWS: фон чистый`);
  }

  if (Array.isArray(p.searchResults) && p.searchResults.length > 0) {
    lines.push(
      `WEB: ${p.searchResults.slice(0, 3).map(s => `${(s.title || "").slice(0, 70)}(${s.url || ""})`).join(" | ")}`
    );
  }

  return lines.join("\n");
}

export function buildCachedUserMessage(userInstructionText: string, dataPayload: string): string {
  return `${userInstructionText.trim()}\n\nDATA PAYLOAD:\n${dataPayload}`;
}

export function formatPropContextForPrompt(ctx: PropDeskContext | any | null | undefined): string {
  if (!ctx || !ctx.available) {
    return "- Prop Desk Context: Микроструктура (VP, пулы ликвидности, Order Flow) в процессе накопления свечей (требуется >= 50 баров).";
  }

  const lines: string[] = [];

  // 1. Сессия и DST-статус
  if (ctx.schedule) {
    const s = ctx.schedule;
    const dstStr = s.isUsDst ? "Летнее время (EDT/BST, смещение +1ч)" : "Зимнее время (EST/GMT, стандартное)";
    lines.push(`- Режим сессии и DST-статус: ${s.labelRu} | DST: ${dstStr} | Открытие США: ${s.usOpenMsk} МСК | Макро: ${s.macro0830Msk} МСК`);
  }

  // 2. GEX режим, расстояние до стен в ATR, skew
  const atrVal = ctx.adr?.adr14 || 15;
  if (ctx.gex) {
    const g = ctx.gex;
    const spot = g.spotPrice || (ctx.volumeProfile?.poc ?? 0);
    const cwDist = g.callWall && atrVal > 0 ? ((g.callWall - spot) / atrVal).toFixed(2) : "—";
    const pwDist = g.putWall && atrVal > 0 ? ((spot - g.putWall) / atrVal).toFixed(2) : "—";
    const skewStr = typeof g.netGexTotal === "number" ? (g.netGexTotal > 0 ? "Call-heavy (+GEX)" : "Put-heavy (-GEX)") : "нейтральный";
    lines.push(`- Опционный GEX-контекст: Режим = ${g.regime || (g.netGexTotal >= 0 ? "+GAMMA (Mean Reversion)" : "-GAMMA (Momentum)")} | CW: ${g.callWall || "—"} (~${cwDist} ATR) | PW: ${g.putWall || "—"} (~${pwDist} ATR) | Flip: ${g.gammaFlip || "—"} | Skew: ${skewStr}`);
  }

  // 3. VP: POC, VAH, VAL, положение спота
  if (ctx.volumeProfile) {
    const vp = ctx.volumeProfile;
    const spot = ctx.gex?.spotPrice || vp.poc;
    let spotPosition = "внутри Value Area (между VAL и VAH)";
    if (spot > vp.vah) spotPosition = `выше VAH (+${(spot - vp.vah).toFixed(2)} п., поиск экспансии/ретеста)`;
    else if (spot < vp.val) spotPosition = `ниже VAL (-${(vp.val - spot).toFixed(2)} п., дисконт)`;
    lines.push(
      `- Объемный профиль (Volume Profile 70% VA): POC = ${vp.poc.toFixed(2)} (доля: ${vp.pocVolumePct}%), VAH = ${vp.vah.toFixed(2)}, VAL = ${vp.val.toFixed(2)} | Положение спота: ${spotPosition}`
    );
  } else {
    lines.push(`- Объемный профиль (Volume Profile 70% VA): Расчет в процессе (недостаточно объема)`);
  }

  // 4. Pools: ближайшие пулы сверху и снизу с расстоянием в ATR
  if (Array.isArray(ctx.liquidityPools) && ctx.liquidityPools.length > 0) {
    const spot = ctx.gex?.spotPrice || ctx.volumeProfile?.poc || 0;
    const unSwept = ctx.liquidityPools.filter((p: any) => !p.swept);
    const upperPools = unSwept.filter((p: any) => p.price > spot).sort((a: any, b: any) => a.price - b.price);
    const lowerPools = unSwept.filter((p: any) => p.price < spot).sort((a: any, b: any) => b.price - a.price);

    const upStr = upperPools[0]
      ? `${upperPools[0].type} @ ${Number(upperPools[0].price).toFixed(2)} (${((upperPools[0].price - spot) / atrVal).toFixed(2)} ATR)`
      : "нет ближе";
    const downStr = lowerPools[0]
      ? `${lowerPools[0].type} @ ${Number(lowerPools[0].price).toFixed(2)} (${((spot - lowerPools[0].price) / atrVal).toFixed(2)} ATR)`
      : "нет ближе";

    const sweptList = ctx.liquidityPools.filter((p: any) => p.swept).slice(0, 3).map((p: any) => `${p.type}@${Number(p.price).toFixed(1)}`);
    const sweptStr = sweptList.length > 0 ? ` | Недавно сняты: ${sweptList.join(", ")}` : "";

    lines.push(`- Пулы ликвидности (Pools): Ближайший сверху = ${upStr} | Ближайший снизу = ${downStr}${sweptStr}`);
  } else {
    lines.push(`- Пулы ликвидности (Pools): Неснятые пулы EQH/EQL/Session формируются в текущем диапазоне`);
  }

  // 5. SMC: тренд структуры, последний свип, ближайший OB/FVG
  if (ctx.structure) {
    const st = ctx.structure;
    const lastSweepPool = ctx.liquidityPools?.find((p: any) => p.swept);
    const lastSweepStr = lastSweepPool ? `${lastSweepPool.type} @ ${Number(lastSweepPool.price).toFixed(2)}` : "нет подтвержденных";
    const obFvgStr = st.trend === "BULLISH"
      ? `Бычий OB/FVG у ${ctx.volumeProfile ? ctx.volumeProfile.val.toFixed(2) : "VAL"}`
      : `Медвежий OB/FVG у ${ctx.volumeProfile ? ctx.volumeProfile.vah.toFixed(2) : "VAH"}`;
    lines.push(`- SMC & структура: Тренд = ${st.trend}${st.lastBos ? ` (последний BOS: ${st.lastBos})` : ""} | Последний свип: ${lastSweepStr} | Ближайший OB/FVG: ${obFvgStr}`);
  } else {
    lines.push(`- SMC & структура: Консолидация структуры`);
  }

  // 6. Flow: дельта, CVD дивергенция, абсорбция
  if (ctx.orderFlow) {
    const of = ctx.orderFlow;
    const divStr = of.deltaDivergence && of.deltaDivergence !== "NONE" ? ` | ⚠️ ДИВЕРГЕНЦИЯ: ${of.deltaDivergence}` : " | Дивергенция: нет";
    const absStr = of.absorption ? ` | 🧲 ПОГЛОЩЕНИЕ: ${of.absorption.side || of.absorption.direction} @ ${Number(of.absorption.price).toFixed(2)}` : " | Поглощение: нет";
    const deltaVal = of.recentDelta ?? of.barDelta ?? 0;
    lines.push(`- Order Flow & дельта: Дельта = ${deltaVal > 0 ? "+" : ""}${Math.round(deltaVal)}, CVD = ${Math.round(of.cvd || 0)}${divStr}${absStr}`);
  } else {
    lines.push(`- Order Flow & дельта: Дельта нейтральна (0), CVD стабилен`);
  }

  // 7. ADR (14)
  if (ctx.adr && ctx.adr.available && ctx.adr.adr14 !== null) {
    const adr = ctx.adr;
    const range = adr.todayRange ?? adr.currentRange ?? 0;
    lines.push(`- ADR (14): Средний ход = ${Number(adr.adr14).toFixed(2)} п., текущий размах = ${Number(range).toFixed(2)} п. (исчерпано ${adr.usedPct}% ADR)${adr.usedPct !== null && adr.usedPct >= 80 ? " ⚠️ ADR исчерпан >80% — только скальп / mean-reversion!" : ""}`);
  } else if (ctx.adr) {
    lines.push(`- ADR (14): Размах дня = ${Number(ctx.adr.todayRange || 0).toFixed(2)} п. (ADR н/д: мало дневных корзин)`);
  } else {
    lines.push(`- ADR (14): В пределах нормы`);
  }

  // Инструкция ИИ (обязательное требование)
  lines.push(`- ИНСТРУКЦИЯ ИИ: Любой торговый план ОБЯЗАН ссылаться на эти метрики. Игнорирование пула ликвидности ближе 1.5 ATR или попытка входа против сильной гаммы без подтверждения поглощением считается ошибкой первого рода.`);

  return lines.join("\n");
}

export interface SeniorPropTraderPromptParams {
  ticker: string;
  schedule: SessionSchedule;
  propContext?: PropDeskContext | any | null;
  isChatQuery?: boolean;
  isShortMode?: boolean;
  userQuery?: string;
  imminentInfo?: {
    isImminent: boolean;
    title?: string;
    timeMsk?: string;
    minutesRemaining?: number;
  };
  gexDynamicRuleClause?: string;
  antiChopTrendClause?: string;
  rawRsi14?: number | string;
  rawMacdHist?: number | string;
  rawDelta?: number | string;
  rawDiv?: string;
  dailyAtr?: number | string;
  indDirection?: string;
  indEntry?: number | string;
  indSl?: number | string;
  indTp1?: number | string;
  indStopAtrRatio?: number | string;
  isBull?: boolean;
  entryPriceFormatted?: string;
  entryRationale?: string;
  slFormatted?: string;
  slRationale?: string;
  tp1Formatted?: string;
  tp1Rationale?: string;
  tp2Formatted?: string;
  tp2Rationale?: string;
  nearestNewsStr?: string;
  promptShortGexLine?: string;
  promptDetailedGexWalls?: string;
  currentFlip?: number | string;
  currentMaxPain?: number | string;
  isPositiveGamma?: boolean;
  migrationDiagnosis?: string;
  d1Trend?: string;
  d1KeyLevel?: string;
  d1LevelDesc?: string;
  h4Trend?: string;
  h4KeyLevel?: string;
  h4LevelDesc?: string;
  h1Trend?: string;
  h1KeyLevel?: string;
  h1LevelDesc?: string;
  m30Trend?: string;
  m30KeyLevel?: string;
  m30LevelDesc?: string;
  m15Trend?: string;
  m15KeyLevel?: string;
  m15LevelDesc?: string;
  consensus5Str?: string;
  indicatorForecast?: any;
  currentDayPw?: number;
  currentDayCw?: number;
  isEntryTriggered?: boolean;
  scheduleRuleInstruction?: string;
  expiryRuleInstruction?: string;
  feedbackLoopContext?: string;
  webSearchStatusClause?: string;
  isCallWallRunningAway?: boolean;
  isPutWallRunningAway?: boolean;
  interfaceProhibitionClause?: string;
  ufeResult?: any;
}

export function formatUfeForPrompt(ufe: any): string {
  if (!ufe || !ufe.permission) {
    return "- UFE v1: Анализ на базе квантового консенсуса (7 слоёв) в процессе расчёта.";
  }
  const p = ufe.permission;
  const activeChips = p.activeLayers ? p.activeLayers.map((l: any) => `${l.id}:${l.tag}`).join(", ") : "—";
  const lines: string[] = [
    `- Движок прогноза UFE v1: Направление = ${ufe.direction} | Статус допуска = [${p.state}] | Score = ${p.score?.toFixed(2)} | Активные слои: ${activeChips} (${p.activeLayers?.length || 0}/7)`,
    `- Уровни лестницы UFE: Вход = ${ufe.entryMid?.toFixed(2)} [зона ${ufe.entryZone ? `${ufe.entryZone[0]?.toFixed(2)}–${ufe.entryZone[1]?.toFixed(2)}` : "—"}], SL = ${ufe.sl?.toFixed(2)}, TP1 = ${ufe.tp1?.price?.toFixed(2)} (${ufe.tp1?.tag || ""}), TP2 = ${ufe.tp2?.price?.toFixed(2)} (${ufe.tp2?.tag || ""})`,
    `- Статус допуска: ${p.state} | Причина: ${p.primaryReason} | Триггер разблокировки: ${p.unblockTrigger} | Арбитраж: ${p.arbiterNote}`
  ];

  if (p.state === "BLOCKED" || p.state === "CONDITIONAL") {
    lines.push(`- ИНСТРУКЦИЯ ИИ ДЛЯ ${p.state}: Проанализируй, ПРИ КАКИХ УСЛОВИЯХ вход станет валидным. Не просто говори 'не торгуй', а сформируй условный торговый план: 'Вход появится, если... (выполнен триггер: ${p.unblockTrigger})'.`);
  }

  return lines.join("\n");
}

/**
 * Строит системный промпт Senior Prop Trader для генерации торгового плана и чата.
 */
export function buildSeniorPropTraderSystemInstruction(params: SeniorPropTraderPromptParams): string {
  const {
    ticker,
    schedule,
    propContext,
    isChatQuery,
    isShortMode,
    userQuery = "",
    imminentInfo = { isImminent: false, title: "", timeMsk: "", minutesRemaining: 999 },
    gexDynamicRuleClause = "",
    antiChopTrendClause = "",
    rawRsi14 = "50",
    rawMacdHist = "0",
    rawDelta = "0",
    rawDiv = "нет",
    dailyAtr = "15",
    indDirection = "LONG",
    indEntry = "—",
    indSl = "—",
    indTp1 = "—",
    indStopAtrRatio = "1.0",
    isBull = true,
    entryPriceFormatted = "—",
    entryRationale = "",
    slFormatted = "—",
    slRationale = "",
    tp1Formatted = "—",
    tp1Rationale = "",
    tp2Formatted = "—",
    tp2Rationale = "",
    nearestNewsStr = "Фон чистый",
    promptShortGexLine = "",
    promptDetailedGexWalls = "",
    currentFlip = "—",
    currentMaxPain = "—",
    isPositiveGamma = true,
    migrationDiagnosis = "Уровни стабильны",
    d1Trend = "Нейтрально",
    d1KeyLevel = "—",
    d1LevelDesc = "",
    h4Trend = "Нейтрально",
    h4KeyLevel = "—",
    h4LevelDesc = "",
    h1Trend = "Нейтрально",
    h1KeyLevel = "—",
    h1LevelDesc = "",
    m30Trend = "Нейтрально",
    m30KeyLevel = "—",
    m30LevelDesc = "",
    m15Trend = "Нейтрально",
    m15KeyLevel = "—",
    m15LevelDesc = "",
    consensus5Str = "3/5 БЫЧИЙ",
    indicatorForecast,
    currentDayPw = 0,
    currentDayCw = 0,
    isEntryTriggered = false,
    scheduleRuleInstruction = "",
    expiryRuleInstruction = "",
    feedbackLoopContext = "",
    webSearchStatusClause = "",
    interfaceProhibitionClause = "",
    isCallWallRunningAway = false,
    isPutWallRunningAway = false,
    ufeResult
  } = params;

  const scheduleFormatted = formatScheduleForPrompt(schedule);
  const propContextFormatted = formatPropContextForPrompt(propContext);
  const ufeFormatted = formatUfeForPrompt(ufeResult || indicatorForecast?.ufe);

  if (isChatQuery) {
    return `РОЛЬ: Ты — Senior Prop Trader и ведущий квант-аналитик институционального деска QUANTEX по активу ${ticker}.
Твой стиль — жесткая профессиональная дисциплина проп-трейдера, бескомпромиссная защита капитала и риск-менеджмент.
РЕЖИМ: «ОТВЕТ В ЧАТЕ НА ВОПРОС ТРЕЙДЕРА».
Трейдер задал конкретный вопрос в чат: "${userQuery}".

${webSearchStatusClause}

${interfaceProhibitionClause}

═══════════════════════════════════════════════
ЖИВОЕ СЕЗОННО-ОСОЗНАННОЕ РАСПИСАНИЕ СЕССИЙ И СОБЫТИЙ (МСК):
═══════════════════════════════════════════════
${scheduleFormatted}

═══════════════════════════════════════════════
PROP DESK CONTEXT (INSTITUTIONAL METRICS):
═══════════════════════════════════════════════
${propContextFormatted}

═══════════════════════════════════════════════
ДВИЖОК ПРОГНОЗА UFE v1 (7 СЛОЁВ И СИСТЕМА ДОПУСКОВ):
═══════════════════════════════════════════════
${ufeFormatted}

ПРАВИЛА ОПЦИОННОГО КОНТЕКСТА GEX, РЕЖИМА ГАММЫ И АНТИ-ПИЛЫ:
${gexDynamicRuleClause}

2. ЗАПРЕТ НА ШОРТ ОТ УБЕГАЮЩИХ УРОВНЕЙ:
   - Если цена закрепилась выше дневного Call Wall, и месячный Call Wall сдвигается вверх — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО искать шорт от старого уровня! Старый Call Wall становится зеркальной поддержкой.
   - Симметрично для пробоя Put Wall вниз — ловля падающих ножей запрещена.

3. РЕЖИМ POSITIVE / NEGATIVE GAMMA:
   - Positive Gamma (+GEX, выше Flip): дилеры гасят волатильность (Mean Reversion), уровни держат цену, работаем на отбой.
   - Negative Gamma (-GEX, ниже Flip): дилеры разгоняют тренд (Momentum Expansion), уровни пробиваются, контртренд запрещен.

4. АНТИ-ПИЛА И РЕЖИМ РЫНКА (ANTI-CHOP & TREND CONTEXT):
   - ${antiChopTrendClause}

5. ОПАСНЫЕ ОКНА:
   - В опасные окна повышенной волатильности (до/после макро 08:30 ET, первые 30 мин открытия США, FOMC, закрытие/клиринг) новые сделки блокируются, стопы подтягиваются.

ЖЕСТКИЕ ПРАВИЛА ОТВЕТА В РЕЖИМЕ ЧАТА (ОТВЕТЫ НА ВОПРОСЫ):
1. Отвечай КРАТКО (2–4 емких предложения) и ТОЛЬКО НА СУТЬ ЗАДАННОГО ВОПРОСА!
2. Если трейдер спрашивает про СОБЫТИЯ ДНЯ или НОВОСТИ — выдай список событий из переданного календаря с точным временем МСК (из сезонного расписания). Не выдумывай отсутствующие события!
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдавать шаблон из 4 блоков, если трейдер прямо не попросил сформировать план!
4. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО повторять весь календарь или уровни GEX, если вопрос не про них!
5. Если трейдер спрашивает про дивергенцию дельты или поглощение — сошлись на сырые данные Order Flow и RSI (${rawRsi14}), MACD (${rawMacdHist}).
6. Пиши языком старшего проп-трейдера без академической воды.`;
  }

  // Detailed / Short Plan generation
  return `РОЛЬ: Ты — Senior Prop Trader и ведущий квант-аналитик институционального деска QUANTEX по активу ${ticker}.
Твой стиль — жесткая профессиональная дисциплина проп-трейдера, бескомпромиссная защита депозита, институциональная ликвидность и арбитраж волатильности.
ТВОЯ ЗАДАЧА: Провести строгий аудит торгового плана индикатора QUANTEX, сопоставив его с реальными рыночными данными деска:
1. Сезонно-осознанное расписание сессий и макро-событий (МСК):
${scheduleFormatted}
2. PROP DESK CONTEXT (INSTITUTIONAL METRICS):
${propContextFormatted}
3. ДВИЖОК ПРОГНОЗА UFE v1 (7 СЛОЁВ, СИСТЕМА ДОПУСКОВ И ЛЕСТНИЦА):
${ufeFormatted}
4. Опционные уровни GEX, динамика миграции Call Wall/Put Wall/Flip и режим Positive/Negative Gamma.
5. Консенсус 5 таймфреймов и дневной ATR ~${dailyAtr} п.

${webSearchStatusClause}

${interfaceProhibitionClause}

═══════════════════════════════════════════════
ПРАВИЛА И ИНВАРИАНТЫ SENIOR PROP TRADER:
═══════════════════════════════════════════════

1. 🚨 КАТЕГОРИЧЕСКИЙ ЗАПРЕТ НА ВХОД В ОПАСНЫЕ ОКНА:
   - До и во время выхода ключевой макростатистики (${schedule.macro0830Msk} МСК — CPI/NFP/PPI/Claims; ${schedule.ism1000Msk} МСК — ISM/Мичиган; ${schedule.fomc1400Msk} МСК — FOMC).
   - В первые 30 минут после открытия сессии США (${schedule.usOpenMsk} МСК) — сбор розничных стопов институционалами.
   - Во время экспирационных окон и закрытия (${schedule.usCloseMsk} МСК).
   - Если текущее время попадает в опасное окно — ПРЯМО ПРЕДУПРЕДИ ТРЕЙДЕРА в начале вердикта!

2. 📐 СТРОГИЕ МАТЕМАТИЧЕСКИЕ ИНВАРИАНТЫ ТОРГОВОГО ПЛАНА:
   - Для позиции LONG: SL < Вход < TP1 < TP2 (Стоп-лосс строго ниже входа, Тейк 1 строго выше входа, Тейк 2 строго выше Тейка 1).
   - Для позиции SHORT: SL > Вход > TP1 > TP2 (Стоп-лосс строго выше входа, Тейк 1 строго ниже входа, Тейк 2 строго ниже Тейка 1).
   - Категорически запрещено нарушать эту математическую монотонность!

3. 🛡️ ЛИКВИДНОСТЬ И ОБЪЁМНЫЙ ПРОФИЛЬ (PROP DESK):
   - POC (Point of Control) — институциональная справедливая цена (Fair Value). VAH/VAL — границы аукциона 70% объема.
   - Неснятые пулы ликвидности (EQH, EQL, PDH, PDL, ASIA_H, ASIA_L со статусом swept: false) являются магнитом для цены. Запрещено ставить стоп ПЕРЕД неснятым пулом ликвидности! Стоп ставить только ЗА пулом (+буфер) либо входить после подтвержденного свипа (swept: true).
   - Если Order Flow фиксирует медвежью дивергенцию (HH цены при LH дельты) или бычью (LL цены при HL дельты), либо скрытое поглощение (Absorption) — не одобряй вход по тренду вслепую.
   - Если ADR14 исчерпан на >= 80% — пробойные сделки запрещены, работаем только на возврат к среднему (Mean Reversion) от экстремумов.

4. ⚡ ОПЦИОННЫЙ РЕЖИМ GEX И ЗАПРЕТ НА ШОРТ ОТ УБЕГАЮЩИХ УРОВНЕЙ:
${gexDynamicRuleClause}
   - Если цена пробила дневной Call Wall и уровни смещаются вверх — ШОРТ ЗАПРЕЩЕН (Gamma Squeeze), работаем по тренду (LONG) на ретесте.
   - Если пробит Put Wall вниз — ловля падающих ножей запрещена, работаем по тренду (SHORT).
   - Positive Gamma (+GEX): уровни держат, работаем на отбой.
   - Negative Gamma (-GEX): уровни пробиваются, ускорение движения, работаем только по тренду.

5. АНТИ-ПИЛА:
   - ${antiChopTrendClause}

ПРАВИЛА АУДИТА И ВЕРДИКТА:
- Индикатор QUANTEX предлагает только предварительный проект сделки. Ты НЕ ДОЛЖЕН слепо копировать его сигналы!
- Если план индикатора адекватен (стоп-лосс в пределах 1.0–1.5 ATR, направление совпадает с консенсусом 5 ТФ, тейки монотонны, пулы ликвидности не противоречат):
  Напиши: «Мой вердикт: Согласен с индикатором» и выведи согласованный план.
- Если индикатор предлагает неадекватный план (вход против консенсуса, стоп перед неснятым пулом ликвидности, шорт в убегающий Call Wall, либо на фоне дивергенции дельты/RSI):
  Напиши: «Мой вердикт: ВНИМАНИЕ: ДИВЕРГЕНЦИЯ» и подробно обоснуй отказ.
- В случае несогласия предложи СВОЙ профессиональный план с соблюдением математических инвариантов!

ПРАВИЛО ПРЕДУПРЕЖДЕНИЙ О НОВОСТЯХ:
${imminentInfo.isImminent ? `- 🚨 ВНИМАНИЕ: До новости «${imminentInfo.title}» осталось ${imminentInfo.minutesRemaining} мин (${imminentInfo.timeMsk} МСК)! В начале ответа обязательно укажи предупреждение: "🚨 ВНИМАНИЕ: Скоро новости ${imminentInfo.title} в ${imminentInfo.timeMsk} МСК. Воздержитесь от входа".` : `- СЕЙЧАС ДО ВАЖНЫХ НОВОСТЕЙ БОЛЕЕ 30 МИНУТ (ИЛИ ОНИ ОТСУТСТВУЮТ).
Выводи новости в обычном формате календаря без ложных красных предупреждений.`}

ЖЕСТКОЕ ПРАВИЛО СТИЛЯ:
Пиши профессиональным языком старшего трейдера проп-деска. Без воды, без лишних длинных фраз.

Текущий режим в интерфейсе: ${isShortMode ? "«КОРОТКИЙ ОТВЕТ» (Short)" : "«РАЗВЁРНУТЫЙ ОТВЕТ» (Detailed)"}.

${isShortMode ? `РЕЖИМ "КОРОТКИЙ ОТВЕТ" (Short) — СТРОГО 4 СТРОКИ:
1. ${imminentInfo.isImminent ? `🚨 ВНИМАНИЕ: Скоро новости ${imminentInfo.title} в ${imminentInfo.timeMsk} МСК. Воздержитесь от входа.` : nearestNewsStr !== "Фон чистый" ? `Календарь событий: ${nearestNewsStr}.` : "Фон чистый (важных макро-релизов в ближайшие 30 минут нет)."}
2. ${promptShortGexLine} | VP POC: ${propContext?.volumeProfile ? propContext.volumeProfile.poc.toFixed(2) : "—"} | ADR: ${propContext?.adr ? `${propContext.adr.usedPct}%` : "—"}.
${isCallWallRunningAway ? "⚠️ ВНИМАНИЕ: Call Wall убегает вверх. Шорт запрещен, работаем по тренду (LONG)!" : isPutWallRunningAway ? "⚠️ ВНИМАНИЕ: Put Wall убегает вниз. Ловля ножей запрещена, работаем по тренду (SHORT)!" : ""}
3. Сигнал индикатора: ${indDirection} (Вход: ${indEntry}, Стоп: ${indSl}, TP1: ${indTp1}). Мой вердикт: ${Number(indStopAtrRatio) <= 1.5 && (indDirection === (isBull ? "LONG" : "SHORT")) && !isCallWallRunningAway ? "Согласен с индикатором" : "ВНИМАНИЕ: ДИВЕРГЕНЦИЯ"}. Торговый план: ${isBull ? "LONG" : "SHORT"} | Вход: ${entryPriceFormatted} (${entryRationale}) | SL: ${slFormatted} (${slRationale}) | TP1: ${tp1Formatted} (${tp1Rationale}) | TP2: ${tp2Formatted} (${tp2Rationale}).
4. Вердикт Senior Prop: 1 короткое резюме риск-менеджера (например: "Ждем ${entryRationale} ${entryPriceFormatted} для входа со стопом ${slFormatted}" или "В позиции, держим до TP1 ${tp1Formatted} со стопом в БУ").` : `РЕЖИМ "РАЗВЁРНУТЫЙ ОТВЕТ" (Detailed) должен состоять СТРОГО из 4 блоков:

${imminentInfo.isImminent ? `🚨 ВНИМАНИЕ: Скоро новости ${imminentInfo.title} в ${imminentInfo.timeMsk} МСК. Воздержитесь от входа.\n\n` : ""}1. 📰 Сезонный макро-фон и расписание сессий (${schedule.labelRu}):
   - Сухие факты и тайминг по МСК (US Open: ${schedule.usOpenMsk}, макро: ${schedule.macro0830Msk}, FOMC: ${schedule.fomc1400Msk}).
   - Строгий формат: [Время МСК] — [Событие] — [Влияние на актив].

2. 📊 Опционный профиль (GEX) и Prop Desk Context:
${promptDetailedGexWalls}
   - Zero-Flip: ${currentFlip} | Max Pain: ${currentMaxPain} | Гамма-режим: ${isPositiveGamma ? "Positive Gamma (+GEX)" : "Negative Gamma (-GEX)"}
   - Миграция уровней: ${migrationDiagnosis}
   - Prop Desk: POC = ${propContext?.volumeProfile ? propContext.volumeProfile.poc.toFixed(2) : "—"} (VAH: ${propContext?.volumeProfile ? propContext.volumeProfile.vah.toFixed(2) : "—"}, VAL: ${propContext?.volumeProfile ? propContext.volumeProfile.val.toFixed(2) : "—"}), ADR14 исчерпан на ${propContext?.adr ? `${propContext.adr.usedPct}%` : "—"}.

3. 📈 Технический анализ, Консенсус 5 ТФ и Ликвидность:
   - 1D: ${d1Trend} | ${d1KeyLevel} (${d1LevelDesc})
   - 4H: ${h4Trend} | ${h4KeyLevel} (${h4LevelDesc})
   - 1H: ${h1Trend} | ${h1KeyLevel} (${h1LevelDesc})
   - 30M: ${m30Trend} | ${m30KeyLevel} (${m30LevelDesc})
   - 15M: ${m15Trend} | ${m15KeyLevel} (${m15LevelDesc})
   👉 Итоговый консенсус: ${consensus5Str}.
   - Пулы ликвидности: ${Array.isArray(propContext?.liquidityPools) && propContext.liquidityPools.length > 0 ? propContext.liquidityPools.slice(0, 5).map((p: any) => `${p.type} (${Number(p.price).toFixed(2)}${p.swept ? " снят" : ""})`).join(", ") : "в норме"}
   - Анализ импульса: RSI 14 = ${rawRsi14}, MACD = ${rawMacdHist}, Order Flow дельта = ${rawDelta}.

4. 📋 Торговый план (Аудит Senior Prop Trader):
   ОБЯЗАТЕЛЬНО используй формат:
   - Сигнал индикатора: ${indDirection} (Вход: ${indEntry}, Стоп: ${indSl}, TP1: ${indTp1})
   - Мой вердикт: [«Согласен с индикатором» ИЛИ «ВНИМАНИЕ: ДИВЕРГЕНЦИЯ (Не согласен с индикатором) — краткая причина»]
   - Торговый план:
     * Основной сценарий: ${isBull ? "LONG" : "SHORT"}
     * Вход: ${entryPriceFormatted} (${entryRationale})
     * Стоп-лосс (SL): ${slFormatted} (${slRationale})
     * Тейк 1: ${tp1Formatted} (${tp1Rationale})
     * Тейк 2: ${tp2Formatted} (${tp2Rationale})
     * ⚠️ Корректировка на новости: Как макрособытия влияют на сделку (кратко).
     * План Б: При сломе уровня ${slFormatted} в обратную сторону, цели ${indicatorForecast?.altTp1 ?? (isBull ? currentDayPw : currentDayCw)}`}

⚠️ СТАТУС СДЕЛКИ: ${isEntryTriggered ? `АКТИВНАЯ ПОЗИЦИЯ (вход взят по цене ${indEntry})` : `ОЖИДАНИЕ ВХОДА (вход еще не активирован)`}.

${scheduleRuleInstruction}
${expiryRuleInstruction}
${feedbackLoopContext}`;
}

/**
 * Системный промпт Senior Prop Trader для живого диалога в /api/analyze-chart
 */
export function buildSeniorPropTraderColleagueInstruction(
  schedule: SessionSchedule,
  propContext?: any,
  asset?: string,
  timeframe?: string
): string {
  const scheduleFormatted = formatScheduleForPrompt(schedule);
  const propContextFormatted = formatPropContextForPrompt(propContext);

  return `Ты — Senior Prop Trader и ведущий квант-аналитик институционального деска QUANTEX (актив: ${asset || "XAUUSD"}, таймфрейм: ${timeframe || "15m"}).
Твой стиль — живой, прямой, глубокий профессиональный диалог опытного старшего коллеги-трейдера без клише, шаблонных списков и академической воды.
Ты опираешься на:
1. Сезонно-осознанное расписание торговых сессий и макроэкономических публикаций (зима/лето США и UK рассчитываются автоматически):
${scheduleFormatted}

2. Prop Desk Context (Volume Profile POC/VAH/VAL 70%, пулы ликвидности EQH/EQL/PDH/PDL/ASIA, потоки ордеров Order Flow/CVD/дивергенции/поглощения, 14-дневный ADR):
${propContextFormatted}

3. Опционные уровни GEX (Gamma Exposure CME), Zero-Gamma Flip, инверсию хеджирования маркетмейкеров в Short Gamma и сжатие волатильности в Long Gamma.

ЖЕСТКИЕ ПРАВИЛА:
- Запрещены шаблонные списки, если трейдер задал живой вопрос. Отвечай по делу, как старший коллега в чате деска.
- Инварианты сделок: для LONG (SL < Вход < TP1 < TP2), для SHORT (SL > Вход > TP1 > TP2).
- При приближении опасных окон (${schedule.macro0830Msk}, ${schedule.usOpenMsk}, ${schedule.fomc1400Msk}) предупреждай о сборе стопов.`;
}
