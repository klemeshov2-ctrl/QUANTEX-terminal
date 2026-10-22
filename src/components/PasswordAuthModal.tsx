import React, { useState, useEffect } from "react";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Crown,
  CheckCircle2
} from "lucide-react";

export interface PublicUserInfo {
  id: string;
  username: string;
  role: "admin" | "trader" | "analyst" | "viewer" | string;
  allowedTabs: string[];
  createdAt?: string;
}

interface PasswordAuthModalProps {
  onAuthenticated: (user?: any) => void;
}

export const PasswordAuthModal: React.FC<PasswordAuthModalProps> = ({ onAuthenticated }) => {
  const [usersList, setUsersList] = useState<PublicUserInfo[]>([
    {
      id: "usr-admin",
      username: "admin",
      role: "admin",
      allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings"]
    },
    {
      id: "usr-trader",
      username: "trader1",
      role: "trader",
      allowedTabs: ["chart", "gex", "calendar", "journal"]
    },
    {
      id: "usr-analyst",
      username: "analyst1",
      role: "analyst",
      allowedTabs: ["chart", "gex", "calendar"]
    }
  ]);

  const [selectedUsername, setSelectedUsername] = useState<string>("admin");
  const [customUsername, setCustomUsername] = useState<string>("");
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Check if session token exists AND user is in localStorage
    const savedToken = sessionStorage.getItem("st_server_auth_token");
    const savedUserStr = localStorage.getItem("quantex_active_user");
    if (savedToken === "authenticated" && savedUserStr) {
      try {
        const u = JSON.parse(savedUserStr);
        onAuthenticated(u);
        return;
      } catch {}
    }

    // Fetch live users and server security status
    fetch("/api/auth/status")
      .then(res => res.json())
      .then(data => {
        if (!data.requirePasswordAuth) {
          const defaultAdmin = (data.users && data.users.find((u: any) => u.role === "admin")) || {
            id: "usr-admin",
            username: "admin",
            role: "admin",
            allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings"]
          };
          sessionStorage.setItem("st_server_auth_token", "authenticated");
          localStorage.setItem("quantex_active_user", JSON.stringify(defaultAdmin));
          onAuthenticated(defaultAdmin);
          return;
        }

        if (Array.isArray(data.users) && data.users.length > 0) {
          setUsersList(data.users);
          if (savedUserStr) {
            try {
              const u = JSON.parse(savedUserStr);
              if (data.users.some((x: any) => x.username.toLowerCase() === u.username?.toLowerCase())) {
                setSelectedUsername(u.username);
              }
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, [onAuthenticated]);

  const effectiveUsername = isManualInput ? customUsername.trim() : selectedUsername;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUsername) {
      setError("Выберите или введите имя пользователя");
      return;
    }
    if (!password.trim()) {
      setError("Введите пароль");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: effectiveUsername,
          password: password.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        sessionStorage.setItem("st_server_auth_token", "authenticated");
        localStorage.setItem("quantex_active_user", JSON.stringify(data.user));
        onAuthenticated(data.user);
      } else {
        setError(data.error || "Неверный пароль или учетные данные пользователя");
      }
    } catch (err: any) {
      setError("Ошибка проверки соединения с сервером");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06080e]/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-[#0d121f] border border-cyan-500/30 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 relative overflow-hidden font-sans">
        {/* Glow accents */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-indigo-600/20 to-amber-500/20 border border-cyan-500/40 text-cyan-300 shadow-lg">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
            QUANTEX Terminal
          </h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Вход в защищенную систему управления
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* User Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-cyan-400" />
                <span>Пользователь:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsManualInput(!isManualInput);
                  setError(null);
                }}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                {isManualInput ? "Выбрать из списка" : "Ввести вручную"}
              </button>
            </div>

            {!isManualInput ? (
              <div className="grid grid-cols-3 gap-2">
                {usersList.map((u) => {
                  const isSelected = selectedUsername.toLowerCase() === u.username.toLowerCase();
                  const isAdmin = u.role === "admin";
                  return (
                    <button
                      key={u.id || u.username}
                      type="button"
                      onClick={() => {
                        setSelectedUsername(u.username);
                        setError(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 relative ${
                        isSelected
                          ? "bg-gradient-to-br from-cyan-950/70 to-blue-950/70 border-cyan-400 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50"
                          : "bg-[#0a0d18] border-gray-800 text-gray-300 hover:bg-gray-800/60 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs truncate flex items-center gap-1">
                          {isAdmin ? <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" /> : <User className="h-3 w-3 text-cyan-400 shrink-0" />}
                          <span>{u.username}</span>
                        </span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
                      </div>

                      <div className="text-[10px] text-gray-400 font-mono">
                        {isAdmin ? "Admin" : u.role === "trader" ? "Трейдер" : u.role === "analyst" ? "Аналитик" : "Пользователь"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value)}
                placeholder="Введите имя пользователя..."
                className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition font-mono"
              />
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
              <label>Пароль:</label>
              <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль..."
                autoFocus
                className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-white transition cursor-pointer"
                title={showPassword ? "Скрыть" : "Показать"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-xs text-red-300 text-center font-medium">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !effectiveUsername}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Войти</span>
                <ArrowRight className="h-4 w-4 opacity-75" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-2 border-t border-gray-800 text-center text-[11px] text-gray-500">
          <span>QUANTEX Pro v8 • Платформа квантового анализа</span>
        </div>
      </div>
    </div>
  );
};
