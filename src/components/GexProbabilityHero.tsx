import React, { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Shield,
  Target,
  AlertTriangle,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { GexMarketReport } from "../../server/gexEngine";
import {
  calculateGexProbabilityEngine,
  GexProbabilityEngineOutput
} from "../lib/pineSuperIndicatorEngine";

export interface GexProbabilityHeroProps {
  gexReport: GexMarketReport;
  candles?: Array<{ time: number; open: number; high: number; low: number; close: number }>;
  activeAsset: string;
}

export const GexProbabilityHero: React.FC<GexProbabilityHeroProps> = ({
  gexReport,
  candles = [],
  activeAsset
}) => {
  // Sum total Call and Put volume across all option strikes
  const volumeTotals = useMemo(() => {
    const strikes = gexReport.strikes || [];
    let totalCallVolume = 0;
    let totalPutVolume = 0;
    let totalCallOi = 0;
    let totalPutOi = 0;

    for (const s of strikes) {
      totalCallVolume += s.callVolume || 0;
      totalPutVolume += s.putVolume || 0;
      totalCallOi += s.callOi || 0;
      totalPutOi += s.putOi || 0;
    }

    // Normal baseline volume (~25% of total open interest or minimum 25,000)
    const normalTotalVolume = Math.max(15000, Math.round((totalCallOi + totalPutOi) * 0.22));

    return {
      totalCallVolume,
      totalPutVolume,
      normalTotalVolume
    };
  }, [gexReport.strikes]);

  // Execute the Quant Probability Engine
  const probResult: GexProbabilityEngineOutput = useMemo(() => {
    return calculateGexProbabilityEngine({
      spotPrice: gexReport.spotPrice,
      callWall: gexReport.callWall,
      putWall: gexReport.putWall,
      zeroFlip: gexReport.gammaFlip,
      totalCallVolume: volumeTotals.totalCallVolume,
      totalPutVolume: volumeTotals.totalPutVolume,
      iv: gexReport.impliedVolAvg || 18.5,
      rv: gexReport.realizedVol30d || 14.8,
      normalTotalVolume: volumeTotals.normalTotalVolume,
      maxPain: gexReport.maxPain
    });
  }, [gexReport, volumeTotals]);

  const currencyPrefix = activeAsset === "MOEX_MINI" ? "" : "$";
  const currencySuffix = activeAsset === "MOEX_MINI" ? " ₽" : "";
  const fmtPrice = (val: number) => `${currencyPrefix}${Math.round(val * 10) / 10}${currencySuffix}`;

  // Prepare SVG coordinates for the Visual Probability Cone & Trajectory Chart
  const chartGeometry = useMemo(() => {
    const w = 680;
    const h = 230;
    const padTop = 24;
    const padBottom = 26;
    const padLeft = 56;
    const padRight = 108;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const spot = gexReport.spotPrice;
    const cw = gexReport.callWall;
    const pw = gexReport.putWall;
    const flip = gexReport.gammaFlip;
    const mp = gexReport.maxPain;

    // Recent historical closes (last 12 bars) normalized around current spot
    const recentSlice = candles.slice(-12);
    const histPrices =
      recentSlice.length >= 3
        ? recentSlice.map((c) => c.close)
        : [
            spot - (cw - pw) * 0.12,
            spot - (cw - pw) * 0.08,
            spot - (cw - pw) * 0.03,
            spot + (cw - pw) * 0.02,
            spot - (cw - pw) * 0.01,
            spot
          ];
    // Ensure the last historical point matches live spot
    histPrices[histPrices.length - 1] = spot;

    const allPrices = [spot, cw, pw, flip, mp, ...histPrices];
    const rawMin = Math.min(...allPrices);
    const rawMax = Math.max(...allPrices);
    const padRange = Math.max(4, (rawMax - rawMin) * 0.18);
    const minP = rawMin - padRange;
    const maxP = rawMax + padRange;
    const spanP = Math.max(1, maxP - minP);

    const getY = (price: number) => padTop + ((maxP - price) / spanP) * plotH;

    // X split: 45% historical path, 55% future forecast cone
    const splitX = padLeft + plotW * 0.44;
    const endX = padLeft + plotW;
    const midForecastX = splitX + (endX - splitX) * 0.52;

    const histPoints = histPrices.map((p, idx) => {
      const x = padLeft + (idx / Math.max(1, histPrices.length - 1)) * (splitX - padLeft);
      const y = getY(p);
      return { x, y, p };
    });

    const histPathD = histPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(" ");

    const spotY = getY(spot);
    const cwY = getY(cw);
    const pwY = getY(pw);
    const flipY = getY(flip);
    const mpY = getY(mp);

    // If Sweep Risk is active (IV > RV), show the sweep overshoot curve before reversal
    const longTargetY = probResult.sweepRiskActive ? Math.max(padTop + 6, cwY - 12) : cwY;
    const shortTargetY = probResult.sweepRiskActive ? Math.min(h - padBottom - 6, pwY + 12) : pwY;

    const longCurveD = `M ${splitX.toFixed(1)} ${spotY.toFixed(1)} C ${(splitX + 50).toFixed(1)} ${spotY.toFixed(1)}, ${midForecastX.toFixed(1)} ${( (spotY + longTargetY) / 2 - 14 ).toFixed(1)}, ${endX.toFixed(1)} ${cwY.toFixed(1)}`;
    const flatCurveD = `M ${splitX.toFixed(1)} ${spotY.toFixed(1)} C ${(splitX + 55).toFixed(1)} ${spotY.toFixed(1)}, ${midForecastX.toFixed(1)} ${mpY.toFixed(1)}, ${endX.toFixed(1)} ${mpY.toFixed(1)}`;
    const shortCurveD = `M ${splitX.toFixed(1)} ${spotY.toFixed(1)} C ${(splitX + 50).toFixed(1)} ${spotY.toFixed(1)}, ${midForecastX.toFixed(1)} ${( (spotY + shortTargetY) / 2 + 14 ).toFixed(1)}, ${endX.toFixed(1)} ${pwY.toFixed(1)}`;

    // Shaded cone polygon between Call Wall trajectory and Put Wall trajectory
    const coneAreaD = `${longCurveD} L ${endX.toFixed(1)} ${pwY.toFixed(1)} C ${midForecastX.toFixed(1)} ${( (spotY + shortTargetY) / 2 + 14 ).toFixed(1)}, ${(splitX + 50).toFixed(1)} ${spotY.toFixed(1)}, ${splitX.toFixed(1)} ${spotY.toFixed(1)} Z`;

    return {
      w,
      h,
      padLeft,
      padRight,
      padTop,
      padBottom,
      splitX,
      endX,
      spotY,
      cwY,
      pwY,
      flipY,
      mpY,
      histPathD,
      longCurveD,
      flatCurveD,
      shortCurveD,
      coneAreaD
    };
  }, [gexReport, candles, probResult.sweepRiskActive]);

  const dominantBadge =
    probResult.dominantScenario === "LONG"
      ? {
          label: `🟢 ПРИОРИТЕТ LONG (${probResult.probabilityLong}%)`,
          cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        }
      : probResult.dominantScenario === "SHORT"
      ? {
          label: `🔴 ПРИОРИТЕТ SHORT (${probResult.probabilityShort}%)`,
          cls: "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }
      : {
          label: `🔵 ПРИОРИТЕТ БОКОВИК (${probResult.probabilityFlat}%)`,
          cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
        };

  return (
    <div className="bg-gradient-to-br from-[#0b101d] via-[#0b0e17] to-[#111526] border border-indigo-500/35 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-800/90 pb-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm sm:text-base text-white tracking-tight">
                GEX Probability Engine (Вероятностный прогноз движения цены)
              </h4>
              <span className={`text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded-lg border ${dominantBadge.cls}`}>
                {dominantBadge.label}
              </span>
              {probResult.sweepRiskActive && (
                <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span>Риск Sweep (IV &gt; RV): {probResult.sweepProbability}%</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Многофакторная балльная модель (Score System): Zero-Flip, дистанция до Call/Put Wall, поток Volume и спред волатильности IV vs RV
            </p>
          </div>
        </div>

        {/* Confidence Gauge Pill */}
        <div className="flex items-center gap-3 bg-[#090d16] border border-gray-800 px-3.5 py-2 rounded-xl self-start lg:self-auto shrink-0">
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block">
              Индекс уверенности (Confidence)
            </span>
            <span className="text-sm font-mono font-black text-cyan-300">
              {probResult.confidenceScore}% • Высокая точность
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center font-mono font-black text-xs text-cyan-300">
            {probResult.confidenceScore}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Visual Probability Cone Chart (7 cols) + Commentary & Score Breakdown (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT 7 COLS: Visual Trajectory & Probability Distribution */}
        <div className="lg:col-span-7 bg-[#080b12] border border-gray-800/90 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
          {/* 3 Probability Progress Bars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>LONG (Рост / Отскок): {probResult.probabilityLong}%</span>
              </span>
              <span className="text-cyan-300 font-bold flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                <span>FLAT (Коридор к Max Pain): {probResult.probabilityFlat}%</span>
              </span>
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                <span>SHORT (Снижение / Откат): {probResult.probabilityShort}%</span>
              </span>
            </div>

            {/* Unified Multi-Segment Probability Bar */}
            <div className="w-full h-3.5 rounded-full bg-gray-900 overflow-hidden flex border border-gray-800 p-0.5 gap-0.5">
              <div
                style={{ width: `${probResult.probabilityLong}%` }}
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-500"
                title={`Вероятность LONG: ${probResult.probabilityLong}%`}
              />
              <div
                style={{ width: `${probResult.probabilityFlat}%` }}
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                title={`Вероятность FLAT: ${probResult.probabilityFlat}%`}
              />
              <div
                style={{ width: `${probResult.probabilityShort}%` }}
                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-r-full transition-all duration-500"
                title={`Вероятность SHORT: ${probResult.probabilityShort}%`}
              />
            </div>
          </div>

          {/* SVG Visual Forecast Cone & Level Map */}
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-800/80 bg-[#060911]">
            <svg
              viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.h}`}
              className="w-full h-[215px] sm:h-[230px] block select-none"
            >
              <defs>
                <linearGradient id="gexProbConeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Vertical Divider: History vs Forecast */}
              <line
                x1={chartGeometry.splitX}
                y1={chartGeometry.padTop}
                x2={chartGeometry.splitX}
                y2={chartGeometry.h - chartGeometry.padBottom}
                stroke="#facc15"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <text
                x={chartGeometry.splitX - 6}
                y={15}
                fill="#94a3b8"
                fontSize="9.5"
                fontFamily="monospace"
                textAnchor="end"
              >
                История цены
              </text>
              <text
                x={chartGeometry.splitX + 6}
                y={15}
                fill="#facc15"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="start"
              >
                Конус вероятностей GEX →
              </text>

              {/* Horizontal Level Lines: Call Wall, Max Pain, Zero-Flip, Put Wall */}
              {/* Call Wall */}
              <line
                x1={chartGeometry.padLeft}
                y1={chartGeometry.cwY}
                x2={chartGeometry.endX}
                y2={chartGeometry.cwY}
                stroke="#10b981"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />
              <text
                x={chartGeometry.padLeft - 5}
                y={chartGeometry.cwY + 3}
                fill="#10b981"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="end"
              >
                {fmtPrice(gexReport.callWall)}
              </text>

              {/* Zero-Flip */}
              <line
                x1={chartGeometry.padLeft}
                y1={chartGeometry.flipY}
                x2={chartGeometry.endX}
                y2={chartGeometry.flipY}
                stroke="#a855f7"
                strokeWidth="1.1"
                strokeDasharray="3 3"
              />
              <text
                x={chartGeometry.padLeft - 5}
                y={chartGeometry.flipY + 3}
                fill="#c084fc"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="end"
              >
                Flip {fmtPrice(gexReport.gammaFlip)}
              </text>

              {/* Put Wall */}
              <line
                x1={chartGeometry.padLeft}
                y1={chartGeometry.pwY}
                x2={chartGeometry.endX}
                y2={chartGeometry.pwY}
                stroke="#f43f5e"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />
              <text
                x={chartGeometry.padLeft - 5}
                y={chartGeometry.pwY + 3}
                fill="#f43f5e"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="end"
              >
                {fmtPrice(gexReport.putWall)}
              </text>

              {/* Shaded Probability Cone */}
              <path d={chartGeometry.coneAreaD} fill="url(#gexProbConeGrad)" />

              {/* Historical Price Line */}
              <path
                d={chartGeometry.histPathD}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="2.2"
              />

              {/* 1. LONG Trajectory Curve */}
              <path
                d={chartGeometry.longCurveD}
                fill="none"
                stroke="#10b981"
                strokeWidth={probResult.dominantScenario === "LONG" ? "3.2" : "1.8"}
                strokeDasharray={probResult.dominantScenario === "LONG" ? "none" : "4 3"}
              />
              <rect
                x={chartGeometry.endX + 4}
                y={chartGeometry.cwY - 9}
                width={98}
                height={18}
                rx={4}
                fill="#064e3b"
                stroke="#10b981"
                strokeWidth="1"
              />
              <text
                x={chartGeometry.endX + 9}
                y={chartGeometry.cwY + 3}
                fill="#ecfdf5"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                LONG {probResult.probabilityLong}% • CW
              </text>

              {/* 2. FLAT / Max Pain Trajectory Curve */}
              <path
                d={chartGeometry.flatCurveD}
                fill="none"
                stroke="#06b6d4"
                strokeWidth={probResult.dominantScenario === "FLAT" ? "3" : "1.7"}
                strokeDasharray="4 3"
              />
              <rect
                x={chartGeometry.endX + 4}
                y={chartGeometry.mpY - 9}
                width={98}
                height={18}
                rx={4}
                fill="#083344"
                stroke="#06b6d4"
                strokeWidth="1"
              />
              <text
                x={chartGeometry.endX + 9}
                y={chartGeometry.mpY + 3}
                fill="#cffafe"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                FLAT {probResult.probabilityFlat}% • MP
              </text>

              {/* 3. SHORT Trajectory Curve */}
              <path
                d={chartGeometry.shortCurveD}
                fill="none"
                stroke="#f43f5e"
                strokeWidth={probResult.dominantScenario === "SHORT" ? "3.2" : "1.8"}
                strokeDasharray={probResult.dominantScenario === "SHORT" ? "none" : "4 3"}
              />
              <rect
                x={chartGeometry.endX + 4}
                y={chartGeometry.pwY - 9}
                width={98}
                height={18}
                rx={4}
                fill="#4c0519"
                stroke="#f43f5e"
                strokeWidth="1"
              />
              <text
                x={chartGeometry.endX + 9}
                y={chartGeometry.pwY + 3}
                fill="#ffe4e6"
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SHORT {probResult.probabilityShort}% • PW
              </text>

              {/* Current Spot Anchor Node */}
              <circle
                cx={chartGeometry.splitX}
                cy={chartGeometry.spotY}
                r="5"
                fill="#facc15"
                stroke="#090d16"
                strokeWidth="1.5"
              />
              <rect
                x={chartGeometry.splitX - 38}
                y={Math.max(20, chartGeometry.spotY - 22)}
                width={76}
                height={15}
                rx={4}
                fill="#422006"
                stroke="#facc15"
                strokeWidth="1"
              />
              <text
                x={chartGeometry.splitX}
                y={Math.max(30, chartGeometry.spotY - 12)}
                fill="#fef08a"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                Spot {fmtPrice(gexReport.spotPrice)}
              </text>
            </svg>
          </div>

          {/* Quick Distance & Volatility Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0d121f] border border-gray-800/80 flex items-center justify-between">
              <span className="text-gray-400">До Call Wall:</span>
              <b className="text-emerald-300">
                +{fmtPrice(Math.abs(probResult.distToCallWallPts))} ({probResult.distToCallWallPct}%)
              </b>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0d121f] border border-gray-800/80 flex items-center justify-between">
              <span className="text-gray-400">До Put Wall:</span>
              <b className="text-rose-300">
                -{fmtPrice(Math.abs(probResult.distToPutWallPts))} ({probResult.distToPutWallPct}%)
              </b>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0d121f] border border-gray-800/80 flex items-center justify-between">
              <span className="text-gray-400">Объем (C/P):</span>
              <b className="text-cyan-300">
                {(volumeTotals.totalCallVolume / 1000).toFixed(1)}k / {(volumeTotals.totalPutVolume / 1000).toFixed(1)}k
              </b>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0d121f] border border-gray-800/80 flex items-center justify-between">
              <span className="text-gray-400">Спред IV-RV:</span>
              <b className={probResult.sweepRiskActive ? "text-amber-300" : "text-gray-200"}>
                {(gexReport.impliedVolAvg - gexReport.realizedVol30d) >= 0 ? "+" : ""}
                {(gexReport.impliedVolAvg - gexReport.realizedVol30d).toFixed(1)}%
              </b>
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLS: Clear Trader Commentary & Score System Breakdown */}
        <div className="lg:col-span-5 bg-[#080b12] border border-gray-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>Аналитический вердикт и комментарий</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                Баллы: L:{probResult.rawScores.long} / F:{probResult.rawScores.flat} / S:{probResult.rawScores.short}
              </span>
            </div>

            {/* Main Readable Verdict Box */}
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                probResult.dominantScenario === "LONG"
                  ? "bg-emerald-950/25 border-emerald-500/35 text-emerald-100"
                  : probResult.dominantScenario === "SHORT"
                  ? "bg-rose-950/25 border-rose-500/35 text-rose-100"
                  : "bg-cyan-950/25 border-cyan-500/35 text-cyan-100"
              }`}
            >
              {probResult.recommendation}
            </div>

            {/* Factor-by-Factor Score Breakdown */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-gray-400 block">
                Факторы начисления баллов (База = 50 баллов):
              </span>
              <div className="space-y-1.5 max-h-[165px] overflow-y-auto pr-1">
                {probResult.factors.map((f, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-[#0d121f] border border-gray-800/80 text-[11px] flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                        <span>{f.label}</span>
                      </div>
                      <p className="text-[10.5px] text-gray-400 pl-4">{f.impactText}</p>
                    </div>
                    <span
                      className={`shrink-0 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                        f.bias === "LONG"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : f.bias === "SHORT"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : f.bias === "SWEEP"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}
                    >
                      +{f.points} б. {f.bias}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actionable Footer Bar */}
          <div className="px-3 py-2 rounded-xl bg-[#0e1424] border border-indigo-500/30 text-[11px] text-indigo-200 flex items-center justify-between gap-2">
            <span>
              <b>⚡ Оптимальная тактика:</b>{" "}
              {probResult.dominantScenario === "LONG"
                ? `Работа от покупок с целью ${fmtPrice(gexReport.maxPain)} → ${fmtPrice(gexReport.callWall)}`
                : probResult.dominantScenario === "SHORT"
                ? `Ожидание снижения/отката к ${fmtPrice(gexReport.maxPain)} → ${fmtPrice(gexReport.putWall)}`
                : `Торговля внутри границ ${fmtPrice(gexReport.putWall)}–${fmtPrice(gexReport.callWall)} к магниту ${fmtPrice(gexReport.maxPain)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
