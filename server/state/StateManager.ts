import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { getAdminPassword, getDeepSeekApiKey, getTelegramBotToken, getTelegramChatId, sanitizeForDisk } from "../services/secretsService";

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "WEBHOOK" | "AI_AUDIT";
  message: string;
  details?: any;
}

export interface TelegramSubscriber {
  chatId: string;
  username?: string;
  firstName?: string;
  status: "pending" | "approved" | "blocked";
  role: "admin" | "subscriber";
  requestedAt: string;
  approvedAt?: string;
  notes?: string;
}

export interface ScheduleCalendarSlot {
  id: string;
  dayOfWeek: number;
  timeMsk: string;
  label: string;
  enabled: boolean;
}

export interface GoldScheduleConfig {
  enabled: boolean;
  timesMsk: string[];
  timeframes: string[];
  deepSeekModel: "deepseek-chat" | "deepseek-reasoner";
  telegramEnabled: boolean;
  tradingPair: string;
  promptTemplate: string;
  scheduleCalendar: ScheduleCalendarSlot[];
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
    telegramAlertsEnabled: boolean;
    minImpact: "ALL" | "MEDIUM" | "HIGH" | "CRITICAL";
    categories: string[];
    keywords: string[];
    autoTriggerAnalysisOnNews: boolean;
    autoPollCalendar: boolean;
    pollIntervalMinutes: number;
    sources: string[];
    postNewsFollowupEnabled: boolean;
    postNewsDelayMinutes: number;
  };
  requireApprovalForNewUsers: boolean;
  moexGoldSynthesisEnabled: boolean;
  moexFuturesTicker: string;
  moexGldRubTicker: string;
}

export interface LockedPineSignal {
  setupId: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  trailingStop: number;
  initialSl: number;
  activeTrailingSl: number;
  trailingStageStr: string;
  tp1: number;
  tp2: number;
  tp3: number;
  altBreakLevel: number;
  breakEvenHit: boolean;
  createdAt: number;
  highestPriceAfterEntry: number;
  lowestPriceAfterEntry: number;
  entryHit: boolean;
  entryHitTime?: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  slHit: boolean;
  status: "WAITING_FOR_ENTRY" | "ACTIVE_IN_TRADE" | "MISSED_ENTRY";
  statusText: string;
  missedAt?: number;
}

export interface StationUserAccount {
  id: string;
  username: string;
  password?: string;
  role: "admin" | "user";
  allowedTabs: string[];
  createdAt: string;
}

export class StateManager {
  private static instance: StateManager;
  private dataDir: string;
  private logs: ServerLogEntry[] = [];
  private maxLogs: number = 200;

  private subscribers: TelegramSubscriber[] = [];
  private lockedSignal: LockedPineSignal | null = null;
  private sentNews: Set<string> = new Set<string>();

  private goldConfig: GoldScheduleConfig = {
    enabled: true,
    timesMsk: ["09:00", "15:00"],
    timeframes: ["15m", "30m", "1h", "4h"],
    deepSeekModel: "deepseek-chat",
    telegramEnabled: true,
    tradingPair: "XAUUSD (Золото / Доллар США)",
    promptTemplate: "Ты — профессиональный трейдер-скальпер. Твой язык — простой, строгий и понятный.",
    scheduleCalendar: [],
    scheduleCalendarEnabled: true,
    chartSourceMode: "standalone_engine",
    tradingViewChartUrl: "https://www.tradingview.com/chart/?symbol=OANDA:XAUUSD",
    tradingViewTimeframeMode: "single_layout",
    autoScreenshotsEnabled: true,
    telegramSendPhotos: true,
    dxyCorrelationFilter: true,
    newsFilter: {
      enabled: true,
      telegramAlertsEnabled: true,
      minImpact: "HIGH",
      categories: ["CENTRAL_BANKS", "INFLATION", "EMPLOYMENT", "GEOPOLITICS"],
      keywords: ["FOMC", "CPI", "NFP", "Rate", "Powell", "War", "Tariff"],
      autoTriggerAnalysisOnNews: true,
      autoPollCalendar: true,
      pollIntervalMinutes: 5,
      sources: ["ForexFactory", "Investing.com"],
      postNewsFollowupEnabled: true,
      postNewsDelayMinutes: 30
    },
    requireApprovalForNewUsers: false,
    moexGoldSynthesisEnabled: true,
    moexFuturesTicker: "GD",
    moexGldRubTicker: "GLDRUBF"
  };

