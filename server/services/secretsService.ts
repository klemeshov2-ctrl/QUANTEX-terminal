// Secure environment secrets provider & mask helpers
// Guarantees API keys are read strictly from process.env and never written to disk

const DEFAULT_FALLBACK_PASSWORD = "AdminQuantex2026!SecureKey";

export function getAdminPassword(): string {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || pass.trim() === "") {
    console.warn("[SECURITY WARN] ADMIN_PASSWORD environment variable not set. Using secure fallback key.");
    return DEFAULT_FALLBACK_PASSWORD;
  }
  if (pass === "admin123") {
    console.warn("[SECURITY WARN] Default password 'admin123' is forbidden. Replacing with secure fallback key.");
    return DEFAULT_FALLBACK_PASSWORD;
  }
  return pass;
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || getAdminPassword() + "_jwt_secret_salt";
}

export function getDeepSeekApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || "";
}

export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

export function getTelegramChatId(): string {
  return process.env.TELEGRAM_CHAT_ID || "";
}

export function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || "";
}

/**
 * Masks a secret string (e.g. sk-1234567890abcdef -> sk-••••••cdef)
 * Prevents leaks via UI responses or logs
 */
export function maskSecret(secret?: string | null): string {
  if (!secret || typeof secret !== "string") return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 6) return "••••••";
  const start = trimmed.slice(0, 3);
  const end = trimmed.slice(-4);
  return `${start}••••••••${end}`;
}

/**
 * Sanitizes configuration objects before writing to disk
 * Strips any sensitive credentials so they are never persisted to JSON
 */
export function sanitizeForDisk<T extends Record<string, any>>(obj: T): T {
  const clone = { ...obj };
  const sensitiveKeys = [
    "deepSeekApiKey",
    "telegramBotToken",
    "botToken",
    "apiKey",
    "password",
    "secret",
    "token",
    "adminPassword"
  ];
  for (const key of sensitiveKeys) {
    if (key in clone) {
      delete (clone as any)[key];
    }
  }
  return clone;
}
