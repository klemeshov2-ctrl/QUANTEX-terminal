import React from "react";
import { Sparkles, Brain, Cpu, Shield, ArrowRight, CheckCircle2, AlertTriangle, Smartphone, Bell, Sliders, Layers } from "lucide-react";

export const NeuraLibManual: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 text-sm text-gray-300 space-y-8 print:p-0 print:text-black" id="neuralib-manual-doc">
      {/* 🧠 Заголовок и карточка индикатора */}
      <section className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-cyan-950/30 p-6 rounded-2xl border border-purple-500/30 shadow-xl space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3 print:border-gray-400">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 rounded-xl text-white shadow-lg shadow-purple-500/25">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2 print:text-black">
                S&T Neural AI: NeuraLib Deep ML v6
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  Deep Ensemble (3x MLP)
                </span>
              </h4>
              <p className="text-xs text-gray-400 print:text-gray-700">
                Самообучающийся ансамбль нейросетей онлайн-обучения (SGD + Momentum + L2) с адаптивными траекториями
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-gray-950/80 px-3 py-1.5 rounded-lg border border-purple-500/20 text-cyan-400 font-bold self-start sm:self-auto print:hidden">
            Pine Script v6 Ready
          </span>
        </div>

        <p className="text-xs md:text-sm text-gray-300 leading-relaxed print:text-black">
          Индикатор <strong>S&T Neural AI</strong> представляет собой автономную систему предиктивной аналитики, выполняющую 
          обучение прямо в памяти графика TradingView. На каждом закрытии бара рассчитывается вектор из <strong>10 нормализованных признаков</strong>, 
          который передается в ансамбль из трех двухслойных нейросетей (архитектура 10 → 8 → 1). Нейросеть прогнозирует направление импульса, рассчитывает 
          точку входа на откате (Pullback Entry), цели TP1 (50% с переводом в безубыток), трейлинг-стоп (1.5 ATR) и финальную цель TP2.
        </p>
      </section>

      {/* 🔬 Архитектура и вектор признаков */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Cpu className="h-5 w-5 text-cyan-400" />
          1. Архитектура Нейросети и Вектор Признаков (Features)
        </h5>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h6 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Структура Моделей и Обучение</h6>
            <ul className="space-y-2 text-xs text-gray-300 list-disc pl-4 print:text-black">
              <li><strong>Deep Ensemble:</strong> 3 параллельные нейросети с разной инициализацией весов (Xavier-like) и варьируемым шагом обучения.</li>
              <li><strong>Слои:</strong> 10 входов → Скрытый слой (8 нейронов ReLU) → Выходной нейрон (Tanh [-1.0 ... +1.0]).</li>
              <li><strong>Обучение SGD:</strong> Стохастический градиентный спуск с моментумом γ = 0.80 и L2-регуляризацией (Weight Decay λ = 0.001) для защиты от переобучения.</li>
              <li><strong>Мультигоризонтный таргет:</strong> Ошибка рассчитывается на основе усреднения результатов через 3, 5 и 8 баров вперед.</li>
              <li><strong>Кольцевые буферы (Ring Buffers):</strong> Буфер глубиной 200 баров обеспечивает высокую скорость работы O(1) без лагов графика.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h6 className="text-xs font-bold text-purple-300 uppercase tracking-wider">10 Входных Признаков (Feature Space)</h6>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F1: RSI(14)</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Индекс относительной силы</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F2: Delta</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Объемная дельта баров</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F3: WaveTrend</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Осциллятор импульса WT</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F4: EMA(50)</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Дистанция до скользящей</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F5: HTF MTF</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Консенсус старшего таймфрейма</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F6/F7: ROC</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Скорость изменения за 5 и 10 баров</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F8: Vol Ratio</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Отношение ATR(14) к ATR(50)</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300">
                <span className="font-bold text-white print:text-black">F9: Pivots</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Расстояние до Support/Resistance</p>
              </div>
              <div className="bg-[#121625] p-2 rounded-lg border border-gray-800 print:bg-gray-100 print:border-gray-300 col-span-2">
                <span className="font-bold text-white print:text-black">F10: ADX(14)</span>
                <p className="text-[11px] text-gray-400 print:text-gray-700">Сила направленного тренда</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🎯 Правила входа и торговый сетап */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-6 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Layers className="h-5 w-5 text-amber-400" />
          2. Торговый Сетап: Вход на откате, TP1, Трейлинг-Стоп и TP2
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 block w-fit">
              Шаг 1: Сигнал ИИ
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              Прогноз ансамбля <strong>|P|</strong> пересекает динамический порог 85-го перцентиля. Формируется маркер <strong>AI BUY</strong> или <strong>AI SELL</strong>.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 block w-fit">
              Шаг 2: Вход на откате
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              Белая линия <strong>Entry</strong> строится с отступом 0.35 ATR. При касании уровня свечой статус меняется на <strong>ВХОД ИСПОЛНЕН [OK ✅]</strong>, траектория становится пунктирной.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 block w-fit">
              Шаг 3: TP1 & БУ (50%)
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              При достижении <strong>TP1</strong> (2.0 ATR) фиксируется 50% объема, а Стоп-Лосс автоматически переносится в <strong>Безубыток (БУ)</strong>. Активируется трейлинг-стоп 1.5 ATR.
            </p>
          </div>

          <div className="bg-[#121625] p-4 rounded-xl border border-gray-800 space-y-2 print:bg-gray-100 print:border-gray-300">
            <span className="text-xs font-bold text-white bg-purple-500/20 px-2 py-0.5 rounded text-purple-300 block w-fit">
              Шаг 4: TP2 (100%)
            </span>
            <p className="text-xs text-gray-300 print:text-black">
              Главная цель <strong>TP2</strong> (3.8 ATR). Фиксация остатка позиции. При включенном `auto_rebuild` нейросеть начинает поиск следующей волны.
            </p>
          </div>
        </div>

        {/* Полоса уверенности и План Б */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl space-y-2 print:border-gray-400 print:bg-gray-50">
            <h6 className="text-xs font-bold text-purple-300 flex items-center gap-1.5 print:text-black">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Полоса Уверенности Ансамбля (Confidence Ribbon)
            </h6>
            <p className="text-xs text-gray-300 leading-relaxed print:text-black">
              Фиолетовый коридор над/под целью показывает разброс мнений (стандартное отклонение σ) 3 нейросетей. 
              <strong>Узкий коридор</strong> — 3 модели единогласны (уверенность &gt; 80%). <strong>Широкий коридор</strong> — повышенная неопределенность на рынке, рекомендуется снизить размер позиции.
            </p>
          </div>

          <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl space-y-2 print:border-gray-400 print:bg-gray-50">
            <h6 className="text-xs font-bold text-rose-300 flex items-center gap-1.5 print:text-black">
              <Shield className="h-4 w-4 text-rose-400" />
              Альтернативная волна (План Б при сломе SL)
            </h6>
            <p className="text-xs text-gray-300 leading-relaxed print:text-black">
              Пунктирная контрастная линия отображает сценарий слома структуры при выбивании Стоп-Лосса. Показывает встречную цель движения для быстрого переворота позиции (Stop & Reverse).
            </p>
          </div>
        </div>
      </section>

      {/* 📱 Установка в TradingView */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Sliders className="h-5 w-5 text-emerald-400" />
          3. Пошаговая Установка в TradingView
        </h5>

        <div className="space-y-3 text-xs text-gray-300 print:text-black">
          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</span>
            <div>
              <strong className="text-white print:text-black">Скопируйте код:</strong> В данном приложении нажмите кнопку <strong>"Копировать Код"</strong> во вкладке индикатора NeuraLib.
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</span>
            <div>
              <strong className="text-white print:text-black">Откройте Pine Editor:</strong> В нижней панели TradingView (на ПК) нажмите <strong>"Редактор Pine"</strong> (Pine Editor).
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">3</span>
            <div>
              <strong className="text-white print:text-black">Вставьте и сохраните:</strong> Удалите стандартный шаблон, вставьте скопированный код, нажмите <strong>"Сохранить"</strong> и затем <strong>"Добавить на график"</strong>.
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">4</span>
            <div>
              <strong className="text-white print:text-black">TradingView Mobile (iOS / Android):</strong> Индикатор, добавленный на график с ПК в вашем профиле TradingView, автоматически синхронизируется и открывается в мобильном приложении на смартфоне или планшете.
            </div>
          </div>
        </div>
      </section>

      {/* 🔔 Настройка Алертов */}
      <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h5 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Bell className="h-5 w-5 text-amber-400" />
          4. Настройка Оповещений (Alerts) и Webhook
        </h5>

        <p className="text-xs text-gray-300 print:text-black">
          В индикатор встроены готовые условия для триггеров алертов TradingView:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-emerald-400">S&T Neural AI Deep LONG Signal</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Срабатывает при пробое 85-го перцентиля вверх (покупка)</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-rose-400">S&T Neural AI Deep SHORT Signal</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Срабатывает при пробое 85-го перцентиля вниз (продажа)</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-cyan-400">S&T Neural AI Deep TP1 Hit</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Сигнал о фиксации 50% и переводе стопа в безубыток</p>
          </div>
          <div className="bg-[#121625] p-3 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-bold text-purple-400">S&T Neural AI Deep TP2 Hit</span>
            <p className="text-gray-400 print:text-gray-700 mt-1">Сигнал о полном закрытии цели 100%</p>
          </div>
        </div>
      </section>
    </div>
  );
};
