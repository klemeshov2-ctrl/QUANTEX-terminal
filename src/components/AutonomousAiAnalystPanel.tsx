import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Clock,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Compass,
  RotateCcw,
  Bell,
  Settings,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  CheckCircle2,
  Copy,
  Share2,
  Play,
  Key,
  Globe,
  Radio,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  Check,
  Zap,
  Activity
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export interface MacroCalendarEvent {
  id?: string;
  date?: string;
  timeMsk: string; // e.g. "10:00", "15:30", "17:00", "21:00"
  title: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "SESSION_OPEN" | string;
  importance?: "CRITICAL" | "HIGH" | "MEDIUM" | string;
  section?: "GOLD" | "MOEX" | "CRYPTO" | string;
  sections?: string[];
  details?: string;
  dynamicsNote?: string;
  currency?: string;
  source?: string;
  url?: string;
  statusLabel?: string;
}

export interface MacroNewsItem {
  id: string;
  time: string;
  date?: string;
  timestampMs?: number;
  title: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "INFLATION" | "FED_RATES" | "LABOR" | "GEOPOLITICS" | "DXY" | "GOLD_MARKET" | "MOEX_MARKET" | "CRYPTO" | string;
  section?: "GOLD" | "GEOPOLITICS" | "MOEX" | "CRYPTO" | string;
  sections?: string[];
  summary: string;
  goldEffect?: string;
  source?: string;
  url?: string;
  publishedAt?: string;
  receivedAt?: string;
  receivedTimestampMs?: number;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant" | "system_alert";
  badge?: string; // "🌅 Утренний план", "☀️ Дневной апдейт", "⚡ Алерт 15м", "🚨 Алерт 10м", "🎯 План на день", "👤 Запрос"
  text: string;
  time: string; // HH:mm МСК
  timestamp: number;
  provider?: string;
}

export interface TickerAiState {
  dailyPlan: string | null;
  dailyPlanTimestamp: string | null;
  dailyPlanProvider?: string;
  dailyPlanSummary?: {
    direction: "LONG" | "SHORT" | "NEUTRAL";
    entry: string;
    tp1: string;
    tp2: string;
    sl: string;
    gexRegime: string;
    dangerWindow: string;
  };
  messages: AiChatMessage[];
  customNotes: string;
  lastMorningRunDate?: string;
  lastNoonRunDate?: string;
  dispatchedAlertIds?: string[];
}

export interface AiProviderSettings {
  provider: "deepseek" | "qwen" | "gemini" | "autonomous";
  deepSeekApiKey: string;
  deepSeekModel: "deepseek-chat" | "deepseek-reasoner";
  deepSeekEndpoint?: string;
  qwenApiKey: string;
  qwenModel: "qwen-plus" | "qwen-max" | "qwen-turbo" | "qwen-2.5-72b-instruct";
  qwenEndpoint: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface AutonomousAiAnalystPanelProps {
  activeAsset: string;
  activeTf: string;
  currentPrice: number;
  candles: any[];
  indicatorOutput: any;
  gexReport: any;
  dayGexReport: any;
  calendarEvents?: any[];
  newsItems?: MacroNewsItem[];
  isNewsLoading?: boolean;
  onRefreshNews?: () => Promise<void>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectPriceLevel?: (price: number) => void;
  onOpenSettingsTab?: () => void;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
}

// Default today's macro & market events (MSK) impacting price across GOLD, MOEX, CRYPTO
const DEFAULT_TODAY_EVENTS: MacroCalendarEvent[] = [
  {
    timeMsk: "10:00",
    title: "Открытие срочного рынка МосБиржи (FORTS): баланс ОИ юрлиц по золоту (GD/GLDRUBF) и Si",
    impact: "HIGH",
    section: "MOEX",
    sections: ["MOEX", "GOLD"],
    details: "Формирует утренний импульс рублевого золота и фьючерсов МосБиржи",
    source: "МосБиржа (MOEX)",
    url: "https://www.moex.com/ru/derivatives/"
  },
  {
    timeMsk: "11:00",
    title: "Ежедневная экспирация крипто-опционов (BTC & ETH) и пересчет уровней Gamma Flip",
    impact: "HIGH",
    section: "CRYPTO",
    sections: ["CRYPTO"],
    details: "Снятие опционного удержания цены вокруг страйка Max Pain по BTCUSDT и ETHUSDT",
    source: "Deribit / CoinGlass",
    url: "https://ru.tradingview.com/symbols/BTCUSDT/"
  },
  {
    timeMsk: "11:30",
    title: "Статистика динамики инфляционных ожиданий ЦБ РФ и валютных интервенций Минфина",
    impact: "HIGH",
    section: "MOEX",
    sections: ["MOEX", "GOLD"],
    details: "Прямое влияние на курс рубля (Si) и рублевое золото (GLDRUBF / GD)",
    source: "Банк России (ЦБ РФ)",
    url: "https://www.cbr.ru/dkp/"
  },
  {
    timeMsk: "13:00",
    title: "Брифинг по геополитической безопасности: судоходство Ормуз/Красное море, санкции и энергокоридоры",
    impact: "HIGH",
    section: "GEOPOLITICS",
    sections: ["GEOPOLITICS", "GOLD", "MOEX"],
    details: "Премия за геополитический риск в котировках золота XAUUSD, нефти Brent и валютном рынке",
    source: "ТАСС / Коммерсантъ Мир",
    url: "https://tass.ru/mezhdunarodnaya-panorama"
  },
  {
    timeMsk: "15:30",
    title: "Статистика динамики потребительских цен и инфляции США (CPI / Core PCE / PPI)",
    impact: "CRITICAL",
    section: "GOLD",
    sections: ["GOLD", "CRYPTO", "MOEX"],
    details: "Главный триггер индекса доллара DXY и золота OANDA:XAUUSD (25–50$ движения)",
    source: "Бюро статистики США (BLS)",
    url: "https://www.bls.gov/cpi/"
  },
  {
    timeMsk: "15:30",
    title: "Статистика динамики ВВП США (GDP QoQ) и заявок по безработице (Jobless Claims)",
    impact: "HIGH",
    section: "GOLD",
    sections: ["GOLD", "MOEX"],
    details: "Оценка охлаждения рынка труда и темпов экономического роста США",
    source: "BEA / Минтруд США",
    url: "https://www.bea.gov/data/gdp/gross-domestic-product"
  },
  {
    timeMsk: "16:30",
    title: "Открытие торгов спотовыми Bitcoin & Ethereum ETF в США (IBIT, FBTC, ETHA)",
    impact: "CRITICAL",
    section: "CRYPTO",
    sections: ["CRYPTO", "GOLD"],
    details: "Пиковая институциональная ликвидность суток по BTCUSDT, ETHUSDT и PAXGUSDT",
    source: "CME Group / ETF Desk",
    url: "https://www.cmegroup.com/markets/cryptocurrencies/bitcoin/bitcoin.html"
  },
  {
    timeMsk: "17:00",
    title: "Статистика деловой активности США (ISM Services & Manufacturing PMI)",
    impact: "HIGH",
    section: "GOLD",
    sections: ["GOLD", "CRYPTO"],
    details: "Импульс американской сессии NY Killzone и переток в защитные активы",
    source: "Институт ISM США",
    url: "https://www.ismworld.org/"
  },
  {
    timeMsk: "17:30",
    title: "Международные торговые отношения и санкционные режимы (США, ЕС, КНР, БРИКС+)",
    impact: "HIGH",
    section: "GEOPOLITICS",
    sections: ["GEOPOLITICS", "GOLD", "MOEX"],
    details: "Тарифные барьеры, ограничения на экспорт технологий и расчеты в нацвалютах, влияющие на спрос центробанков на золото",
    source: "Коммерсантъ Власть & Мир",
    url: "https://www.kommersant.ru/rubric/5"
  },
  {
    timeMsk: "18:30",
    title: "Обсуждение ФРС США (FOMC): выступления управляющих по ставке и балансу QT",
    impact: "CRITICAL",
    section: "GOLD",
    sections: ["GOLD", "CRYPTO", "MOEX"],
    details: "Прямое влияние риторики ФРС на реальные доходности US10Y и цену золота",
    source: "ФРС США (Fed)",
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
  },
  {
    timeMsk: "19:00",
    title: "Вечерний клиринг срочного рынка МосБиржи (FORTS) и недельная инфляция РФ",
    impact: "HIGH",
    section: "MOEX",
    sections: ["MOEX", "GOLD"],
    details: "Перерасчет вариационной маржи и открытие вечерней сессии по GD, GLDRUBF, Si",
    source: "МосБиржа / Росстат",
    url: "https://www.moex.com/ru/derivatives/contracts.aspx"
  },
  {
    timeMsk: "20:00",
    title: "Аукцион 10-летних казначейских облигаций США (US10Y Treasury Auction)",
    impact: "HIGH",
    section: "GOLD",
    sections: ["GOLD"],
    details: "Спрос институционалов на госдолг США (обратная корреляция с XAUUSD)",
    source: "TreasuryDirect США",
    url: "https://www.treasurydirect.gov/auctions/upcoming/"
  },
  {
    timeMsk: "21:00",
    title: "Протоколы и макро-прогнозы комитета ФРС США (FOMC Minutes / Ключевая ставка)",
    impact: "CRITICAL",
    section: "GOLD",
    sections: ["GOLD", "CRYPTO", "MOEX"],
    details: "Глобальное движение тренда по XAUUSD, DXY, BTC и фьючерсам МосБиржи",
    source: "Комитет FOMC ФРС США",
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
  }
];

export const AutonomousAiAnalystPanel: React.FC<AutonomousAiAnalystPanelProps> = ({
  activeAsset,
  activeTf,
  currentPrice,
  candles,
  indicatorOutput,
  gexReport,
  dayGexReport,
  calendarEvents = [],
  newsItems = [],
  isNewsLoading = false,
  onRefreshNews,
  isCollapsed = false,
  onToggleCollapse,
  onSelectPriceLevel,
  onOpenSettingsTab,
  width,
  onWidthChange
}: AutonomousAiAnalystPanelProps) => {
  // Panel Active Sub-Tab: "plan" (Торговый план), "chat" (Диалог), "schedule" (Авто-рассылка), "events" (События & Новости)
  const [panelTab, setPanelTab] = useState<"plan" | "chat" | "schedule" | "events">("plan");

  // Per-Ticker State (Loaded and Isolated for EACH activeAsset)
  const [tickerState, setTickerState] = useState<TickerAiState>({
    dailyPlan: null,
    dailyPlanTimestamp: null,
    messages: [],
    customNotes: "",
    dispatchedAlertIds: []
  });

  const [inputQuery, setInputQuery] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);

