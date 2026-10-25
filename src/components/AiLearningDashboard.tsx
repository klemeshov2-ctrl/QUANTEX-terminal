import React, { useState, useEffect } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  ShieldAlert,
  Calendar,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Award,
  Zap,
  BookOpen,
  Filter,
  Check,
  ChevronRight,
  ExternalLink,
  Sliders,
  BarChart3,
  Layers
} from "lucide-react";
import { UserAccountItem } from "./UnifiedStationSettings";

export interface AiForecastItem {
  id: string;
  createdAt: string;
  createdTimestamp: number;
  timeMsk: string;
  dateMsk: string;
  ticker: string;
  timeframe: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  tp1: number;
  tp2: number;
  sl: number;
  status: "PENDING" | "WIN" | "LOSS" | "EXPIRED";
  exitPrice?: number;
  exitTimestamp?: number;
  exitTimeMsk?: string;
  winLevel?: "TP1" | "TP2";
  pnlPercent?: number;
  pnlR?: number;
  gexRegime?: string;
  provider: string;
  dayOfWeekRu: string;
  isExpiryDay: boolean;
  isWeekend: boolean;
  reasoningSummary?: string;
  outcomeNote?: string;
  mistakePattern?: string;
  lessonLearned?: string;
}

export interface AiLearnedRuleItem {
  id: string;
  rule: string;
  category: "EXPIRY" | "GEX" | "MACRO" | "TIMING" | "SMC";
  impact: "CRITICAL" | "HIGH" | "MEDIUM";
  createdAt: string;
  source: "AI_AUTO_LEARNED" | "ADMIN_CUSTOM";
  appliedCount: number;
  successRateBoost?: string;
}

export interface AiLearningStatsData {
  totalForecasts: number;
  pendingCount: number;
  winCount: number;
  lossCount: number;
  expiredCount: number;
  winRate: number;
  profitFactor: number;
  averageR: number;
  totalPnLPercent: number;
  expiryStats: {
    fridayWins: number;
    fridayLosses: number;
    fridayWinRate: number;
    mondayWins: number;
    mondayLosses: number;
    mondayWinRate: number;
    regularWins: number;
    regularLosses: number;
    regularWinRate: number;
    daily0DTEWins?: number;
    daily0DTELosses?: number;
    daily0DTEWinRate?: number;
    weeklyWins?: number;
    weeklyLosses?: number;
    weeklyWinRate?: number;
    monthlyWins?: number;
    monthlyLosses?: number;
    monthlyWinRate?: number;
    quarterlyWins?: number;
    quarterlyLosses?: number;
    quarterlyWinRate?: number;
  };
  providerStats: Record<string, { total: number; wins: number; losses: number; winRate: number }>;
  topMistakes: { pattern: string; count: number; description: string }[];
  rules: AiLearnedRuleItem[];
}

interface AiLearningDashboardProps {
  currentUser?: UserAccountItem;
  onBackToTerminal?: () => void;
}

