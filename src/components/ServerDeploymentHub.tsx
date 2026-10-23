import React, { useState, useEffect, useRef } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Terminal,
  Send,
  Bell,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Download,
  RefreshCw,
  ExternalLink,
  Flame,
  Bot,
  Zap,
  Radio,
  FileCode,
  Globe,
  Lock,
  AlertTriangle,
  Play,
  Trash2,
  ArrowUpRight,
  Sliders,
  Database,
  Code2,
  GitBranch,
  GitPullRequest,
  GitCommit,
  FolderGit2,
  Check,
  ArrowDownCircle
} from "lucide-react";

interface ServerStatusData {
  status: string;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  hostname: string;
  cpusCount: number;
  cpuModel: string;
  loadAvg: number[];
  memory: {
    processRssMb: number;
    processHeapUsedMb: number;
    processHeapTotalMb: number;
    systemTotalMb: number;
    systemUsedMb: number;
    systemFreeMb: number;
    systemUsagePercent: number;
  };
  services: {
    restApi: string;
    geminiAi: string;
    telegramBot: string;
    webhookListener: string;
    pdfGenerator: string;
  };
  signalsCount: number;
  logsCount: number;
  timestamp: string;
}

interface ServerLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "WEBHOOK" | "AI_AUDIT";
  message: string;
  details?: any;
}

interface WebhookSignal {
  id: string;
  receivedAt: string;
  ticker: string;
  action: "BUY" | "SELL" | "ALERT" | "INFO";
  price?: number;
  timeframe?: string;
  sl?: number;
  tp1?: number;
  tp2?: number;
  comment?: string;
  indicator?: string;
  aiVerdict?: {
    approved: boolean;
    confidence: number;
    notes: string;
  };
  telegramDispatched?: boolean;
}