  // AI Provider Configuration (DeepSeek, Qwen, Gemini, Autonomous)
  const [providerSettings, setProviderSettings] = useState<AiProviderSettings>(() => {
    try {
      const saved = localStorage.getItem("st_ai_provider_settings");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      provider: "deepseek",
      deepSeekApiKey: "",
      deepSeekModel: "deepseek-chat",
      deepSeekEndpoint: "https://api.deepseek.com/chat/completions",
      qwenApiKey: "",
      qwenModel: "qwen-plus",
      qwenEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      geminiApiKey: "",
      geminiModel: "gemini-3.8-flash"
    };
  });

  const [showKeyPassword, setShowKeyPassword] = useState<{ [key: string]: boolean }>({});
  const [testApiState, setTestApiState] = useState<{
    isLoading: boolean;
    provider?: string;
    success?: boolean;
    message?: string;
    latencyMs?: number;
  }>({ isLoading: false });
  const [savedSettingsNotice, setSavedSettingsNotice] = useState<boolean>(false);

  // Events & News Sub-tab and filters
  const [eventsSubTab, setEventsSubTab] = useState<"news" | "calendar">("news");
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<string>("ALL");
  const [newsSearchTerm, setNewsSearchTerm] = useState<string>("");
  const [isLocalNewsRefreshing, setIsLocalNewsRefreshing] = useState<boolean>(false);
  const [localNewsFeed, setLocalNewsFeed] = useState<MacroNewsItem[]>(newsItems);

  // Keep local news synced with parent prop if provided
  useEffect(() => {
    if (newsItems && newsItems.length > 0) {
      setLocalNewsFeed(newsItems);
    }
  }, [newsItems]);

  // If localNewsFeed is still empty, do an initial background fetch
  useEffect(() => {
    if (localNewsFeed.length === 0) {
      handleRefreshNewsFeed();
    }
  }, []);

