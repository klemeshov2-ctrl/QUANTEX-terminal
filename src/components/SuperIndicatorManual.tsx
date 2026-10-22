import React from "react";
import { Flame, Cpu, BarChart3, Layers, Compass, TrendingUp, CheckCircle2, AlertTriangle, Sliders, Bell, Target, Zap, Shield, Lock, Coins } from "lucide-react";
import { GoldTableGuide } from "./GoldTableGuide";

export const SuperIndicatorManual: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 text-sm text-gray-300 space-y-8 print:p-0 print:text-black" id="super-indicator-manual-doc">
      {/* 🔥 Заголовок и карточка индикатора */}
      <section className="bg-gradient-to-br from-amber-950/40 via-gray-900 to-orange-950/30 p-6 rounded-2xl border border-amber-500/30 shadow-xl space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3 print:border-gray-400">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-orange-500/25">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2 print:text-black">
                S&T Ultimate Super Indicator v6
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  All-in-One Flagship
                </span>
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-700">
                Полное институциональное слияние: Machine Learning + Volume Delta + Smart Money Concepts + Trajectory Engine
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-gray-950/80 px-3 py-1.5 rounded-lg border border-amber-500/20 text-amber-400 font-bold self-start sm:self-auto print:hidden">
            Pine Script v6 Ready
          </span>
        </div>

        <p className="text-xs md:text-sm text-gray-300 leading-relaxed print:text-black">
          <strong>S&T Ultimate Super Indicator</strong> — флагманский индикатор комплексного технического и алгоритмического анализа. 
          Он объединяет в один скрипт 4 независимые аналитические системы, исключая необходимость перегружать график десятками разрозненных индикаторов.
        </p>
      </section>

      {/* 🏆 Практическое руководство по Таблице HUD на примере Золота (XAUUSD) */}
      <GoldTableGuide />

      {/* 🏛️ 4 Столпа Системы */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Layers className="h-5 w-5 text-amber-400" />
          1. Четыре Аналитических Столпа Индикатора
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 print:text-black">
              <Cpu className="h-4 w-4" />
              1. Lorentzian Classification (ML)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Классификатор на основе метрики Лоренца проецирует многомерное пространство индикаторов (RSI, WaveTrend, CCI, ADX) 
              для выявления точек слома тренда с высокой статистической вероятностью (Winrate &gt; 65%).
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 print:text-black">
              <BarChart3 className="h-4 w-4" />
              2. Cumulative Volume Delta (CVD)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Анализ рыночных покупок и продаж. Подсвечивает аномальные объемы крупного капитала, дивергенции цены и дельты 
              (когда цена растет, а дельта падает — признак скрытого распределения).
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 print:text-black">
              <Compass className="h-4 w-4" />
              3. Smart Money Concepts (SMC)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Автоматическое построение институциональных блоков ликвидности: <strong>Order Blocks (OB)</strong>, 
              дисбалансов <strong>Fair Value Gaps (FVG)</strong>, сломов структуры <strong>BOS</strong> и смены характера рынка <strong>CHoCH</strong>.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-purple-400 flex items-center gap-1.5 print:text-black">
              <TrendingUp className="h-4 w-4" />
              4. Dynamic Wave Trajectory Engine & MTF Consensus
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Построение адаптивных волновых траекторий с согласованием направления по старшему таймфрейму (MTF Hierarchy: 5m/15m ➔ 1H, 30m/1H ➔ 4H), точными точками входа на тесте Order Block/FVG/Liquidity Sweep и целями расширения Фибоначчи (TP1, TP2, TP3).
            </p>
          </div>
        </div>
      </section>

      {/* 🧭 Иерархия MTF и Синхронизация Прогнозных Линий */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Compass className="h-5 w-5 text-cyan-400" />
          2. Межтаймфреймовая Синхронизация Прогноза (MTF Consensus)
        </h5>

        <div className="space-y-3 text-xs">
          <p className="text-gray-300 print:text-black leading-relaxed">
            Чтобы прогнозные линии не противоречили друг другу на соседних таймфреймах (например, 5m, 15m, 30m и 1h), в индикаторе внедрена система иерархического согласования:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-[#121625] p-3.5 rounded-xl border border-cyan-500/20 space-y-1.5">
              <span className="font-bold text-cyan-400">1. Сквозная Лестница ТФ (5м ➔ 1Н)</span>
              <p className="text-gray-400 print:text-gray-700">
                Четкая институциональная иерархия: <strong>5м ➔ 15м</strong>, <strong>15м ➔ 1Ч</strong>, <strong>30м/45м/1Ч ➔ 4Ч</strong>, <strong>4Ч ➔ 1Д</strong>, <strong>1Д ➔ 1Н</strong>. Младший таймфрейм видит реальные цели старшего (например, 4Ч берет TP1 4358, а как макро-цель транслирует дневной тейк 4446, устраняя противоречия между шортом и лонгом).
              </p>
            </div>
            <div className="bg-[#121625] p-3.5 rounded-xl border border-indigo-500/20 space-y-1.5">
              <span className="font-bold text-indigo-400">★ Консенсус 5 ТФ (Включен)</span>
              <p className="text-gray-400 print:text-gray-700">
                В Группе 10 настроен <strong>«★ Полный Консенсус 5 ТФ»</strong> (включен по умолчанию). Он опрашивает 15м, 1Ч, 4Ч, 1Д и 1Н, показывая матрицу [15м🔴 1Ч🔴 4Ч🔴 1Д🟢 1Н🟢] и статус: откат к дневной поддержке или абсолютный консенсус.
              </p>
            </div>
            <div className="bg-[#121625] p-3.5 rounded-xl border border-amber-500/20 space-y-1.5">
              <span className="font-bold text-amber-400">2. Точность Входа (Leg 1)</span>
              <p className="text-gray-400 print:text-gray-700">
                Точка входа строго привязана к тесту реальных ценовых зон (+OB / -OB / FVG / свип ликвидности). Если цена уже ушла в импульс к TP1 без касания Leg 1, статус четко отражает ожидание отката либо подтвержденный вход.
              </p>
            </div>
            <div className="bg-[#121625] p-3.5 rounded-xl border border-emerald-500/20 space-y-1.5">
              <span className="font-bold text-emerald-400">3. Расчет Тейков (TP1 / TP2)</span>
              <p className="text-gray-400 print:text-gray-700">
                Цели TP1 и TP2 рассчитываются с учетом волатильности ATR текущего таймфрейма и внешних зон ликвидности (BSL/SSL). Соблюдается правило монотонности (цели не инвертируются и не схлопываются).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 🎯 Правила Входа (Конфлюэнция) */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Target className="h-5 w-5 text-emerald-400" />
          2. Правила Идеального Входа (Правило Трех Подтверждений)
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl space-y-3 print:border-gray-400 print:bg-gray-50">
            <h6 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
              <Zap className="h-4 w-4" />
              Идеальный LONG Сетап (Покупка)
            </h6>
            <ol className="text-xs text-gray-300 space-y-2 list-decimal pl-4 print:text-black">
              <li><strong>Зона интереса:</strong> Цена касается зоны бычьего Order Block (зеленый прямоугольник) или заполняет бычий FVG.</li>
              <li><strong>Сигнал ИИ:</strong> Появление стрелки <strong>BUY</strong> от алгоритма Lorentzian ML.</li>
              <li><strong>Подтверждение дельты:</strong> Гистограмма дельты зеленая или формируется бычья дивергенция.</li>
              <li><strong>Стоп-Лосс:</strong> Устанавливается под нижнюю границу Order Block / свинг low.</li>
              <li><strong>Тейк-Профит:</strong> TP1 (соотношение 1:2), TP2 (противоположная зона ликвидности / верхний OB).</li>
            </ol>
          </div>

          <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl space-y-3 print:border-gray-400 print:bg-gray-50">
            <h6 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
              <Zap className="h-4 w-4" />
              Идеальный SHORT Сетап (Продажа)
            </h6>
            <ol className="text-xs text-gray-300 space-y-2 list-decimal pl-4 print:text-black">
              <li><strong>Зона интереса:</strong> Цена тестирует медвежий Order Block (красный прямоугольник) или медвежий FVG.</li>
              <li><strong>Сигнал ИИ:</strong> Появление стрелки <strong>SELL</strong> от алгоритма Lorentzian ML.</li>
              <li><strong>Подтверждение дельты:</strong> Отрицательная дельта или всплеск продаж крупного игрока.</li>
              <li><strong>Стоп-Лосс:</strong> Устанавливается за верхнюю границу медвежьего блока / свинг high.</li>
              <li><strong>Тейк-Профит:</strong> TP1 (соотношение 1:2), TP2 (ближайшая зона поддержки / нижний OB).</li>
            </ol>
          </div>
        </div>
      </section>

      {/* 🛡️ Адаптивный Трейлинг-Стоп (Anti-Whipsaw) */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Shield className="h-5 w-5 text-emerald-400" />
          3. Надежный Адаптивный Трейлинг-Стоп (Multi-Stage Anti-Whipsaw)
        </h5>

        <p className="text-xs text-gray-300 print:text-gray-800 leading-relaxed">
          В индикатор встроен многоступенчатый алгоритм сопровождения открытой позиции, который защищает накопленный профит и гарантирует, что позицию <strong>не выбьет случайным рыночным шумом</strong>:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#121625] p-4 rounded-xl border border-amber-500/20 print:bg-gray-100 print:border-gray-300 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Lock className="h-4 w-4" />
              <span>Фаза 1: Безубыток (BE)</span>
            </div>
            <p className="text-gray-300 print:text-black">
              Активируется <strong>строго при взятии TP1</strong> (или 85% пути). До взятия первой цели стоп не трогается, позволяя цене свободно тестировать Order Block и собирать ликвидность без риска выбивания.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-emerald-500/20 print:bg-gray-100 print:border-gray-300 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Target className="h-4 w-4" />
              <span>Фаза 2: Защита 50% TP1</span>
            </div>
            <p className="text-gray-300 print:text-black">
              После взятия TP1 стоп подтягивается на <strong>середину дистанции между Entry и TP1</strong> либо за подтвержденный свинг. 50% прибыли уже гарантированно зафиксировано!
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-cyan-500/20 print:bg-gray-100 print:border-gray-300 space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <TrendingUp className="h-4 w-4" />
              <span>Фаза 3: Smart Money & Chandelier</span>
            </div>
            <p className="text-gray-300 print:text-black">
              При движении к TP2/TP3 стоп динамически следует за 10-барными структурными свингами с буфером <strong>2.2 ATR</strong>, полностью защищая от теней и шума.
            </p>
          </div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl text-xs flex items-start gap-2.5 text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Сохранение разметки прогноза:</strong> Срабатывание трейлинга фиксирует прибыль, но <em>не ломает волновой прогноз</em> на графике (до слома базового Hard SL). Доступны 4 режима: Институциональный, Smart Money по свингам структуры (BOS), Широкий Chandelier и Строгий Безубыток.
          </div>
        </div>
      </section>

      {/* ⚙️ Настройки и Режимы */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Sliders className="h-5 w-5 text-blue-400" />
          4. Рекомендованные Таймфреймы и Настройки
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-cyan-400 block mb-1">Скальпинг (1m - 5m)</span>
            <p className="text-gray-300 print:text-black">Период дельты: 9. Чувствительность ML: 45. Множитель TP: 1.2.</p>
          </div>
          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400 block mb-1">Интрадей (15m - 1H)</span>
            <p className="text-gray-300 print:text-black">Период дельты: 14. Чувствительность ML: 60. Множитель TP: 2.0.</p>
          </div>
          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-purple-400 block mb-1">Свинг-трейдинг (4H - 1D)</span>
            <p className="text-gray-300 print:text-black">Период дельты: 21. Чувствительность ML: 75. Множитель TP: 3.5.</p>
          </div>
        </div>
      </section>

      {/* 📊 Архитектура Осцилляторов: Выделенный MACD внизу (Binance) + RSI в таблице */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Target className="h-5 w-5 text-emerald-400" />
          5. Осцилляторы: Строка MACD внизу (Binance) и RSI (6 & 14) в таблице
        </h5>

        <div className="space-y-3 text-xs">
          <div className="bg-[#121625] p-4 rounded-xl border border-emerald-500/30 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400 text-sm flex items-center gap-2">
              <span>📊 Выделенная строка MACD внизу графика (как в MOEX)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">Binance Style</span>
            </span>
            <p className="text-gray-300 print:text-black leading-relaxed">
              В индикаторе реализована чистая визуализация MACD в отдельной строке под графиком точно так же, как в MOEX индикаторе:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 print:text-gray-700 pl-2">
              <li><strong className="text-gray-200">Столбцы гистограммы от 0.00:</strong> зелёные при возрастании моментума, красные при ослаблении.</li>
              <li><strong className="text-yellow-300">DIF (быстрая линия):</strong> желтая линия быстрых колебаний моментума.</li>
              <li><strong className="text-pink-400">DEA (сигнальная линия):</strong> розовая линия сглаженного моментума.</li>
              <li><strong className="text-gray-300">Нулевая линия 0.0:</strong> четкая горизонтальная граница смены фазы рынка.</li>
            </ul>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-blue-500/30 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-blue-400 text-sm flex items-center gap-2">
              <span>📈 RSI (6 и 14) в информационной таблице на графике</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono">Table HUD</span>
            </span>
            <p className="text-gray-300 print:text-black leading-relaxed">
              Быстрый RSI (6) и классический RSI (14) отображаются непосредственно в таблице дашборда на графике со статусами перекупленности (&gt;80) и перепроданности (&lt;20). График и нижняя панель остаются чистыми и не перегруженными.
            </p>
          </div>
        </div>
      </section>

      {/* 🔔 Настройка Алертов */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Bell className="h-5 w-5 text-amber-400" />
          6. Алерты и Webhook в TradingView
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">S&T Super ML BUY Alert</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о подтвержденном сигнале покупки</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-rose-400">S&T Super ML SELL Alert</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о подтвержденном сигнале продажи</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-cyan-400">S&T BOS / CHoCH Structure Break</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о пробое рыночной структуры</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400">S&T Order Block Retest</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о тесте институционального блока</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400">🔒 Трейлинг: Перенос в Безубыток</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о переводе позиции в защитный BE</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">💰 Трейлинг: Фиксация 50% Прибыли</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о фиксации части прибыли на TP1</p>
          </div>
        </div>
      </section>
    </div>
  );
};
