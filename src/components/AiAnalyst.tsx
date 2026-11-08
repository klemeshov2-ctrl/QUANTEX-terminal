import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  BrainCircuit,
  RefreshCw,
  AlertCircle,
  Send,
  User,
  Bot,
  Terminal,
  Zap,
  TrendingUp,
  TrendingDown,
  Trash2
} from "lucide-react";
import { Candlestick, IndicatorSettings } from "../types";
import { computeAllIndicators } from "../lib/chartGenerator";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [activeProviderName, setActiveProviderName] = useState<string>("Gemini Active");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const gexRegime = isPosGamma
    ? "+GAMMA (Long Gamma дилеров — гашение волатильности)"
    : "-GAMMA (Short Gamma дилеров — разгон импульса)";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Request analysis or send a user chat message to the quant colleague backend
  const sendMessage = async (userPrompt?: string) => {
    const textToSend = (userPrompt ?? inputValue).trim();
    if (!textToSend && messages.length > 0) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage | null = textToSend
      ? {
          id: userMsgId,
          role: "user",
          text: textToSend,
          timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        }
      : null;

    const updatedMessages = userMsg ? [...messages, userMsg] : [...messages];
    if (userMsg) {
      setMessages(updatedMessages);
      setInputValue("");
    }

    setLoading(true);
    setError(null);

    try {
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
          cvdTrend: cvd > maVal ? "CVD ВЫШЕ сигнальной MA (Лонг-давление)" : "CVD НИЖЕ сигнальной MA (Шорт-давление)",
          marketStructure: activeBOS.length > 0 ? activeBOS[activeBOS.length - 1].label : "Структура стабильная, без свежих сломов",
          fvgStatus: activeFVG.length > 0 ? `${activeFVG.length} неперекрытых областей FVG` : "Дисбалансов FVG вблизи цены нет",
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
        candlesticks: candlesticks.slice(-12),
        query: textToSend || "default",
        messages: updatedMessages.map(m => ({ role: m.role, text: m.text }))
      };

      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Сервер анализа временно недоступен.");
      }

      const data = await response.json();
      setIsSimulated(!!data.isSimulated);
      if (data.provider) {
        setActiveProviderName(data.provider);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        text: data.analysis || "Структура рынка оценивается...",
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Не удалось получить ответ от аналитика.");
    } finally {
      setLoading(false);
    }
  };

  // Run initial colleague greeting & overview when asset or timeframe changes
  useEffect(() => {
    if (candlesticks.length > 20) {
      setMessages([]);
      sendMessage("");
    }
  }, [asset, timeframe]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && inputValue.trim()) {
        sendMessage();
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
    sendMessage("");
  };

  return (
    <div className="bg-[#0a0d16] border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-2xl h-full flex flex-col min-h-[580px]" id="ai-analyst">
      {/* Title & Status Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 p-2.5 rounded-xl border border-blue-500/30">
            <BrainCircuit className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              QUANTEX Квант-Аналитик
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${
                isSimulated
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {activeProviderName}
              </span>
            </h3>
            <p className="text-xs text-gray-400">Онлайн-диалог с опытным институциональным коллегой-квантом</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            title="Очистить диалог и запросить свежий срез"
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl text-xs font-medium border border-gray-800 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            <span className="hidden sm:inline">Срез</span>
          </button>
        </div>
      </div>

      {/* Live GEX & Macro Telemetry Bar */}
      <div className="bg-gradient-to-r from-gray-950 via-slate-900/60 to-gray-950 border border-gray-800/80 rounded-xl p-2.5 mb-3 text-xs">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-800/60">
          <span className="font-bold text-gray-200 flex items-center gap-1.5 text-[11px]">
            <span>🏛️</span>
            <span>Дилерский GEX-профиль CME & MOEX ({asset})</span>
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
            isPosGamma ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}>
            {isPosGamma ? "🟢 Long Gamma (сжатие)" : "🔴 Short Gamma (инверсия)"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
          <div className="bg-black/50 px-2 py-1 rounded border border-gray-800/80">
            <span className="text-gray-500 block text-[9px]">🏰 Call Wall:</span>
            <span className="text-emerald-400 font-bold">{gexCallWall.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
          </div>
          <div className="bg-black/50 px-2 py-1 rounded border border-gray-800/80">
            <span className="text-gray-500 block text-[9px]">🛡️ Put Wall:</span>
            <span className="text-rose-400 font-bold">{gexPutWall.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
          </div>
          <div className="bg-black/50 px-2 py-1 rounded border border-gray-800/80">
            <span className="text-gray-500 block text-[9px]">⚡ Zero Flip:</span>
            <span className="text-purple-300 font-bold">{gexZeroFlip.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
          </div>
          <div className="bg-black/50 px-2 py-1 rounded border border-gray-800/80">
            <span className="text-gray-500 block text-[9px]">🎯 Max Pain:</span>
            <span className="text-cyan-300 font-bold">{gexMaxPain.toFixed(asset === "EUR/USD" ? 4 : 2)}</span>
          </div>
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 text-gray-500 space-y-2">
            <Bot className="h-8 w-8 text-blue-400/60 animate-pulse" />
            <span className="text-xs">Начни диалог или нажми быстрый фокус ниже</span>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              {msg.role === "user" ? (
                <>
                  <span className="text-[10px] text-gray-500 font-mono">{msg.timestamp}</span>
                  <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                    Трейдер <User className="h-3 w-3" />
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                    <Bot className="h-3.5 w-3.5 text-purple-400" /> Квант-Коллега
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{msg.timestamp}</span>
                </>
              )}
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[92%] sm:max-w-[85%] ${
                msg.role === "user"
                  ? "bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-sm"
                  : "bg-gray-900/80 border border-gray-800 text-gray-200 rounded-tl-sm shadow-md"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <div className="prose prose-invert prose-xs text-gray-200 leading-relaxed max-w-none space-y-2">
                  <ReactMarkdown
                    components={{
                      h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-white mt-2.5 mb-1 text-purple-300" {...props} />,
                      h4: ({ node, ...props }) => <h4 className="text-xs font-semibold text-gray-200 mt-1.5 mb-1" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0" {...props} />,
                      li: ({ node, ...props }) => <li className="list-disc pl-1 ml-4 my-0.5" {...props} />,
                      ul: ({ node, ...props }) => <ul className="space-y-1 my-1.5" {...props} />,
                      strong: ({ node, ...props }) => <strong className="text-amber-300 font-semibold" {...props} />,
                      code: ({ node, ...props }) => (
                        <code className="bg-black/60 px-1.5 py-0.5 rounded text-white font-mono text-[10px] border border-gray-800" {...props} />
                      )
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2 pt-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-purple-400 animate-spin" />
            </div>
            <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-75"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse delay-150"></span>
              <span className="text-[11px] font-mono text-gray-400 ml-1">Коллега анализирует дельту, структуру и опционы...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts / Focus Chips */}
      <div className="pt-2 border-t border-gray-800/70 mt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 text-[10px] scrollbar-none">
          <button
            onClick={() => sendMessage("Где сейчас лучшие точки входа (Entry) с опорой на Order Block и OTE?")}
            disabled={loading}
            className="shrink-0 px-2.5 py-1 bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-blue-500/40 text-gray-400 hover:text-white rounded-lg transition-all"
          >
            🎯 Точки входа (OB)
          </button>
          <button
            onClick={() => sendMessage("Оцени режим гаммы: как дилеры хеджируют текущее движение?")}
            disabled={loading}
            className="shrink-0 px-2.5 py-1 bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/30 hover:border-purple-400 text-purple-300 hover:text-white rounded-lg transition-all font-medium"
          >
            ⚡ Инверсия хеджирования GEX
          </button>
          <button
            onClick={() => sendMessage("Есть ли дивергенция между ценой и кумулятивной дельтой CVD?")}
            disabled={loading}
            className="shrink-0 px-2.5 py-1 bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-emerald-500/40 text-gray-400 hover:text-white rounded-lg transition-all"
          >
            📉 Дивергенция CVD
          </button>
          <button
            onClick={() => sendMessage("Что говорит волновая структура и закрепление над Zero-Flip?")}
            disabled={loading}
            className="shrink-0 px-2.5 py-1 bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-blue-500/40 text-gray-400 hover:text-white rounded-lg transition-all"
          >
            🌊 Волны & Flip
          </button>
          <button
            onClick={() => sendMessage("Сформируй конкретный торговый сетап с риск/прибылью не менее 1:2.0.")}
            disabled={loading}
            className="shrink-0 px-2.5 py-1 bg-amber-950/20 hover:bg-amber-900/30 border border-amber-500/30 hover:border-amber-400 text-amber-300 hover:text-white rounded-lg transition-all font-medium"
          >
            📊 Сетап с R:R ≥ 2.0
          </button>
        </div>

        {/* Chat Input Box */}
        <div className="flex items-end gap-2 mt-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спроси коллегу (например: 'Оцени риск шорта от 2740 с учетом GEX')..."
            rows={2}
            disabled={loading}
            className="flex-1 bg-black/60 border border-gray-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 resize-none outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !inputValue.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-lg shadow-blue-500/10 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Отправить</span>
          </button>
        </div>
      </div>
    </div>
  );
}
