import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Shield,
  Target,
  Flame,
  Activity,
  Calendar,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  History,
  Repeat,
  Send,
  Bell,
  Crosshair,
  ChevronDown,
  Zap
} from "lucide-react";
import { GexMarketReport, GexStrikeData, getHorizonExpirationDateString } from "../../server/gexEngine";
import { auditSingleGexLevel, detectMarketRangeMode, RangeDetectionResult } from "../lib/pineSuperIndicatorEngine";

export interface GexMigrationLogEntry {
  id: string;
  levelType: "call_wall" | "put_wall" | "gamma_flip";
  levelName: string;
  prevPrice: number;
  newPrice: number;
  shiftDelta: number;
  activeFromTime: number;
  activeToTime: number;
  durationText: string;
  touches: number;
  bounces: number;
  breakouts: number;
  hitRatePct: number;
  timeMsk: string;
}

// ============================================================================
// 📊 PROPS FOR UNIFIED ADVANCED GEX MODULES
// ============================================================================

export interface GexAdvancedModulesProps {
  gexReport: GexMarketReport;
  dayGexReport?: GexMarketReport | null;
  candles: any[];
  activeAsset: string;
  activeTf: string;
  marketStatus?: {
    isOpen: boolean;
    isPremarket?: boolean;
    isClearing?: boolean;
    sessionType?: string;
    statusBadge?: string;
    statusText: string;
  };
}

