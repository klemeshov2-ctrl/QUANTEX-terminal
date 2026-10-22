import React, { useState, useEffect } from "react";
import {
  Send,
  Key,
  Lock,
  Users,
  Palette,
  Sliders,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Play,
  UserCheck,
  UserPlus,
  Trash2,
  Edit2,
  Shield,
  Zap,
  Globe,
  Radio,
  Sparkles,
  Bot,
  ExternalLink,
  ChevronRight,
  Database
} from "lucide-react";
import { Timeframe } from "../types";

export type ThemeId =
  | "cyber_dark"
  | "gold_bullion"
  | "navy_pro"
  | "synthwave_violet"
  | "forest_alpha"
  | "monokai_slate";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  badge: string;
  bgClass: string;
  surfaceClass: string;
  borderClass: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  colors: string[]; // 4 preview dots
}

export const STATION_THEMES: ThemeMeta[] = [
  {
    id: "cyber_dark",
    name: "Кибер-Неон (Cyber Dark)",
    tagline: "Глубокий космический обсидиан с неоновым цианом и изумрудом",
    badge: "По умолчанию",
    bgClass: "bg-[#07090e]",
    surfaceClass: "bg-[#0c101c]",
    borderClass: "border-gray-800",
    accentText: "text-cyan-400",
    accentBg: "bg-cyan-500/20",
    accentBorder: "border-cyan-500/40",
    colors: ["#07090e", "#0c101c", "#06b6d4", "#10b981"]
  },
  {
    id: "gold_bullion",
    name: "Золотой Слиток (Gold Luxury)",
    tagline: "Глянцевый черный оникс с сияющим золотом и янтарной бронзой",
    badge: "Премиум",
    bgClass: "bg-[#070503]",
    surfaceClass: "bg-[#110d07]",
    borderClass: "border-amber-900/40",
    accentText: "text-amber-400",
    accentBg: "bg-amber-500/20",
    accentBorder: "border-amber-500/40",
    colors: ["#070503", "#110d07", "#f59e0b", "#d97706"]
  },
  {
    id: "navy_pro",
    name: "Bloomberg Navy Pro",
    tagline: "Институциональный темно-синий терминал с сапфировым акцентом",
    badge: "Банковский",
    bgClass: "bg-[#030712]",
    surfaceClass: "bg-[#081226]",
    borderClass: "border-blue-900/40",
    accentText: "text-sky-400",
    accentBg: "bg-blue-500/20",
    accentBorder: "border-blue-500/40",
    colors: ["#030712", "#081226", "#2563eb", "#38bdf8"]
  },
  {
    id: "synthwave_violet",
    name: "Синтвейв Матрикс (Violet Neon)",
    tagline: "Глубокая ночная фиолетовая туманность с фуксией и индиго",
    badge: "Крипто",
    bgClass: "bg-[#080511]",
    surfaceClass: "bg-[#120d24]",
    borderClass: "border-purple-900/40",
    accentText: "text-purple-400",
    accentBg: "bg-purple-500/20",
    accentBorder: "border-purple-500/40",
    colors: ["#080511", "#120d24", "#9333ea", "#e879f9"]
  },
  {
    id: "forest_alpha",
    name: "Хедж-Фонд Альфа (Forest Emerald)",
    tagline: "Хвойный графит с сияющим нефритом и серебристым блеском",
    badge: "Хедж-фонд",
    bgClass: "bg-[#040c08]",
    surfaceClass: "bg-[#091710]",
    borderClass: "border-emerald-900/40",
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/20",
    accentBorder: "border-emerald-500/40",
    colors: ["#040c08", "#091710", "#10b981", "#34d399"]
  },
  {
    id: "monokai_slate",
    name: "Монохром Контраст (Monokai Pro)",
    tagline: "Абсолютный черный фон с максимальным контрастом для мульти-мониторов",
    badge: "Ультра-контраст",
    bgClass: "bg-[#000000]",
    surfaceClass: "bg-[#0d0d0d]",
    borderClass: "border-neutral-800",
    accentText: "text-lime-400",
    accentBg: "bg-lime-500/20",
    accentBorder: "border-lime-500/40",
    colors: ["#000000", "#0d0d0d", "#84cc16", "#facc15"]
  }
];

export interface UserAccountItem {
  id: string;
  username: string;
  password?: string;
  role: "admin" | "trader" | "analyst" | "viewer";
  allowedTabs: string[];
  createdAt: string;
}

export interface UnifiedSettingsData {
  telegram: {
    botToken: string;
    chatId: string;
    channelId: string;
    enableBuySellAlerts: boolean;
    enableGexBreaks: boolean;
    enableAiBriefings: boolean;
    enableCriticalNews: boolean;
    enableGeopolitics: boolean;
    enableServerAlerts: boolean;
  };
  ai: {
    activeProvider: "deepseek" | "qwen" | "gemini" | "autonomous";
    deepSeekApiKey: string;
    deepSeekModel: string;
    deepSeekEndpoint: string;
    qwenApiKey: string;
    qwenModel: string;
    qwenEndpoint: string;
    geminiApiKey: string;
    geminiModel: string;
    temperature: number;
  };
  serverSecurity: {
    requireAuth: boolean;
    inactivityLockMinutes: number;
    allowDirectIp: boolean;
  };
  users: UserAccountItem[];
  theme: ThemeId;
  serverPreferences: {
    quotePollingIntervalSec: number;
    newsRefreshIntervalMin: number;
    soundAlerts: boolean;
    historyCandlesLimit: number;
    autoCleanLogsDays: number;
  };
}

export interface UnifiedStationSettingsProps {
  initialSection?: string;
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  currentUser: UserAccountItem;
  onUserChange: (user: UserAccountItem) => void;
  // Indicator callbacks
  presetSel?: string;
  onApplyPreset?: (preset: string) => void;
  showTables?: boolean;
  onToggleTables?: (show: boolean) => void;
  tblViewMode?: string;
  onSelectTblViewMode?: (mode: string) => void;
  tablePos?: string;
  onSelectTablePos?: (pos: string) => void;
  useAntiRound?: boolean;
  onToggleAntiRound?: (v: boolean) => void;
  // Navigation
  onNavigateToTab?: (tab: string) => void;
}

