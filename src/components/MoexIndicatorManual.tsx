import React from "react";
import { Landmark, TrendingUp, Clock, AlertTriangle, ShieldCheck, DollarSign, BarChart2, Bell, Sliders, CheckCircle2, ArrowRight, Smartphone, Zap } from "lucide-react";

export const MoexIndicatorManual: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 text-sm text-gray-300 space-y-8 print:p-0 print:text-black" id="moex-manual-doc">
      {/* 🇷🇺 Заголовок и карточка индикатора */}
      <section className="bg-gradient-to-br from-red-950/40 via-gray-900 to-amber-950/30 p-6 rounded-2xl border border-red-500/30 shadow-xl space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3 print:border-gray-400">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-red-600 via-amber-600 to-yellow-500 rounded-xl text-white shadow-lg shadow-red-500/25">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2 print:text-black">
                S&T MOEX Russia Edition v6
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  Рынок РФ (Акции & Фьючерсы)
                </span>
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-700">
                Специализированная алгоритмическая система для Московской Биржи (MOEX, FORTS, RTS, Si, IMOEX)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-gray-950/80 px-3 py-1.5 rounded-lg border border-red-500/20 text-amber-400 font-bold self-start sm:self-auto print:hidden">
            Pine Script v6 Ready
          </span>
        </div>

        <p className="text-xs md:text-sm text-gray-300 leading-relaxed print:text-black">
          Индикатор <strong>S&T MOEX Edition</strong> разработан с нуля с учетом уникальной микроструктуры Московской Биржи: 
          рублевой волатильности, специфики утренних гэпов, внутридневных клирингов (промежуточного и вечернего), 
          а также корреляции с макроэкономическими поводырями — Индексом Мосбиржи (IMOEX), Индексом гособлигаций RGBI, ценами на нефть Brent и курсом юаня/доллара.
        </p>
      </section>

      {/* ⏰ Специфика Сессий и Клирингов */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Clock className="h-5 w-5 text-amber-400" />
          1. Торговые Сессии MOEX и Фильтрация Клирингов
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-amber-400 block">Утренняя Сессия (07:00 - 09:59)</span>
            <p className="text-xs text-gray-300 print:text-black">
              Низкая ликвидность, высокая вероятность ложных выносов. Алгоритм снижает размер допустимого риска и фильтрует утренние гэпы открытия.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-emerald-400 block">Основная Сессия (10:00 - 18:49)</span>
            <p className="text-xs text-gray-300 print:text-black">
              Максимальный институциональный объем. Лучшее время для работы по сигналам ML, пробоям структуры BOS и отбоям от Order Blocks.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-purple-400 block">Вечерняя Сессия (19:05 - 23:50)</span>
            <p className="text-xs text-gray-300 print:text-black">
              Преобладание фьючерсов и физических лиц. Индикатор переключается на волатильность внешних площадок (нефть, металлы).
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 print:border-gray-400 print:bg-gray-50">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <strong className="text-white print:text-black">Фильтр Клирингов на Срочном Рынке FORTS:</strong>
            <p className="text-gray-300 print:text-black">
              • <strong>14:00 - 14:05:</strong> Промежуточный дневной клиринг (вариационная маржа).<br />
              • <strong>18:50 - 19:05:</strong> Основной вечерний клиринг.<br />
              <em>Рекомендация:</em> Не открывать новые позиции за 5 минут до клиринга. Индикатор автоматически удерживает уровни SL/TP без искажения на гэпах клиринга.
            </p>
          </div>
        </div>
      </section>

      {/* 📊 Макро-поводыри и Мультирыночный Консенсус */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <TrendingUp className="h-5 w-5 text-cyan-400" />
          2. Макро-Поводыри Российского Рынка
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <strong className="text-white block print:text-black">🏛️ Индекс Мосбиржи (IMOEX / MOEX)</strong>
            <p className="text-gray-300 print:text-black">
              Главный бенчмарк рынка акций. Индикатор проверяет совпадение направления вашей акции (например, Сбербанк, Газпром, Лукойл) с трендом индекса IMOEX. 
              Сделки по тренду индекса имеют статистическое преимущество более 72%.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <strong className="text-white block print:text-black">📈 Индекс ОФЗ RGBI (Государственные Облигации)</strong>
            <p className="text-gray-300 print:text-black">
              Отражает ожидания по ключевой ставке ЦБ РФ и аппетит к риску институциональных фондов. Рост RGBI — бычий фактор для акций дивидендных эмитентов.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <strong className="text-white block print:text-black">🛢️ Нефть Brent (BR / BRENT)</strong>
            <p className="text-gray-300 print:text-black">
              Критический поводырь для нефтегазового сектора (Лукойл, Роснефть, Татнефть, Новатэк). Импульсы в нефти предвосхищают движения фьючерса RTS и акций.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <strong className="text-white block print:text-black">💴 Курс Валюты (CNYRUB / USDRUB / Si)</strong>
            <p className="text-gray-300 print:text-black">
              Ослабление рубля поддерживает экспортеров (Сургутнефтегаз-преф, ГМК Норникель, Фосагро). Укрепление рубля благоприятно для внутреннего сектора и ритейла.
            </p>
          </div>
        </div>
      </section>

      {/* 📈 Скользящие Средние (EMA 50 / 100 / 200) и Нижняя Панель Осцилляторов (RSI & MACD) */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <BarChart2 className="h-5 w-5 text-amber-400" />
          3. Скользящие Средние (EMA 50 / 100 / 200) и Нижняя Панель Осцилляторов (RSI & MACD)
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <strong className="text-cyan-300 block font-bold print:text-black">📈 Линии EMA 50, EMA 100 и EMA 200 на графике</strong>
            <p className="text-gray-300 print:text-black leading-relaxed">
              <strong>EMA 50 (Циан):</strong> динамический краткосрочный тренд. Первая линия поддержки/сопротивления при импульсных движениях.<br />
              <strong>EMA 100 (Золото):</strong> среднесрочный тренд. Позволяет отличать глубокую коррекцию от истинного разворота.<br />
              <strong>EMA 200 (Розовый/Пурпур):</strong> глобальный долгосрочный тренд рынка MOEX. Нахождение цены выше EMA 200 подтверждает масштабный бычий рынок, ниже — медвежий цикл.<br />
              <strong>Облако тренда & Метки:</strong> полупрозрачное облако между EMA 50 и 100 наглядно визуализирует направление тренда, а значки ⚔️/☠️ и ▲/▼ маркируют пересечения средних и пробой EMA 200.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <strong className="text-amber-300 block font-bold print:text-black">🌊 Выделенная Панель Осцилляторов Внизу Графика</strong>
            <p className="text-gray-300 print:text-black leading-relaxed">
              <strong>RSI (14):</strong> отображает точное числовое значение, визуальный прогресс-бар [■■■■■□□□] и статус перекупленности (&gt;70 🔥) или перепроданности (&lt;30 ⚡).<br />
              <strong>MACD (12, 26, 9):</strong> значения быстрой линии, сигнальной линии и гистограммы с фиксацией расширения или затухания моментума.<br />
              <strong>Консенсус Импульса:</strong> рассчитывает синергию осцилляторов вместе с EMA 50, 100 и 200 (🚀 МОЩНЫЙ LONG / 💥 МОЩНЫЙ SHORT), подтверждая входы по Order Block.
            </p>
          </div>
        </div>
      </section>

      {/* 📱 Настройка Таблицы для Мобильного Экрана TradingView */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-blue-900/40 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Smartphone className="h-5 w-5 text-sky-400" />
          4. Разделение Индикаторов: RSI в Таблице на Графике, MACD в Отдельной Графе Внизу
        </h5>

        <p className="text-xs text-gray-300 leading-relaxed print:text-black">
          В индикаторе MOEX Russia Edition реализовано идеальное разграничение рабочих зон: значения <strong>RSI (6 и 14)</strong> возвращены непосредственно в информационную таблицу на графике со статусами перекупленности и перепроданности, а нижняя выделенная графа отдана <strong>исключительно под чистый индикатор MACD в стиле Binance</strong>:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#121625] p-3 rounded-xl border border-sky-900/40">
            <span className="font-bold text-sky-400 block mb-1">📋 RSI (6 &amp; 14) в Таблице на Графике:</span>
            <span className="text-gray-300">
              Показатели RSI 6 и RSI 14 выведены в строки таблицы с цветовой индикацией: <strong>🔴 Перекуплен (&gt;80)</strong>, <strong>🟢 Перепродан (&lt;20)</strong> и нейтральный баланс. Пресеты: <strong>«💻 ПК (10 строк)»</strong>, <strong>«📱 Мобильный (7 строк)»</strong>, <strong>«⚡ Мини (5 строк)»</strong> и <strong>«🔹 1 колонка»</strong>.
            </span>
          </div>

          <div className="bg-[#121625] p-3 rounded-xl border border-amber-900/40">
            <span className="font-bold text-amber-400 block mb-1">📊 Отдельная Графа Только MACD (как на Binance):</span>
            <span className="text-gray-300">
              Внизу графика отображается чистый MACD с естественной шкалой от 0.0:
              <br />• <strong>Столбцы:</strong> растущие зеленые и падающие красные от нулевой линии 0.00.
              <br />• <strong>DIF (12/26):</strong> быстрая линия (Binance Желтая).
              <br />• <strong>DEA (9):</strong> сигнальная сглаженная линия (Binance Розовая).
            </span>
          </div>

          <div className="bg-[#121625] p-3 rounded-xl border border-indigo-900/40">
            <span className="font-bold text-indigo-400 block mb-1">⚙️ Удобное Отключение и Настройка:</span>
            <span className="text-gray-300">
              В параметрах индикатора (группа <strong>«📊 Строка MACD внизу графика»</strong>) доступен чекбокс включения/выключения отдельной строки MACD.
            </span>
          </div>

          <div className="bg-[#121625] p-3 rounded-xl border border-purple-900/40">
            <span className="font-bold text-purple-400 block mb-1">📈 Набор EMA в стиле Binance:</span>
            <span className="text-gray-300">
              На основном графике свечей добавлены и настраиваются скользящие средние: <strong>EMA 9 (желтая)</strong>, <strong>EMA 21 (розовая)</strong>, <strong>EMA 50 (бирюзовая)</strong>, <strong>EMA 100 (зеленая)</strong> и <strong>EMA 200 (фиолетовая)</strong> с независимыми переключателями.
            </span>
          </div>
        </div>
      </section>

      {/* 🌊 Супер Адаптивный Волновой Прогноз, Импульс Без Отката и Трейлинг-Стоп */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-cyan-500/30 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Zap className="h-5 w-5 text-amber-400" />
          5. Волновой Прогноз MOEX, Импульс Без Отката и 3-Фазовый Трейлинг
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2">
            <strong className="text-amber-400 block font-bold">⚡ Детекция Импульса «Без Отката»:</strong>
            <p className="text-gray-300 leading-relaxed">
              На сильных новостных импульсах (MOEX, дивидендные ралли) цена нередко пробивает локальный экстремум и летит к <strong>TP1 / TP2 сразу, без отката к ордер-блоку</strong>. Индикатор рассчитывает вероятность <code>no_pullback_prob</code> и при значении &gt;60% выводит статус <strong>«🔥 ВЫСОКАЯ (Сплит 50/50)»</strong> в таблицу и на график.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2">
            <strong className="text-cyan-400 block font-bold">🎯 Умный Трейлинг-Стоп (3 Фазы):</strong>
            <p className="text-gray-300 leading-relaxed">
              <strong>1. Безубыток (BE):</strong> при прохождении 50% пути до TP1 стоп переносится в безубыток (+буфер ATR).<br />
              <strong>2. Защита 50% TP1:</strong> при взятии первого тейка фиксируется половина прибыли.<br />
              <strong>3. Динамический Chandelier / Smart Money:</strong> подтягивание стопа за свингами структуры до взятия TP2.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2">
            <strong className="text-emerald-400 block font-bold">🧭 Автоматический Мульти-Таймфрейм (MTF):</strong>
            <p className="text-gray-300 leading-relaxed">
              Индикатор анализирует старший таймфрейм (1M ➔ 5M, 5M ➔ 15M, 1H ➔ 4H, 1D ➔ 1W) без заглядывания в будущее (<code>barmerge.gaps_off</code>). Это исключает контртрендовые ложные входы против старшего тренда Мосбиржи.
            </p>
          </div>
        </div>
      </section>

      {/* 💼 Связка с Российскими Брокерами */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          6. Работа с Терминалами Российских Брокеров
        </h5>

        <div className="space-y-3 text-xs text-gray-300 print:text-black">
          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 flex items-start gap-3 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400 shrink-0">T-Bank (Тинькофф):</span>
            <div>
              Анализ графиков проводится в TradingView с индикатором S&T MOEX. Сигналы по алерту мгновенно приходят в Telegram или мобильное приложение брокера для выставления лимитных заявок.
            </div>
          </div>

          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 flex items-start gap-3 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-cyan-400 shrink-0">Финам (FinamTrade / Transaq):</span>
            <div>
              Поддержка прямой интеграции вебхуков TradingView через Finam API для автоследования и исполнения ордеров.
            </div>
          </div>

          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 flex items-start gap-3 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-blue-400 shrink-0">БКС Мир Инвестиций:</span>
            <div>
              Использование расчетных уровней TP1 / TP2 и стоп-лосса из компактной инфо-панели индикатора для выставления связанных стоп-заявок (тейк-профит + стоп-лосс).
            </div>
          </div>

          <div className="bg-[#121625] p-3.5 rounded-xl border border-gray-800 flex items-start gap-3 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400 shrink-0">Терминал QUIK:</span>
            <div>
              Трансляция ключевых уровней поддержки Liquidity S/R и зон Order Block в стакан котировок QUIK для точного исполнения крупных лотов.
            </div>
          </div>
        </div>
      </section>

      {/* 🔔 Настройка Оповещений MOEX */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Bell className="h-5 w-5 text-amber-400" />
          7. Алерты для Российского Рынка (Telegram & TradingView)
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#121625] p-3 rounded-xl border border-amber-500/30 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400">⚡ MOEX Импульс БЕЗ ОТКАТА (Runaway)</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Предупреждение о высокой вероятности прямого импульса к TP1 без отката</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-sky-500/30 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-sky-400">🛡️ Перевод в Безубыток (BE)</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о переносе стоп-лосса в зону безубытка при взятии 50% TP1</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-emerald-500/30 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">🏁 Достигнут Тейк 1 (TP1 BOS)</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Фиксация 50% позиции и активация динамического трейлинга к TP2</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-emerald-500/30 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-300">🎯 Достигнут Тейк 2 (TP2 🎯)</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Взятие главной целевой зоны волнового прогноза (Fib 1.618)</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">S&T MOEX LONG Signal</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Сигнал на покупку акций или фьючерсов РФ с подтверждением IMOEX</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-rose-400">S&T MOEX SHORT Signal</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Сигнал на шорт акций/фьючерсов с контролем уровней поддержки</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-cyan-400">EMA 50/100 Золотой / Смертельный Крест</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Пересечение средних EMA 50 и 100 — смена среднесрочного тренда</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-pink-400">EMA 200 Пробой Вверх / Вниз</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Пробой ценой линии EMA 200 — смена глобального долгосрочного тренда</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">MACD Бычий / Медвежий Крест</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Пересечение линии MACD и сигнальной линии моментума</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400">RSI Перепроданность (&lt;30) / Перекупленность (&gt;70)</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о достижении экстремальных зон осциллятора</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400">S&T MOEX Morning Gap Alert</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещение о закрытии или заполнении утреннего ценового разрыва</p>
          </div>
        </div>
      </section>
    </div>
  );
};
