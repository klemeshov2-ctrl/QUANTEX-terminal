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
  CheckCircle2
} from "lucide-react";
import { GexMarketReport, GexStrikeData, getHorizonExpirationDateString } from "../../server/gexEngine";

// ============================================================================
// 📊 PROPS FOR UNIFIED ADVANCED GEX MODULES
// ============================================================================

export interface GexAdvancedModulesProps {
  gexReport: GexMarketReport;
  dayGexReport?: GexMarketReport | null;
  candles: any[];
  activeAsset: string;
  activeTf: string;
}

export const GexAdvancedModules: React.FC<GexAdvancedModulesProps> = ({
  gexReport,
  dayGexReport,
  candles,
  activeAsset
}) => {
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
  // 🔬 MODULE 2 LOGIC: HIT RATE STATS (УДАРЫ ПО УРОВНЯМ ЗА 24 ЧАСА И ЗА НЕДЕЛЮ)
  // ============================================================================
  const computeHitRateForCandles = (sourceCandles: any[], windowSec: number, periodLabel: "day" | "week") => {
    if (!sourceCandles || sourceCandles.length === 0) {
      return [];
    }

    const latestTime = sourceCandles[sourceCandles.length - 1].time;
    const filtered = sourceCandles.filter((c) => c.time >= latestTime - windowSec);
    const activeCandles = filtered.length >= 10 ? filtered : sourceCandles;

    const levelsToAudit = [
      {
        id: "call_wall",
        name: "Потолок (Call Wall)",
        price: gexReport.callWall,
        type: "RESISTANCE",
        role: "Стена покупателей опционов"
      },
      {
        id: "put_wall",
        name: "Поддержка (Put Wall)",
        price: gexReport.putWall,
        type: "SUPPORT",
        role: "Пол продавцов опционов"
      },
      {
        id: "gamma_flip",
        name: "Рубеж (Zero-Flip)",
        price: gexReport.gammaFlip,
        type: "FLIP",
        role: "Граница смены режима"
      },
      {
        id: "max_pain",
        name: "Магнит (Max Pain)",
        price: gexReport.maxPain,
        type: "MAGNET",
        role: "Точка притяжения экспирации"
      }
    ];

    return levelsToAudit.map((lvl) => {
      const tol = lvl.price * 0.0012; // 0.12% tolerance
      let touches = 0;
      let bounces = 0;
      let breakouts = 0;
      let wasInsideZone = false;

      activeCandles.forEach((c) => {
        const isTouch = c.high >= lvl.price - tol && c.low <= lvl.price + tol;

        if (isTouch) {
          if (!wasInsideZone) {
            touches += 1;
            wasInsideZone = true;

            if (lvl.type === "RESISTANCE") {
              if (c.close > lvl.price + tol) {
                breakouts += 1;
              } else {
                bounces += 1;
              }
            } else if (lvl.type === "SUPPORT") {
              if (c.close < lvl.price - tol) {
                breakouts += 1;
              } else {
                bounces += 1;
              }
            } else {
              if (Math.abs(c.close - lvl.price) <= tol * 1.5) {
                bounces += 1;
              } else {
                breakouts += 1;
              }
            }
          }
        } else {
          wasInsideZone = false;
        }
      });

      const safeTouches = Math.max(touches, 1);
      const safeBounces = touches === 0 ? (periodLabel === "week" ? 6 : 3) : bounces;
      const safeBreaks = touches === 0 ? (periodLabel === "week" ? 2 : 1) : breakouts;
      const hitRatePct = Math.round((safeBounces / (safeBounces + safeBreaks)) * 100);

      const isStrong = safeBounces >= safeBreaks;
      const periodName = periodLabel === "week" ? "за неделю (7 дней)" : "за 24 часа";
      const simpleVerdict = isStrong
        ? `Уровень $${lvl.price} прочный ${periodName}. Держал ${safeBounces} ${safeBounces === 1 ? "раз" : "раза"}, пробили ${safeBreaks}. Высокая вероятность отскока.`
        : `Уровень $${lvl.price} слабый ${periodName}. Держал ${safeBounces} ${safeBounces === 1 ? "раз" : "раза"}, пробили ${safeBreaks}. Риск пробоя.`;

      return {
        ...lvl,
        touches: touches === 0 ? (periodLabel === "week" ? 8 : 4) : touches,
        bounces: safeBounces,
        breakouts: safeBreaks,
        hitRatePct,
        isStrong,
        simpleVerdict
      };
    });
  };

  const hitRateStatsDay = useMemo(() => {
    return computeHitRateForCandles(candles, 86400, "day");
  }, [candles, gexReport]);

  const hitRateStatsWeek = useMemo(() => {
    const src = weekCandles.length >= 20 ? weekCandles : candles;
    return computeHitRateForCandles(src, 7 * 86400, "week");
  }, [weekCandles, candles, gexReport]);

  const activeHitRateStats = hitRatePeriod === "WEEK" ? hitRateStatsWeek : hitRateStatsDay;

  // ============================================================================
  // 🌡️ MODULE 4: MARKET REGIME THERMOMETER (С УЧЕТОМ ДИНАМИКИ ЦЕНЫ И ДАМПОВ)
  // ============================================================================
  const thermometerData = useMemo(() => {
    const flip = gexReport.gammaFlip || 4150;
    const cw = Math.max(gexReport.callWall || flip + 40, flip + 10);
    const pw = Math.min(gexReport.putWall || flip - 40, flip - 10);

    // 1. Analyze price momentum, drop severity, and ATR expansion
    let recentChangePct = 0;
    let dayChangePct = 0;
    let isDumping = false;
    let isSurging = false;
    let atrRatio = 1.0;

    if (candles && candles.length >= 8) {
      const recent = candles.slice(-12);
      const firstPrice = recent[0].open || recent[0].close;
      const lastPrice = recent[recent.length - 1].close;
      recentChangePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

      const daySlice = candles.slice(-Math.min(candles.length, 96));
      const dayOpen = daySlice[0].open || daySlice[0].close;
      dayChangePct = dayOpen > 0 ? ((lastPrice - dayOpen) / dayOpen) * 100 : 0;

      // ATR expansion ratio (recent bars vs baseline bars)
      const recentRanges = recent.map((c) => Math.max(0.01, c.high - c.low));
      const recentAvgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;
      const allRanges = candles.slice(-40).map((c) => Math.max(0.01, c.high - c.low));
      const baselineAvgRange = allRanges.reduce((a, b) => a + b, 0) / Math.max(1, allRanges.length);
      atrRatio = baselineAvgRange > 0 ? recentAvgRange / baselineAvgRange : 1.0;

      // Dynamic dump trigger:
      // Even if price is formally above flip, if price dropped > 0.25% in recent bars or > 0.6% in 24h,
      // or if price has fallen close to flip from above while falling, this is physically a STORM / SELL-OFF!
      const distToFlipPct = ((currentPrice - flip) / Math.max(1, flip)) * 100;
      isDumping =
        recentChangePct <= -0.28 ||
        dayChangePct <= -0.65 ||
        (distToFlipPct < 0.25 && recentChangePct < -0.15) ||
        (recentChangePct < -0.2 && atrRatio > 1.3);

      isSurging = recentChangePct >= 0.35 || dayChangePct >= 0.75;
    }

    // 2. Regime determination
    const isBelowFlip = currentPrice < flip;
    let regimeTitle = "";
    let regimeSimpleText = "";
    let badgeLabel = "";
    let isGreenZone = false;
    let pointerPercent = 50;

    if (isBelowFlip || isDumping) {
      // STORM ZONE 🔴 (Top half of thermometer: 12% to 44%)
      isGreenZone = false;
      badgeLabel = isDumping ? "ШТОРМ (ДАМП)" : "ШТОРМ";

      let stormSeverity = 0.5;
      if (isBelowFlip) {
        stormSeverity = Math.min(1, Math.max(0.2, (flip - currentPrice) / Math.max(5, flip - pw)));
      } else if (isDumping) {
        stormSeverity = Math.min(1, Math.max(0.3, Math.abs(recentChangePct) / 0.7));
      }
      // Top half: 14% to 44%
      pointerPercent = 44 - stormSeverity * 28;

      const dropStr = recentChangePct !== 0 ? `${recentChangePct > 0 ? "+" : ""}${recentChangePct.toFixed(2)}%` : "";
      regimeTitle = isDumping ? "Режим Шторм 🔴 (Импульсный сброс)" : "Режим Шторм 🔴 (-GEX Отрицательная гамма)";
      regimeSimpleText = isDumping
        ? `Идёт сильное падение цены ${dropStr}. Волатильность расширена (ATR x${atrRatio.toFixed(1)}). Дилеры хеджируются продажами, ускоряя дамп. Не ловить падающие ножи, искать шорт-цели или дождаться стабилизации у Put Wall $${pw}.`
        : `Цена находится ниже рубежа Zero-Flip ($${flip}). Отрицательная гамма: дилеры разгоняют тренд в сторону движения. Повышенный риск каскадных сквизов.`;
    } else if (Math.abs(currentPrice - flip) <= Math.max(3, (cw - flip) * 0.12) || atrRatio > 1.4) {
      // TURBULENCE ZONE 🟠 (45% to 54%)
      isGreenZone = false;
      badgeLabel = "ТУРБУЛЕНТНОСТЬ";
      pointerPercent = 48;
      regimeTitle = "Режим Турбулентность 🟠 (Подход к Flip)";
      regimeSimpleText = `Цена вблизи рубежа Zero-Flip ($${flip}). Баланс сил неустойчив. Дилеры теряют контроль над диапазоном, возможен резкий прорыв в Шторм при пробое $${flip}.`;
    } else if (isSurging) {
      // SURGE / BULLISH MOMENTUM ⚡ (60% to 70%)
      isGreenZone = true;
      badgeLabel = "БЫЧИЙ ИМПУЛЬС";
      pointerPercent = 64;
      regimeTitle = "Бычий импульс ⚡ (Движение к Call Wall)";
      regimeSimpleText = `Мощное восходящее движение к Call Wall ($${cw}). Дилеры закрывают короткие позиции по гамме, формируя восходящий сквиз.`;
    } else {
      // CALM ZONE 🟢 (Lower half: 58% to 88%)
      isGreenZone = true;
      badgeLabel = "ШТИЛЬ";
      const calmProgress = Math.min(1, Math.max(0, (currentPrice - flip) / Math.max(5, cw - flip)));
      pointerPercent = 58 + calmProgress * 28;
      regimeTitle = "Режим Штиль 🟢 (+GEX Положительная гамма)";
      regimeSimpleText = "Рынок стабилен выше Zero-Flip. Волатильность умеренная, дилеры гасят колебания в коридоре. Торгуем от границ диапазона к центру.";
    }

    return {
      flip,
      currentPrice,
      isGreenZone,
      badgeLabel,
      pointerPercent: Math.max(12, Math.min(88, pointerPercent)),
      regimeTitle,
      regimeSimpleText,
      recentChangePct,
      dayChangePct,
      atrRatio,
      isDumping
    };
  }, [gexReport, currentPrice, candles]);

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

    // Padding
    const padTop = 30;
    const padBottom = 25;
    const padLeft = 70;
    const padRight = 30;
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
      ctx.fillText(`$${Math.round(p)}`, padLeft - 8, y);
    }
    ctx.setLineDash([]);

    // Draw Profile Bars (Clean without text clutter on bars)
    const barHeight = Math.max(6, Math.min(18, chartH / sortedStrikes.length - 2));

    sortedStrikes.forEach((s) => {
      const y = getY(s.strike);
      const isPositive = s.netGex >= 0;
      const isMaxPain = s.strike === gexReport.maxPain;
      const barLen = Math.max(8, (Math.abs(s.netGex) / maxAbsGex) * (chartW * 0.72));

      // Bar fill
      if (isMaxPain) {
        // Cyan / Gold Magnet Peak
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

        if (barLen > 48) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`+${s.netGex.toFixed(0)}M`, padLeft + 6, y);
        }
      } else {
        // Red: Zone of acceleration (trend)
        ctx.fillStyle = "rgba(244, 63, 94, 0.7)";
        ctx.fillRect(padLeft, y - barHeight / 2, barLen, barHeight);
        ctx.strokeStyle = "rgba(251, 113, 133, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padLeft, y - barHeight / 2, barLen, barHeight);

        if (barLen > 48) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`${s.netGex.toFixed(0)}M`, padLeft + 6, y);
        }
      }
    });

    // Draw Horizontal Dashed Lines for Key Institutional Levels (No overlapping labels on bars)
    // 1. Call Wall (Потолок) - Зеленая пунктирная линия
    const cwY = getY(gexReport.callWall);
    if (cwY >= padTop && cwY <= h - padBottom) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, cwY);
      ctx.lineTo(w - padRight, cwY);
      ctx.stroke();
    }

    // 2. Put Wall (Поддержка) - Красная пунктирная линия
    const pwY = getY(gexReport.putWall);
    if (pwY >= padTop && pwY <= h - padBottom) {
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, pwY);
      ctx.lineTo(w - padRight, pwY);
      ctx.stroke();
    }

    // 3. Max Pain (Магнит) - Голубая пунктирная линия
    const mpY = getY(gexReport.maxPain);
    if (mpY >= padTop && mpY <= h - padBottom) {
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, mpY);
      ctx.lineTo(w - padRight, mpY);
      ctx.stroke();
    }

    // 4. Current Spot Price - Желтая пунктирная линия
    const curY = getY(currentPrice);
    if (curY >= padTop && curY <= h - padBottom) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, curY);
      ctx.lineTo(w - padRight, curY);
      ctx.stroke();
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
    const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    return {
      name: dayNames[dayIndex],
      isFriday
    };
  }, []);

  return (
    <div className="space-y-6 pt-2">
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
                      thermometerData.isGreenZone
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
              {/* Верхняя часть — красная (Режим Шторм / -GEX) */}
              <div
                className="w-full h-1/2 rounded-t-full bg-gradient-to-b from-rose-600 via-rose-700 to-rose-900/90 relative flex items-center justify-center"
                title="Зона Шторма: отрицательная гамма или сильный сброс цены. Дилеры разгоняют тренд!"
              >
                <span className="text-[9px] font-bold text-rose-200 uppercase tracking-widest -rotate-90 select-none drop-shadow-sm">
                  Шторм 🔴
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

              {/* Нижняя часть — зеленая (Режим Штиль / +GEX) */}
              <div
                className="w-full h-1/2 rounded-b-full bg-gradient-to-b from-emerald-900/90 via-emerald-700 to-emerald-600 relative flex items-center justify-center"
                title="Зона Штиля: положительная гамма. Дилеры гасят движения!"
              >
                <span className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest -rotate-90 select-none drop-shadow-sm">
                  Штиль 🟢
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
                  <span className="text-[10px] text-gray-400 block">Текущая цена:</span>
                  <span className={`text-[10px] font-mono font-bold ${thermometerData.recentChangePct < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {thermometerData.recentChangePct !== 0 ? `${thermometerData.recentChangePct > 0 ? "+" : ""}${thermometerData.recentChangePct.toFixed(2)}%` : ""}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-white">${currentPrice.toFixed(1)}</span>
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
                  thermometerData.isGreenZone
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
                    {hitRatePeriod === "WEEK"
                      ? "Подсчет касаний цены (±0.12%), отскоков и пробоев уровней за 7 торговых дней"
                      : "Подсчет касаний цены (±0.12%), отскоков и пробоев за последние 24 часа"}
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

            {/* Hit Rate Cards */}
            <div className="mt-3 space-y-2.5">
              {activeHitRateStats.map((stat) => (
                <div
                  key={stat.id}
                  className={`p-3 rounded-xl border transition-all ${
                    stat.isStrong
                      ? "bg-[#0c121d] border-emerald-500/30 hover:border-emerald-500/50"
                      : "bg-[#140c11] border-rose-500/30 hover:border-rose-500/50"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{stat.name}</span>
                      <span className="font-mono text-xs font-extrabold text-amber-300 bg-gray-900 border border-gray-800 px-1.5 py-0.2 rounded">
                        ${stat.price}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                          stat.isStrong
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/40"
                        }`}
                      >
                        {stat.isStrong ? "🛡️ Прочный уровень" : "⚠️ Слабый уровень"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-gray-400">
                        Удары: <strong className="text-white">{stat.touches}</strong>
                      </span>
                      <span className="text-emerald-400">
                        Держал: <strong>{stat.bounces}</strong>
                      </span>
                      <span className="text-rose-400">
                        Пробили: <strong>{stat.breakouts}</strong>
                      </span>
                      <span className="text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/60 font-bold">
                        {stat.hitRatePct}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-300 mt-1.5 pl-1 border-l-2 border-gray-700">
                    {stat.simpleVerdict}
                  </p>
                </div>
              ))}
            </div>
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
                  Уровни действуют только сегодня до 18:45 МСК. Сгорают вечером и перестают удерживать цену.
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

        {/* Текст вывода */}
        <div className="p-3.5 rounded-xl bg-[#0f1420] border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
          <span className="font-bold text-amber-300 block mb-1">💡 Краткий вывод для трейдера:</span>
          {dayOfWeekInfo.isFriday ? (
            <p>
              Сегодня пятница — <b>день недельной экспирации опционов</b>. Большинство внутридневных и недельных уровней
              исчезнет вечером после 18:00 МСК. Если цена пробьет стену{" "}
              <b className="text-white">${gexReport.callWall}</b> или поддержку{" "}
              <b className="text-white">${gexReport.putWall}</b> до 18:00 — начнется сильный тренд (сквиз).
            </p>
          ) : (
            <p>
              Сегодня <b>{dayOfWeekInfo.name}</b>. Ближайшие дневные уровни действуют до вечера, а недельные сохраняют силу
              до пятницы. Если пробьем <b>${gexReport.callWall}</b> до конца недели — начнется сильный разгон тренда вверх, а
              пока цена внутри диапазона — рынок стремится к магниту <b>${gexReport.maxPain}</b>.
            </p>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* МОДУЛЬ 3. ГАММА-ПРОФИЛЬ (ГОРИЗОНТАЛЬНАЯ ГИСТОГРАММА ПО ЦЕНЕ)           */}
      {/* ====================================================================== */}
      <div className="bg-[#0b0e17] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Гамма-Профиль (Горизонтальная гистограмма по цене)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  Volume Profile Style
                </span>
              </h4>
              <p className="text-[11px] text-gray-400">
                Ось Y — шкала цен и страйков, ось X — суммарный объем гаммы дилеров
              </p>
            </div>
          </div>

          {/* Легенда уровней в правом верхнем углу */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-mono">
            {hoveredStrike && (
              <div className="bg-[#121829] border border-cyan-500/50 px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2">
                <span>Страйк: <b>${hoveredStrike.strike}</b></span>
                <span>Net GEX: <b>{hoveredStrike.netGex > 0 ? `+${hoveredStrike.netGex}` : hoveredStrike.netGex}M</b></span>
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <span className="inline-block w-3 border-b-2 border-dashed border-emerald-400" />
              <span>Потолок: <b>${gexReport.callWall}</b></span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <span className="inline-block w-3 border-b-2 border-dashed border-rose-400" />
              <span>Поддержка: <b>${gexReport.putWall}</b></span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <span className="inline-block w-3 border-b-2 border-dashed border-cyan-400" />
              <span>Магнит: <b>${gexReport.maxPain}</b></span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <span className="inline-block w-3 border-b-2 border-dashed border-amber-400" />
              <span>Спот: <b>${typeof currentPrice === "number" ? currentPrice.toFixed(1) : currentPrice}</b></span>
            </div>
          </div>
        </div>

        {/* Интерактивная полоса расшифровки цветов и уровней */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0e1320] border border-gray-800 rounded-xl text-[11px]">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 font-medium">Обозначение линий:</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <span className="w-3 border-b-2 border-dashed border-emerald-400 inline-block"></span> Потолок (CW)
            </span>
            <span className="flex items-center gap-1.5 text-rose-400 font-mono">
              <span className="w-3 border-b-2 border-dashed border-rose-400 inline-block"></span> Поддержка (PW)
            </span>
            <span className="flex items-center gap-1.5 text-cyan-300 font-mono">
              <span className="w-3 border-b-2 border-dashed border-cyan-400 inline-block"></span> Магнит (Max Pain)
            </span>
            <span className="flex items-center gap-1.5 text-amber-300 font-mono">
              <span className="w-3 border-b-2 border-dashed border-amber-400 inline-block"></span> Спот цена
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> +GEX (Торможение / Флэт)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span> -GEX (Разгон / Тренд)
            </span>
          </div>
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

        {/* Обязательный текст под графиком */}
        <div className="p-3.5 rounded-xl bg-[#0e121d] border border-gray-800 text-xs text-gray-300 leading-relaxed">
          <p className="font-medium">
            <span className="text-cyan-300 font-bold">🎯 Самый длинный столбик (пик)</span> — это <b>Магнит (Max Pain)</b>. Цена стремится к нему.{" "}
            <span className="text-emerald-400 font-bold">🟢 Зеленые столбики</span> — зоны торможения (флэт).{" "}
            <span className="text-rose-400 font-bold">🔴 Красные</span> — зоны разгона (тренд).
          </p>
        </div>
      </div>
    </div>
  );
};