export const UnifiedStationSettings: React.FC<UnifiedStationSettingsProps> = ({
  initialSection = "telegram",
  currentTheme,
  onThemeChange,
  currentUser,
  onUserChange,
  presetSel,
  onApplyPreset,
  showTables,
  onToggleTables,
  tblViewMode,
  onSelectTblViewMode,
  tablePos,
  onSelectTablePos,
  useAntiRound,
  onToggleAntiRound,
  onNavigateToTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSection);
  const [showTokens, setShowTokens] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Unified settings state
  const [settings, setSettings] = useState<UnifiedSettingsData>({
    telegram: {
      botToken: "",
      chatId: "",
      channelId: "",
      enableBuySellAlerts: true,
      enableGexBreaks: true,
      enableAiBriefings: true,
      enableCriticalNews: true,
      enableGeopolitics: true,
      enableServerAlerts: true
    },
    ai: {
      activeProvider: "deepseek",
      deepSeekApiKey: "",
      deepSeekModel: "deepseek-chat",
      deepSeekEndpoint: "https://api.deepseek.com/chat/completions",
      qwenApiKey: "",
      qwenModel: "qwen-plus",
      qwenEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      geminiApiKey: "",
      geminiModel: "gemini-2.5-flash",
      temperature: 0.3
    },
    serverSecurity: {
      requireAuth: false,
      inactivityLockMinutes: 15,
      allowDirectIp: true
    },
    users: [
      {
        id: "usr-admin",
        username: "admin",
        password: "",
        role: "admin",
        allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings"],
        createdAt: "2026-10-21"
      }
    ],
    theme: currentTheme || "cyber_dark",
    serverPreferences: {
      quotePollingIntervalSec: 2,
      newsRefreshIntervalMin: 3,
      soundAlerts: true,
      historyCandlesLimit: 160,
      autoCleanLogsDays: 7
    }
  });

  // Server diagnostics
  const [serverMeta, setServerMeta] = useState<any>({
    uptimeSeconds: 0,
    nodeVersion: "v20.x",
    port: 3000,
    currentTimeMsk: ""
  });

  // Password change form
  const [pwdCurrent, setPwdCurrent] = useState<string>("");
  const [pwdNew, setPwdNew] = useState<string>("");
  const [pwdConfirm, setPwdConfirm] = useState<string>("");
  const [pwdStatus, setPwdStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Telegram test state
  const [tgTestStatus, setTgTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTestingTg, setIsTestingTg] = useState<boolean>(false);

  // AI test state
  const [aiTestStatus, setAiTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTestingAi, setIsTestingAi] = useState<boolean>(false);

  // User creation form
  const [newUsername, setNewUsername] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "trader" | "analyst" | "viewer">("trader");
  const [newUserTabs, setNewUserTabs] = useState<string[]>(["chart", "gex", "calendar"]);
  const [userActionMsg, setUserActionMsg] = useState<string>("");

  // Password modification state per user
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [editingPasswordVal, setEditingPasswordVal] = useState<string>("");
  const [showEditingPassword, setShowEditingPassword] = useState<boolean>(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState<boolean>(false);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/settings/unified");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings,
            telegram: { ...prev.telegram, ...(data.settings.telegram || {}) },
            ai: { ...prev.ai, ...(data.settings.ai || {}) },
            serverSecurity: { ...prev.serverSecurity, ...(data.settings.serverSecurity || {}) },
            serverPreferences: { ...prev.serverPreferences, ...(data.settings.serverPreferences || {}) },
            users: Array.isArray(data.settings.users) && data.settings.users.length > 0 ? data.settings.users : prev.users
          }));
        }
        if (data.serverStatus) {
          setServerMeta(data.serverStatus);
        }
      }
    } catch (e: any) {
      console.warn("Failed to fetch unified settings:", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaveStatus("Сохранение...");
    try {
      const res = await fetch("/api/settings/unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveStatus("✅ Все настройки успешно сохранены на сервере!");
        // Sync AI settings with local store for compatibility with existing hooks
        try {
          localStorage.setItem(
            "st_ai_provider_settings",
            JSON.stringify({
              provider: settings.ai.activeProvider,
              deepSeekApiKey: settings.ai.deepSeekApiKey,
              deepSeekModel: settings.ai.deepSeekModel,
              deepSeekEndpoint: settings.ai.deepSeekEndpoint,
              qwenApiKey: settings.ai.qwenApiKey,
              qwenModel: settings.ai.qwenModel,
              qwenEndpoint: settings.ai.qwenEndpoint,
              geminiApiKey: settings.ai.geminiApiKey,
              geminiModel: settings.ai.geminiModel
            })
          );
        } catch {}
      } else {
        setSaveStatus("❌ Ошибка при сохранении настроек");
      }
    } catch (e: any) {
      setSaveStatus(`❌ Ошибка: ${e.message}`);
    }
    setTimeout(() => setSaveStatus(""), 4000);
  };

  // 1. Telegram test
  const handleTestTelegram = async () => {
    setIsTestingTg(true);
    setTgTestStatus(null);
    try {
      const res = await fetch("/api/server/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: settings.telegram.botToken,
          chatId: settings.telegram.chatId,
          message:
            `⚡ <b>QUANTEX Terminal • Тест Telegram-бота</b>\n\n` +
            `✅ Шлюз настроен корректно и готов к трансляции!\n` +
            `👤 Пользователь: <code>${currentUser.username}</code>\n` +
            `⏰ Время сервера: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК\n` +
            `📊 Активные алерты: ${settings.telegram.enableBuySellAlerts ? "Сигналы (Вкл)" : "Сигналы (Выкл)"}, ` +
            `${settings.telegram.enableGexBreaks ? "GEX (Вкл)" : "GEX (Выкл)"}`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTgTestStatus({
          ok: true,
          msg: `✅ Тестовое сообщение доставлено в Telegram! ID сообщения: ${data.messageId || "OK"}`
        });
      } else {
        setTgTestStatus({
          ok: false,
          msg: `❌ Ошибка Telegram: ${data.error || "Проверьте токен бота и chat ID"}`
        });
      }
    } catch (e: any) {
      setTgTestStatus({ ok: false, msg: `❌ Ошибка сети: ${e.message}` });
    } finally {
      setIsTestingTg(false);
    }
  };

  // 2. AI API Test
  const handleTestAi = async () => {
    setIsTestingAi(true);
    setAiTestStatus(null);
    try {
      const provider = settings.ai.activeProvider;
      const apiKey =
        provider === "deepseek"
          ? settings.ai.deepSeekApiKey
          : provider === "qwen"
          ? settings.ai.qwenApiKey
          : settings.ai.geminiApiKey;
      const model =
        provider === "deepseek"
          ? settings.ai.deepSeekModel
          : provider === "qwen"
          ? settings.ai.qwenModel
          : settings.ai.geminiModel;
      const endpoint =
        provider === "deepseek" ? settings.ai.deepSeekEndpoint : settings.ai.qwenEndpoint;

      const res = await fetch("/api/ai-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, endpoint })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiTestStatus({
          ok: true,
          msg: `✅ ${data.message || "ИИ отвечает корректно!"} (пинг: ${data.latencyMs || 0} мс)`
        });
      } else {
        setAiTestStatus({
          ok: false,
          msg: `❌ Ошибка ИИ: ${data.error || "Проверьте введенный API ключ"}`
        });
      }
    } catch (e: any) {
      setAiTestStatus({ ok: false, msg: `❌ Ошибка сети: ${e.message}` });
    } finally {
      setIsTestingAi(false);
    }
  };

  // 3. Password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);
    if (!pwdNew || pwdNew.length < 4) {
      setPwdStatus({ ok: false, msg: "Новый пароль должен содержать от 4 символов" });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdStatus({ ok: false, msg: "Новый пароль и подтверждение не совпадают" });
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPwdStatus({ ok: true, msg: "✅ Мастер-пароль сервера успешно обновлен!" });
        setPwdCurrent("");
        setPwdNew("");
        setPwdConfirm("");
      } else {
        setPwdStatus({ ok: false, msg: data.error || "Ошибка смены пароля" });
      }
    } catch (e: any) {
      setPwdStatus({ ok: false, msg: `Ошибка: ${e.message}` });
    }
  };

  // 4. User management
  // 4. User management
  const handleSaveUserPassword = async (username: string) => {
    if (!editingPasswordVal.trim() || editingPasswordVal.trim().length < 4) {
      setUserActionMsg("❌ Новый пароль должен содержать от 4 символов");
      setTimeout(() => setUserActionMsg(""), 3000);
      return;
    }
    setPasswordChangeLoading(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          newPassword: editingPasswordVal.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(prev => ({
          ...prev,
          users: prev.users.map(u =>
            u.username.toLowerCase() === username.toLowerCase()
              ? { ...u, password: editingPasswordVal.trim() }
              : u
          )
        }));
        setUserActionMsg(`✅ Пароль для пользователя «${username}» успешно сохранен!`);
        setEditingPasswordUserId(null);
        setEditingPasswordVal("");
      } else {
        setUserActionMsg(`❌ Ошибка: ${data.error || "Не удалось сменить пароль"}`);
      }
    } catch (e: any) {
      setUserActionMsg(`❌ Ошибка сети: ${e.message}`);
    } finally {
      setPasswordChangeLoading(false);
      setTimeout(() => setUserActionMsg(""), 4000);
    }
  };

  const handleAddUser = async () => {
    if (!newUsername.trim()) {
      setUserActionMsg("❌ Введите логин пользователя");
      setTimeout(() => setUserActionMsg(""), 3000);
      return;
    }
    if (settings.users.some(u => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      setUserActionMsg("❌ Пользователь с таким логином уже существует");
      setTimeout(() => setUserActionMsg(""), 3000);
      return;
    }
    if (newUserPassword.trim() && newUserPassword.trim().length < 4) {
      setUserActionMsg("❌ Пароль должен содержать от 4 символов");
      setTimeout(() => setUserActionMsg(""), 3000);
      return;
    }

    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newUserPassword.trim() || "12345",
          role: newUserRole,
          allowedTabs: newUserTabs.length > 0 ? newUserTabs : ["chart", "calendar"]
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setSettings(prev => ({
          ...prev,
          users: data.users || [...prev.users, data.user]
        }));
        setNewUsername("");
        setNewUserPassword("");
        setUserActionMsg(`✅ Пользователь «${data.user.username}» успешно создан и сохранен на сервере!`);
      } else {
        setUserActionMsg(`❌ Ошибка: ${data.error || "Не удалось создать пользователя"}`);
      }
    } catch (e: any) {
      setUserActionMsg(`❌ Ошибка сети: ${e.message}`);
    }
    setTimeout(() => setUserActionMsg(""), 4000);
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (id === "usr-admin" || name === "admin") {
      alert("Нельзя удалить системного администратора admin");
      return;
    }
    if (confirm(`Удалить пользователя «${name}»?`)) {
      try {
        const res = await fetch("/api/users/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, username: name })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSettings(prev => ({
            ...prev,
            users: data.users || prev.users.filter(u => u.id !== id)
          }));
          setUserActionMsg(`Пользователь «${name}» удален`);
        } else {
          setUserActionMsg(`❌ Ошибка: ${data.error || "Не удалось удалить"}`);
        }
      } catch (e: any) {
        setUserActionMsg(`❌ Ошибка: ${e.message}`);
      }
      setTimeout(() => setUserActionMsg(""), 3000);
    }
  };

  const handleToggleUserTab = async (username: string, tabId: string) => {
    const updatedUsers = settings.users.map(u => {
      if (u.username === username) {
        const hasTab = u.allowedTabs.includes(tabId);
        const updatedTabs = hasTab
          ? u.allowedTabs.filter(t => t !== tabId)
          : [...u.allowedTabs, tabId];
        return { ...u, allowedTabs: updatedTabs };
      }
      return u;
    });

    setSettings(prev => ({ ...prev, users: updatedUsers }));

    try {
      await fetch("/api/settings/unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: updatedUsers })
      });
      setUserActionMsg(`Права для «${username}» обновлены`);
      setTimeout(() => setUserActionMsg(""), 2000);
    } catch {}
  };

  // 5. Sound test
  const playTestBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  };

  // 6. Backup Export & Import
  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `quantex-backup-${new Date().toISOString().slice(0, 10)}.json`);
    dl.click();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed && typeof parsed === "object") {
          setSettings(prev => ({ ...prev, ...parsed }));
          setSaveStatus("✅ Конфигурация успешно загружена из файла! Не забудьте сохранить.");
        }
      } catch (err: any) {
        alert("Ошибка разбора JSON файла: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 h-full overflow-hidden bg-[#07090e] text-gray-200">
      {/* 🧭 LEFT SIDEBAR: Settings Navigation Categories */}
      <div className="w-full md:w-64 bg-[#0a0e1a] border-b md:border-b-0 md:border-r border-gray-800 p-3 flex md:flex-col justify-between shrink-0 overflow-x-auto md:overflow-y-auto">
        <div className="space-y-1.5 min-w-[320px] md:min-w-0 w-full">
          <div className="hidden md:flex items-center gap-2 px-2 py-2 mb-2 border-b border-gray-800/80">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-xs text-white uppercase tracking-wider">Панель Управления</h2>
              <p className="text-[10px] text-gray-400">Центр всех настроек терминала</p>
            </div>
          </div>

          {[
            { id: "telegram", label: "📱 Telegram-бот", icon: Send, badge: settings.telegram.botToken ? "Настроен" : "Не задан" },
            { id: "ai_api", label: "🤖 API ИИ (Интеллект)", icon: Key, badge: settings.ai.activeProvider.toUpperCase() },
            { id: "server", label: "🔒 Сервер & Безопасность", icon: Shield, badge: "SSL / Port 3000" },
            { id: "users", label: "👥 Пользователи & Доступ (RBAC)", icon: Users, badge: `${settings.users.length} акк.` },
            { id: "indicator", label: "⚙️ Индикатор & Пресеты", icon: Sliders, badge: "QUANTEX v8" },
            { id: "performance", label: "⚡ Сервер & Сеть", icon: Server, badge: "Параметры" }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer text-left whitespace-nowrap ${
                  isActive
                    ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/50 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-amber-400" : "text-gray-500"}`} />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono hidden md:inline ${
                    isActive ? "bg-amber-500/20 text-amber-200" : "bg-gray-900 text-gray-500"
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Global Save Button in Sidebar */}
        <div className="hidden md:block pt-3 border-t border-gray-800 space-y-2">
          {saveStatus && (
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] leading-tight flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
              <span>{saveStatus}</span>
            </div>
          )}

          <button
            onClick={handleSaveAll}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Сохранить все настройки</span>
          </button>

          <div className="text-[10px] text-gray-500 text-center font-mono">
            Автономно на сервере • data/
          </div>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT PANE */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Top Header Bar for Mobile / Quick Save */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 gap-2 flex-wrap">
          <div>
            <h1 className="font-bold text-base md:text-lg text-white flex items-center gap-2">
              {activeSubTab === "telegram" && "📱 Настройки Telegram-бота & Оповещений"}
              {activeSubTab === "ai_api" && "🤖 Настройки API ИИ (DeepSeek, Qwen, Gemini)"}
              {activeSubTab === "server" && "🔒 Пароль Сервера, Безопасность и Резервное Копирование"}
              {activeSubTab === "users" && "👥 Пользователи & Разграничение Прав Доступа к Вкладкам (RBAC)"}
              {activeSubTab === "themes" && "🎨 Темы Оформления Терминала (6 Цветовых Палитр)"}
              {activeSubTab === "indicator" && "⚙️ Параметры QUANTEX Pro v8, Пресеты & Мобильный HUD"}
              {activeSubTab === "performance" && "⚡ Параметры Сервера, Частота Опроса & Звуки"}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Все параметры сохраняются в защищенном хранилище сервера без внешних облаков.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTokens(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono flex items-center gap-1 transition cursor-pointer border border-gray-700"
              title="Показать / скрыть API ключи и токены"
            >
              {showTokens ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showTokens ? "Скрыть ключи" : "Показать ключи"}</span>
            </button>

            <button
              onClick={handleSaveAll}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Сохранить</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 1. TELEGRAM BOT SETTINGS                                  */}
        {/* ======================================================== */}
        {activeSubTab === "telegram" && (
          <div className="space-y-5 max-w-4xl">
            <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Параметры Telegram-бота</h3>
                    <p className="text-xs text-gray-400">Шлюз для отправки сигналов, GEX уровней и утренних ИИ-брифингов</p>
                  </div>
                </div>

                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono font-bold"
                >
                  <span>Создать бота в @BotFather</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 block">
                    Telegram Bot Token:
                  </label>
                  <input
                    type={showTokens ? "text" : "password"}
                    value={settings.telegram.botToken}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        telegram: { ...prev.telegram, botToken: e.target.value }
                      }))
                    }
                    placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                    className="w-full bg-[#121625] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-gray-500 block">
                    Получите у официального бота @BotFather командой /newbot
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 block">
                    Chat ID / ID Лички или Канала:
                  </label>
                  <input
                    type="text"
                    value={settings.telegram.chatId}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        telegram: { ...prev.telegram, chatId: e.target.value }
                      }))
                    }
                    placeholder="123456789 или @channel_name"
                    className="w-full bg-[#121625] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-gray-500 block">
                    Узнать свой Chat ID можно у бота @userinfobot
                  </span>
                </div>
              </div>

              {/* Event trigger toggles */}
              <div className="pt-2 border-t border-gray-800 space-y-2.5">
                <h4 className="font-bold text-xs text-gray-300">Типы событий для отправки в Telegram:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "enableBuySellAlerts", label: "⚡ Сигналы на вход (Buy / Sell)" },
                    { key: "enableGexBreaks", label: "🏛️ Пробой уровней Gamma Flip & Walls" },
                    { key: "enableAiBriefings", label: "🌅 Утренний и дневной ИИ-план" },
                    { key: "enableCriticalNews", label: "🔥 Новости с критическим влиянием" },
                    { key: "enableGeopolitics", label: "🌍 Геополитические алерты" },
                    { key: "enableServerAlerts", label: "🚨 Статус сервера и алерты безопасности" }
                  ].map(toggle => (
                    <label
                      key={toggle.key}
                      className="flex items-center gap-2 p-2 rounded-xl bg-[#111624] border border-gray-800 hover:border-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(settings.telegram as any)[toggle.key]}
                        onChange={e =>
                          setSettings(prev => ({
                            ...prev,
                            telegram: { ...prev.telegram, [toggle.key]: e.target.checked }
                          }))
                        }
                        className="rounded text-amber-500 focus:ring-0 h-4 w-4 bg-gray-900 border-gray-700"
                      />
                      <span className="text-gray-300 font-semibold text-[11px]">{toggle.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Test telegram connection */}
              <div className="pt-3 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-400">
                  Проверьте доставку тестового сообщения перед включением авто-рассылки:
                </div>

                <button
                  onClick={handleTestTelegram}
                  disabled={isTestingTg}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-md shrink-0"
                >
                  <Send className={`h-3.5 w-3.5 ${isTestingTg ? "animate-spin" : ""}`} />
                  <span>{isTestingTg ? "Отправка..." : "Отправить тестовое сообщение"}</span>
                </button>
              </div>

              {tgTestStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono ${
                    tgTestStatus.ok
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {tgTestStatus.msg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. AI PROVIDERS & API KEYS                                */}
        {/* ======================================================== */}
        {activeSubTab === "ai_api" && (
          <div className="space-y-5 max-w-4xl">
            <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Конфигурация API ИИ</h3>
                    <p className="text-xs text-gray-400">Подключение DeepSeek-R1 / V3, Qwen Max, Google Gemini и Квант QUANTEX</p>
                  </div>
                </div>

                <button
                  onClick={handleTestAi}
                  disabled={isTestingAi}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Bot className={`h-3.5 w-3.5 ${isTestingAi ? "animate-spin" : ""}`} />
                  <span>{isTestingAi ? "Проверка..." : "Проверить связь с ИИ"}</span>
                </button>
              </div>

              {aiTestStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono ${
                    aiTestStatus.ok
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {aiTestStatus.msg}
                </div>
              )}

              {/* Provider Radio Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">
                  Активный провайдер ИИ для аналитики:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono font-bold">
                  {[
                    { id: "deepseek", label: "🤖 DeepSeek (V3/R1)", sub: "Рекомендуется для XAUUSD" },
                    { id: "qwen", label: "🌐 Qwen (DashScope)", sub: "Aliyun Cloud" },
                    { id: "gemini", label: "✨ Google Gemini", sub: "Flash 2.5/3.8" },
                    { id: "autonomous", label: "⚡ Автономный QUANTEX", sub: "Локальный без внешних API" }
                  ].map(prov => (
                    <label
                      key={prov.id}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-1 ${
                        settings.ai.activeProvider === prov.id
                          ? "bg-purple-500/20 border-purple-500 text-white font-extrabold shadow-sm"
                          : "bg-[#111624] border-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{prov.label}</span>
                        <input
                          type="radio"
                          name="ai_provider"
                          checked={settings.ai.activeProvider === prov.id}
                          onChange={() =>
                            setSettings(prev => ({
                              ...prev,
                              ai: { ...prev.ai, activeProvider: prov.id as any }
                            }))
                          }
                          className="text-purple-500 focus:ring-0"
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-sans font-normal">{prov.sub}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* DeepSeek API Key Block */}
              <div className="p-3.5 rounded-xl bg-[#101424] border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                    <span>🤖 DeepSeek API (api.deepseek.com)</span>
                  </span>
                  <a
                    href="https://platform.deepseek.com/api_keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>Получить ключ DeepSeek</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">API Key (sk-...):</label>
                    <input
                      type={showTokens ? "text" : "password"}
                      value={settings.ai.deepSeekApiKey}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          ai: { ...prev.ai, deepSeekApiKey: e.target.value }
                        }))
                      }
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-[#161c30] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Модель:</label>
                    <select
                      value={settings.ai.deepSeekModel}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          ai: { ...prev.ai, deepSeekModel: e.target.value }
                        }))
                      }
                      className="w-full bg-[#161c30] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    >
                      <option value="deepseek-chat">deepseek-chat (DeepSeek-V3, Быстрая)</option>
                      <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1, Глубокий анализ)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Qwen / DashScope API Key Block */}
              <div className="p-3.5 rounded-xl bg-[#101424] border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-300">
                    🌐 Qwen / DashScope (Aliyun Cloud)
                  </span>
                  <a
                    href="https://dashscope.console.aliyun.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>Консоль DashScope</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">API Key (sk-...):</label>
                    <input
                      type={showTokens ? "text" : "password"}
                      value={settings.ai.qwenApiKey}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          ai: { ...prev.ai, qwenApiKey: e.target.value }
                        }))
                      }
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-[#161c30] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Модель:</label>
                    <select
                      value={settings.ai.qwenModel}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          ai: { ...prev.ai, qwenModel: e.target.value }
                        }))
                      }
                      className="w-full bg-[#161c30] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    >
                      <option value="qwen-plus">qwen-plus (Баланс скорость/точность)</option>
                      <option value="qwen-max">qwen-max (Флагманская аналитика)</option>
                      <option value="qwen-turbo">qwen-turbo (Быстрый скальпинг)</option>
                      <option value="qwen-2.5-72b-instruct">qwen-2.5-72b-instruct</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Gemini API Key Block */}
              <div className="p-3.5 rounded-xl bg-[#101424] border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-300">
                    ✨ Google Gemini API
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <span>Google AI Studio Key</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">API Key (AIza...):</label>
                    <input
                      type={showTokens ? "text" : "password"}
                      value={settings.ai.geminiApiKey}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          ai: { ...prev.ai, geminiApiKey: e.target.value }
                        }))
                      }
                      placeholder="AIzaSy..."
                      className="w-full bg-[#161c30] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Модель:</label>
                    <select
                      value={settings.ai.geminiModel}
                      onChange={e =>
                        setSettings(prev => ({
                          ...prev,
                          ai: { ...prev.ai, geminiModel: e.target.value }
                        }))
                      }
                      className="w-full bg-[#161c30] border border-gray-700/80 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Рекомендуемая)</option>
                      <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. SERVER SECURITY & PASSWORDS                            */}
        {/* ======================================================== */}
        {activeSubTab === "server" && (
          <div className="space-y-5 max-w-4xl">
            {/* Master password change form */}
            <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Мастер-пароль доступа к серверу</h3>
                  <p className="text-xs text-gray-400">Защита от несанкционированного входа по IP или домену</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Текущий пароль:</label>
                    <input
                      type="password"
                      value={pwdCurrent}
                      onChange={e => setPwdCurrent(e.target.value)}
                      placeholder="Текущий пароль..."
                      className="w-full bg-[#121625] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Новый пароль:</label>
                    <input
                      type="password"
                      value={pwdNew}
                      onChange={e => setPwdNew(e.target.value)}
                      placeholder="Новый пароль (от 4 знаков)..."
                      className="w-full bg-[#121625] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Подтверждение:</label>
                    <input
                      type="password"
                      value={pwdConfirm}
                      onChange={e => setPwdConfirm(e.target.value)}
                      placeholder="Повторите новый пароль..."
                      className="w-full bg-[#121625] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-gray-500 font-mono">
                    По умолчанию на VPS: <code className="text-amber-400">admin123</code>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition cursor-pointer shadow-md"
                  >
                    Изменить пароль сервера
                  </button>
                </div>

                {pwdStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-mono ${
                      pwdStatus.ok
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                    }`}
                  >
                    {pwdStatus.msg}
                  </div>
                )}
              </form>
            </div>

            {/* Server Lock & Backup Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Security parameters */}
              <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  <span>Параметры Сессии и Блокировки</span>
                </h4>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#111624] border border-gray-800 cursor-pointer">
                  <div>
                    <span className="font-bold text-xs text-white block">Обязательный пароль при входе</span>
                    <span className="text-[10px] text-gray-400">Запрашивать пароль при первом открытии в браузере</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.serverSecurity.requireAuth}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        serverSecurity: { ...prev.serverSecurity, requireAuth: e.target.checked }
                      }))
                    }
                    className="rounded text-amber-500 focus:ring-0 h-4 w-4"
                  />
                </label>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Авто-блокировка при неактивности:
                  </label>
                  <select
                    value={settings.serverSecurity.inactivityLockMinutes}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        serverSecurity: {
                          ...prev.serverSecurity,
                          inactivityLockMinutes: Number(e.target.value)
                        }
                      }))
                    }
                    className="w-full bg-[#111624] border border-gray-700 rounded-xl p-2 text-xs text-white font-mono"
                  >
                    <option value="5">Через 5 минут</option>
                    <option value="15">Через 15 минут (Рекомендуется)</option>
                    <option value="30">Через 30 минут</option>
                    <option value="60">Через 1 час</option>
                    <option value="0">Никогда (Сессия не сбрасывается)</option>
                  </select>
                </div>
              </div>

              {/* Backup & Restore */}
              <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>Резервное Копирование Конфигурации</span>
                </h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Экспортируйте или загрузите полный архив настроек (Telegram, пользователи, пресеты, ключи ИИ и темы) в единый файл JSON.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExportBackup}
                    className="flex-1 py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-gray-700"
                  >
                    <Download className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Экспорт JSON</span>
                  </button>

                  <label className="flex-1 py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-gray-700">
                    <Upload className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Импорт JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 4. USER MANAGEMENT & TAB PERMISSIONS (RBAC)               */}
        {/* ======================================================== */}
        {activeSubTab === "users" && (
          <div className="space-y-5 max-w-4xl">
            {/* Current user badge */}
            <div className="bg-gradient-to-r from-blue-950/40 via-[#0d1222] to-indigo-950/40 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Текущий пользователь:</span>
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      👤 {currentUser.username}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Разрешенные разделы: {currentUser.allowedTabs.join(", ")}
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-500 font-mono">
                Всего пользователей: {settings.users.length}
              </div>
            </div>

            {/* Users list table */}
            <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-400" />
                  <span>Список пользователей и разграничение прав доступа</span>
                </h3>
              </div>

              {userActionMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                  {userActionMsg}
                </div>
              )}

              <div className="space-y-3">
                {settings.users.map(u => {
                  const isCurrent = u.username === currentUser.username;
                  return (
                    <div
                      key={u.id}
                      className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                        isCurrent
                          ? "bg-blue-950/20 border-blue-500/40"
                          : "bg-[#111624] border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white font-mono">👤 {u.username}</span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              u.role === "admin"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : u.role === "trader"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            }`}
                          >
                            {u.role}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500 text-black">
                              Активен сейчас
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                onUserChange(u);
                                setUserActionMsg(`Вы переключились на профиль «${u.username}»`);
                                setTimeout(() => setUserActionMsg(""), 3000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-200 text-xs font-bold transition cursor-pointer"
                            >
                              Войти под ним
                            </button>
                          )}

                          {u.username !== "admin" && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Удалить пользователя"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Password change row for this user */}
                      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Key className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-xs text-gray-300 font-semibold">Пароль учетной записи:</span>
                          <span className="text-[11px] font-mono text-gray-500">••••••••</span>
                        </div>

                        {editingPasswordUserId === u.id ? (
                          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto mt-1 sm:mt-0">
                            <div className="relative flex-1 sm:w-48">
                              <input
                                type={showEditingPassword ? "text" : "password"}
                                value={editingPasswordVal}
                                onChange={e => setEditingPasswordVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleSaveUserPassword(u.username);
                                }}
                                placeholder="Новый пароль (мин. 4 симв.)..."
                                autoFocus
                                className="w-full bg-black/60 border border-amber-500/70 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none pr-7"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditingPassword(!showEditingPassword)}
                                className="absolute right-1.5 top-1.5 text-gray-400 hover:text-white cursor-pointer"
                              >
                                {showEditingPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveUserPassword(u.username)}
                              disabled={passwordChangeLoading || !editingPasswordVal.trim()}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition cursor-pointer disabled:opacity-50"
                            >
                              {passwordChangeLoading ? "..." : "Сохранить"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasswordUserId(null);
                                setEditingPasswordVal("");
                              }}
                              className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPasswordUserId(u.id);
                              setEditingPasswordVal("");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-gray-700"
                          >
                            <Key className="h-3 w-3 text-amber-400" />
                            <span>Сменить пароль</span>
                          </button>
                        )}
                      </div>

                      {/* Granular tab checkboxes for this user */}
                      <div className="pt-2 border-t border-gray-800/80">
                        <span className="text-[11px] font-bold text-gray-400 block mb-1">
                          Разрешенные вкладки терминала для «{u.username}»:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 text-[11px]">
                          {[
                            { id: "chart", label: "📊 График" },
                            { id: "gex", label: "🏛️ GEX" },
                            { id: "calendar", label: "📰 Новости" },
                            { id: "editor", label: "📜 Код v8" },
                            { id: "journal", label: "📓 Журнал" },
                            { id: "settings", label: "⚙️ Настройки" }
                          ].map(tab => {
                            const isAllowed = u.allowedTabs.includes(tab.id);
                            return (
                              <button
                                key={tab.id}
                                onClick={() => handleToggleUserTab(u.username, tab.id)}
                                className={`px-2 py-1 rounded-lg transition text-center cursor-pointer font-bold border truncate ${
                                  isAllowed
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-black/30 text-gray-600 border-gray-800 hover:text-gray-400"
                                }`}
                              >
                                {isAllowed ? "✓ " : "✕ "} {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New User Box */}
              <div className="pt-4 border-t border-gray-800 space-y-3">
                <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-emerald-400" />
                  <span>Создать нового пользователя с индивидуальными правами</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Имя пользователя / Логин:</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="Например: trader2"
                      className="w-full bg-[#121625] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Пароль пользователя:</label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      placeholder="Пароль (мин. 4 симв.)..."
                      className="w-full bg-[#121625] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Роль:</label>
                    <select
                      value={newUserRole}
                      onChange={e => {
                        const r = e.target.value as any;
                        setNewUserRole(r);
                        if (r === "admin") setNewUserTabs(["chart", "gex", "calendar", "editor", "journal", "settings"]);
                        else if (r === "trader") setNewUserTabs(["chart", "gex", "calendar", "journal"]);
                        else if (r === "analyst") setNewUserTabs(["chart", "gex", "calendar"]);
                        else setNewUserTabs(["chart", "calendar"]);
                      }}
                      className="w-full bg-[#121625] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    >
                      <option value="trader">Трейдер (График + GEX + Новости + Журнал)</option>
                      <option value="analyst">Аналитик (График + GEX + Новости)</option>
                      <option value="viewer">Наблюдатель (Только График + Новости)</option>
                      <option value="admin">Администратор (Полный доступ к Настройкам)</option>
                    </select>
                  </div>
                </div>

                {/* Tabs to grant for the new user */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-gray-400 block">Разрешенные вкладки для нового пользователя:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 text-[11px]">
                    {[
                      { id: "chart", label: "📊 График" },
                      { id: "gex", label: "🏛️ GEX" },
                      { id: "calendar", label: "📰 Новости" },
                      { id: "editor", label: "📜 Код v8" },
                      { id: "journal", label: "📓 Журнал" },
                      { id: "settings", label: "⚙️ Настройки" }
                    ].map(tab => {
                      const isAllowed = newUserTabs.includes(tab.id);
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setNewUserTabs(prev =>
                              prev.includes(tab.id)
                                ? prev.filter(t => t !== tab.id)
                                : [...prev, tab.id]
                            );
                          }}
                          className={`px-2 py-1 rounded-lg transition text-center cursor-pointer font-bold border truncate ${
                            isAllowed
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-black/30 text-gray-600 border-gray-800 hover:text-gray-400"
                          }`}
                        >
                          {isAllowed ? "✓ " : "✕ "} {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleAddUser}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Создать пользователя</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* ======================================================== */}
        {/* 6. INDICATOR & PRESETS (CONSOLIDATED HERE FROM MODAL)     */}
        {/* ======================================================== */}
        {activeSubTab === "indicator" && (
          <div className="space-y-5 max-w-4xl">
            <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Параметры QUANTEX Pro v8 и Пресеты</h3>
                    <p className="text-xs text-gray-400">Быстрая настройка торговой стратегии для золота, крипты и МосБиржи</p>
                  </div>
                </div>

                {onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab("chart")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-bold cursor-pointer"
                  >
                    <span>Вернуться к графику →</span>
                  </button>
                )}
              </div>

              {/* Preset Selector */}
              {onApplyPreset && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 block">
                    Выбор Оптимального Пресета (preset_sel):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {[
                      "★ Универсальный (Все таймфреймы / Авто-Адаптивный)",
                      "Золото (XAUUSD) - 5 мин Скальпинг",
                      "Золото (XAUUSD) - 15 мин Оптимальный",
                      "Золото (XAUUSD) - 30 мин Свинг-Интрадей",
                      "Золото (XAUUSD) - 1 час Интрадей/Тренд",
                      "Золото (XAUUSD) - 4 часа Свинг",
                      "Биткоин (BTCUSD) - 15 мин Оптимальный",
                      "По умолчанию (Ручные настройки)"
                    ].map(p => (
                      <button
                        key={p}
                        onClick={() => onApplyPreset(p)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer font-mono flex items-center justify-between ${
                          presetSel === p
                            ? "bg-amber-500/20 border-amber-500/80 text-white font-bold"
                            : "bg-[#111624] border-gray-800 text-gray-400 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{p}</span>
                        {presetSel === p && <span className="text-amber-400 text-xs ml-2">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* HUD Table Options */}
              <div className="pt-3 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {onToggleTables && (
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#111624] border border-gray-800 cursor-pointer">
                    <div>
                      <span className="font-bold text-white block">Инфо-панель QUANTEX HUD</span>
                      <span className="text-[10px] text-gray-500">Отображать таблицу на графике</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(showTables)}
                      onChange={e => onToggleTables(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 h-4 w-4"
                    />
                  </label>
                )}

                {onToggleAntiRound && (
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#111624] border border-gray-800 cursor-pointer">
                    <div>
                      <span className="font-bold text-white block">Сдвиг TP/SL от круглых уровней</span>
                      <span className="text-[10px] text-gray-500">Защита от ложных выносов</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(useAntiRound)}
                      onChange={e => onToggleAntiRound(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 h-4 w-4"
                    />
                  </label>
                )}
              </div>

              {onSelectTblViewMode && (
                <div className="pt-2">
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Режим таблицы HUD (tbl_view_mode):
                  </label>
                  <select
                    value={tblViewMode}
                    onChange={e => onSelectTblViewMode(e.target.value)}
                    className="w-full bg-[#111624] border border-gray-700 rounded-xl p-2 text-xs text-white font-mono"
                  >
                    <option value="💻 Стандартный (ПК / Полный HUD)">💻 Стандартный (ПК / Полный HUD)</option>
                    <option value="📱 Мобильный (Полный HUD / Компакт по ширине)">📱 Мобильный (Полный HUD / Компакт по ширине)</option>
                    <option value="📱 Мобильный (Компакт / 5 строк)">📱 Мобильный (Компакт / 5 строк)</option>
                    <option value="⚡ Мини-Смартфон (3 строки: Сетап / Зона / Цели)">⚡ Мини-Смартфон (3 строки: Сетап / Зона / Цели)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 7. PERFORMANCE & SERVER NETWORK PREFERENCES               */}
        {/* ======================================================== */}
        {activeSubTab === "performance" && (
          <div className="space-y-5 max-w-4xl">
            <div className="bg-[#0b0f1d] border border-gray-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Производительность, Опрос и Звуки</h3>
                    <p className="text-xs text-gray-400">Тонкая настройка сетевых запросов и звуковых сигналов</p>
                  </div>
                </div>

                <span className="text-xs font-mono text-emerald-400">
                  Uptime: {Math.floor(serverMeta.uptimeSeconds / 60)} мин
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 block">
                    Частота обновления котировок (сек):
                  </label>
                  <select
                    value={settings.serverPreferences.quotePollingIntervalSec}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        serverPreferences: {
                          ...prev.serverPreferences,
                          quotePollingIntervalSec: Number(e.target.value)
                        }
                      }))
                    }
                    className="w-full bg-[#111624] border border-gray-700 rounded-xl p-2 text-xs text-white font-mono"
                  >
                    <option value="1">1 сек (Максимальная точность / Скальпинг)</option>
                    <option value="2">2 сек (Оптимально)</option>
                    <option value="3">3 сек (Экономия трафика)</option>
                    <option value="5">5 сек (Медленный интернет)</option>
                    <option value="10">10 сек (Фоновый режим)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 block">
                    Интервал сборщика новостей и событий:
                  </label>
                  <select
                    value={settings.serverPreferences.newsRefreshIntervalMin}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        serverPreferences: {
                          ...prev.serverPreferences,
                          newsRefreshIntervalMin: Number(e.target.value)
                        }
                      }))
                    }
                    className="w-full bg-[#111624] border border-gray-700 rounded-xl p-2 text-xs text-white font-mono"
                  >
                    <option value="1">Каждую 1 минуту</option>
                    <option value="3">Каждые 3 минуты (Рекомендуется)</option>
                    <option value="5">Каждые 5 минут</option>
                    <option value="10">Каждые 10 минут</option>
                  </select>
                </div>
              </div>

              {/* Sound Alerts */}
              <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-3 p-3 rounded-xl bg-[#111624] border border-gray-800">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-amber-400" />
                  <div>
                    <span className="font-bold text-xs text-white block">Звуковые оповещения при сигналах</span>
                    <span className="text-[10px] text-gray-400">Синтезатор звука Web Audio API без внешних аудио-файлов</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={playTestBeep}
                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 transition cursor-pointer flex items-center gap-1"
                  >
                    <Play className="h-3 w-3 text-emerald-400" />
                    <span>Проверить звук</span>
                  </button>

                  <input
                    type="checkbox"
                    checked={settings.serverPreferences.soundAlerts}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        serverPreferences: {
                          ...prev.serverPreferences,
                          soundAlerts: e.target.checked
                        }
                      }))
                    }
                    className="rounded text-amber-500 focus:ring-0 h-4 w-4"
                  />
                </div>
              </div>

              {/* Clear server caches */}
              <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-xs text-white block">Очистка оперативного кэша сервера</span>
                  <span className="text-[10px] text-gray-400">Сброс кэшированных свечей и расчетов Gamma Exposure</span>
                </div>

                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/server/cache/clear", { method: "POST" });
                      if (res.ok) alert("Кэш сервера успешно очищен!");
                    } catch (e: any) {
                      alert("Ошибка очистки: " + e.message);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold transition cursor-pointer border border-gray-700 flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Очистить кэш</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
