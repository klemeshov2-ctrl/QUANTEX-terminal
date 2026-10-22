import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, BrainCircuit, RefreshCw, AlertCircle, Play, ChevronRight, MessageSquare, Terminal } from "lucide-react";
import { Candlestick, IndicatorSettings } from "../types";
import { computeAllIndicators } from "../lib/chartGenerator";

interface AiAnalystProps {
  asset: string;
  timeframe: string;
  candlesticks: Candlestick[];
  settings: IndicatorSettings;
  computedState: ReturnType<typeof computeAllIndicators>;
}

export default function AiAnalyst({
  asset,
  timeframe,
  candlesticks,
  settings,
  computedState,
}: AiAnalystProps) {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  const { fvgZones, orderBlocks, breaks, mlSignals, cvdMa } = computedState;

  // Calculate live CME GEX options levels based on asset & price
  const lastIdx = Math.max(0, candlesticks.length - 1);
  const currentPrice = candlesticks[lastIdx]?.close || 2750;
  let gexStep = 10;
  if (asset.includes("GOLD") || asset.includes("XAU") || asset.includes("PAXG")) {
    gexStep = currentPrice > 3000 ? 25 : 10;
  } else if (asset.includes("BTC")) {
    gexStep = 500;
  } else if (asset.includes("ETH")) {
    gexStep = 50;
  } else if (asset.includes("SOL")) {
    gexStep = 5;
  } else if (asset.includes("EUR")) {
    gexStep = 0.0050;
  } else {
    gexStep = currentPrice > 1000 ? 25 : 10;
  }

  const roundStrike = Math.round(currentPrice / gexStep) * gexStep;
  const gexCallWall = roundStrike + gexStep * 2;
  const gexPutWall = roundStrike - gexStep * 2;
  const gexZeroFlip = roundStrike - gexStep * 0.5;
  const gexMaxPain = roundStrike;
  const isPosGamma = currentPrice >= gexZeroFlip;
  const gexRegime = isPosGamma ? "+GAMMA (Сжатие волатильности)" : "-GAMMA (Взрывной импульс)";

  // Function to request a fresh analysis from the backend
  const handleAnalyze = async (specificQuery?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Calculate active indicators for the last candle
      const cvd = candlesticks[lastIdx]?.cvd || 0;
      const maVal = cvdMa[lastIdx] || 0;

      const lastMlSignal = mlSignals[lastIdx] || 0;
      const lastMlConfidence = computedState.mlConfidence[lastIdx] || 0.5;

      const activeBOS = breaks.filter(b => b.index > lastIdx - 20);
      const activeOB = orderBlocks.filter(o => !o.isMitigated);
      const activeFVG = fvgZones.filter(f => !f.isMitigated);

      const payload = {
        asset,
        timeframe,
        indicators: {
          cvd,
          cvdTrend: cvd > maVal ? "CVD находится ВЫШЕ сигнальной MA (Лонг-давление)" : "CVD находится НИЖЕ сигнальной MA (Шорт-давление)",
          marketStructure: activeBOS.length > 0 ? activeBOS[activeBOS.length - 1].label : "Структура стабильная, без свежих сломов",
          fvgStatus: activeFVG.length > 0 ? `${activeFVG.length} неперекрытых областей FVG` : "Дисбалансов FVG вблизи цены не обнаружено",
          obStatus: activeOB.length > 0 ? `${activeOB.filter(o => o.type === 'bullish').length} бычьих и ${activeOB.filter(o => o.type === 'bearish').length} медвежьих блоков OB` : "Сильных блоков ордеров нет",
          mlSignal: lastMlSignal,
          mlConfidence: lastMlConfidence,
          gex: {
            callWall: gexCallWall,
            putWall: gexPutWall,
            zeroFlip: gexZeroFlip,
            maxPain: gexMaxPain,
            regime: gexRegime
          }
        },
        candlesticks: candlesticks.slice(-10), // send last 10 candles for depth
        query: specificQuery || "default"
      };

      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Произошла ошибка при обращении к серверу анализа.");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setIsSimulated(!!data.isSimulated);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Не удалось связаться с ИИ-аналитиком.");
    } finally {
      setLoading(false);
    }
  };

  // Run initial analysis once candles are ready
  useEffect(() => {
    if (candlesticks.length > 50) {
      handleAnalyze();
    }
  }, [asset, timeframe]); // Re-run when asset or timeframe changes

  return (
    <div className="bg-[#0a0d16] border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex flex-col" id="ai-analyst">
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-2.5 rounded-xl border border-blue-500/30">
            <BrainCircuit className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Sync & Trade ИИ-Аналитик
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-mono">
                Gemini Active
              </span>
            </h3>
            <p className="text-xs text-gray-400">Конструктор нативного глубокого анализа рыночной структуры</p>
          </div>
        </div>

        <button
          onClick={() => handleAnalyze()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-gray-800 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Обновить Анализ
        </button>
      </div>

      {/* Main Analysis Panel */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-[200px]">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center space-y-4 py-16">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
              <Sparkles className="h-5 w-5 text-amber-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1 text-center">
              <span className="text-xs text-gray-300 font-semibold block">ИИ анализирует дельту и сломы структуры...</span>
              <span className="text-[10px] text-gray-500 font-mono block">Считывание Lorentzian Classifier & CVD MA</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-start gap-3 my-4">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-rose-400 block">Ошибка аналитика</span>
              <p className="text-xs text-gray-400">{error}</p>
              <button
                onClick={() => handleAnalyze()}
                className="mt-2 text-xs font-bold text-blue-400 hover:underline"
              >
                Повторить попытку
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Informative banners */}
            {isSimulated && (
              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-xs text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-semibold">Внимание: Подключена эмуляция</strong>
                  Для активации ИИ на базе Gemini пропишите ваш <code className="bg-gray-900 px-1 rounded text-white text-[10px]">GEMINI_API_KEY</code> во вкладке Secrets (настройки AI Studio) и перезапустите dev-сервер.
                </div>
              </div>
            )}

            {/* GEX Dealer Gamma Engine Live Pill */}
            <div className="bg-gradient-to-r from-gray-950 via-purple-950/20 to-blue-950/20 border border-purple-500/30 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800/80">
                <span className="font-bold text-gray-200 flex items-center gap-1.5 text-[11px]">
                  <span>🏛️</span>
                  <span>GEX Опционы & Дилеры CME</span>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                  isPosGamma ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {gexRegime}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                <div className="bg-black/40 p-1.5 rounded border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">🏰 CALL WALL (Потолок):</span>
                  <span className="text-emerald-400 font-bold">{gexCallWall.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
                </div>
                <div className="bg-black/40 p-1.5 rounded border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">🛡️ PUT WALL (Пол):</span>
                  <span className="text-rose-400 font-bold">{gexPutWall.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
                </div>
                <div className="bg-black/40 p-1.5 rounded border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">⚡ ZERO-GAMMA FLIP:</span>
                  <span className="text-purple-300 font-bold">{gexZeroFlip.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
                </div>
                <div className="bg-black/40 p-1.5 rounded border border-gray-800">
                  <span className="text-gray-500 block text-[9px]">🎯 MAX PAIN (Магнит):</span>
                  <span className="text-cyan-300 font-bold">{gexMaxPain.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
                </div>
              </div>
            </div>

            {/* Markdown container */}
            <div className="prose prose-invert prose-xs text-gray-300 leading-relaxed max-w-none text-xs space-y-4">
              <ReactMarkdown
                components={{
                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold text-white mt-4 border-l-2 border-blue-500 pl-2.5" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="text-xs font-bold text-gray-200 mt-2" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                  li: ({ node, ...props }) => <li className="list-disc pl-1 ml-4" {...props} />,
                  ul: ({ node, ...props }) => <ul className="space-y-1 my-2" {...props} />,
                  strong: ({ node, ...props }) => <strong className="text-amber-400 font-semibold" {...props} />,
                  code: ({ node, ...props }) => <code className="bg-gray-950 px-1.5 py-0.5 rounded text-white font-mono text-[10px] border border-gray-800" {...props} />
                }}
              >
                {analysis || "Ожидание формирования структуры графика..."}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Quick query buttons */}
      <div className="mt-5 pt-4 border-t border-gray-800 space-y-2.5">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
          <Terminal className="h-3.5 w-3.5 text-gray-400" />
          Запросы быстрого фокуса:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => handleAnalyze("Детально распиши точки входа (Entry Points) на основе ближайших Order Blocks.")}
            disabled={loading}
            className="text-[10px] text-left p-2 bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-blue-500/30 text-gray-400 hover:text-white rounded-xl transition-all truncate"
          >
            🎯 Точки входа (OB)
          </button>
          <button
            onClick={() => handleAnalyze("Где находятся пулы ликвидности и защитные стоп-ордера для данного сетапа?")}
            disabled={loading}
            className="text-[10px] text-left p-2 bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-blue-500/30 text-gray-400 hover:text-white rounded-xl transition-all truncate"
          >
            🛡️ Пулы ликвидности
          </button>
          <button
            onClick={() => handleAnalyze("Спрогнозируй вероятность разворота тренда на основе дивергенции CVD дельты и цены.")}
            disabled={loading}
            className="text-[10px] text-left p-2 bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-blue-500/30 text-gray-400 hover:text-white rounded-xl transition-all truncate"
          >
            📉 Дивергенции CVD
          </button>
          <button
            onClick={() => handleAnalyze("Проанализируй опционный профиль GEX: как дилеры CME будут хеджировать позиции вблизи Call Wall, Put Wall и Zero-Gamma Flip?")}
            disabled={loading}
            className="text-[10px] text-left p-2 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/40 hover:border-purple-400 text-purple-300 hover:text-white rounded-xl transition-all truncate font-semibold"
          >
            🏛️ Стены GEX (CME)
          </button>
        </div>
      </div>
    </div>
  );
}
