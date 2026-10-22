import React from "react";
import { BookOpen, Sparkles, Sliders, Shield, Flame, Smartphone, FileText, Send, Bell, Bot, CheckCircle2, AlertTriangle, Eye, TrendingUp, Compass, RefreshCw } from "lucide-react";
import longSetupImg from "../assets/images/long_setup_diagram_1784556372325.jpg";
import shortSetupImg from "../assets/images/short_setup_diagram_1784556388916.jpg";
import obFvgImg from "../assets/images/order_block_fvg_diagram_1784556404138.jpg";

export const PineScriptManual: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-8 text-sm text-gray-300 space-y-8 relative" id="pinescript-docs">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #pinescript-docs, #pinescript-docs * {
            visibility: visible !important;
          }
          #pinescript-docs {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #111827 !important;
            padding: 20px !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          #pinescript-docs * {
            color: #111827 !important;
            background: transparent !important;
            background-color: transparent !important;
            border-color: #d1d5db !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          #pinescript-docs .no-print, #pinescript-docs button {
            display: none !important;
          }
          #pinescript-docs h4 {
            color: #000000 !important;
            font-size: 22pt !important;
            font-weight: bold !important;
            margin-bottom: 6px !important;
            border-bottom: 2px solid #111827 !important;
            padding-bottom: 8px !important;
          }
          #pinescript-docs h5 {
            color: #1f2937 !important;
            font-size: 13pt !important;
            font-weight: bold !important;
            margin-top: 18pt !important;
          }
          #pinescript-docs p, #pinescript-docs li {
            color: #374151 !important;
            font-size: 10pt !important;
            line-height: 1.5 !important;
          }
          #pinescript-docs th {
            background-color: #f3f4f6 !important;
            color: #111827 !important;
            font-weight: bold !important;
            border: 1px solid #9ca3af !important;
          }
          #pinescript-docs td {
            border: 1px solid #d1d5db !important;
            padding: 8px 12px !important;
          }
          #pinescript-docs section, #pinescript-docs .bg-gradient-to-br, #pinescript-docs .bg-gray-900\/60, #pinescript-docs .bg-amber-500\/10 {
            border: 1px solid #d1d5db !important;
            border-radius: 8px !important;
            padding: 15px !important;
            margin-bottom: 15px !important;
            page-break-inside: avoid !important;
            background-color: #f9fafb !important;
          }
          #pinescript-docs .grid {
            display: block !important;
          }
          #pinescript-docs .grid > * {
            margin-bottom: 15px !important;
            page-break-inside: avoid !important;
          }
        }
      ` }} />

      {/* Раздел 1.0: Новая Практическая Инструкция по Super Indicator (v6.4 Update) */}
      <section className="bg-gradient-to-br from-indigo-950/40 via-gray-900 to-[#0e1424] p-6 rounded-2xl border border-indigo-500/40 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-orange-500/20">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h5 className="text-lg font-bold text-white flex items-center gap-2">
                ПРАКТИЧЕСКОЕ РУКОВОДСТВО: S&T Super Indicator v6
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  v6.4 Обновление
                </span>
              </h5>
              <p className="text-xs text-gray-400">Правила входа, калибровка вероятностей, фильтр встречных блоков и Smart Auto-Flip</p>
            </div>
          </div>
        </div>

        {/* Таблица HUD */}
        <div className="space-y-3">
          <h6 className="font-bold text-cyan-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            1. Чтение Таблицы HUD (Полная расшифровка всех 10 строк):
          </h6>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-300 border border-gray-800 rounded-xl overflow-hidden">
              <thead className="bg-gray-950/80 text-gray-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-2.5 border-b border-gray-800 w-[22%]">Строка HUD</th>
                  <th className="p-2.5 border-b border-gray-800 w-[38%]">Что рассчитывает алгоритм</th>
                  <th className="p-2.5 border-b border-gray-800 w-[40%]">Возможные значения и руководство к действию</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-cyan-300">1. Заголовок и ТФ<br/><span className="text-[10px] text-gray-500 font-mono">★ S&T SUPER / Asset</span></td>
                  <td className="p-2.5 text-gray-400">Отображает текущий инструмент (XAUUSD, BTCUSDT, SBER) и таймфрейм (15м, 5м, 1H).</td>
                  <td className="p-2.5 text-gray-300">Проверяйте соответствие ТФ стратегии (15м оптимален для золота и крипты).</td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-amber-300">2. Макро DXY / Нефть<br/><span className="text-[10px] text-gray-500 font-mono">Макро DXY / Нефть</span></td>
                  <td className="p-2.5 text-gray-400">Корреляционный мониторинг Индекса Доллара (DXY) и Нефти (OIL) в реальном времени.</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-rose-400 font-bold">⚠️ DXY +0.45% (Давление USD)</span> — риск для лонга.</div>
                    <div>• <span className="text-emerald-400 font-bold">🟢 DXY -0.30% (Поддержка USD)</span> — попутный ветер для покупок.</div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-blue-300">3. Консенсус Тренда<br/><span className="text-[10px] text-gray-500 font-mono">Консенсус Тренда</span></td>
                  <td className="p-2.5 text-gray-400">Общий вектор: объединяет локальный слом структуры со старшим ТФ (HTF).</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-emerald-400 font-bold">🟢 БЫЧИЙ (LONG) | HTF Up</span> — приоритет LONG (A+).</div>
                    <div>• <span className="text-rose-400 font-bold">🔴 МЕДВЕЖИЙ (SHORT) | HTF Down</span> — приоритет SHORT (A+).</div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-emerald-300">4. Дельта Объема<br/><span className="text-[10px] text-gray-500 font-mono">Дельта Объема</span></td>
                  <td className="p-2.5 text-gray-400">Кумулятивное давление покупок / продаж (CVD) в реальном времени.</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-emerald-400 font-bold">🟢 БЫЧЬЯ (+1.5K)</span> / <span className="text-rose-400 font-bold">🔴 МЕДВЕЖЬЯ (-1.5K)</span></div>
                    <div>• <span className="text-amber-400 font-bold">🔥 АНОМАЛЬНЫЕ ПОКУПКИ</span> — кульминация объема.</div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-purple-300">5. Order Block / Зона<br/><span className="text-[10px] text-gray-500 font-mono">Order Block / Зона Входа</span></td>
                  <td className="p-2.5 text-gray-400">Нахождение цены в институциональных зонах спроса/предложения (+OB, -OB) или OTE.</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-emerald-400 font-bold">🟢 В ЗОНЕ +OB</span> — поддержка китов.</div>
                    <div>• <span className="text-rose-400 font-bold">🔴 В ЗОНЕ -OB</span> — <strong>Не покупать в лоб!</strong> Для SHORT.</div>
                    <div>• <span className="text-amber-300 font-bold">🎯 В ЗОНЕ OTE (62-79%)</span> — лучшая точка входа.</div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-violet-300">6. RSI Моментум (14)<br/><span className="text-[10px] text-gray-500 font-mono">RSI Моментум (14)</span></td>
                  <td className="p-2.5 text-gray-400">Динамика моментума и фильтр зон перекупленности / перепроданности.</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-emerald-400">48-60% 🟢 Бычий</span> / <span className="text-rose-400">40-49% 🔴 Медвежий</span></div>
                    <div>• <span className="text-rose-400 font-bold">🔴 ПЕРЕКУПЛЕН (&gt;70)</span> / <span className="text-emerald-400 font-bold">🟢 ПЕРЕПРОДАН (&lt;30)</span></div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-emerald-400">7. Расчетный Winrate %<br/><span className="text-[10px] text-gray-500 font-mono">Расчетный Winrate %</span></td>
                  <td className="p-2.5 text-gray-400">Динамическая математическая вероятность успешности сценария.</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-emerald-400 font-bold">85% – 96% 🔥 (Категория A+)</span> — 100% объем.</div>
                    <div>• <span className="text-amber-400 font-bold">65% – 80% ⚖️ (Категория B)</span> — стандартный вход.</div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-cyan-400">8. Торговый Сетап<br/><span className="text-[10px] text-gray-500 font-mono">Торговый Сетап</span></td>
                  <td className="p-2.5 text-gray-400">Текущий статус исполнения: от ожидания зоны до фиксации тейков.</td>
                  <td className="p-2.5 text-gray-300 space-y-0.5">
                    <div>• <span className="text-amber-300 font-bold">🎯 ВХОД @ Leg 1 (OB/OTE)</span> — <strong>СИГНАЛ ВХОДА!</strong></div>
                    <div>• <span className="text-cyan-400 font-bold">✅ ДОСТИГНУТ TP1</span> — 50-70% закрыто, стоп в БУ.</div>
                    <div>• <span className="text-emerald-400 font-bold">🏁 ДОСТИГНУТ TP2 🎯</span> — полная фиксация.</div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-rose-300">9. Альтернатива (План Б)<br/><span className="text-[10px] text-gray-500 font-mono">Альтернатива (План Б)</span></td>
                  <td className="p-2.5 text-gray-400">Уровень инвалидации сценария при пробое стоп-лосса.</td>
                  <td className="p-2.5 text-gray-300 font-mono">Слом SL &lt;цена&gt; ➔ Переворот в импульс слома</td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-2.5 font-bold text-sky-300">10. Активный Пресет<br/><span className="text-[10px] text-gray-500 font-mono">Активный Пресет</span></td>
                  <td className="p-2.5 text-gray-400">Текущий профиль чувствительности (Золото 15м, BTC Агрессивный и т.д.).</td>
                  <td className="p-2.5 text-gray-300">Индикатор оптимизирован под параметры выбранного актива.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Новая секция: Прозрачные Линии, Перестроения и Появление Нового Сетапа */}
        <div className="p-5 bg-gradient-to-br from-indigo-950/40 via-gray-900 to-[#121929] border border-indigo-500/40 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
            <h6 className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-indigo-400" />
              2. Прозрачные Линии (Ghost Lines), Перестроения и Новый Сетап:
            </h6>
            <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
              Визуальная Логика Индикатора
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-gray-900/90 rounded-xl border border-emerald-500/30 space-y-1.5">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Яркие сплошные линии (Основной сетап)
              </span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                Ярко-зеленые (LONG) или ярко-красные (SHORT) волновые линии отображают приоритетный математический сценарий с вероятностью от 75% до 96%. По ним выставляются ордера на вход, тейки и стоп.
              </p>
            </div>

            <div className="p-3.5 bg-gray-900/90 rounded-xl border border-gray-600/50 space-y-1.5">
              <span className="font-bold text-gray-300 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-gray-400" />
                Прозрачные пунктирные линии (План Б / Слом)
              </span>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Полупрозрачные серые или блеклые проекции показывают альтернативный сценарий. Они наглядно показывают, <strong>куда пойдет импульс, если пробьется стоп-лосс</strong>. Вы заранее видите цель противоположного движения.
              </p>
            </div>
          </div>

          {/* Когда перестраиваются */}
          <div className="p-3.5 bg-amber-950/20 rounded-xl border border-amber-500/30 space-y-2 text-xs">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
              Когда Линии Автоматически Перестраиваются:
            </span>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 text-[11px] pl-1">
              <li>
                <strong className="text-amber-200">1. Обновление свингов (New High/Low):</strong> При формировании нового экстремума индикатор динамически сдвигает уровни OTE 62-79% и подтягивает точку <code>📍 ВХОД</code> для оптимального коэффициента R:R.
              </li>
              <li>
                <strong className="text-rose-300">2. Smart Auto-Flip (Переворот без ожидания стопа):</strong> Если цена уперлась во встречный институциональный блок (<code className="text-rose-300">-OB</code>), дельта развернулась, а старший таймфрейм давит вниз — старые линии лонга <strong>мгновенно стираются</strong> и строятся линии импульса SHORT.
              </li>
              <li>
                <strong className="text-rose-400">3. Пробой уровня Стоп-Лосса (Слом SL):</strong> При закрытии свечи за отметкой SL основной сетап аннулируется, а прозрачные линии Плана Б становятся активными.
              </li>
            </ul>
          </div>

          {/* Когда новый сетап */}
          <div className="p-3.5 bg-blue-950/20 rounded-xl border border-blue-500/30 space-y-2 text-xs">
            <span className="font-bold text-blue-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Когда Появляется Совершенно Новый Сетап:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-gray-300">
              <div className="p-2.5 bg-gray-900/80 rounded-lg border border-gray-800 space-y-1">
                <span className="font-bold text-emerald-300 block">🏁 Взятие TP2 (100% прибыли)</span>
                <p className="text-gray-400 text-[10.5px]">Сетап успешно завершен. Индикатор ждет нового слома структуры (CHoCH) или теста встречной зоны ликвидности.</p>
              </div>
              <div className="p-2.5 bg-gray-900/80 rounded-lg border border-gray-800 space-y-1">
                <span className="font-bold text-cyan-300 block">⚡ Слом структуры (CHoCH / BOS)</span>
                <p className="text-gray-400 text-[10.5px]">Пробой локального или глобального свинга с закреплением телом свечи и подтверждением объемом.</p>
              </div>
              <div className="p-2.5 bg-gray-900/80 rounded-lg border border-gray-800 space-y-1">
                <span className="font-bold text-purple-300 block">📦 Формирование нового OB / FVG</span>
                <p className="text-gray-400 text-[10.5px]">Когда крупный игрок оставляет свежий имбаланс или блок ордеров, индикатор рассчитывает новый сетап с актуальным Winrate %.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Градации Вероятностей */}
        <div className="space-y-3">
          <h6 className="font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            3. Градация Вероятностей (Winrate %):
          </h6>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1.5">
              <span className="font-bold text-emerald-300 block">🔥 85% – 96% (Сетап A+)</span>
              <p className="text-gray-400 text-[11px] leading-relaxed">Полный консенсус: слом + старший тренд (HTF) + подтверждающая дельта + чистый путь без встречных блоков. <strong>Вход 100% рабочим объемом.</strong></p>
            </div>
            <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-1.5">
              <span className="font-bold text-blue-300 block">⚖️ 65% – 80% (Сетап B)</span>
              <p className="text-gray-400 text-[11px] leading-relaxed">Хороший трендовый сетап, но дельта умеренная или идет тест верхней границы зоны. <strong>Вход стандартным объемом.</strong></p>
            </div>
            <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1.5">
              <span className="font-bold text-rose-300 block">⚠️ &lt; 60% (Контртренд)</span>
              <p className="text-gray-400 text-[11px] leading-relaxed">Конфликт факторов или упор во встречный Order Block. <strong>Сделка блокируется / ожидается переворот Auto-Flip.</strong></p>
            </div>
          </div>
        </div>

        {/* Правила Входа */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-gray-900/90 rounded-xl border border-emerald-500/30 space-y-2">
            <span className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
              🟢 Правила Входа в LONG (Покупка):
            </span>
            <ul className="list-disc list-inside space-y-1 text-gray-300 text-[11px] pl-1">
              <li>Линия прогноза зеленая направлена вверх к TP1/TP2.</li>
              <li>Вход на откате к отметке <code>📍 ВХОД (OTE / +OB)</code>.</li>
              <li>Статус HUD: <code>HTF Up</code> и положительная дельта.</li>
              <li>Стоп-Лосс строго на линии <code>🛑 СТОП-ЛОСС</code>.</li>
              <li>Фиксация: 50-70% на TP1, перевод стопа в Безубыток.</li>
            </ul>
          </div>

          <div className="p-4 bg-gray-900/90 rounded-xl border border-rose-500/30 space-y-2">
            <span className="font-bold text-rose-400 text-sm flex items-center gap-1.5">
              🔴 Правила Входа в SHORT (Продажа):
            </span>
            <ul className="list-disc list-inside space-y-1 text-gray-300 text-[11px] pl-1">
              <li>Линия прогноза красная направлена вниз к TP1/TP2.</li>
              <li>Вход на ретесте зоны <code>-OB / -FVG</code>.</li>
              <li>Статус HUD: <code>🔴 МЕДВЕЖИЙ | HTF Down</code> и отрицательная дельта.</li>
              <li>Стоп-Лосс над вершиной блока <code>🛑 СТОП-ЛОСС</code>.</li>
              <li>Фиксация: 50-70% на TP1, перевод в Безубыток.</li>
            </ul>
          </div>
        </div>

        {/* Smart Auto-Flip */}
        <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2 text-xs">
          <span className="font-bold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Умный Авто-Переворот (Smart Auto-Flip):
          </span>
          <p className="text-gray-300 text-[11px] leading-relaxed">
            Если цена пошла в откат, уперлась во встречный институциональный блок (<code className="text-rose-300">-OB</code>), дельта развернулась, а старший таймфрейм подтверждает давление медведей — индикатор <strong>не ждет выбивания стоп-лосса</strong>, а автоматически стирает слабый прогноз и перестраивает волну в сторону доминирующего тренда.
          </p>
        </div>
      </section>

      {/* Раздел 1: Введение */}
      <section className="bg-gradient-to-br from-gray-900/90 to-gray-800/80 p-6 rounded-2xl border border-gray-700/60 shadow-xl space-y-4">
        <h5 className="text-lg font-bold text-blue-400 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-400" />
          1. Обзор Индикаторов S&T Premium v6 & Новый Двигатель Невалидации
        </h5>
        <p className="text-gray-300 leading-relaxed">
          Набор индикаторов <strong className="text-white">S&T Premium v6</strong> представляет собой профессиональный аналитический комплекс для TradingView, объединяющий Smart Money Concept (SMC), анализ объемной дельты (Volume Delta), мульти-таймфрейм уровни (MTF) и новый алгоритм <strong className="text-cyan-400">Условной Невалидации (Conditional Invalidation Engine)</strong>.
        </p>
      </section>

      {/* Раздел 1.1: Архитектура Условной Невалидации и Пресеты Активов */}
      <section className="bg-gradient-to-br from-[#0c1222] to-[#121829] p-6 rounded-2xl border border-cyan-500/30 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h5 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            1.1. Архитектура Условной Невалидации: Переход от Предсказания к Управлению Рисками
          </h5>
          <span className="bg-cyan-500/20 text-cyan-300 text-xs px-2.5 py-1 rounded-full border border-cyan-500/30 font-mono font-bold">
            Новая Методология
          </span>
        </div>

        <p className="text-gray-300 text-xs leading-relaxed">
          Вместо наивной попытки «угадать» будущее движение, система работает по принципу <strong>условных утверждений</strong>: 
          <em>«Если волновой прогноз А верен, то цена обязана находиться в заданных границах. При выходе за невалидационный барьер прогноз немедленно аннулируется (линии окрашиваются в серый цвет) и активируется альтернативный сценарий (План Б)»</em>.
        </p>

        {/* 3 Золотых Правила Эллиотта */}
        <div className="space-y-2.5">
          <h6 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            🏛️ 3 «Железных» Золотых Правила Валидации:
          </h6>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800 space-y-1">
              <span className="font-bold text-red-400 block">1. Волна 2 ≤ 100% Волны 1</span>
              <p className="text-gray-400 text-[11px]">Волна 2 не может откатываться глубже начала импульса (иначе статус <code className="text-rose-300">WAVE_2_DEEP</code>).</p>
            </div>
            <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800 space-y-1">
              <span className="font-bold text-yellow-400 block">2. Волна 3 — не самая короткая</span>
              <p className="text-gray-400 text-[11px]">Волна 3 обязана быть длиннее хотя бы одной из волн 1 или 5 (иначе статус <code className="text-amber-300">WAVE_3_SHORTEST</code>).</p>
            </div>
            <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800 space-y-1">
              <span className="font-bold text-emerald-400 block">3. Волна 4 не перекрывает Волну 1</span>
              <p className="text-gray-400 text-[11px]">Минимум волны 4 не имеет права заходить в ценовую зону вершины волны 1 (иначе <code className="text-emerald-300">WAVE_4_OVERLAP</code>).</p>
            </div>
          </div>
        </div>

        {/* Быстрая смена на Золото, Биткоин и Акции РФ */}
        <div className="space-y-2.5">
          <h6 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
            🚀 Быстрая Смена Режимов под Классы Активов (Quick Presets):
          </h6>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-300 border border-gray-800 rounded-xl overflow-hidden">
              <thead className="bg-gray-900/80 text-gray-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-2.5 border-b border-gray-800">Класс Актива</th>
                  <th className="p-2.5 border-b border-gray-800">Экспонента Хёрста (H)</th>
                  <th className="p-2.5 border-b border-gray-800">Длина Свингов</th>
                  <th className="p-2.5 border-b border-gray-800">SL Множитель ATR</th>
                  <th className="p-2.5 border-b border-gray-800">Особенности Режима</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 bg-gray-950/40">
                <tr className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-2.5 font-bold text-amber-400">🥇 Золото (XAUUSD / Forex)</td>
                  <td className="p-2.5 font-mono text-cyan-300">Period: 50</td>
                  <td className="p-2.5 font-mono text-white">5 (Быстрый)</td>
                  <td className="p-2.5 font-mono text-emerald-400">1.8 × ATR</td>
                  <td className="p-2.5 text-gray-400">Высокая ликвидность, быстрая реакция на импульсы.</td>
                </tr>
                <tr className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-2.5 font-bold text-orange-400">⚡ Биткоин (BTC / Crypto)</td>
                  <td className="p-2.5 font-mono text-cyan-300">Period: 200</td>
                  <td className="p-2.5 font-mono text-white">9 (Шумоподавление)</td>
                  <td className="p-2.5 font-mono text-rose-400">2.8 × ATR</td>
                  <td className="p-2.5 text-gray-400">Высокая волатильность, защита от сквизов и ложных выносов.</td>
                </tr>
                <tr className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-2.5 font-bold text-blue-400">🇷🇺 Российские акции (MOEX)</td>
                  <td className="p-2.5 font-mono text-cyan-300">Period: 100</td>
                  <td className="p-2.5 font-mono text-white">7 (Сбалансированный)</td>
                  <td className="p-2.5 font-mono text-amber-400">2.2 × ATR</td>
                  <td className="p-2.5 text-gray-400">Учет гэпов утренних/вечерних сессий, трендовость + боковики.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Конфлюэнс и Оценка Уверенности */}
        <div className="p-4 bg-gray-900/90 rounded-xl border border-gray-800 space-y-2">
          <span className="font-bold text-emerald-400 text-xs block">
            🏆 Конфлюэнсный Балл (0-100%) & Градация Уверенности (Grade):
          </span>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            Балл формируется из 6 независимых факторов: соблюдение правил Эллиотта (+20), пропорции Фибоначчи (+15), совпадение моментума RSI (+15), всплеск объема на импульсе (+15), совпадение с Order Block / Breaker / FVG (+25), глубина отката OTE (+10).
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] pt-1">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">Grade A+ (≥70%): Очень высокая уверенность</span>
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">Grade A (55-69%): Высокая</span>
            <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-bold">Grade B (40-54%): Внимание</span>
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">Grade C (&lt;40%): Опасный / Воздержаться</span>
          </div>
        </div>
      </section>

      {/* Раздел 2: Основные Аббревиатуры */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
        <h5 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-amber-400" />
          2. Расшифровка Ключевых Аббревиатур и Графических Меток
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
            <span className="font-bold text-emerald-400">BOS (Break of Structure)</span>
            <p className="text-gray-400">Подтверждение продолжения текущего тренда при пробое ключевого максимума или минимума.</p>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
            <span className="font-bold text-rose-400">CHoCH (Change of Character)</span>
            <p className="text-gray-400">Первый сигнал о возможной смене тренда. Пробой последнего ключевого уровня противоположной стороны.</p>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
            <span className="font-bold text-purple-400">OB (Order Block)</span>
            <p className="text-gray-400">Зона институционального объема, где крупные игроки набирают позиции перед импульсом.</p>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
            <span className="font-bold text-amber-400">FVG (Fair Value Gap)</span>
            <p className="text-gray-400">Дисбаланс цены, где покупатели или продавцы полностью доминировали, оставляя ценовой разрыв.</p>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
            <span className="font-bold text-blue-400">OTE (Optimal Trade Entry)</span>
            <p className="text-gray-400">Оптимальная зона входа по Фибоначчи (61.8% – 78.6%), где риск/прибыль наилучшие.</p>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
            <span className="font-bold text-cyan-400">Liq S/R (Liquidity S/R)</span>
            <p className="text-gray-400">Уровни скопления ликвидности (стоп-лоссов розничных трейдеров), выступающие магнитом для цены.</p>
          </div>
        </div>
      </section>

      {/* Раздел 3: Графические Схемы */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
        <h5 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          3. Наглядные Схемы Торговых Сетапов
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/40 space-y-3">
            <h6 className="font-bold text-emerald-400 text-xs uppercase tracking-wider">LONG Сетап (Покупка)</h6>
            <img src={longSetupImg} alt="LONG Setup" className="w-full h-auto rounded-lg border border-gray-700" />
            <p className="text-xs text-gray-400">Вход от Bullish OB / FVG в зоне OTE со стопом за минимумом импульса.</p>
          </div>
          <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/40 space-y-3">
            <h6 className="font-bold text-rose-400 text-xs uppercase tracking-wider">SHORT Сетап (Продажа)</h6>
            <img src={shortSetupImg} alt="SHORT Setup" className="w-full h-auto rounded-lg border border-gray-700" />
            <p className="text-xs text-gray-400">Вход от Bearish OB / FVG в премиум-зоне с целью на тест нижней ликвидности.</p>
          </div>
          <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/40 space-y-3">
            <h6 className="font-bold text-purple-400 text-xs uppercase tracking-wider">Order Block & FVG DXY/OIL</h6>
            <img src={obFvgImg} alt="Order Block & FVG" className="w-full h-auto rounded-lg border border-gray-700" />
            <p className="text-xs text-gray-400">Взаимодействие цены с блоками ордеров и дисбалансами ликвидности.</p>
          </div>
        </div>
      </section>

      {/* Раздел 4: Особенности индикаторов */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
        <h5 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-400" />
          4. Специфика Модулей S&T
        </h5>
        <div className="space-y-3 text-xs text-gray-300">
          <div className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <strong className="text-amber-300">Volume Delta 5TF + MTF:</strong> Анализирует рыночную дельту на 5 таймфреймах одновременно. Автоматически рассчитывает вероятность продолжения движения на основе Фибоначчи.
          </div>
          <div className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <strong className="text-amber-300">Super Indicator S&T Premium:</strong> Мощный универсальный алгоритм, совмещающий Лоренцев анализ, Smart Money структуры, волны и автоматические линии прогноза от свечи сигнала.
          </div>
          <div className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40">
            <strong className="text-amber-300">S&T MOEX Russia Edition:</strong> Адаптированный индикатор для российского фондового и фьючерсного рынка (акции, фьючерс MOEX) с учетом специфики дневной ликвидности и гэпов.
          </div>
        </div>
      </section>

      {/* Раздел 5: Пошаговая Стратегия Входа с Учетом DXY и OIL (Нефть) */}
      <section className="bg-gradient-to-br from-amber-500/10 via-gray-900 to-gray-900 p-6 rounded-2xl border border-amber-500/30 space-y-4">
        <h5 className="text-lg font-bold text-amber-300 flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-400" />
          5. Инструкция по Входу в Сделки с Учетом DXY (Индекс Доллара) и OIL (Нефть Brent)
        </h5>
        <p className="text-xs text-gray-300 leading-relaxed">
          Профессиональный алгоритм фильтрации сигналов <strong className="text-amber-200">S&T Super Indicator</strong> и прогнозных волновых линий. Перед входом в сделку обязательно сверяйтесь с макро-факторами: <strong className="text-white">DXY (US Dollar Index)</strong> и <strong className="text-white">OIL (Brent Crude Oil)</strong>.
        </p>

        <div className="space-y-4 text-xs">
          <div className="p-4 bg-gray-800/80 rounded-xl border border-gray-700 space-y-2">
            <h6 className="font-bold text-blue-400 text-sm flex items-center gap-1.5">
              1. Фильтрация по DXY (Индекс Доллара США)
            </h6>
            <ul className="list-disc list-inside space-y-1 text-gray-300 pl-2">
              <li><strong className="text-emerald-400">Для LONG по крипте / сырью / валютным парам против USD:</strong> Индекс DXY должен быть в падении, тестировать Bearish OB или находиться в медвежьем CHoCH/BOS. Обратная корреляция!</li>
              <li><strong className="text-rose-400">Для SHORT по рисковым активам:</strong> DXY должен расти, отбиваться от Bullish OB или находиться в ралли. Рост DXY оказывает давление на рынки.</li>
            </ul>
          </div>

          <div className="p-4 bg-gray-800/80 rounded-xl border border-gray-700 space-y-2">
            <h6 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              2. Фильтрация по OIL (Нефть Brent / WTI)
            </h6>
            <ul className="list-disc list-inside space-y-1 text-gray-300 pl-2">
              <li><strong className="text-amber-300">Для акций MOEX, энергетического сектора и товарных валют:</strong> Рост нефти OIL усиливает сигнала LONG по нефтегазовым акциям (LKOH, ROSN, NVTK) и индикатору MOEX Edition.</li>
              <li><strong className="text-rose-400">Падение Нефти:</strong> Если OIL находится в сильном падении, отменяем бычьи сигналы по нефтегазовому сектору и проявляем осторожность с рисковыми активами.</li>
            </ul>
          </div>

          <div className="p-4 bg-gray-800/80 rounded-xl border border-gray-700 space-y-2">
            <h6 className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
              3. Правило Входа по Прогнозным Волновым Линиям
            </h6>
            <ul className="list-disc list-inside space-y-1 text-gray-300 pl-2">
              <li>Линии прогноза рисуются строго от свечи, на которой появился сигнал (Leg 1, Leg 2, Target).</li>
              <li><strong className="text-emerald-300">Точка входа (Entry):</strong> Входим на откате к уровню OTE (61.8% - 78.6%) первой волны (Leg 1).</li>
              <li><strong className="text-rose-300">Стоп-лосс (SL):</strong> Выставляется за экстремум свечи сигнала (для LONG - под минимум свечи, для SHORT - над максимумом).</li>
              <li><strong className="text-cyan-300">Тейк-профит (TP):</strong> Тейк-профит 1 на уровне 100% Leg 1, Тейк-профит 2 на фибо-цели Leg 2 (161.8%).</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Раздел 6: Мобильная настройка */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
        <h5 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-cyan-400" />
          6. Оптимизация и Оповещения в Telegram (Wave Forecast Alerts)
        </h5>
        <p className="text-xs text-gray-300 leading-relaxed">
          Включите переключатель <strong className="text-cyan-300">"Мобильная оптимизация"</strong> в верхнем меню, чтобы адаптировать размеры шрифтов, сместить метки вправо и настроить отображение под приложение TradingView на смартфоне.
        </p>
        
        <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Список встроенных сигналов Волнового Прогноза S&T:
          </div>
          <ul className="list-disc list-inside text-xs text-gray-300 space-y-1.5 leading-relaxed">
            <li><strong className="text-yellow-300">⚡ [Telegram] Подготовка к Входу (Приближение к OTE):</strong> срабатывает заранее, давая время выставить ордер.</li>
            <li><strong className="text-emerald-300">📍 [Telegram] ВХОД В ПОЗИЦИЮ (Leg 1 Entry):</strong> точка фактического входа в сделки.</li>
            <li><strong className="text-emerald-400">🏁 [Telegram] ТЕЙК-ПРОФИТ 1 (TP1):</strong> касание первого тейк-профита / локального импульса.</li>
            <li><strong className="text-cyan-300">🎯 [Telegram] ТЕЙК-ПРОФИТ 2 (TP2):</strong> фиксация главной цели сетапа.</li>
            <li><strong className="text-purple-300">🔄 [Telegram] Зеркальный Ретест (Leg 4):</strong> уведомление о зеркальном откате.</li>
            <li><strong className="text-purple-400">🚀 [Telegram] ТЕЙК-ПРОФИТ 3 (TP3 / Fib 2.618):</strong> максимальная цель расшерения Fib.</li>
            <li><strong className="text-rose-400">🛑 [Telegram] СТОП-ЛОСС / Отмена:</strong> упреждающий сигнал об отмене сценария при пробое уровня SL.</li>
          </ul>
        </div>
      </section>

      {/* Раздел 7: Полное руководство по Telegram Боту */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-cyan-950/40 p-6 rounded-2xl border border-cyan-700/50 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
            <Send className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h5 className="text-lg font-bold text-white flex items-center gap-2">
              7. Пошаговая Инструкция: Настройка Telegram Бота и Webhook с Ноля
            </h5>
            <p className="text-xs text-cyan-300/80">Полное руководство по созданию персонального бота и подключению сигналов TradingView</p>
          </div>
        </div>

        {/* Шаг 1 */}
        <div className="bg-gray-800/80 p-5 rounded-xl border border-gray-700/80 space-y-3">
          <h6 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            Шаг 1: Создание бота в Telegram через @BotFather
          </h6>
          <ol className="list-decimal list-inside text-xs text-gray-300 space-y-2 leading-relaxed">
            <li>Откройте Telegram и в строке поиска введите <strong>@BotFather</strong> (официальный бот с синей галочкой).</li>
            <li>Нажмите <strong>Start</strong> или отправьте команду <code className="bg-gray-900 text-cyan-300 px-1.5 py-0.5 rounded border border-gray-700">/start</code>.</li>
            <li>Отправьте команду <code className="bg-gray-900 text-cyan-300 px-1.5 py-0.5 rounded border border-gray-700">/newbot</code>.</li>
            <li>Введите имя бота (например: <em>S&T Trading Signal Bot</em>).</li>
            <li>Введите юзернейм бота, оканчивающийся на <code className="bg-gray-900 text-amber-300 px-1.5 py-0.5 rounded border border-gray-700">bot</code> (например: <em>st_my_trading_alert_bot</em>).</li>
            <li>
              BotFather пришлёт сообщение с вашим <strong>HTTP API Token</strong> (выглядит как <code className="bg-gray-900 text-emerald-300 px-1.5 py-0.5 rounded border border-gray-700">7123456789:AAFx98...-XYZ</code>).
              <div className="mt-1 text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-800/40">
                ⚠️ Сохраните этот Token в надежном месте и никому не передавайте!
              </div>
            </li>
          </ol>
        </div>

        {/* Шаг 2 */}
        <div className="bg-gray-800/80 p-5 rounded-xl border border-gray-700/80 space-y-3">
          <h6 className="font-bold text-cyan-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            Шаг 2: Получение вашего Telegram Chat ID & Активация
          </h6>
          <ol className="list-decimal list-inside text-xs text-gray-300 space-y-2 leading-relaxed">
            <li>В поиске Telegram найдите бота <strong>@userinfobot</strong> или <strong>@getmyid_bot</strong>.</li>
            <li>Отправьте ему команду <code className="bg-gray-900 text-cyan-300 px-1.5 py-0.5 rounded border border-gray-700">/start</code> и скопируйте числовой <strong>Id</strong> (например: <code className="bg-gray-900 text-cyan-300 px-1.5 py-0.5 rounded border border-gray-700">123456789</code>).</li>
            <li><strong>КРИТИЧЕСКИ ВАЖНО:</strong> Найдите созданного вами бота (из Шага 1) и нажмите <strong>Start</strong> (<code className="bg-gray-900 text-cyan-300 px-1.5 py-0.5 rounded border border-gray-700">/start</code>) или напишите ему любое сообщение. Без этого бот не имеет права отправлять вам уведомления!</li>
          </ol>
        </div>

        {/* Шаг 3 */}
        <div className="bg-gray-800/80 p-5 rounded-xl border border-gray-700/80 space-y-3">
          <h6 className="font-bold text-amber-400 text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400" />
            Шаг 3: Выбор Способа Доставки Оповещений из TradingView в Telegram
          </h6>

          <div className="space-y-3 text-xs text-gray-300">
            {/* Вариант А */}
            <div className="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700 space-y-1.5">
              <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                🟢 Вариант А: Прямой Прямой Webhook API Telegram (Для своего сервера / Скрипта / Webhook-моста)
              </span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                Если у вас есть собственный веб-сервер, VPS или вы используете бесплатный релей (Webhook Relay, Hookdeck, Make/Integromat, FinexBot, Webhook2Telegram):
              </p>
              <div className="bg-black/60 p-2.5 rounded border border-gray-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                URL Webhook: https://api.telegram.org/botВАШ_ТОКЕН/sendMessage?chat_id=ВАШ_CHAT_ID
              </div>
            </div>

            {/* Вариант Б */}
            <div className="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700 space-y-1.5">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                🔵 Вариант Б: Использование Готовых Бесплатных Сервисов-Мостов (Без программирования)
              </span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                Зарегистрируйтесь на любом из популярных бесплатных шлюзов TradingView ➔ Telegram:
              </p>
              <ul className="list-disc list-inside text-[11px] text-gray-300 space-y-1 pl-2">
                <li><strong>FinexBot / TradingViewToTelegram / Hookdeck:</strong> Вставляете свой Bot Token и Chat ID — сервис генерирует персональный Webhook URL для TradingView.</li>
                <li><strong>Integromat (Make) / IFTTT:</strong> Создаете сценарий "Webhook ➔ Telegram Bot".</li>
              </ul>
            </div>

            {/* Вариант В */}
            <div className="bg-gray-900/80 p-3.5 rounded-lg border border-gray-700 space-y-1.5">
              <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                🟣 Вариант В: Через Email-to-Telegram (Если Webhook недоступен)
              </span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                В профиле TradingView в разделе <em>"Email для SMS/Уведомлений"</em> можно добавить Email адрес Telegram бота (например, via <code>@mail2tgbot</code>), и получать оповещения по электронной почте прямо в чат Telegram без подписки TradingView Pro.
              </p>
            </div>
          </div>
        </div>

        {/* Шаг 4 */}
        <div className="bg-gray-800/80 p-5 rounded-xl border border-gray-700/80 space-y-3">
          <h6 className="font-bold text-cyan-300 text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-400" />
            Шаг 4: Пошаговая Настройка Оповещения в TradingView
          </h6>
          <ol className="list-decimal list-inside text-xs text-gray-300 space-y-2 leading-relaxed">
            <li>Нажмите иконку <strong>Часы (Оповещения) 🕒</strong> на правой панели TradingView (или комбинацию Alt + A).</li>
            <li>В окне создания алерта в поле <strong>Условие (Condition)</strong> выберите ваш индикатор: <strong className="text-emerald-300">S&T Super Indicator v6</strong>.</li>
            <li>В выпадающем списке выберите нужный сигнал:
              <ul className="list-disc list-inside pl-4 my-1 text-gray-400 space-y-0.5">
                <li><code>⚡ [Telegram] Подготовка к Входу (Приближение к OTE)</code> — чтобы успеть открыть терминал и выставить лимитку.</li>
                <li><code>📍 [Telegram] ВХОД В ПОЗИЦИЮ (Leg 1 Entry)</code> — факт входа.</li>
                <li><code>🏁 [Telegram] ТЕЙК-ПРОФИТ 1 (TP1)</code> — пробой первой цели.</li>
                <li><code>🎯 [Telegram] ТЕЙК-ПРОФИТ 2 (TP2)</code> — главная цель.</li>
                <li><code>🚀 [Telegram] ТЕЙК-ПРОФИТ 3 (TP3 / Fib 2.618)</code> — расширенная цель.</li>
                <li><code>🛑 [Telegram] СТОП-ЛОСС / Отмена</code> — отмена волнового сценария.</li>
              </ul>
            </li>
            <li>На вкладке <strong>Уведомления (Notifications)</strong> поставьте галочку <strong>Webhook URL</strong> и вставьте ссылку Webhook вашего бота.</li>
            <li>В поле <strong>Сообщение (Message)</strong> можно использовать динамические плейсхолдеры TradingView:
              <div className="bg-black/60 p-3 rounded-lg border border-gray-800 my-2 font-mono text-[11px] text-emerald-300 leading-normal overflow-x-auto">
                📍 S&T ВОЛНОВОЙ СИГНАЛ: &#123;&#123;strategy.order.comment&#125;&#125; &#123;&#123;ticker&#125;&#125;<br />
                Цена: &#123;&#123;close&#125;&#125; | Биржа: &#123;&#123;exchange&#125;&#125;<br />
                Время: &#123;&#123;time&#125;&#125;
              </div>
            </li>
            <li>Нажмите <strong>Создать (Create)</strong>. Готово! Теперь при возникновении сигнала вы будете мгновенно получать форматированное уведомление прямо в свой Telegram.</li>
          </ol>
        </div>
      </section>
    </div>
  );
};