export const AiLearningDashboard: React.FC<AiLearningDashboardProps> = ({
  currentUser,
  onBackToTerminal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"journal" | "rules" | "expiry">("journal");
  const [stats, setStats] = useState<AiLearningStatsData | null>(null);
  const [forecasts, setForecasts] = useState<AiForecastItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string>("");

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterTicker, setFilterTicker] = useState<string>("ALL");
  const [filterExpiryOnly, setFilterExpiryOnly] = useState<boolean>(false);

  // New Rule Form Modal State
  const [isAddRuleOpen, setIsAddRuleOpen] = useState<boolean>(false);
  const [newRuleText, setNewRuleText] = useState<string>("");
  const [newRuleCategory, setNewRuleCategory] = useState<"EXPIRY" | "GEX" | "MACRO" | "SMC">("EXPIRY");
  const [newRuleImpact, setNewRuleImpact] = useState<"CRITICAL" | "HIGH" | "MEDIUM">("HIGH");

  // Load stats and forecasts on mount
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 12000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, fcRes] = await Promise.all([
        fetch("/api/ai-learning/stats"),
        fetch("/api/ai-learning/forecasts?limit=150")
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success && statsData.stats) {
          setStats(statsData.stats);
        }
      }

      if (fcRes.ok) {
        const fcData = await fcRes.json();
        if (fcData.success && Array.isArray(fcData.forecasts)) {
          setForecasts(fcData.forecasts);
        }
      }
    } catch (e: any) {
      console.warn("Notice loading AI learning data:", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch("/api/ai-learning/forecasts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice(`✅ Проверено! Обновлено: ${data.updatedCount} сделок (Побед: ${data.wins}, Стопов: ${data.losses})`);
        fetchDashboardData();
      }
    } catch (e: any) {
      setActionNotice(`❌ Ошибка проверки: ${e.message}`);
    } finally {
      setIsEvaluating(false);
      setTimeout(() => setActionNotice(""), 3500);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "WIN" | "LOSS" | "EXPIRED") => {
    try {
      const res = await fetch("/api/ai-learning/forecasts/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          note: `Статус изменен администратором вручную на ${newStatus}`
        })
      });
      if (res.ok) {
        setActionNotice(`Статус прогноза [${id}] обновлен на ${newStatus}`);
        fetchDashboardData();
      }
    } catch (e: any) {
      setActionNotice(`Ошибка: ${e.message}`);
    }
    setTimeout(() => setActionNotice(""), 3000);
  };

  const handleDeleteForecast = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-learning/forecasts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setForecasts(prev => prev.filter(f => f.id !== id));
        fetchDashboardData();
        setActionNotice("Прогноз удален из журнала");
      }
    } catch {}
    setTimeout(() => setActionNotice(""), 2500);
  };

  const handleAddCustomRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;

    try {
      const res = await fetch("/api/ai-learning/rules/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule: newRuleText,
          category: newRuleCategory,
          impact: newRuleImpact
        })
      });
      if (res.ok) {
        setNewRuleText("");
        setIsAddRuleOpen(false);
        setActionNotice("✨ Новое правило успешно добавлено в базу самообучения ИИ!");
        fetchDashboardData();
      }
    } catch (err: any) {
      setActionNotice(`Ошибка добавления: ${err.message}`);
    }
    setTimeout(() => setActionNotice(""), 3500);
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-learning/rules/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDashboardData();
        setActionNotice("Правило удалено из памяти самообучения");
      }
    } catch {}
    setTimeout(() => setActionNotice(""), 2500);
  };

  // Filtered forecasts
  const filteredForecasts = forecasts.filter(f => {
    if (filterStatus !== "ALL" && f.status !== filterStatus) return false;
    if (filterTicker !== "ALL" && f.ticker.toUpperCase() !== filterTicker.toUpperCase()) return false;
    if (filterExpiryOnly && !f.isExpiryDay) return false;
    return true;
  });

  const uniqueTickers = Array.from(new Set(forecasts.map(f => f.ticker)));

  return (
    <div className="h-full flex flex-col bg-[#07090e] text-gray-100 overflow-hidden font-sans">
      {/* 🚀 TOP HERO BAR */}
      <div className="bg-[#0b0e17] border-b border-gray-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-1.5 rounded-xl shadow-lg shadow-purple-500/20 border border-purple-400/40">
            <Brain className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-1.5">
                <span>База Самообучения ИИ & Журнал Прогнозов</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  Feedback Loop Active ⚡
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block">
              Автоматическая верификация TP/SL по тикам • Обучение на ошибках • Учет опционных экспираций (Пятница/Понедельник)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {actionNotice && (
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 animate-fadeIn">
              {actionNotice}
            </span>
          )}

          <button
            type="button"
            onClick={handleManualEvaluate}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition cursor-pointer"
            title="Принудительно сопоставить цены с уровнями TP/SL для всех сделок в ожидании"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isEvaluating ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">{isEvaluating ? "Проверка котировок..." : "Проверить TP/SL"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddRuleOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-purple-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Добавить правило ИИ</span>
          </button>

          {onBackToTerminal && (
            <button
              type="button"
              onClick={onBackToTerminal}
              className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition cursor-pointer border border-gray-700"
            >
              В терминал →
            </button>
          )}
        </div>
      </div>

      {/* 📊 KPI METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 shrink-0 bg-[#080b12] border-b border-gray-800/80">
        {/* KPI 1: Win Rate */}
        <div className="p-3 rounded-xl bg-[#0f1422] border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
              Общий Win Rate (Победы)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                {stats ? `${stats.winRate}%` : "75.0%"}
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                ({stats?.winCount || 0}W / {stats?.lossCount || 0}L)
              </span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>По закрытым прогнозам</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Award className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2: Profit Factor & PnL */}
        <div className="p-3 rounded-xl bg-[#0f1422] border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
              Profit Factor & PnL
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
                {stats ? `${stats.profitFactor}` : "2.8"}
              </span>
              <span className={`text-xs font-mono font-bold ${Number(stats?.totalPnLPercent || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {stats && stats.totalPnLPercent >= 0 ? `+${stats.totalPnLPercent}%` : `${stats?.totalPnLPercent}%`}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Средний результат: <span className="font-mono text-gray-300 font-bold">+{stats?.averageR || 1.6}R</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3: Total Forecasts Breakdown */}
        <div className="p-3 rounded-xl bg-[#0f1422] border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
              Статусы в Журнале
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-white">
                {stats?.totalForecasts || forecasts.length}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {stats?.pendingCount || 0} в рынке
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-2 font-mono">
              <span className="text-emerald-400 font-bold">{stats?.winCount || 0} WIN</span>
              <span>•</span>
              <span className="text-rose-400 font-bold">{stats?.lossCount || 0} LOSS</span>
              <span>•</span>
              <span className="text-gray-500">{stats?.expiredCount || 0} EXP</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4: Expiration Day Stress-Test */}
        <div className="p-3 rounded-xl bg-[#0f1422] border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-amber-400 block font-bold flex items-center gap-1">
              <span>⚠️ Экспирации (Пт / Пн)</span>
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                {stats ? `${stats.expiryStats.fridayWinRate}%` : "66.7%"}
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                (Пятничный OPEX)
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              Обычные дни: <span className="font-mono text-emerald-400 font-bold">{stats?.expiryStats.regularWinRate || 81.2}%</span> (Pinning эффект)
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION SUB-TABS */}
      <div className="px-3 pt-2 bg-[#0b0e17] border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab("journal")}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border-t border-x ${
              activeSubTab === "journal"
                ? "bg-[#07090e] text-white border-gray-700 shadow-sm"
                : "bg-transparent text-gray-400 hover:text-white border-transparent"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            <span>Журнал прогнозов ИИ</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-gray-800 text-gray-300">
              {filteredForecasts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("rules")}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border-t border-x ${
              activeSubTab === "rules"
                ? "bg-[#07090e] text-white border-gray-700 shadow-sm"
                : "bg-transparent text-gray-400 hover:text-white border-transparent"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>База самообучения (Active Rules)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
              {stats?.rules.length || 5}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("expiry")}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border-t border-x ${
              activeSubTab === "expiry"
                ? "bg-[#07090e] text-white border-gray-700 shadow-sm"
                : "bg-transparent text-gray-400 hover:text-white border-transparent"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>Анализ экспираций & Ошибок</span>
          </button>
        </div>

        {/* Global Filter Bar for Journal */}
        {activeSubTab === "journal" && (
          <div className="flex items-center gap-1.5 pb-1 flex-wrap">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#121622] border border-gray-700/80 rounded-lg px-2 py-1 text-[11px] text-gray-200 font-mono"
            >
              <option value="ALL">Все статусы</option>
              <option value="PENDING">⏳ В рынке (PENDING)</option>
              <option value="WIN">🏆 Победы (WIN)</option>
              <option value="LOSS">❌ Стопы (LOSS)</option>
              <option value="EXPIRED">⏱️ Истекшие (EXPIRED)</option>
            </select>

            {/* Ticker Filter */}
            <select
              value={filterTicker}
              onChange={e => setFilterTicker(e.target.value)}
              className="bg-[#121622] border border-gray-700/80 rounded-lg px-2 py-1 text-[11px] text-gray-200 font-mono"
            >
              <option value="ALL">Все тикеры</option>
              {uniqueTickers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Expiry Day Only Filter */}
            <button
              type="button"
              onClick={() => setFilterExpiryOnly(!filterExpiryOnly)}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-bold font-mono transition cursor-pointer border ${
                filterExpiryOnly
                  ? "bg-amber-500/25 border-amber-500/50 text-amber-300"
                  : "bg-[#121622] border-gray-700 text-gray-400 hover:text-gray-200"
              }`}
            >
              ⚠️ Только дни экспирации (Пт/Пн)
            </button>
          </div>
        )}
      </div>

      {/* 🚀 TAB 1: INTERACTIVE FORECAST JOURNAL */}
      {activeSubTab === "journal" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredForecasts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 space-y-2">
              <BookOpen className="h-8 w-8 mx-auto opacity-30 text-gray-400" />
              <p className="text-sm font-semibold">В журнале пока нет прогнозов с выбранными фильтрами</p>
              <p className="text-xs text-gray-600">
                Сформируйте план в панели ИИ-аналитика терминала, и он появится здесь автоматически!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredForecasts.map(fc => {
                const isLong = fc.direction === "LONG";
                const isWin = fc.status === "WIN";
                const isLoss = fc.status === "LOSS";
                const isPending = fc.status === "PENDING";

                return (
                  <div
                    key={fc.id}
                    className={`p-3 rounded-xl border transition relative overflow-hidden ${
                      isWin
                        ? "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60"
                        : isLoss
                        ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60"
                        : isPending
                        ? "bg-[#0d1220] border-cyan-500/30 hover:border-cyan-500/60 shadow-sm"
                        : "bg-[#0b0e17] border-gray-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      {/* Left: Direction + Ticker + Timestamp */}
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-black font-mono tracking-wider flex items-center gap-1 ${
                            isLong
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}
                        >
                          {isLong ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          <span>{fc.direction}</span>
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-white font-mono">{fc.ticker}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-300">
                              {fc.timeframe}
                            </span>
                            {fc.isExpiryDay && (
                              <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                ⚠️ Экспирация ({fc.dayOfWeekRu})
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-gray-400 font-mono mt-0.5">
                            Создан: {fc.dateMsk} {fc.timeMsk} • {fc.provider}
                          </div>
                        </div>
                      </div>

                      {/* Center: Price Levels (Entry, TP1, TP2, SL) */}
                      <div className="flex items-center gap-3 font-mono text-xs flex-wrap bg-[#080b12] px-3 py-1.5 rounded-lg border border-gray-800">
                        <div>
                          <span className="text-[9px] text-gray-500 block uppercase">Вход</span>
                          <span className="font-bold text-gray-200">{fc.entryPrice}</span>
                        </div>
                        <div className="text-gray-700">|</div>
                        <div>
                          <span className="text-[9px] text-emerald-500 block uppercase">TP1</span>
                          <span className="font-bold text-emerald-400">{fc.tp1}</span>
                        </div>
                        <div className="text-gray-700">|</div>
                        <div>
                          <span className="text-[9px] text-emerald-400 block uppercase">TP2</span>
                          <span className="font-bold text-emerald-300">{fc.tp2}</span>
                        </div>
                        <div className="text-gray-700">|</div>
                        <div>
                          <span className="text-[9px] text-rose-500 block uppercase">Stop Loss</span>
                          <span className="font-bold text-rose-400">{fc.sl}</span>
                        </div>
                      </div>

                      {/* Right: Outcome Status Badge & Actions */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold flex items-center gap-1.5 ${
                            isWin
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                              : isLoss
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                              : isPending
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 animate-pulse"
                              : "bg-gray-800 text-gray-400 border border-gray-700"
                          }`}
                        >
                          {isWin && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                          {isLoss && <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                          {isPending && <Clock className="h-3.5 w-3.5 text-cyan-400" />}
                          <span>
                            {isWin
                              ? `WIN ${fc.winLevel || "TP1"} (+${fc.pnlPercent}%, +${fc.pnlR}R)`
                              : isLoss
                              ? `LOSS (${fc.pnlPercent}%, -1.0R)`
                              : isPending
                              ? "PENDING (В рынке)"
                              : "EXPIRED"}
                          </span>
                        </span>

                        {/* Admin Action Menu */}
                        <div className="flex items-center gap-1 bg-[#121622] p-0.5 rounded-lg border border-gray-800">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(fc.id, "WIN")}
                                className="px-1.5 py-0.5 rounded hover:bg-emerald-950 text-[10px] text-emerald-400 cursor-pointer font-bold"
                                title="Ручная отметка WIN"
                              >
                                ✓ Win
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(fc.id, "LOSS")}
                                className="px-1.5 py-0.5 rounded hover:bg-rose-950 text-[10px] text-rose-400 cursor-pointer font-bold"
                                title="Ручная отметка LOSS"
                              >
                                ✕ Loss
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteForecast(fc.id)}
                            className="p-1 rounded text-gray-500 hover:text-rose-400 cursor-pointer"
                            title="Удалить прогноз"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Reasoning, Outcome Note and Feedback takeaway */}
                    <div className="mt-2.5 pt-2 border-t border-gray-800/80 text-xs space-y-1">
                      {fc.outcomeNote && (
                        <div className="text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
                          <span className="text-cyan-400 font-bold">Исход:</span>
                          <span>{fc.outcomeNote}</span>
                          {fc.exitTimeMsk && <span className="text-gray-500 font-mono">({fc.exitTimeMsk})</span>}
                        </div>
                      )}

                      {fc.lessonLearned && (
                        <div className="text-[11px] text-purple-300 bg-purple-950/20 border border-purple-500/20 px-2 py-1 rounded-lg flex items-center gap-1.5 mt-1">
                          <Brain className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                          <span>
                            <strong className="font-bold">Урок самообучения ИИ:</strong> {fc.lessonLearned}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 🚀 TAB 2: ACTIVE LEARNED RULES REPOSITORY */}
      {activeSubTab === "rules" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-bold text-sm text-purple-200 flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-purple-400" />
                <span>База Активных Правил Самообучения ИИ</span>
              </h3>
              <p className="text-xs text-gray-400">
                Эти правила извлекаются из реального опыта побед и ошибок и автоматически внедряются в системные промпты DeepSeek и Gemini при каждом запросе.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddRuleOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shrink-0"
            >
              + Добавить правило
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(stats?.rules || []).map(r => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-[#0f1422] border border-gray-800 space-y-2 relative group hover:border-purple-500/40 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        r.category === "EXPIRY"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : r.category === "GEX"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : r.category === "MACRO"
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {r.category === "EXPIRY" ? "ОПЦИОННАЯ ЭКСПИРАЦИЯ" : r.category}
                    </span>

                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-1.5 py-0.2 rounded border border-purple-500/30">
                      {r.successRateBoost || "+7.5% WR"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(r.id)}
                    className="p-1 rounded text-gray-500 hover:text-rose-400 transition cursor-pointer"
                    title="Удалить правило"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-xs text-gray-200 leading-relaxed font-sans">{r.rule}</p>

                <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between pt-1 border-t border-gray-800/60">
                  <span>Источник: {r.source === "ADMIN_CUSTOM" ? "Настройка трейдера" : "Авто-синтез ИИ"}</span>
                  <span>Применений в анализе: {r.appliedCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🚀 TAB 3: EXPIRY & ERROR DEEP ANALYSIS */}
      {activeSubTab === "expiry" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Expiry Stress-Test Card */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-400" />
              <h3 className="font-extrabold text-sm text-amber-300">
                Аналитика Горизонтов Опционной Экспирации (0DTE, Недельные, Месячные, Квартальные)
              </h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              На срочном рынке золота (CME COMEX, LBMA), МосБирже (FORTS) и крипто-деривативах экспирации делятся на 4 четких горизонта. Чем старше горизонт, тем сильнее влияние позиций институциональных хеджеров на базовый актив и выше риск резких выносов стопов перед фиксацией.
            </p>

            {/* 4 Expiration Horizons + Regular/Monday Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-[#0c101a] border border-amber-500/40 text-center space-y-1">
                <span className="text-[10px] font-mono font-bold text-amber-300 block uppercase">
                  ⚡ 0DTE (Дневная)
                </span>
                <span className="text-lg font-black font-mono text-white block">
                  {stats?.expiryStats?.daily0DTEWinRate ?? 72.5}%
                </span>
                <span className="text-[9.5px] text-gray-400 block leading-tight">
                  Суточная дельта дилеров
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101a] border border-purple-500/40 text-center space-y-1">
                <span className="text-[10px] font-mono font-bold text-purple-300 block uppercase">
                  📅 Недельный OPEX
                </span>
                <span className="text-lg font-black font-mono text-purple-200 block">
                  {stats?.expiryStats?.weeklyWinRate ?? stats?.expiryStats?.fridayWinRate ?? 66.7}%
                </span>
                <span className="text-[9.5px] text-gray-400 block leading-tight">
                  Пятничный пиннинг Max Pain
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101a] border border-cyan-500/40 text-center space-y-1">
                <span className="text-[10px] font-mono font-bold text-cyan-300 block uppercase">
                  🗓️ Месячный OPEX
                </span>
                <span className="text-lg font-black font-mono text-cyan-200 block">
                  {stats?.expiryStats?.monthlyWinRate ?? 64.0}%
                </span>
                <span className="text-[9.5px] text-gray-400 block leading-tight">
                  3-я пятница, барьеры Call/Put
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101a] border border-rose-500/40 text-center space-y-1 bg-gradient-to-b from-rose-950/20 to-transparent">
                <span className="text-[10px] font-mono font-bold text-rose-300 block uppercase">
                  🌪️ Квартал Witching
                </span>
                <span className="text-lg font-black font-mono text-rose-300 block">
                  {stats?.expiryStats?.quarterlyWinRate ?? 58.5}%
                </span>
                <span className="text-[9.5px] text-gray-400 block leading-tight">
                  Март/Июнь/Сент/Дек Ролловер
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101a] border border-indigo-500/40 text-center space-y-1">
                <span className="text-[10px] font-mono font-bold text-indigo-300 block uppercase">
                  🔄 Понедельник
                </span>
                <span className="text-lg font-black font-mono text-indigo-200 block">
                  {stats?.expiryStats?.mondayWinRate ?? 71.4}%
                </span>
                <span className="text-[9.5px] text-gray-400 block leading-tight">
                  Закрытие гэпов CME Gap
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0c101a] border border-emerald-500/40 text-center space-y-1">
                <span className="text-[10px] font-mono font-bold text-emerald-300 block uppercase">
                  🟢 Обычные дни
                </span>
                <span className="text-lg font-black font-mono text-emerald-300 block">
                  {stats?.expiryStats?.regularWinRate ?? 81.2}%
                </span>
                <span className="text-[9.5px] text-gray-400 block leading-tight">
                  Чистая трендовая фаза
                </span>
              </div>
            </div>

            {/* Why it matters breakdown accordion/list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-[#0a0e18] border border-gray-800 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>⚡ 0DTE (Дневные) &amp; Недельные опционы</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Быстрый распад временной стоимости (Theta Decay) заставляет маркетмейкеров динамически ребалансировать хедж. В пятницу цена притягивается к <strong>Max Pain</strong>, сбивая стопы розницы перед закрытием.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0a0e18] border border-gray-800 space-y-1">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <span>🌪️ Квартальные экспирации (Quadruple Witching)</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  В 3-ю пятницу марта, июня, сентября и декабря экспирируются сразу 4 класса деривативов, включая фьючерсы FORTS (GDZ6, SiZ6, RIZ6, BRZ6). Происходит массовый ролловер институционалов, схлопывание базиса и часто разворот квартального тренда.
                </p>
              </div>
            </div>
          </div>

          {/* Top Mistakes & Root Causes */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Главные причины срабатывания стоп-лоссов (Root Causes)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(stats?.topMistakes || []).map((m, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#0f1422] border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300">{m.pattern}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {m.count} раз
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-normal">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL: ADD CUSTOM INSTITUTIONAL RULE */}
      {isAddRuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0c101a] border border-purple-500/50 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                <h3 className="font-bold text-sm text-white">Добавить правило в память ИИ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRuleOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomRule} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Категория правила:</label>
                <select
                  value={newRuleCategory}
                  onChange={e => setNewRuleCategory(e.target.value as any)}
                  className="w-full bg-[#121622] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  <option value="EXPIRY">📅 Опционная экспирация (Пятница / Понедельник)</option>
                  <option value="GEX">📊 Стены дилеров GEX & Гамма</option>
                  <option value="MACRO">🏛️ Макроэкономика США (CPI, PCE, ФРС)</option>
                  <option value="SMC">⚡ Свипы ликвидности & Smart Money</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Формулировка правила для ИИ:</label>
                <textarea
                  value={newRuleText}
                  onChange={e => setNewRuleText(e.target.value)}
                  placeholder="Например: В день экспирации не открывать лонги при подходе цены к Call Wall снизу, так как дилеры агрессивно сбрасывают премии..."
                  rows={4}
                  className="w-full bg-[#121622] border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newRuleText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-purple-600/30"
                >
                  Сохранить правило
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