  private stationUsers: StationUserAccount[] = [
    {
      id: "usr-admin",
      username: "admin",
      role: "admin",
      allowedTabs: ["chart", "gex", "calendar", "editor", "journal", "settings", "ai_learning"],
      createdAt: "2026-10-21"
    }
  ];

  private userPreferences: Record<string, any> = {};

  private constructor() {
    this.dataDir = path.join(process.cwd(), "data");
  }

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      if (!fsSync.existsSync(this.dataDir)) {
        await fs.mkdir(this.dataDir, { recursive: true });
      }
      await Promise.all([
        this.loadGoldConfig(),
        this.loadSubscribers(),
        this.loadLockedSignal(),
        this.loadStationSettings(),
        this.loadSentNews()
      ]);
      this.addLog("INFO", "StateManager успешно инициализирован, данные загружены асинхронно");
    } catch (err: any) {
      this.addLog("WARN", `Предупреждение при инициализации StateManager: ${err.message}`);
    }
  }

  // --- LOGGING ---
  public addLog(level: ServerLogEntry["level"], message: string, details?: any) {
    const entry: ServerLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    const logPrefix = `[${entry.timestamp}] [${level}]`;
    if (level === "ERROR") {
      console.error(logPrefix, message, details || "");
    } else if (level === "WARN") {
      console.warn(logPrefix, message, details || "");
    } else {
      console.log(logPrefix, message, details || "");
    }
  }

  public getLogs(): ServerLogEntry[] {
    return [...this.logs];
  }

  // --- SUBSCRIBERS ---
  public getSubscribers(): TelegramSubscriber[] {
    return [...this.subscribers];
  }

  public async setSubscribers(subs: TelegramSubscriber[]): Promise<void> {
    this.subscribers = subs;
    await this.persistSubscribers();
  }

  public async updateSubscriber(chatId: string, patch: Partial<TelegramSubscriber>): Promise<void> {
    const idx = this.subscribers.findIndex(s => s.chatId === chatId);
    if (idx !== -1) {
      this.subscribers[idx] = { ...this.subscribers[idx], ...patch };
      await this.persistSubscribers();
    }
  }

  private async persistSubscribers(): Promise<void> {
    try {
      const file = path.join(this.dataDir, "telegram-subscribers.json");
      await fs.writeFile(file, JSON.stringify(this.subscribers, null, 2), "utf-8");
    } catch (err: any) {
      this.addLog("ERROR", `Ошибка сохранения подписчиков: ${err.message}`);
    }
  }

  private async loadSubscribers(): Promise<void> {
    const file = path.join(this.dataDir, "telegram-subscribers.json");
    try {
      if (fsSync.existsSync(file)) {
        const raw = await fs.readFile(file, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.subscribers = parsed;
        }
      }
    } catch (err: any) {
      this.addLog("WARN", `Не удалось загрузить подписчиков: ${err.message}`);
    }
  }

  // --- GOLD CONFIG (SECRETS REMOVED FROM DISK) ---
  public getGoldConfig(): GoldScheduleConfig {
    return { ...this.goldConfig };
  }

  public async updateGoldConfig(patch: Partial<GoldScheduleConfig>): Promise<void> {
    this.goldConfig = {
      ...this.goldConfig,
      ...patch,
      newsFilter: {
        ...this.goldConfig.newsFilter,
        ...(patch.newsFilter || {})
      }
    };
    await this.persistGoldConfig();
  }

  private async persistGoldConfig(): Promise<void> {
    try {
      const file = path.join(this.dataDir, "gold-schedule-config.json");
      const safeConfig = sanitizeForDisk(this.goldConfig);
      await fs.writeFile(file, JSON.stringify(safeConfig, null, 2), "utf-8");
    } catch (err: any) {
      this.addLog("ERROR", `Ошибка сохранения конфигурации золота: ${err.message}`);
    }
  }

  private async loadGoldConfig(): Promise<void> {
    const file = path.join(this.dataDir, "gold-schedule-config.json");
    try {
      if (fsSync.existsSync(file)) {
        const raw = await fs.readFile(file, "utf-8");
        const saved = JSON.parse(raw);
        this.goldConfig = {
          ...this.goldConfig,
          ...saved,
          newsFilter: {
            ...this.goldConfig.newsFilter,
            ...(saved.newsFilter || {})
          }
        };
      }
    } catch (err: any) {
      this.addLog("WARN", `Не удалось загрузить конфигурацию золота: ${err.message}`);
    }
  }

  // --- LOCKED SIGNAL ---
  public getLockedSignal(): LockedPineSignal | null {
    return this.lockedSignal;
  }

  public async setLockedSignal(signal: LockedPineSignal | null): Promise<void> {
    this.lockedSignal = signal;
    await this.persistLockedSignal();
  }

  private async persistLockedSignal(): Promise<void> {
    try {
      const file = path.join(this.dataDir, "locked-setups.json");
      await fs.writeFile(file, JSON.stringify(this.lockedSignal, null, 2), "utf-8");
    } catch (err: any) {
      this.addLog("ERROR", `Ошибка сохранения зафиксированного сигнала: ${err.message}`);
    }
  }

  private async loadLockedSignal(): Promise<void> {
    const file = path.join(this.dataDir, "locked-setups.json");
    try {
      if (fsSync.existsSync(file)) {
        const raw = await fs.readFile(file, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.createdAt && Date.now() - parsed.createdAt < 24 * 3600 * 1000) {
          this.lockedSignal = parsed;
        }
      }
    } catch (err: any) {
      this.addLog("WARN", `Предупреждение при загрузке зафиксированного сигнала: ${err.message}`);
    }
  }

  // --- STATION SETTINGS & USERS ---
  public getStationUsers(): StationUserAccount[] {
    return [...this.stationUsers];
  }

  public async setStationUsers(users: StationUserAccount[]): Promise<void> {
    this.stationUsers = users;
    await this.persistStationSettings();
  }

  public getUserPreferences(): Record<string, any> {
    return { ...this.userPreferences };
  }

  public async setUserPreferences(prefs: Record<string, any>): Promise<void> {
    this.userPreferences = { ...this.userPreferences, ...prefs };
    await this.persistStationSettings();
  }

  private async persistStationSettings(): Promise<void> {
    try {
      const file = path.join(this.dataDir, "station-settings.json");
      const safePayload = sanitizeForDisk({
        users: this.stationUsers,
        userPreferences: this.userPreferences
      });
      await fs.writeFile(file, JSON.stringify(safePayload, null, 2), "utf-8");
    } catch (err: any) {
      this.addLog("ERROR", `Ошибка сохранения настроек станции: ${err.message}`);
    }
  }

  private async loadStationSettings(): Promise<void> {
    const file = path.join(this.dataDir, "station-settings.json");
    try {
      if (fsSync.existsSync(file)) {
        const raw = await fs.readFile(file, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.users) && parsed.users.length > 0) {
          this.stationUsers = parsed.users;
        }
        if (parsed.userPreferences) {
          this.userPreferences = parsed.userPreferences;
        }
      }
    } catch (err: any) {
      this.addLog("WARN", `Не удалось загрузить настройки станции: ${err.message}`);
    }
  }

  // --- SENT NEWS DEDUPLICATION ---
  public hasSentNews(id: string): boolean {
    return this.sentNews.has(id);
  }

  public async markNewsSent(id: string): Promise<void> {
    this.sentNews.add(id);
    if (this.sentNews.size > 500) {
      const arr = Array.from(this.sentNews).slice(-300);
      this.sentNews = new Set(arr);
    }
    await this.persistSentNews();
  }

  private async persistSentNews(): Promise<void> {
    try {
      const file = path.join(this.dataDir, "sent-news-ids.json");
      await fs.writeFile(file, JSON.stringify(Array.from(this.sentNews), null, 2), "utf-8");
    } catch (err: any) {
      this.addLog("WARN", `Не удалось сохранить историю новостей: ${err.message}`);
    }
  }

  private async loadSentNews(): Promise<void> {
    const file = path.join(this.dataDir, "sent-news-ids.json");
    try {
      if (fsSync.existsSync(file)) {
        const raw = await fs.readFile(file, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.sentNews = new Set(parsed);
        }
      }
    } catch {}
  }
}

export const stateManager = StateManager.getInstance();
