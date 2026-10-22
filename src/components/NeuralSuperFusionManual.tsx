import React from "react";
import { Sparkles, Brain, Cpu, Shield, ArrowRight, CheckCircle2, AlertTriangle, Smartphone, Bell, Sliders, Layers, Flame, Target, Zap, TrendingUp, BarChart3 } from "lucide-react";

export const NeuralSuperFusionManual: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 text-sm text-gray-300 space-y-8 print:p-0 print:text-black" id="superfusion-manual-doc">
      {/* 🌟 Главный баннер супер-индикатора */}
      <section className="bg-gradient-to-br from-amber-950/40 via-purple-950/30 to-cyan-950/40 p-6 rounded-2xl border border-amber-500/30 shadow-2xl space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3 print:border-gray-400">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 via-purple-600 to-cyan-400 rounded-xl text-white shadow-lg shadow-amber-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2 print:text-black">
                S&T Neural SuperFusion AI Engine
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  NeuraLib + SuperIndicator v6
                </span>
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-700">
                Гибридный искусственный интеллект: Слияние Deep Ensemble Neural Network, Lorentzian ML, CVD Delta и Smart Money Concepts
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-gray-950/80 px-3 py-1.5 rounded-lg border border-amber-500/20 text-cyan-400 font-bold self-start sm:self-auto print:hidden">
            Pine Script v6 Master
          </span>
        </div>

        <p className="text-xs md:text-sm text-gray-300 leading-relaxed print:text-black">
          <strong>S&T Neural SuperFusion AI</strong> — флагманская объединенная система, созданная путем глубокой интеграции 
          самообучающейся нейросети <strong>NeuraLib (3x MLP)</strong> и комплексного технического индикатора <strong>Super Indicator (Lorentzian ML + CVD + SMC)</strong>. 
          Главное преимущество объединения — <strong>Матрица Согласования Прогнозов (Consensus Matrix)</strong>: сигналы формируются только тогда, 
          когда независимые математические модели приходят к общему консенсусу, что исключает до 85% ложных входов во флэте.
        </p>
      </section>

      {/* 🏛️ 4 Движка Системы */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Layers className="h-5 w-5 text-amber-400" />
          1. Четыре Движка Аналитической Архитектуры
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#121625] p-4 rounded-xl border border-purple-500/20 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-purple-300 flex items-center gap-1.5 print:text-black">
              <Brain className="h-4 w-4 text-purple-400" />
              Движок 1: Deep Ensemble Neural Network (NeuraLib)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              3 независимые двухслойные нейросети (10 входов → 8 нейронов ReLU → 1 Tanh) с онлайн-обучением SGD + Momentum и L2-регуляризацией прямо на графике. 
              Рассчитывает мультигоризонтную ошибку (3, 5 и 8 баров) и динамический 85-й перцентиль импульса.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-cyan-500/20 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 print:text-black">
              <Cpu className="h-4 w-4 text-cyan-400" />
              Движок 2: Lorentzian Classification ML (Super Indicator)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Неевклидовый классификатор на основе метрики расстояния Лоренца d = ln(1 + |Δx|). Оценивает близость текущей рыночной фазы 
              к историческим разворотам по 4 нормализованным осцилляторам.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-amber-500/20 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 print:text-black">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Движок 3: Cumulative Volume Delta (CVD)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Анализ рыночных покупок и продаж на каждом баре, выявление скрытого институционального набора позиций (поглощения) и подтверждение истинности пробоев.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-emerald-500/20 space-y-2 print:bg-gray-100 print:border-gray-300">
            <h6 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 print:text-black">
              <Target className="h-4 w-4 text-emerald-400" />
              Движок 4: Smart Money Concepts (SMC)
            </h6>
            <p className="text-xs text-gray-300 print:text-black">
              Автоматическое определение зон ликвидности крупного игрока: Бычьих и Медвежьих <strong>Order Blocks (OB)</strong>, зон дисбаланса <strong>FVG</strong> и структуры рынка <strong>BOS/CHoCH</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* 🤝 Матрица Согласования Прогнозов */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Zap className="h-5 w-5 text-amber-400" />
          2. Матрица Согласования Прогнозов (Consensus Matrix)
        </h5>

        <p className="text-xs text-gray-300 print:text-black">
          В индикаторе вычисляется совокупный мастер-прогноз <strong>Master Pred</strong> по формуле взвешенной синергии:
          <br />
          <code className="text-cyan-300 bg-gray-950 px-2 py-1 rounded font-mono text-[11px] block my-2">
            Master = (0.40 × NeuraLib) + (0.30 × Lorentzian) + (0.15 × VolumeDelta) + (0.15 × SMC_Score)
          </code>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl space-y-2 print:border-gray-400 print:bg-gray-50">
            <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded block w-fit">
              ⭐ ЗОЛОТОЙ СИГНАЛ (Golden Confluence)
            </span>
            <p className="text-xs text-gray-300 print:text-black leading-relaxed">
              <strong>100% Согласование:</strong> NeuraLib и Lorentzian одновременно указывают в одну сторону, Дельта подтверждает перевес, а цена находится в зоне Order Block. 
              Ожидаемый Winrate &gt; 82%.
            </p>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl space-y-2 print:border-gray-400 print:bg-gray-50">
            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded block w-fit">
              🟢 / 🔴 СТАНДАРТНЫЙ СИГНАЛ (AI Signal)
            </span>
            <p className="text-xs text-gray-300 print:text-black leading-relaxed">
              Мастер-скор превышает динамический порог 85-го перцентиля, при этом между моделями нет противоречия. 
              Вход на откате к расчетной линии Entry.
            </p>
          </div>

          <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl space-y-2 print:border-gray-400 print:bg-gray-50">
            <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded block w-fit">
              ⚠️ ФИЛЬТР КОНФЛИКТОВ (Защита во флэте)
            </span>
            <p className="text-xs text-gray-300 print:text-black leading-relaxed">
              Если нейросеть сигнализирует LONG, а Lorentzian или Order Block указывают на SHORT — система <strong>блокирует вход</strong>, окрашивая свечи в серый нейтральный цвет.
            </p>
          </div>
        </div>
      </section>

      {/* 🎯 Торговый Сетап и Исполнение */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Target className="h-5 w-5 text-emerald-400" />
          3. Режимы Сетапов и Типы Входа (Упрощение и гибкость)
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-[#121625] p-4 rounded-xl border border-amber-500/30 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded block w-fit">
              🚀 1. Режим: «Активный (Скальпинг)» (По умолчанию)
            </span>
            <p className="text-xs text-gray-300 print:text-black leading-relaxed">
              Оптимизирован для частых сетапов и дейтрейдинга. Порог снижен до 0.12, сигналы формируются при каждом импульсе, а вход рассчитывается <strong>сразу по рынку</strong> на закрытии сигнальной свечи.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-cyan-500/30 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded block w-fit">
              ⚖️ 2. Режим: «Сбалансированный (Свинг)»
            </span>
            <p className="text-xs text-gray-300 print:text-black leading-relaxed">
              Порог 0.20. Фильтрует мелкий рыночный шум и формирует сетапы на устойчивых трендовых движениях на таймфреймах M15–H4.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-purple-500/30 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded block w-fit">
              🛡️ 3. Режим: «Консервативный»
            </span>
            <p className="text-xs text-gray-300 print:text-black leading-relaxed">
              Только сильные импульсы с обязательным 100% подтверждением от нейросети, Lorentzian и дельты.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 block w-fit">
              1. Триггер Сигнала
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              Появление метки <strong>⭐ GOLD BUY/SELL</strong> или <strong>AI BUY/SELL</strong> прямо под/над сигнальной свечой.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 block w-fit">
              2. Мгновенный Вход (Market Entry)
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              Вход сразу на закрытии бара без зависания в ожидании отката. Цели TP1, TP2 и SL рассчитываются немедленно.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 block w-fit">
              3. TP1 & БУ (50%)
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              При достижении <strong>TP1</strong> фиксируется 50% объема, Стоп переносится в <strong>Безубыток (БУ)</strong> и включается трейлинг 1.5 ATR.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-purple-500/20 px-2 py-0.5 rounded text-purple-300 block w-fit">
              4. TP2 Фиксация (100%)
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              Полное закрытие цели <strong>TP2</strong> с автоматической перестройкой на новый сетап при следующем сигнале.
            </p>
          </div>
        </div>
      </section>

      {/* 📱 Установка в TradingView */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Sliders className="h-5 w-5 text-emerald-400" />
          4. Пошаговая Установка в TradingView
        </h5>

        <div className="space-y-3 text-xs text-gray-300 print:text-black">
          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</span>
            <div>
              <strong className="text-white print:text-black">Скопируйте код:</strong> В данном приложении нажмите кнопку <strong>"Копировать Код"</strong> во вкладке 🌟 SuperFusion AI.
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</span>
            <div>
              <strong className="text-white print:text-black">Откройте Pine Editor:</strong> В нижней панели терминала TradingView нажмите <strong>"Редактор Pine"</strong> (Pine Editor).
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">3</span>
            <div>
              <strong className="text-white print:text-black">Вставьте и добавьте на график:</strong> Замените весь текст в редакторе, нажмите <strong>"Сохранить"</strong> и затем <strong>"Добавить на график"</strong>.
            </div>
          </div>
        </div>
      </section>

      {/* 🔔 Настройка Алертов */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Bell className="h-5 w-5 text-amber-400" />
          5. Доступные Оповещения (Alerts)
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#121625] p-3 rounded-xl border border-amber-500/30 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-amber-400">⭐ S&T SuperFusion GOLDEN LONG</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">100% согласованный сигнал покупки высшей надежности</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-purple-500/30 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-purple-400">⭐ S&T SuperFusion GOLDEN SHORT</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">100% согласованный сигнал продажи высшей надежности</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">S&T SuperFusion AI LONG / SHORT Signal</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Стандартный сигнал при превышении порога консенсуса</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-cyan-400">S&T SuperFusion TP1 / TP2 Hit</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Оповещения об исполнении первой и финальной целей прибыли</p>
          </div>
        </div>
      </section>
    </div>
  );
};
