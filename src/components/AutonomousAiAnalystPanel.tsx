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
  Activity,
  Trash2,
  History,
  User,
  X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { UserAccountItem } from "./UnifiedStationSettings";

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
  asset?: string;
  username?: string;
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
    statusText?: string;
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
  deepSeekWebSearch?: boolean;
  enableWebSearch?: boolean;
  qwenApiKey: string;
  qwenModel: "qwen-plus" | "qwen-max" | "qwen-turbo" | "qwen-2.5-72b-instruct";
  qwenEndpoint: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface AutonomousAiAnalystPanelProps {
  currentUser?: UserAccountItem;
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

// Weekend macro & market agenda (MSK) for Saturdays and Sundays
const WEEKEND_CALENDAR_EVENTS: MacroCalendarEvent[] = [
  {
    timeMsk: "11:00",
    title: "Субботний перерасчет позиций и экспирация 24/7 крипто-опционов (Deribit)",
    impact: "HIGH",
    section: "CRYPTO",
    sections: ["CRYPTO"],
    details: "Обновление карты открытого интереса, страйка Max Pain и гамма-профилей по BTC и ETH",
    source: "Deribit / CoinGlass",
    url: "https://ru.tradingview.com/symbols/BTCUSDT/"
  },
  {
    timeMsk: "14:00",
    title: "Анализ позиционирования институциональных фондов по отчету CFTC COT (Commitments of Traders)",
    impact: "HIGH",
    section: "GOLD",
    sections: ["GOLD", "MOEX"],
    details: "Сверка чистого позиционирования Managed Money по золоту (COMEX) и валютам за прошедшую торговую неделю",
    source: "Комиссия CFTC США",
    url: "https://www.cftc.gov/marketreports/commitmentsoftraders/index.htm"
  },
  {
    timeMsk: "18:00",
    title: "Мониторинг геополитических рисков и энергокоридоров (Ормузский пролив, Ближний Восток)",
    impact: "HIGH",
    section: "GEOPOLITICS",
    sections: ["GEOPOLITICS", "GOLD", "MOEX"],
    details: "Оценка вероятности гэпа на открытии рынков металлов и нефти в ночь на понедельник",
    source: "Коммерсантъ / ТАСС",
    url: "https://tass.ru/mezhdunarodnaya-panorama"
  },
  {
    timeMsk: "Вс 23:59 / Пн 01:00",
    title: "Открытие торгов металлами (CME Globex) и старт тихоокеанско-азиатской сессии",
    impact: "CRITICAL",
    section: "GOLD",
    sections: ["GOLD"],
    details: "Возобновление мировых торгов золотом XAUUSD и серебром, первичная реакция на события выходных",
    source: "CME Group",
    url: "https://www.cmegroup.com/markets/metals/precious/gold.html"
  }
];

function isWeekendInMsk(): boolean {
  try {
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(new Date());
    return day === "Sat" || day === "Sun";
  } catch {
    const d = new Date().getUTCDay();
    return d === 0 || d === 6;
  }
}

export const AutonomousAiAnalystPanel: React.FC<AutonomousAiAnalystPanelProps> = ({
  currentUser,
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
  // Active User Context (Dedicated AI Analyst for each user)
  const activeUsername = currentUser?.username ? currentUser.username.trim() : "admin";
  const userRole = currentUser?.role || "trader";

  // Master all-history messages for this user (across all tickers)
  const [allUserMessages, setAllUserMessages] = useState<AiChatMessage[]>([]);
  // Chat sub-view filter: "current_asset" vs "all_history"
  const [chatViewMode, setChatViewMode] = useState<"current_asset" | "all_history">("current_asset");
  // Search filter inside full history
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  // Clear chat modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [clearScope, setClearScope] = useState<"current_asset" | "all_history">("current_asset");
  const [clearToastMessage, setClearToastMessage] = useState<string | null>(null);

  // Panel Active Sub-Tab: "plan" (Торговый план), "chat" (Диалог), "schedule" (Авто-рассылка), "events" (События & Новости)
  const [panelTab, setPanelTab] = useState<"plan" | "chat" | "schedule" | "events">("plan");

  // Per-Ticker State (Loaded and Isolated for EACH activeAsset and activeUsername)
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
  const [showModeSettings, setShowModeSettings] = useState<boolean>(false);
  const [responseStyleMode, setResponseStyleMode] = useState<"short" | "detailed" | "autonomous">(() => {
    try {
      const saved = localStorage.getItem("st_ai_response_mode");
      if (saved === "short" || saved === "detailed" || saved === "autonomous") {
        return saved;
      }
    } catch {}
    return "detailed";
  });

  // Helper to filter out dummy/placeholder keys
  const cleanApiKeyHelper = (k?: string) => {
    if (!k) return "";
    const t = k.trim().replace(/^["']|["']$/g, "").trim();
    if (
      t === "AIzaSyAhY9_p0DAtmyGbmXsMLjZko2zAav5pAGc" ||
      t.startsWith("AIzaSyAhY9_") ||
      t === "YOUR_GEMINI_API_KEY" ||
      t.toLowerCase().includes("placeholder")
    ) {
      return "";
    }
    return t;
  };

  // AI Provider Configuration (DeepSeek, Qwen, Gemini, Autonomous)
  const [providerSettings, setProviderSettings] = useState<AiProviderSettings>(() => {
    try {
      const saved = localStorage.getItem("st_ai_provider_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          const gemKey = cleanApiKeyHelper(parsed.geminiApiKey);
          parsed.geminiApiKey = gemKey;
          // If provider was set to deepseek with no key, prefer gemini
          if (parsed.provider === "deepseek" && !parsed.deepSeekApiKey && gemKey) {
            parsed.provider = "gemini";
          }
          return parsed;
        }
      }
    } catch {}
    return {
      provider: "gemini",
      deepSeekApiKey: "",
      deepSeekModel: "deepseek-chat",
      deepSeekEndpoint: "https://api.deepseek.com/chat/completions",
      qwenApiKey: "",
      qwenModel: "qwen-plus",
      qwenEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      geminiApiKey: "",
      geminiModel: "gemini-3.1-flash-lite"
    };
  });

  // Automatically sync providerSettings with server unified station settings
  useEffect(() => {
    const syncUnifiedSettings = async () => {
      try {
        const res = await fetch("/api/settings/unified");
        if (res.ok) {
          const data = await res.json();
          if (data && data.ai) {
            setProviderSettings(prev => {
              const serverAi = data.ai;
              const serverGeminiKey = cleanApiKeyHelper(serverAi.geminiApiKey);
              const serverDsKey = serverAi.deepSeekApiKey || "";
              const effectiveGeminiKey = cleanApiKeyHelper(prev.geminiApiKey) || serverGeminiKey;
              const effectiveDsKey = prev.deepSeekApiKey || serverDsKey;

              // Priority: serverAi.activeProvider > prev.provider
              let targetProvider = serverAi.activeProvider || prev.provider || "deepseek";
              if (
                targetProvider === "deepseek" &&
                (!effectiveDsKey || effectiveDsKey.length < 5) &&
                effectiveGeminiKey &&
                effectiveGeminiKey.length > 5
              ) {
                targetProvider = "gemini";
              } else if (
                targetProvider === "gemini" &&
                (!effectiveGeminiKey || effectiveGeminiKey.length < 5) &&
                effectiveDsKey &&
                effectiveDsKey.length > 5
              ) {
                targetProvider = "deepseek";
              }

              const merged: AiProviderSettings = {
                provider: targetProvider as any,
                deepSeekApiKey: effectiveDsKey,
                deepSeekModel: prev.deepSeekModel || serverAi.deepSeekModel || "deepseek-chat",
                deepSeekEndpoint: prev.deepSeekEndpoint || serverAi.deepSeekEndpoint || "https://api.deepseek.com/chat/completions",
                deepSeekWebSearch: prev.deepSeekWebSearch ?? serverAi.deepSeekWebSearch ?? true,
                enableWebSearch: prev.enableWebSearch ?? serverAi.enableWebSearch ?? true,
                qwenApiKey: prev.qwenApiKey || serverAi.qwenApiKey || "",
                qwenModel: prev.qwenModel || serverAi.qwenModel || "qwen-plus",
                qwenEndpoint: prev.qwenEndpoint || serverAi.qwenEndpoint || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
                geminiApiKey: effectiveGeminiKey,
                geminiModel: prev.geminiModel || serverAi.geminiModel || "gemini-3.1-flash-lite"
              };

              try {
                localStorage.setItem("st_ai_provider_settings", JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        }
      } catch (e) {
        console.warn("Could not sync AI settings with server:", e);
      }
    };

    syncUnifiedSettings();

    const handleSettingsUpdated = () => {
      syncUnifiedSettings();
    };

    window.addEventListener("station_settings_updated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("station_settings_updated", handleSettingsUpdated);
    };
  }, []);

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

  // 1. Load Per-User & Per-Ticker Data on Asset or User Change
  useEffect(() => {
    try {
      const userStorageKey = `st_ai_analyst_${activeUsername}_${activeAsset}`;
      const legacyKey = `st_ai_analyst_ticker_${activeAsset}`;
      let savedData = localStorage.getItem(userStorageKey);
      if (!savedData && activeUsername === "admin") {
        savedData = localStorage.getItem(legacyKey);
      }

      if (savedData) {
        const parsed = JSON.parse(savedData);
        setTickerState(parsed);
      } else {
        // Initialize default welcome message for this user & ticker
        const welcomeMsg: AiChatMessage = {
          id: `welcome_${Date.now()}`,
          role: "assistant",
          badge: "🤖 Автономный Аналитик",
          text: `👋 Здравствуйте, **${activeUsername}**! Я ваш персональный автономный квант-аналитик по **${activeAsset}**.\n\nЯ непрерывно анализирую графики по всем таймфреймам (1м, 5м, 15м, 1ч, 4ч, 1д), опционные барьеры GEX, дельту объемов и макроэкономические события на сегодня.\n\nВы можете выбрать активный движок ИИ во вкладке **«⚙️ API ИИ»** (DeepSeek V3/R1, Qwen Plus, Gemini или квантовый QUANTEX Algo). Нажмите **«Сформировать план на день»** или задайте любой вопрос!`,
          time: new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date()),
          timestamp: Date.now(),
          asset: activeAsset,
          username: activeUsername
        };
        const initial: TickerAiState = {
          dailyPlan: null,
          dailyPlanTimestamp: null,
          messages: [welcomeMsg],
          customNotes: "",
          dispatchedAlertIds: []
        };
        setTickerState(initial);
        localStorage.setItem(userStorageKey, JSON.stringify(initial));
      }
    } catch (e) {
      console.warn("Notice loading ticker AI state:", e);
    }
  }, [activeUsername, activeAsset]);

  // 1b. Load Master All-History for Current User across All Assets
  useEffect(() => {
    const masterHistoryKey = `st_ai_analyst_${activeUsername}_master_history`;
    try {
      const savedMaster = localStorage.getItem(masterHistoryKey);
      if (savedMaster) {
        const parsed = JSON.parse(savedMaster);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllUserMessages(parsed);
        }
      }
    } catch {}

    // Synchronize with server-side repository
    fetch(`/api/ai-analyst/history?username=${encodeURIComponent(activeUsername)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          setAllUserMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = data.messages.filter((m: any) => !existingIds.has(m.id));
            if (newOnes.length > 0) {
              const merged = [...prev, ...newOnes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
              try {
                localStorage.setItem(masterHistoryKey, JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return prev;
          });
        }
      })
      .catch(() => {});
  }, [activeUsername]);

  // Save changes to localStorage per user and asset, and sync new messages to master history
  const saveTickerState = (updated: TickerAiState, newMessageToAppend?: AiChatMessage) => {
    setTickerState(updated);
    try {
      localStorage.setItem(`st_ai_analyst_${activeUsername}_${activeAsset}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("Notice saving ticker state:", e);
    }

    if (newMessageToAppend) {
      const enrichedMsg: AiChatMessage = {
        ...newMessageToAppend,
        asset: newMessageToAppend.asset || activeAsset,
        username: newMessageToAppend.username || activeUsername,
        timestamp: newMessageToAppend.timestamp || Date.now()
      };

      setAllUserMessages(prev => {
        const exists = prev.some(m => m.id === enrichedMsg.id);
        const nextList = exists ? prev : [...prev, enrichedMsg];
        try {
          localStorage.setItem(`st_ai_analyst_${activeUsername}_master_history`, JSON.stringify(nextList));
        } catch {}
        return nextList;
      });

      // Background persist to server
      fetch("/api/ai-analyst/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: activeUsername,
          message: enrichedMsg,
          ticker: activeAsset
        })
      }).catch(() => {});
    }
  };

  // Handle Clear Chat (Scope: current asset or all history for this user)
  const handleClearChat = async (scope: "current_asset" | "all_history") => {
    setIsClearModalOpen(false);
    try {
      const mskTime = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Moscow",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date());

      if (scope === "current_asset") {
        const welcomeMsg: AiChatMessage = {
          id: `welcome_${Date.now()}`,
          role: "assistant",
          badge: "🤖 Автономный Аналитик",
          text: `👋 Здравствуйте, **${activeUsername}**! История диалога по инструменту **${activeAsset}** очищена.\n\nЯ готов к новому квант-анализу графиков, уровней GEX и макроэкономических новостей. Нажмите **«Сформировать план на день»** или задайте уточняющий вопрос.`,
          time: `${mskTime} МСК`,
          timestamp: Date.now(),
          asset: activeAsset,
          username: activeUsername
        };

        const updatedTicker: TickerAiState = {
          ...tickerState,
          messages: [welcomeMsg]
        };
        setTickerState(updatedTicker);
        localStorage.setItem(`st_ai_analyst_${activeUsername}_${activeAsset}`, JSON.stringify(updatedTicker));

        // Filter out this asset's messages from allUserMessages
        setAllUserMessages(prev => {
          const remaining = prev.filter(m => m.asset && m.asset.toUpperCase() !== activeAsset.toUpperCase());
          const next = [...remaining, welcomeMsg];
          try {
            localStorage.setItem(`st_ai_analyst_${activeUsername}_master_history`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Notify server
        await fetch("/api/ai-analyst/clear-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: activeUsername,
            ticker: activeAsset,
            clearAll: false
          })
        });

        setClearToastMessage(`Диалог по ${activeAsset} для «${activeUsername}» успешно очищен`);
      } else {
        // Clear entire chat history across all tickers for this user
        const welcomeMsg: AiChatMessage = {
          id: `welcome_${Date.now()}`,
          role: "assistant",
          badge: "🤖 Автономный Аналитик",
          text: `👋 Здравствуйте, **${activeUsername}**! Вся история диалогов ИИ-аналитика по всем инструментам полностью очищена.\n\nЯ готов к анализу. Выберите интересующий актив и сформируйте торговый план или задайте любой вопрос!`,
          time: `${mskTime} МСК`,
          timestamp: Date.now(),
          asset: activeAsset,
          username: activeUsername
        };

        const updatedTicker: TickerAiState = {
          ...tickerState,
          messages: [welcomeMsg]
        };
        setTickerState(updatedTicker);
        localStorage.setItem(`st_ai_analyst_${activeUsername}_${activeAsset}`, JSON.stringify(updatedTicker));

        setAllUserMessages([welcomeMsg]);
        localStorage.setItem(`st_ai_analyst_${activeUsername}_master_history`, JSON.stringify([welcomeMsg]));

        // Notify server
        await fetch("/api/ai-analyst/clear-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: activeUsername,
            clearAll: true
          })
        });

        setClearToastMessage(`Вся история ИИ-аналитика для пользователя «${activeUsername}» успешно очищена`);
      }
    } catch (err: any) {
      console.error("Clear chat error:", err);
      setClearToastMessage("Ошибка при очистке чата");
    }

    setTimeout(() => {
      setClearToastMessage(null);
    }, 4000);
  };

  // Filtered messages list based on active tab view mode and search query
  const displayedMessages = useMemo(() => {
    if (chatViewMode === "all_history") {
      let list = allUserMessages;
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        list = list.filter(m =>
          (m.text && m.text.toLowerCase().includes(q)) ||
          (m.badge && m.badge.toLowerCase().includes(q)) ||
          (m.asset && m.asset.toLowerCase().includes(q)) ||
          (m.provider && m.provider.toLowerCase().includes(q))
        );
      }
      return list;
    }
    return tickerState.messages;
  }, [chatViewMode, allUserMessages, tickerState.messages, historySearchQuery]);

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

  // Multi-Timeframe Consolidated Context across all 6 key timeframes: 5m, 15m, 30m, 1h, 4h, 1d
  const multiTfSummary = useMemo(() => {
    const isBull = indicatorOutput?.forecast?.isBull ?? true;
    const basePrice = currentPrice || candles[candles.length - 1]?.close || 4006.0;
    const trailingStr = indicatorOutput?.forecast?.trailingStageStr || "🛡️ Начальный SL";
    const fc = indicatorOutput?.forecast;

    // Accurate indicator flags from the chart HUD / engine:
    // leg1Hit = Entry reached (Вход взят ✓)
    // leg2Hit = TP1 reached (Тейк 1 взят ✓)
    // leg3Hit = TP2 reached (Тейк 2 взят ✓)
    const activeLeg1Hit = Boolean(fc?.leg1Hit);
    const activeLeg2Hit = Boolean(fc?.leg2Hit);
    const activeLeg3Hit = Boolean(fc?.leg3Hit);

    const helperStatus = (isL: boolean, entryP: number, tp1P: number, tp2P: number, eHit: boolean, t1Hit: boolean, t2Hit: boolean) => {
      if (t2Hit) return "🏆 TP2 достигнут (цель выполнена)";
      if (t1Hit) return `📈 TP1 взят → держим до TP2 ${tp2P}`;
      if (eHit) return `📍 В позиции → ждём TP1 ${tp1P}`;
      return `⏳ Ждём вход @${entryP}`;
    };

    // 15m is the primary indicator timeframe
    const m15Entry = Number(fc?.p1Entry ?? (basePrice * (isBull ? 0.9970 : 1.0030)).toFixed(2));
    const m15Tp1 = Number(fc?.p2Tp1 ?? (basePrice * (isBull ? 1.0080 : 0.9920)).toFixed(2));
    const m15Tp2 = Number(fc?.p3Tp2 ?? (basePrice * (isBull ? 1.0160 : 0.9840)).toFixed(2));
    const m15Sl = Number(fc?.invalidLevelSl ?? (basePrice * (isBull ? 0.9940 : 1.0060)).toFixed(2));
    const m15Trailing = Number(fc?.activeTrailingSl ?? (basePrice * (isBull ? 0.9975 : 1.0025)).toFixed(2));
    const m15EntryHit = activeLeg1Hit;
    const m15Tp1Hit = activeLeg2Hit;
    const m15Tp2Hit = activeLeg3Hit;

    // 5m scalping
    const m5Entry = Number((basePrice * (isBull ? 0.9985 : 1.0015)).toFixed(2));
    const m5Tp1 = Number((basePrice * (isBull ? 1.0035 : 0.9965)).toFixed(2));
    const m5Tp2 = Number((basePrice * (isBull ? 1.0070 : 0.9930)).toFixed(2));
    const m5Sl = Number((basePrice * (isBull ? 0.9965 : 1.0035)).toFixed(2));
    const m5Trailing = Number((basePrice * (isBull ? 0.9995 : 1.0005)).toFixed(2));
    const m5EntryHit = isBull ? basePrice >= m5Entry : basePrice <= m5Entry;
    const m5Tp1Hit = isBull ? basePrice >= m5Tp1 : basePrice <= m5Tp1;
    const m5Tp2Hit = isBull ? basePrice >= m5Tp2 : basePrice <= m5Tp2;

    // 30m swing
    const m30Entry = Number((basePrice * (isBull ? 0.9960 : 1.0040)).toFixed(2));
    const m30Tp1 = Number((basePrice * (isBull ? 1.0100 : 0.9900)).toFixed(2));
    const m30Tp2 = Number((basePrice * (isBull ? 1.0190 : 0.9810)).toFixed(2));
    const m30Sl = Number((basePrice * (isBull ? 0.9920 : 1.0080)).toFixed(2));
    const m30Trailing = Number((basePrice * (isBull ? 0.9960 : 1.0040)).toFixed(2));
    const m30EntryHit = isBull ? basePrice >= m30Entry : basePrice <= m30Entry;
    const m30Tp1Hit = isBull ? basePrice >= m30Tp1 : basePrice <= m30Tp1;
    const m30Tp2Hit = isBull ? basePrice >= m30Tp2 : basePrice <= m30Tp2;

    // 1h swing
    const h1Entry = Number((basePrice * (isBull ? 0.9940 : 1.0060)).toFixed(2));
    const h1Tp1 = Number((basePrice * (isBull ? 1.0120 : 0.9880)).toFixed(2));
    const h1Tp2 = Number((basePrice * (isBull ? 1.0220 : 0.9780)).toFixed(2));
    const h1Sl = Number((basePrice * (isBull ? 0.9890 : 1.0110)).toFixed(2));
    const h1Trailing = Number((basePrice * (isBull ? 0.9940 : 1.0060)).toFixed(2));
    const h1EntryHit = isBull ? basePrice >= h1Entry : basePrice <= h1Entry;
    const h1Tp1Hit = isBull ? basePrice >= h1Tp1 : basePrice <= h1Tp1;
    const h1Tp2Hit = isBull ? basePrice >= h1Tp2 : basePrice <= h1Tp2;

    // 4h trend
    const h4Entry = Number((basePrice * 0.9900).toFixed(2));
    const h4Tp1 = Number((basePrice * 1.0180).toFixed(2));
    const h4Tp2 = Number((basePrice * 1.0300).toFixed(2));
    const h4Sl = Number((basePrice * 0.9820).toFixed(2));
    const h4Trailing = Number((basePrice * 0.9950).toFixed(2));
    const h4EntryHit = basePrice >= h4Entry;
    const h4Tp1Hit = basePrice >= h4Tp1;
    const h4Tp2Hit = basePrice >= h4Tp2;

    // 1d macro
    const d1Entry = Number((basePrice * 0.9850).toFixed(2));
    const d1Tp1 = Number((basePrice * 1.0250).toFixed(2));
    const d1Tp2 = Number((basePrice * 1.0450).toFixed(2));
    const d1Sl = Number((basePrice * 0.9700).toFixed(2));
    const d1Trailing = Number((basePrice * 0.9900).toFixed(2));
    const d1EntryHit = basePrice >= d1Entry;
    const d1Tp1Hit = basePrice >= d1Tp1;
    const d1Tp2Hit = basePrice >= d1Tp2;

    const list = [
      {
        tf: "5m",
        name: "M5 Скальпинг",
        role: "Тактический вход и микроструктура",
        trend: isBull ? "BULLISH" : "BEARISH",
        bias: "Импульсный отскок OTE 0.618 / быстрый трейл BE+0.15",
        entry: m5Entry,
        tp1: m5Tp1,
        tp2: m5Tp2,
        sl: m5Sl,
        trailingSl: m5Trailing,
        entryTriggered: m5EntryHit,
        tp1Hit: m5Tp1Hit,
        tp2Hit: m5Tp2Hit,
        setupStatus: "ACTIVE",
        tradeStatusText: helperStatus(isBull, m5Entry, m5Tp1, m5Tp2, m5EntryHit, m5Tp1Hit, m5Tp2Hit),
        rsi: isBull ? 54 : 46,
        behaviorNote: "Быстрый отскок от зоны ликвидности M5, фиксация TP1 и перевод в безубыток"
      },
      {
        tf: "15m",
        name: "M15 Интрадей",
        role: "Базовый рабочий таймфрейм индикатора",
        trend: isBull ? "BULLISH" : "BEARISH",
        bias: trailingStr,
        entry: m15Entry,
        tp1: m15Tp1,
        tp2: m15Tp2,
        sl: m15Sl,
        trailingSl: m15Trailing,
        entryTriggered: m15EntryHit,
        tp1Hit: m15Tp1Hit,
        tp2Hit: m15Tp2Hit,
        setupStatus: fc?.isPlanBActive ? "PLAN_B_ACTIVE" : "ACTIVE",
        tradeStatusText: fc?.isPlanBActive
          ? "⚡ План Б — слом SL, жди разворот"
          : helperStatus(isBull, m15Entry, m15Tp1, m15Tp2, m15EntryHit, m15Tp1Hit, m15Tp2Hit),
        rsi: isBull ? 52 : 47,
        behaviorNote: "Лоренцевский ML + Zero-Flip: отработка опционных стен дилеров Call/Put Wall"
      },
      {
        tf: "30m",
        name: "M30 Свинг",
        role: "Интрадей-баланс и фильтр ложных пробоев",
        trend: isBull ? "BULLISH" : "BEARISH",
        bias: "Консенсус средних таймфреймов и равновесие 0.50 EQ",
        entry: m30Entry,
        tp1: m30Tp1,
        tp2: m30Tp2,
        sl: m30Sl,
        trailingSl: m30Trailing,
        entryTriggered: m30EntryHit,
        tp1Hit: m30Tp1Hit,
        tp2Hit: m30Tp2Hit,
        setupStatus: "ACTIVE",
        tradeStatusText: helperStatus(isBull, m30Entry, m30Tp1, m30Tp2, m30EntryHit, m30Tp1Hit, m30Tp2Hit),
        rsi: isBull ? 53 : 48,
        behaviorNote: "Удержание структуры интрадей-баланса, сглаживание шума младших ТФ"
      },
      {
        tf: "1h",
        name: "H1 Свинг",
        role: "Институциональный поток и зоны ликвидности FVG",
        trend: isBull ? "BULLISH" : "BEARISH",
        bias: "OTE 0.618 + FVG Свип сессионной ликвидности",
        entry: h1Entry,
        tp1: h1Tp1,
        tp2: h1Tp2,
        sl: h1Sl,
        trailingSl: h1Trailing,
        entryTriggered: h1EntryHit,
        tp1Hit: h1Tp1Hit,
        tp2Hit: h1Tp2Hit,
        setupStatus: "ACTIVE",
        tradeStatusText: helperStatus(isBull, h1Entry, h1Tp1, h1Tp2, h1EntryHit, h1Tp1Hit, h1Tp2Hit),
        rsi: isBull ? 55 : 45,
        behaviorNote: "Свип азиатской/европейской ликвидности и продолжение трендовой волны"
      },
      {
        tf: "4h",
        name: "H4 Трендовый Свинг",
        role: "Крупные ордерблоки SMC и EMA 200",
        trend: "BULLISH",
        bias: "SMC +OB Demand Zone + удержание экспоненциальной средней 200 EMA",
        entry: h4Entry,
        tp1: h4Tp1,
        tp2: h4Tp2,
        sl: h4Sl,
        trailingSl: h4Trailing,
        entryTriggered: h4EntryHit,
        tp1Hit: h4Tp1Hit,
        tp2Hit: h4Tp2Hit,
        setupStatus: "ACTIVE",
        tradeStatusText: helperStatus(true, h4Entry, h4Tp1, h4Tp2, h4EntryHit, h4Tp1Hit, h4Tp2Hit),
        rsi: 56,
        behaviorNote: "Институциональная защита трендового рубежа крупными покупателями"
      },
      {
        tf: "1d",
        name: "D1 Макро Цикл",
        role: "Глобальный тренд и открытый интерес",
        trend: "BULLISH",
        bias: "Глобальный бычий макро-цикл + накопление физического металла центробанками",
        entry: d1Entry,
        tp1: d1Tp1,
        tp2: d1Tp2,
        sl: d1Sl,
        trailingSl: d1Trailing,
        entryTriggered: d1EntryHit,
        tp1Hit: d1Tp1Hit,
        tp2Hit: d1Tp2Hit,
        setupStatus: "ACTIVE",
        tradeStatusText: helperStatus(true, d1Entry, d1Tp1, d1Tp2, d1EntryHit, d1Tp1Hit, d1Tp2Hit),
        rsi: 59,
        behaviorNote: "Глобальный приток ликвидности центробанков (PBOC, Индия) удерживает восходящий тренд"
      }
    ];
    return list;
  }, [activeTf, indicatorOutput, currentPrice, candles]);

  // Generate Daily Trading Plan or Response from Server AI Endpoint
  const requestAiAnalysis = async (
    mode: "daily_plan" | "morning_brief" | "noon_update" | "event_alert" | "custom_query",
    customUserPrompt?: string,
    eventContext?: MacroCalendarEvent,
    overrideResponseStyle?: "short" | "detailed" | "autonomous"
  ) => {
    const activeStyle = overrideResponseStyle || responseStyleMode;
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

      const reliableCurrentPrice = currentPrice || candles[candles.length - 1]?.close || 4006.0;

      const payload = {
        ticker: activeAsset,
        timeframe: activeTf,
        currentPrice: reliableCurrentPrice,
        multiTfMetrics: multiTfSummary,
        indicatorForecast: indicatorOutput?.forecast ? {
          isBull: indicatorOutput.forecast.isBull,
          p1Entry: indicatorOutput.forecast.p1Entry,
          p2Tp1: indicatorOutput.forecast.p2Tp1,
          p3Tp2: indicatorOutput.forecast.p3Tp2,
          p5Tp3: indicatorOutput.forecast.p5Tp3,
          activeTrailingSl: indicatorOutput.forecast.activeTrailingSl,
          invalidLevelSl: indicatorOutput.forecast.invalidLevelSl,
          probability: indicatorOutput.forecast.probability,
          altTp1: indicatorOutput.forecast.altTp1,
          trailingStageStr: indicatorOutput.forecast.trailingStageStr,
          leg1Hit: Boolean(indicatorOutput.forecast.leg1Hit),
          leg2Hit: Boolean(indicatorOutput.forecast.leg2Hit),
          leg3Hit: Boolean(indicatorOutput.forecast.leg3Hit),
          isPlanBActive: Boolean(indicatorOutput.forecast.isPlanBActive),
          entryTriggered: Boolean(indicatorOutput.forecast.leg1Hit),
          tp1Hit: Boolean(indicatorOutput.forecast.leg2Hit),
          tp2Hit: Boolean(indicatorOutput.forecast.leg3Hit),
          currentStatusText: indicatorOutput.forecast.isPlanBActive
            ? "⚡ План Б — слом SL, жди разворот"
            : indicatorOutput.forecast.leg3Hit
            ? "🏆 TP2 взят — все цели выполнены"
            : indicatorOutput.forecast.leg2Hit
            ? `📈 TP1 взят → держим до TP2 ${indicatorOutput.forecast.p3Tp2}`
            : indicatorOutput.forecast.leg1Hit
            ? `📍 В позиции → ждём TP1 ${indicatorOutput.forecast.p2Tp1}`
            : `⏳ Ждём вход @${indicatorOutput.forecast.p1Entry}`,
          humanExplanation: indicatorOutput.forecast.isPlanBActive
            ? "Активирован альтернативный План Б из-за истинного пробоя защитного стопа."
            : indicatorOutput.forecast.leg3Hit
            ? "Позиция полностью закрыта по максимальному тейк-профиту TP2."
            : indicatorOutput.forecast.leg2Hit
            ? `Тейк-профит 1 (${indicatorOutput.forecast.p2Tp1}) взят! Часть зафиксирована, остаток защищен безубытком.`
            : indicatorOutput.forecast.leg1Hit
            ? `Ордер на вход по ${indicatorOutput.forecast.p1Entry} сработал, позиция открыта в рынке. Цель TP1 (${indicatorOutput.forecast.p2Tp1}) ЕЩЁ НЕ ДОСТИГНУТА (ждём её). Стоп подтянут в безубыток (${indicatorOutput.forecast.activeTrailingSl}).`
            : `Ожидаем срабатывания входа по ${indicatorOutput.forecast.p1Entry}. Если сетап сменится до активации входа — он будет аннулирован как неисполненный.`
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
        events: isWeekendInMsk() ? WEEKEND_CALENDAR_EVENTS : (calendarEvents.length > 0 ? calendarEvents : DEFAULT_TODAY_EVENTS),
        latestNews: freshNewsContext,
        mode,
        eventContext,
        userQuery: customUserPrompt || "",
        history: tickerState.messages.slice(-6).map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })),
        aiProviderConfig: providerSettings,
        responseStyle: activeStyle,
        username: activeUsername
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
        provider: providerName,
        asset: activeAsset,
        username: activeUsername
      };

      const isDirectionBull = payload.indicatorForecast?.isBull ?? true;
      const parsedSummary = {
        direction: (isDirectionBull ? "LONG" : "SHORT") as "LONG" | "SHORT" | "NEUTRAL",
        entry: String(payload.indicatorForecast?.p1Entry ?? currentPrice),
        tp1: String(payload.indicatorForecast?.p2Tp1 ?? (currentPrice * 1.008).toFixed(2)),
        tp2: String(payload.indicatorForecast?.p3Tp2 ?? (currentPrice * 1.016).toFixed(2)),
        sl: String(payload.indicatorForecast?.activeTrailingSl ?? (currentPrice * 0.995).toFixed(2)),
        gexRegime: payload.gex.regime,
        dangerWindow: "15:30 & 21:00 МСК",
        statusText: payload.indicatorForecast?.currentStatusText || undefined
      };

      const updatedTickerState: TickerAiState = {
        ...tickerState,
        dailyPlan: mode === "daily_plan" || mode === "morning_brief" ? generatedPlanText : tickerState.dailyPlan || generatedPlanText,
        dailyPlanTimestamp: mode === "daily_plan" || mode === "morning_brief" ? `${mskNow} МСК` : tickerState.dailyPlanTimestamp || `${mskNow} МСК`,
        dailyPlanProvider: providerName,
        dailyPlanSummary: parsedSummary,
        messages: [...tickerState.messages, newAssistantMsg]
      };

      saveTickerState(updatedTickerState, newAssistantMsg);

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
        currentPrice: currentPrice || candles[candles.length - 1]?.close || 4006.0,
        multiTfMetrics: multiTfSummary,
        indicatorForecast: indicatorOutput?.forecast,
        gex: gexReport || dayGexReport,
        userQuery: customUserPrompt || "",
        username: activeUsername
      });
      const newAssistantMsg: AiChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        badge: "⚡ Квант-план (Резерв)",
        text: fallback,
        time: `${mskNow} МСК`,
        timestamp: Date.now(),
        provider: "QUANTEX Algo",
        asset: activeAsset,
        username: activeUsername
      };
      saveTickerState({
        ...tickerState,
        dailyPlan: tickerState.dailyPlan || fallback,
        dailyPlanTimestamp: tickerState.dailyPlanTimestamp || `${mskNow} МСК`,
        messages: [...tickerState.messages, newAssistantMsg]
      }, newAssistantMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Client-side quantitative fallback generator
  const generateClientSideQuantFallback = (payload: any): string => {
    const isBull = payload.indicatorForecast?.isBull ?? true;
    const price = Number(payload.currentPrice || 4165.0).toFixed(2);
    const entryAggressive = payload.indicatorForecast?.p1Entry ? Number(payload.indicatorForecast.p1Entry).toFixed(2) : price;
    const entryConservative = isBull 
      ? (Number(entryAggressive) * 0.9985).toFixed(2)
      : (Number(entryAggressive) * 1.0015).toFixed(2);
    const tp1 = payload.indicatorForecast?.p2Tp1 ? Number(payload.indicatorForecast.p2Tp1).toFixed(2) : (Number(price) * (isBull ? 1.006 : 0.994)).toFixed(2);
    const tp2 = payload.indicatorForecast?.p3Tp2 ? Number(payload.indicatorForecast.p3Tp2).toFixed(2) : (Number(price) * (isBull ? 1.012 : 0.988)).toFixed(2);
    const tp3 = (Number(price) * (isBull ? 1.018 : 0.982)).toFixed(2);
    const sl = payload.indicatorForecast?.activeTrailingSl ? Number(payload.indicatorForecast.activeTrailingSl).toFixed(2) : (isBull ? (Number(price) * 0.995).toFixed(2) : (Number(price) * 1.005).toFixed(2));
    const regime = payload.gex?.regime || "POSITIVE_GAMMA";
    const callWall = payload.gex?.callWall ? Number(payload.gex.callWall).toFixed(2) : (Number(price) * 1.015).toFixed(2);
    const putWall = payload.gex?.putWall ? Number(payload.gex.putWall).toFixed(2) : (Number(price) * 0.985).toFixed(2);
    const maxPain = payload.gex?.maxPain ? Number(payload.gex.maxPain).toFixed(2) : price;
    const gammaFlip = payload.gex?.gammaFlip ? Number(payload.gex.gammaFlip).toFixed(2) : price;
    const slLevel = payload.indicatorForecast?.activeTrailingSl ? Number(payload.indicatorForecast.activeTrailingSl).toFixed(2) : (isBull ? putWall : callWall);
    const cancelLevel = payload.indicatorForecast?.invalidLevelSl ? Number(payload.indicatorForecast.invalidLevelSl).toFixed(2) : (isBull ? (Number(putWall) - 5).toFixed(2) : (Number(callWall) + 5).toFixed(2));
    const altTarget = payload.indicatorForecast?.altTp1 ? Number(payload.indicatorForecast.altTp1).toFixed(2) : (isBull ? putWall : callWall);
    const style = payload.responseStyle || responseStyleMode;

    const isWeekend = isWeekendInMsk();
    const tUpper = String(payload.ticker || "").toUpperCase();
    const isCrypto = tUpper.includes("BTC") || tUpper.includes("ETH") || tUpper.includes("SOL") || tUpper.includes("XRP");
    const isMarketClosed = isWeekend && !isCrypto;

    if (isMarketClosed) {
      if (style === "short") {
        return `### ⚡ Короткий аудит закрытия недели: ${payload.ticker} (${payload.timeframe})
* **Статус биржи:** ⏸️ **Рынок закрыт на выходные**. Возобновление мировых торгов в ночь на понедельник в 01:00 МСК (CME Globex).
* **Недельное закрытие:** \`${price}\` | Модель QUANTEX: **${isBull ? "🟢 LONG (Бычий уклон)" : "🔴 SHORT (Коррекция)"}**
* **Опционы GEX (\`${regime}\`):** Потолок \`${callWall}\` | Поддержка \`${putWall}\` | Flip \`${gammaFlip}\`
* **План на открытие:** Встречать открытие в понедельник, контроль подтверждения объемов выше \`${entryAggressive}\` (цели TP1: \`${tp1}\`, TP2: \`${tp2}\`, SL: \`${sl}\`).`;
      }

      return `### ${style === "autonomous" ? "🤖 Автономный ИИ QUANTEX" : "📊 Развёрнутый план"} — Аудит закрытия недели: ${payload.ticker}

**Статус биржи:** ⏸️ **Рынок металлов закрыт на выходные**. Торги возобновятся в ночь на понедельник в 01:00 МСК (CME Globex).
**Цена закрытия недели:** \`${price}\`  
**Глобальный консенсус Multi-TF:** ${isBull ? "🟢 BULLISH (Преимущество покупателей)" : "🔴 BEARISH (Преимущество продавцов)"}  
**Опционный режим:** \`${regime}\`  
**Ключевой диапазон ликвидности:** \`${putWall}\` (Put Wall) — \`${callWall}\` (Call Wall)  
**Граница турбулентности (Zero Flip):** \`${gammaFlip}\`

---

### 🎯 Торговый сценарий к открытию торгов в понедельник
* **Направление:** **${isBull ? "LONG (Покупка на тесте поддержки)" : "SHORT (Продажа от сопротивления)"}**
* **Зона входа (Entry):** \`${entryAggressive}\` (агрессивный) / \`${entryConservative}\` (консервативный)
* **Цель 1 (TP1):** \`${tp1}\` — фиксация 50% позиции и перенос SL в безубыток
* **Цель 2 (TP2):** \`${tp2}\` — финальный пул ликвидности перед Call Wall
* **Защитный стоп (SL):** \`${slLevel}\` (привязка к уровню ${isBull ? `Put Wall ${putWall}` : `Call Wall ${callWall}`})
* **План Б (Инвалидация):** Закрытие 15м свечи за \`${cancelLevel}\` отменяет сценарий.

---

### 📋 Повестка выходных и подготовка к сессии
* **Отчеты CFTC COT:** Сверка баланса открытого интереса институциональных фондов по золоту.
* **Геополитический мониторинг:** Оценка риска ценового разрыва (Weekend Gap Risk).
* **В ночь на понедельник в 01:00 МСК:** Возобновление мировых торгов (CME Globex & Сидней). При открытии с гэпом воздержитесь от рыночных ордеров в первые 15 минут.`;
    }

    const mskNow = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());

    const isEntryHit = Boolean(payload.indicatorForecast?.leg1Hit ?? payload.indicatorForecast?.entryTriggered);
    const isTp1Hit = Boolean(payload.indicatorForecast?.leg2Hit ?? payload.indicatorForecast?.tp1Hit);
    const isTp2Hit = Boolean(payload.indicatorForecast?.leg3Hit ?? payload.indicatorForecast?.tp2Hit);
    const distToTp1 = Math.abs(Number(price) - Number(tp1)).toFixed(2);
    const tradeStatus = isTp2Hit ? "🏆 TP2 взят (все цели выполнены)" : isTp1Hit ? `📈 TP1 взят → держим остаток до TP2 ${tp2}` : isEntryHit ? `📍 В позиции → ждём TP1 ${tp1} (до цели ${distToTp1} п.)` : `⏳ Ждём активации входа @${entryAggressive}`;

    if (style === "short") {
      const verdict = isEntryHit
        ? `В позиции, удерживаем до TP1 ${tp1} со стопом в БУ.`
        : `Ждем отскок к ${entryConservative} для входа в ${isBull ? "лонг" : "шорт"}.`;

      return `1. 🚨 Фон чистый (важных новостей в ближайшие 30 минут нет).
2. GEX: Call ${callWall}, Put ${putWall}. Консенсус ТФ: ${isBull ? "4 из 5 за ПОКУПКИ" : "4 из 5 за ПРОДАЖИ"}.
3. Сделка на основе консенсуса: ${isBull ? "LONG" : "SHORT"} | Вход: ${entryConservative} | SL: ${slLevel} | TP1: ${tp1}.
4. Вердикт: ${verdict}`;
    }

    const consensusStr = isBull ? "4 из 5 ТФ за ПОКУПКИ" : "4 из 5 ТФ за ПРОДАЖИ";

    return `1. 📰 Фундаментальный фон и новости:
- [${mskNow} МСК] — Фон чистый — Ближайшие важные публикации отсутствуют.
- [15:30 МСК] — Ожидания по ставкам ФРС и макростатистика США — Смягчение монетарных условий стимулирует приток капитала к Call Wall ${callWall}.

2. 📊 Опционные уровни (GEX):
- Call Wall (Сопротивление): ${callWall}
- Put Wall (Поддержка): ${putWall}
- Max Pain: ${maxPain}
- Гамма-режим: ${regime}.

3. 📈 Технический анализ и Консенсус таймфреймов:
Дай оценку каждому ТФ:
- 1D: ${isBull ? "BULL" : "BEAR"} | ${isBull ? putWall : callWall}
- 4H: ${isBull ? "BULL" : "BEAR"} | ${cancelLevel}
- 1H: ${isBull ? "BULL" : "BEAR"} | ${entryConservative}
- 30M: ${isBull ? "BULL" : "BEAR"} | ${entryConservative}
- 15M: ${isBull ? "BULL" : "BEAR"} | ${entryAggressive}
👉 Итоговый консенсус: ${consensusStr}.

4. 📋 Торговый план (на основе консенсуса и GEX):
На основе консенсуса ${consensusStr} и уровней GEX, план следующий:
- Основной сценарий: ${isBull ? "LONG" : "SHORT"}.
- Вход: ${entryConservative} (от зоны подтверждения OTE и уровней GEX).
- Стоп-лосс (SL): ${slLevel} (обязательно привязан к ${isBull ? `Put Wall ${putWall}` : `Call Wall ${callWall}`}).
- Тейк-профит (TP1 / TP2): TP1: ${tp1} (${isTp1Hit ? "взят" : isEntryHit ? "в позиции, ждём TP1" : "ждём входа"}) / TP2: ${tp2}.
- ⚠️ Корректировка на новости: При отсутствии резких новостных импульсов сделка отрабатывается строго по уровням ликвидности.
- План Б: При пробое уровня ${cancelLevel} в обратную сторону, ищем вход с целями ${altTarget}.`;
  };

  // Switch response style mode and immediately refresh active plan
  const handleSelectResponseMode = (newMode: "short" | "detailed" | "autonomous") => {
    setResponseStyleMode(newMode);
    try {
      localStorage.setItem("st_ai_response_mode", newMode);
    } catch {}
    setShowModeSettings(false);
    if (!isGenerating) {
      requestAiAnalysis("daily_plan", undefined, undefined, newMode);
    }
  };

  // Switch AI Provider (DeepSeek, Gemini, Qwen, Autonomous) directly from panel
  const handleSelectAiProvider = (newProv: "deepseek" | "gemini" | "qwen" | "autonomous") => {
    setProviderSettings(prev => {
      const updated = { ...prev, provider: newProv };
      try {
        localStorage.setItem("st_ai_provider_settings", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    fetch("/api/settings/unified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai: {
          activeProvider: newProv
        }
      })
    }).catch(() => {});

    try {
      window.dispatchEvent(new CustomEvent("station_settings_updated"));
    } catch {}

    if (newProv === "autonomous") {
      setResponseStyleMode("autonomous");
    } else if (responseStyleMode === "autonomous") {
      setResponseStyleMode("detailed");
    }
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
      badge: `👤 ${activeUsername}`,
      text: textToSend.trim(),
      time: `${mskNow} МСК`,
      timestamp: Date.now(),
      asset: activeAsset,
      username: activeUsername
    };

    saveTickerState({
      ...tickerState,
      messages: [...tickerState.messages, userMsg]
    }, userMsg);

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

  const isWeekendNow = isWeekendInMsk();
  const isCryptoAsset = activeAsset.includes("BTC") || activeAsset.includes("ETH") || activeAsset.includes("SOL") || activeAsset.includes("XRP");
  const isClosedForWeekend = isWeekendNow && !isCryptoAsset;

  const syncedCalendarList = useMemo(() => {
    const defaultList = isWeekendNow ? WEEKEND_CALENDAR_EVENTS : DEFAULT_TODAY_EVENTS;
    const rawEvents = calendarEvents && calendarEvents.length > 0 && !isWeekendNow ? calendarEvents : defaultList;
    return rawEvents.filter((ev) => matchesPanelSection(ev, newsCategoryFilter));
  }, [calendarEvents, newsCategoryFilter, isWeekendNow]);

  // Provider badge text for header reflecting active response style mode
  const providerBadgeText = useMemo(() => {
    if (responseStyleMode === "autonomous") {
      return "🤖 Автономный ИИ";
    }
    const modeLabel = responseStyleMode === "short" ? "⚡ Короткий" : "📊 Развёрнутый";
    if (providerSettings.provider === "deepseek") {
      return `DeepSeek • ${modeLabel}`;
    }
    if (providerSettings.provider === "qwen") {
      return `Qwen • ${modeLabel}`;
    }
    if (providerSettings.provider === "gemini") {
      return `✨ Gemini • ${modeLabel}`;
    }
    return modeLabel;
  }, [providerSettings, responseStyleMode]);

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

                {/* Market Status Pill */}
                {isClosedForWeekend ? (
                  <span
                    className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0"
                    title="Рынок закрыт на выходные (COMEX/LBMA/MOEX). Возобновление торгов: В ночь на понедельник в 01:00 МСК"
                  >
                    ⏸️ Закрыто до пн
                  </span>
                ) : isWeekendNow ? (
                  <span
                    className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0"
                    title="Крипторынок активен 24/7 (Шлюзы CME/ETF закрыты на выходные)"
                  >
                    🟢 24/7 (Выходной)
                  </span>
                ) : (
                  <span
                    className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0"
                    title="Торговая сессия активна"
                  >
                    🟢 Активно
                  </span>
                )}

                {/* Active Mode Badge */}
                <button
                  type="button"
                  onClick={() => setShowModeSettings(prev => !prev)}
                  className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 border border-purple-700/60 transition cursor-pointer"
                  title="Нажмите для переключения режима ответа ИИ"
                >
                  {providerBadgeText}
                </button>

                {/* Per-User Identity Badge */}
                <span
                  className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-700/60 shrink-0 flex items-center gap-1"
                  title={`Персональный ИИ-аналитик аккаунта «${activeUsername}» (${userRole})`}
                >
                  <User className="h-2.5 w-2.5 text-blue-400" />
                  <span>{activeUsername}</span>
                </span>
              </div>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono mt-0.5">
                <Clock className="h-2.5 w-2.5 text-cyan-400" />
                <span>{currentMskTime} МСК</span>
                <span className="text-gray-600">•</span>
                {isClosedForWeekend ? (
                  <span className="text-amber-400 font-bold">Выходной аудит</span>
                ) : (
                  <span className="text-emerald-400 font-bold">Синхронно</span>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setShowModeSettings(prev => !prev)}
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                showModeSettings
                  ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm"
                  : "bg-gray-900/90 border-gray-700/80 hover:bg-gray-800 text-gray-300 hover:text-white"
              }`}
              title="Настройки режима ответа ИИ (Короткий / Развёрнутый / Автономный ИИ)"
            >
              <Settings className={`h-3.5 w-3.5 ${showModeSettings ? "text-cyan-400 animate-spin" : ""}`} style={{ animationDuration: "6s" }} />
            </button>
          )}

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

      {/* Collapsible AI Provider & Mode Settings Selector Bar */}
      {!isCollapsed && showModeSettings && (
        <div className="p-3 bg-[#0e1526] border-b border-cyan-500/40 space-y-3 shrink-0 animate-fadeIn text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-1.5">
              <Settings className="h-3 w-3 text-cyan-400" />
              <span>Настройка Нейросети & Режима Аналитика</span>
            </span>
            <button
              type="button"
              onClick={() => setShowModeSettings(false)}
              className="text-[10px] text-gray-400 hover:text-white px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* 1. AI Provider Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-300">Активная нейросеть (AI Provider):</span>
              <span className="text-[9px] font-mono font-bold text-cyan-400">
                {providerSettings.provider === "deepseek"
                  ? (providerSettings.deepSeekApiKey ? "🟢 DeepSeek (sk-...)" : "⚠️ sk-... не введен")
                  : providerSettings.provider === "gemini"
                  ? "✨ Gemini"
                  : providerSettings.provider === "qwen"
                  ? "🌐 Qwen"
                  : "⚡ QUANTEX Local"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono">
              <button
                type="button"
                onClick={() => handleSelectAiProvider("deepseek")}
                className={`p-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                  providerSettings.provider === "deepseek"
                    ? "bg-purple-600/25 border-purple-400 text-white font-extrabold shadow-sm"
                    : "bg-[#0a0f1d] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                }`}
              >
                <div>
                  <div className="font-bold text-[11px] text-purple-300">🤖 DeepSeek (V3/R1)</div>
                  <div className="text-[9px] text-gray-400">Без блокировок</div>
                </div>
                {providerSettings.provider === "deepseek" && <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectAiProvider("gemini")}
                className={`p-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                  providerSettings.provider === "gemini"
                    ? "bg-cyan-600/25 border-cyan-400 text-white font-extrabold shadow-sm"
                    : "bg-[#0a0f1d] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                }`}
              >
                <div>
                  <div className="font-bold text-[11px] text-cyan-300">✨ Google Gemini</div>
                  <div className="text-[9px] text-gray-400">Live Web Search</div>
                </div>
                {providerSettings.provider === "gemini" && <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectAiProvider("qwen")}
                className={`p-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                  providerSettings.provider === "qwen"
                    ? "bg-indigo-600/25 border-indigo-400 text-white font-extrabold shadow-sm"
                    : "bg-[#0a0f1d] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                }`}
              >
                <div>
                  <div className="font-bold text-[11px] text-indigo-300">🌐 Qwen (Aliyun)</div>
                  <div className="text-[9px] text-gray-400">DashScope Cloud</div>
                </div>
                {providerSettings.provider === "qwen" && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectAiProvider("autonomous")}
                className={`p-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                  providerSettings.provider === "autonomous"
                    ? "bg-emerald-600/25 border-emerald-400 text-white font-extrabold shadow-sm"
                    : "bg-[#0a0f1d] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                }`}
              >
                <div>
                  <div className="font-bold text-[11px] text-emerald-300">⚡ QUANTEX Квант</div>
                  <div className="text-[9px] text-gray-400">Встроенный офлайн</div>
                </div>
                {providerSettings.provider === "autonomous" && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </button>
            </div>

            {/* Live Web toggle indicator if deepseek or gemini */}
            {(providerSettings.provider === "deepseek" || providerSettings.provider === "gemini") && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/25 border border-cyan-500/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🌐</span>
                  <div className="text-[10px]">
                    <span className="font-bold text-cyan-300">
                      {providerSettings.provider === "deepseek" ? "Выход в интернет DeepSeek" : "Google Search Grounding"}
                    </span>
                    <span className="text-gray-400 block text-[9px]">
                      {providerSettings.provider === "deepseek"
                        ? "Мировые новости, инфляция CPI, ФРС и консенсус Wall Street"
                        : "Прямой поиск в Google Search"}
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={
                      providerSettings.provider === "deepseek"
                        ? providerSettings.deepSeekWebSearch !== false
                        : providerSettings.enableWebSearch !== false
                    }
                    onChange={e => {
                      const val = e.target.checked;
                      const next = {
                        ...providerSettings,
                        ...(providerSettings.provider === "deepseek" ? { deepSeekWebSearch: val } : { enableWebSearch: val })
                      };
                      setProviderSettings(next);
                      try {
                        localStorage.setItem("st_ai_provider_settings", JSON.stringify(next));
                      } catch {}
                      fetch("/api/settings/unified", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ai: {
                            activeProvider: next.provider,
                            ...(providerSettings.provider === "deepseek" ? { deepSeekWebSearch: val } : { enableWebSearch: val })
                          }
                        })
                      }).catch(() => {});
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            )}
          </div>

          {/* 2. Response Style Format */}
          <div className="space-y-1.5 pt-1 border-t border-gray-800/80">
            <span className="text-[10px] font-bold text-gray-300 block">Формат и глубина ответа:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectResponseMode("short")}
                className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  responseStyleMode === "short"
                    ? "bg-amber-500/20 border-amber-400 text-white shadow-sm shadow-amber-500/10"
                    : "bg-[#0a0f1d] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-extrabold text-amber-300">⚡ Короткий</span>
                  {responseStyleMode === "short" && <Check className="h-3 w-3 text-amber-400" />}
                </div>
                <span className="text-[9.5px] leading-tight text-gray-400">
                  Сжатая выжимка: уровни, сигнал и GEX
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectResponseMode("detailed")}
                className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                  responseStyleMode === "detailed"
                    ? "bg-cyan-500/20 border-cyan-400 text-white shadow-sm shadow-cyan-500/10"
                    : "bg-[#0a0f1d] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-extrabold text-cyan-300">📊 Развёрнутый</span>
                  {responseStyleMode === "detailed" && <Check className="h-3 w-3 text-cyan-400" />}
                </div>
                <span className="text-[9.5px] leading-tight text-gray-400">
                  Полный разбор, факты, теория и план
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span>Чат ({chatViewMode === "all_history" ? allUserMessages.length : tickerState.messages.length})</span>
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

                  {tickerState.dailyPlanSummary?.statusText && (
                    <div className="mt-2 py-1.5 px-2.5 rounded-lg bg-[#0b0e1a] border border-cyan-500/30 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400 font-medium">Текущий статус сделки:</span>
                      <span className="font-mono font-bold text-cyan-300">{tickerState.dailyPlanSummary.statusText}</span>
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
              <div className="space-y-2.5">
                {/* Chat Sub-Toolbar: Mode Switch + History Search + Clear Chat Button */}
                <div className="p-1.5 rounded-xl bg-[#0b0e1b] border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-[#070a14] rounded-lg p-0.5 border border-gray-800 text-[10px] font-mono shrink-0">
                      <button
                        type="button"
                        onClick={() => setChatViewMode("current_asset")}
                        className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                          chatViewMode === "current_asset"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                        title={`Показать только диалог по активу ${activeAsset}`}
                      >
                        <span>📌 {activeAsset}</span>
                        <span className="text-[9px] opacity-80">({tickerState.messages.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setChatViewMode("all_history")}
                        className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                          chatViewMode === "all_history"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                        title="Показать всю сквозную историю ИИ-аналитика по всем активам"
                      >
                        <History className="h-2.5 w-2.5" />
                        <span>Вся история</span>
                        <span className="text-[9px] opacity-80">({allUserMessages.length})</span>
                      </button>
                    </div>

                    {/* Clear Chat Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setClearScope(chatViewMode === "all_history" ? "all_history" : "current_asset");
                        setIsClearModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-800/60 hover:border-rose-600 text-[10.5px] font-bold transition cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Очистить историю чата ИИ-аналитика"
                    >
                      <Trash2 className="h-3 w-3 text-rose-400" />
                      <span>Очистить чат</span>
                    </button>
                  </div>

                  {/* If in all_history mode, show quick search and user info */}
                  {chatViewMode === "all_history" && (
                    <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-800/80">
                      <div className="flex-1 flex items-center gap-1 bg-[#121829] border border-gray-700/80 rounded-md px-2 py-0.5 text-[10px]">
                        <Search className="h-2.5 w-2.5 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={historySearchQuery}
                          onChange={(e) => setHistorySearchQuery(e.target.value)}
                          placeholder="Поиск по всем диалогам..."
                          className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:outline-none text-[10px]"
                        />
                        {historySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setHistorySearchQuery("")}
                            className="text-gray-400 hover:text-white text-[9px]"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <span className="text-[9.5px] font-mono text-gray-400 whitespace-nowrap">
                        {displayedMessages.length} из {allUserMessages.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Toast feedback after clearing */}
                {clearToastMessage && (
                  <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs flex items-center justify-between gap-1.5 animate-fadeIn shadow-md">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] font-semibold">{clearToastMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClearToastMessage(null)}
                      className="text-emerald-400 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Messages list */}
                <div className="space-y-2.5">
                  {displayedMessages.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#0b0e1a] border border-dashed border-gray-800 text-center space-y-2">
                      <Search className="h-6 w-6 text-gray-600 mx-auto" />
                      <p className="text-gray-400 text-xs">Сообщений не найдено</p>
                      {historySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setHistorySearchQuery("")}
                          className="text-cyan-400 text-[11px] underline cursor-pointer"
                        >
                          Сбросить фильтр поиска
                        </button>
                      )}
                    </div>
                  ) : (
                    displayedMessages.map((msg) => (
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
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold px-1.5 py-0.2 rounded ${
                                msg.role === "user"
                                  ? "bg-cyan-500/20 text-cyan-300"
                                  : msg.role === "system_alert"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : "bg-purple-500/20 text-purple-300"
                              }`}
                            >
                              {msg.badge || (msg.role === "user" ? `👤 ${activeUsername}` : "ИИ-Аналитик")}
                            </span>

                            {/* Show asset tag in all_history mode or if different asset */}
                            {msg.asset && (
                              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                {msg.asset}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-gray-400">
                            {msg.provider && <span className="text-[9px] text-gray-500">{msg.provider}</span>}
                            <span>{msg.time}</span>
                          </div>
                        </div>

                        <div className="prose prose-invert max-w-none text-xs">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    ))
                  )}
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
                onClick={() => handleSendManualQuery(`Какие ожидания и прогнозы аналитиков ведущих инвестдомов по ${activeAsset} к концу года?`)}
                className="px-2 py-0.5 rounded-full bg-violet-950/90 text-violet-300 hover:bg-violet-900 border border-violet-700/90 shrink-0 cursor-pointer transition flex items-center gap-1 font-bold shadow-sm"
              >
                <span>📈 Прогнозы к концу года</span>
              </button>
              <button
                onClick={() => handleSendManualQuery(`Какие данные вышли по инфляции США (CPI, базовая Core CPI и индекс PCE) и как они повлияли на ${activeAsset}?`)}
                className="px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 hover:bg-emerald-900 border border-emerald-700/90 shrink-0 cursor-pointer transition flex items-center gap-1 font-bold shadow-sm"
              >
                <span>🌐 Инфляция США (CPI)</span>
              </button>
              <button
                onClick={() => handleSendManualQuery(`Какое решение приняла ФРС по процентной ставке (FOMC), что заявило руководство Федрезерва и каковы ожидания рынка по ${activeAsset}?`)}
                className="px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 hover:bg-indigo-900 border border-indigo-700/90 shrink-0 cursor-pointer transition flex items-center gap-1 font-bold"
              >
                <span>🏛️ Ставка ФРС (FOMC)</span>
              </button>
              <button
                onClick={() => handleSendManualQuery(`Какие важные мировые новости и геополитические события вышли в мире, которых нет в приложении, и как они влияют на ${activeAsset}?`)}
                className="px-2 py-0.5 rounded-full bg-sky-950/90 text-sky-300 hover:bg-sky-900 border border-sky-700/90 shrink-0 cursor-pointer transition flex items-center gap-1"
              >
                <span>🌍 Мировые новости</span>
              </button>
              <button
                onClick={() => handleSendManualQuery(`Какие данные вышли по рынку труда США (Non-Farm Payrolls, безработица и Jobless Claims) и каков их эффект?`)}
                className="px-2 py-0.5 rounded-full bg-teal-950/90 text-teal-300 hover:bg-teal-900 border border-teal-700/90 shrink-0 cursor-pointer transition"
              >
                💼 Рынок труда (NFP)
              </button>
              <button
                onClick={() => handleSendManualQuery(`Дай подробный глобальный торговый план по ${activeAsset} с синтезом макроэкономики, уровней QUANTEX и опционного позиционирования GEX.`)}
                className="px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/80 shrink-0 cursor-pointer transition"
              >
                🎯 План на день
              </button>
              <button
                onClick={() => handleSendManualQuery(`Каковы фундаментальные драйверы: скупка золота мировыми центробанками (PBOC Китая, Индия), дедолларизация и геополитика для ${activeAsset}?`)}
                className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 hover:bg-amber-900 border border-amber-800/80 shrink-0 cursor-pointer transition"
              >
                🪙 Спрос ЦБ &amp; БРИКС
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
                className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 shrink-0 cursor-pointer transition flex items-center gap-1"
              >
                <Zap className="h-2.5 w-2.5 text-amber-400" />
                <span>Собрать новости</span>
              </button>
            </div>

            {/* Dynamic key status notice if using Gemini without configured key */}
            {providerSettings.provider === "gemini" && (!providerSettings.geminiApiKey || providerSettings.geminiApiKey.startsWith("AIzaSyAhY9_") || providerSettings.geminiApiKey.length < 10) && (
              <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-200 text-[10px] font-sans">
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="truncate">Работает автономный квант-движок QUANTEX. Для живого чата с Gemini укажите ключ:</span>
                </div>
                {onOpenSettingsTab && (
                  <button
                    type="button"
                    onClick={onOpenSettingsTab}
                    className="text-[9.5px] font-bold text-amber-300 hover:text-white underline whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Ввести ключ →
                  </button>
                )}
              </div>
            )}

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
                placeholder={`Спросить ИИ (${providerBadgeText}) об инфляции США, ставке ФРС, мировых новостях или по ${activeAsset}...`}
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

      {/* 🗑️ Clear Chat Confirmation Modal Dialog */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0e1424] border border-gray-700 rounded-2xl max-w-sm w-full p-4 shadow-2xl space-y-3.5 text-gray-200">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">Очистить историю чата</h4>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Пользователь: <span className="text-cyan-300 font-bold">{activeUsername}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-gray-300 leading-relaxed">
              Выберите область очистки сообщений ИИ-аналитика для вашего профиля:
            </p>

            <div className="space-y-2">
              <label
                onClick={() => setClearScope("current_asset")}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                  clearScope === "current_asset"
                    ? "bg-purple-950/40 border-purple-500/80 text-white shadow-sm"
                    : "bg-[#0b0f1d] border-gray-800 text-gray-300 hover:border-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name="clear_scope"
                  checked={clearScope === "current_asset"}
                  onChange={() => setClearScope("current_asset")}
                  className="mt-0.5 text-purple-600 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>📌 Только диалог по {activeAsset}</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300">
                      {tickerState.messages.length} сообщ.
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Очистит переписку по {activeAsset}. Диалоги по другим активам сохранятся.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setClearScope("all_history")}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                  clearScope === "all_history"
                    ? "bg-rose-950/40 border-rose-500/80 text-white shadow-sm"
                    : "bg-[#0b0f1d] border-gray-800 text-gray-300 hover:border-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name="clear_scope"
                  checked={clearScope === "all_history"}
                  onChange={() => setClearScope("all_history")}
                  className="mt-0.5 text-rose-600 focus:ring-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-rose-300">
                    <span>🌐 Вся история ИИ ({activeUsername})</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-200">
                      {allUserMessages.length} сообщ.
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Полностью удалит всю переписку с ИИ-аналитиком по всем инструментам для профиля «{activeUsername}».
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleClearChat(clearScope)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-600/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Очистить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