export default function ServerDeploymentHub() {
  const [activeTab, setActiveTab] = useState<"overview" | "git_update" | "deploy" | "webhook" | "env" | "terminal">("overview");
  const [serverStatus, setServerStatus] = useState<ServerStatusData | null>(null);
  const [serverLogs, setServerLogs] = useState<ServerLog[]>([]);
  const [signals, setSignals] = useState<WebhookSignal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [logFilter, setLogFilter] = useState<string>("ALL");

  // Git & GitHub Auto-Update State
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [isCheckingGit, setIsCheckingGit] = useState(false);
  const [isPullingGit, setIsPullingGit] = useState(false);
  const [gitOutputLogs, setGitOutputLogs] = useState<string[]>([]);
  const [gitPullSuccess, setGitPullSuccess] = useState<boolean | null>(null);
  const [gitInitUrl, setGitInitUrl] = useState("");
  const [isInitializingGit, setIsInitializingGit] = useState(false);
  const [stashBeforePull, setStashBeforePull] = useState(true);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [autoRebuild, setAutoRebuild] = useState(true);

  // Webhook Test State
  const [testTicker, setTestTicker] = useState("XAUUSD");
  const [testAction, setTestAction] = useState<"BUY" | "SELL">("BUY");
  const [testPrice, setTestPrice] = useState("2748.50");
  const [testSl, setTestSl] = useState("2739.00");
  const [testTp1, setTestTp1] = useState("2762.00");
  const [testTp2, setTestTp2] = useState("2775.00");
  const [testTf, setTestTf] = useState("15m");
  const [testIndicator, setTestIndicator] = useState("QUANTEX Super Indicator v6");
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<any | null>(null);

  // Telegram test state
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [isSendingTgTest, setIsSendingTgTest] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<any | null>(null);

  // Deploy configuration generator state
  const [deployMethod, setDeployMethod] = useState<"docker" | "pm2" | "bash" | "systemd">("docker");
  const [customDomain, setCustomDomain] = useState("st-indicator.myvps.com");
  const [customPort, setCustomPort] = useState("3000");
  const [webhookSecretKey, setWebhookSecretKey] = useState("st_secret_tradingview_token");
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch Git status
  const fetchGitStatus = async () => {
    try {
      setIsCheckingGit(true);
      const res = await fetch("/api/system/git-status");
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
      }
    } catch (e: any) {
      console.warn("Git status notice:", e.message);
    } finally {
      setIsCheckingGit(false);
    }
  };

  // Run Git pull and auto-update
  const handleExecuteGitPull = async () => {
    try {
      setIsPullingGit(true);
      setGitPullSuccess(null);
      setGitOutputLogs(["[Клиент] Запрос на обновление через Git отправлен на сервер..."]);
      const res = await fetch("/api/system/git-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stashLocal: stashBeforePull,
          autoInstall: autoInstallDeps,
          autoBuild: autoRebuild
        })
      });
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        setGitOutputLogs(data.logs);
      }
      if (res.ok && data.success) {
        setGitPullSuccess(true);
        fetchGitStatus();
      } else {
        setGitPullSuccess(false);
        if (data.error && (!data.logs || data.logs.length === 0)) {
          setGitOutputLogs([`[Ошибка] ${data.error}`]);
        }
      }
    } catch (err: any) {
      setGitPullSuccess(false);
      setGitOutputLogs(prev => [...prev, `[Клиент] Ошибка связи с сервером: ${err.message}`]);
    } finally {
      setIsPullingGit(false);
    }
  };

  // Bind Git repository if needed
  const handleInitGitRepo = async () => {
    if (!gitInitUrl.trim()) return;
    try {
      setIsInitializingGit(true);
      const res = await fetch("/api/system/git-init-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: gitInitUrl.trim() })
      });
      const data = await res.json();
      if (data.logs) {
        setGitOutputLogs(data.logs);
      }
      if (res.ok && data.success) {
        fetchGitStatus();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsInitializingGit(false);
    }
  };

  // Fetch status and ping
  const fetchStatus = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/server/status");
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        setServerStatus(data);
        setPingMs(Math.round(performance.now() - start));
      }
    } catch (e) {
      console.warn("Server status sync notice:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/server/logs?limit=150");
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.logs) {
          setServerLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn("Server logs sync notice:", e);
    }
  };

  // Fetch signals
  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/webhook/signals");
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.signals) {
          setSignals(data.signals);
        }
      }
    } catch (e) {
      console.warn("Server signals sync notice:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    fetchSignals();
    fetchGitStatus();

    const statusInterval = setInterval(() => {
      fetchStatus();
      fetchSignals();
    }, 10000);

    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (!autoRefreshLogs) return;
    const logsInterval = setInterval(fetchLogs, 3000);
    return () => clearInterval(logsInterval);
  }, [autoRefreshLogs]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const clearLogs = async () => {
    try {
      await fetch("/api/server/logs/clear", { method: "POST" });
      setServerLogs([]);
    } catch (e) {
      console.error("Failed to clear logs", e);
    }
  };

  const clearSignals = async () => {
    try {
      await fetch("/api/webhook/clear-signals", { method: "POST" });
      setSignals([]);
    } catch (e) {
      console.error("Failed to clear signals", e);
    }
  };

  const handleSendTestWebhook = async () => {
    setIsSendingWebhook(true);
    setWebhookResult(null);
    try {
      const payload = {
        ticker: testTicker,
        action: testAction,
        price: parseFloat(testPrice) || 2748.5,
        sl: parseFloat(testSl) || 2739.0,
        tp1: parseFloat(testTp1) || 2762.0,
        tp2: parseFloat(testTp2) || 2775.0,
        timeframe: testTf,
        indicator: testIndicator,
        comment: `Тестовый сигнал из панели развертывания QUANTEX (${testTicker} ${testAction})`,
        time: new Date().toISOString()
      };

      const res = await fetch(`/api/webhook/tradingview?token=${encodeURIComponent(webhookSecretKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setWebhookResult(data);
      fetchSignals();
      fetchLogs();
      fetchStatus();
    } catch (err: any) {
      setWebhookResult({ error: err.message });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  const handleSendTelegramTest = async () => {
    setIsSendingTgTest(true);
    setTgTestResult(null);
    try {
      const res = await fetch("/api/server/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: tgBotToken.trim() || undefined,
          chatId: tgChatId.trim() || undefined
        })
      });
      const data = await res.json();
      setTgTestResult(data);
      fetchLogs();
    } catch (err: any) {
      setTgTestResult({ error: err.message });
    } finally {
      setIsSendingTgTest(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d > 0 ? `${d}д ` : ""}${h > 0 ? `${h}ч ` : ""}${m}м ${s}с`;
  };

  // Generate current webhook URL
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const webhookUrl = `${currentOrigin}/api/webhook/tradingview?token=${webhookSecretKey}`;

  // Generated .env content
  const generatedEnvContent = `# QUANTEX Indicator Studio Production Environment
NODE_ENV=production
PORT=${customPort || 3000}
HOST=0.0.0.0
GEMINI_API_KEY="${geminiApiKeyInput || ""}"
TELEGRAM_BOT_TOKEN="${tgBotToken || ""}"
TELEGRAM_CHAT_ID="${tgChatId || ""}"
WEBHOOK_SECRET="${webhookSecretKey || "st_secret_tradingview_token"}"
MAX_BODY_LIMIT="50mb"
`;

  return (
    <div className="h-full flex flex-col bg-[#07090e] text-gray-100 overflow-hidden font-sans">
      {/* 🚀 TOP BANNER / STATUS STRIP */}
      <div className="bg-[#0b0f19] border-b border-gray-800/80 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Server className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-sm md:text-base text-white tracking-wide uppercase">
                Центр Развертывания & Серверного Управления
              </h2>
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                ONLINE
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              VPS / Docker / PM2 / Webhook Шлюз TradingView & Автоматический ИИ-Аудит Сигналов
            </p>
          </div>
        </div>

        {/* Quick Metrics Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-lg">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-gray-400">Ping:</span>
            <span className="font-mono font-bold text-white">{pingMs !== null ? `${pingMs} мс` : "..."}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-lg">
            <HardDrive className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-gray-400">Node RAM:</span>
            <span className="font-mono font-bold text-amber-300">
              {serverStatus?.memory ? `${serverStatus.memory.processHeapUsedMb} МБ` : "..."}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-lg">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span className="text-gray-400">Сигналы:</span>
            <span className="font-mono font-bold text-emerald-300">{signals.length}</span>
          </div>

          <button
            onClick={() => {
              fetchStatus();
              fetchLogs();
              fetchSignals();
            }}
            disabled={isLoading}
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
            title="Обновить метрики"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {/* 🧭 SUB-NAVIGATION TABS */}
      <div className="bg-[#090d16] border-b border-gray-800/80 px-4 md:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Мониторинг Сервера</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("git_update");
              fetchGitStatus();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "git_update"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <FolderGit2 className="h-3.5 w-3.5 text-purple-400" />
            <span>🔄 Обновление через GitHub</span>
            <span className="text-[10px] bg-purple-500/30 text-purple-200 border border-purple-400/30 px-1 py-0.2 rounded font-mono font-bold">
              Git Pull
            </span>
          </button>

          <button
            onClick={() => setActiveTab("deploy")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "deploy"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            <span>1-Click Развертывание (VPS)</span>
          </button>

          <button
            onClick={() => setActiveTab("webhook")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "webhook"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            <span>TradingView Webhook & Telegram</span>
            {signals.length > 0 && (
              <span className="text-[10px] bg-emerald-500 text-black font-bold px-1.5 py-0.2 rounded-full">
                {signals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("env")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "env"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Sliders className="h-3.5 w-3.5 text-purple-400" />
            <span>Конфигуратор .env</span>
          </button>

          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "terminal"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-amber-400" />
            <span>Логи & Консоль</span>
            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.2 rounded">
              {serverLogs.length}
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Production Ready • Node.js {serverStatus?.nodeVersion || "v22"} • Linux/Docker</span>
        </div>
      </div>

      {/* 🚀 TAB 1: OVERVIEW & HEALTH METRICS */}
      {activeTab === "overview" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Uptime Card */}
            <div className="bg-gray-900/70 border border-gray-800 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Время Работы (Uptime)</span>
                <Server className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="font-mono text-xl font-bold text-white">
                {serverStatus ? formatUptime(serverStatus.uptimeSeconds) : "Загрузка..."}
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                <span>Сервис стабилен и принимает запросы</span>
              </div>
            </div>

            {/* RAM Card */}
            <div className="bg-gray-900/70 border border-gray-800 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Использование RAM</span>
                <HardDrive className="h-4 w-4 text-purple-400" />
              </div>
              <div className="font-mono text-xl font-bold text-purple-300">
                {serverStatus?.memory ? `${serverStatus.memory.processHeapUsedMb} / ${serverStatus.memory.processHeapTotalMb} МБ` : "..."}
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: serverStatus?.memory
                      ? `${Math.min(100, Math.round((serverStatus.memory.processHeapUsedMb / serverStatus.memory.processHeapTotalMb) * 100))}%`
                      : "20%"
                  }}
                />
              </div>
              <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
                <span>Системная RAM: {serverStatus?.memory?.systemUsedMb || 0} МБ</span>
                <span>Всего: {serverStatus?.memory?.systemTotalMb || 0} МБ</span>
              </div>
            </div>

            {/* CPU & Architecture */}
            <div className="bg-gray-900/70 border border-gray-800 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Процессор & ОС</span>
                <Cpu className="h-4 w-4 text-amber-400" />
              </div>
              <div className="font-mono text-base font-bold text-white truncate">
                {serverStatus ? `${serverStatus.platform} (${serverStatus.arch})` : "Linux x64"}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Ядер: <span className="text-amber-300 font-mono font-bold">{serverStatus?.cpusCount || 1}</span> • Node:{" "}
                <span className="text-cyan-300 font-mono font-bold">{serverStatus?.nodeVersion || "v22"}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                {serverStatus?.cpuModel || "Standard Cloud CPU"}
              </div>
            </div>

            {/* Webhook Activity */}
            <div className="bg-gray-900/70 border border-gray-800 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">TradingView Webhook</span>
                <Radio className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="font-mono text-xl font-bold text-emerald-300">
                {signals.length} <span className="text-xs text-gray-400 font-normal">сигналов в памяти</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Слушатель активен на 3000 порту</span>
              </div>
            </div>
          </div>

          {/* Microservices Matrix */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span>Статус Серверных Подсистем и Шлюзов</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-950/60 rounded-lg border border-gray-800/80 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Express REST & API Backend</div>
                  <div className="text-[11px] text-gray-400">Порт {serverStatus?.hostname ? `3000 (${serverStatus.hostname})` : "3000"}</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">● Шлюзы /api/* активны</div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-lg border border-gray-800/80 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Gemini 3.8 Flash Multimodal AI</div>
                  <div className="text-[11px] text-gray-400">Анализ скриншотов и аудит сигналов</div>
                  <div className="text-[10px] text-cyan-400 font-semibold mt-1">
                    {serverStatus?.services.geminiAi === "active" ? "● Подключен к Google AI Studio" : "● Автономный квант-модуль QUANTEX"}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-lg border border-gray-800/80 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">TradingView Webhook Listener</div>
                  <div className="text-[11px] text-gray-400">Прием JSON/Текст алертов от индикаторов</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">● /api/webhook/tradingview</div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-lg border border-gray-800/80 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Telegram Alert Relay</div>
                  <div className="text-[11px] text-gray-400">Мгновенный ретранслятор сигналов в бот</div>
                  <div className="text-[10px] text-blue-400 font-semibold mt-1">
                    {serverStatus?.services.telegramBot === "configured" ? "● Бот настроен в .env" : "○ Ожидает токен бота"}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-lg border border-gray-800/80 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                  <FileCode className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">PDF Генератор Руководств</div>
                  <div className="text-[11px] text-gray-400">Сборка цветных мануалов по индикаторам</div>
                  <div className="text-[10px] text-purple-400 font-semibold mt-1">● Бинарный генератор готов</div>
                </div>
              </div>

              <div className="p-3 bg-gray-950/60 rounded-lg border border-gray-800/80 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Pine Script v6 Core</div>
                  <div className="text-[11px] text-gray-400">SuperFusion, NeuraLib, Super & MOEX</div>
                  <div className="text-[10px] text-amber-400 font-semibold mt-1">● Полная совместимость</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Setup Card */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-purple-950/30 border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <span>Готовы перенести студию на свой VPS или VDS сервер?</span>
              </h4>
              <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                Скрипт <code className="text-cyan-300 font-mono bg-black/40 px-1.5 py-0.5 rounded border border-gray-800">deploy.sh</code> и готовый <code className="text-blue-300 font-mono bg-black/40 px-1.5 py-0.5 rounded border border-gray-800">docker-compose.yml</code> позволяют запустить независимый круглосуточный сервер со шлюзом сигналов за 2 минуты.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("deploy")}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>Открыть Мастер Развертывания</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 🔄 TAB: GITHUB AUTO-UPDATE & REPO MANAGEMENT */}
      {activeTab === "git_update" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <div>
              <h3 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-purple-400" />
                <span>Обновление программы на сервере через GitHub</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Git Pull Engine
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Автоматическая синхронизация с репозиторием, установка зависимостей и пересборка сервера в 1 клик
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchGitStatus}
                disabled={isCheckingGit}
                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isCheckingGit ? "animate-spin text-purple-400" : ""}`} />
                <span>Проверить статус</span>
              </button>
            </div>
          </div>

          {/* Repo Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Branch & Remote */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                  <GitBranch className="h-4 w-4 text-purple-400" />
                  <span>Ветка и Репозиторий</span>
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  gitStatus?.isGitRepo 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                  {gitStatus?.isGitRepo ? "Git Подключен" : "Автономно"}
                </span>
              </div>
              <div className="font-mono text-sm font-bold text-white flex items-center gap-2">
                <span>Ветка:</span>
                <span className="text-purple-300">{gitStatus?.currentBranch || "main"}</span>
              </div>
              <div className="text-[11px] text-gray-400 font-mono truncate" title={gitStatus?.remoteUrl || "Origin"}>
                Remote: {gitStatus?.remoteUrl || "https://github.com/..."}
              </div>
            </div>

            {/* Card 2: Last Commit */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                  <GitCommit className="h-4 w-4 text-cyan-400" />
                  <span>Последний коммит (HEAD)</span>
                </span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded">
                  {gitStatus?.lastCommit?.hash || "latest"}
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-200 line-clamp-1" title={gitStatus?.lastCommit?.message || "Актуальная версия"}>
                {gitStatus?.lastCommit?.message || "Кодовая база синхронизирована"}
              </div>
              <div className="text-[11px] text-gray-400">
                {gitStatus?.lastCommit ? `${gitStatus.lastCommit.author} • ${gitStatus.lastCommit.date}` : "Скрипт update.sh готов"}
              </div>
            </div>

            {/* Card 3: Security & Data */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Защита настроек</span>
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  .gitignore OK
                </span>
              </div>
              <div className="text-xs text-gray-300">
                Файл <code className="text-amber-300 font-mono bg-black/40 px-1 py-0.5 rounded">.env</code> и папка <code className="text-amber-300 font-mono bg-black/40 px-1 py-0.5 rounded">data/</code> защищены и не затираются при обновлении.
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span>Скрипт update.sh исполняемый (+x)</span>
              </div>
            </div>
          </div>

          {/* 1-Click Update Controls */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/30 border border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Play className="h-4 w-4 text-purple-400" />
                  <span>Запуск обновления сервера в 1 клик</span>
                </h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  Сервер выполнит <code className="text-purple-300 font-mono">git pull</code>, обновит зависимости и пересоберет бандл в фоне
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecuteGitPull}
                disabled={isPullingGit}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <ArrowDownCircle className={`h-4 w-4 ${isPullingGit ? "animate-bounce" : ""}`} />
                <span>{isPullingGit ? "Выполняется обновление..." : "🚀 Обновить с GitHub сейчас"}</span>
              </button>
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-800 text-xs">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={stashBeforePull}
                  onChange={(e) => setStashBeforePull(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-0 cursor-pointer"
                />
                <span>Сохранять локальные правки (git stash)</span>
              </label>

              <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoInstallDeps}
                  onChange={(e) => setAutoInstallDeps(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-0 cursor-pointer"
                />
                <span>Установить новые пакеты (npm install)</span>
              </label>

              <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRebuild}
                  onChange={(e) => setAutoRebuild(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-0 cursor-pointer"
                />
                <span>Скомпилировать проект (npm run build)</span>
              </label>
            </div>
          </div>

          {/* Live Terminal Log Box */}
          <div className="bg-black/80 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-gray-900/90 px-4 py-2 border-b border-gray-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-purple-400" />
                <span className="font-mono font-bold text-gray-200">Консольный лог выполнения обновления</span>
                {gitPullSuccess === true && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    УСПЕХ
                  </span>
                )}
                {gitPullSuccess === false && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                    ОШИБКА
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setGitOutputLogs([])}
                className="text-[11px] text-gray-400 hover:text-white transition cursor-pointer"
              >
                Очистить лог
              </button>
            </div>

            <div className="p-4 font-mono text-xs text-gray-300 space-y-1.5 max-h-64 overflow-y-auto selection:bg-purple-500/40">
              {gitOutputLogs.length === 0 ? (
                <div className="text-gray-500 italic">
                  Лог пуст. Нажмите «🚀 Обновить с GitHub сейчас» или выполните команду в консоли сервера.
                </div>
              ) : (
                gitOutputLogs.map((logLine, idx) => (
                  <div 
                    key={idx}
                    className={`leading-relaxed ${
                      logLine.includes("✅") ? "text-emerald-400 font-bold" :
                      logLine.includes("❌") || logLine.includes("Ошибка") ? "text-rose-400 font-bold" :
                      logLine.includes("🚀") || logLine.includes("📥") ? "text-purple-300 font-semibold" :
                      "text-gray-300"
                    }`}
                  >
                    {logLine}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick SSH Terminal Commands Guide */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
            <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
              <Code2 className="h-4 w-4 text-cyan-400" />
              <span>Команды для обновления через SSH-терминал сервера</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Option A */}
              <div className="p-3.5 bg-gray-950/70 border border-gray-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300">Вариант 1: Скрипт update.sh (Рекомендуется)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("./update.sh");
                      setCopiedItem("update_sh");
                      setTimeout(() => setCopiedItem(null), 2000);
                    }}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition cursor-pointer"
                    title="Копировать"
                  >
                    {copiedItem === "update_sh" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <pre className="bg-black/60 p-2 rounded border border-gray-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                  ./update.sh
                </pre>
                <p className="text-gray-400 text-[11px]">
                  Автоматически сделает git pull, установит новые зависимости, пересоберет проект и перезапустит PM2.
                </p>
              </div>

              {/* Option B */}
              <div className="p-3.5 bg-gray-950/70 border border-gray-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">Вариант 2: Ручные команды в терминале</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("git pull origin main && npm install && npm run build && pm2 restart all");
                      setCopiedItem("manual_cmd");
                      setTimeout(() => setCopiedItem(null), 2000);
                    }}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition cursor-pointer"
                    title="Копировать"
                  >
                    {copiedItem === "manual_cmd" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <pre className="bg-black/60 p-2 rounded border border-gray-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  git pull origin main && npm install && npm run build && pm2 restart all
                </pre>
                <p className="text-gray-400 text-[11px]">
                  Пошаговая цепочка для надежного перезапуска процесса на сервере.
                </p>
              </div>
            </div>

            {/* Cron & Scheduled Auto-Update */}
            <div className="p-3.5 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Автоматическое обновление по ночам по расписанию (Cron):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("0 4 * * 1-5 cd " + (process.cwd() || "/var/www/gold-server") + " && ./update.sh >> /var/log/app-update.log 2>&1");
                    setCopiedItem("cron_cmd");
                    setTimeout(() => setCopiedItem(null), 2000);
                  }}
                  className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition cursor-pointer"
                  title="Копировать строку cron"
                >
                  {copiedItem === "cron_cmd" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                Чтобы сервер сам проверял и накатывал обновления с GitHub по будням в 04:00 утра, добавьте строку в <code className="text-purple-300 font-mono bg-black/40 px-1 py-0.5 rounded">crontab -e</code>:
              </p>
              <pre className="bg-black/60 p-2 rounded border border-gray-800 font-mono text-[11px] text-amber-300 overflow-x-auto">
                0 4 * * 1-5 cd {process.cwd() || "/var/www/gold-server"} && ./update.sh &gt;&gt; /var/log/app-update.log 2&gt;&amp;1
              </pre>
            </div>

            {/* Bind Repo if not git */}
            {!gitStatus?.isGitRepo && (
              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                <span className="font-bold text-xs text-amber-300">Привязать сервер к репозиторию GitHub:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={gitInitUrl}
                    onChange={(e) => setGitInitUrl(e.target.value)}
                    placeholder="https://github.com/username/my-gold-indicator-server.git"
                    className="flex-1 bg-black/60 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleInitGitRepo}
                    disabled={isInitializingGit || !gitInitUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isInitializingGit ? "Привязка..." : "Привязать Git Origin"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🚀 TAB 2: 1-CLICK DEPLOYMENT ON VPS */}
      {activeTab === "deploy" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <div>
              <h3 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                <span>Мастер Развертывания на VPS / Сервере</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Выберите подходящий способ запуска. Все необходимые скрипты уже сгенерированы в репозитории.
              </p>
            </div>

            {/* Method Switcher */}
            <div className="flex items-center gap-1.5 bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs">
              <button
                onClick={() => setDeployMethod("docker")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deployMethod === "docker" ? "bg-cyan-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                Docker Compose
              </button>
              <button
                onClick={() => setDeployMethod("pm2")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deployMethod === "pm2" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                PM2 Node.js
              </button>
              <button
                onClick={() => setDeployMethod("bash")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deployMethod === "bash" ? "bg-emerald-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                1-Команда (deploy.sh)
              </button>
              <button
                onClick={() => setDeployMethod("systemd")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  deployMethod === "systemd" ? "bg-amber-600 text-white shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                Systemd Служба
              </button>
            </div>
          </div>

          {/* DOCKER METHOD */}
          {deployMethod === "docker" && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Преимущества Docker Compose:</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Изолированный контейнер с автоматическим перезапуском при сбоях (<code>restart: unless-stopped</code>), встроенным Healthcheck и нулевым конфликтом системных пакетов. Идеально для любого дистрибутива Linux (Ubuntu, Debian, CentOS, AlmaLinux, Arch).
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-cyan-400 font-bold">1. Команды запуска в терминале сервера:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `git clone <ВАШ_РЕПОЗИТОРИЙ> st-indicator-studio\ncd st-indicator-studio\ncp .env.production.example .env\ndocker compose up -d --build`,
                        "docker_cmds"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded cursor-pointer"
                  >
                    {copiedItem === "docker_cmds" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedItem === "docker_cmds" ? "Скопировано!" : "Копировать"}</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto bg-[#07090e]">
{`# 1. Перейдите в рабочую директорию
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> st-indicator-studio
cd st-indicator-studio

# 2. Настройте файл переменных окружения
cp .env.production.example .env
nano .env # укажите GEMINI_API_KEY и TELEGRAM_BOT_TOKEN

# 3. Соберите и запустите контейнер в фоновом режиме
docker compose up -d --build

# 4. Проверьте статус работы
docker compose ps
docker compose logs -f`}
                </pre>
              </div>

              {/* Dockerfile preview */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-950 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-400">Конфигурация docker-compose.yml:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `services:\n  st-indicator-studio:\n    build: .\n    container_name: st-indicator-studio\n    restart: unless-stopped\n    ports:\n      - "3000:3000"\n    env_file: .env`,
                        "compose_yml"
                      )
                    }
                    className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                  >
                    Копировать yml
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-gray-400 bg-[#05070a] overflow-x-auto">
{`services:
  st-indicator-studio:
    build: .
    container_name: st-indicator-studio
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3`}
                </pre>
              </div>
            </div>
          )}

          {/* PM2 METHOD */}
          {deployMethod === "pm2" && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Преимущества запуска под PM2:</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Стандарт для Node.js в продакшене. Легковесный менеджер процессов с автоперезапуском при превышении памяти (1 ГБ), ротацией логов и автозагрузкой при перезагрузке сервера.
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-purple-400 font-bold">Команды для установки и запуска через PM2:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `npm install -g pm2\ncd st-indicator-studio\nnpm install\nnpm run build\npm2 start ecosystem.config.cjs\npm2 save\npm2 startup`,
                        "pm2_cmds"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded cursor-pointer"
                  >
                    {copiedItem === "pm2_cmds" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedItem === "pm2_cmds" ? "Скопировано!" : "Копировать"}</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto bg-[#07090e]">
{`# 1. Установите PM2 глобально
npm install -g pm2

# 2. Установите зависимости и соберите продакшен-бандл
npm install
npm run build

# 3. Запустите сервис с готовым файлом ecosystem.config.cjs
pm2 start ecosystem.config.cjs

# 4. Сохраните процесс и включите автозапуск при перезагрузке сервера
pm2 save
pm2 startup

# Полезные команды для управления:
pm2 status                  # просмотр статуса
pm2 logs st-indicator-studio # мониторинг логов в реальном времени
pm2 restart all             # перезапуск`}
                </pre>
              </div>
            </div>
          )}

          {/* BASH SCRIPT METHOD */}
          {deployMethod === "bash" && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>Автоматический установщик deploy.sh:</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Скрипт сам определит версию ОС, установит <strong>Node.js 22 LTS</strong>, создаст <code>.env</code>, установит зависимости, соберет проект и запустит сервис в выбранном режиме.
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400 font-bold">Запуск скрипта на чистом сервере:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `chmod +x deploy.sh\n./deploy.sh`,
                        "bash_cmds"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded cursor-pointer"
                  >
                    {copiedItem === "bash_cmds" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedItem === "bash_cmds" ? "Скопировано!" : "Копировать"}</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto bg-[#07090e]">
{`# Сделайте скрипт исполняемым и запустите:
chmod +x deploy.sh
./deploy.sh`}
                </pre>
              </div>
            </div>
          )}

          {/* SYSTEMD METHOD */}
          {deployMethod === "systemd" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Lock className="h-4 w-4" />
                  <span>Родной системный сервис Linux (Systemd):</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Управление сервером через стандартный <code>systemctl</code>. Автоматический перезапуск в случае падения, логирование в <code>journalctl</code>.
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-amber-400 font-bold">Настройка системной службы:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `sudo cp st-indicator-studio.service /etc/systemd/system/\nsudo systemctl daemon-reload\nsudo systemctl enable --now st-indicator-studio\nsudo systemctl status st-indicator-studio`,
                        "systemd_cmds"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded cursor-pointer"
                  >
                    {copiedItem === "systemd_cmds" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedItem === "systemd_cmds" ? "Скопировано!" : "Копировать"}</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed overflow-x-auto bg-[#07090e]">
{`# 1. Скопируйте файл службы в каталог systemd
sudo cp st-indicator-studio.service /etc/systemd/system/

# 2. Перезагрузите демоны systemd и запустите службу
sudo systemctl daemon-reload
sudo systemctl enable --now st-indicator-studio

# 3. Проверьте статус
sudo systemctl status st-indicator-studio

# Просмотр логов:
sudo journalctl -u st-indicator-studio -f`}
                </pre>
              </div>
            </div>
          )}

          {/* Reverse Proxy & SSL Section */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-400" />
              <span>Настройка Домена и Бесплатного SSL-сертификата (HTTPS)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-gray-950/70 rounded-lg border border-gray-800/80 space-y-2">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Вариант А: Caddy (Автоматический SSL в 1 строку)
                </span>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Файл <code>Caddyfile</code> уже включен в проект. Укажите ваш домен и запустите Caddy — сертификат Let's Encrypt выпустится и продлится автоматически!
                </p>
                <div className="bg-black/60 p-2.5 rounded font-mono text-[11px] text-cyan-300">
                  sudo apt install -y caddy<br />
                  sudo caddy run --config Caddyfile
                </div>
              </div>

              <div className="p-4 bg-gray-950/70 rounded-lg border border-gray-800/80 space-y-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" />
                  Вариант Б: Nginx + Certbot
                </span>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Файл <code>nginx.conf</code> уже настроен с поддержкой WebSocket, увеличенного лимита тела запроса (60M) для скриншотов и заголовками проксирования.
                </p>
                <div className="bg-black/60 p-2.5 rounded font-mono text-[11px] text-purple-300">
                  sudo cp nginx.conf /etc/nginx/sites-available/st<br />
                  sudo certbot --nginx -d your-domain.com
                </div>
              </div>
            </div>
          </div>

          {/* 🔄 How to Update and Modify on Server Section */}
          <div className="bg-gradient-to-r from-purple-950/40 via-blue-950/30 to-gray-900 border border-purple-500/40 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-purple-400" />
                <span>Как обновлять программу на сервере и дорабатывать со временем</span>
              </h4>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                Готовый скрипт update.sh
              </span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Сервер спроектирован так, чтобы вы могли легко обновлять код, дорабатывать индикаторы, менять логику ИИ или промты без потери данных и настроек.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-black/60 rounded-lg border border-gray-800 space-y-2">
                <span className="font-bold text-emerald-300 block">
                  ⚡ Вариант 1: Авто-обновление в 1 команду
                </span>
                <p className="text-gray-400 text-[11px]">
                  Скрипт сам стянет изменения, установит зависимости, аккуратно пересоберет проект с контролем памяти и перезапустит PM2:
                </p>
                <div className="bg-black/90 p-2.5 rounded font-mono text-[11px] text-emerald-300 border border-emerald-500/30">
                  chmod +x update.sh<br />
                  ./update.sh
                </div>
              </div>

              <div className="p-3 bg-black/60 rounded-lg border border-gray-800 space-y-2">
                <span className="font-bold text-cyan-300 block">
                  🛠️ Вариант 2: Как вносить свои изменения на сервере
                </span>
                <p className="text-gray-400 text-[11px]">
                  Вы можете редактировать файлы прямо на сервере через <code>nano</code> или SFTP/VS Code, после чего применить изменения:
                </p>
                <div className="bg-black/90 p-2.5 rounded font-mono text-[11px] text-cyan-300 border border-cyan-500/30">
                  # Редактирование, например промта или бэкенда:<br />
                  nano server.ts<br />
                  # Пересборка и перезапуск без простоя:<br />
                  npm run build && pm2 reload ecosystem.config.cjs
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-gray-950 border border-gray-800 text-[11px] text-gray-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                <b>Безопасность данных:</b> Все ваши расписания, настройки Telegram, опционные уровни GEX и списки пользователей сохраняются в директорию <code className="text-amber-300">data/</code> на диске и не стираются при перезагрузках или обновлениях!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 TAB 3: TRADINGVIEW WEBHOOK & TELEGRAM GATEWAY */}
      {activeTab === "webhook" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Webhook URL bar */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-gray-900 to-gray-900 border border-emerald-500/30 p-5 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-400 animate-pulse" />
                <span className="font-bold text-white text-sm">Ваш URL для Webhook в TradingView:</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
                ● ПРИНИМАЕТ ЗАПРОСЫ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 bg-black/60 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, "webhook_url")}
                className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                {copiedItem === "webhook_url" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedItem === "webhook_url" ? "Скопировано!" : "Копировать URL"}</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Вставьте этот адрес в TradingView во вкладке <strong>Уведомления (Notifications)</strong> ➔ <strong>Webhook URL</strong> при создании алерта.
            </p>
          </div>

          {/* Dual Panel: Webhook Test Simulator & Telegram Test */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Webhook Simulator */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Play className="h-4 w-4 text-cyan-400" />
                  <span>Симулятор Сигнала TradingView</span>
                </h4>
                <span className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded font-mono">
                  Тест шлюза
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1">Инструмент (Ticker):</label>
                  <input
                    type="text"
                    value={testTicker}
                    onChange={(e) => setTestTicker(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Направление (Action):</label>
                  <select
                    value={testAction}
                    onChange={(e) => setTestAction(e.target.value as any)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value="BUY">🟢 BUY (LONG)</option>
                    <option value="SELL">🔴 SELL (SHORT)</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Цена входа:</label>
                  <input
                    type="text"
                    value={testPrice}
                    onChange={(e) => setTestPrice(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Stop Loss:</label>
                  <input
                    type="text"
                    value={testSl}
                    onChange={(e) => setTestSl(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-rose-300 font-mono"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Take Profit 1:</label>
                  <input
                    type="text"
                    value={testTp1}
                    onChange={(e) => setTestTp1(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-emerald-300 font-mono"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Таймфрейм:</label>
                  <input
                    type="text"
                    value={testTf}
                    onChange={(e) => setTestTf(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleSendTestWebhook}
                disabled={isSendingWebhook}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSendingWebhook ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Отправка и ИИ-Аудит...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span>Эмулировать Сигнал Индикатора</span>
                  </>
                )}
              </button>

              {webhookResult && (
                <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 text-[11px] font-mono space-y-1">
                  <div className="text-emerald-400 font-bold">✓ Ответ шлюза: {webhookResult.message}</div>
                  {webhookResult.aiVerdict && (
                    <div className="text-gray-300">
                      ИИ-Вердикт: <span className="text-cyan-300 font-bold">{webhookResult.aiVerdict.confidence}%</span> (
                      {webhookResult.aiVerdict.notes})
                    </div>
                  )}
                  {webhookResult.telegramDispatched !== undefined && (
                    <div className="text-blue-300">
                      Telegram: {webhookResult.telegramDispatched ? "Отправлено успешно 🚀" : "Не отправлялось (токен не настроен)"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Telegram Bot Setup & Test */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-400" />
                  <span>Шлюз Уведомлений Telegram</span>
                </h4>
                <span className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded font-mono">
                  @BotFather
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1">Telegram Bot Token:</label>
                  <input
                    type="password"
                    placeholder="7123456789:AAFx98...-XYZ"
                    value={tgBotToken}
                    onChange={(e) => setTgBotToken(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Telegram Chat ID (числовой ID или @channel):</label>
                  <input
                    type="text"
                    placeholder="123456789"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Узнать свой ID можно через бота <code>@userinfobot</code>
                  </span>
                </div>

                <button
                  onClick={handleSendTelegramTest}
                  disabled={isSendingTgTest}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSendingTgTest ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Отправка тестового алерта...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Отправить Тестовое Сообщение в Telegram</span>
                    </>
                  )}
                </button>

                {tgTestResult && (
                  <div
                    className={`p-3 rounded-lg border text-[11px] font-mono ${
                      tgTestResult.success
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                    }`}
                  >
                    {tgTestResult.success ? (
                      <div>✓ Уведомление доставлено в Telegram! ID сообщения: {tgTestResult.messageId}</div>
                    ) : (
                      <div>Ошибка: {tgTestResult.error || "Не удалось отправить"}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Incoming Signals Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden space-y-2">
            <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Журнал Принятых Сигналов из TradingView ({signals.length})
                </span>
              </div>
              {signals.length > 0 && (
                <button
                  onClick={clearSignals}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Очистить</span>
                </button>
              )}
            </div>

            {signals.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                Пока нет принятых сигналов. Отправьте тестовый сигнал через форму выше или создайте алерт в TradingView.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-950 text-gray-400 uppercase font-mono text-[10px] border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-2.5">Время</th>
                      <th className="px-4 py-2.5">Инструмент</th>
                      <th className="px-4 py-2.5">Действие</th>
                      <th className="px-4 py-2.5">Вход / SL / TP</th>
                      <th className="px-4 py-2.5">ИИ-Аудит</th>
                      <th className="px-4 py-2.5">Telegram</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 font-mono">
                    {signals.map((sig) => (
                      <tr key={sig.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 text-[11px]">
                          {new Date(sig.receivedAt).toLocaleTimeString("ru-RU")}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-white">
                          {sig.ticker} <span className="text-[10px] text-gray-500 font-normal">({sig.timeframe})</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sig.action === "BUY"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : sig.action === "SELL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {sig.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-gray-300">
                          {sig.price ? <span className="text-white font-bold">{sig.price}</span> : "Рыночный"}
                          {sig.sl && <span className="text-rose-400 ml-2">SL: {sig.sl}</span>}
                          {sig.tp1 && <span className="text-emerald-400 ml-2">TP: {sig.tp1}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[11px]">
                          {sig.aiVerdict ? (
                            <span className="text-cyan-300 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-cyan-400" />
                              <span>{sig.aiVerdict.confidence}%</span>
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[11px]">
                          {sig.telegramDispatched ? (
                            <span className="text-emerald-400">✓ Доставлен</span>
                          ) : (
                            <span className="text-gray-500">Не настроен</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pine Script Alert Payload Code snippet */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <FileCode className="h-4 w-4" />
                <span>Шаблон сообщения (Message) для окна Алерта в TradingView:</span>
              </span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `{\n  "ticker": "{{ticker}}",\n  "action": "{{strategy.order.action}}",\n  "price": {{close}},\n  "timeframe": "{{interval}}",\n  "comment": "{{strategy.order.comment}}",\n  "time": "{{time}}"\n}`,
                    "tv_alert_payload"
                  )
                }
                className="text-xs text-gray-300 hover:text-white cursor-pointer"
              >
                Копировать JSON
              </button>
            </div>
            <pre className="bg-black/60 p-3 rounded font-mono text-xs text-emerald-300 overflow-x-auto">
{`{
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "timeframe": "{{interval}}",
  "comment": "{{strategy.order.comment}}",
  "time": "{{time}}"
}`}
            </pre>
          </div>
        </div>
      )}

      {/* 🚀 TAB 4: .ENV CONFIGURATOR */}
      {activeTab === "env" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <div>
              <h3 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-5 w-5 text-purple-400" />
                <span>Конфигуратор Переменных Окружения (.env)</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Визуальный редактор файла конфигурации сервера. Скопируйте готовый текст на сервер или сохраните файл.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(generatedEnvContent, "env_file")}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedItem === "env_file" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedItem === "env_file" ? "Скопировано!" : "Копировать .env"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor fields */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-gray-400">
                Параметры Сервера
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Порт Сервера (PORT):</label>
                  <input
                    type="text"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                    placeholder="3000"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">
                    Google Gemini API Key (AQ... или AIza...):
                  </label>
                  <input
                    type="password"
                    value={geminiApiKeyInput}
                    onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                    placeholder="AQ... или AIzaSy..."
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Поддерживает новые ключи Google Auth (префикс AQ.*) и стандартные (AIza*). Необходим для мультимодального анализа графиков и OCR скриншотов.
                  </span>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">
                    Секретный токен Webhook (WEBHOOK_SECRET):
                  </label>
                  <input
                    type="text"
                    value={webhookSecretKey}
                    onChange={(e) => setWebhookSecretKey(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                    placeholder="st_secret_tradingview_token"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Защищает конечную точку от спама. Добавляется в URL: <code>?token=...</code>
                  </span>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Telegram Bot Token:</label>
                  <input
                    type="password"
                    value={tgBotToken}
                    onChange={(e) => setTgBotToken(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                    placeholder="7123456789:AAFx..."
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Telegram Chat ID:</label>
                  <input
                    type="text"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                    placeholder="123456789"
                  />
                </div>
              </div>
            </div>

            {/* Live .env preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                <span className="font-mono text-xs text-purple-400 font-bold">Готовый файл .env:</span>
                <span className="text-[10px] text-gray-400 font-mono">Сохраните в корневую папку на сервере</span>
              </div>
              <pre className="flex-1 p-4 text-xs font-mono text-cyan-300 bg-[#07090e] overflow-auto leading-relaxed">
{generatedEnvContent}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 TAB 5: LIVE TERMINAL & LOGS */}
      {activeTab === "terminal" && (
        <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/90 border border-gray-800 p-3 rounded-xl shrink-0">
            <div className="flex items-center gap-3">
              <Terminal className="h-5 w-5 text-amber-400" />
              <div>
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Консоль Событий и Логи Сервера
                </span>
                <span className="text-gray-400 text-xs ml-2 font-mono">({serverLogs.length} записей)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter */}
              <div className="flex items-center gap-1 text-xs">
                {["ALL", "WEBHOOK", "INFO", "WARN", "ERROR"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      logFilter === lvl
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                className={`text-[10px] px-2 py-1 rounded border font-mono cursor-pointer ${
                  autoRefreshLogs
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : "bg-gray-800 text-gray-400 border-gray-700"
                }`}
              >
                {autoRefreshLogs ? "● Live Авто-обновление" : "○ Пауза"}
              </button>

              <button
                onClick={clearLogs}
                className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded cursor-pointer"
              >
                Очистить
              </button>
            </div>
          </div>

          {/* Terminal Box */}
          <div className="flex-1 bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-1">
            {serverLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-12">Журнал логов пуст. Ожидание событий...</div>
            ) : (
              serverLogs
                .filter((l) => logFilter === "ALL" || l.level === logFilter)
                .map((log) => {
                  let badgeColor = "text-cyan-400";
                  if (log.level === "ERROR") badgeColor = "text-rose-400 font-bold";
                  else if (log.level === "WARN") badgeColor = "text-amber-400 font-bold";
                  else if (log.level === "WEBHOOK") badgeColor = "text-emerald-400 font-bold";
                  else if (log.level === "AI_AUDIT") badgeColor = "text-purple-400 font-bold";

                  return (
                    <div key={log.id} className="leading-relaxed hover:bg-gray-900/50 px-1 rounded flex items-start gap-2">
                      <span className="text-gray-600 select-none text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString("ru-RU")}
                      </span>
                      <span className={`text-[10px] uppercase select-none w-16 ${badgeColor}`}>
                        [{log.level}]
                      </span>
                      <span className="text-gray-200 flex-1 break-all">{log.message}</span>
                      {log.details && (
                        <span className="text-[10px] text-gray-500">{JSON.stringify(log.details)}</span>
                      )}
                    </div>
                  );
                })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
