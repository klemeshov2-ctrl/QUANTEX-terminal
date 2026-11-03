import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { 
  Cpu, 
  Sparkles,
  Server,
  Zap,
  Lock,
  User,
  Crown,
  Brain,
  BarChart3
} from "lucide-react";
import ServerDeploymentHub from "./components/ServerDeploymentHub";
import { DeepSeekGoldScheduler } from "./components/DeepSeekGoldScheduler";
import { AutonomousTradingStation } from "./components/AutonomousTradingStation";
import { AiLearningDashboard } from "./components/AiLearningDashboard";
import { IndicatorStatsDashboard } from "./components/IndicatorStatsDashboard";
import { PasswordAuthModal } from "./components/PasswordAuthModal";
import { UserAccountItem } from "./components/UnifiedStationSettings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { getStoredJwtToken, clearStoredAuth } from "./lib/apiClient";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getStoredJwtToken());
  });

  const [currentUser, setCurrentUser] = useState<UserAccountItem>(() => {
    try {
      const saved = localStorage.getItem("quantex_active_user");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      id: "usr-admin",
      username: "admin",
      role: "admin",
      allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings", "ai_learning"],
      createdAt: "2026-10-21"
    };
  });

  // Listen for 401 Unauthorized events from apiClient to prompt re-login
  useEffect(() => {
    const handleAuthRequired = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener("quantex_auth_required", handleAuthRequired);
    return () => {
      window.removeEventListener("quantex_auth_required", handleAuthRequired);
    };
  }, []);

  // Protect Admin routes against direct URL access
  useEffect(() => {
    const adminRoutes = ["/autopilot", "/server", "/ai-learning"];
    if (currentUser.role !== "admin" && adminRoutes.includes(location.pathname)) {
      navigate("/station", { replace: true });
    }
  }, [currentUser.role, location.pathname, navigate]);

  const handleUserChange = (user: UserAccountItem) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("quantex_active_user", JSON.stringify(user));
    } catch {}
  };

  const handleLogout = () => {
    clearStoredAuth();
    setIsAuthenticated(false);
  };

  const currentPath = location.pathname;

  return (
    <div className="h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[#07090e] text-gray-100 font-sans flex flex-col antialiased selection:bg-blue-500/30 selection:text-white">
      
      {/* 🚀 TOP NAVIGATION BAR WITH REACT ROUTER */}
      <header className="bg-[#0b0e17] border-b border-gray-800/90 px-2 sm:px-4 py-1 flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-none touch-pan-x select-none">
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 cursor-pointer" onClick={() => navigate("/station")}>
            <div className="bg-gradient-to-tr from-amber-500 via-purple-600 to-cyan-500 p-1 rounded-lg shadow-md shadow-amber-500/20 border border-amber-400/30">
              <Cpu className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="font-display font-bold text-xs sm:text-sm tracking-tight text-white uppercase whitespace-nowrap">
              QUANTEX <span className="text-amber-400 hidden sm:inline">Terminal</span>
            </h1>
          </div>

          <div className="h-3.5 w-px bg-gray-800 shrink-0" />

          {/* Router Nav Links */}
          <nav className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => navigate("/station")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentPath === "/" || currentPath === "/station"
                  ? "bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-600 text-black shadow-md shadow-amber-500/30 ring-1 ring-amber-400/50"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <Zap className="h-3 w-3 shrink-0" />
              <span>Терминал</span>
            </button>

            {currentUser.role === "admin" && (
              <>
                <button
                  onClick={() => navigate("/autopilot")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    currentPath === "/autopilot"
                      ? "bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-600 text-white shadow-md shadow-amber-500/30 ring-1 ring-amber-400/50"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                  }`}
                  title="Административный модуль автопилота"
                >
                  <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
                  <span>Автопилот</span>
                </button>

                <button
                  onClick={() => navigate("/server")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    currentPath === "/server"
                      ? "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                  }`}
                  title="Управление сервером и деплоем"
                >
                  <Server className="h-3 w-3 text-cyan-300 shrink-0" />
                  <span>Сервер</span>
                </button>

                <button
                  onClick={() => navigate("/ai-learning")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    currentPath === "/ai-learning"
                      ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-purple-500/30 ring-1 ring-purple-400/50"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                  }`}
                  title="Самообучение ИИ, журнал прогнозов и статистика экспирации опционов"
                >
                  <Brain className="h-3 w-3 text-purple-300 shrink-0" />
                  <span>Самообучение ИИ</span>
                </button>
              </>
            )}

            <button
              onClick={() => navigate("/indicator-stats")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentPath === "/indicator-stats"
                  ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400/50"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
              title="Постоянная статистика сигналов и сетапов индикатора"
            >
              <BarChart3 className="h-3 w-3 text-emerald-300 shrink-0" />
              <span>Стат. Индикатора</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <div className="hidden lg:flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-lg text-[10px] text-gray-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>UTC+3 (МСК)</span>
          </div>

          {/* Quick Active User Badge in top App Bar */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 border border-gray-800 text-[11px] font-mono text-gray-200 shrink-0"
            title={`Пользователь сервера: ${currentUser.username} (${currentUser.role})`}
          >
            {currentUser.role === "admin" ? (
              <Crown className="h-3 w-3 text-amber-400" />
            ) : (
              <User className="h-3 w-3 text-cyan-400" />
            )}
            <span className="font-bold text-xs">{currentUser.username}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-[11px] transition cursor-pointer border border-gray-700 shrink-0"
            title="Сменить пользователя или заблокировать"
          >
            <Lock className="h-3 w-3 text-cyan-400" />
            <span className="hidden md:inline">Сменить / Выход</span>
          </button>
        </div>
      </header>

      {/* 🔐 PASSWORD & USER AUTHENTICATION MODAL */}
      {!isAuthenticated && (
        <PasswordAuthModal
          onAuthenticated={(user) => {
            setIsAuthenticated(true);
            if (user) {
              handleUserChange(user);
            }
          }}
        />
      )}

      {/* 🚀 MAIN CONTENT BODY WITH REACT ROUTER OUTLET */}
      <main className="flex-1 min-h-0 bg-[#07090e] overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <AutonomousTradingStation
                currentUser={currentUser}
                onUserChange={handleUserChange}
                onOpenAuthModal={() => setIsAuthenticated(false)}
                onNavigateToTab={(tab) => {
                  if (tab === "station") navigate("/station");
                  else if (tab === "gold_deepseek") navigate("/autopilot");
                  else if (tab === "server_deploy") navigate("/server");
                  else if (tab === "ai_learning") navigate("/ai-learning");
                  else if (tab === "indicator_stats") navigate("/indicator-stats");
                }}
              />
            }
          />
          <Route
            path="/station"
            element={
              <AutonomousTradingStation
                currentUser={currentUser}
                onUserChange={handleUserChange}
                onOpenAuthModal={() => setIsAuthenticated(false)}
                onNavigateToTab={(tab) => {
                  if (tab === "station") navigate("/station");
                  else if (tab === "gold_deepseek") navigate("/autopilot");
                  else if (tab === "server_deploy") navigate("/server");
                  else if (tab === "ai_learning") navigate("/ai-learning");
                  else if (tab === "indicator_stats") navigate("/indicator-stats");
                }}
              />
            }
          />
          <Route
            path="/autopilot"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} currentUser={currentUser} requiredRole="admin">
                <DeepSeekGoldScheduler />
              </ProtectedRoute>
            }
          />
          <Route
            path="/server"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} currentUser={currentUser} requiredRole="admin">
                <ServerDeploymentHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-learning"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} currentUser={currentUser} requiredRole="admin">
                <div className="h-full overflow-y-auto md:overflow-hidden touch-pan-y overscroll-contain">
                  <AiLearningDashboard
                    currentUser={currentUser}
                    onBackToTerminal={() => navigate("/station")}
                  />
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/indicator-stats"
            element={
              <div className="h-full overflow-y-auto md:overflow-hidden touch-pan-y overscroll-contain">
                <IndicatorStatsDashboard
                  currentUser={currentUser}
                  onBackToTerminal={() => navigate("/station")}
                  onSelectTicker={(ticker) => {
                    try {
                      localStorage.setItem("quantex_active_asset", ticker);
                    } catch {}
                    navigate("/station");
                  }}
                />
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/station" replace />} />
        </Routes>
      </main>

      {/* 🛡️ FOOTER */}
      <footer className="bg-[#05070a] border-t border-gray-800/80 px-4 md:px-6 py-1 hidden md:flex items-center justify-between gap-2 shrink-0 text-xs text-gray-500">
        <div className="flex items-center gap-1.5 truncate text-[11px]">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="truncate">QUANTEX Terminal • Protected React Router • JWT Secured • Zero Command Injection</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[9.5px] bg-gray-900 border border-gray-800 px-2 py-0.5 rounded text-gray-400">
            QUANTEX Pro v8
          </span>
        </div>
      </footer>
    </div>
  );
}