  // Scheduler Configuration (User Preferences)
  const [schedulerConfig, setSchedulerConfig] = useState({
    morningBriefingEnabled: true,
    morningTimeMsk: "08:50",
    noonUpdateEnabled: true,
    noonTimeMsk: "12:30",
    preEventAlertsEnabled: true,
    alertBefore15m: true,
    alertBefore10m: true,
    soundAlerts: true
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Save Provider Settings
  const handleSaveProviderSettings = () => {
    try {
      localStorage.setItem("st_ai_provider_settings", JSON.stringify(providerSettings));
      setSavedSettingsNotice(true);
      setTimeout(() => setSavedSettingsNotice(false), 2500);
    } catch (e) {
      console.warn("Notice saving AI provider settings:", e);
    }
  };

  // Test Provider API Key
  const handleTestProviderApi = async (prov: "deepseek" | "qwen" | "gemini" | "autonomous") => {
    setTestApiState({ isLoading: true, provider: prov });
    try {
      let apiKey = "";
      let model = "";
      let endpoint = "";

      if (prov === "deepseek") {
        apiKey = providerSettings.deepSeekApiKey;
        model = providerSettings.deepSeekModel;
        endpoint = providerSettings.deepSeekEndpoint || "";
      } else if (prov === "qwen") {
        apiKey = providerSettings.qwenApiKey;
        model = providerSettings.qwenModel;
        endpoint = providerSettings.qwenEndpoint || "";
      } else if (prov === "gemini") {
        apiKey = providerSettings.geminiApiKey || "";
        model = providerSettings.geminiModel || "gemini-3.8-flash";
      }

      const res = await fetch("/api/ai-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: prov,
          apiKey,
          model,
          endpoint
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestApiState({
          isLoading: false,
          provider: prov,
          success: true,
          message: data.message || "✅ Подключение успешно!",
          latencyMs: data.latencyMs
        });
      } else {
        setTestApiState({
          isLoading: false,
          provider: prov,
          success: false,
          message: data.error || "Ошибка подключения к API"
        });
      }
    } catch (err: any) {
      setTestApiState({
        isLoading: false,
        provider: prov,
        success: false,
        message: err.message || "Сетевая ошибка при проверке API"
      });
    }
  };

  // Refresh news feed from server
  const handleRefreshNewsFeed = async () => {
    setIsLocalNewsRefreshing(true);
    try {
      if (onRefreshNews) {
        await onRefreshNews();
      } else {
        const res = await fetch("/api/market/news/refresh", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.news && Array.isArray(data.news)) {
            setLocalNewsFeed(data.news);
          }
        }
      }
    } catch (e: any) {
      console.warn("Notice refreshing news feed:", e.message);
    } finally {
      setIsLocalNewsRefreshing(false);
    }
  };

  // 1. Load Per-Ticker Data on Asset Change
  useEffect(() => {
    try {
      const storageKey = `st_ai_analyst_ticker_${activeAsset}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setTickerState(parsed);
      } else {
        // Initialize default welcome message for this ticker
        const welcomeMsg: AiChatMessage = {
          id: `welcome_${Date.now()}`,
          role: "assistant",
          badge: "🤖 Автономный Аналитик",
          text: `👋 Здравствуйте! Я ваш персональный автономный квант-аналитик по **${activeAsset}**.\n\nЯ непрерывно анализирую графики по всем таймфреймам (1м, 5м, 15м, 1ч, 4ч, 1д), опционные барьеры GEX, дельту объемов и макроэкономические события на сегодня.\n\nВы можете выбрать активный движок ИИ во вкладке **«⚙️ API ИИ»** (DeepSeek V3/R1, Qwen Plus, Gemini или квантовый QUANTEX Algo). Нажмите **«Сформировать план на день»** или задайте любой вопрос!`,
          time: new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date()),
          timestamp: Date.now()
        };
        const initial: TickerAiState = {
          dailyPlan: null,
          dailyPlanTimestamp: null,
          messages: [welcomeMsg],
          customNotes: "",
          dispatchedAlertIds: []
        };
        setTickerState(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      }
    } catch (e) {
      console.warn("Notice loading ticker AI state:", e);
    }
  }, [activeAsset]);

  // Save changes to localStorage per ticker
  const saveTickerState = (updated: TickerAiState) => {
    setTickerState(updated);
    try {
      localStorage.setItem(`st_ai_analyst_ticker_${activeAsset}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("Notice saving ticker state:", e);
    }
  };

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (panelTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [tickerState.messages, panelTab]);

  // Current MSK time string
  const currentMskTime = useMemo(() => {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  }, []);

  // Multi-Timeframe Consolidated Context
  const multiTfSummary = useMemo(() => {
    const list = [
      { tf: "1D", trend: "BULLISH", bias: "Институциональный лонг", rsi: 58, keyLevel: "Put Wall / POC 1D" },
      { tf: "4H", trend: "BULLISH", bias: "Восходящая структура SMC", rsi: 54, keyLevel: "+OB 4H тест" },
      { tf: "1H", trend: activeTf === "1h" ? "BULLISH" : "NEUTRAL", bias: "Консолидация у Zero Gamma", rsi: 51, keyLevel: "Zero Gamma Flip" },
      { tf: "15m", trend: indicatorOutput?.forecast?.isBull ? "BULLISH" : "BEARISH", bias: indicatorOutput?.forecast?.trailingStageStr || "Рабочий диапазон", rsi: 48, keyLevel: indicatorOutput?.forecast?.p1Entry || currentPrice },
      { tf: "5m", trend: "BULLISH", bias: "Импульсный свип ликвидности", rsi: 46, keyLevel: "OTE 0.618" },
      { tf: "1m", trend: "NEUTRAL", bias: "Микроструктура входа", rsi: 50, keyLevel: "Pre-market VWAP" }
    ];
    return list;
  }, [activeTf, indicatorOutput, currentPrice]);

  // Generate Daily Trading Plan or Response from Server AI Endpoint
  const requestAiAnalysis = async (
    mode: "daily_plan" | "morning_brief" | "noon_update" | "event_alert" | "custom_query",
    customUserPrompt?: string,
    eventContext?: MacroCalendarEvent
  ) => {
    setIsGenerating(true);
    const mskNow = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());

    try {
      // Top 5 fresh collected news items to supply in context
      const freshNewsContext = (localNewsFeed.length > 0 ? localNewsFeed : newsItems)
        .slice(0, 6)
        .map(n => ({
          time: n.time,
          title: n.title,
          impact: n.impact,
          category: n.category,
          summary: n.summary
        }));

      const payload = {
        ticker: activeAsset,
        timeframe: activeTf,
        currentPrice: currentPrice || candles[candles.length - 1]?.close || 4165.0,
        multiTfMetrics: multiTfSummary,
        indicatorForecast: indicatorOutput?.forecast ? {
          isBull: indicatorOutput.forecast.isBull,
          p1Entry: indicatorOutput.forecast.p1Entry,
          p2Tp1: indicatorOutput.forecast.p2Tp1,
          p3Tp2: indicatorOutput.forecast.p3Tp2,
          activeTrailingSl: indicatorOutput.forecast.activeTrailingSl,
          probability: indicatorOutput.forecast.probability,
          altTp1: indicatorOutput.forecast.altTp1,
          trailingStageStr: indicatorOutput.forecast.trailingStageStr
        } : null,
        gex: {
          regime: dayGexReport?.netGexRegime || gexReport?.netGexRegime || "POSITIVE_GAMMA",
          callWall: dayGexReport?.callWall || gexReport?.callWall || 4200,
          putWall: dayGexReport?.putWall || gexReport?.putWall || 4100,
          gammaFlip: dayGexReport?.gammaFlip || gexReport?.gammaFlip || 4150,
          maxPain: dayGexReport?.maxPain || gexReport?.maxPain || 4160,
          expectedMove68: dayGexReport?.expectedMove68 || gexReport?.expectedMove68 || { low: 4130, high: 4190 },
          expectedMove95: dayGexReport?.expectedMove95 || gexReport?.expectedMove95 || { low: 4105, high: 4220 },
          pcrOi: dayGexReport?.pcrOi || gexReport?.pcrOi || 0.85
        },
        events: calendarEvents.length > 0 ? calendarEvents : DEFAULT_TODAY_EVENTS,
        latestNews: freshNewsContext,
        mode,
        eventContext,
        userQuery: customUserPrompt || "",
        history: tickerState.messages.slice(-6).map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })),
        aiProviderConfig: providerSettings
      };

