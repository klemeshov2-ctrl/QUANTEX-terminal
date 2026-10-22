import React, { useState } from "react";
import { 
  Download, 
  Printer, 
  Loader2, 
  BookOpen, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  Activity, 
  Zap, 
  Clock,
  Sparkles,
  Layers,
  BarChart3,
  Flame,
  Scale,
  Compass,
  Eye,
  RefreshCw,
  GitCommit
} from "lucide-react";
import longSetupImg from "../assets/images/long_setup_diagram_1784556372325.jpg";
import shortSetupImg from "../assets/images/short_setup_diagram_1784556388916.jpg";
import obFvgImg from "../assets/images/order_block_fvg_diagram_1784556404138.jpg";

export const SuperIndicatorGuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const getCleanHtmlContent = () => {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Полное Руководство: S&T Super Indicator v6 (С Прозрачными Линиями и Перестроениями)</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.55;
      color: #0f172a;
      background: #ffffff;
      padding: 30px;
      margin: 0 auto;
      max-width: 960px;
    }
    h1 { color: #0f172a; font-size: 24px; border-bottom: 3px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
    h2 { color: #0369a1; font-size: 17px; margin-top: 26px; margin-bottom: 12px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; }
    h3 { color: #1e293b; font-size: 14px; margin-top: 14px; margin-bottom: 6px; }
    p { margin: 8px 0; font-size: 13px; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px 12px; border: 1px solid #1e293b; font-weight: bold; }
    td { padding: 9px 12px; border: 1px solid #cbd5e1; vertical-align: top; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge-long { background: #dcfce7; color: #166534; font-weight: bold; padding: 2px 7px; border-radius: 4px; display: inline-block; }
    .badge-short { background: #fee2e2; color: #991b1b; font-weight: bold; padding: 2px 7px; border-radius: 4px; display: inline-block; }
    .badge-gold { background: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 7px; border-radius: 4px; display: inline-block; }
    .badge-blue { background: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 7px; border-radius: 4px; display: inline-block; }
    .badge-ghost { background: #f1f5f9; color: #64748b; font-weight: bold; padding: 2px 7px; border-radius: 4px; border: 1px dashed #94a3b8; display: inline-block; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
    .card-long { border-left: 5px solid #16a34a; }
    .card-short { border-left: 5px solid #dc2626; }
    .card-warn { border-left: 5px solid #d97706; }
    .card-info { border-left: 5px solid #0284c7; }
    .card-ghost { border-left: 5px solid #94a3b8; background: #fafafa; }
    ul, ol { margin: 6px 0; padding-left: 22px; font-size: 13px; color: #334155; }
    li { margin-bottom: 6px; }
    code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11.5px; color: #0f172a; font-weight: bold; }
    .hud-row-title { font-weight: bold; color: #0f172a; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none !important; }
      .card { page-break-inside: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>📘 Практическое Руководство: S&T Super Indicator v6</h1>
  <p><strong>Версия системы:</strong> 6.4 (Smart Money Concepts + MTF Trend + Cumulative Volume Delta + Ghost Lines & Auto-Flip)</p>

  <h2>1. Полная Расшифровка Всех 10 Строк Таблицы HUD (Бортовой Компьютер)</h2>
  <p>Таблица в углу графика — это главный аналитический центр системы. Ниже приведен детальный разбор каждой строки:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Строка HUD</th>
        <th style="width: 38%;">Что именно рассчитывает индикатор</th>
        <th style="width: 40%;">Возможные значения и руководство к действию</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="hud-row-title">1. Заголовок и ТФ</span><br><code>★ S&T SUPER / Asset</code></td>
        <td>Отображает текущий анализируемый тикер (например, XAUUSD, BTCUSDT) и рабочий таймфрейм (15, 5, 60).</td>
        <td>Проверьте, что таймфрейм соответствует вашей стратегии (15м — оптимально для интрадея).</td>
      </tr>
      <tr>
        <td><span class="hud-row-title">2. Макро DXY / Нефть</span><br><code>Макро DXY / Нефть</code></td>
        <td>Мульти-рыночный анализ корреляций. Отслеживает динамику Индекса Доллара (DXY) и Нефти (OIL) в реальном времени.</td>
        <td>
          • <span class="badge-short">⚠️ DXY +0.45% (Давление USD)</span> — доллар растет, золото и крипта под давлением (осторожно с лонгами).<br>
          • <span class="badge-long">🟢 DXY -0.30% (Поддержка USD)</span> — доллар падает, попутный ветер для роста золота и криптовалют.<br>
          • <span class="badge-blue">🌐 DXY 0.0% (Стабилен)</span> — макро-фон нейтральный.
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">3. Консенсус Тренда</span><br><code>Консенсус Тренда</code></td>
        <td>Общий вектор рынка, объединяющий локальный слом структуры (CHoCH/BOS) и старший таймфрейм (HTF Trend).</td>
        <td>
          • <span class="badge-long">🟢 БЫЧИЙ (LONG) | HTF Up</span> — максимальный приоритет покупок (A+).<br>
          • <span class="badge-short">🔴 МЕДВЕЖИЙ (SHORT) | HTF Down</span> — максимальный приоритет продаж (A+).<br>
          • <em>Если есть конфликт (например, локально Long, но HTF Down) — индикатор снижает Winrate и переходит в режим ожидания или переворота.</em>
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">4. Дельта Объема</span><br><code>Дельта Объема</code></td>
        <td>Кумулятивная дельта объема (разница между рыночными покупками и продажами). Показывает реальные институциональные деньги.</td>
        <td>
          • <span class="badge-long">🟢 БЫЧЬЯ ДЕЛЬТА (+1.5K)</span> — покупатели агрессивно выкупают стакан.<br>
          • <span class="badge-short">🔴 МЕДВЕЖЬЯ ДЕЛЬТА (-1.5K)</span> — продавцы давят по рынку.<br>
          • <span class="badge-gold">🔥 АНОМАЛЬНЫЕ ПОКУПКИ / ПРОДАЖИ</span> — кульминация объема (высокая вероятность резкого импульса).
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">5. Order Block / Зона</span><br><code>Order Block / Зона Входа</code></td>
        <td>Определяет нахождение текущей цены в институциональных зонах спроса/предложения (+OB, -OB), имбалансах (FVG) или оптимальной зоне OTE.</td>
        <td>
          • <span class="badge-long">🟢 В ЗОНЕ +OB</span> — идеальное место для поиска LONG (поддержка китов).<br>
          • <span class="badge-short">🔴 В ЗОНЕ -OB</span> — сопротивление институционалов. <strong>Запрет покупок в лоб!</strong> Идеально для SHORT.<br>
          • <span class="badge-gold">🎯 В ЗОНЕ OTE (62-79% Fib)</span> — золотая середина отката для выгодного входа.<br>
          • <code>⚪ Вне активных зон</code> — цена в свободном движении.
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">6. RSI Моментум (14)</span><br><code>RSI Моментум (14)</code></td>
        <td>Динамика импульса и фильтр экстремальных состояний рынка (перекупленность / перепроданность).</td>
        <td>
          • <code>48-60% 🟢 Бычий</code> / <code>40-49% 🔴 Медвежий</code> — нормальный здоровый тренд.<br>
          • <span class="badge-short">🔴 ПЕРЕКУПЛЕН (&gt;70)</span> — риск затухания покупок.<br>
          • <span class="badge-long">🟢 ПЕРЕПРОДАН (&lt;30)</span> — риск истощения медведей.
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">7. Расчетный Winrate %</span><br><code>Расчетный Winrate %</code></td>
        <td>Итоговая математическая вероятность успешной отработки прогноза, взвешенная по 5 институциональным факторам.</td>
        <td>
          • <span class="badge-long">85% – 96% 🔥 (Высокий / Категория A+)</span> — торгуем полным объемом.<br>
          • <span class="badge-gold">65% – 80% ⚖️ (Норма / Категория B)</span> — стандартный рабочий вход.<br>
          • <span class="badge-short">&lt; 60% ⚠️ (Слабый / Контртренд)</span> — пропуск входа или ожидание Smart Auto-Flip.
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">8. Торговый Сетап</span><br><code>Торговый Сетап</code></td>
        <td>Текущий статус исполнения волнового прогноза: от ожидания отката до закрытия всех целей.</td>
        <td>
          • <code>⚪ Ожидание теста OB / OTE</code> — ждем касания зоны.<br>
          • <span class="badge-gold">🎯 ВХОД @ Leg 1 (OB / OTE)</span> — <strong>СИГНАЛ НА ОТКРЫТИЕ ПОЗИЦИИ!</strong><br>
          • <span class="badge-blue">📍 ИСПОЛНЕН ВХОД (Leg 1)</span> — позиция в рынке, стоп в защите.<br>
          • <span class="badge-blue">✅ ДОСТИГНУТ TP1</span> — закрыто 50-70%, стоп перенесен в Безубыток (БУ).<br>
          • <span class="badge-long">🏁 ДОСТИГНУТ TP2 🎯</span> — сценарий завершен с максимальной прибылью.<br>
          • <span class="badge-short">⚠️ Прогноз невалиден (SL)</span> — выбит стоп, активирован План Б.
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">9. Альтернатива (План Б)</span><br><code>Альтернатива (План Б)</code></td>
        <td>Критический уровень цены, при пробое которого текущий сценарий полностью отменяется.</td>
        <td>
          • <code>⚠️ Слом SL &lt;цена&gt;</code> — точный уровень защитного стоп-лосса. Закрытие свечи за ним запускает сценарий слома.
        </td>
      </tr>
      <tr>
        <td><span class="hud-row-title">10. Активный Пресет</span><br><code>Активный Пресет</code></td>
        <td>Показывает загруженный набор настроек чувствительности (например, «Золото XAUUSD 15м Оптимальный», «BTC Агрессивный», «MOEX Скальпинг»).</td>
        <td>Позволяет быстро убедиться, что индикатор оптимизирован под текущий торговый инструмент.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Прозрачные Линии (Ghost Forecast Lines), Перестроения и Появление Нового Сетапа</h2>
  
  <div class="card card-ghost">
    <h3>👻 Что такое Полупрозрачные Линии и Свечи (Ghost Lines / План Б)?</h3>
    <p>На графике вы можете видеть <strong>два типа линий</strong>:</p>
    <ul>
      <li><strong>Яркие сплошные линии (Основной сценарий):</strong> Ярко-зеленые (LONG) или ярко-красные (SHORT) волновые линии. Это сценарий с максимальной вероятностью (Winrate &gt; 75%), по которому открывается основная позиция.</li>
      <li><strong>Полупрозрачные пунктирные линии (Ghost / Прозрачные линии альтернативы):</strong> Прозрачные серые или приглушенные проекции. Это <em>«План Б»</em> (институциональный сценарий слома), который активируется только при инвалидации основного движения.</li>
    </ul>
  </div>

  <div class="card card-warn">
    <h3>🔄 Когда Происходит Перестроение Линий Прогноза?</h3>
    <p>Индикатор динамически пересчитывает волны в следующих ситуациях:</p>
    <ol>
      <li><strong>Появление нового локального экстремума (Higher High / Lower Low):</strong> Если цена сформировала новый свинг, индикатор переносит точку <code>📍 ВХОД</code> и пересчитывает уровни Fibonacci OTE (62%–79%), чтобы вход был максимально выгодным.</li>
      <li><strong>Активация Smart Auto-Flip (Переворот тренда):</strong> Если при откате цена уперлась во встречный блок (например, <code>-OB</code> при лонге), дельта объемов развернулась в минус, а старший таймфрейм давит вниз — старые зеленые линии <strong>мгновенно стираются</strong>, а на их месте строятся яркие красные линии импульса SHORT.</li>
      <li><strong>Срабатывание Стоп-Лосса (Пробой SL):</strong> Когда свеча закрывается за уровнем <code>🛑 СТОП-ЛОСС</code>, основной прогноз аннулируется, а полупрозрачные линии Плана Б становятся активными.</li>
    </ol>
  </div>

  <div class="card card-info">
    <h3>✨ Когда Формируется Совершенно Новый Сетап?</h3>
    <p>Новый торговый цикл инициализируется в 3 случаях:</p>
    <ul>
      <li><strong>1. После взятия TP2 (Полная фиксация цели):</strong> Предыдущий сетап успешно завершен. Индикатор ждет нового слома структуры (CHoCH) или теста встречного пула ликвидности для генерации новой волны.</li>
      <li><strong>2. После слома структуры рынка (BOS / CHoCH):</strong> Пробой ключевого фрактального свинга с закреплением телом свечи и подтверждением объемом.</li>
      <li><strong>3. Выход из консолидации:</strong> Цена покидает диапазон накопления и формирует институциональный Order Block.</li>
    </ul>
  </div>

  <h2>3. Классификация Сетапов по Качеству и Вероятности (Winrate %)</h2>
  <div class="card card-long">
    <h3>🔥 85% – 96% (Идеальный сетап категории A+)</h3>
    <p><strong>Факторы:</strong> Согласован локальный слом структуры + старший таймфрейм (HTF) + подтверждающая дельта объема + вход от свежего Order Block. На пути к TP1/TP2 нет встречных препятствий.<br>
    <strong>Тактика:</strong> Вход 100% рабочим объемом позиции.</p>
  </div>

  <div class="card card-info">
    <h3>⚖️ 65% – 80% (Рабочий сетап категории B)</h3>
    <p><strong>Факторы:</strong> Есть трендовое направление и слом структуры, но дельта умеренная или идет тест дальней границы зоны.<br>
    <strong>Тактика:</strong> Вход стандартным или умеренным (70%) объемом.</p>
  </div>

  <div class="card card-warn">
    <h3>⚠️ Менее 60% (Слабый / Контртренд / Вход в блок)</h3>
    <p><strong>Факторы:</strong> Попытка движения против старшего таймфрейма, расхождение с дельтой или вход в лоб во встречный институциональный блок (-OB/+OB).<br>
    <strong>Тактика:</strong> <strong>Сделка строго пропускается</strong> либо алгоритм мгновенно перестраивает сетап в сторону доминирующего тренда (Smart Auto-Flip).</p>
  </div>

  <h2>4. Пошаговые Правила Входа и Сопровождения Сделки</h2>
  <div class="card card-long">
    <h3>🟢 Вход в LONG (Покупка):</h3>
    <ol>
      <li><strong>Прогноз:</strong> На графике построена яркая зеленая траектория вверх к <code>TP1 / TP2</code>.</li>
      <li><strong>Точка входа:</strong> Дождитесь отката цены к отметке <code>📍 ВХОД (Entry / OTE Тест)</code> или касания зоны <code>+OB</code>.</li>
      <li><strong>Проверка HUD:</strong> Консенсус = <code>🟢 БЫЧИЙ</code>, Дельта положительная, Winrate &ge; 75%.</li>
      <li><strong>Стоп-Лосс:</strong> Установите защитный ордер строго на уровень <code>🛑 СТОП-ЛОСС</code> (под минимум блока / свинга).</li>
      <li><strong>Фиксация прибыли:</strong>
        <ul>
          <li>На отметке <code>🏁 TP1</code> закройте <strong>50%–70% объема</strong> и <strong>перенесите стоп в Безубыток (БУ)</strong>.</li>
          <li>На отметке <code>🎯 TP2</code> закройте оставшуюся часть позиции.</li>
        </ul>
      </li>
    </ol>
  </div>

  <div class="card card-short">
    <h3>🔴 Вход в SHORT (Продажа):</h3>
    <ol>
      <li><strong>Прогноз:</strong> На графике построена яркая красная траектория вниз к <code>TP1 / TP2</code>.</li>
      <li><strong>Точка входа:</strong> Дождитесь подъема цены к отметке <code>📍 ВХОД</code> или касания медвежьего блока <code>-OB / -FVG</code>.</li>
      <li><strong>Проверка HUD:</strong> Консенсус = <code>🔴 МЕДВЕЖИЙ | HTF Down</code>, Дельта отрицательная, Winrate &ge; 75%.</li>
      <li><strong>Стоп-Лосс:</strong> Установите стоп-ордер на уровень <code>🛑 СТОП-ЛОСС</code> (над вершиной -OB).</li>
      <li><strong>Фиксация прибыли:</strong> Фиксация 50-70% на <code>🏁 TP1</code> с переводом стопа в Безубыток, остаток на <code>🎯 TP2</code>.</li>
    </ol>
  </div>

  <h2>5. Таймфреймы и Мани-Менеджмент</h2>
  <ul>
    <li><strong>1м – 5м (Скальпинг):</strong> Быстрые сделки внутри 15–60 минут. Жесткий забор TP1, повышенное внимание к спреду.</li>
    <li><strong>15м (Оптимальный для Золота XAUUSD и Криптовалют):</strong> Идеальный баланс надежности сигналов и длительности сделки (1–4 часа).</li>
    <li><strong>30м – 1H (Интрадей-Свинг):</strong> Определение ключевого тренда дня и удержание позиций до глобальных пулов ликвидности.</li>
  </ul>

  <div class="card card-warn" style="margin-top: 20px;">
    <strong>Главное правило риск-менеджмента:</strong> Риск на одну сделку не должен превышать 1–2% от капитала. При достижении TP1 всегда переводите стоп-лосс на уровень входа.
  </div>
</body>
</html>`;
  };

  const handleDownloadFile = (type: 'pdf' | 'html') => {
    setIsGeneratingPDF(true);
    try {
      const htmlContent = getCleanHtmlContent();

      if (type === 'html') {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ST_Super_Indicator_Trading_Manual_2026.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
        return;
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ST_Super_Indicator_Trading_Manual_2026.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error("Download error:", err);
      window.print();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-gray-800 w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-200">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-[#0e1322] border-b border-gray-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Полное Руководство: S&T Super Indicator
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  v6.4 Развернутая версия
                </span>
              </h3>
              <p className="text-xs text-gray-400">Таблица HUD (10 строк), прозрачные линии, перестроение и новый сетап</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {downloadSuccess && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold animate-in fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" /> Файл готов!
              </span>
            )}

            <button
              onClick={() => handleDownloadFile('pdf')}
              disabled={isGeneratingPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
              title="Печать или Сохранение в PDF"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  <span>Печать в PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="h-3.5 w-3.5 text-white" />
                  <span>Печать / Сохранить как PDF</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleDownloadFile('html')}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-amber-300 hover:text-white rounded-xl text-xs font-bold border border-amber-500/30 transition-all shadow-sm active:scale-95"
              title="Скачать полную оффлайн-версию инструкции в формате HTML"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>Скачать файл (.html)</span>
            </button>

            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl text-xs font-semibold border border-gray-800 transition-all ml-1"
            >
              Закрыть ✕
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar" id="super-indicator-pdf-doc">
          
          {/* Header Title Section */}
          <div className="border-b border-gray-800 pb-5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Zap className="h-6 w-6 text-amber-400" />
              Практическое Руководство: S&T Super Indicator v6
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Профессиональная торговая система: Smart Money Concepts (SMC), мультитаймфреймный тренд (MTF), кумулятивная дельта объемов, прозрачные линии прогноза и Smart Auto-Flip.
            </p>
          </div>

          {/* 1. БОРТОВОЙ КОМПЬЮТЕР: ДЕТАЛЬНАЯ РАСШИФРОВКА ВСЕХ 10 СТРОК */}
          <section className="bg-gradient-to-br from-gray-900/90 to-[#0e1424] p-6 rounded-2xl border border-gray-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-blue-400 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-400" />
                1. Детальная Расшифровка Всех 10 Строк Таблицы HUD (Бортовой Компьютер)
              </h4>
              <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                Главный Аналитический Центр
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Таблица в углу графика в реальном времени собирает и валидирует данные по 5 независимым слоям анализа. Ниже подробно расписана каждая строка:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-300 border border-gray-800 rounded-xl overflow-hidden">
                <thead className="bg-gray-950/90 text-gray-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3 border-b border-gray-800 w-[22%]">Строка HUD</th>
                    <th className="p-3 border-b border-gray-800 w-[38%]">Что рассчитывает алгоритм</th>
                    <th className="p-3 border-b border-gray-800 w-[40%]">Возможные значения и руководство к действию</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-cyan-300">1. Заголовок и ТФ<br/><span className="text-[10px] text-gray-500 font-mono">★ S&T SUPER / Asset</span></td>
                    <td className="p-3 text-gray-400">Отображает текущий тикер (XAUUSD, BTCUSDT, SBER) и активный таймфрейм (15м, 5м, 1H).</td>
                    <td className="p-3 text-gray-300">Убедитесь, что таймфрейм соответствует вашей торговой стратегии (15м — оптимально).</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-amber-300">2. Макро DXY / Нефть<br/><span className="text-[10px] text-gray-500 font-mono">Макро DXY / Нефть</span></td>
                    <td className="p-3 text-gray-400">Мульти-рыночный анализ корреляций. Отслеживает динамику Индекса Доллара (DXY) и Нефти (OIL).</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-rose-400 font-bold">⚠️ DXY +0.45% (Давление USD)</span> — доллар растет, риск для лонгов по золоту/BTC.</div>
                      <div>• <span className="text-emerald-400 font-bold">🟢 DXY -0.30% (Поддержка USD)</span> — доллар падает, попутный ветер для покупок.</div>
                      <div>• <span className="text-gray-400">🌐 DXY 0.0% (Стабилен)</span> — нейтральный фон.</div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-blue-300">3. Консенсус Тренда<br/><span className="text-[10px] text-gray-500 font-mono">Консенсус Тренда</span></td>
                    <td className="p-3 text-gray-400">Общий вектор рынка: объединяет локальный слом структуры (CHoCH/BOS) со старшим ТФ (HTF).</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-emerald-400 font-bold">🟢 БЫЧИЙ (LONG) | HTF Up</span> — максимальный приоритет покупок (A+).</div>
                      <div>• <span className="text-rose-400 font-bold">🔴 МЕДВЕЖИЙ (SHORT) | HTF Down</span> — максимальный приоритет продаж (A+).</div>
                      <div>• <em>При конфликте (напр. Long, но HTF Down) Winrate снижается, возможен Smart Auto-Flip.</em></div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-emerald-300">4. Дельта Объема<br/><span className="text-[10px] text-gray-500 font-mono">Дельта Объема</span></td>
                    <td className="p-3 text-gray-400">Кумулятивный перевес рыночных покупок или продаж. Показывает реальные деньги в стакане.</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-emerald-400 font-bold">🟢 БЫЧЬЯ (+1.5K)</span> — перевес покупок.</div>
                      <div>• <span className="text-rose-400 font-bold">🔴 МЕДВЕЖЬЯ (-1.5K)</span> — продавцы давят по рынку.</div>
                      <div>• <span className="text-amber-400 font-bold">🔥 АНОМАЛЬНЫЕ ПОКУПКИ/ПРОДАЖИ</span> — кульминация объема (скорый импульс).</div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-purple-300">5. Order Block / Зона<br/><span className="text-[10px] text-gray-500 font-mono">Order Block / Зона Входа</span></td>
                    <td className="p-3 text-gray-400">Определяет нахождение цены в институциональных зонах спроса/предложения (+OB, -OB), имбалансах (FVG) или OTE.</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-emerald-400 font-bold">🟢 В ЗОНЕ +OB</span> — поддержка китов, место для LONG.</div>
                      <div>• <span className="text-rose-400 font-bold">🔴 В ЗОНЕ -OB</span> — сопротивление китов. <strong>Не покупать в лоб!</strong> Идеально для SHORT.</div>
                      <div>• <span className="text-amber-300 font-bold">🎯 В ЗОНЕ OTE (62-79% Fib)</span> — золотая зона отката.</div>
                      <div>• <span className="text-gray-400">⚪ Вне активных зон</span> — цена в свободном движении.</div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-violet-300">6. RSI Моментум (14)<br/><span className="text-[10px] text-gray-500 font-mono">RSI Моментум (14)</span></td>
                    <td className="p-3 text-gray-400">Динамика импульса и фильтр зон перекупленности / перепроданности.</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-emerald-400">48-60% 🟢 Бычий</span> / <span className="text-rose-400">40-49% 🔴 Медвежий</span> — здоровый тренд.</div>
                      <div>• <span className="text-rose-400 font-bold">🔴 ПЕРЕКУПЛЕН (&gt;70)</span> — риск затухания покупок.</div>
                      <div>• <span className="text-emerald-400 font-bold">🟢 ПЕРЕПРОДАН (&lt;30)</span> — риск истощения медведей.</div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-emerald-400">7. Расчетный Winrate %<br/><span className="text-[10px] text-gray-500 font-mono">Расчетный Winrate %</span></td>
                    <td className="p-3 text-gray-400">Итоговая математическая вероятность отработки сценария, взвешенная по 5 институциональным факторам.</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-emerald-400 font-bold">85% – 96% 🔥 (Высокий / A+)</span> — вход полным объемом.</div>
                      <div>• <span className="text-amber-400 font-bold">65% – 80% ⚖️ (Норма / B)</span> — стандартный вход.</div>
                      <div>• <span className="text-rose-400 font-bold">&lt; 60% ⚠️ (Слабый / Контртренд)</span> — пропуск сделки / ожидание переворота.</div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-cyan-400">8. Торговый Сетап<br/><span className="text-[10px] text-gray-500 font-mono">Торговый Сетап</span></td>
                    <td className="p-3 text-gray-400">Текущая фаза волнового сценария: от ожидания точки входа до закрытия всех целей.</td>
                    <td className="p-3 text-gray-300 space-y-1">
                      <div>• <span className="text-gray-400">⚪ Ожидание теста OB / OTE</span> — ждем коррекцию в зону.</div>
                      <div>• <span className="text-amber-300 font-bold">🎯 ВХОД @ Leg 1 (OB / OTE)</span> — <strong>СИГНАЛ НА ОТКРЫТИЕ ПОЗИЦИИ!</strong></div>
                      <div>• <span className="text-blue-400">📍 ИСПОЛНЕН ВХОД (Leg 1)</span> — позиция в рынке со стопом.</div>
                      <div>• <span className="text-cyan-400 font-bold">✅ ДОСТИГНУТ TP1</span> — закрыто 50-70%, стоп в безубытке (БУ).</div>
                      <div>• <span className="text-emerald-400 font-bold">🏁 ДОСТИГНУТ TP2 🎯</span> — сценарий отработан на 100%.</div>
                      <div>• <span className="text-rose-400">⚠️ Прогноз невалиден (SL)</span> — выбит стоп, активен План Б.</div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-rose-300">9. Альтернатива (План Б)<br/><span className="text-[10px] text-gray-500 font-mono">Альтернатива (План Б)</span></td>
                    <td className="p-3 text-gray-400">Уровень цены, за которым сценарий отменяется и активируется импульс слома.</td>
                    <td className="p-3 text-gray-300">
                      <code>⚠️ Слом SL &lt;цена&gt;</code> — точный уровень стоп-лосса. Закрытие свечи за ним запускает сценарий слома.
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-800/30">
                    <td className="p-3 font-bold text-sky-300">10. Активный Пресет<br/><span className="text-[10px] text-gray-500 font-mono">Активный Пресет</span></td>
                    <td className="p-3 text-gray-400">Отображает текущий профиль чувствительности (Золото 15м, BTC Агрессивный, MOEX Скальпинг).</td>
                    <td className="p-3 text-gray-300">Позволяет мгновенно проверить, что индикатор откалиброван под конкретный актив.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. НОВЫЙ РАЗДЕЛ: ПРОЗРАЧНЫЕ ЛИНИИ, ПЕРЕСТРОЕНИЯ И НОВЫЙ СЕТАП */}
          <section className="bg-gradient-to-br from-indigo-950/40 via-gray-900 to-[#121929] p-6 rounded-2xl border border-indigo-500/40 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h4 className="text-base font-bold text-indigo-300 flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-400" />
                2. Прозрачные Линии Прогноза (Ghost Lines), Перестроение и Новый Сетап
              </h4>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                Визуальная Логика Индикатора
              </span>
            </div>

            {/* Карточки типов линий */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-gray-900/90 rounded-xl border border-emerald-500/40 space-y-2">
                <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Яркие сплошные линии (Основной Сценарий):
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Ярко-зеленые (LONG) или ярко-красные (SHORT) волновые линии отображают приоритетный математический сценарий с вероятностью от 75% до 96%. По этим линиям выставляются ордера на вход <code>📍 ВХОД</code>, цели <code>TP1 / TP2</code> и защита <code>🛑 СТОП-ЛОСС</code>.
                </p>
              </div>

              <div className="p-4 bg-gray-900/90 rounded-xl border border-gray-600/60 space-y-2">
                <div className="font-bold text-gray-300 text-sm flex items-center gap-2">
                  <GhostIcon className="h-4 w-4 text-gray-400" />
                  Прозрачные пунктирные линии (План Б / Слом):
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Полупрозрачные серые или блеклые проекции показывают альтернативный сценарий. Они показывают, <strong>куда мгновенно пойдет цена, если маркет-мейкер пробьет стоп-лосс</strong>. Вы заранее видите цель противоположного импульса и готовы к перевороту.
                </p>
              </div>
            </div>

            {/* Когда линии перестраиваются */}
            <div className="p-4 bg-amber-950/20 rounded-xl border border-amber-500/30 space-y-3 text-xs">
              <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-400" />
                Когда линии автоматически перестраиваются в реальном времени:
              </div>
              <ul className="list-disc list-inside space-y-2 text-gray-300 text-[11px] pl-1">
                <li>
                  <strong className="text-amber-200">1. При обновлении свингов (Higher High / Lower Low):</strong> Если рынок делает новый экстремум в пределах текущего тренда, индикатор динамически сдвигает уровни OTE 62-79% и подтягивает точку <code>📍 ВХОД</code>, чтобы вход оставался идеальным.
                </li>
                <li>
                  <strong className="text-rose-300">2. При срабатывании Smart Auto-Flip (Переворот без ожидания стопа):</strong> Если цена уперлась во встречный институциональный блок (например, <code>-OB</code>), дельта развернулась, а старший таймфрейм давит вниз — индикатор <strong>немедленно стирает зеленые линии лонга</strong> и строит новый нисходящий прогноз в SHORT.
                </li>
                <li>
                  <strong className="text-rose-400">3. При закрытии свечи за уровнем SL (Пробой стопа):</strong> Основной прогноз аннулируется, а прозрачные линии импульса слома становятся активными.
                </li>
              </ul>
            </div>

            {/* Когда появляется новый сетап */}
            <div className="p-4 bg-blue-950/20 rounded-xl border border-blue-500/30 space-y-3 text-xs">
              <div className="font-bold text-blue-300 text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                Когда формируется совершенно Новый Торговый Сетап:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-gray-300">
                <div className="p-3 bg-gray-900/80 rounded-lg border border-gray-800 space-y-1">
                  <span className="font-bold text-emerald-300 block">🏁 Полное взятие TP2</span>
                  <p className="text-gray-400">Сетап считается полностью отработанным (100% прибыли). Индикатор переходит в режим ожидания следующего слома или теста ликвидности.</p>
                </div>
                <div className="p-3 bg-gray-900/80 rounded-lg border border-gray-800 space-y-1">
                  <span className="font-bold text-cyan-300 block">⚡ Слом структуры (CHoCH / BOS)</span>
                  <p className="text-gray-400">При пробое ключевого максимума/минимума с закреплением телом свечи алгоритм фиксирует смену настроения рынка и строит новый сценарий.</p>
                </div>
                <div className="p-3 bg-gray-900/80 rounded-lg border border-gray-800 space-y-1">
                  <span className="font-bold text-purple-300 block">📦 Формирование нового OB / FVG</span>
                  <p className="text-gray-400">Когда крупный игрок оставляет новый имбаланс или блок ликвидности, индикатор рассчитывает свежий сетап с актуальным Winrate %.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. ГРАДАЦИЯ ВЕРОЯТНОСТЕЙ */}
          <section className="bg-gray-900/70 p-6 rounded-2xl border border-gray-800 space-y-4">
            <h4 className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              3. Классификация Сетапов по Вероятности (Winrate %)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                <span className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                  🔥 85% – 96% (Сетап A+)
                </span>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  <strong>Полный консенсус:</strong> Локальный слом + старший таймфрейм (HTF) + объемная дельта + вход от Order Block. Дорога к тейкам чистая.
                </p>
                <div className="pt-1 text-emerald-400 font-bold text-[11px]">
                  ➔ Вход 100% рабочим объемом
                </div>
              </div>

              <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2">
                <span className="font-bold text-blue-300 text-sm flex items-center gap-1.5">
                  ⚖️ 65% – 80% (Сетап B)
                </span>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  <strong>Рабочий тренд:</strong> Есть направление и структура, но дельта умеренная или идет тест верхней границы зоны.
                </p>
                <div className="pt-1 text-blue-400 font-bold text-[11px]">
                  ➔ Вход стандартным / сниженным объемом (70%)
                </div>
              </div>

              <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-2">
                <span className="font-bold text-rose-300 text-sm flex items-center gap-1.5">
                  ⚠️ &lt; 60% (Слабый / Контртренд)
                </span>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  <strong>Конфликт факторов:</strong> Попытка отскока против старшего тренда, отрицательная дельта или вход в лоб во встречный Order Block.
                </p>
                <div className="pt-1 text-rose-400 font-bold text-[11px]">
                  ➔ Пропуск сделки / Ожидание переворота (Auto-Flip)
                </div>
              </div>
            </div>
          </section>

          {/* 4. ТОЧНЫЕ ПРАВИЛА ВХОДА В ПОЗИЦИЮ */}
          <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-[#121929] p-6 rounded-2xl border border-blue-500/20 space-y-5">
            <h4 className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-400" />
              4. Пошаговые Правила Входа (Entry Triggers)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* LONG */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Условия для сделки LONG (Покупка):
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 leading-relaxed">
                  <li><strong>Зеленая линия прогноза</strong> направлена вверх к TP1 и TP2.</li>
                  <li><strong>Точка входа:</strong> цена откатывается в район <code>📍 ВХОД (Entry / OTE Тест)</code> или касается бычьего <code>+OB / +FVG</code>.</li>
                  <li><strong>Таблица HUD:</strong> статус <code>🟢 БЫЧИЙ (LONG)</code>, дельта положительная.</li>
                  <li><strong>Стоп-Лосс (SL):</strong> выставляется строго на линию <code>🛑 СТОП-ЛОСС</code> (под минимум блока / свинга).</li>
                  <li><strong>Тейк 1 (TP1):</strong> закрытие 50-70% позиции и перенос стопа в Безубыток (БУ).</li>
                </ol>
              </div>

              {/* SHORT */}
              <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <TrendingDown className="h-4 w-4" />
                  Условия для сделки SHORT (Продажа):
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 leading-relaxed">
                  <li><strong>Красная линия прогноза</strong> направлена вниз к TP1 и TP2.</li>
                  <li><strong>Точка входа:</strong> цена поднимается на ретест <code>📍 ВХОД</code> или медвежьего блока <code>-OB / -FVG</code>.</li>
                  <li><strong>Таблица HUD:</strong> статус <code>🔴 МЕДВЕЖИЙ (SHORT) | HTF Down</code>, дельта отрицательная.</li>
                  <li><strong>Стоп-Лосс (SL):</strong> выставляется строго на уровень <code>🛑 СТОП-ЛОСС</code> (над вершиной -OB).</li>
                  <li><strong>Тейк 1 (TP1):</strong> фиксация 50-70% и перевод стопа в Безубыток.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* 5. ГРАФИЧЕСКИЕ СХЕМЫ СЕТАПОВ */}
          <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
            <h4 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              5. Наглядные Схемы Взаимодействия с Блоками Ликвидности
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700/40 space-y-2">
                <span className="font-bold text-emerald-400 text-xs uppercase block">Схема LONG (OTE + OB)</span>
                <img src={longSetupImg} alt="LONG Setup" className="w-full h-auto rounded-lg border border-gray-700" />
                <p className="text-[11px] text-gray-400">Вход на откате в зону спроса со стопом под локальный минимум.</p>
              </div>
              <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700/40 space-y-2">
                <span className="font-bold text-rose-400 text-xs uppercase block">Схема SHORT (Премиум Зона)</span>
                <img src={shortSetupImg} alt="SHORT Setup" className="w-full h-auto rounded-lg border border-gray-700" />
                <p className="text-[11px] text-gray-400">Вход от зоны предложения с защитным стопом за вершиной импульса.</p>
              </div>
              <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700/40 space-y-2">
                <span className="font-bold text-purple-400 text-xs uppercase block">Order Block & FVG DXY/OIL</span>
                <img src={obFvgImg} alt="OB and FVG" className="w-full h-auto rounded-lg border border-gray-700" />
                <p className="text-[11px] text-gray-400">Тест дисбаланса цены крупным институциональным игроком.</p>
              </div>
            </div>
          </section>

          {/* 6. УПРАВЛЕНИЕ РИСКАМИ И ТАЙМФРЕЙМЫ */}
          <section className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 space-y-4">
            <h4 className="text-base font-bold text-blue-400 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              6. Выбор Таймфрейма & Мани-Менеджмент
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
                <span className="font-bold text-white block">1м – 5м (Скальпинг)</span>
                <p className="text-gray-400 text-[11px]">Сделки внутри 15–60 минут. Быстрый забор TP1, жесткий контроль спреда.</p>
              </div>
              <div className="p-3.5 bg-gray-800/50 rounded-xl border border-blue-500/30 space-y-1">
                <span className="font-bold text-blue-400 block">15м (Оптимальный для Золота & BTC)</span>
                <p className="text-gray-400 text-[11px]">Идеальный баланс между частотой сигналов и надежностью отработки (1–4 часа).</p>
              </div>
              <div className="p-3.5 bg-gray-800/50 rounded-xl border border-gray-700/50 space-y-1">
                <span className="font-bold text-purple-400 block">30м – 1H (Интрадей-Свинг)</span>
                <p className="text-gray-400 text-[11px]">Глобальные трендовые движения дня и удержание до крупных пулов ликвидности.</p>
              </div>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};

function GhostIcon(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
  );
}
