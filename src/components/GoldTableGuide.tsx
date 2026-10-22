import React, { useState } from "react";
import {
  Coins,
  TrendingUp,
  Target,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  Copy,
  Check,
  Loader2,
  Sparkles,
  ArrowRight,
  Activity,
  Layers,
  Zap,
  BookOpen,
  Sliders,
  Info,
  HelpCircle,
  Eye,
  RefreshCw
} from "lucide-react";
import { HUD_SCENARIOS, HUD_ENCYCLOPEDIA, HudScenarioData } from "./goldGuideData";

interface GoldTableGuideProps {
  onDirectPdfDownload?: () => void;
  isPdfLoading?: boolean;
}

export const GoldTableGuide: React.FC<GoldTableGuideProps> = ({
  onDirectPdfDownload,
  isPdfLoading = false
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingInternalPdf, setDownloadingInternalPdf] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<
    "screenshot" | "ideal_long" | "ideal_short" | "dangerous_flat" | "plan_b_active"
  >("screenshot");
  const [activeParamTab, setActiveParamTab] = useState<number | "all">("all");

  const handleDownloadDedicatedPdf = async () => {
    if (onDirectPdfDownload) {
      onDirectPdfDownload();
      return;
    }

    setDownloadingInternalPdf(true);
    try {
      const downloadUrl = "/api/download-manual-pdf?type=gold";
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const rawBlob = await res.blob();
      const blob = new Blob([rawBlob], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "XAUUSD_Gold_Indicator_Table_Guide.pdf";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      console.warn("Direct PDF download fallback to window link:", e);
      // Fallback: direct browser navigation to download URL
      window.open("/api/download-manual-pdf?type=gold", "_blank");
    } finally {
      setDownloadingInternalPdf(false);
    }
  };

  const handleCopyText = () => {
    const element = document.getElementById("gold-table-manual-doc");
    if (!element) return;
    navigator.clipboard.writeText(element.innerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBusy = isPdfLoading || downloadingInternalPdf;

  return (
    <div
      className="bg-[#0b0e17] text-gray-200 p-6 md:p-8 rounded-2xl border border-amber-500/30 shadow-2xl space-y-8 print:bg-white print:text-black print:p-2 print:border-none print:shadow-none"
      id="gold-table-manual-doc"
    >
      {/* 🏆 Хедер: Золото XAUUSD + Кнопки Экспорта */}
      <section className="bg-gradient-to-br from-amber-950/50 via-[#151926] to-yellow-950/40 p-6 rounded-2xl border border-amber-500/40 shadow-xl space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-amber-500/20 pb-4 gap-4 print:border-gray-400">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-amber-500 to-yellow-500 rounded-xl text-gray-950 shadow-lg shadow-amber-500/25 font-bold shrink-0">
              <Coins className="h-7 w-7 text-gray-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 print:text-black">
                  Инструкция по Информационной Таблице HUD
                </h3>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Золото / XAUUSD 1Ч (OANDA)
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-300 mt-1 print:text-gray-700">
                Полное руководство по чтению таблицы HUD индикатора на реальном примере с графика TradingView
              </p>
            </div>
          </div>

          {/* 📥 Кнопки экспорта (PDF, Печать, Текст) */}
          <div className="flex items-center gap-2 flex-wrap no-print shrink-0">
            <button
              onClick={handleDownloadDedicatedPdf}
              disabled={isBusy}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-gray-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-amber-300/40"
              title="Скачать PDF файл инструкции по таблице золота"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Генерация PDF...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Скачать PDF (XAUUSD)
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 bg-gray-800 hover:bg-gray-750 text-gray-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-gray-700 active:scale-95 transition-all cursor-pointer"
              title="Распечатать или сохранить в PDF через браузер"
            >
              <Printer className="h-4 w-4 text-blue-400" />
              Печать
            </button>

            <button
              onClick={handleCopyText}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                copied
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-gray-800 hover:bg-gray-750 text-gray-300 border-gray-700"
              }`}
              title="Скопировать текстовую версию"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-200" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-gray-400" />
                  Копия
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-xs md:text-sm text-gray-300 leading-relaxed print:text-black">
          Информационная панель <strong>HUD Dashboard</strong> — это автономный аналитический центр на графике TradingView. 
          Она в режиме реального времени агрегирует макроэкономический фон (индекс доллара DXY), моментум (RSI 6/14), волатильность (ATR/ADR), 
          структуру Smart Money (+OB / +FVG) и <strong>мультитаймфреймовый синтез 5 таймфреймов (15м, 1Ч, 4Ч, 1Д, 1W)</strong> в единый готовый план действий.
        </p>
      </section>

      {/* 📊 Интерактивный HUD: Симулятор Всех Возможных Состояний Таблицы */}
      <section className="bg-[#121625] p-5 md:p-6 rounded-2xl border border-amber-500/30 space-y-4 print:border-gray-400 print:bg-gray-50">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 flex-wrap gap-2 print:border-gray-400">
          <h4 className="text-sm md:text-base font-bold text-amber-400 flex items-center gap-2 print:text-black">
            <Coins className="h-4 w-4" />
            Интерактивный HUD Индикатор: Симуляция Разных Состояний Рынка
          </h4>
          <span className="text-[10px] font-mono bg-blue-500/10 text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-500/20 flex items-center gap-1.5">
            <Eye className="h-3 w-3" />
            Переключайте сценарии ниже
          </span>
        </div>

        {/* Переключатель рыночных сценариев */}
        <div className="space-y-2">
          <span className="text-xs text-gray-400 font-semibold block">
            Выберите рыночный сценарий для отображения в HUD таблице:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {Object.values(HUD_SCENARIOS).map((sc) => {
              const isActive = selectedScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id as any)}
                  className={`p-2.5 text-left rounded-xl border text-xs transition-all duration-200 flex flex-col justify-between gap-1.5 ${
                    isActive
                      ? "bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10 text-white font-medium"
                      : "bg-[#0d1322] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-[11px] truncate">{sc.title.split(". ")[1]}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${sc.badgeColor}`}>
                      {sc.badge}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">
                    Цена: <strong className="text-white">{sc.price}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Описание выбранного сценария */}
        {(() => {
          const currentSc = HUD_SCENARIOS[selectedScenario];
          return (
            <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-blue-900/40 text-xs flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{currentSc.title}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${currentSc.badgeColor}`}>
                    {currentSc.badge}
                  </span>
                </div>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  {currentSc.description}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Динамическая карточка HUD TradingView ровно по скриншоту с выбранным сценарием */}
        {(() => {
          const sc = HUD_SCENARIOS[selectedScenario];
          return (
            <div className="overflow-x-auto">
              <div className="min-w-[650px] bg-[#0d1322] rounded-xl border border-blue-900/50 shadow-2xl font-mono text-xs overflow-hidden print:border-black print:bg-white">
                {/* Header row */}
                <div className="bg-[#18233c] text-cyan-400 px-4 py-2.5 font-bold flex items-center justify-between border-b border-blue-800/60 print:bg-gray-200 print:text-black">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    ★ S&T SUPER INDICATOR
                  </span>
                  <span className="text-gray-200 print:text-black font-semibold">
                    Золото / Доллар США • 1ч • OANDA | XAUUSD (60)
                  </span>
                </div>

                {/* 10 строк таблицы HUD */}
                <div className="divide-y divide-blue-900/40 print:divide-gray-300 text-[11px] md:text-xs">
                  {/* Row 1: Тренд & Макро DXY */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Тренд & Макро DXY
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row1.color}`}>
                      {sc.row1.text}
                    </span>
                  </div>

                  {/* Row 2: RSI (6 & 14) */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      RSI (6 & 14)
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row2.color}`}>
                      {sc.row2.text}
                    </span>
                  </div>

                  {/* Row 3: ATR & Запас Хода */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      ATR & Запас Хода
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row3.color}`}>
                      {sc.row3.text}
                    </span>
                  </div>

                  {/* Row 4: Зона Входа & R:R */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Зона Входа & R:R
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row4.color}`}>
                      {sc.row4.text}
                    </span>
                  </div>

                  {/* Row 5: Защитный SL / Трейлинг */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Защитный SL / Трейлинг
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row5.color}`}>
                      {sc.row5.text}
                    </span>
                  </div>

                  {/* Row 6: Торговый Сетап */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Торговый Сетап
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row6.color}`}>
                      {sc.row6.text}
                    </span>
                  </div>

                  {/* Row 7: Консенсус 5 ТФ */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Консенсус 5 ТФ
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row7.color}`}>
                      {sc.row7.text}
                    </span>
                  </div>

                  {/* Row 8: Синтез ТФ (MTF) */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Синтез ТФ (MTF)
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row8.color} leading-tight`}>
                      {sc.row8.text}
                    </span>
                  </div>

                  {/* Row 9: Альтернатива (План Б) */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Альтернатива (План Б)
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row9.color}`}>
                      {sc.row9.text}
                    </span>
                  </div>

                  {/* Row 10: Активный Пресет */}
                  <div className="grid grid-cols-12 px-3.5 py-2.5 hover:bg-blue-950/30 transition-colors items-center">
                    <span className="col-span-4 text-gray-300 font-sans print:text-gray-800 font-bold">
                      Активный Пресет
                    </span>
                    <span className={`col-span-8 font-medium ${sc.row10.color}`}>
                      {sc.row10.text}
                    </span>
                  </div>
                </div>

                {/* Подвал таблицы */}
                <div className="bg-[#141b2d] px-4 py-2 text-[10px] text-gray-400 border-t border-blue-900/50 flex items-center justify-between print:bg-gray-100 print:text-black">
                  <span>⚙️ Универсальный (Все таймфреймы / Авто-Адаптивный)</span>
                  <span>💻 Стандартный (ПК / Полный HUD)</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Индикаторные метки для текущего сценария */}
        {(() => {
          const sc = HUD_SCENARIOS[selectedScenario];
          return (
            <div className="bg-gray-900/60 p-3.5 rounded-xl border border-gray-800 text-xs text-gray-300 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-mono flex-wrap">
                {sc.markers.structures.map((st, i) => (
                  <span key={i} className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                    {st}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
                <span>ВХОД: <strong className="text-emerald-400">{sc.markers.entry}</strong></span>
                <span>SL: <strong className="text-rose-400">{sc.markers.sl}</strong></span>
                <span>TP1: <strong className="text-emerald-400">{sc.markers.tp1}</strong></span>
                <span>СТАРШАЯ ЦЕЛЬ: <strong className="text-amber-400">{sc.markers.tpSenior}</strong></span>
              </div>
            </div>
          );
        })()}
      </section>

      {/* 📚 Полная Энциклопедия Таблицы HUD: Все 10 Строк и Все Возможные Варианты */}
      <section className="space-y-6">
        <div className="border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 print:border-gray-400">
          <div>
            <h4 className="text-base md:text-lg font-bold text-white flex items-center gap-2 print:text-black">
              <BookOpen className="h-5 w-5 text-amber-400" />
              Полная Энциклопедия Таблицы: Разбор Всех 10 Строк и Возможных Вариантов
            </h4>
            <p className="text-xs text-gray-400 mt-1 print:text-gray-700">
              Каталог значений, расшифровка рыночной логики и правила действий трейдера для каждого параметра.
            </p>
          </div>
          
          {/* Быстрые фильтры по строкам */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setActiveParamTab("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeParamTab === "all"
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              Все 10 строк
            </button>
            {HUD_ENCYCLOPEDIA.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveParamTab(item.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-colors ${
                  activeParamTab === item.id
                    ? "bg-amber-500 text-black font-bold"
                    : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
                }`}
                title={item.name}
              >
                #{item.id}
              </button>
            ))}
          </div>
        </div>

        {/* Список разобранных строк */}
        <div className="space-y-6">
          {HUD_ENCYCLOPEDIA.filter(
            (item) => activeParamTab === "all" || activeParamTab === item.id
          ).map((item) => (
            <div
              key={item.id}
              id={`hud-param-${item.id}`}
              className="bg-[#121625] p-5 md:p-6 rounded-2xl border border-gray-800 space-y-4 print:bg-white print:border-gray-300 shadow-xl"
            >
              {/* Шапка строки */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800/80 pb-3 gap-2 print:border-gray-300">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    Строка {item.id}
                  </span>
                  <h5 className="text-base font-bold text-white print:text-black">
                    {item.name}
                  </h5>
                </div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20 self-start sm:self-auto">
                  {item.category}
                </span>
              </div>

              {/* Описание сути и механики */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-gray-800/70 space-y-1 print:bg-gray-100 print:border-gray-300">
                  <strong className="text-amber-400 block font-sans">Что рассчитывает и показывает алгоритм:</strong>
                  <p className="text-gray-300 print:text-black leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-gray-800/70 space-y-1 print:bg-gray-100 print:border-gray-300">
                  <strong className="text-cyan-400 block font-sans">Зачем это нужно трейдеру (Практическая ценность):</strong>
                  <p className="text-gray-300 print:text-black leading-relaxed">
                    {item.whyItMatters}
                  </p>
                </div>
              </div>

              {/* Сетка всех возможных вариантов значений в этой строке */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5 print:text-black">
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                  Все возможные варианты и значения в таблице HUD:
                </span>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  {item.variants.map((v, vIdx) => (
                    <div
                      key={vIdx}
                      className="bg-[#0e1320] p-3.5 rounded-xl border border-gray-800/90 space-y-2 hover:border-gray-700 transition-colors print:bg-gray-50 print:border-gray-300"
                    >
                      {/* Значение в HUD */}
                      <div className="flex items-start justify-between gap-2">
                        <div className={`font-mono text-[11px] p-2 rounded-lg border w-full font-semibold ${v.color}`}>
                          {v.text}
                        </div>
                      </div>

                      {/* Бейдж состояния */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                          {v.badge}
                        </span>
                      </div>

                      {/* Трактовка рынка */}
                      <p className="text-gray-300 print:text-gray-800 text-[11px] leading-relaxed">
                        <strong className="text-gray-400 print:text-black">Рыночный смысл:</strong> {v.meaning}
                      </p>

                      {/* Действие трейдера */}
                      <div className="bg-gray-950/60 p-2 rounded border border-gray-800/60 text-[11px] text-cyan-300 print:bg-white print:text-black">
                        <strong>Действие:</strong> {v.action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Институциональный совет (ProTip) */}
              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-300 print:bg-gray-100 print:border-gray-400 print:text-black">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold text-amber-400">Секрет профессионала по Строке {item.id}:</strong>
                  <p className="text-gray-300 print:text-gray-700 leading-relaxed text-[11px]">
                    {item.proTip}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🚀 Практический Сценарий: Торговля по Скриншоту от А до Я */}
      <section className="bg-gradient-to-br from-amber-950/30 via-gray-900 to-yellow-950/20 p-6 rounded-2xl border border-amber-500/30 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h4 className="text-base font-bold text-amber-400 flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <Target className="h-5 w-5" />
          Пошаговый Торговый План Сделки (Строго по Данным со Скриншота)
        </h4>

        <div className="space-y-3 text-xs leading-relaxed text-gray-300 print:text-black">
          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded shrink-0">
              Шаг 1
            </span>
            <div>
              <strong className="text-white print:text-black">Анализ общей картины и запрет на вход по рынку:</strong>
              <p className="text-gray-400 print:text-gray-700 mt-0.5">
                Текущая цена: <strong>4 378.385</strong>. Строка 4 сигнализирует «⚪ Вне зон», а строка 6: «⏳ ОЖИДАНИЕ ВХОДА (Откат к 4368.56)». 
                Несмотря на мощный бычий консенсус 5/5 ТФ, <strong>входить по рынку прямо сейчас нельзя</strong> — высок риск нарваться на коррекцию.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded shrink-0">
              Шаг 2
            </span>
            <div>
              <strong className="text-white print:text-black">Выставление лимитного ордера (Limit Buy):</strong>
              <p className="text-gray-400 print:text-gray-700 mt-0.5">
                Выставляем отложенный ордер <strong>Buy Limit по цене 4368.56</strong> (на уровне теста бычьего FVG и ордерблока +OB).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded shrink-0">
              Шаг 3
            </span>
            <div>
              <strong className="text-white print:text-black">Установка защитного Stop-Loss:</strong>
              <p className="text-gray-400 print:text-gray-700 mt-0.5">
                Согласно строке 5, защитный стоп-лосс выставляется на отметку <strong>4353.39</strong>. 
                Дистанция риска составляет 15.17 $ (около 150 пипсов). Размер торгового лота рассчитывается строго исходя из риска 1% от депозита.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#121625] p-3.5 rounded-xl border border-gray-800 print:bg-gray-100 print:border-gray-300">
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded shrink-0">
              Шаг 4
            </span>
            <div>
              <strong className="text-white print:text-black">Фиксация прибыли (Take Profit 1 и Старшая цель 4Ч):</strong>
              <p className="text-gray-400 print:text-gray-700 mt-0.5">
                • <strong>TP1 = 4398.23</strong>: При достижении этого уровня закрываем 50% объема позиции (+29.67 $ профита на унцию, соотношение R:R практически 1:2). 
                Стоп-лосс по оставшейся позиции немедленно переносится в безубыток на цену входа <strong>4368.56</strong>.<br />
                • <strong>Старшая цель 4Ч = 4437.44</strong>: Оставшиеся 50% позиции сопровождаются трейлинг-стопом вплоть до достижения макро-цели 4437.44 (+68.88 $ профита).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 📋 Экспресс-Чеклист Трейдера */}
      <section className="bg-[#121625] p-6 rounded-2xl border border-gray-800 space-y-4 print:border-gray-400 print:bg-white print:p-4">
        <h4 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3 print:text-black print:border-gray-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          Чек-Лист Принятия Решений по Таблице HUD
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-900/80 text-gray-300 print:bg-gray-200 print:text-black">
                <th className="p-2.5 font-bold">Параметр</th>
                <th className="p-2.5 font-bold text-emerald-400 print:text-emerald-800">Показание на скриншоте</th>
                <th className="p-2.5 font-bold">Оценка Трейдера</th>
                <th className="p-2.5 font-bold text-cyan-450">Необходимое Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300 print:divide-gray-300 print:text-black">
              <tr>
                <td className="p-2.5 font-semibold text-white print:text-black">Консенсус 5 ТФ</td>
                <td className="p-2.5 text-emerald-400 font-mono">5/5 ТФ LONG (100%)</td>
                <td className="p-2.5 text-emerald-400 font-bold">Высший бычий приоритет</td>
                <td className="p-2.5">Исключить шорты, только покупки</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-white print:text-black">Макро DXY</td>
                <td className="p-2.5 font-mono">DXY +0.01% (4Ч Up🟢)</td>
                <td className="p-2.5 text-emerald-400">Благоприятно (флэт бакса)</td>
                <td className="p-2.5">Подтверждение восходящего тренда</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-white print:text-black">Зона Входа</td>
                <td className="p-2.5 font-mono text-amber-300">⚪ Вне зон (рынок 4378.38)</td>
                <td className="p-2.5 text-amber-400">Вход по рынку запрещен</td>
                <td className="p-2.5 text-amber-300 font-bold">Ждать отката к 4368.56</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-white print:text-black">RSI 6 & 14</td>
                <td className="p-2.5 font-mono text-indigo-300">53.7 / 55.3 (Бычий баланс)</td>
                <td className="p-2.5 text-emerald-400">Здоровый импульс</td>
                <td className="p-2.5">Запас хода вверх не исчерпан</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-white print:text-black">Защитный SL</td>
                <td className="p-2.5 font-mono text-rose-400">4353.39</td>
                <td className="p-2.5">Четкая граница риска</td>
                <td className="p-2.5">Выставить SL сразу при входе</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ⚠️ Важное Предупреждение */}
      <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-300 print:border-gray-400 print:bg-gray-100 print:text-black">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold">Главный вывод по таблице:</strong>
          <p className="text-gray-300 print:text-gray-800">
            Индикатор защищает от двух главных ошибок новичков на золоте: <strong>1) ловли ножей (шорта против абсолютного 5/5 тренда)</strong> и 
            <strong> 2) покупки на самом хае из-за страха упущенной выгоды (FOMO)</strong>. Ждите лимитный уровень <strong>4368.56</strong> и торгуйте строго по системе.
          </p>
        </div>
      </div>
    </div>
  );
};