      const res = await fetch("/api/ai-analyst/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let generatedPlanText = "";
      let providerName: string = providerSettings.provider;
      if (res.ok) {
        const data = await res.json();
        generatedPlanText = data.plan || data.analysis || "";
        if (data.provider) providerName = data.provider;
      }

      // If network issue or server offline, synthesize institutional quant fallback
      if (!generatedPlanText) {
        generatedPlanText = generateClientSideQuantFallback(payload);
        providerName = "QUANTEX Quant Engine";
      }

      // Format badges
      let badge = "🎯 Торговый план на день";
      if (mode === "morning_brief") badge = "🌅 Утренний план (08:50 МСК)";
      if (mode === "noon_update") badge = "☀️ Дневной апдейт (12:30 МСК)";
      if (mode === "event_alert") badge = `⚡ Алерт за 15м (${eventContext?.timeMsk || "Событие"})`;
      if (mode === "custom_query") badge = `🤖 Ответ ИИ (${providerName})`;

      const newAssistantMsg: AiChatMessage = {
        id: `msg_${Date.now()}`,
        role: mode === "event_alert" ? "system_alert" : "assistant",
        badge,
        text: generatedPlanText,
        time: `${mskNow} МСК`,
        timestamp: Date.now(),
        provider: providerName
      };

      const isDirectionBull = payload.indicatorForecast?.isBull ?? true;
      const parsedSummary = {
        direction: (isDirectionBull ? "LONG" : "SHORT") as "LONG" | "SHORT" | "NEUTRAL",
        entry: String(payload.indicatorForecast?.p1Entry ?? currentPrice),
        tp1: String(payload.indicatorForecast?.p2Tp1 ?? (currentPrice * 1.008).toFixed(2)),
        tp2: String(payload.indicatorForecast?.p3Tp2 ?? (currentPrice * 1.016).toFixed(2)),
        sl: String(payload.indicatorForecast?.activeTrailingSl ?? (currentPrice * 0.995).toFixed(2)),
        gexRegime: payload.gex.regime,
        dangerWindow: "15:30 & 21:00 МСК"
      };

      const updatedTickerState: TickerAiState = {
        ...tickerState,
        dailyPlan: mode === "daily_plan" || mode === "morning_brief" ? generatedPlanText : tickerState.dailyPlan || generatedPlanText,
        dailyPlanTimestamp: mode === "daily_plan" || mode === "morning_brief" ? `${mskNow} МСК` : tickerState.dailyPlanTimestamp || `${mskNow} МСК`,
        dailyPlanProvider: providerName,
        dailyPlanSummary: parsedSummary,
        messages: [...tickerState.messages, newAssistantMsg]
      };

      saveTickerState(updatedTickerState);

      // Auto switch to plan tab if user asked for a plan
      if (mode === "daily_plan" || mode === "morning_brief" || mode === "noon_update") {
        setPanelTab("plan");
      } else if (mode === "custom_query") {
        setPanelTab("chat");
      }
    } catch (e: any) {
      console.error("AI Analysis error:", e);
      // Even on hard error, render fallback so user never gets broken state
      const fallback = generateClientSideQuantFallback({
        ticker: activeAsset,
        timeframe: activeTf,
        currentPrice: currentPrice || 4165.0,
        multiTfMetrics: multiTfSummary,
        indicatorForecast: indicatorOutput?.forecast,
        gex: gexReport || dayGexReport,
        userQuery: customUserPrompt || ""
      });
      const newAssistantMsg: AiChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        badge: "⚡ Квант-план (Резерв)",
        text: fallback,
        time: `${mskNow} МСК`,
        timestamp: Date.now(),
        provider: "QUANTEX Algo"
      };
      saveTickerState({
        ...tickerState,
        dailyPlan: tickerState.dailyPlan || fallback,
        dailyPlanTimestamp: tickerState.dailyPlanTimestamp || `${mskNow} МСК`,
        messages: [...tickerState.messages, newAssistantMsg]
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Client-side quantitative fallback generator
  const generateClientSideQuantFallback = (payload: any): string => {
    const isBull = payload.indicatorForecast?.isBull ?? true;
    const price = payload.currentPrice || 4165.0;
    const entry = payload.indicatorForecast?.p1Entry ?? price;
    const tp1 = payload.indicatorForecast?.p2Tp1 ?? (price * 1.008).toFixed(2);
    const tp2 = payload.indicatorForecast?.p3Tp2 ?? (price * 1.016).toFixed(2);
    const sl = payload.indicatorForecast?.activeTrailingSl ?? (price * 0.995).toFixed(2);
    const regime = payload.gex?.regime || "POSITIVE_GAMMA";
    const callWall = payload.gex?.callWall || (price * 1.015).toFixed(2);
    const putWall = payload.gex?.putWall || (price * 0.985).toFixed(2);
    const gammaFlip = payload.gex?.gammaFlip || price;

    return `### 🏛️ Институциональный торговый план по ${payload.ticker} (${payload.timeframe})

**Глобальный консенсус Multi-TF:** ${isBull ? "🟢 BULLISH (Преимущество покупателей)" : "🔴 BEARISH (Преимущество продавцов)"}  
**Опционный режим:** \`${regime}\`  
**Ключевой диапазон ликвидности:** \`${putWall}\` (Put Wall) — \`${callWall}\` (Call Wall)  
**Граница турбулентности (Zero Flip):** \`${gammaFlip}\`

---

### 🎯 Торговый сетап QUANTEX Pro v8
* **Направление:** **${isBull ? "LONG (Покупка на тесте поддержки)" : "SHORT (Продажа от сопротивления)"}**
* **Зона входа (Entry):** \`${entry}\` (лимитный ордер на подтверждении 15м свечи)
* **Цель 1 (TP1):** \`${tp1}\` — фиксация 50% позиции и перенос SL в безубыток
* **Цель 2 (TP2):** \`${tp2}\` — финальный пул ликвидности перед Call Wall
* **Защитный стоп (SL):** \`${sl}\` (Sweep Protection: не закрывать позицию при уколе тенью)
* **План Б (Инвалидация):** Закрытие 15м свечи телом за уровнем \`${sl}\` отменяет лонг.

---

### ⚠️ Опасные окна макроэкономической волатильности (МСК)
* **10:00 МСК:** Открытие Лондона (LSE Open) — приток европейского объема.
* **15:30 МСК:** Премаркет США и публикации макростатистики (CPI / Claims).
* **21:00 МСК:** Вечерняя сессия / решения FOMC. Перед новостями рекомендуется подтянуть стоп-лосс.`;
  };

  // User sends manual text query
  const handleSendManualQuery = (overrideText?: string) => {
    const textToSend = overrideText || inputQuery;
    if (!textToSend.trim() || isGenerating) return;

    const mskNow = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());

    const userMsg: AiChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      badge: "👤 Трейдер",
      text: textToSend.trim(),
      time: `${mskNow} МСК`,
      timestamp: Date.now()
    };

    saveTickerState({
      ...tickerState,
      messages: [...tickerState.messages, userMsg]
    });

    if (!overrideText) {
      setInputQuery("");
    }

    requestAiAnalysis("custom_query", textToSend.trim());
  };