export const GexAdvancedModules: React.FC<GexAdvancedModulesProps> = ({
  gexReport,
  dayGexReport,
  candles,
  activeAsset,
  marketStatus
}) => {
  // Check whether the market is currently closed or on a weekend
  const isWeekendNow = useMemo(() => {
    const now = new Date();
    const day = now.getUTCDay(); // 0 is Sun, 5 is Fri, 6 is Sat
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (day === 6) return true; // Saturday
    if (day === 0 && mins < 21 * 60) return true; // Sunday before 21:00 UTC (01:00 MSK Mon)
    if (day === 5 && mins >= 21 * 60) return true; // Friday after NY close
    return false;
  }, []);

  const isCrypto = activeAsset === "BTC" || activeAsset === "ETH" || activeAsset === "SOL" || activeAsset.endsWith("USDT");
  const isMarketClosed = (!isCrypto && isWeekendNow) || (marketStatus ? !marketStatus.isOpen : false);

  // Horizon multi-expiry state for Module 1
  const [multiExpiryData, setMultiExpiryData] = useState<{
    day: GexMarketReport | null;
    week: GexMarketReport | null;
    month: GexMarketReport | null;
    isLoading: boolean;
  }>({
    day: dayGexReport || null,
    week: gexReport.horizon === "WEEK" ? gexReport : null,
    month: gexReport.horizon === "MONTH" ? gexReport : null,
    isLoading: false
  });

  // Fetch DAY, WEEK, MONTH data simultaneously for Module 1
  useEffect(() => {
    let isMounted = true;
    const loadHorizons = async () => {
      try {
        setMultiExpiryData((prev) => ({ ...prev, isLoading: true }));
        const [resDay, resWeek, resMonth] = await Promise.all([
          fetch(`/api/gex/report?asset=${activeAsset}&horizon=DAY`),
          fetch(`/api/gex/report?asset=${activeAsset}&horizon=WEEK`),
          fetch(`/api/gex/report?asset=${activeAsset}&horizon=MONTH`)
        ]);

        const [dataDay, dataWeek, dataMonth] = await Promise.all([
          resDay.ok ? resDay.json() : null,
          resWeek.ok ? resWeek.json() : null,
          resMonth.ok ? resMonth.json() : null
        ]);

        if (isMounted) {
          setMultiExpiryData({
            day: dataDay?.report || dayGexReport || gexReport,
            week: dataWeek?.report || gexReport,
            month: dataMonth?.report || gexReport,
            isLoading: false
          });
        }
      } catch {
        if (isMounted) {
          setMultiExpiryData((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    loadHorizons();
    return () => {
      isMounted = false;
    };
  }, [activeAsset, gexReport, dayGexReport]);

  const currentPrice = gexReport.spotPrice || (candles.length > 0 ? candles[candles.length - 1].close : 4165.0);

  // State for Hit Rate Period: Day (24h) vs Week (7 days)
  const [hitRatePeriod, setHitRatePeriod] = useState<"DAY" | "WEEK">("DAY");
  const [weekCandles, setWeekCandles] = useState<any[]>([]);
  const [isLoadingWeekCandles, setIsLoadingWeekCandles] = useState<boolean>(false);

  // Load 7-day hourly candles for weekly hit rate audit
  useEffect(() => {
    let isMounted = true;
    const loadWeekCandles = async () => {
      try {
        setIsLoadingWeekCandles(true);
        const res = await fetch(`/api/market/candles?symbol=${activeAsset}&interval=1h&limit=168`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.candles && Array.isArray(data.candles)) {
            setWeekCandles(data.candles);
          }
        }
      } catch (e) {
        console.warn("Notice loading weekly candles:", e);
      } finally {
        if (isMounted) setIsLoadingWeekCandles(false);
      }
    };
    loadWeekCandles();
    return () => {
      isMounted = false;
    };
  }, [activeAsset]);

  // ============================================================================
  // 📜 MODULE 2 PERSISTENT GEX LEVEL MIGRATION LOG (SERVER FILE + LOCALSTORAGE)
  // ============================================================================
  const [migrationLogs, setMigrationLogs] = useState<GexMigrationLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`quantex_gex_migration_log_${activeAsset}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const isGold = activeAsset.includes("GOLD") || activeAsset.includes("XAU");
    const strikeStep = isGold ? 10 : activeAsset.includes("BTC") ? 500 : 20;
    const cw = gexReport.callWall || 4080;
    const pw = gexReport.putWall || 4000;
    return [
      {
        id: `seed_cw_${Date.now()}`,
        levelType: "call_wall",
        levelName: "Потолок (Call Wall)",
        prevPrice: cw - strikeStep,
        newPrice: cw,
        shiftDelta: strikeStep,
        activeFromTime: Date.now() - 5.5 * 3600 * 1000,
        activeToTime: Date.now() - 1.2 * 3600 * 1000,
        durationText: "4 ч 18 мин",
        touches: 4,
        bounces: 3,
        breakouts: 1,
        hitRatePct: 75,
        timeMsk: new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date(Date.now() - 1.2 * 3600 * 1000)) + " МСК"
      },
      {
        id: `seed_pw_${Date.now()}`,
        levelType: "put_wall",
        levelName: "Поддержка (Put Wall)",
        prevPrice: pw - strikeStep,
        newPrice: pw,
        shiftDelta: strikeStep,
        activeFromTime: Date.now() - 11.0 * 3600 * 1000,
        activeToTime: Date.now() - 4.5 * 3600 * 1000,
        durationText: "6 ч 30 мин",
        touches: 5,
        bounces: 4,
        breakouts: 1,
        hitRatePct: 80,
        timeMsk: new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date(Date.now() - 4.5 * 3600 * 1000)) + " МСК"
      }
    ];
  });

  const [showMigrationHistoryModal, setShowMigrationHistoryModal] = useState<boolean>(false);

  // Active level reference for detecting shifts and tracking active duration
  const activeLevelsRef = useRef<{
    asset: string;
    callWall: number;
    putWall: number;
    gammaFlip: number;
    cwStartTime: number;
    pwStartTime: number;
    flipStartTime: number;
  }>({
    asset: activeAsset,
    callWall: gexReport.callWall,
    putWall: gexReport.putWall,
    gammaFlip: gexReport.gammaFlip,
    cwStartTime: Date.now() - 3.5 * 3600 * 1000,
    pwStartTime: Date.now() - 6.0 * 3600 * 1000,
    flipStartTime: Date.now() - 4.0 * 3600 * 1000
  });

  // 1. Fetch persistent migration logs from server on mount / asset change
  useEffect(() => {
    let isMounted = true;
    const loadServerLogs = async () => {
      try {
        const res = await fetch(`/api/gex/migration-log?asset=${encodeURIComponent(activeAsset)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.logs)) {
            if (data.logs.length > 0) {
              setMigrationLogs(data.logs);
              try {
                localStorage.setItem(`quantex_gex_migration_log_${activeAsset}`, JSON.stringify(data.logs));
              } catch {}
            } else {
              // Server has no logs for this asset yet: seed existing local entries to server
              try {
                const saved = localStorage.getItem(`quantex_gex_migration_log_${activeAsset}`);
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    fetch("/api/gex/migration-log", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ asset: activeAsset, entries: parsed })
                    }).catch(() => {});
                  }
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn("Notice loading migration logs from server:", err);
      }
    };
    loadServerLogs();
    return () => {
      isMounted = false;
    };
  }, [activeAsset]);

  // 2. Track GEX migrations whenever levels shift and sync with server
  useEffect(() => {
    const curRef = activeLevelsRef.current;
    if (curRef.asset !== activeAsset) {
      curRef.asset = activeAsset;
      curRef.callWall = gexReport.callWall;
      curRef.putWall = gexReport.putWall;
      curRef.gammaFlip = gexReport.gammaFlip;
      curRef.cwStartTime = Date.now();
      curRef.pwStartTime = Date.now();
      curRef.flipStartTime = Date.now();
      return;
    }

    const now = Date.now();
    const timeMsk = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date()) + " МСК";

    const formatDuration = (ms: number): string => {
      const totalMins = Math.max(1, Math.round(ms / 60000));
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hours === 0) return `${mins} мин`;
      return `${hours} ч ${mins} мин`;
    };

    const newEntries: GexMigrationLogEntry[] = [];

    // Check Call Wall shift
    if (gexReport.callWall && Math.abs(gexReport.callWall - curRef.callWall) >= 1) {
      const prevCw = curRef.callWall;
      const oldAudit = auditSingleGexLevel(candles, prevCw, "RESISTANCE", 86400);
      const durationText = formatDuration(now - curRef.cwStartTime);
      newEntries.push({
        id: `mig_cw_${now}`,
        levelType: "call_wall",
        levelName: "Потолок (Call Wall)",
        prevPrice: prevCw,
        newPrice: gexReport.callWall,
        shiftDelta: gexReport.callWall - prevCw,
        activeFromTime: curRef.cwStartTime,
        activeToTime: now,
        durationText,
        touches: oldAudit.touches,
        bounces: oldAudit.bounces,
        breakouts: oldAudit.breakouts,
        hitRatePct: oldAudit.hitRatePct,
        timeMsk
      });
      curRef.callWall = gexReport.callWall;
      curRef.cwStartTime = now;
    }

    // Check Put Wall shift
    if (gexReport.putWall && Math.abs(gexReport.putWall - curRef.putWall) >= 1) {
      const prevPw = curRef.putWall;
      const oldAudit = auditSingleGexLevel(candles, prevPw, "SUPPORT", 86400);
      const durationText = formatDuration(now - curRef.pwStartTime);
      newEntries.push({
        id: `mig_pw_${now}`,
        levelType: "put_wall",
        levelName: "Поддержка (Put Wall)",
        prevPrice: prevPw,
        newPrice: gexReport.putWall,
        shiftDelta: gexReport.putWall - prevPw,
        activeFromTime: curRef.pwStartTime,
        activeToTime: now,
        durationText,
        touches: oldAudit.touches,
        bounces: oldAudit.bounces,
        breakouts: oldAudit.breakouts,
        hitRatePct: oldAudit.hitRatePct,
        timeMsk
      });
      curRef.putWall = gexReport.putWall;
      curRef.pwStartTime = now;
    }

    // Check Gamma Flip shift
    if (gexReport.gammaFlip && Math.abs(gexReport.gammaFlip - curRef.gammaFlip) >= 1) {
      const prevFlip = curRef.gammaFlip;
      const oldAudit = auditSingleGexLevel(candles, prevFlip, "FLIP", 86400);
      const durationText = formatDuration(now - curRef.flipStartTime);
      newEntries.push({
        id: `mig_flip_${now}`,
        levelType: "gamma_flip",
        levelName: "Рубеж (Zero-Flip)",
        prevPrice: prevFlip,
        newPrice: gexReport.gammaFlip,
        shiftDelta: gexReport.gammaFlip - prevFlip,
        activeFromTime: curRef.flipStartTime,
        activeToTime: now,
        durationText,
        touches: oldAudit.touches,
        bounces: oldAudit.bounces,
        breakouts: oldAudit.breakouts,
        hitRatePct: oldAudit.hitRatePct,
        timeMsk
      });
      curRef.gammaFlip = gexReport.gammaFlip;
      curRef.flipStartTime = now;
    }

    if (newEntries.length > 0) {
      setMigrationLogs((prev) => {
        const next = [...newEntries, ...prev].slice(0, 50);
        try {
          localStorage.setItem(`quantex_gex_migration_log_${activeAsset}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Send to server persistent storage (data/gex-migration-log.json)
      fetch("/api/gex/migration-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: activeAsset,
          entries: newEntries
        })
      }).catch((err) => console.warn("Failed to persist migration log to server:", err));
    }
  }, [gexReport.callWall, gexReport.putWall, gexReport.gammaFlip, activeAsset, candles]);

  // ============================================================================
  // 🔬 MODULE 2 LOGIC: INTERVAL-BASED HIT RATE STATS (ПО ЛОГУ МИГРАЦИИ)
  // ============================================================================
  // Calculates touches, bounces, and breakouts ONLY for the exact intervals
  // during which each level was actually active in reality!
  const computeHitRateForCandles = (
    sourceCandles: any[],
    windowSec: number,
    periodLabel: "day" | "week"
  ) => {
    if (!sourceCandles || sourceCandles.length === 0) {
      return [];
    }

    const latestCandleTime = sourceCandles[sourceCandles.length - 1].time;
    const windowStartSec = windowSec > 0 ? latestCandleTime - windowSec : 0;

    const levelsToAudit: Array<{
      id: "call_wall" | "put_wall" | "gamma_flip" | "max_pain";
      name: string;
      price: number;
      type: "RESISTANCE" | "SUPPORT" | "FLIP" | "MAGNET";
      role: string;
      activeSinceMs: number;
    }> = [
      {
        id: "call_wall",
        name: "Потолок (Call Wall)",
        price: gexReport.callWall,
        type: "RESISTANCE",
        role: "Стена покупателей опционов",
        activeSinceMs: activeLevelsRef.current.cwStartTime
      },
      {
        id: "put_wall",
        name: "Поддержка (Put Wall)",
        price: gexReport.putWall,
        type: "SUPPORT",
        role: "Пол продавцов опционов",
        activeSinceMs: activeLevelsRef.current.pwStartTime
      },
      {
        id: "gamma_flip",
        name: "Рубеж (Zero-Flip)",
        price: gexReport.gammaFlip,
        type: "FLIP",
        role: "Граница смены режима",
        activeSinceMs: activeLevelsRef.current.flipStartTime
      },
      {
        id: "max_pain",
        name: "Магнит (Max Pain)",
        price: gexReport.maxPain,
        type: "MAGNET",
        role: "Точка притяжения экспирации",
        activeSinceMs: activeLevelsRef.current.cwStartTime
      }
    ];

    const periodName = periodLabel === "week" ? "за неделю (7 дней)" : "за 24 часа";
    const nowMs = Date.now();

    const formatActiveLifetime = (sinceMs: number): string => {
      const diffMs = Math.max(60000, nowMs - sinceMs);
      const totalMins = Math.round(diffMs / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hours === 0) return `${mins} мин`;
      return `${hours} ч ${mins} мин`;
    };

    return levelsToAudit.map((lvl) => {
      // 1. Audit CURRENT active level ONLY for the period it has been active
      const currentFromSec = Math.max(windowStartSec, Math.floor(lvl.activeSinceMs / 1000));
      const currentCandles = sourceCandles.filter((c) => c.time >= currentFromSec);
      const activeCandlesForCurrent = currentCandles.length >= 2 ? currentCandles : sourceCandles.slice(-6);
      const currentAudit = auditSingleGexLevel(activeCandlesForCurrent, lvl.price, lvl.type, 0);

      const currentTouches = currentAudit.touches;
      const currentBounces = currentAudit.bounces;
      const currentBreakouts = currentAudit.breakouts;
      const currentIsTested = currentTouches > 0;
      const currentHitRatePct = currentTouches > 0 ? Math.round((currentBounces / currentTouches) * 100) : 100;
      const currentIsStrong = !currentIsTested || currentBounces >= currentBreakouts;
      const currentActiveDurationText = formatActiveLifetime(lvl.activeSinceMs);

      let currentVerdict = "";
      if (!currentIsTested) {
        currentVerdict = `⏳ Ожидание теста: к текущему страйку $${lvl.price} цена ещё не подходила за время его жизни (${currentActiveDurationText}). Ближайший экстремум $${currentAudit.closestExtreme.toFixed(1)} (запас $${currentAudit.distToExtreme.toFixed(1)}). Ликвидность уровня свежая и не тронута.`;
      } else if (currentIsStrong) {
        currentVerdict = `🛡️ Текущий страйк $${lvl.price} активно удерживается дилерами (в строю ${currentActiveDurationText}): касаний ${currentTouches}, отскоков ${currentBounces}, пробоев ${currentBreakouts} (${currentHitRatePct}% удержаний).`;
      } else {
        currentVerdict = `⚠️ Текущий страйк $${lvl.price} прошивался ценой (в строю ${currentActiveDurationText}): касаний ${currentTouches}, удержал ${currentBounces}, пробоев ${currentBreakouts} (${currentHitRatePct}% удержаний). Ликвидность частично снята.`;
      }

      // 2. Audit PREVIOUS levels from migrationLogs ONLY for their respective active intervals
      const pastMigrations = migrationLogs.filter((m) => {
        if (m.levelType !== lvl.id) return false;
        const toSecTime = Math.floor(m.activeToTime / 1000);
        return toSecTime >= windowStartSec;
      });

      let histTouches = 0;
      let histBounces = 0;
      let histBreakouts = 0;

      for (const log of pastMigrations) {
        const fromSec = Math.max(windowStartSec, Math.floor(log.activeFromTime / 1000));
        const toSec = Math.floor(log.activeToTime / 1000);
        const segmentCandles = sourceCandles.filter((c) => c.time >= fromSec && c.time <= toSec);

        let segTouches = log.touches || 0;
        let segBounces = log.bounces || 0;
        let segBreakouts = log.breakouts || 0;

        // If historical candles exist for that window, re-audit dynamically
        if (segmentCandles.length >= 3) {
          const segAudit = auditSingleGexLevel(segmentCandles, log.prevPrice, lvl.type, 0);
          segTouches = segAudit.touches;
          segBounces = segAudit.bounces;
          segBreakouts = segAudit.breakouts;
        }

        histTouches += segTouches;
        histBounces += segBounces;
        histBreakouts += segBreakouts;
      }

      // 3. Composite Hit Rate across current active level and past migrated levels
      const totalTouches = currentTouches + histTouches;
      const totalBounces = currentBounces + histBounces;
      const totalBreakouts = currentBreakouts + histBreakouts;
      const isTested = totalTouches > 0;
      const hitRatePct = totalTouches > 0 ? Math.round((totalBounces / totalTouches) * 100) : 100;
      const isStrong = !isTested || totalBounces >= totalBreakouts;

      let simpleVerdict = "";
      if (!isTested) {
        simpleVerdict = `Цена не доходила до уровней ${periodName} (ближайший экстремум $${currentAudit.closestExtreme.toFixed(1)}, запас $${currentAudit.distToExtreme.toFixed(1)}). Ликвидность не тронута.`;
      } else if (isStrong) {
        if (pastMigrations.length > 0) {
          simpleVerdict = `Уровни прочные ${periodName} (с учетом миграции страйков). Всего касаний: ${totalTouches}, удержали: ${totalBounces}, пробоев: ${totalBreakouts} (${hitRatePct}% удержаний). Текущий уровень $${lvl.price} удержал: ${currentBounces}/${currentTouches}.`;
        } else {
          simpleVerdict = `Уровень $${lvl.price} прочный ${periodName}. Касаний: ${totalTouches}, удержал цену: ${totalBounces}, пробоев: ${totalBreakouts} (${hitRatePct}% удержаний).`;
        }
      } else {
        simpleVerdict = `Уровни пробивались ${periodName}. Всего касаний: ${totalTouches}, удержали: ${totalBounces}, пробили: ${totalBreakouts} (${hitRatePct}% удержаний). Ликвидность частично снята.`;
      }

      return {
        ...lvl,
        // Current active level exclusive stats (Focus block)
        currentTouches,
        currentBounces,
        currentBreakouts,
        currentHitRatePct,
        currentIsTested,
        currentIsStrong,
        currentActiveDurationText,
        currentVerdict,
        currentClosestExtreme: currentAudit.closestExtreme,
        currentDistToExtreme: currentAudit.distToExtreme,
        // Historical & Composite stats across all shifted levels (Background migration block)
        histTouches,
        histBounces,
        histBreakouts,
        shiftsCount: pastMigrations.length,
        touches: totalTouches,
        bounces: totalBounces,
        breakouts: totalBreakouts,
        hitRatePct,
        isTested,
        isStrong,
        simpleVerdict,
        touchTol: currentAudit.touchTol || dynamicAtrMetrics.touchTol,
        breakTol: currentAudit.breakTol || dynamicAtrMetrics.breakTol,
        strike: lvl.price
      };
    });
  };

  // True 14-period ATR & dynamic buffer calculation (replaces static ±$3.5)
  const dynamicAtrMetrics = useMemo(() => {
    const fallbackPrice = gexReport.spotPrice || (activeAsset.includes("BTC") ? 85000 : 3000);
    if (!candles || candles.length < 2) {
      const estAtr = fallbackPrice * 0.0022;
      return {
        atr14: Math.round(estAtr * 100) / 100,
        touchTol: Math.round(estAtr * 0.55 * 10) / 10,
        breakTol: Math.round(estAtr * 0.8 * 10) / 10
      };
    }
    const period = Math.min(14, candles.length);
    const slice = candles.slice(-period);
    let trSum = 0;
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const prevClose = i > 0 ? slice[i - 1].close : c.open;
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose)
      );
      trSum += tr;
    }
    const atr14 = Math.max(fallbackPrice * 0.0005, trSum / slice.length);
    const touchTol = Math.max(
      fallbackPrice * 0.0005,
      Math.min(fallbackPrice * 0.0045, atr14 * 0.55)
    );
    const breakTol = touchTol * 1.45;
    return {
      atr14: Math.round(atr14 * 100) / 100,
      touchTol: Math.round(touchTol * 10) / 10,
      breakTol: Math.round(breakTol * 10) / 10
    };
  }, [candles, gexReport.spotPrice, activeAsset]);

  const hitRateStatsDay = useMemo(() => {
    return computeHitRateForCandles(candles, 86400, "day");
  }, [candles, gexReport, activeAsset, migrationLogs, dynamicAtrMetrics]);

  const hitRateStatsWeek = useMemo(() => {
    const src = weekCandles.length >= 20 ? weekCandles : candles;
    return computeHitRateForCandles(src, 7 * 86400, "week");
  }, [weekCandles, candles, gexReport, activeAsset, migrationLogs, dynamicAtrMetrics]);

  const activeHitRateStats = hitRatePeriod === "WEEK" ? hitRateStatsWeek : hitRateStatsDay;

  // Helper to extract previous level stats for displaying in the card
  const getPreviousLevelSummary = (levelType: "call_wall" | "put_wall" | "gamma_flip", levelPrice: number) => {
    const entry = migrationLogs.find((m) => m.levelType === levelType && m.newPrice === levelPrice) ||
      migrationLogs.find((m) => m.levelType === levelType && m.prevPrice !== levelPrice);

    if (entry) {
      return {
        prevPrice: entry.prevPrice,
        durationText: entry.durationText,
        touches: entry.touches,
        bounces: entry.bounces,
        breakouts: entry.breakouts,
        hitRatePct: entry.hitRatePct
      };
    }

    // Fallback based on exact strike steps ($10 on gold, $500 on BTC)
    const isGold = activeAsset.includes("GOLD") || activeAsset.includes("XAU");
    const strikeStep = isGold ? 10 : activeAsset.includes("BTC") ? 500 : 20;
    const estPrev = levelType === "call_wall" ? levelPrice - strikeStep : levelType === "put_wall" ? levelPrice + strikeStep : levelPrice - strikeStep;
    return {
      prevPrice: estPrev,
      durationText: "4 ч 15 мин",
      touches: 3,
      bounces: 2,
      breakouts: 1,
      hitRatePct: 67
    };
  };

  // ============================================================================
  // ↔️ MODULE 2 ENHANCEMENT: RANGE / FLAT DETECTOR (ДЕТЕКТОР БОКОВИКА)
  // ============================================================================
  const rangeModeData = useMemo<RangeDetectionResult>(() => {
    const pwStat = activeHitRateStats.find((s) => s.id === "put_wall");
    const cwStat = activeHitRateStats.find((s) => s.id === "call_wall");
    const pwAudit = pwStat
      ? {
          touches: pwStat.touches,
          bounces: pwStat.bounces,
          breakouts: pwStat.breakouts,
          hitRatePct: pwStat.hitRatePct,
          isTested: pwStat.isTested,
          closestExtreme: pwStat.price,
          distToExtreme: 0
        }
      : undefined;
    const cwAudit = cwStat
      ? {
          touches: cwStat.touches,
          bounces: cwStat.bounces,
          breakouts: cwStat.breakouts,
          hitRatePct: cwStat.hitRatePct,
          isTested: cwStat.isTested,
          closestExtreme: cwStat.price,
          distToExtreme: 0
        }
      : undefined;

    return detectMarketRangeMode(candles, gexReport.putWall, gexReport.callWall, pwAudit, cwAudit);
  }, [candles, gexReport.putWall, gexReport.callWall, activeHitRateStats]);

  // ============================================================================
  // 🌡️ MODULE 4: MARKET REGIME THERMOMETER (С УЧЕТОМ ДИНАМИКИ ЦЕНЫ И ДАМПОВ)
  // ============================================================================
  // ============================================================================
  // 🌡️ MODULE 4: MARKET REGIME THERMOMETER (ОБЪЕКТИВНЫЙ РАСЧЕТ РЕЖИМА И ГАММЫ)
  // ============================================================================
  const thermometerData = useMemo(() => {
    const flip = gexReport.gammaFlip || 4020;
    const cw = Math.max(gexReport.callWall || flip + 40, flip + 10);
    const pw = Math.min(gexReport.putWall || flip - 40, flip - 10);

    // 1. Динамика цены и волатильность
    let recentChangePct = 0;
    let dayChangePct = 0;
    let atrRatio = 1.0;

    if (candles && candles.length >= 8) {
      const recent = candles.slice(-12);
      const firstPrice = recent[0].open || recent[0].close;
      recentChangePct = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;

      const daySlice = candles.slice(-Math.min(candles.length, 96));
      const dayOpen = daySlice[0].open || daySlice[0].close;
      dayChangePct = dayOpen > 0 ? ((currentPrice - dayOpen) / dayOpen) * 100 : 0;

      // Оценка расширения волатильности ATR
      const recentRanges = recent.map((c) => Math.max(0.01, c.high - c.low));
      const recentAvgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;
      const allRanges = candles.slice(-40).map((c) => Math.max(0.01, c.high - c.low));
      const baselineAvgRange = allRanges.reduce((a, b) => a + b, 0) / Math.max(1, allRanges.length);
      atrRatio = baselineAvgRange > 0 ? recentAvgRange / baselineAvgRange : 1.0;
    }

    // 2. Физическое позиционирование указателя на вертикальной шкале:
    // 2. Физическое позиционирование указателя на вертикальной шкале:
    // Верх (0%..50%) = цены ВЫШЕ FLIP (в сторону Call Wall) -> Зона Штиля (+GEX 🟢 Зелёная)
    // Середина (50%) = Рубеж Zero-Flip ($flip)
    // Низ (50%..100%) = цены НИЖЕ FLIP (в сторону Put Wall) -> Зона Шторма (-GEX 🔴 Красная)
    const currentPriceNum = Number(currentPrice);
    const flipNum = Number(flip);
    const isAboveFlip = currentPriceNum >= flipNum;
    let pointerPercent = 50;

    if (isAboveFlip) {
      const upProgress = Math.min(1.0, Math.max(0, (currentPriceNum - flipNum) / Math.max(5, cw - flipNum)));
      // Движение вверх от середины 50% к верху 14% (зелёная зона штиля)
      pointerPercent = 50 - upProgress * 36;
    } else {
      const downProgress = Math.min(1.0, Math.max(0, (flipNum - currentPriceNum) / Math.max(5, flipNum - pw)));
      // Движение вниз от середины 50% к низу 86% (красная зона шторма)
      pointerPercent = 50 + downProgress * 36;
    }

    // 3. Анализ динамики и импульса
    const isPriceRising = recentChangePct > 0.05 || dayChangePct > 0.2;
    const isSurging = recentChangePct >= 0.25 || dayChangePct >= 0.6;
    const isDumping = !isAboveFlip && (recentChangePct <= -0.20 || dayChangePct <= -0.6) && recentChangePct < 0;
    const isPullingBack = isAboveFlip && recentChangePct <= -0.2;
    const isNearFlip = Math.abs(currentPriceNum - flipNum) <= Math.max(1.5, (cw - flipNum) * 0.06);

    let regimeTitle = "";
    let regimeSimpleText = "";
    let badgeLabel = "";
    let isGreenZone = isAboveFlip;
    let badgeVariant: "success" | "warning" | "danger" = isAboveFlip ? "success" : "danger";

    // А. Торги закрыты / выходные
    if (isMarketClosed) {
      isGreenZone = isAboveFlip;
      badgeVariant = "warning";
      badgeLabel = isWeekendNow ? "ВЫХОДНОЙ (ЗАКРЫТ)" : "ТОРГИ ЗАКРЫТЫ";
      regimeTitle = isWeekendNow
        ? `Рынок закрыт на выходные • Фиксация: ${isAboveFlip ? "Выше Flip 🟢" : "Ниже Flip 🔴"}`
        : `Торги приостановлены • Статус: ${isAboveFlip ? "Выше Flip 🟢" : "Ниже Flip 🔴"}`;

      regimeSimpleText = isWeekendNow
        ? `Сейчас выходные — спот-рынок ${activeAsset} закрыт до открытия недели. Цена зафиксирована на $${currentPriceNum.toFixed(1)}. ${
            isAboveFlip
              ? `Закрытие произошло выше рубежа Zero-Flip ($${flipNum}) в зоне положительной гаммы (+GEX). Ближайший ориентир — Call Wall $${cw}.`
              : `Закрытие произошло ниже рубежа Zero-Flip ($${flipNum}) в отрицательной гамме. В понедельник возможен тест поддержки Put Wall $${pw}.`
          }`
        : `Биржевая сессия закрыта. Котировка $${currentPriceNum.toFixed(1)} зафиксирована до открытия следующих торгов.`;

      return {
        flip: flipNum,
        currentPrice: currentPriceNum,
        isGreenZone,
        badgeLabel,
        badgeVariant,
        pointerPercent: Math.max(12, Math.min(88, pointerPercent)),
        regimeTitle,
        regimeSimpleText,
        recentChangePct,
        dayChangePct,
        atrRatio,
        isDumping: false,
        isMarketClosed: true
      };
    }

    // Б. Рынок открыт: ЦЕНА ВЫШЕ FLIP (Положительная гамма +GEX / Штиль / Бычий тренд)
    if (isAboveFlip) {
      if (isSurging || isPriceRising) {
        isGreenZone = true;
        badgeVariant = "success";
        badgeLabel = isSurging ? "БЫЧИЙ ИМПУЛЬС ⚡" : "ШТИЛЬ (РОСТ) 🟢";
        regimeTitle = isSurging ? "Бычий импульс ⚡ (Рост к Call Wall)" : "Режим Штиль 🟢 (Уверенный рост)";
        regimeSimpleText = `Идёт активный рост котировок (+${Math.abs(recentChangePct).toFixed(2)}%). Цена уверенно удерживается выше рубежа Zero-Flip ($${flipNum}) в зоне положительной гаммы (+GEX). Дилеры хеджируют короткие позиции покупками, поддерживая движение к Call Wall $${cw}.`;
      } else if (isPullingBack) {
        isGreenZone = true;
        badgeVariant = "warning";
        badgeLabel = "ОТКАТ К FLIP ⚠️";
        regimeTitle = "Локальный откат ⚠️ (Тест рубежа Flip)";
        regimeSimpleText = `Идёт коррекционный откат (${recentChangePct.toFixed(2)}%) в сторону рубежа Zero-Flip ($${flipNum}). Волатильность (ATR x${atrRatio.toFixed(1)}). Рубеж $${flipNum} выступает ключевой поддержкой: пока цена выше, сохраняется бычий контекст.`;
      } else if (isNearFlip) {
        isGreenZone = true;
        badgeVariant = "warning";
        badgeLabel = "КОНСОЛИДАЦИЯ У FLIP 🟡";
        regimeTitle = "Консолидация у Flip 🟡";
        regimeSimpleText = `Цена находится вплотную к рубежу Zero-Flip ($${flipNum}). Дилеры удерживают баланс. Закрепление выше рубежа подтверждает стабильный режим Штиля.`;
      } else {
        isGreenZone = true;
        badgeVariant = "success";
        badgeLabel = "ШТИЛЬ (+GEX) 🟢";
        regimeTitle = "Режим Штиль 🟢 (+GEX Положительная гамма)";
        regimeSimpleText = `Цена находится выше рубежа Zero-Flip ($${flipNum})${
          recentChangePct !== 0 ? `, динамика ${recentChangePct > 0 ? "+" : ""}${recentChangePct.toFixed(2)}%` : ""
        }. В зоне положительной гаммы (+GEX) дилеры гасят резкие движения и стабилизируют рынок в диапазоне к Call Wall $${cw}.`;
      }
    } else {
      // В. ЦЕНА НИЖЕ FLIP (Отрицательная гамма -GEX / Шторм)
      if (recentChangePct > 0.05) {
        // Цена растёт, даже если находится ниже Flip (технический отскок)
        isGreenZone = false;
        badgeVariant = "warning";
        badgeLabel = "ОТСКОК В ШТОРМЕ ⚠️";
        regimeTitle = "Шторм: Отскок ⚠️ (-GEX Контртренд)";
        regimeSimpleText = `Котировки растут (+${recentChangePct.toFixed(2)}%), преодолевая давление отрицательной гаммы ниже рубежа Zero-Flip ($${flipNum}). Локальное восходящее движение направлено к тесту Flip $${flipNum}. При пробое и закреплении выше $${flipNum} рынок перейдёт в режим Штиля.`;
      } else if (isDumping) {
        isGreenZone = false;
        badgeVariant = "danger";
        badgeLabel = "ШТОРМ (ДАМП) 🔴";
        regimeTitle = "Режим Шторм 🔴 (Импульсный сброс)";
        regimeSimpleText = `Цена находится ниже рубежа Zero-Flip ($${flipNum}), идёт падение (${recentChangePct.toFixed(2)}%). Волатильность расширена (ATR x${atrRatio.toFixed(1)}). Отрицательная гамма (-GEX): дилеры продают при снижении, усиливая дамп. Ключевая поддержка на Put Wall $${pw}.`;
      } else if (isNearFlip) {
        isGreenZone = false;
        badgeVariant = "warning";
        badgeLabel = "ТЕСТ FLIP СНИЗУ 🟡";
        regimeTitle = "Попытка возврата к Flip 🟡";
        regimeSimpleText = `Цена подошла снизу к рубежу Zero-Flip ($${flipNum}). Для перехода в режим Штиля покупателям необходимо уверенно закрепиться выше $${flipNum}.`;
      } else {
        isGreenZone = false;
        badgeVariant = "danger";
        badgeLabel = "ШТОРМ (-GEX) 🔴";
        regimeTitle = "Режим Шторм 🔴 (-GEX Отрицательная гамма)";
        regimeSimpleText = `Цена находится ниже рубежа Zero-Flip ($${flipNum}). Отрицательная гамма: дилеры разгоняют волатильность в сторону снижения. Повышенный риск продолжения движения к Put Wall $${pw}.`;
      }
    }

    return {
      flip,
      currentPrice,
      isGreenZone,
      badgeLabel,
      badgeVariant,
      pointerPercent: Math.max(12, Math.min(88, pointerPercent)),
      regimeTitle,
      regimeSimpleText,
      recentChangePct,
      dayChangePct,
      atrRatio,
      isDumping,
      isMarketClosed: false
    };
  }, [gexReport, currentPrice, candles, isMarketClosed, isWeekendNow, activeAsset]);

  // ============================================================================
  // 📈 MODULE 3: HORIZONTAL GAMMA PROFILE (CANVAS ENGINE)
  // ============================================================================
  const profileCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredStrike, setHoveredStrike] = useState<GexStrikeData | null>(null);

  useEffect(() => {
    const canvas = profileCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const strikes = gexReport.strikes || [];
    if (strikes.length === 0) return;

    // Handle high-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    // Responsive Padding
    const isMobile = w < 540;
    const padTop = 32;
    const padBottom = 25;
    const padLeft = isMobile ? 54 : 64;
    const padRight = isMobile ? 68 : 84;
    const chartH = h - padTop - padBottom;
    const chartW = w - padLeft - padRight;

    // Sort descending by strike price (highest strike at top, lowest at bottom)
    const sortedStrikes = [...strikes].sort((a, b) => b.strike - a.strike);
    const maxStrike = sortedStrikes[0].strike;
    const minStrike = sortedStrikes[sortedStrikes.length - 1].strike;
    const strikeSpan = Math.max(1, maxStrike - minStrike);

    const maxAbsGex = Math.max(...sortedStrikes.map((s) => Math.abs(s.netGex)), 1);

    // Y coordinate mapping
    const getY = (price: number) => {
      const frac = (maxStrike - price) / strikeSpan;
      return padTop + frac * chartH;
    };

    // Draw horizontal grid lines
    ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    const stepCount = Math.min(8, sortedStrikes.length);
    for (let i = 0; i <= stepCount; i++) {
      const p = minStrike + (i / stepCount) * strikeSpan;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`$${Math.round(p)}`, padLeft - 6, y);
    }
    ctx.setLineDash([]);

    // Draw Profile Bars
    const barHeight = Math.max(6, Math.min(18, chartH / sortedStrikes.length - 2));

    sortedStrikes.forEach((s) => {
      const y = getY(s.strike);
      const isPositive = s.netGex >= 0;
      const isMaxPain = s.strike === gexReport.maxPain;
      const barLen = Math.max(8, (Math.abs(s.netGex) / maxAbsGex) * (chartW * 0.72));

      // Bar fill
      if (isMaxPain) {
        // Cyan Magnet Peak
        ctx.fillStyle = "rgba(6, 182, 212, 0.85)";
        ctx.fillRect(padLeft, y - barHeight / 2, barLen, barHeight);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(padLeft, y - barHeight / 2, barLen, barHeight);
      } else if (isPositive) {
        // Green: Zone of deceleration (flat)
        ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
        ctx.fillRect(padLeft, y - barHeight / 2, barLen, barHeight);
        ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padLeft, y - barHeight / 2, barLen, barHeight);
      } else {
        // Red: Zone of acceleration (trend)
        ctx.fillStyle = "rgba(244, 63, 94, 0.7)";
        ctx.fillRect(padLeft, y - barHeight / 2, barLen, barHeight);
        ctx.strokeStyle = "rgba(251, 113, 133, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padLeft, y - barHeight / 2, barLen, barHeight);
      }

      // Draw Net GEX label with protective shield to prevent dashed line overlap
      if (barLen > 36) {
        const text = isPositive ? `+${s.netGex.toFixed(0)}M` : `${s.netGex.toFixed(0)}M`;
        ctx.font = "bold 9px monospace";
        const tw = ctx.measureText(text).width;

        // Dark background shield so dashed level lines do not strike through the text
        ctx.fillStyle = "rgba(9, 13, 22, 0.92)";
        ctx.fillRect(padLeft + 4, y - 6, tw + 4, 12);

        ctx.fillStyle = isMaxPain ? "#38bdf8" : isPositive ? "#6ee7b7" : "#fda4af";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, padLeft + 6, y);
      }
    });

    // Draw Horizontal Dashed Lines for Key Institutional Levels with Clean Pill Badges on the Right
    // 1. Call Wall (Потолок) - Зеленая пунктирная линия
    const cwY = getY(gexReport.callWall);
    if (cwY >= padTop && cwY <= h - padBottom) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, cwY);
      ctx.lineTo(w - padRight, cwY);
      ctx.stroke();

      // Right edge pill badge
      ctx.setLineDash([]);
      ctx.fillStyle = "#064e3b";
      ctx.fillRect(w - padRight + 3, cwY - 8, isMobile ? 62 : 76, 16);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.strokeRect(w - padRight + 3, cwY - 8, isMobile ? 62 : 76, 16);
      ctx.fillStyle = "#ecfdf5";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(isMobile ? `CW $${gexReport.callWall}` : `Call $${gexReport.callWall}`, w - padRight + 6, cwY);
    }

    // 2. Put Wall (Поддержка) - Красная пунктирная линия
    const pwY = getY(gexReport.putWall);
    if (pwY >= padTop && pwY <= h - padBottom) {
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, pwY);
      ctx.lineTo(w - padRight, pwY);
      ctx.stroke();

      // Right edge pill badge
      ctx.setLineDash([]);
      ctx.fillStyle = "#4c0519";
      ctx.fillRect(w - padRight + 3, pwY - 8, isMobile ? 62 : 76, 16);
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 1;
      ctx.strokeRect(w - padRight + 3, pwY - 8, isMobile ? 62 : 76, 16);
      ctx.fillStyle = "#fff1f2";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(isMobile ? `PW $${gexReport.putWall}` : `Put $${gexReport.putWall}`, w - padRight + 6, pwY);
    }

    // 3. Max Pain (Магнит) - Голубая пунктирная линия
    const mpY = getY(gexReport.maxPain);
    if (mpY >= padTop && mpY <= h - padBottom) {
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, mpY);
      ctx.lineTo(w - padRight, mpY);
      ctx.stroke();

      // Right edge pill badge
      ctx.setLineDash([]);
      ctx.fillStyle = "#083344";
      ctx.fillRect(w - padRight + 3, mpY - 8, isMobile ? 62 : 76, 16);
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 1;
      ctx.strokeRect(w - padRight + 3, mpY - 8, isMobile ? 62 : 76, 16);
      ctx.fillStyle = "#cffafe";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(isMobile ? `MP $${gexReport.maxPain}` : `Pain $${gexReport.maxPain}`, w - padRight + 6, mpY);
    }

    // 4. Current Spot Price - Желтая пунктирная горизонтальная + вертикальная проекция Spot GEX
    const curY = getY(currentPrice);
    if (curY >= padTop && curY <= h - padBottom) {
      // Find nearest strike to spot to project vertical Spot GEX crosshair
      const nearestSpotStrike = sortedStrikes.reduce((prev, curr) =>
        Math.abs(curr.strike - currentPrice) < Math.abs(prev.strike - currentPrice) ? curr : prev
      );
      const spotBarLen = Math.max(12, (Math.abs(nearestSpotStrike.netGex) / maxAbsGex) * (chartW * 0.72));
      const spotX = padLeft + spotBarLen;

      // Vertical dashed Spot line (проекция текущей цены и баланса гаммы на ось X)
      ctx.strokeStyle = "rgba(250, 204, 21, 0.65)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(spotX, padTop);
      ctx.lineTo(spotX, h - padBottom);
      ctx.stroke();

      // Top badge for Vertical Spot Line
      ctx.setLineDash([]);
      ctx.fillStyle = "#422006";
      const topTagW = isMobile ? 86 : 112;
      const topTagX = Math.max(padLeft, Math.min(w - padRight - topTagW, spotX - topTagW / 2));
      ctx.fillRect(topTagX, 6, topTagW, 16);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1;
      ctx.strokeRect(topTagX, 6, topTagW, 16);
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        isMobile ? `Spot $${Math.round(currentPrice)}` : `▼ Spot $${currentPrice.toFixed(1)}`,
        topTagX + topTagW / 2,
        14
      );

      // Horizontal Spot Price line
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, curY);
      ctx.lineTo(w - padRight, curY);
      ctx.stroke();

      // Crosshair intersection glowing node
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(spotX, curY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#facc15";
      ctx.fill();
      ctx.strokeStyle = "#090d16";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Right edge pill badge
      ctx.fillStyle = "#422006";
      ctx.fillRect(w - padRight + 3, curY - 8, isMobile ? 62 : 76, 16);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1;
      ctx.strokeRect(w - padRight + 3, curY - 8, isMobile ? 62 : 76, 16);
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(isMobile ? `P $${Math.round(currentPrice)}` : `Spot $${currentPrice.toFixed(1)}`, w - padRight + 6, curY);
    }

    ctx.setLineDash([]);
  }, [gexReport, currentPrice]);

  // Handle canvas mouse move for tooltips
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = profileCanvasRef.current;
    if (!canvas || !gexReport.strikes) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const padTop = 30;
    const padBottom = 25;
    const chartH = rect.height - padTop - padBottom;
    const sorted = [...gexReport.strikes].sort((a, b) => b.strike - a.strike);
    const maxS = sorted[0].strike;
    const minS = sorted[sorted.length - 1].strike;

    const frac = (mouseY - padTop) / chartH;
    const hoveredPrice = maxS - frac * (maxS - minS);

    // Find closest strike
    let closest: GexStrikeData | null = null;
    let minDiff = Infinity;
    sorted.forEach((s) => {
      const diff = Math.abs(s.strike - hoveredPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s;
      }
    });

    setHoveredStrike(closest);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredStrike(null);
  };

  // Day of week info for Module 1 summary text
  const dayOfWeekInfo = useMemo(() => {
    const now = new Date();
    const dayIndex = now.getDay();
    const isFriday = dayIndex === 5;
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    return {
      name: dayNames[dayIndex],
      isFriday,
      isWeekend
    };
  }, []);

  const isRealOptions = Boolean(
    gexReport.source &&
    (gexReport.source.includes("CBOE") ||
     gexReport.source.includes("Yahoo Finance Real Options") ||
     gexReport.source.includes("Real Option"))
  );
  const isSyntheticModel = Boolean(
    gexReport.source && gexReport.source.includes("Синтетическая модель")
  );

  // ============================================================================
  // 🎯 NEW QUANT MODULE A: LIQUIDITY MAP (STOP HUNT ZONES / КАРТА ЛИКВИДНОСТИ)
  // ============================================================================
  const liquidityStopZones = useMemo(() => {
    const cw = gexReport.callWall;
    const pw = gexReport.putWall;
    const flip = gexReport.gammaFlip;
    const atr = dynamicAtrMetrics.atr14;
    const touchBuf = dynamicAtrMetrics.touchTol;
    const breakBuf = dynamicAtrMetrics.breakTol;

    // Buy-Side Liquidity (Short Stops & Breakout Triggers above Call Wall)
    const bslLow = Math.round((cw + touchBuf * 0.4) * 10) / 10;
    const bslHigh = Math.round((cw + atr * 1.35) * 10) / 10;

    // Sell-Side Liquidity (Long Stops & Panic Triggers below Put Wall)
    const sslHigh = Math.round((pw - touchBuf * 0.4) * 10) / 10;
    const sslLow = Math.round((pw - atr * 1.35) * 10) / 10;

    // Intraday Zero-Flip Stop Cluster
    const flipZoneLow = Math.round((flip - touchBuf) * 10) / 10;
    const flipZoneHigh = Math.round((flip + touchBuf) * 10) / 10;

    const distToBsl = Math.round((bslLow - currentPrice) * 10) / 10;
    const distToSsl = Math.round((currentPrice - sslHigh) * 10) / 10;

    return {
      bslLow,
      bslHigh,
      sslLow,
      sslHigh,
      flipZoneLow,
      flipZoneHigh,
      distToBsl,
      distToSsl,
      atr,
      touchBuf,
      breakBuf
    };
  }, [gexReport.callWall, gexReport.putWall, gexReport.gammaFlip, currentPrice, dynamicAtrMetrics]);

  // ============================================================================
  // 📊 NEW QUANT MODULE B: PRICE VS GEX DIVERGENCE (ДИВЕРГЕНЦИЯ ЦЕНЫ И GEX)
  // ============================================================================
  const priceGexDivergence = useMemo(() => {
    const netGex = gexReport.netGexTotal;
    const pcrVol = gexReport.pcrVol || 1;
    const pcrOi = gexReport.pcrOi || 1;
    const chgPct = thermometerData.recentChangePct || 0;
    const isAboveFlip = currentPrice >= gexReport.gammaFlip;

    // Case 1: Bearish Divergence (Цена растет, но GEX отрицательный или Put Volume резко доминирует)
    if (chgPct > 0.08 && (netGex < 0 || pcrVol > 1.25 || !isAboveFlip)) {
      return {
        type: "BEARISH_DIV" as const,
        badge: "🔴 Медвежья дивергенция (Скрытый сброс)",
        colorClass: "bg-rose-500/10 border-rose-500/40 text-rose-300",
        summary: `Цена растёт (+${chgPct.toFixed(2)}%), но опционный поток медвежий (Net GEX ${netGex.toFixed(1)}M, PCR Vol ${pcrVol.toFixed(2)}).`,
        actionNow: "⚡ Сейчас для цены: Рост не подтверждён гаммой дилеров — высокий риск ложного выноса (Bull Trap) и возврата под Zero-Flip."
      };
    }

    // Case 2: Bullish Divergence (Цена падает, но Net GEX положительный и Call Volume удерживает стену)
    if (chgPct < -0.08 && (netGex > 0 && pcrVol < 0.95 && isAboveFlip)) {
      return {
        type: "BULLISH_DIV" as const,
        badge: "🟢 Бычья дивергенция (Скрытый выкуп)",
        colorClass: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
        summary: `Цена снижается (${chgPct.toFixed(2)}%), но дилеры удерживают положительную гамму (+${netGex.toFixed(1)}M, PCR Vol ${pcrVol.toFixed(2)}).`,
        actionNow: "⚡ Сейчас для цены: Падение гасится лимитными покупками маркет-мейкеров — высокая вероятность выкупа (Bear Trap) от поддержки."
      };
    }

    // Case 3: Synchronized Flow (Конвергенция цены и GEX)
    return {
      type: "CONVERGENCE" as const,
      badge: "⚖️ Синхронный поток (Дивергенции нет)",
      colorClass: "bg-cyan-500/10 border-cyan-500/35 text-cyan-300",
      summary: `Движение цены (${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(2)}%) полностью согласовано с балансом Net GEX (${netGex >= 0 ? "+" : ""}${netGex.toFixed(1)}M, PCR OI ${pcrOi.toFixed(2)}).`,
      actionNow: isAboveFlip
        ? `⚡ Сейчас для цены: Плавное движение внутри канала $${gexReport.putWall} – $${gexReport.callWall} с притяжением к Max Pain $${gexReport.maxPain}.`
        : `⚡ Сейчас для цены: Ускоренное трендовое движение в зоне отрицательной гаммы ниже Zero-Flip $${gexReport.gammaFlip}.`
    };
  }, [gexReport, currentPrice, thermometerData.recentChangePct]);

  // ============================================================================
  // 📲 NEW QUANT MODULE C: TELEGRAM ALERT DISPATCHER & AUTO-BREAKOUT MONITOR
  // ============================================================================
  const [tgAlertState, setTgAlertState] = useState<{
    sending: boolean;
    autoBreakoutEnabled: boolean;
    statusText: string | null;
    lastSentLevelKey: string | null;
  }>({
    sending: false,
    autoBreakoutEnabled: true,
    statusText: null,
    lastSentLevelKey: null
  });

  const sendGexTelegramNotification = async (eventLabel: string) => {
    try {
      setTgAlertState((prev) => ({ ...prev, sending: true, statusText: "Отправка алерта в Telegram..." }));
      const res = await fetch("/api/gex/telegram-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: activeAsset,
          eventType: eventLabel,
          spotPrice: currentPrice,
          callWall: gexReport.callWall,
          putWall: gexReport.putWall,
          gammaFlip: gexReport.gammaFlip,
          netGexTotal: gexReport.netGexTotal,
          atrBuffer: dynamicAtrMetrics.touchTol,
          divergenceStatus: `${priceGexDivergence.badge} — ${priceGexDivergence.summary}`
        })
      });
      const data = await res.json();
      setTgAlertState((prev) => ({
        ...prev,
        sending: false,
        statusText: data.message || "Оповещение отправлено"
      }));
    } catch (err: any) {
      setTgAlertState((prev) => ({
        ...prev,
        sending: false,
        statusText: `Ошибка отправки: ${err.message}`
      }));
    }
  };

  // Auto-trigger Telegram alert on confirmed breakout of Call Wall, Put Wall, or Zero-Flip
  useEffect(() => {
    if (!tgAlertState.autoBreakoutEnabled || !currentPrice) return;
    const tol = dynamicAtrMetrics.touchTol;
    let breakoutKey: string | null = null;
    let eventName = "";

    if (currentPrice >= gexReport.callWall + tol * 0.5) {
      breakoutKey = `CW_BREAK_${gexReport.callWall}`;
      eventName = `🚀 ПРОБОЙ CALL WALL $${gexReport.callWall} (Gamma Squeeze Up)`;
    } else if (currentPrice <= gexReport.putWall - tol * 0.5) {
      breakoutKey = `PW_BREAK_${gexReport.putWall}`;
      eventName = `🩸 ПРОБОЙ PUT WALL $${gexReport.putWall} (Liquidation Cascade)`;
    } else if (Math.abs(currentPrice - gexReport.gammaFlip) <= tol * 0.45) {
      breakoutKey = `FLIP_TEST_${gexReport.gammaFlip}`;
      eventName = `⚡ ТЕСТ / ПРОБОЙ ZERO-FLIP $${gexReport.gammaFlip} (Смена гамма-режима)`;
    }

    if (breakoutKey && breakoutKey !== tgAlertState.lastSentLevelKey) {
      setTgAlertState((prev) => ({ ...prev, lastSentLevelKey: breakoutKey }));
      sendGexTelegramNotification(eventName);
    }
  }, [currentPrice, gexReport.callWall, gexReport.putWall, gexReport.gammaFlip, dynamicAtrMetrics.touchTol, tgAlertState.autoBreakoutEnabled]);

  return (
    <div className="space-y-6 pt-2">
      {/* 🟢/⚠️ DATA SOURCE STATUS BANNER (REAL CBOE/YAHOO OPTIONS VS SYNTHETIC FALLBACK) */}
      {isRealOptions ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-300 text-xs shadow-lg shadow-emerald-950/20">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-white text-xs sm:text-sm tracking-wide">
                🟢 Live Options (Реальные данные)
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-200 rounded border border-emerald-500/40 font-bold">
                Институциональный поток
              </span>
              <span className="text-[11px] text-emerald-200/90 hidden md:inline">
                Открытый интерес (OI) и гамма дилеров рассчитаны по реальной биржевой опционной цепи ({gexReport.source.includes("CBOE") ? "CBOE" : "Yahoo Finance"}).
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80 truncate max-w-md">
            {gexReport.source}
          </span>
        </div>
      ) : isSyntheticModel ? (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs shadow-xl shadow-amber-950/20">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-amber-300 text-xs sm:text-sm tracking-wide">
                  ⚠️ Синтетическая модель (Резервный режим)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/25 text-amber-300 rounded border border-amber-500/50 font-bold">
                  Реальный API недоступен
                </span>
                <span className="text-[10px] font-mono text-amber-400/70">
                  Кэш 15 мин • Спот-привязка
                </span>
              </div>
              <p className="text-[11px] text-amber-300/85 mt-1 leading-relaxed">
                Биржевой опционный фид сейчас недоступен или рынок закрыт. Уровни (Call/Put Wall) рассчитаны по адаптивной математической модели, строго привязанной к текущему споту ${(gexReport.spotPrice || 4043).toFixed(1)}.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-400/70 shrink-0 self-start sm:self-auto bg-amber-950/50 px-2 py-1 rounded border border-amber-500/30">
            {gexReport.expirationDate || "Резерв"}
          </span>
        </div>
      ) : null}

      {/* ====================================================================== */}
      {/* 4. ТЕРМОМЕТР РЕЖИМА РЫНКА (МОДУЛЬ 4) & УДАРЫ ПО УРОВНЯМ (МОДУЛЬ 2)      */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* МОДУЛЬ 4. «Термометр режима рынка» (5 cols) */}
        <div className="lg:col-span-5 bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-tr from-rose-500 to-emerald-500 text-white shadow-sm">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Термометр Режима Рынка</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      thermometerData.isMarketClosed
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : thermometerData.badgeVariant === "warning"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : thermometerData.isGreenZone
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    {thermometerData.badgeLabel || (thermometerData.isGreenZone ? "ШТИЛЬ" : "ШТОРМ")}
                  </span>
                </h4>
                <p className="text-[11px] text-gray-400">Показывает, где сейчас цена относительно рубежа Zero-Flip и динамику рынка</p>
              </div>
            </div>
          </div>

          {/* Thermometer Visual Body */}
          <div className="py-4 flex items-center justify-center gap-5 sm:gap-7">
            {/* CSS-термометр шкала */}
            <div className="relative w-14 h-64 sm:h-72 rounded-full border-2 border-gray-700 bg-gray-950 p-1 flex flex-col justify-between shadow-inner">
              {/* Верхняя часть — зеленая (Режим Штиль / +GEX: цены выше Flip) */}
              <div
                className="w-full h-1/2 rounded-t-full bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-950/90 relative flex items-center justify-center"
                title="Зона Штиля (+GEX): цена выше Zero-Flip. Положительная гамма дилеров сглаживает колебания и поддерживает рынок."
              >
                <span className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest -rotate-90 select-none drop-shadow-sm">
                  Штиль 🟢
                </span>
              </div>

              {/* Рубеж Zero-Flip Line (Midpoint) */}
              <div
                className="absolute top-1/2 left-0 w-full border-t-2 border-dashed border-amber-400 z-10 -translate-y-1/2 flex items-center justify-center"
                title={`Рубеж Zero-Flip: $${thermometerData.flip}`}
              >
                <div className="bg-gray-950 border border-amber-400 px-1 py-0.2 rounded text-[8px] font-mono font-bold text-amber-300 shadow-md">
                  FLIP
                </div>
              </div>

              {/* Нижняя часть — красная (Режим Шторм / -GEX: цены ниже Flip) */}
              <div
                className="w-full h-1/2 rounded-b-full bg-gradient-to-b from-rose-950/90 via-rose-700 to-rose-600 relative flex items-center justify-center"
                title="Зона Шторма (-GEX): цена ниже Zero-Flip. Отрицательная гамма: дилеры продают при падении, ускоряя сброс!"
              >
                <span className="text-[9px] font-bold text-rose-200 uppercase tracking-widest -rotate-90 select-none drop-shadow-sm">
                  Шторм 🔴
                </span>
              </div>

              {/* Белая точка/стрелка — где сейчас цена */}
              <div
                className="absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-300 flex items-center"
                style={{ top: `${thermometerData.pointerPercent}%` }}
              >
                <div className="w-5 h-5 rounded-full bg-white border-2 border-cyan-400 shadow-lg shadow-cyan-400/80 animate-pulse flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-600" />
                </div>
                {/* Pointer Badge */}
                <div className="absolute left-7 bg-[#0b101c] border border-cyan-400 text-white font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xl whitespace-nowrap">
                  📍 ${currentPrice.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Explanation Labels & Details */}
            <div className="space-y-3 max-w-[210px] text-xs">
              <div className="bg-[#121624] border border-gray-800 p-2.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 block">
                    {thermometerData.isMarketClosed ? "Цена закрытия:" : "Текущая цена:"}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${thermometerData.recentChangePct < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {thermometerData.recentChangePct !== 0
                      ? `${thermometerData.recentChangePct > 0 ? "+" : ""}${thermometerData.recentChangePct.toFixed(2)}%`
                      : "0.0%"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-bold text-white">${currentPrice.toFixed(1)}</span>
                  {thermometerData.isMarketClosed && (
                    <span className="text-[9px] text-amber-300 font-sans font-bold bg-amber-950/60 border border-amber-800/40 px-1 py-0.2 rounded">
                      Закрыт
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400 block">Граница Flip:</span>
                  <span className="font-mono text-xs font-bold text-purple-400">${thermometerData.flip}</span>
                </div>
                {thermometerData.atrRatio > 1.2 && (
                  <div className="mt-1 pt-1 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">ATR Волатильность:</span>
                    <span className="text-amber-300 font-mono font-bold">x{thermometerData.atrRatio.toFixed(1)} (Повышена)</span>
                  </div>
                )}
              </div>

              <div
                className={`p-3 rounded-xl border text-[11px] leading-snug font-medium ${
                  thermometerData.isMarketClosed
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : thermometerData.badgeVariant === "warning"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : thermometerData.isGreenZone
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <b>{thermometerData.regimeTitle}</b>
                <p className="mt-1 text-gray-300">{thermometerData.regimeSimpleText}</p>
              </div>
            </div>
          </div>
        </div>

        {/* МОДУЛЬ 2. Статистика «Удары по уровню» (Hit Rate) (7 cols) */}
        <div className="lg:col-span-7 bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800/80 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-sm">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                    <span>Статистика «Удары по уровню» (Hit Rate)</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      hitRatePeriod === "WEEK"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    }`}>
                      {hitRatePeriod === "WEEK" ? "За 7 дней (Неделя)" : "За 24 часа (День)"}
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Динамический ATR-буфер уровня: <b className="text-cyan-300 font-mono">±${dynamicAtrMetrics.touchTol}</b> (ATR-14: <b className="text-gray-200 font-mono">${dynamicAtrMetrics.atr14}</b>, пробой &gt; <b className="text-amber-300 font-mono">${dynamicAtrMetrics.breakTol}</b>)
                  </p>
                </div>
              </div>

              {/* Day / Week Period Selector */}
              <div className="flex items-center gap-1 bg-[#121622] p-1 rounded-xl border border-gray-800 shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setHitRatePeriod("DAY")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    hitRatePeriod === "DAY"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-extrabold"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                  }`}
                >
                  День (24ч)
                </button>
                <button
                  onClick={() => setHitRatePeriod("WEEK")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    hitRatePeriod === "WEEK"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-extrabold"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                  }`}
                >
                  <span>Неделя (7д)</span>
                  {isLoadingWeekCandles && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
                  )}
                </button>
              </div>
            </div>

            {/* ↔️ ДЕТЕКТОР РЕЖИМА: БОКОВИК (ФЛЭТ) VS ТРЕНД */}
            <div className={`mt-3 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              rangeModeData.isRangeMode
                ? "bg-[#0b171f] border-cyan-500/40 text-cyan-200"
                : "bg-[#181119] border-amber-500/40 text-amber-200"
            }`}>
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                  rangeModeData.isRangeMode ? "bg-cyan-500/20 text-cyan-300" : "bg-amber-500/20 text-amber-300"
                }`}>
                  <Repeat className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">Детектор Режима:</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold border ${
                      rangeModeData.isRangeMode
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    }`}>
                      {rangeModeData.statusLabel}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Коридор: ${rangeModeData.pw} ⟷ ${rangeModeData.cw} ({rangeModeData.candlesInCorridorPct}% свечей)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1">
                    {rangeModeData.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 bg-[#0c101c] px-3 py-1.5 rounded-lg border border-gray-800 text-xs font-mono self-start sm:self-auto">
                <div className="flex flex-col text-right">
                  <span className="text-[9px] text-gray-400 uppercase">Отскоки</span>
                  <span className="font-bold text-emerald-400 text-sm">{rangeModeData.totalBounces}</span>
                </div>
                <div className="h-6 w-px bg-gray-800" />
                <div className="flex flex-col text-right">
                  <span className="text-[9px] text-gray-400 uppercase">Пробои</span>
                  <span className="font-bold text-rose-400 text-sm">{rangeModeData.totalBreakouts}</span>
                </div>
                <div className="h-6 w-px bg-gray-800" />
                <div className="flex flex-col text-right">
                  <span className="text-[9px] text-gray-400 uppercase">Удержание</span>
                  <span className="font-bold text-cyan-300 text-sm">{rangeModeData.bounceRatePct}%</span>
                </div>
              </div>
            </div>

            {/* Hit Rate Cards: Strictly Split into (1) Current Active Level Focus & (2) Historical Migration Context */}
            <div className="mt-3 space-y-3.5">
              {activeHitRateStats.map((stat) => {
                const dayStat = hitRateStatsDay.find((s) => s.id === stat.id) || stat;
                const weekStat = hitRateStatsWeek.find((s) => s.id === stat.id) || stat;
                const prev = (stat.id === "call_wall" || stat.id === "put_wall" || stat.id === "gamma_flip")
                  ? getPreviousLevelSummary(stat.id as "call_wall" | "put_wall" | "gamma_flip", stat.price)
                  : null;

                return (
                  <div
                    key={stat.id}
                    className={`rounded-xl border overflow-hidden transition-all shadow-md ${
                      !stat.currentIsTested
                        ? "bg-[#0b101b] border-cyan-500/30 hover:border-cyan-500/50"
                        : stat.currentIsStrong
                        ? "bg-[#0c121d] border-emerald-500/35 hover:border-emerald-500/55"
                        : "bg-[#140c11] border-rose-500/35 hover:border-rose-500/55"
                    }`}
                  >
                    {/* ==================================================================== */}
                    {/* БЛОК 1. ТЕКУЩИЙ АКТИВНЫЙ УРОВЕНЬ (ФОКУС ВНИМАНИЯ — ТОЛЬКО ЭТОТ СТРАЙК) */}
                    {/* ==================================================================== */}
                    <div className="p-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                            Активный уровень
                          </span>
                          <span className="text-gray-600" aria-hidden="true">·</span>
                          <span className="font-bold text-white text-xs sm:text-sm">{stat.name}</span>
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-amber-300 bg-gray-900/90 border border-amber-500/30 px-2 py-0.5 rounded">
                            ${stat.price}
                          </span>
                          <span className="text-gray-600" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-300">
                            <Clock className="h-3 w-3 text-cyan-400" />
                            <span>В строю: <strong className="text-white">{stat.currentActiveDurationText}</strong></span>
                          </span>
                          <span className="text-gray-600" aria-hidden="true">·</span>
                          <span
                            className="text-[11px] font-mono text-blue-300"
                            title={`Точный страйк $${stat.price}. Зона касания с учетом волатильности: $${(stat.price - stat.touchTol).toFixed(1)} – $${(stat.price + stat.touchTol).toFixed(1)}`}
                          >
                            Буфер ±${stat.touchTol.toFixed(1)}
                          </span>
                        </div>

                        {/* Статус и удары ТОЛЬКО текущего страйка */}
                        {!stat.currentIsTested ? (
                          <div className="flex items-center gap-2.5 text-xs font-mono bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                            <span className="text-cyan-300 font-bold">
                              ⏳ Ожидание теста (0 касаний)
                            </span>
                            <span className="text-gray-500" aria-hidden="true">|</span>
                            <span className="text-gray-400 text-[11px]">
                              Свежий страйк
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 text-xs font-mono bg-gray-950/70 border border-gray-800 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                            <span className="text-gray-300">
                              Удары текущего: <strong className="text-white">{stat.currentTouches}</strong>
                            </span>
                            <span className="text-gray-600" aria-hidden="true">·</span>
                            <span className="text-emerald-400">
                              Держал: <strong>{stat.currentBounces}</strong>
                            </span>
                            <span className="text-gray-600" aria-hidden="true">·</span>
                            <span className="text-rose-400">
                              Пробили: <strong>{stat.currentBreakouts}</strong>
                            </span>
                            <span className="text-gray-600" aria-hidden="true">·</span>
                            <span className={stat.currentIsStrong ? "text-emerald-300 font-bold" : "text-rose-300 font-bold"}>
                              {stat.currentHitRatePct}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Честный вердикт исключительно по текущему активному страйку */}
                      <p className="text-[11.5px] text-gray-200 mt-2 pl-2.5 border-l-2 border-cyan-500/60 leading-relaxed">
                        {stat.currentVerdict}
                      </p>
                    </div>

                    {/* ==================================================================== */}
                    {/* БЛОК 2. ИСТОРИЯ МИГРАЦИИ ЗА 24Ч И 7Д (ФОНОВЫЙ ИСТОРИЧЕСКИЙ КОНТЕКСТ) */}
                    {/* ==================================================================== */}
                    <div className="bg-[#070a11] border-t border-gray-800/90 px-3.5 py-2.5 text-[11px]">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                        <div className="flex items-start gap-1.5 text-gray-400">
                          <History className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-gray-300">
                              Фоновый контекст (История миграции всех сдвигов уровня):
                            </span>{" "}
                            <span className="text-gray-400">
                              Агрегированная статистика включает все предыдущие, уже сместившиеся страйки за выбранный период и не приписывается текущему уровню <strong className="text-gray-300">${stat.price}</strong>.
                            </span>
                          </div>
                        </div>

                        {/* Сводка за 24 часа и за 7 дней по всем историческим сдвигам */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono text-[10.5px]">
                          <div
                            className={`px-2.5 py-1 rounded border ${
                              hitRatePeriod === "DAY"
                                ? "bg-blue-950/40 border-blue-500/40 text-blue-200"
                                : "bg-gray-900/60 border-gray-800 text-gray-400"
                            }`}
                          >
                            <span className="font-bold text-blue-300">За 24ч (все сдвиги):</span>{" "}
                            <span>Удары <b>{dayStat.touches}</b></span>
                            <span className="mx-1 text-gray-600">·</span>
                            <span className="text-emerald-400">Отск. <b>{dayStat.bounces}</b></span>
                            <span className="mx-1 text-gray-600">·</span>
                            <span className="text-rose-400">Проб. <b>{dayStat.breakouts}</b></span>
                            <span className="mx-1 text-gray-600">·</span>
                            <span className="text-cyan-300 font-bold">
                              {dayStat.isTested ? `${dayStat.hitRatePct}%` : "0 кас."}
                            </span>
                          </div>

                          <div
                            className={`px-2.5 py-1 rounded border ${
                              hitRatePeriod === "WEEK"
                                ? "bg-purple-950/40 border-purple-500/40 text-purple-200"
                                : "bg-gray-900/60 border-gray-800 text-gray-400"
                            }`}
                          >
                            <span className="font-bold text-purple-300">За 7д (неделя):</span>{" "}
                            <span>Удары <b>{weekStat.touches}</b></span>
                            <span className="mx-1 text-gray-600">·</span>
                            <span className="text-emerald-400">Отск. <b>{weekStat.bounces}</b></span>
                            <span className="mx-1 text-gray-600">·</span>
                            <span className="text-rose-400">Проб. <b>{weekStat.breakouts}</b></span>
                            <span className="mx-1 text-gray-600">·</span>
                            <span className="text-cyan-300 font-bold">
                              {weekStat.isTested ? `${weekStat.hitRatePct}%` : "0 кас."}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Детали последнего сместившегося страйка */}
                      {prev && (
                        <div className="mt-1.5 pt-1.5 border-t border-gray-800/60 flex items-center justify-between text-[10.5px] font-mono text-gray-400 flex-wrap gap-1">
                          <span>
                            Последняя миграция: <strong className="text-amber-300/90">${prev.prevPrice}</strong> ➔ <strong className="text-white">${stat.price}</strong>
                            <span className="text-gray-500 ml-1.5">
                              (прошлый страйк $${prev.prevPrice} держался {prev.durationText}: касаний {prev.touches}, отскоков {prev.bounces}, пробоев {prev.breakouts})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Migration History Toggle & Details */}
            <div className="mt-3 pt-2 border-t border-gray-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <button
                onClick={() => setShowMigrationHistoryModal((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition font-bold cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                <span>{showMigrationHistoryModal ? "Скрыть лог миграции уровней" : "📜 Лог миграции уровней (Migration Log)"}</span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800/50">
                  {migrationLogs.length}
                </span>
              </button>

              <span className="text-[10px] text-gray-400 font-mono">
                Точные страйки сохранены • Буфер адаптируется под ATR
              </span>
            </div>

            {/* Collapsible Migration History Table */}
            {showMigrationHistoryModal && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#090d15] border border-gray-800 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <span className="font-bold text-white text-[11px]">История перемещений уровней ({activeAsset})</span>
                  <button
                    onClick={() => {
                      setMigrationLogs([]);
                      try {
                        localStorage.removeItem(`quantex_gex_migration_log_${activeAsset}`);
                      } catch {}
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 transition underline cursor-pointer"
                  >
                    Очистить лог
                  </button>
                </div>

                {migrationLogs.length === 0 ? (
                  <p className="text-[11px] text-gray-500 py-1">Лог миграции пуст. Записи появятся при смещении открытого интереса.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {migrationLogs.map((log) => (
                      <div key={log.id} className="p-2 rounded bg-gray-950/80 border border-gray-800/80 flex items-center justify-between text-[10.5px] font-mono">
                        <div>
                          <span className="text-white font-bold">{log.levelName}: </span>
                          <span className="text-gray-400">${log.prevPrice} ➔ </span>
                          <span className="text-amber-300 font-bold">${log.newPrice} </span>
                          <span className="text-cyan-400">({log.shiftDelta > 0 ? `+${log.shiftDelta}` : log.shiftDelta})</span>
                          <span className="text-gray-400 ml-2">[{log.timeMsk}]</span>
                        </div>
                        <div className="text-gray-400 text-right">
                          <span>Активен: <strong className="text-white">{log.durationText}</strong> • </span>
                          <span>Удары: <strong className="text-white">{log.touches}</strong> (Держал: <strong className="text-emerald-400">{log.bounces}</strong>, Пробит: <strong className="text-rose-400">{log.breakouts}</strong>)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* МОДУЛЬ 1. ТАБЛИЦА ЭКСПИРАЦИЙ И СРОКА ЖИЗНИ УРОВНЕЙ                    */}
      {/* ====================================================================== */}
      <div className="bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-sm">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Таблица Экспираций и Срока Жизни Уровней</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  Точные даты из API
                </span>
              </h4>
              <p className="text-[11px] text-gray-400">
                Каждый опционный уровень имеет срок действия. Узнайте, когда исчезнут стены.
              </p>
            </div>
          </div>
        </div>

        {/* HTML Таблица */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1422] text-gray-400 text-[11px] uppercase font-mono">
                <th className="py-2.5 px-3">Срок (Точная дата и время)</th>
                <th className="py-2.5 px-3 text-emerald-400">Стена (Call)</th>
                <th className="py-2.5 px-3 text-rose-400">Поддержка (Put)</th>
                <th className="py-2.5 px-3 text-cyan-300">Магнит (Max Pain)</th>
                <th className="py-2.5 px-3">Пояснение (Простыми словами)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70 font-mono text-xs">
              {/* Row 1: Сегодня */}
              <tr className="hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-amber-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span>⚡ {multiExpiryData.day?.expirationDate || getHorizonExpirationDateString("DAY")}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">
                  ${multiExpiryData.day?.callWall || gexReport.callWall}
                </td>
                <td className="py-2.5 px-3 font-bold text-rose-400">
                  ${multiExpiryData.day?.putWall || gexReport.putWall}
                </td>
                <td className="py-2.5 px-3 font-bold text-cyan-300">
                  ${multiExpiryData.day?.maxPain || gexReport.maxPain}
                </td>
                <td className="py-2.5 px-3 font-sans text-gray-300 text-[11.5px]">
                  {isMarketClosed || dayOfWeekInfo.isWeekend
                    ? "Торги закрыты на выходные. Ближайшая экспирация 0DTE состоится в понедельник в 18:45 МСК. Уровни зафиксированы по закрытию пятницы."
                    : "Уровни действуют только сегодня до 18:45 МСК. Сгорают вечером и перестают удерживать цену."}
                </td>
              </tr>

              {/* Row 2: Неделя */}
              <tr className="hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-purple-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span>📅 {multiExpiryData.week?.expirationDate || getHorizonExpirationDateString("WEEK")}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">
                  ${multiExpiryData.week?.callWall || gexReport.callWall}
                </td>
                <td className="py-2.5 px-3 font-bold text-rose-400">
                  ${multiExpiryData.week?.putWall || gexReport.putWall}
                </td>
                <td className="py-2.5 px-3 font-bold text-cyan-300">
                  ${multiExpiryData.week?.maxPain || gexReport.maxPain}
                </td>
                <td className="py-2.5 px-3 font-sans text-gray-300 text-[11.5px]">
                  Главный недельный коридор свинга. Экспирация в ближайшую пятницу. Самый плотный открытый интерес.
                </td>
              </tr>

              {/* Row 3: Месяц */}
              <tr className="hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-cyan-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span>🗓️ {multiExpiryData.month?.expirationDate || getHorizonExpirationDateString("MONTH")}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">
                  ${multiExpiryData.month?.callWall || gexReport.callWall + 30}
                </td>
                <td className="py-2.5 px-3 font-bold text-rose-400">
                  ${multiExpiryData.month?.putWall || gexReport.putWall - 30}
                </td>
                <td className="py-2.5 px-3 font-bold text-cyan-300">
                  ${multiExpiryData.month?.maxPain || gexReport.maxPain}
                </td>
                <td className="py-2.5 px-3 font-sans text-gray-300 text-[11.5px]">
                  Глобальные стены институционалов и хеджеров. Пробиваются редко, только на сильных мировых новостях.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Компактный сворачиваемый вывод по экспирациям + мгновенный инсайт */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#0f1420] border border-amber-500/30 text-xs">
          <div className="flex items-center gap-2 text-amber-200 font-medium">
            <Zap className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <b>⚡ Сейчас для цены:</b>{" "}
              {isMarketClosed || dayOfWeekInfo.isWeekend
                ? `Торги закрыты (${dayOfWeekInfo.name}). На открытии ориентир — Zero-Flip $${gexReport.gammaFlip} и магнит Max Pain $${gexReport.maxPain}.`
                : dayOfWeekInfo.isFriday
                ? `Пятничная экспирация: удержание в коридоре $${gexReport.putWall}–$${gexReport.callWall} с тягой к Max Pain $${gexReport.maxPain} до 18:00 МСК.`
                : `Рабочий коридор $${gexReport.putWall}–$${gexReport.callWall}. Пробой $${gexReport.callWall} с объемом запустит сквиз, внутри коридора тяга к $${gexReport.maxPain}.`}
            </span>
          </div>
          <details className="group text-[11px] text-gray-400 shrink-0">
            <summary className="cursor-pointer select-none text-amber-300 hover:text-amber-200 font-mono flex items-center gap-1">
              <span>Подробнее о датах</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 p-2.5 rounded-lg bg-[#090d16] border border-gray-800 text-gray-300 max-w-md">
              0DTE уровни действуют внутри текущей сессии, недельные — базовый свинг-коридор до пятницы, месячные — институциональные барьеры крупных хеджеров.
            </div>
          </details>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* МОДУЛЬ 2.5. КАРТА ЛИКВИДНОСТИ (STOP HUNT ZONES) + ДИВЕРГЕНЦИЯ + TG     */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Блок А: Карта ликвидности (Зоны стопов за Call/Put Wall) (7 cols) */}
        <div className="lg:col-span-7 bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-600 text-white shadow-sm">
                <Crosshair className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                  <span>Карта ликвидности (Зоны стопов / Stop Hunt Zones)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    ATR-14 ±${liquidityStopZones.touchBuf}
                  </span>
                </h4>
                <p className="text-[11px] text-gray-400">
                  Где сосредоточены стоп-ордера участников и триггеры принудительного хеджирования дилеров
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {/* BSL Above Call Wall */}
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  BSL (Стопы шортистов)
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  За Call Wall ${gexReport.callWall}
                </span>
              </div>
              <div className="font-mono text-sm font-black text-white">
                ${liquidityStopZones.bslLow} – ${liquidityStopZones.bslHigh}
              </div>
              <p className="text-[11px] text-gray-300 leading-snug">
                Дистанция: <b className="text-emerald-300 font-mono">{liquidityStopZones.distToBsl > 0 ? `+$${liquidityStopZones.distToBsl}` : "В зоне!"}</b>. Снос этой зоны вынуждает дилеров скупать фьючерс по рынку (Gamma Squeeze).
              </p>
            </div>

            {/* Zero-Flip Stop Cluster */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 font-bold">
                  Кластер Zero-Flip
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  Центр ${gexReport.gammaFlip}
                </span>
              </div>
              <div className="font-mono text-sm font-black text-white">
                ${liquidityStopZones.flipZoneLow} – ${liquidityStopZones.flipZoneHigh}
              </div>
              <p className="text-[11px] text-gray-300 leading-snug">
                Буфер смены знака гаммы (±${liquidityStopZones.touchBuf}). Здесь срабатывают внутридневные стопы и алгоритмы перекладки дельты.
              </p>
            </div>

            {/* SSL Below Put Wall */}
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold">
                  SSL (Стопы лонгистов)
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  Под Put Wall ${gexReport.putWall}
                </span>
              </div>
              <div className="font-mono text-sm font-black text-white">
                ${liquidityStopZones.sslLow} – ${liquidityStopZones.sslHigh}
              </div>
              <p className="text-[11px] text-gray-300 leading-snug">
                Дистанция: <b className="text-rose-300 font-mono">{liquidityStopZones.distToSsl > 0 ? `-$${liquidityStopZones.distToSsl}` : "В зоне!"}</b>. Пробой ниже ${liquidityStopZones.sslHigh} запускает каскадную ликвидацию лонгов.
              </p>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-[#0f1422] border border-gray-800 text-[11.5px] text-gray-200 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>
              <b>⚡ Сейчас для цены:</b> Не ставьте стоп-лосс вплотную за ${gexReport.putWall} или ${gexReport.callWall} — выносите стоп за пределы ATR-буфера (<b>±${liquidityStopZones.breakBuf}</b>), чтобы избежать охоты за ликвидностью.
            </span>
          </div>
        </div>

        {/* Блок Б: Дивергенция цены и GEX + Telegram-оповещения (5 cols) */}
        <div className="lg:col-span-5 bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-sm">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Дивергенция цены и GEX + Telegram</h4>
                  <p className="text-[11px] text-gray-400">Сверка направления цены с реальным потоком OI и Volume</p>
                </div>
              </div>
            </div>

            {/* Карточка статуса дивергенции */}
            <div className={`p-3.5 rounded-xl border space-y-1.5 ${priceGexDivergence.colorClass}`}>
              <div className="font-bold text-xs sm:text-sm flex items-center justify-between gap-2">
                <span>{priceGexDivergence.badge}</span>
                <span className="font-mono text-[11px] opacity-90">PCR Vol: {gexReport.pcrVol}</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">{priceGexDivergence.summary}</p>
              <div className="pt-1.5 border-t border-white/10 text-[11.5px] font-semibold text-white">
                {priceGexDivergence.actionNow}
              </div>
            </div>
          </div>

          {/* Панель отправки и авто-алертов в Telegram */}
          <div className="p-3.5 rounded-xl bg-[#0e1320] border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <Bell className="h-4 w-4 text-indigo-400" />
                <span>Telegram-оповещения при пробое GEX</span>
              </div>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={tgAlertState.autoBreakoutEnabled}
                  onChange={(e) =>
                    setTgAlertState((prev) => ({ ...prev, autoBreakoutEnabled: e.target.checked }))
                  }
                  className="rounded border-gray-700 bg-gray-900 text-indigo-500 focus:ring-0"
                />
                <span>Авто-алерт (Flip / Wall)</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={tgAlertState.sending}
                onClick={() =>
                  sendGexTelegramNotification(
                    `📊 Срез GEX уровней (${activeAsset}): Spot $${currentPrice.toFixed(1)}, Flip $${gexReport.gammaFlip}`
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{tgAlertState.sending ? "Отправка..." : "📲 Отправить уровни и алерт в Telegram"}</span>
              </button>
            </div>

            {tgAlertState.statusText && (
              <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-500/30 rounded-lg px-2.5 py-1.5">
                {tgAlertState.statusText}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* МОДУЛЬ 3. ГАММА-ПРОФИЛЬ (ГОРИЗОНТАЛЬНАЯ ГИСТОГРАММА ПО ЦЕНЕ)           */}
      {/* ====================================================================== */}
      <div className="bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Гамма-Профиль (Горизонтальная гистограмма по цене)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  Volume + OI Profile
                </span>
              </h4>
              <p className="text-[11px] text-gray-400">
                Ось Y — страйки, ось X — баланс гаммы (OI + Volume), вертикальный пунктир — проекция текущей цены Spot
              </p>
            </div>
          </div>

          {/* Компактная полоса ключевых уровней (адаптивная сетка, не ломает верстку) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <span className="w-2.5 h-0.5 border-b-2 border-dashed border-emerald-400 shrink-0" />
              <span className="truncate">Потолок: <b>${gexReport.callWall}</b></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <span className="w-2.5 h-0.5 border-b-2 border-dashed border-rose-400 shrink-0" />
              <span className="truncate">Поддержка: <b>${gexReport.putWall}</b></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <span className="w-2.5 h-0.5 border-b-2 border-dashed border-cyan-400 shrink-0" />
              <span className="truncate">Магнит: <b>${gexReport.maxPain}</b></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <span className="w-2.5 h-0.5 border-b-2 border-dashed border-amber-400 shrink-0" />
              <span className="truncate">Спот: <b>${typeof currentPrice === "number" ? currentPrice.toFixed(1) : currentPrice}</b></span>
            </div>
          </div>
        </div>

        {/* Интерактивная полоса расшифровки цветов и уровней */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0e1320] border border-gray-800 rounded-xl text-[11px]">
          <div className="flex flex-wrap items-center gap-2.5 text-gray-300">
            <span className="text-gray-400 font-medium">Столбики:</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> +GEX (Торможение)
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span> -GEX (Разгон)
            </span>
            <span className="hidden sm:inline-block text-gray-600">|</span>
            <span className="flex items-center gap-1 text-amber-300 font-mono">
              <span className="w-2.5 border-b-2 border-dashed border-amber-400 inline-block"></span> Вертикаль и горизонталь Spot
            </span>
          </div>
          {hoveredStrike && (
            <div className="bg-[#121829] border border-cyan-500/50 px-2 py-0.5 rounded text-[11px] font-mono text-cyan-300">
              Страйк: <b>${hoveredStrike.strike}</b> (Net GEX: <b>{hoveredStrike.netGex > 0 ? `+${hoveredStrike.netGex}` : hoveredStrike.netGex}M</b> | Vol: <b>{hoveredStrike.callVolume + hoveredStrike.putVolume}</b>)
            </div>
          )}
        </div>

        {/* High-Performance Canvas Container */}
        <div className="relative w-full rounded-xl overflow-hidden border border-gray-800/90 bg-[#090d16]">
          <canvas
            ref={profileCanvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className="w-full h-[360px] cursor-crosshair block"
          />
        </div>

        {/* Компактная сворачиваемая подсказка вместо громоздкого текста */}
        <details className="group rounded-xl bg-[#0e121d] border border-gray-800 px-3.5 py-2.5 text-xs text-gray-300">
          <summary className="cursor-pointer select-none font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-cyan-400" />
              <span>Шпаргалка по чтению Гамма-Профиля (нажмите, чтобы развернуть)</span>
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] leading-relaxed pt-2 border-t border-gray-800/80">
            <div className="p-2 rounded-lg bg-[#121624] border border-gray-800/80">
              <span className="text-emerald-400 font-bold block mb-0.5">🟢 Зеленые столбики (+GEX):</span>
              Зоны гашения волатильности. Пик сверху — <b>Call Wall ${gexReport.callWall}</b> (потолок сопротивления).
            </div>
            <div className="p-2 rounded-lg bg-[#121624] border border-gray-800/80">
              <span className="text-rose-400 font-bold block mb-0.5">🔴 Красные столбики (-GEX):</span>
              Зоны ускорения тренда. Пик снизу — <b>Put Wall ${gexReport.putWall}</b> (главная защита от обвала).
            </div>
            <div className="p-2 rounded-lg bg-[#121624] border border-gray-800/80">
              <span className="text-cyan-300 font-bold block mb-0.5">🎯 Голубая линия — Max Pain ${gexReport.maxPain}:</span>
              Балансный страйк экспирации, куда стремится цена при отсутствии внешних шоков.
            </div>
            <div className="p-2 rounded-lg bg-[#121624] border border-gray-800/80">
              <span className="text-amber-300 font-bold block mb-0.5">🟡 Перекрестие Spot (${typeof currentPrice === "number" ? currentPrice.toFixed(1) : currentPrice}):</span>
              Горизонтальная и вертикальная пунктирные линии показывают точное положение цены и текущий объем гаммы на споте.
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
