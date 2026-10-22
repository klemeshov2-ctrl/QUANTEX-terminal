import React, { useState, useEffect } from "react";
import {
  Clock,
  Sparkles,
  Send,
  Bell,
  RefreshCw,
  Play,
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  Sliders,
  Flame,
  FileText,
  AlertTriangle,
  Globe,
  Coins,
  Bot,
  Copy,
  PlusCircle,
  Trash2,
  Terminal,
  Activity,
  ArrowRight,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  UserPlus,
  Check,
  RotateCcw,
  AlertCircle,
  Rss,
  ExternalLink,
  HelpCircle,
  Filter,
  TrendingUp
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ScheduleCalendarSlot {
  id: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday
  timeMsk: string;
  label: string;
  enabled: boolean;
}

interface GoldScheduleConfig {
  enabled: boolean;
  timesMsk: string[];
  timeframes: string[];
  deepSeekModel: "deepseek-chat" | "deepseek-reasoner";
  deepSeekApiKey: string;
  deepSeekApiKeyMasked?: string;
  telegramBotToken: string;
  telegramBotTokenMasked?: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  tradingPair: string;
  promptTemplate: string;
  scheduleCalendar?: ScheduleCalendarSlot[];
  scheduleCalendarEnabled: boolean;
  chartSourceMode: "tradingview_link" | "standalone_engine" | "manual_paste";
  tradingViewChartUrl: string;
  tradingViewTimeframeMode: "single_layout" | "multi_window" | "auto_query_param" | "per_timeframe";
  tradingViewUrlsByTimeframe?: {
    "15m"?: string;
    "1h"?: string;
    "4h"?: string;
  };
  autoScreenshotsEnabled: boolean;
  telegramSendPhotos: boolean;
  dxyCorrelationFilter: boolean;
  newsFilter: {
    enabled: boolean;
    telegramAlertsEnabled?: boolean;
    minImpact?: "ALL" | "MEDIUM" | "HIGH" | "CRITICAL";
    categories?: string[];
    keywords: string[];
    autoTriggerAnalysisOnNews: boolean;
    autoPollCalendar?: boolean;
    pollIntervalMinutes?: number;
    sources?: string[];
    postNewsFollowupEnabled?: boolean;
    postNewsDelayMinutes?: number;
  };
  moexGoldSynthesisEnabled?: boolean;
  moexFuturesTicker?: string;
  moexGldRubTicker?: string;
}

interface ScheduledReport {
  id: string;
  timestamp: string;
  triggerType: "SCHEDULED_9MSK" | "SCHEDULED_15MSK" | "CALENDAR_SLOT" | "MACRO_EVENT" | "POST_NEWS_FOLLOWUP" | "DUAL_MARKET_SYNTHESIS" | "MANUAL" | "WEBHOOK";
  tradingPair: string;
  timeframes: string[];
  reportText: string;
  newsContext: string[];
  macroEvent?: string;
  telegramDelivered: boolean;
  modelUsed: string;
  chartSourceUsed?: "tradingview_link" | "standalone_engine" | "manual_paste";
  chartSnapshotSvg?: string;
  postNewsStatus?: "CONFIRMED" | "REVERSED" | "INITIAL";
  followUpDelayMinutes?: number;
  dualMarketData?: any;
}

interface MacroNewsItem {
  id: string;
  time: string;
  date?: string;
  title: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "INFLATION" | "FED_RATES" | "LABOR" | "GEOPOLITICS" | "DXY" | "GOLD_MARKET";
  summary: string;
  goldEffect: string;
  source?: string;
  url?: string;
  publishedAt?: string;
}

export const DeepSeekGoldScheduler: React.FC = () => {
  const [config, setConfig] = useState<GoldScheduleConfig | null>(null);
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [news, setNews] = useState<MacroNewsItem[]>([]);
  const [activeReport, setActiveReport] = useState<ScheduledReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isPublishingNews, setIsPublishingNews] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Editable config state
  const [enabled, setEnabled] = useState(true);
  const [timesMsk, setTimesMsk] = useState(["09:00", "15:00"]);
  const [timeframes, setTimeframes] = useState(["15m", "30m", "1h", "4h"]);
  const [deepSeekModel, setDeepSeekModel] = useState<"deepseek-chat" | "deepseek-reasoner">("deepseek-chat");
  const [deepSeekApiKey, setDeepSeekApiKey] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [tradingPair, setTradingPair] = useState("XAUUSD (Золото / Доллар США)");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [autoTriggerOnNews, setAutoTriggerOnNews] = useState(true);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  
  // Chart & Screenshot Source selection (Strictly mutually exclusive)
  const [chartSourceMode, setChartSourceMode] = useState<"tradingview_link" | "standalone_engine" | "manual_paste">("tradingview_link");
  const [tradingViewChartUrl, setTradingViewChartUrl] = useState("https://www.tradingview.com/chart/?symbol=OANDA:XAUUSD");
  const [tradingViewTimeframeMode, setTradingViewTimeframeMode] = useState<"single_layout" | "multi_window" | "auto_query_param" | "per_timeframe">("single_layout");
  const [tvUrl15m, setTvUrl15m] = useState("");
  const [tvUrl1h, setTvUrl1h] = useState("");
  const [tvUrl4h, setTvUrl4h] = useState("");

  // Independent feature toggles (Full on/off control)
  const [autoScreenshotsEnabled, setAutoScreenshotsEnabled] = useState(true);
  const [telegramSendPhotos, setTelegramSendPhotos] = useState(true);
  const [scheduleCalendarEnabled, setScheduleCalendarEnabled] = useState(true);
  const [dxyCorrelationFilter, setDxyCorrelationFilter] = useState(true);
  const [showStandaloneSvgPreview, setShowStandaloneSvgPreview] = useState(false);

  // Unsaved changes & feedback states
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // TradingView Link verification state
  const [isVerifyingTvLink, setIsVerifyingTvLink] = useState(false);
  const [tvVerificationResult, setTvVerificationResult] = useState<{
    ok: boolean;
    status: number;
    responseTimeMs?: number;
    title?: string;
    message: string;
  } | null>(null);

  // Telegram test state
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // News Filter & Free Sources Collection State
  const [newsFilterEnabled, setNewsFilterEnabled] = useState(true);
  const [newsTgAlertsEnabled, setNewsTgAlertsEnabled] = useState(true);
  const [newsMinImpact, setNewsMinImpact] = useState<"ALL" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [newsCategories, setNewsCategories] = useState<string[]>([
    "FED_RATES",
    "INFLATION",
    "LABOR",
    "GEOPOLITICS",
    "DXY",
    "GOLD_MARKET"
  ]);
  const [newsSources, setNewsSources] = useState<string[]>([
    "YAHOO_GOLD",
    "YAHOO_DXY",
    "GOOGLE_NEWS",
    "INVESTING"
  ]);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [isTestingNewsAlert, setIsTestingNewsAlert] = useState(false);
  const [newsFeedback, setNewsFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const [newsActiveTab, setNewsActiveTab] = useState<"feed" | "filters" | "publish">("feed");
  const [showServerDocsModal, setShowServerDocsModal] = useState(false);

  // Post-News Follow-up Analysis State (5-15 min after news)
  const [postNewsFollowupEnabled, setPostNewsFollowupEnabled] = useState(true);
  const [postNewsDelayMinutes, setPostNewsDelayMinutes] = useState(10);
  const [pendingFollowups, setPendingFollowups] = useState<any[]>([]);
  const [isTestingFollowup, setIsTestingFollowup] = useState(false);
  const [followupTestNotice, setFollowupTestNotice] = useState<string | null>(null);

  // Dual-Market OANDA + Russian MOEX Futures Synthesis State
  const [moexGoldSynthesisEnabled, setMoexGoldSynthesisEnabled] = useState(true);
  const [dualMarketData, setDualMarketData] = useState<any | null>(null);
  const [isLoadingDualMarket, setIsLoadingDualMarket] = useState(false);
  const [isTriggeringDualAnalysis, setIsTriggeringDualAnalysis] = useState(false);
  const [dualAnalysisNotice, setDualAnalysisNotice] = useState<string | null>(null);

  // News publishing modal / fields
  const [newNewsTitle, setNewNewsTitle] = useState("");
  const [newNewsImpact, setNewNewsImpact] = useState<"CRITICAL" | "HIGH" | "MEDIUM">("CRITICAL");
  const [newNewsCategory, setNewNewsCategory] = useState<"INFLATION" | "FED_RATES" | "LABOR" | "GEOPOLITICS" | "DXY">("INFLATION");
  const [newNewsSummary, setNewNewsSummary] = useState("");
  const [newNewsGoldEffect, setNewNewsGoldEffect] = useState("");

  // Interactive calendar slots
  const [calendarSlots, setCalendarSlots] = useState<ScheduleCalendarSlot[]>([]);
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotTime, setNewSlotTime] = useState<string>("09:00");
  const [newSlotLabel, setNewSlotLabel] = useState<string>("Торговый план");
  // Change master password
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Telegram subscribers & White-List state
  interface TelegramSubscriberItem {
    chatId: string;
    username?: string;
    firstName?: string;
    status: "pending" | "approved" | "blocked";
    role: "admin" | "subscriber";
    requestedAt: string;
    approvedAt?: string;
    notes?: string;
  }
  const [subscribers, setSubscribers] = useState<TelegramSubscriberItem[]>([]);
  const [requireApproval, setRequireApproval] = useState(true);
  const [manualChatId, setManualChatId] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [subscriberFilter, setSubscriberFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "BLOCKED">("ALL");

  const fetchSubscribers = async () => {
    try {
      const res = await fetch("/api/telegram/subscribers");
      const data = await res.json();
      if (data.subscribers) {
        setSubscribers(data.subscribers);
        setRequireApproval(Boolean(data.requireApproval));
      }
    } catch {}
  };

  const handleSubscriberAction = async (chatId: string, action: "approve" | "block" | "delete") => {
    try {
      const res = await fetch("/api/telegram/subscribers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, action })
      });
      const data = await res.json();
      if (data.subscribers) {
        setSubscribers(data.subscribers);
      }
    } catch (err: any) {
      alert("Ошибка: " + err.message);
    }
  };

  const handleAddManualSubscriber = async () => {
    if (!manualChatId.trim()) {
      alert("Укажите Telegram Chat ID");
      return;
    }
    try {
      const res = await fetch("/api/telegram/subscribers/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: manualChatId.trim(),
          username: manualUsername.trim(),
          firstName: manualName.trim(),
          notes: manualNotes.trim()
        })
      });
      const data = await res.json();
      if (data.subscribers) {
        setSubscribers(data.subscribers);
        setManualChatId("");
        setManualUsername("");
        setManualName("");
        setManualNotes("");
        setShowAddUserModal(false);
      }
    } catch (err: any) {
      alert("Ошибка: " + err.message);
    }
  };

  const handleToggleApprovalMode = async (enabledVal: boolean) => {
    setRequireApproval(enabledVal);
    try {
      await fetch("/api/telegram/subscribers/toggle-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApproval: enabledVal })
      });
    } catch {}
  };

  // Helper to populate form fields from a saved server config
  const populateFormFromConfig = (c: GoldScheduleConfig) => {
    setConfig(c);
    setEnabled(c.enabled);
    setTimesMsk(c.timesMsk || ["09:00", "15:00"]);
    setTimeframes(c.timeframes || ["15m", "30m", "1h", "4h"]);
    setDeepSeekModel(c.deepSeekModel || "deepseek-chat");
    setTelegramChatId(c.telegramChatId || "");
    setTelegramEnabled(c.telegramEnabled !== undefined ? c.telegramEnabled : true);
    setTradingPair(c.tradingPair || "XAUUSD (Золото / Доллар США)");
    setPromptTemplate(c.promptTemplate || "");
    setAutoTriggerOnNews(Boolean(c.newsFilter?.autoTriggerAnalysisOnNews));
    setKeywords(c.newsFilter?.keywords || []);
    if (c.newsFilter) {
      setNewsFilterEnabled(c.newsFilter.enabled !== undefined ? c.newsFilter.enabled : true);
      setNewsTgAlertsEnabled(c.newsFilter.telegramAlertsEnabled !== undefined ? c.newsFilter.telegramAlertsEnabled : true);
      setNewsMinImpact(c.newsFilter.minImpact || "HIGH");
      setNewsCategories(c.newsFilter.categories || ["FED_RATES", "INFLATION", "LABOR", "GEOPOLITICS", "DXY", "GOLD_MARKET"]);
      setNewsSources(c.newsFilter.sources || ["YAHOO_GOLD", "YAHOO_DXY", "GOOGLE_NEWS", "INVESTING"]);
      setPostNewsFollowupEnabled(c.newsFilter.postNewsFollowupEnabled !== undefined ? c.newsFilter.postNewsFollowupEnabled : true);
      setPostNewsDelayMinutes(c.newsFilter.postNewsDelayMinutes || 10);
    }
    setMoexGoldSynthesisEnabled(c.moexGoldSynthesisEnabled !== undefined ? c.moexGoldSynthesisEnabled : true);
    if (Array.isArray(c.scheduleCalendar)) {
      setCalendarSlots(c.scheduleCalendar);
    }
    setScheduleCalendarEnabled(c.scheduleCalendarEnabled !== undefined ? c.scheduleCalendarEnabled : true);
    setChartSourceMode(c.chartSourceMode || "tradingview_link");
    setTradingViewChartUrl(c.tradingViewChartUrl || "https://www.tradingview.com/chart/?symbol=OANDA:XAUUSD");
    setTradingViewTimeframeMode(c.tradingViewTimeframeMode || "single_layout");
    if (c.tradingViewUrlsByTimeframe) {
      setTvUrl15m(c.tradingViewUrlsByTimeframe["15m"] || "");
      setTvUrl1h(c.tradingViewUrlsByTimeframe["1h"] || "");
      setTvUrl4h(c.tradingViewUrlsByTimeframe["4h"] || "");
    }
    setAutoScreenshotsEnabled(c.autoScreenshotsEnabled !== undefined ? c.autoScreenshotsEnabled : true);
    setTelegramSendPhotos(c.telegramSendPhotos !== undefined ? c.telegramSendPhotos : true);
    setDxyCorrelationFilter(c.dxyCorrelationFilter !== undefined ? c.dxyCorrelationFilter : true);
    setHasUnsavedChanges(false);
  };

  // Initial load on mount
  const loadInitialConfig = async () => {
    setIsLoading(true);
    try {
      fetchSubscribers();
      fetchDualMarketData();
      const cfgRes = await fetch("/api/gold/schedule-config");
      const cfgData = await cfgRes.json();
      if (cfgData.config) {
        populateFormFromConfig(cfgData.config);
      }
      await pollLiveReportsAndNews();
    } catch (e) {
      console.warn("Notice loading initial config:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch live dual-market OANDA + Russian MOEX data
  const fetchDualMarketData = async (forceFresh = false) => {
    setIsLoadingDualMarket(true);
    try {
      const url = forceFresh ? `/api/gold/dual-market?fresh=1&_t=${Date.now()}` : "/api/gold/dual-market";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setDualMarketData(data.data);
      }
    } catch (e) {
      console.warn("Notice fetching dual market data:", e);
    } finally {
      setIsLoadingDualMarket(false);
    }
  };

  // Run on-demand AI analysis with Dual Market + QUANTEX Script synthesis
  const handleRunDualAnalysis = async () => {
    setIsTriggeringDualAnalysis(true);
    setDualAnalysisNotice(null);
    try {
      const res = await fetch("/api/gold/run-dual-analysis", { method: "POST" });
      const data = await res.json();
      if (data.success && data.report) {
        setDualAnalysisNotice("✓ Двухрыночный анализ (OANDA + MOEX) со скриптом успешно сформирован и отправлен в Telegram!");
        setReports(prev => [data.report, ...prev]);
        setActiveReport(data.report);
      } else {
        setDualAnalysisNotice("⚠️ Ошибка формирования анализа: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (e: any) {
      setDualAnalysisNotice("⚠️ Сбой вызова: " + e.message);
    } finally {
      setIsTriggeringDualAnalysis(false);
      setTimeout(() => setDualAnalysisNotice(null), 8000);
    }
  };

  // Immediate test for post-news follow-up analysis
  const handleTestFollowup = async (scenario: "CONFIRMED" | "REVERSED") => {
    setIsTestingFollowup(true);
    setFollowupTestNotice(null);
    try {
      const res = await fetch("/api/gold/news/test-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          delayMinutes: postNewsDelayMinutes
        })
      });
      const data = await res.json();
      if (data.success && data.report) {
        setFollowupTestNotice(`✓ Тест до-анализа (${scenario === "CONFIRMED" ? "Подтверждение" : "Разворот"}) успешно доставлен в Telegram!`);
        setReports(prev => [data.report, ...prev]);
        setActiveReport(data.report);
      } else {
        setFollowupTestNotice("⚠️ Ошибка теста: " + (data.error || "Сбой отправки"));
      }
    } catch (e: any) {
      setFollowupTestNotice("⚠️ Ошибка вызова: " + e.message);
    } finally {
      setIsTestingFollowup(false);
      setTimeout(() => setFollowupTestNotice(null), 8000);
    }
  };

  // Background polling ONLY fetches reports, news, and subscribers WITHOUT touching user inputs!
  const pollLiveReportsAndNews = async () => {
    try {
      fetchSubscribers();
      const repRes = await fetch("/api/gold/reports");
      const repData = await repRes.json();
      if (repData.reports) {
        setReports(repData.reports);
        if (!activeReport && repData.reports.length > 0) {
          setActiveReport(repData.reports[0]);
        }
      }

      const newsRes = await fetch("/api/gold/news");
      const newsData = await newsRes.json();
      if (newsData.news) {
        setNews(newsData.news);
      }

      // Poll pending follow-ups
      const fuRes = await fetch("/api/gold/news/pending-followups");
      const fuData = await fuRes.json();
      if (fuData.pending) {
        setPendingFollowups(fuData.pending);
      }
    } catch (e) {
      console.warn("Notice background polling reports/news:", e);
    }
  };

  useEffect(() => {
    loadInitialConfig();
    const interval = setInterval(() => {
      pollLiveReportsAndNews();
      fetchDualMarketData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save current settings to server & disk
  const handleSaveConfig = async (): Promise<boolean> => {
    setIsSaving(true);
    setSaveSuccessNotice(null);
    try {
      const payload: any = {
        enabled,
        timesMsk,
        timeframes,
        deepSeekModel,
        telegramChatId: telegramChatId.trim(),
        telegramEnabled,
        tradingPair: tradingPair.trim(),
        promptTemplate,
        scheduleCalendar: calendarSlots,
        scheduleCalendarEnabled,
        chartSourceMode,
        tradingViewChartUrl: tradingViewChartUrl.trim(),
        tradingViewTimeframeMode,
        tradingViewUrlsByTimeframe: {
          "15m": tvUrl15m.trim(),
          "1h": tvUrl1h.trim(),
          "4h": tvUrl4h.trim()
        },
        autoScreenshotsEnabled,
        telegramSendPhotos,
        dxyCorrelationFilter,
        moexGoldSynthesisEnabled,
        newsFilter: {
          enabled: newsFilterEnabled,
          telegramAlertsEnabled: newsTgAlertsEnabled,
          minImpact: newsMinImpact,
          categories: newsCategories,
          keywords,
          autoTriggerAnalysisOnNews: autoTriggerOnNews,
          autoPollCalendar: true,
          pollIntervalMinutes: 5,
          sources: newsSources,
          postNewsFollowupEnabled,
          postNewsDelayMinutes
        }
      };

      if (deepSeekApiKey.trim().length > 0) {
        payload.deepSeekApiKey = deepSeekApiKey.trim();
      }
      if (telegramBotToken.trim().length > 0) {
        payload.telegramBotToken = telegramBotToken.trim();
      }

      const res = await fetch("/api/gold/schedule-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setDeepSeekApiKey("");
        setTelegramBotToken("");
        setHasUnsavedChanges(false);
        setSaveSuccessNotice("✅ Настройки и расписание успешно применены на сервере!");
        setTimeout(() => setSaveSuccessNotice(null), 5000);
        return true;
      }
      return false;
    } catch (e: any) {
      console.error("Save config error:", e);
      alert("Ошибка сохранения настроек: " + e.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form back to server saved values
  const handleResetChanges = () => {
    if (config) {
      populateFormFromConfig(config);
      setSaveSuccessNotice("Настройки сброшены к последним сохраненным значениям");
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    }
  };

  // Apply settings & run immediate test report
  const handleApplyAndTest = async () => {
    const saved = await handleSaveConfig();
    if (saved) {
      await handleTriggerNow("ТЕСТОВЫЙ ЗАПУСК ПОСЛЕ ИЗМЕНЕНИЯ НАСТРОЕК");
    }
  };

  // Verify TradingView link reachability
  const handleVerifyTradingViewLink = async () => {
    if (!tradingViewChartUrl.trim()) {
      setTvVerificationResult({
        ok: false,
        status: 0,
        message: "Укажите ссылку на график TradingView"
      });
      return;
    }
    setIsVerifyingTvLink(true);
    setTvVerificationResult(null);
    try {
      const res = await fetch("/api/gold/verify-tradingview-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tradingViewChartUrl.trim() })
      });
      const data = await res.json();
      setTvVerificationResult({
        ok: Boolean(data.ok),
        status: data.status || 0,
        responseTimeMs: data.responseTimeMs,
        title: data.title,
        message: data.message || (data.ok ? "Ссылка доступна" : "Ошибка доступа")
      });
    } catch (err: any) {
      setTvVerificationResult({
        ok: false,
        status: 0,
        message: "Сетевая ошибка при проверке: " + err.message
      });
    } finally {
      setIsVerifyingTvLink(false);
    }
  };

  // Test Telegram connection
  const handleTestTelegram = async () => {
    setIsTestingTg(true);
    setTgTestResult(null);
    try {
      const res = await fetch("/api/gold/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramBotToken: telegramBotToken.trim(),
          telegramChatId: telegramChatId.trim()
        })
      });
      const data = await res.json();
      if (data.ok) {
        setTgTestResult({ ok: true, message: data.message });
      } else {
        setTgTestResult({ ok: false, message: data.error || "Ошибка Telegram API" });
      }
    } catch (err: any) {
      setTgTestResult({ ok: false, message: "Сбой сети при отправке теста: " + err.message });
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleTriggerNow = async (macroEventNotice?: string) => {
    setIsTriggering(true);
    try {
      const res = await fetch("/api/gold/trigger-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType: macroEventNotice ? "MACRO_EVENT" : "MANUAL",
          macroEvent: macroEventNotice,
          tradingPair
        })
      });
      const data = await res.json();
      if (data.report) {
        setActiveReport(data.report);
        setReports(prev => [data.report, ...prev]);
      }
    } catch (e) {
      console.error("Trigger error:", e);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleRefreshNews = async () => {
    setIsRefreshingNews(true);
    setNewsFeedback(null);
    try {
      const res = await fetch("/api/gold/news/refresh", { method: "POST" });
      const data = await res.json();
      if (data.news) {
        setNews(data.news);
      }
      setNewsFeedback({ text: data.message || "Новости успешно обновлены из бесплатных источников!" });
      setTimeout(() => setNewsFeedback(null), 5000);
    } catch (e: any) {
      setNewsFeedback({ text: "Ошибка: " + e.message, isError: true });
    } finally {
      setIsRefreshingNews(false);
    }
  };

  const handleTestNewsAlert = async () => {
    setIsTestingNewsAlert(true);
    setNewsFeedback(null);
    try {
      const res = await fetch("/api/gold/news/test-alert", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setNewsFeedback({ text: "✅ " + data.message });
      } else {
        setNewsFeedback({ text: "❌ " + (data.error || "Ошибка отправки в Telegram"), isError: true });
      }
      setTimeout(() => setNewsFeedback(null), 6000);
    } catch (e: any) {
      setNewsFeedback({ text: "❌ Ошибка: " + e.message, isError: true });
    } finally {
      setIsTestingNewsAlert(false);
    }
  };

  const toggleNewsCategory = (cat: string) => {
    setNewsCategories(prev => {
      const next = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat];
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const toggleNewsSource = (srcId: string) => {
    setNewsSources(prev => {
      const next = prev.includes(srcId) ? prev.filter(s => s !== srcId) : [...prev, srcId];
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handlePublishNews = async () => {
    if (!newNewsTitle.trim()) return;
    setIsPublishingNews(true);
    try {
      const res = await fetch("/api/gold/publish-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newNewsTitle,
          impact: newNewsImpact,
          category: newNewsCategory,
          summary: newNewsSummary,
          goldEffect: newNewsGoldEffect,
          autoTrigger: autoTriggerOnNews
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewNewsTitle("");
        setNewNewsSummary("");
        setNewNewsGoldEffect("");
        pollLiveReportsAndNews();
        if (data.generatedReport) {
          setActiveReport(data.generatedReport);
        }
      }
    } catch (e) {
      console.error("Publish news error:", e);
    } finally {
      setIsPublishingNews(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addTimeframe = (tf: string) => {
    if (!timeframes.includes(tf)) {
      setTimeframes([...timeframes, tf]);
    }
  };

  const removeTimeframe = (tf: string) => {
    setTimeframes(timeframes.filter(t => t !== tf));
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  const handleToggleSlot = (slotId: string) => {
    setCalendarSlots(prev =>
      prev.map(s => (s.id === slotId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleRemoveSlot = (slotId: string) => {
    setCalendarSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const handleAddCalendarSlot = () => {
    if (!newSlotTime) return;
    const newSlot: ScheduleCalendarSlot = {
      id: "slot-" + Math.random().toString(36).substring(2, 8),
      dayOfWeek: newSlotDay,
      timeMsk: newSlotTime,
      label: newSlotLabel.trim() || `Анализ ${newSlotTime} МСК`,
      enabled: true
    };
    setCalendarSlots([...calendarSlots, newSlot]);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass || !newPass) return;
    setIsChangingPass(true);
    setPassMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassMsg({ text: "Мастер-пароль успешно обновлен!", isError: false });
        setCurrentPass("");
        setNewPass("");
      } else {
        setPassMsg({ text: data.error || "Ошибка смены пароля", isError: true });
      }
    } catch {
      setPassMsg({ text: "Сетевая ошибка при смене пароля", isError: true });
    } finally {
      setIsChangingPass(false);
    }
  };

  const dayNames = ["Воскресенье (ВС)", "Понедельник (ПН)", "Вторник (ВТ)", "Среда (СР)", "Четверг (ЧТ)", "Пятница (ПТ)", "Суббота (СБ)"];

  return (
    <div className="h-full flex flex-col bg-[#07090e] text-gray-100 overflow-hidden font-sans">
      {/* 🚀 HEADER BAR */}
      <div className="bg-[#0b0f19] border-b border-gray-800/80 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-yellow-500 shadow-lg shadow-amber-500/20 border border-amber-400/30">
            <Coins className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-sm md:text-base text-white tracking-wide uppercase">
                Авто-Анализ Золота (XAUUSD) & DeepSeek AI
              </h2>
              <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                09:00 & 15:00 МСК + Новостные Триггеры
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Мульти-таймфреймы (15m, 30m, 1h, 4h) • Отправка в Telegram • Инфляция США, CPI, ФРС • Гибкие промты
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowServerDocsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-500/30 hover:border-amber-400/60 transition cursor-pointer"
            title="Инструкция: как обновить программу и вносить доработки прямо на VPS"
          >
            <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>Инструкция для VPS</span>
          </button>

          <button
            onClick={() => handleTriggerNow()}
            disabled={isTriggering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isTriggering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isTriggering ? "Генерация отчета..." : "Сгенерировать План Сейчас"}</span>
          </button>

          <button
            onClick={pollLiveReportsAndNews}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition cursor-pointer"
            title="Обновить ленту отчетов"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* 🧭 MAIN SPLIT VIEW */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: LIVE REPORT & HISTORY (60%) */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800/80 overflow-hidden min-h-0">
          
          {/* Report header strip */}
          <div className="bg-[#0d111a] border-b border-gray-800/80 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {activeReport ? `Отчет: ${activeReport.tradingPair}` : "Текущий торговый план"}
              </span>
              {activeReport && (
                <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">
                  {new Date(activeReport.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} МСК
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeReport && (
                <button
                  onClick={() => copyToClipboard(activeReport.reportText, "report")}
                  className="flex items-center gap-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded cursor-pointer transition"
                >
                  {copiedId === "report" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedId === "report" ? "Скопировано!" : "Копировать текст"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Report Markdown Viewer */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#07090e]">
            {activeReport ? (
              <div className="space-y-4 max-w-4xl mx-auto">
                {/* Meta info tags */}
                <div className="flex flex-wrap items-center gap-2 text-xs pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span>Триггер: <b>{activeReport.triggerType}</b></span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300">
                    <Layers className="h-3.5 w-3.5 text-cyan-400" />
                    <span>ТФ: <b>{activeReport.timeframes.join(" • ")}</b></span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300">
                    <Bot className="h-3.5 w-3.5 text-purple-400" />
                    <span>Модель: <b>{activeReport.modelUsed}</b></span>
                  </div>
                  {activeReport.chartSourceUsed && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-amber-500/30 text-amber-300">
                      <Activity className="h-3.5 w-3.5 text-amber-400" />
                      <span>Источник: <b>{
                        activeReport.chartSourceUsed === "standalone_engine" 
                          ? "Встроенный QUANTEX Движок (Вариант 2)" 
                          : activeReport.chartSourceUsed === "tradingview_link"
                          ? "TradingView Ссылка (Вариант 1)"
                          : "Ручной скриншот"
                      }</b></span>
                    </div>
                  )}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                    activeReport.telegramDelivered 
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" 
                      : "bg-gray-900 text-gray-500 border-gray-800"
                  }`}>
                    <Send className="h-3.5 w-3.5" />
                    <span>{activeReport.telegramDelivered ? "Доставлено в Telegram ✅" : "Только веб-панель"}</span>
                  </div>
                </div>

                {/* Standalone Chart Snapshot (Option 2) */}
                {activeReport.chartSnapshotSvg && (
                  <div className="rounded-xl overflow-hidden border border-cyan-500/30 bg-black/80 p-2.5 shadow-2xl">
                    <div className="flex items-center justify-between px-2 pb-1.5 mb-1.5 border-b border-gray-800 text-[11px]">
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5" />
                        <span>Автономный снимок графика сервера (Встроенный движок QUANTEX SuperFusion)</span>
                      </span>
                      <span className="text-gray-400 font-mono text-[10px]">15m • 1H • 4H SMC Overlays</span>
                    </div>
                    <div 
                      className="w-full overflow-x-auto flex justify-center py-1"
                      dangerouslySetInnerHTML={{ __html: activeReport.chartSnapshotSvg }}
                    />
                  </div>
                )}

                {/* Markdown text */}
                <div className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed font-sans space-y-3">
                  <ReactMarkdown>{activeReport.reportText}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <Coins className="h-12 w-12 text-gray-700 mb-3" />
                <p className="text-sm font-semibold text-gray-400">Отчет еще не сгенерирован</p>
                <p className="text-xs text-gray-600 mt-1 max-w-md">
                  Нажмите кнопку <b>«Сгенерировать План Сейчас»</b> или дождитесь автоматического расписания (09:00 и 15:00 МСК).
                </p>
              </div>
            )}
          </div>

          {/* Past reports archive bar */}
          {reports.length > 1 && (
            <div className="bg-[#0b0f19] border-t border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 text-xs">
              <span className="text-gray-400 font-semibold shrink-0">История:</span>
              {reports.map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => setActiveReport(rep)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                    activeReport?.id === rep.id
                      ? "bg-amber-600 text-white font-bold"
                      : "bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800"
                  }`}
                >
                  <span>{new Date(rep.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                  {rep.triggerType === "DUAL_MARKET_SYNTHESIS" ? (
                    <span className="text-[10px] px-1 rounded bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40">
                      🇷🇺 OANDA+MOEX
                    </span>
                  ) : rep.triggerType === "POST_NEWS_FOLLOWUP" ? (
                    <span className={`text-[10px] px-1 rounded font-bold border ${
                      rep.postNewsStatus === "CONFIRMED"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}>
                      ⏱️ {rep.postNewsStatus === "CONFIRMED" ? "Подтверждение" : "Разворот"}
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-75">({rep.triggerType.replace("SCHEDULED_", "")})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SETTINGS, MACRO NEWS TRIGGER & PROMPT (40%) */}
        <div className="w-full lg:w-[480px] flex flex-col bg-[#090d16] overflow-y-auto p-4 md:p-5 space-y-4 shrink-0">
          
          {/* 🚀 STICKY CONFIG STATUS & ACTION BAR */}
          <div className="sticky top-0 z-20 bg-[#0d121f]/95 backdrop-blur-md border border-gray-800 rounded-xl p-3 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Управление Сервером
                </span>
                {hasUnsavedChanges ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold animate-pulse">
                    ⚠️ Есть изменения
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                    ✓ Сохранено
                  </span>
                )}
              </div>

              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={handleResetChanges}
                  className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer transition"
                  title="Сбросить к сохраненным значениям сервера"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Сбросить</span>
                </button>
              )}
            </div>

            {saveSuccessNotice && (
              <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveConfig()}
                disabled={isSaving}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md ${
                  hasUnsavedChanges
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-900/30"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                }`}
              >
                {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{isSaving ? "Сохранение..." : "Применить настройки"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyAndTest()}
                disabled={isSaving || isTriggering}
                className="py-2 px-3 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-900/20"
                title="Сохранить настройки и немедленно сгенерировать тестовый план"
              >
                {isTriggering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>Проверить запуск</span>
              </button>
            </div>
          </div>
          
          {/* 📡 SECTION 1: AUTOMATED MACRO NEWS COLLECTOR & EVENT FILTERS */}
          <div className="bg-[#0c101a] border border-amber-500/30 rounded-xl p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                  <Rss className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Сбор Новостей &amp; Фильтр Событий
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Бесплатные источники (Yahoo Finance, Google News, Investing)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                  newsFilterEnabled
                    ? (newsTgAlertsEnabled ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40")
                    : "bg-gray-800 text-gray-400 border-gray-700"
                }`}>
                  {newsFilterEnabled ? (newsTgAlertsEnabled ? "🟢 Бот активен" : "🟡 Только сбор") : "⚪ Отключено"}
                </span>
              </div>
            </div>

            {/* Quick action buttons row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* News sub-tabs */}
              <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-gray-800 text-xs">
                <button
                  type="button"
                  onClick={() => setNewsActiveTab("feed")}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    newsActiveTab === "feed" ? "bg-amber-500 text-black font-bold shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Globe className="h-3 w-3" />
                  <span>Лента ({news.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewsActiveTab("filters")}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    newsActiveTab === "filters" ? "bg-amber-500 text-black font-bold shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  <span>Фильтры</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewsActiveTab("publish")}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    newsActiveTab === "publish" ? "bg-amber-500 text-black font-bold shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Flame className="h-3 w-3" />
                  <span>Свое событие</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRefreshNews}
                  disabled={isRefreshingNews}
                  className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-medium border border-gray-700 flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                  title="Собрать свежие новости из бесплатных RSS лент прямо сейчас"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshingNews ? "animate-spin text-amber-400" : ""}`} />
                  <span>{isRefreshingNews ? "Сбор..." : "Собрать"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestNewsAlert}
                  disabled={isTestingNewsAlert}
                  className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                  title="Отправить тестовую важную новость в Telegram для проверки связи"
                >
                  <Bell className={`h-3 w-3 ${isTestingNewsAlert ? "animate-ping" : ""}`} />
                  <span>Тест в бот</span>
                </button>
              </div>
            </div>

            {/* Notification toast if any */}
            {newsFeedback && (
              <div className={`p-2 rounded-lg text-[11px] font-medium border flex items-center gap-2 ${
                newsFeedback.isError ? "bg-red-950/60 border-red-500/40 text-red-300" : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              }`}>
                {newsFeedback.isError ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                <span>{newsFeedback.text}</span>
              </div>
            )}

            {/* TAB 1: LIVE NEWS FEED STREAM */}
            {newsActiveTab === "feed" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Свежие макро-события и сигналы по XAUUSD:</span>
                  <span className="font-mono text-[10px]">Автообновление каждые 3 мин</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {news.map((item) => {
                    const isCrit = item.impact === "CRITICAL";
                    const isHigh = item.impact === "HIGH";
                    const isMed = item.impact === "MEDIUM";

                    const impactClass = isCrit
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : isHigh
                      ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                      : isMed
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-gray-800 text-gray-400 border-gray-700";

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border transition space-y-1.5 ${
                          isCrit
                            ? "bg-red-950/20 border-red-500/30 hover:border-red-500/50"
                            : isHigh
                            ? "bg-amber-950/15 border-amber-500/30 hover:border-amber-500/50"
                            : "bg-black/50 border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono border ${impactClass}`}>
                              {isCrit ? "🔴 КРИТИЧЕСКАЯ" : isHigh ? "🟠 ВЫСОКАЯ" : isMed ? "🟡 СРЕДНЯЯ" : "⚪ ИНФО"}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {item.category === "FED_RATES" ? "🏛️ ФРС" :
                               item.category === "INFLATION" ? "📈 Инфляция" :
                               item.category === "LABOR" ? "💼 Рынок труда" :
                               item.category === "DXY" ? "💵 Индекс DXY" :
                               item.category === "GEOPOLITICS" ? "🌍 Геополитика" : "🪙 Золото"}
                            </span>
                            {item.source && (
                              <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.2 rounded font-mono">
                                {item.source}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-amber-300 font-mono shrink-0">📅 {item.date && !item.time.includes(item.date) ? `${item.date} • ${item.time}` : item.time}</span>
                        </div>

                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-semibold text-white leading-snug">
                            {item.title}
                          </span>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-500 hover:text-amber-400 shrink-0 p-0.5"
                              title="Открыть первоисточник"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {item.summary && item.summary !== item.title && (
                          <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
                            {item.summary}
                          </p>
                        )}

                        <div className="text-[10px] text-emerald-400 bg-emerald-950/30 p-1.5 rounded border border-emerald-500/20 font-medium flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>{item.goldEffect}</span>
                        </div>
                      </div>
                    );
                  })}

                  {news.length === 0 && (
                    <div className="p-6 text-center text-gray-500 text-xs">
                      Новостей пока нет. Нажмите <b>«Собрать»</b> выше, чтобы загрузить свежие события.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: EVENT FILTERS & CHANNELS */}
            {newsActiveTab === "filters" && (
              <div className="space-y-3 text-xs">
                {/* Master switches */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-gray-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Сбор новостей</span>
                      <span className="text-[10px] text-gray-500">Парсинг бесплатных RSS лент</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={newsFilterEnabled}
                      onChange={(e) => {
                        setNewsFilterEnabled(e.target.checked);
                        setHasUnsavedChanges(true);
                      }}
                      className="rounded text-amber-500 focus:ring-0 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-gray-700 cursor-pointer">
                    <div>
                      <span className="font-semibold text-white block">Оповещения в Telegram</span>
                      <span className="text-[10px] text-gray-500">Авторассылка важных событий</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={newsTgAlertsEnabled}
                      onChange={(e) => {
                        setNewsTgAlertsEnabled(e.target.checked);
                        setHasUnsavedChanges(true);
                      }}
                      className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
                    />
                  </label>
                </div>

                {/* Min Impact Selector */}
                <div>
                  <label className="text-[11px] text-gray-300 font-semibold block mb-1">
                    Минимальный уровень важности для отправки в бот:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: "ALL", label: "Все подряд", desc: "Любые события" },
                      { id: "MEDIUM", label: "🟡 Средняя+", desc: "Отчетов и речь" },
                      { id: "HIGH", label: "🟠 Высокая+", desc: "Рекомендуется" },
                      { id: "CRITICAL", label: "🔴 Только Критические", desc: "FOMC / CPI / NFP" }
                    ].map(lvl => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => {
                          setNewsMinImpact(lvl.id as any);
                          setHasUnsavedChanges(true);
                        }}
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          newsMinImpact === lvl.id
                            ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                            : "bg-black/40 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        <span className="text-[11px] block">{lvl.label}</span>
                        <span className="text-[9px] text-gray-500">{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event Categories multi-select */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-gray-300 font-semibold">
                      Фильтр по категориям событий:
                    </label>
                    <span className="text-[10px] text-gray-500">Кликните для выбора</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: "FED_RATES", label: "🏛️ Ставка ФРС / FOMC" },
                      { id: "INFLATION", label: "📈 Инфляция CPI/PPI" },
                      { id: "LABOR", label: "💼 Рынок труда NFP" },
                      { id: "DXY", label: "💵 Индекс доллара DXY" },
                      { id: "GEOPOLITICS", label: "🌍 Геополитика" },
                      { id: "GOLD_MARKET", label: "🪙 Рынок золота" }
                    ].map(cat => {
                      const isActive = newsCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleNewsCategory(cat.id)}
                          className={`p-2 rounded-lg border text-[11px] font-medium transition cursor-pointer text-left flex items-center justify-between ${
                            isActive
                              ? "bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold"
                              : "bg-black/40 border-gray-800 text-gray-500 hover:border-gray-700"
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span className={`text-[10px] font-mono ${isActive ? "text-amber-400" : "text-gray-600"}`}>
                            {isActive ? "✓" : "×"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Free Sources multi-select */}
                <div>
                  <label className="text-[11px] text-gray-300 font-semibold block mb-1">
                    Бесплатные финансовые источники:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "YAHOO_GOLD", name: "Yahoo Finance (Фьючерс золота GC=F)" },
                      { id: "YAHOO_DXY", name: "Yahoo Finance (Индекс доллара DXY)" },
                      { id: "GOOGLE_NEWS", name: "Google News (Мировые новости XAUUSD)" },
                      { id: "INVESTING", name: "Investing.com (Товарные рынки)" }
                    ].map(src => {
                      const isAct = newsSources.includes(src.id);
                      return (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => toggleNewsSource(src.id)}
                          className={`p-2 rounded-lg border text-[10px] font-medium transition cursor-pointer text-left flex items-center justify-between ${
                            isAct
                              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                              : "bg-black/40 border-gray-800 text-gray-500 hover:border-gray-700"
                          }`}
                        >
                          <span className="truncate">{src.name}</span>
                          <span className={`font-mono ${isAct ? "text-emerald-400 font-bold" : "text-gray-600"}`}>
                            {isAct ? "✓" : "×"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto analysis toggle on critical news */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-gray-700 cursor-pointer">
                  <div>
                    <span className="font-semibold text-gray-200 block">Авто-аудит DeepSeek при критической новости</span>
                    <span className="text-[10px] text-gray-500">Генерация обновленного плана в бот при публикации CPI / NFP</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoTriggerOnNews}
                    onChange={(e) => {
                      setAutoTriggerOnNews(e.target.checked);
                      setHasUnsavedChanges(true);
                    }}
                    className="rounded text-amber-500 focus:ring-0 h-4 w-4"
                  />
                </label>

                {/* ⏱️ Post-News Follow-up Analysis (5-15 min after news) */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-amber-950/30 to-black border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-300 block text-xs flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        Пост-новостной до-анализ графика (через 5–15 мин)
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Автоматический пересмотр реакции цены после остывания первой импульсной свечи
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={postNewsFollowupEnabled}
                      onChange={(e) => {
                        setPostNewsFollowupEnabled(e.target.checked);
                        setHasUnsavedChanges(true);
                      }}
                      className="rounded text-amber-500 focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  {postNewsFollowupEnabled && (
                    <div className="space-y-2 pt-1 border-t border-gray-800">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-300 font-medium">Интервал до-анализа:</span>
                        <div className="flex items-center gap-1.5">
                          {[5, 10, 15].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setPostNewsDelayMinutes(m);
                                setHasUnsavedChanges(true);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer border ${
                                postNewsDelayMinutes === m
                                  ? "bg-amber-500 text-black border-amber-400 shadow"
                                  : "bg-black/50 text-gray-400 border-gray-800 hover:border-gray-700"
                              }`}
                            >
                              {m} мин
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dual-branch explanation cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                          <span className="font-bold text-emerald-300 flex items-center gap-1">
                            ✅ 1. При подтверждении тренда:
                          </span>
                          <p className="text-gray-400 leading-snug">
                            Короткий апдейт: статус удержания уровней, подтверждение CVD/Lorentz, перевод в безубыток (БУ) и фиксация на TP1.
                          </p>
                        </div>
                        <div className="p-2 rounded bg-rose-950/20 border border-rose-500/30 space-y-1">
                          <span className="font-bold text-rose-300 flex items-center gap-1">
                            🚨 2. При сломе / развороте рынка:
                          </span>
                          <p className="text-gray-400 leading-snug">
                            Полный разбор: фиксация ChoCh, ложный вынос (Sweep), переход в -GAMMA, смена сценария и новые точки входа в противоположную сторону.
                          </p>
                        </div>
                      </div>

                      {/* Test trigger buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleTestFollowup("CONFIRMED")}
                          disabled={isTestingFollowup}
                          className="flex-1 py-1.5 px-2 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[10px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {isTestingFollowup ? <RefreshCw className="h-3 w-3 animate-spin" /> : <span>⚡ Тест: Подтверждение</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestFollowup("REVERSED")}
                          disabled={isTestingFollowup}
                          className="flex-1 py-1.5 px-2 rounded bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 text-[10px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {isTestingFollowup ? <RefreshCw className="h-3 w-3 animate-spin" /> : <span>🚨 Тест: Разворот</span>}
                        </button>
                      </div>

                      {followupTestNotice && (
                        <div className="p-2 rounded bg-amber-500/20 border border-amber-500/40 text-[11px] text-amber-200 font-medium">
                          {followupTestNotice}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Unsaved changes notice for filter tab */}
                {hasUnsavedChanges && (
                  <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-[11px] text-amber-300">
                    <span>⚠️ Параметры фильтров изменены.</span>
                    <button
                      type="button"
                      onClick={() => handleSaveConfig()}
                      className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold hover:bg-amber-400 transition cursor-pointer"
                    >
                      Сохранить на сервере
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PUBLISH CUSTOM EVENT MANUALLY */}
            {newsActiveTab === "publish" && (
              <div className="space-y-2 text-xs">
                <p className="text-[11px] text-gray-400 leading-snug">
                  Ручная публикация экстренной новости (например, заявление главы центробанка или внезапный геополитический инцидент):
                </p>

                <input
                  type="text"
                  value={newNewsTitle}
                  onChange={(e) => setNewNewsTitle(e.target.value)}
                  placeholder="Заголовок: Инфляция США (CPI) вышла 3.2% против 2.9%..."
                  className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-medium"
                />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1 text-[11px]">Важность:</label>
                    <select
                      value={newNewsImpact}
                      onChange={(e) => setNewNewsImpact(e.target.value as any)}
                      className="w-full bg-black/60 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="CRITICAL">🔴 КРИТИЧЕСКАЯ</option>
                      <option value="HIGH">🟠 ВЫСОКАЯ</option>
                      <option value="MEDIUM">🟡 СРЕДНЯЯ</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1 text-[11px]">Категория:</label>
                    <select
                      value={newNewsCategory}
                      onChange={(e) => setNewNewsCategory(e.target.value as any)}
                      className="w-full bg-black/60 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="INFLATION">Инфляция (CPI/PPI)</option>
                      <option value="FED_RATES">ФРС / Ставка</option>
                      <option value="LABOR">Рынок труда / NFP</option>
                      <option value="DXY">Индекс Доллара DXY</option>
                      <option value="GEOPOLITICS">Геополитика</option>
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  value={newNewsGoldEffect}
                  onChange={(e) => setNewNewsGoldEffect(e.target.value)}
                  placeholder="Ожидаемое влияние: Давление на доллар -> импульсный лонг XAUUSD"
                  className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={handlePublishNews}
                  disabled={isPublishingNews || !newNewsTitle.trim()}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPublishingNews ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Опубликовать &amp; Отправить в Telegram</span>
                </button>
              </div>
            )}
          </div>

          {/* 🇷🇺 SECTION: DUAL-MARKET SYNTHESIS: OANDA XAUUSD + RUSSIAN MOEX GOLD FUTURES (GD / GLDRUBF) */}
          <div className="bg-gradient-to-br from-[#0e1726] via-[#0b101c] to-black border border-cyan-500/30 rounded-xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    🇷🇺 Синтез рынков: OANDA XAUUSD + Фьючерсы MOEX (GD)
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Наложение квантового скрипта QUANTEX SuperFusion v6 на мировой спот и фьючерс Мосбиржи
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={moexGoldSynthesisEnabled}
                    onChange={(e) => {
                      setMoexGoldSynthesisEnabled(e.target.checked);
                      setHasUnsavedChanges(true);
                      if (e.target.checked && !dualMarketData) {
                        fetchDualMarketData();
                      }
                    }}
                    className="rounded text-cyan-500 focus:ring-0 h-4 w-4 cursor-pointer"
                  />
                  <span className={moexGoldSynthesisEnabled ? "text-cyan-400 font-bold" : "text-gray-500"}>
                    {moexGoldSynthesisEnabled ? "Синтез активен" : "Отключено"}
                  </span>
                </label>
              </div>
            </div>

            {/* Live Ticker Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* OANDA Spot */}
              <div className="p-3 rounded-lg bg-black/60 border border-amber-500/20 space-y-1 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">🌐 OANDA Spot XAUUSD</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {dualMarketData?.oanda?.source?.includes("TradingView") ? "TradingView Stream" : (dualMarketData?.oanda?.source || "Spot Feed")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-amber-300">
                    ${dualMarketData ? dualMarketData.oanda.price.toFixed(2) : "..."}
                  </span>
                  <span className={`text-[11px] font-mono font-bold ${
                    (dualMarketData?.oanda?.changePercent || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {dualMarketData && dualMarketData.oanda.changePercent > 0 ? "+" : ""}
                    {dualMarketData ? dualMarketData.oanda.changePercent : "0.00"}%
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono space-y-0.5">
                  <div className="flex justify-between">
                    <span>Day High / Low:</span>
                    <span className="text-gray-300">${dualMarketData?.oanda?.high?.toFixed(1) || "-"} / ${dualMarketData?.oanda?.low?.toFixed(1) || "-"}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>Bid / Ask:</span>
                    <span>${dualMarketData?.oanda?.bid?.toFixed(2) || (dualMarketData ? (dualMarketData.oanda.price - 0.25).toFixed(2) : "-")} / ${dualMarketData?.oanda?.ask?.toFixed(2) || (dualMarketData ? (dualMarketData.oanda.price + 0.25).toFixed(2) : "-")}</span>
                  </div>
                </div>
              </div>

              {/* MOEX Gold Futures GD */}
              <div className="p-3 rounded-lg bg-black/60 border border-cyan-500/20 space-y-1 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                    🇷🇺 MOEX {dualMarketData?.moex?.ticker || "GDZ6"}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 font-mono">
                    {dualMarketData?.moex?.name || "FORTS"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-cyan-300">
                    ${dualMarketData ? dualMarketData.moex.priceUsd.toFixed(1) : "..."}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    (Расч: ${dualMarketData?.moex?.settlePriceUsd?.toFixed(1) || dualMarketData?.moex?.priceUsd?.toFixed(1) || "..."})
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono space-y-0.5">
                  <div className="flex justify-between">
                    <span>Оборот / Объем:</span>
                    <span className="text-gray-300 font-semibold">{dualMarketData ? (dualMarketData.moex.turnoverRub / 1e9).toFixed(2) : "-"} млрд ₽ ({dualMarketData?.moex?.volumeLots?.toLocaleString() || "-"} лот)</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>Сделок / ОИ:</span>
                    <span>{dualMarketData?.moex?.tradesCount?.toLocaleString() || "-"} сд. / {dualMarketData?.moex?.openPosition ? dualMarketData.moex.openPosition.toLocaleString() : "активен"} ОИ</span>
                  </div>
                </div>
              </div>

              {/* MOEX GLDRUBF */}
              <div className="p-3 rounded-lg bg-black/60 border border-yellow-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">🪙 GLDRUBF (Вечный)</span>
                  <span className="text-[9px] text-gray-400 font-mono">Мосбиржа</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-mono font-bold text-yellow-300">
                    {dualMarketData ? dualMarketData.moex.gldRubfPrice.toFixed(1) : "..."}
                  </span>
                  <span className="text-xs text-yellow-400/80 font-mono font-semibold">₽/грамм</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono space-y-0.5 pt-1">
                  <div className="flex justify-between">
                    <span>Эквивалент за унцию:</span>
                    <span className="text-yellow-200/90 font-semibold">
                      {dualMarketData ? Math.round(dualMarketData.moex.gldRubfPrice * 31.1035).toLocaleString() : "-"} ₽/oz
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 truncate">
                    Время Мосбиржи: {dualMarketData?.moex?.updateTimeMsk || "Торги активны"}
                  </div>
                </div>
              </div>

              {/* Basis / Spread */}
              <div className="p-3 rounded-lg bg-black/60 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">⚖️ Базис (Спред MOEX - OANDA)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 font-mono font-bold">
                    {dualMarketData?.basis?.spreadUsd && dualMarketData.basis.spreadUsd >= 0 ? "КОНТАНГО" : "БЭКВОРДАЦИЯ"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-emerald-300">
                    {dualMarketData && dualMarketData.basis.spreadUsd > 0 ? "+" : ""}
                    ${dualMarketData ? dualMarketData.basis.spreadUsd.toFixed(2) : "..."}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ({dualMarketData && dualMarketData.basis.spreadPercent > 0 ? "+" : ""}
                    {dualMarketData ? dualMarketData.basis.spreadPercent : "0.00"}%)
                  </span>
                </div>
                <div className="text-[10px] text-emerald-300/80 font-sans pt-1 leading-snug">
                  {dualMarketData?.basis?.arbitrageSignal || "Синхронизация мирового спота и российского рынка."}
                </div>
              </div>
            </div>

            {/* QUANTEX Script Overlay Metrics & CME GEX Levels */}
            <div className="p-3 rounded-lg bg-black/40 border border-gray-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-300 font-bold flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-amber-400" />
                  Показатели скрипта QUANTEX SuperFusion v6 (наложены на оба рынка):
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  Обновление: {dualMarketData?.timeMsk || "В реальном времени"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2 rounded bg-black/50 border border-gray-800">
                  <span className="text-gray-400 block">QUANTEX Тренд &amp; Сетап:</span>
                  <span className={`font-bold ${dualMarketData?.scriptIndicators?.direction === "SHORT" ? "text-rose-400" : "text-emerald-400"}`}>
                    {dualMarketData?.scriptIndicators?.mlSignal || "🟢 LONG (15m OTE)"}
                  </span>
                  <span className="text-[9px] text-gray-300 block mt-0.5 font-mono">
                    Вход OTE: ${dualMarketData?.scriptIndicators?.entryPrice?.toFixed(2) || "..."}
                  </span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-gray-800">
                  <span className="text-gray-400 block">Цели (TP1 / TP2 / TP3):</span>
                  <span className="font-bold text-sky-400 font-mono">
                    TP1: ${dualMarketData?.scriptIndicators?.tp1?.toFixed(2) || "..."}
                  </span>
                  <span className="text-[9px] text-amber-300 font-mono block mt-0.5">
                    TP2: ${dualMarketData?.scriptIndicators?.tp2?.toFixed(2) || "..."} | TP3: ${dualMarketData?.scriptIndicators?.tp3?.toFixed(2) || "..."}
                  </span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-gray-800">
                  <span className="text-gray-400 block">CME GEX Call / Max / Put:</span>
                  <span className="font-bold text-cyan-300 font-mono">
                    C: {dualMarketData?.scriptIndicators?.gex?.callWall?.toFixed(0) || "—"} | Pin: {dualMarketData?.scriptIndicators?.gex?.maxPain?.toFixed(0) || "—"} | P: {dualMarketData?.scriptIndicators?.gex?.putWall?.toFixed(0) || "—"}
                  </span>
                  <span className="text-[9px] text-rose-300/80 font-mono block mt-0.5 truncate" title={dualMarketData?.scriptIndicators?.gex?.regime}>
                    {dualMarketData?.scriptIndicators?.gex?.regime || "—"}
                  </span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-gray-800">
                  <span className="text-gray-400 block">Stop Loss / MOEX GD:</span>
                  <span className="font-bold text-rose-300 font-mono">
                    SL: ${dualMarketData?.scriptIndicators?.trailingStop?.toFixed(2) || "..."}
                  </span>
                  <span className="text-[9px] text-cyan-300 font-mono block mt-0.5">
                    MOEX TP1: ${dualMarketData?.scriptIndicators?.moexLevels?.moexTargetTp1?.toFixed(1) || "..."} (GD)
                  </span>
                </div>
              </div>

              {/* Extended Pine Script Details from TradingView */}
              {dualMarketData?.scriptIndicators?.pineScriptForecast && (
                <div className="p-2 rounded bg-gray-950/70 border border-gray-800/60 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400/90 font-semibold">QUANTEX 15m OTE (Spot):</span>
                    <span className="text-gray-300">${dualMarketData.scriptIndicators.pineScriptForecast.oteBottom.toFixed(2)} – ${dualMarketData.scriptIndicators.pineScriptForecast.oteTop.toFixed(2)}</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-400">0.50 EQ: <strong className="text-gray-200">${dualMarketData.scriptIndicators.pineScriptForecast.fib500.toFixed(2)}</strong></span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-400">Слом SL: <strong className="text-rose-400">${dualMarketData.scriptIndicators.pineScriptForecast.altBreakLevel.toFixed(2)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <span>MTF:</span>
                    <span>5м{dualMarketData.scriptIndicators.pineScriptForecast.mtfDots.m5}</span>
                    <span>15м{dualMarketData.scriptIndicators.pineScriptForecast.mtfDots.m15}</span>
                    <span>1ч{dualMarketData.scriptIndicators.pineScriptForecast.mtfDots.h1}</span>
                    <span>4ч{dualMarketData.scriptIndicators.pineScriptForecast.mtfDots.h4}</span>
                    <span>1Д{dualMarketData.scriptIndicators.pineScriptForecast.mtfDots.d1}</span>
                    <span>1Н{dualMarketData.scriptIndicators.pineScriptForecast.mtfDots.w1}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchDualMarketData(true)}
                  disabled={isLoadingDualMarket}
                  className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/90 border border-gray-700 hover:border-cyan-500/50 text-gray-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  title="Мгновенный запрос свежих спотовых котировок OANDA и фьючерсов Мосбиржи без кэша"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingDualMarket ? "animate-spin text-cyan-400" : ""}`} />
                  <span>Обновить котировки (OANDA Spot &amp; MOEX)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleRunDualAnalysis}
                disabled={isTriggeringDualAnalysis}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTriggeringDualAnalysis ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>⚡ Запустить квант-анализ OANDA + MOEX в Telegram</span>
              </button>
            </div>

            {dualAnalysisNotice && (
              <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 font-medium">
                {dualAnalysisNotice}
              </div>
            )}
          </div>

          {/* ⚙️ SECTION 2: SCHEDULE & TIMEFRAME CONFIGURATION */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-cyan-400" />
                <span>Расписание & Таймфреймы</span>
              </span>
              
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    setEnabled(e.target.checked);
                    setHasUnsavedChanges(true);
                  }}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className={enabled ? "text-emerald-400 font-bold" : "text-gray-500"}>
                  {enabled ? "Активно" : "Пауза"}
                </span>
              </label>
            </div>

            {/* Trading Pair */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Торговая пара / Актив:</label>
              <input
                type="text"
                value={tradingPair}
                onChange={(e) => {
                  setTradingPair(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">Можно указать любую пару: XAUUSD, BTCUSDT, EURUSD, USDRUB.</p>
            </div>

            {/* Schedule Times */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400 font-medium">Время авто-запуска (по МСК):</label>
                <span className="text-[10px] text-cyan-400 font-mono">ПН-ПТ</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {timesMsk.map((t, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-black/70 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shadow-sm">
                    <span>{t} МСК</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTimesMsk(timesMsk.filter((_, i) => i !== idx));
                        setHasUnsavedChanges(true);
                      }}
                      className="text-gray-400 hover:text-red-400 ml-0.5 cursor-pointer"
                      title="Удалить это время"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {/* Quick Add Times */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                {["08:30", "09:00", "13:00", "15:00", "15:30", "17:00", "20:00", "21:00"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (!timesMsk.includes(t)) {
                        setTimesMsk([...timesMsk, t].sort());
                        setHasUnsavedChanges(true);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      timesMsk.includes(t)
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                    }`}
                  >
                    +{t}
                  </button>
                ))}
              </div>

              {/* Instant Time Save & Check Bar */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-gray-800">
                <span className="text-[10px] text-gray-400">
                  {hasUnsavedChanges ? "⚠️ Есть измененное время" : "✓ Время сохранено в расписание"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSaveConfig()}
                    disabled={isSaving}
                    className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Применить и сохранить время расписания на сервере"
                  >
                    {isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    <span>Применить</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyAndTest()}
                    disabled={isSaving || isTriggering}
                    className="px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Применить настройки и сразу сгенерировать тестовый план"
                  >
                    <Play className="h-3 w-3" />
                    <span>Проверить</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Multi-Timeframes Selector */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1.5">Таймфреймы анализа скриншотов:</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {timeframes.map((tf) => (
                  <span key={tf} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                    <span>{tf}</span>
                    <button
                      type="button"
                      onClick={() => removeTimeframe(tf)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {["5m", "15m", "30m", "1h", "4h", "1D"].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => addTimeframe(tf)}
                    className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-mono transition"
                  >
                    +{tf}
                  </button>
                ))}
              </div>
            </div>

            {/* 📅 SECTION 2.2: INTERACTIVE CALENDAR SLOTS */}
            <div className="pt-2 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-400" />
                  <span>Календарные сессии по дням недели:</span>
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {calendarSlots.filter(s => s.enabled).length} активных
                </span>
              </div>

              {/* Slots List */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 mb-2">
                {calendarSlots.map((slot) => {
                  const dayLabel = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"][slot.dayOfWeek] || "ДЕНЬ";
                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition ${
                        slot.enabled
                          ? "bg-black/60 border-amber-500/30 text-gray-200"
                          : "bg-black/30 border-gray-800 text-gray-500 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSlot(slot.id)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            slot.enabled ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {dayLabel} {slot.timeMsk}
                        </button>
                        <span className="truncate text-[11px]">{slot.label}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(slot.id)}
                        className="text-gray-500 hover:text-red-400 ml-2 cursor-pointer p-0.5"
                        title="Удалить слот"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add New Slot form */}
              <div className="p-2 rounded-lg bg-black/40 border border-gray-800 space-y-2">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                  + Добавить свое время отправки:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <select
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(parseInt(e.target.value, 10))}
                    className="bg-black/80 border border-gray-700 rounded px-2 py-1 text-white text-[11px]"
                  >
                    <option value={1}>ПН (Понедельник)</option>
                    <option value={2}>ВТ (Вторник)</option>
                    <option value={3}>СР (Среда)</option>
                    <option value={4}>ЧТ (Четверг)</option>
                    <option value={5}>ПТ (Пятница)</option>
                  </select>

                  <input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="bg-black/80 border border-gray-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                  />

                  <input
                    type="text"
                    value={newSlotLabel}
                    onChange={(e) => setNewSlotLabel(e.target.value)}
                    placeholder="Название сетапа"
                    className="bg-black/80 border border-gray-700 rounded px-2 py-1 text-white text-[11px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCalendarSlot}
                  className="w-full py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-[11px] font-bold transition cursor-pointer"
                >
                  + Сохранить этот слот в расписание
                </button>
              </div>
            </div>

            {/* Model & Telegram Tokens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1 text-[11px]">Модель DeepSeek:</label>
                <select
                  value={deepSeekModel}
                  onChange={(e) => {
                    setDeepSeekModel(e.target.value as any);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-black/60 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                >
                  <option value="deepseek-chat">deepseek-chat (V3)</option>
                  <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 text-[11px]">Telegram Chat ID:</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => {
                    setTelegramChatId(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="@канал или 12345678"
                  className="w-full bg-black/60 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Telegram Bot Token & Test Dispatch */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-gray-400">Telegram Bot Token (из @BotFather):</label>
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTg}
                  className="text-[10px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                >
                  {isTestingTg ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  <span>Тест бота</span>
                </button>
              </div>
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => {
                  setTelegramBotToken(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder={config?.telegramBotTokenMasked || "123456789:ABCdef..."}
                className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
              {tgTestResult && (
                <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                  tgTestResult.ok
                    ? "bg-emerald-950/50 border border-emerald-500/40 text-emerald-200"
                    : "bg-red-950/50 border border-red-500/40 text-red-200"
                }`}>
                  {tgTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span>{tgTestResult.message}</span>
                </div>
              )}
            </div>

            {/* DeepSeek API Key update */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">
                DeepSeek API Key (из platform.deepseek.com):
              </label>
              <input
                type="password"
                value={deepSeekApiKey}
                onChange={(e) => {
                  setDeepSeekApiKey(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder={config?.deepSeekApiKeyMasked || "sk-..."}
                className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* 🏛️ SECTION 2.5: AUTONOMOUS DATA ENGINE */}
          <div className="bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-gray-900 border border-cyan-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span>Источник Данных &amp; Анализа: Встроенный Серверный Движок QUANTEX</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                100% Автономно (VPS)
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-black/60 border border-cyan-500/30 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-cyan-300">
                  Прямой сбор рыночных данных без браузеров и скриншотов
                </span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Сервер автоматически считывает спот <b>OANDA XAUUSD</b>, фьючерсы <b>MOEX GD</b>, математику индикатора <b>QUANTEX Premium v8</b> (Кумулятивная дельта CVD, Лоренцевский ML-сигнал, свипы сессий, OTE 62-79%, BOS/ChoCh), а также реальные опционные уровни <b>CME COMEX / Deribit GEX</b> (Call Wall, Put Wall, Gamma Flip, Max Pain). Данные поступают в числовом виде напрямую в контекст ИИ.
              </p>
              <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-mono">
                  Стек: Node.js + Lightweight Charts + CME/Deribit GEX + DeepSeek
                </span>
                <button
                  type="button"
                  onClick={() => setShowStandaloneSvgPreview(!showStandaloneSvgPreview)}
                  className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold transition cursor-pointer"
                >
                  {showStandaloneSvgPreview ? "Скрыть схему" : "Предпросмотр структуры QUANTEX"}
                </button>
              </div>

              {showStandaloneSvgPreview && (
                <div className="mt-2 p-2 bg-black rounded-lg border border-cyan-500/30">
                  <img 
                    src={`/api/gold/standalone-chart-svg?pair=${encodeURIComponent(tradingPair)}&t=${Date.now()}`} 
                    alt="Standalone QUANTEX Chart"
                    className="w-full rounded"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 🎛️ SECTION 2.6: INDEPENDENT TOGGLE SWITCHES */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <span>Управление автоматизацией расписания:</span>
              </span>
              <span className="text-[10px] text-gray-400">Часовой пояс UTC+3 (МСК)</span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Toggle 2: Telegram Dispatch */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-gray-800 hover:border-gray-700 cursor-pointer">
                <div>
                  <span className="font-semibold text-gray-200 block">Отправка отчетов в Telegram</span>
                  <span className="text-[10px] text-gray-500">Доставка готового торгового плана в ваш бот/канал</span>
                </div>
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
                />
              </label>

              {/* Toggle 3: Telegram Photos */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-gray-800 hover:border-gray-700 cursor-pointer">
                <div>
                  <span className="font-semibold text-gray-200 block">Прикреплять изображение графика в Telegram</span>
                  <span className="text-[10px] text-gray-500">Отправка фото вместе с текстовым отчетом</span>
                </div>
                <input
                  type="checkbox"
                  checked={telegramSendPhotos}
                  onChange={(e) => setTelegramSendPhotos(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
                />
              </label>

              {/* Toggle 4: Calendar Slots */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-gray-800 hover:border-gray-700 cursor-pointer">
                <div>
                  <span className="font-semibold text-gray-200 block">Календарные сессии (ПН-ПТ)</span>
                  <span className="text-[10px] text-gray-500">Запуск по дням недели и фиксированным часам</span>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleCalendarEnabled}
                  onChange={(e) => setScheduleCalendarEnabled(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
                />
              </label>

              {/* Toggle 5: Macro News Auto-Trigger */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-gray-800 hover:border-gray-700 cursor-pointer">
                <div>
                  <span className="font-semibold text-gray-200 block">Авто-аудит при выходе макро-новостей США</span>
                  <span className="text-[10px] text-gray-500">Внеплановый анализ при публикациях CPI, NFP, речей ФРС</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoTriggerOnNews}
                  onChange={(e) => setAutoTriggerOnNews(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
                />
              </label>

              {/* Toggle 6: DXY Correlation */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-gray-800 hover:border-gray-700 cursor-pointer">
                <div>
                  <span className="font-semibold text-gray-200 block">Учет индекса доллара (DXY) и доходностей</span>
                  <span className="text-[10px] text-gray-500">Включение макроэкономического анализа DXY в торговый план</span>
                </div>
                <input
                  type="checkbox"
                  checked={dxyCorrelationFilter}
                  onChange={(e) => setDxyCorrelationFilter(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* 👥 SECTION 2.7: MULTI-USER TELEGRAM SUBSCRIBERS & ADMIN APPROVAL */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-gray-900 border border-emerald-500/40 rounded-xl p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Многопользовательский бот &amp; Белый список (White-List)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                  Всего: {subscribers.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>+ Добавить</span>
                </button>
              </div>
            </div>

            {/* Strict Approval Toggle */}
            <div className="p-2.5 bg-black/60 rounded-lg border border-emerald-500/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Только я подтверждаю доступ новым пользователям</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
                  При включении: когда новый человек нажимает <code className="text-emerald-400">/start</code> в боте, бот не шлет ему отчеты, а отправляет заявку вам.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => handleToggleApprovalMode(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-0 h-4 w-4"
              />
            </div>

            {/* How it works info banner */}
            <div className="p-3 bg-gray-950/80 rounded-lg border border-gray-800 space-y-2 text-[11px] text-gray-300">
              <span className="font-bold text-amber-300 flex items-center gap-1">
                💡 Как предоставить доступ другим людям (2 надежных пути):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded bg-black/40 border border-gray-800">
                  <span className="font-bold text-cyan-300 block mb-0.5">Способ 1: Прямо через этого бота (Личные сообщения)</span>
                  1. Отправьте ссылку на вашего бота человеку.<br />
                  2. Человек открывает бота и нажимает <code className="text-emerald-300">/start</code>.<br />
                  3. Ему пишется «Заявка ожидает подтверждения».<br />
                  4. Вам в Telegram приходит уведомление с командой <code className="text-emerald-300">/approve_ID</code>, либо вы нажимаете <b>«Одобрить»</b> в таблице ниже.
                </div>
                <div className="p-2 rounded bg-black/40 border border-gray-800">
                  <span className="font-bold text-purple-300 block mb-0.5">Способ 2: Закрытый Telegram-канал с одобрением</span>
                  1. Создайте приватный канал/группу в Telegram.<br />
                  2. Добавьте бота администратором.<br />
                  3. В настройках канала: «Ссылки» → «Включить заявки на вступление».<br />
                  4. В поле «Telegram Chat ID» укажите ID канала. Вы лично в приложении Telegram одобряете вступление!
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubscriberFilter("ALL")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${subscriberFilter === "ALL" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400"}`}
                >
                  Все ({subscribers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriberFilter("PENDING")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${subscriberFilter === "PENDING" ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400"}`}
                >
                  ⏳ Заявки ({subscribers.filter(s => s.status === "pending").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriberFilter("APPROVED")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${subscriberFilter === "APPROVED" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400"}`}
                >
                  🟢 Одобрены ({subscribers.filter(s => s.status === "approved").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriberFilter("BLOCKED")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${subscriberFilter === "BLOCKED" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}
                >
                  🔴 Заблокированы ({subscribers.filter(s => s.status === "blocked").length})
                </button>
              </div>
              <button
                type="button"
                onClick={fetchSubscribers}
                className="text-gray-400 hover:text-white text-[10px] flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Обновить</span>
              </button>
            </div>

            {/* Modal for manual adding */}
            {showAddUserModal && (
              <div className="p-3 bg-black/90 border border-emerald-500/40 rounded-lg space-y-2">
                <span className="text-xs font-bold text-emerald-300 block">Добавить пользователя вручную (Одобрен сразу):</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={manualChatId}
                    onChange={(e) => setManualChatId(e.target.value)}
                    placeholder="Telegram Chat ID (число)*"
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-[11px]"
                  />
                  <input
                    type="text"
                    value={manualUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                    placeholder="@username (опционально)"
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-[11px]"
                  />
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Имя или заметка"
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-[11px]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] transition cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualSubscriber}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition cursor-pointer"
                  >
                    Сохранить и выдать доступ
                  </button>
                </div>
              </div>
            )}

            {/* Subscribers List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {subscribers
                .filter(s => subscriberFilter === "ALL" ? true : s.status === subscriberFilter.toLowerCase())
                .map(sub => (
                  <div key={sub.chatId} className="p-2.5 rounded-lg bg-black/60 border border-gray-800 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate">
                          {sub.firstName || "Пользователь"}
                        </span>
                        {sub.username && (
                          <span className="text-[10px] text-cyan-400 font-mono">@{sub.username}</span>
                        )}
                        {sub.role === "admin" && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                            Администратор
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                        <span>ID: {sub.chatId}</span>
                        <span>•</span>
                        <span className={
                          sub.status === "approved" ? "text-emerald-400 font-bold" :
                          sub.status === "pending" ? "text-amber-400 font-bold" : "text-red-400 font-bold"
                        }>
                          {sub.status === "approved" ? "🟢 Одобрен (Получает отчеты)" :
                           sub.status === "pending" ? "⏳ Ожидает подтверждения" : "🔴 Заблокирован"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {sub.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleSubscriberAction(sub.chatId, "approve")}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck className="h-3 w-3" />
                          <span>Одобрить</span>
                        </button>
                      )}
                      {sub.status === "approved" && sub.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleSubscriberAction(sub.chatId, "block")}
                          className="px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-[10px] transition flex items-center gap-1 cursor-pointer"
                        >
                          <UserX className="h-3 w-3" />
                          <span>Заблокировать</span>
                        </button>
                      )}
                      {sub.status === "blocked" && (
                        <button
                          type="button"
                          onClick={() => handleSubscriberAction(sub.chatId, "approve")}
                          className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck className="h-3 w-3" />
                          <span>Разблокировать</span>
                        </button>
                      )}
                      {sub.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleSubscriberAction(sub.chatId, "delete")}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition cursor-pointer"
                          title="Удалить из списка"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {subscribers.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-xs">
                  Пока нет подписчиков. Пользователи появятся здесь сразу, как только напишут /start в вашего Telegram-бота.
                </div>
              )}
            </div>
          </div>

          {/* 📝 SECTION 3: PROMPT TEMPLATE EDITOR */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-purple-400" />
                <span>Шаблон Промта DeepSeek</span>
              </span>
              <span className="text-[10px] text-purple-300 font-mono">
                {`{trading_pair}, {timeframes}, {chart_data}, {news_events}`}
              </span>
            </div>

            {/* Prompt Presets for Intraday Traders */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1.5 font-medium">Готовые пресеты промта:</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPromptTemplate(`Ты — ведущий quantitative-трейдер по золоту (XAUUSD), специализирующийся на сессионной ликвидности (London / NY Killzones), концепциях Smart Money (SMC / ICT), Volume Profile и поведении маркетмейкеров.

Проведи глубокий интрадей-анализ золота ({trading_pair}) на таймфреймах {timeframes} с учетом индикатора QUANTEX SuperFusion / Super Indicator v6, текущей динамики индекса доллара (DXY) и макроэкономического календаря США.

Входные данные графика:
{chart_data}

Макро-события и новости дня:
{news_events}

Сформируй четкий, бескомпромиссный торговый план:
1. 🏛️ МАКРОЭКОНОМИКА И DXY: динамика доллара, ключевые окна выхода статистики (15:30 / 17:00 / 21:00 МСК), фундаментальный уклон (Bullish/Bearish).
2. 📊 СТРУКТУРА ЛИКВИДНОСТИ (SMC): свип азиатского диапазона (Asian High/Low), уровни PDH/PDL, зоны Order Block, FVG, статус индикатора QUANTEX (CVD дельта + ML).
3. 🏛️ ОПЦИОННЫЙ ПРОФИЛЬ GEX (CME): режим (+GAMMA / -GAMMA), Call Wall (потолок дилеров), Put Wall (пол дилеров), Zero-Gamma Flip и Max Pain Strike.
4. 🎯 ИНТРАДЕЙ ТОРГОВЫЙ ПЛАН:
   - Сетап: LONG или SHORT
   - Точка входа (Entry Zone) с подтверждением закрытием свечи 15m
   - Защитный Stop Loss (SL) с запасом от рыночных шпилек и опорой на Put Wall
   - Цели: TP1 (50% объема + перевод в безубыток), TP2 (пул ликвидности / Call Wall), TP3 (HTF Runner)
   - Соотношение Risk/Reward (минимум 1:2.5)
5. 🛡️ УСЛОВИЯ ОТМЕНЫ (INVALIDATION) И ПЛАН Б: цена закрытия свечи, отменяющая сетап, и план разворота.
6. ⚡ РИСК-МЕНЕДЖМЕНТ: 1-1.5% риска, перевод в БУ за 5 минут до новостей США.`)}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[11px] font-medium transition cursor-pointer"
                >
                  ⚡ Интрадей SMC + GEX
                </button>

                <button
                  type="button"
                  onClick={() => setPromptTemplate(`Ты — ведущий опционный стратег CME и аналитик дилерской гаммы (GEX).
Проведи глубокий аудит инструмента {trading_pair} на таймфреймах {timeframes} с фокусом на профиль Gamma Exposure.

Входные данные:
{chart_data}

Макро-события:
{news_events}

Дай детальный анализ распределения открытого интереса и гаммы маркетмейкеров:
1. 🏛️ ОПЦИОННЫЕ СТЕНЫ ДИЛЕРОВ:
   - Call Wall: точный ценовой потолок и готовность дилеров гасить лонги продажами фьючерсов
   - Put Wall: институциональный пол и уровень защиты от падения
   - Zero-Gamma Flip Level: граница перехода в режим взрывной волатильности
   - Max Pain Pinning Target: гравитационный уровень экспирации
2. ⚡ ОЦЕНКА РЕЖИМА ГАММЫ:
   - Рынок в +GAMMA (сжатие волатильности, отскоки от стен) или в -GAMMA (взрывной трендовый импульс, пробой уровней)
3. 🎯 СИНХРОНИЗАЦИЯ С SMC & ТОРГОВЫЙ ПЛАН:
   - Согласованность точек входа и стоп-лосса с опционными стенами
   - Цели Take Profit с учетом зон фиксации институциональных позиций.`)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 text-[11px] font-medium transition cursor-pointer font-bold"
                >
                  🏰 Опционные Стены GEX (CME)
                </button>

                <button
                  type="button"
                  onClick={() => setPromptTemplate(`Ты — агрессивный скальпер и специалист по волатильности золота (XAUUSD).
Проанализируй инструмент {trading_pair} на младших таймфреймах {timeframes}.

Входные данные графика:
{chart_data}

Новости дня:
{news_events}

Дай быстрый план скальпинга на текущие 2-4 часа:
1. Текущий импульс и кумулятивная дельта (CVD) индикатора QUANTEX: доминируют ли рыночные покупки или продажи.
2. Ближайшие пулы ликвидности на снятие (Equal Highs / Equal Lows).
3. Точная точка входа на ретесте локального FVG (15m/5m).
4. Короткий стоп-лосс за экстремум импульсной свечи.
5. Быстрый тейк-профит (15-35 пунктов по золоту).`)}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/30 text-[11px] font-medium transition cursor-pointer"
                >
                  🎯 Скальп / Быстрый Импульс
                </button>

                <button
                  type="button"
                  onClick={() => setPromptTemplate(`Ты — макро-стратег сырьевого рынка. Проведи глубокий фундаментально-технический аудит золота {trading_pair} на таймфреймах {timeframes} в преддверии ключевых новостей США.

Входные данные:
{chart_data}

Новости дня:
{news_events}

Подготовь двухсторонний сценарий («Если данные лучше прогноза» / «Если данные хуже прогноза») с точными уровнями цен для выставления лимитных заявок или входа на тесте зон после первичной рыночной шпильки.`)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[11px] font-medium transition cursor-pointer"
                >
                  📊 Макро Новости (CPI/NFP)
                </button>
              </div>
            </div>

            <textarea
              rows={9}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              className="w-full bg-black/60 border border-gray-700 rounded-lg p-3 text-xs text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-purple-500"
            />

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isSaving ? "Сохранение..." : "Сохранить Настройки & Промт"}</span>
            </button>
          </div>

        </div>

      </div>

      {/* 📖 MODAL: VPS UPDATE & ONGOING CODE IMPROVEMENT MANUAL */}
      {showServerDocsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-amber-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 md:p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Инструкция: Обновление и Доработка на Сервере (VPS)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerDocsModal(false)}
                className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-gray-300 leading-relaxed">
              {/* Step 1: Quick Update */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                <span className="font-bold text-amber-300 text-xs block">
                  🚀 Вариант 1: Быстрое обновление на работающем сервере (за 1 команду)
                </span>
                <p className="text-[11px] text-gray-300">
                  Если вы внесли изменения в репозиторий GitHub или скопировали новые файлы проекта на сервер, запустите автоматический скрипт:
                </p>
                <div className="bg-black/80 rounded-lg p-2.5 font-mono text-[11px] text-amber-200 border border-gray-800 flex items-center justify-between">
                  <code>./update.sh</code>
                  <button
                    onClick={() => copyToClipboard("./update.sh", "cmd1")}
                    className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px]"
                  >
                    {copiedId === "cmd1" ? "Скопировано!" : "Копировать"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  Скрипт сам стянет обновления из git, установит зависимости, скомпилирует проект с защитой памяти и плавно перезапустит PM2.
                </p>
              </div>

              {/* Step 2: Live development on server */}
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <span className="font-bold text-cyan-300 text-xs block">
                  🛠️ Вариант 2: Как «допиливать» и улучшать приложение прямо на сервере
                </span>
                <p className="text-[11px] text-gray-300">
                  Вы можете легко вносить дополнения прямо на VPS в режиме реального времени:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                  <li>
                    <b>Подключение редактором:</b> Откройте VS Code на компьютере → установите расширение <b>Remote - SSH</b> → подключитесь к вашему серверу (<code className="text-amber-300">root@179.254.115.115</code>) и редактируйте любые файлы как на локальном ПК.
                  </li>
                  <li>
                    <b>Редактирование через терминал:</b> Либо открывайте файлы прямо в консоли через <code className="text-amber-300">nano server.ts</code> или <code className="text-amber-300">nano src/components/...</code>.
                  </li>
                  <li>
                    <b>Режим «живой» разработки (Hot Reload):</b> Если хотите видеть изменения мгновенно без пересборки:
                    <div className="bg-black/80 rounded-lg p-2 my-1 font-mono text-[10px] text-cyan-200 border border-gray-800">
                      <code>npm run dev</code>
                    </div>
                  </li>
                  <li>
                    <b>После внесения улучшений:</b> Запустите <code className="text-amber-300">./update.sh</code> или <code className="text-amber-300">npm run build &amp;&amp; pm2 restart ecosystem.config.cjs</code>.
                  </li>
                </ol>
              </div>

              {/* Persistence note */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <span className="font-bold text-emerald-300 text-xs block">
                  💾 Полная сохранность настроек и базы пользователей
                </span>
                <p className="text-[11px] text-gray-300">
                  Все измененные вами часы расписания, токен Telegram-бота, список одобренных подписчиков и история новостей сохраняются на жестком диске сервера в папке <code className="text-emerald-400">./data/</code>:
                </p>
                <ul className="list-disc list-inside text-[10px] text-gray-400 space-y-0.5 font-mono">
                  <li>./data/gold-schedule-config.json — ваши часы расписания, фильтры и ссылки</li>
                  <li>./data/telegram-subscribers.json — база одобренных подписчиков бота</li>
                  <li>./data/sent-news-ids.json — история отправленных новостей (исключает дубли)</li>
                </ul>
                <p className="text-[10px] text-emerald-400 font-semibold mt-1">
                  ✓ При перезагрузке VPS или обновлении кода эти данные никогда не сбрасываются.
                </p>
              </div>

              {/* Useful PM2 commands */}
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
                <span className="font-bold text-gray-200 text-xs block">
                  📊 Полезные команды для контроля сервера:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-black/60 p-2 rounded border border-gray-800">
                    <span className="text-amber-400 block font-bold">pm2 status</span>
                    <span className="text-gray-400">Статус процесса и потребление памяти</span>
                  </div>
                  <div className="bg-black/60 p-2 rounded border border-gray-800">
                    <span className="text-amber-400 block font-bold">pm2 logs</span>
                    <span className="text-gray-400">Живой лог сервера и запросов к боту</span>
                  </div>
                  <div className="bg-black/60 p-2 rounded border border-gray-800">
                    <span className="text-amber-400 block font-bold">pm2 restart all</span>
                    <span className="text-gray-400">Перезапустить приложение</span>
                  </div>
                  <div className="bg-black/60 p-2 rounded border border-gray-800">
                    <span className="text-amber-400 block font-bold">pm2 monit</span>
                    <span className="text-gray-400">Графический монитор загрузки CPU/RAM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowServerDocsModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer"
              >
                Понятно, закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