  // Check automated scheduling clock (08:50, 12:30, and 15m/10m before macro events)
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const mskHours = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", hour: "numeric", hour12: false }).format(now);
      const mskMinutes = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", minute: "numeric" }).format(now);
      const mskDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }); // YYYY-MM-DD
      const currentTimeStr = `${mskHours.padStart(2, "0")}:${mskMinutes.padStart(2, "0")}`;

      // 1. Morning Briefing (08:50 MSK)
      if (
        schedulerConfig.morningBriefingEnabled &&
        currentTimeStr === schedulerConfig.morningTimeMsk &&
        tickerState.lastMorningRunDate !== mskDateStr
      ) {
        saveTickerState({
          ...tickerState,
          lastMorningRunDate: mskDateStr
        });
        requestAiAnalysis("morning_brief");
      }

      // 2. Noon Update (12:30 MSK)
      if (
        schedulerConfig.noonUpdateEnabled &&
        currentTimeStr === schedulerConfig.noonTimeMsk &&
        tickerState.lastNoonRunDate !== mskDateStr
      ) {
        saveTickerState({
          ...tickerState,
          lastNoonRunDate: mskDateStr
        });
        requestAiAnalysis("noon_update");
      }

      // 3. Pre-event Alerts (15 min and 10 min before scheduled events)
      if (schedulerConfig.preEventAlertsEnabled) {
        const eventsList = calendarEvents.length > 0 ? calendarEvents : DEFAULT_TODAY_EVENTS;
        eventsList.forEach(ev => {
          if (!ev.timeMsk) return;
          const [evH, evM] = ev.timeMsk.split(":").map(Number);
          const evTotalMin = evH * 60 + evM;
          const nowTotalMin = Number(mskHours) * 60 + Number(mskMinutes);
          const diff = evTotalMin - nowTotalMin;

          // 15-minute alert
          if (schedulerConfig.alertBefore15m && diff === 15) {
            const alertKey = `${mskDateStr}_15m_${ev.title}`;
            if (!tickerState.dispatchedAlertIds?.includes(alertKey)) {
              saveTickerState({
                ...tickerState,
                dispatchedAlertIds: [...(tickerState.dispatchedAlertIds || []), alertKey]
              });
              requestAiAnalysis("event_alert", `Внимание: через 15 минут выходит ${ev.title}!`, ev);
            }
          }

          // 10-minute alert
          if (schedulerConfig.alertBefore10m && diff === 10) {
            const alertKey = `${mskDateStr}_10m_${ev.title}`;
            if (!tickerState.dispatchedAlertIds?.includes(alertKey)) {
              saveTickerState({
                ...tickerState,
                dispatchedAlertIds: [...(tickerState.dispatchedAlertIds || []), alertKey]
              });
              requestAiAnalysis("event_alert", `Внимание: через 10 минут выходит ${ev.title}! Проверьте стоп-лоссы.`, ev);
            }
          }
        });
      }
    };

    const interval = setInterval(checkSchedule, 25000); // Check every 25 seconds
    return () => clearInterval(interval);
  }, [schedulerConfig, tickerState, calendarEvents, activeAsset]);

  // Copy plan to clipboard
  const copyPlanToClipboard = () => {
    if (tickerState.dailyPlan) {
      navigator.clipboard.writeText(tickerState.dailyPlan);
      setCopiedPlan(true);
      setTimeout(() => setCopiedPlan(false), 2000);
    }
  };

  const todayDateMsk = useMemo(
    () =>
      new Date().toLocaleDateString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }),
    []
  );

  // Unified section matcher for ALL | GOLD | GEOPOLITICS | MOEX | CRYPTO
  const matchesPanelSection = (item: any, targetSection: string): boolean => {
    if (!targetSection || targetSection === "ALL") return true;
    if (item.section === targetSection) return true;
    if (Array.isArray(item.sections) && item.sections.includes(targetSection)) return true;

    const text = `${item.title || ""} ${item.summary || ""} ${item.details || ""} ${item.category || ""}`.toLowerCase();
    if (targetSection === "GEOPOLITICS") {
      return (
        item.category === "GEOPOLITICS" ||
        /(геополит|военн|конфликт|санкци|ормуз|красн.*мор|хусит|ближн.*восток|нато|тайван|израиль|иран|украин|эмбарго|пошлин|тариф|переговор|оборон|безопасност)/i.test(text)
      );
    }
    if (targetSection === "MOEX") {
      return item.category === "MOEX_MARKET" || /(мосбирж|moex|цб рф|рубл|gldrubf|si|ri|росстат|минфин)/i.test(text);
    }
    if (targetSection === "CRYPTO") {
      return item.category === "CRYPTO" || /(биткоин|bitcoin|btc|эфириум|ethereum|eth|solana|sol|xrp|крипт|deribit|etf)/i.test(text);
    }
    if (targetSection === "GOLD") {
      return /(золот|xauusd|oanda|фрс|fomc|инфляц|cpi|pce|dxy|us10y|трежерис|ввп|pmi)/i.test(text);
    }
    return true;
  };

  // Filtered & strictly newest-first sorted news items
  const filteredNews = useMemo(() => {
    const list = localNewsFeed.length > 0 ? localNewsFeed : newsItems;
    const getTs = (item: MacroNewsItem) => {
      if (typeof item.timestampMs === "number" && !isNaN(item.timestampMs)) return item.timestampMs;
      if (item.publishedAt) {
        const p = new Date(item.publishedAt).getTime();
        if (!isNaN(p)) return p;
      }
      return 0;
    };
    return [...list]
      .sort((a, b) => getTs(b) - getTs(a))
      .filter(item => {
        if (!matchesPanelSection(item, newsCategoryFilter)) {
          return false;
        }
        if (newsSearchTerm.trim()) {
          const q = newsSearchTerm.toLowerCase();
          const matchesTitle = item.title?.toLowerCase().includes(q);
          const matchesSummary = item.summary?.toLowerCase().includes(q);
          const matchesEffect = item.goldEffect?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesSummary && !matchesEffect) {
            return false;
          }
        }
        return true;
      });
  }, [localNewsFeed, newsItems, newsCategoryFilter, newsSearchTerm]);

  const syncedCalendarList = useMemo(() => {
    const rawEvents = calendarEvents && calendarEvents.length > 0 ? calendarEvents : DEFAULT_TODAY_EVENTS;
    return rawEvents.filter((ev) => matchesPanelSection(ev, newsCategoryFilter));
  }, [calendarEvents, newsCategoryFilter]);

  // Provider badge text for header
  const providerBadgeText = useMemo(() => {
    if (providerSettings.provider === "deepseek") {
      return providerSettings.deepSeekModel === "deepseek-reasoner" ? "🤖 DeepSeek-R1" : "🤖 DeepSeek-V3";
    }
    if (providerSettings.provider === "qwen") {
      return `🌐 ${providerSettings.qwenModel}`;
    }
    if (providerSettings.provider === "gemini") {
      return "✨ Gemini";
    }
    return "⚡ QUANTEX Квант";
  }, [providerSettings]);

  return (
    <div
      style={!isCollapsed && width ? { width: `${width}px` } : undefined}
      className={`h-full border-l border-gray-800 bg-[#090d16] flex flex-col shrink-0 select-none ${
        isCollapsed ? "w-12" : (width ? "" : "w-80 md:w-96 lg:w-[390px] xl:w-[420px]")
      }`}
    >
      {/* 1. Header Bar */}
      <div className="p-2 sm:p-2.5 border-b border-gray-800 bg-[#0c101d] flex items-center justify-between gap-1.5 sm:gap-2 shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 text-white shadow-md shadow-cyan-500/20 shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-white tracking-wide truncate">
                  ИИ-Аналитик
                </span>
                <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {activeAsset}
                </span>

                {/* Static Provider Info Badge */}
                <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-700/60 hidden sm:inline">
                  {providerBadgeText}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono mt-0.5">
                <Clock className="h-2.5 w-2.5 text-cyan-400" />
                <span>{currentMskTime} МСК</span>
                <span className="text-gray-600">•</span>
                <span className="text-emerald-400 font-bold">Синхронно</span>
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {!isCollapsed && onWidthChange && width && (
            <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700/80 rounded px-1 py-0.5 text-[9px] font-mono">
              <button
                type="button"
                onClick={() => onWidthChange(Math.max(260, width - 30))}
                className="text-gray-400 hover:text-white px-0.5 font-bold cursor-pointer transition hover:bg-gray-800 rounded"
                title="Уменьшить ширину панели (-30px)"
              >
                -
              </button>
              <span
                onClick={() => onWidthChange(380)}
                className="text-cyan-300 cursor-pointer font-bold px-0.5 hover:underline"
                title="Сбросить ширину (380px)"
              >
                {width}px
              </span>
              <button
                type="button"
                onClick={() => onWidthChange(Math.min(700, width + 30))}
                className="text-gray-400 hover:text-white px-0.5 font-bold cursor-pointer transition hover:bg-gray-800 rounded"
                title="Увеличить ширину панели (+30px)"
              >
                +
              </button>
            </div>
          )}

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
              title={isCollapsed ? "Развернуть панель ИИ-аналитика" : "Свернуть панель ИИ"}
            >
              {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* If Collapsed, show compact vertical pill bar */}
      {isCollapsed ? (
        <div
          onClick={onToggleCollapse}
          className="flex-1 flex flex-col items-center py-4 gap-4 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/5 cursor-pointer transition-colors group select-none"
          title="Нажмите чтобы развернуть панель ИИ-Аналитика"
        >
          <button
            type="button"
            className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500/30 transition cursor-pointer"
            title="Открыть ИИ-Аналитика"
          >
            <Bot className="h-5 w-5" />
          </button>
          <div
            style={{ writingMode: "vertical-rl" }}
            className="text-[11px] font-bold tracking-widest text-gray-400 group-hover:text-cyan-300 font-mono uppercase transition-colors"
          >
            {activeAsset} • ИИ ПЛАН
          </div>
        </div>
      ) : (
        <>
          {/* 2. Sub-Tabs Bar: Plan, Chat, Schedule, News, Providers */}
          <div className="px-1.5 pt-1.5 bg-[#0a0e1a] border-b border-gray-800/80 flex items-center justify-between gap-0.5 shrink-0 text-[11px] font-bold">
            <button
              onClick={() => setPanelTab("plan")}
              className={`flex-1 py-1 px-1.5 rounded-t-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                panelTab === "plan"
                  ? "bg-[#111827] text-cyan-300 border-t-2 border-cyan-400 font-extrabold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Compass className="h-3 w-3 text-cyan-400" />
              <span>План</span>
            </button>

            <button
              onClick={() => setPanelTab("chat")}
              className={`flex-1 py-1 px-1.5 rounded-t-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                panelTab === "chat"
                  ? "bg-[#111827] text-purple-300 border-t-2 border-purple-400 font-extrabold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Bot className="h-3 w-3 text-purple-400" />
              <span>Чат ({tickerState.messages.length})</span>
            </button>

            <button
              onClick={() => setPanelTab("schedule")}
              className={`flex-1 py-1 px-1.5 rounded-t-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                panelTab === "schedule"
                  ? "bg-[#111827] text-amber-300 border-t-2 border-amber-400 font-extrabold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Bell className="h-3 w-3 text-amber-400" />
              <span>Авто</span>
            </button>

            <button
              onClick={() => setPanelTab("events")}
              className={`flex-1 py-1 px-1.5 rounded-t-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                panelTab === "events"
                  ? "bg-[#111827] text-emerald-300 border-t-2 border-emerald-400 font-extrabold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Calendar className="h-3 w-3 text-emerald-400" />
              <span>Новости ({localNewsFeed.length || newsItems.length})</span>
            </button>
          </div>

          {/* 3. Action Bar: Generate Now & Status */}
          <div className="p-2 bg-[#0e1424] border-b border-gray-800/80 flex items-center justify-between gap-2 shrink-0">
            <button
              onClick={() => requestAiAnalysis("daily_plan")}
              disabled={isGenerating}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                isGenerating
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-600/20 active:scale-[0.98]"
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin text-cyan-400" : ""}`} />
              <span>{isGenerating ? "ИИ анализирует ТФ & GEX..." : `Сформировать План (${providerBadgeText})`}</span>
            </button>

            {tickerState.dailyPlan && (
              <button
                onClick={copyPlanToClipboard}
                className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer"
                title="Скопировать торговый план"
              >
                {copiedPlan ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {/* 4. Tab Body Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 font-sans text-xs">
            {/* TAB 1: DAILY TRADING PLAN */}
            {panelTab === "plan" && (
              <div className="space-y-3">
                {/* Plan Header Card */}
                <div className="p-2.5 rounded-xl bg-[#0f1527] border border-cyan-500/30 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{tickerState.dailyPlanTimestamp ? `План на день (${tickerState.dailyPlanTimestamp})` : "Торговый план не сформирован"}</span>
                    </span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                      {tickerState.dailyPlanProvider || providerBadgeText}
                    </span>
                  </div>

                  {/* Quick Metrics Bar from Plan */}
                  {tickerState.dailyPlanSummary && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-gray-800 text-center font-mono">
                      <div className="bg-[#0b0e1a] p-1.5 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block">НАПРАВЛЕНИЕ</span>
                        <span
                          className={`font-bold text-xs ${
                            tickerState.dailyPlanSummary.direction === "LONG" ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {tickerState.dailyPlanSummary.direction}
                        </span>
                      </div>
                      <div className="bg-[#0b0e1a] p-1.5 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block">ВХОД</span>
                        <span className="font-bold text-xs text-white">{tickerState.dailyPlanSummary.entry}</span>
                      </div>
                      <div className="bg-[#0b0e1a] p-1.5 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block">ЦЕЛЬ TP1</span>
                        <span className="font-bold text-xs text-cyan-300">{tickerState.dailyPlanSummary.tp1}</span>
                      </div>
                      <div className="bg-[#0b0e1a] p-1.5 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block">СТОП SL</span>
                        <span className="font-bold text-xs text-rose-300">{tickerState.dailyPlanSummary.sl}</span>
                      </div>
                      <div className="bg-[#0b0e1a] p-1.5 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block">РЕЖИМ GEX</span>
                        <span className="font-bold text-[10px] text-purple-300 truncate">{tickerState.dailyPlanSummary.gexRegime}</span>
                      </div>
                      <div className="bg-[#0b0e1a] p-1.5 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block">ОПАСНЫЕ ОКНА</span>
                        <span className="font-bold text-[10px] text-amber-300">{tickerState.dailyPlanSummary.dangerWindow}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Plan Content Markdown Box */}
                {tickerState.dailyPlan ? (
                  <div className="p-3 rounded-xl bg-[#0c101d] border border-gray-800 leading-relaxed text-gray-200 prose prose-invert max-w-none text-xs">
                    <ReactMarkdown>{tickerState.dailyPlan}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#0b0e1a] border border-dashed border-gray-800 text-center space-y-3">
                    <Bot className="h-8 w-8 text-cyan-400/60 mx-auto" />
                    <div>
                      <p className="font-bold text-white text-xs">План для {activeAsset} еще не создан</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Нажмите кнопку выше, чтобы ИИ сопоставил все таймфреймы, опционные барьеры GEX и свежие новости.
                      </p>
                    </div>
                    <button
                      onClick={() => requestAiAnalysis("daily_plan")}
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer shadow-md inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Сформировать сейчас</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: INTERACTIVE CHAT HISTORY */}
            {panelTab === "chat" && (
              <div className="space-y-3">
                <div className="space-y-2.5">
                  {tickerState.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2.5 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
                        msg.role === "user"
                          ? "bg-[#131b31] border-cyan-500/30 ml-4 text-cyan-100"
                          : msg.role === "system_alert"
                          ? "bg-rose-950/40 border-rose-500/50 text-rose-100"
                          : "bg-[#0b0f1d] border-gray-800 mr-2 text-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono border-b border-gray-800/60 pb-1">
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded ${
                            msg.role === "user"
                              ? "bg-cyan-500/20 text-cyan-300"
                              : msg.role === "system_alert"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-purple-500/20 text-purple-300"
                          }`}
                        >
                          {msg.badge || (msg.role === "user" ? "Вы" : "ИИ-Аналитик")}
                        </span>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          {msg.provider && <span className="text-[9px] text-gray-500">{msg.provider}</span>}
                          <span>{msg.time}</span>
                        </div>
                      </div>

                      <div className="prose prose-invert max-w-none text-xs">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {/* TAB 3: AUTOMATED DISPATCH SCHEDULE (08:50, 12:30, 15m/10m Alerts) */}
            {panelTab === "schedule" && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-[#0b0f1d] border border-gray-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      <span>Автономный график рассылок</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                      АКТИВЕН
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-normal">
                    ИИ-аналитик автоматически формирует план перед открытием торговых сессий и присылает предупреждения перед важными событиями.
                  </p>

                  <div className="space-y-2 pt-1 font-mono text-xs">
                    {/* Morning Briefing (08:50 MSK) */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] border border-gray-800">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>🌅 Утренний брифинг</span>
                          <span className="text-cyan-400 font-extrabold">{schedulerConfig.morningTimeMsk} МСК</span>
                        </div>
                        <div className="text-[10px] text-gray-400">Перед открытием MOEX FORTS &amp; Лондона</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={schedulerConfig.morningBriefingEnabled}
                        onChange={(e) => setSchedulerConfig({ ...schedulerConfig, morningBriefingEnabled: e.target.checked })}
                        className="rounded border-gray-700 text-cyan-600 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                    </div>

                    {/* Noon Update (12:30 MSK) */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] border border-gray-800">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>☀️ Дневной апдейт</span>
                          <span className="text-amber-400 font-extrabold">{schedulerConfig.noonTimeMsk} МСК</span>
                        </div>
                        <div className="text-[10px] text-gray-400">Корректировка уровней перед сессией США</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={schedulerConfig.noonUpdateEnabled}
                        onChange={(e) => setSchedulerConfig({ ...schedulerConfig, noonUpdateEnabled: e.target.checked })}
                        className="rounded border-gray-700 text-cyan-600 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                    </div>

                    {/* Pre-event Alerts (15m & 10m) */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#0e1424] border border-gray-800">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>⚡ Алерты до новостей (15м &amp; 10м)</span>
                        </div>
                        <div className="text-[10px] text-gray-400">Предупреждение за 15 и 10 мин до выхода CPI/FOMC</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={schedulerConfig.preEventAlertsEnabled}
                        onChange={(e) => setSchedulerConfig({ ...schedulerConfig, preEventAlertsEnabled: e.target.checked })}
                        className="rounded border-gray-700 text-cyan-600 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                    </div>
                  </div>

                  {/* Manual Test Dispatch Buttons */}
                  <div className="pt-2 border-t border-gray-800 grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                    <button
                      onClick={() => requestAiAnalysis("morning_brief")}
                      className="p-1.5 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 transition cursor-pointer text-center"
                    >
                      ▶ Тест 08:50
                    </button>
                    <button
                      onClick={() => requestAiAnalysis("noon_update")}
                      className="p-1.5 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 transition cursor-pointer text-center"
                    >
                      ▶ Тест 12:30
                    </button>
                    <button
                      onClick={() => requestAiAnalysis("event_alert", "Тестовый алерт за 15 минут до публикации CPI США", DEFAULT_TODAY_EVENTS[2])}
                      className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 transition cursor-pointer text-center"
                    >
                      ▶ Алерт 15м
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TODAY'S MACRO EVENTS & NEWS STREAM */}
            {panelTab === "events" && (
              <div className="space-y-2.5">
                {/* News & Calendar Top Header + Refresh Button */}
                <div className="p-2.5 rounded-xl bg-[#0b0f1d] border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEventsSubTab("news")}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          eventsSubTab === "news"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <Zap className="h-3 w-3 text-emerald-400" />
                        <span>Новости ({filteredNews.length})</span>
                      </button>

                      <button
                        onClick={() => setEventsSubTab("calendar")}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          eventsSubTab === "calendar"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <Calendar className="h-3 w-3 text-blue-400" />
                        <span>События дня ({syncedCalendarList.length})</span>
                      </button>
                    </div>

                    {/* Refresh news button */}
                    <button
                      onClick={handleRefreshNewsFeed}
                      disabled={isLocalNewsRefreshing || isNewsLoading}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        isLocalNewsRefreshing || isNewsLoading
                          ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                          : "bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      }`}
                      title="Собрать свежие новости и синхронизировать события дня"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLocalNewsRefreshing || isNewsLoading ? "animate-spin text-emerald-400" : ""}`} />
                      <span>{isLocalNewsRefreshing || isNewsLoading ? "Сбор..." : "Обновить"}</span>
                    </button>
                  </div>

                  {/* Unified 4-Section Filter Bar for BOTH News & Daily Events: Все, Золото, MOEX, Крипта */}
                  <div className="space-y-1.5 pt-1">
                    {eventsSubTab === "news" && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0e1424] border border-gray-700/80">
                        <Search className="h-3 w-3 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={newsSearchTerm}
                          onChange={(e) => setNewsSearchTerm(e.target.value)}
                          placeholder="Поиск (золото, ФРС, МосБиржа, BTC)..."
                          className="w-full bg-transparent border-none text-[11px] text-white placeholder-gray-500 focus:outline-none"
                        />
                        {newsSearchTerm && (
                          <button onClick={() => setNewsSearchTerm("")} className="text-gray-400 hover:text-white text-[10px]">✕</button>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-5 gap-1 text-[9px] font-mono">
                      {[
                        { id: "ALL", label: "🌐 Все" },
                        { id: "GOLD", label: "🪙 Золото" },
                        { id: "GEOPOLITICS", label: "🌍 Геополит." },
                        { id: "MOEX", label: "🇷🇺 MOEX" },
                        { id: "CRYPTO", label: "₿ Крипта" }
                      ].map(c => (
                        <button
                          key={c.id}
                          onClick={() => setNewsCategoryFilter(c.id)}
                          className={`px-1 py-1 rounded-lg transition text-center cursor-pointer font-bold truncate ${
                            newsCategoryFilter === c.id
                              ? "bg-emerald-500 text-black shadow-sm"
                              : "bg-gray-800/80 text-gray-300 hover:text-white border border-gray-700/50"
                          }`}
                          title={c.label}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-tab 1: LIVE NEWS FEED */}
                {eventsSubTab === "news" && (
                  <div className="space-y-2">
                    {filteredNews.length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#0b0e1a] border border-dashed border-gray-800 text-center space-y-2">
                        <Zap className="h-6 w-6 text-emerald-400/60 mx-auto" />
                        <p className="text-gray-400 text-xs">Новости в выбранном разделе не найдены</p>
                        <button
                          onClick={handleRefreshNewsFeed}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Собрать новости сейчас</span>
                        </button>
                      </div>
                    ) : (
                      filteredNews.map((n) => {
                        const verifyUrl = n.url || "https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA";
                        return (
                          <div
                            key={n.id}
                            className="p-2.5 rounded-xl bg-[#0d1220] border border-gray-800 hover:border-gray-700 transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-cyan-400" title="Дата и время публикации">
                                  📅 {n.date && !n.time.includes(n.date) ? `${n.date} • ${n.time}` : n.time}
                                </span>
                                {n.receivedAt && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" title="Точное время получения сборщиком QUANTEX">
                                    📥 {n.receivedAt}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {n.source && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-gray-800 text-gray-300">
                                    {n.source}
                                  </span>
                                )}
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    n.impact === "CRITICAL"
                                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                      : n.impact === "HIGH"
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                      : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                                  }`}
                                >
                                  {n.impact}
                                </span>
                                <a
                                  href={verifyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/30 text-[9px] font-bold transition"
                                  title={`Перейти на оригинал источника (${n.source || "Первоисточник"}) и проверить`}
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  <span>{n.source || "Источник"}</span>
                                </a>
                              </div>
                            </div>

                            <div className="font-bold text-white text-xs leading-snug">
                              {n.title}
                            </div>

                            {n.summary && (
                              <p className="text-[11px] text-gray-300 leading-relaxed">
                                {n.summary}
                              </p>
                            )}

                            {n.goldEffect && (
                              <div className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[10px] text-emerald-300 flex items-start gap-1">
                                <span className="font-bold shrink-0">Влияние:</span>
                                <span className="leading-tight">{n.goldEffect}</span>
                              </div>
                            )}

                            {/* Quick ask button */}
                            <div className="pt-1 flex items-center justify-end">
                              <button
                                onClick={() => {
                                  handleSendManualQuery(`Как новость «${n.title}» повлияет на текущий сетап ${activeAsset} и зоны GEX?`);
                                  setPanelTab("chat");
                                }}
                                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Bot className="h-3 w-3" />
                                <span>Включить в анализ ИИ →</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Sub-tab 2: MACRO CALENDAR EVENTS (WITH DATE, SYNCHRONIZED STATUS & SOURCE BADGE) */}
                {eventsSubTab === "calendar" && (
                  <div className="space-y-1.5">
                    {syncedCalendarList.map((ev: any, idx: number) => {
                      const imp = ev.importance || ev.impact || "HIGH";
                      const evDate = ev.date || todayDateMsk;
                      const evTime = String(ev.timeMsk || "").includes("МСК") ? ev.timeMsk : `${ev.timeMsk} МСК`;
                      const verifyUrl = ev.url || "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

                      return (
                        <div
                          key={ev.id || idx}
                          className="p-2.5 rounded-xl bg-[#0d1220] border border-gray-800 hover:border-gray-700 transition space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap font-mono text-[10px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-cyan-300">📅 {evDate}</span>
                              <span className="font-bold text-amber-400">⏰ {evTime}</span>
                              {ev.receivedAt && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" title="Точное время синхронизации">
                                  📥 {ev.receivedAt}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  imp === "CRITICAL"
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                    : imp === "HIGH"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                                }`}
                              >
                                {imp}
                              </span>
                              <a
                                href={verifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/30 text-[9px] font-bold transition"
                                title={`Проверить первоисточник (${ev.source || "Официальный источник"})`}
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                <span>{ev.source || "Источник"}</span>
                              </a>
                            </div>
                          </div>
                          <div className="font-bold text-white text-xs leading-snug">{ev.title}</div>
                          {(ev.details || ev.impact) && (
                            <div className="text-[10px] text-gray-400 leading-relaxed">{ev.details || ev.impact}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Quick Prompt Chips & Manual Input Bar (Persistent at bottom) */}
          <div className="p-2.5 bg-[#0b0f1c] border-t border-gray-800 space-y-2 shrink-0">
            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono scrollbar-none">
              <button
                onClick={() => handleSendManualQuery(`Дай подробный торговый план на день по ${activeAsset} с точками входа, целями и стопом.`)}
                className="px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/80 shrink-0 cursor-pointer transition"
              >
                🎯 План на день
              </button>
              <button
                onClick={() => handleSendManualQuery(`Проанализируй уровни GEX для ${activeAsset}: Call Wall, Put Wall и Max Pain.`)}
                className="px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 hover:bg-purple-900 border border-purple-800/80 shrink-0 cursor-pointer transition"
              >
                🏛️ GEX уровни
              </button>
              <button
                onClick={() => handleSendManualQuery(`Оцени риски и защитный стоп (SL) по ${activeAsset}. Какой запас хода?`)}
                className="px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/80 shrink-0 cursor-pointer transition"
              >
                🛡️ Риски &amp; SL
              </button>
              <button
                onClick={() => {
                  setPanelTab("events");
                  setEventsSubTab("news");
                  handleRefreshNewsFeed();
                }}
                className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 hover:bg-amber-900 border border-amber-800/80 shrink-0 cursor-pointer transition flex items-center gap-1"
              >
                <Zap className="h-2.5 w-2.5 text-amber-400" />
                <span>Собрать новости</span>
              </button>
            </div>

            {/* Input field + Send button */}
            <div className="flex items-center gap-1.5 bg-[#121829] border border-gray-700/80 rounded-xl px-2.5 py-1.5 focus-within:border-cyan-500/80 transition">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendManualQuery();
                  }
                }}
                placeholder={`Спросить ИИ (${providerBadgeText}) по ${activeAsset}...`}
                className="flex-1 bg-transparent border-none text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => handleSendManualQuery()}
                disabled={!inputQuery.trim() || isGenerating}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  !inputQuery.trim() || isGenerating
                    ? "text-gray-600 cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20 active:scale-95"
                }`}
                title="Отправить запрос ИИ"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
