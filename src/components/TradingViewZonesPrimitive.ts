import {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  PrimitivePaneViewZOrder,
  Time,
  SeriesType,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";

export interface ZoneBox {
  id: string;
  type: "ob_bull" | "ob_bear" | "fvg_bull" | "fvg_bear" | "ote" | "sr";
  startTime: number;
  endTime: number;
  startLogical?: number;
  endLogical?: number;
  topPrice: number;
  bottomPrice: number;
  label: string;
  fillColor: string;
  borderColor: string;
  borderStyle?: "solid" | "dashed" | "dotted";
}

export interface ForecastArrow {
  startTime: number;
  startPrice: number;
  startLogical?: number;
  pullbackTime?: number;
  pullbackPrice?: number;
  pullbackLogical?: number;
  tp1Time: number;
  tp1Price: number;
  tp1Logical?: number;
  tp2Time: number;
  tp2Price: number;
  tp2Logical?: number;
  isBull: boolean;
  labelStart?: string;
  labelPullback?: string;
  labelTp1?: string;
  labelTp2?: string;
  slPrice?: number;
  labelSl?: string;
  leg1Hit?: boolean;
  leg2Hit?: boolean;
  leg3Hit?: boolean;
}

export interface BosMarker {
  time: number;
  price: number;
  logical?: number;
  isBull: boolean;
  label: string;
}

export interface BoundedPriceLine {
  id: string;
  price: number;
  startTime: number;
  endTime: number;
  startLogical?: number;
  endLogical?: number;
  color: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  label?: string;
  labelBg?: string;
  labelTextColor?: string;
  labelBorderColor?: string;
}

export interface GexProfileBarItem {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  topPrice: number;
  bottomPrice: number;
  startLogical: number;
  endLogical: number;
  startTime: number;
  endTime: number;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  isKey: boolean;
  label?: string;
}

export interface GexProfileData {
  bxBaseLogical: number;
  bars: GexProfileBarItem[];
}

export interface CurrentPriceCountdown {
  price: number;
  text: string;
  isBull: boolean;
}

export interface FloatingPriceAxisTag {
  id: "spot" | "EMA9" | "EMA21" | "EMA200" | string;
  price: number;
  label?: string;
}

export interface AntiCollisionObstacle {
  id?: string;
  x: number;
  y: number;
  isPriceAxisTag?: boolean;
}

export interface AntiCollisionBadgeItem {
  id: string;
  label: string;
  x: number;
  y: number;
  anchorY: number;
  width?: number;
  lineRight: number;
  lineColor: string;
  bg: string;
  border: string;
  textColor: string;
  showBorder: boolean;
}

export interface TradingViewPrimitiveData {
  zones: ZoneBox[];
  forecast: ForecastArrow | null;
  altForecast?: ForecastArrow | null;
  bos: BosMarker | null;
  eqLine?: { startTime: number; endTime: number; startLogical?: number; endLogical?: number; price: number; label: string } | null;
  lines?: BoundedPriceLine[];
  gexProfile?: GexProfileData | null;
  currentPriceCountdown?: CurrentPriceCountdown | null;
  floatingPriceAxisTags?: FloatingPriceAxisTag[];
  chartFontSize?: number;
  showBadgeBorders?: boolean;
}

const getDpr = (): number =>
  typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;

// Align to nearest physical device pixel (prevents 1-CSS-pixel quantization jumps on Retina/mobile screens)
const snapPx = (v: number): number => {
  const dpr = getDpr();
  return Math.round(v * dpr) / dpr;
};

// Align to physical device pixel center for crisp horizontal/vertical strokes without sub-pixel shimmering
const snapHalf = (v: number): number => {
  const dpr = getDpr();
  return (Math.floor(v * dpr) + 0.5) / dpr;
};

/**
 * Helper to draw a sleek, rounded, razor-sharp badge for chart labels.
 * On mobile devices, borders are stripped for maximum compactness and clean aesthetics.
 */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string,
  borderColor: string,
  textColor: string,
  mediaW: number,
  align: "left" | "right" | "center" = "left",
  fontSize: number = 10,
  opts?: { customFontSize?: number; showBorder?: boolean }
) {
  ctx.save();
  try {
    const isMobile = mediaW < 640;
    
    // Dynamic configurable chart font size with mobile ultra-compact default
    let baseFontSize = opts?.customFontSize || fontSize;
    try {
      const saved = typeof window !== "undefined" ? Number(localStorage.getItem("quantex_chart_font_size")) : 0;
      if (saved && saved >= 6 && saved <= 16) {
        baseFontSize = saved;
      }
    } catch {}

    const effectiveFontSize = isMobile ? Math.min(baseFontSize, 8) : baseFontSize;
    ctx.font = `600 ${effectiveFontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, -apple-system, BlinkMacSystemFont, sans-serif`;
    const metrics = ctx.measureText(text);
    const textW = Math.ceil(metrics.width);
    const padX = isMobile ? 3 : 5;
    const padY = isMobile ? 1.5 : 2.5;
    const badgeW = Math.round(textW + padX * 2);
    const badgeH = Math.round(effectiveFontSize + padY * 2);

    let startX = x;
    if (align === "center") {
      startX = x - badgeW / 2;
    } else if (align === "right") {
      startX = x - badgeW;
    }

    // Clamp within viewport
    if (startX + badgeW > mediaW - 3) {
      startX = mediaW - badgeW - 3;
    }
    if (startX < 3) {
      startX = 3;
    }

    const rx = snapHalf(startX);
    const ry = snapHalf(y - badgeH / 2);

    // Crisp rounded rectangle background (clean dark solid pill so lines and candles underneath NEVER bleed through)
    ctx.setLineDash([]);
    ctx.fillStyle = bgColor ? bgColor : "rgba(8, 12, 21, 0.96)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(rx, ry, badgeW, badgeH, 2.5);
    } else {
      ctx.rect(rx, ry, badgeW, badgeH);
    }
    ctx.fill();

    // Border: On mobile version, omit borders from badges (Take Profit, Stop Loss, Entry, Flip, etc.)
    // so labels render as clean, borderless solid pills as requested. Allow only if explicitly enabled in user settings.
    let allowBorders = false;
    try {
      allowBorders = typeof window !== "undefined" && localStorage.getItem("quantex_chart_badge_borders") === "true";
    } catch {}

    const canDrawBorder = !isMobile ? (opts?.showBorder !== undefined ? opts.showBorder : true) : allowBorders;
    if (canDrawBorder) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isMobile ? 0.8 : 1;
      ctx.stroke();
    }

    // Sharp text aligned to device pixel grid
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, snapPx(rx + padX), snapPx(ry + badgeH / 2 + 0.5));
  } finally {
    ctx.restore();
  }
}

/**
 * Deterministic vertical anti-collision solver for chart badges.
 * Explicitly accounts for floating price-axis tags (spot, EMA9, EMA21, EMA200) and canvas obstacles
 * so badges (especially Flip on WEEK horizon on mobile widths) never overlap price-axis tags or each other.
 */
export function solveBadgeAntiCollision<
  T extends {
    id: string;
    label: string;
    x: number;
    y: number;
    anchorY: number;
    width?: number;
  }
>(
  badges: T[],
  fixedObstacles: AntiCollisionObstacle[],
  mediaW: number,
  mediaH: number,
  minVertGap?: number
): T[] {
  if (!badges || badges.length === 0) return badges;
  const isMobile = mediaW < 640;
  const gap = minVertGap ?? (isMobile ? 18 : 21);

  // Clamp badge X coordinates to actual on-screen position before collision testing
  for (const b of badges) {
    const estW =
      b.width ??
      Math.min(mediaW - 8, Math.max(96, b.label.length * (isMobile ? 6.2 : 7.0) + 18));
    b.width = estW;
    b.x = snapPx(Math.max(3, Math.min(b.x, mediaW - estW - 3)));
  }

  const overlapsHorizontallyWithObstacle = (b: T, obs: AntiCollisionObstacle): boolean => {
    const bw = b.width ?? 140;
    if (obs.isPriceAxisTag) {
      // On mobile width (< 640px), right-anchored GEX / chart badges extend into the right zone
      // where floating price-axis tags (spot, EMA9, EMA21, EMA200) sit.
      return isMobile ? b.x + bw >= mediaW * 0.35 : b.x + bw >= mediaW - 140;
    }
    return Math.abs(b.x - obs.x) < 195;
  };

  const overlapsHorizontallyWithBadge = (a: T, b: T): boolean => {
    return Math.abs(a.x - b.x) < 195;
  };

  // Sort badges top-to-bottom by anchorY (with stable tie-breaker keeping Flip/Pain/Walls prioritized)
  badges.sort((a, b) => a.anchorY - b.anchorY || a.id.localeCompare(b.id));

  const placed: T[] = [];

  const isPositionValid = (badge: T, candY: number): boolean => {
    if (candY < 14 || candY > mediaH - 14) return false;
    for (const obs of fixedObstacles) {
      if (overlapsHorizontallyWithObstacle(badge, obs) && Math.abs(candY - obs.y) < gap - 0.25) {
        return false;
      }
    }
    for (const other of placed) {
      if (overlapsHorizontallyWithBadge(badge, other) && Math.abs(candY - other.y) < gap - 0.25) {
        return false;
      }
    }
    return true;
  };

  for (const b of badges) {
    const initialY = Math.max(14, Math.min(mediaH - 14, b.anchorY));
    if (isPositionValid(b, initialY)) {
      b.y = snapPx(initialY);
      placed.push(b);
      continue;
    }

    // Generate candidate vertical slots around obstacles, placed badges, and fine offsets from anchorY
    const candidates: number[] = [];
    for (const obs of fixedObstacles) {
      if (overlapsHorizontallyWithObstacle(b, obs)) {
        candidates.push(obs.y - gap, obs.y + gap);
      }
    }
    for (const other of placed) {
      if (overlapsHorizontallyWithBadge(b, other)) {
        candidates.push(other.y - gap, other.y + gap);
      }
    }
    const maxSteps = Math.ceil(mediaH / 2);
    for (let step = 1; step <= maxSteps; step++) {
      const delta = step * 2;
      if (initialY - delta >= 14) candidates.push(initialY - delta);
      if (initialY + delta <= mediaH - 14) candidates.push(initialY + delta);
    }

    let bestY = initialY;
    let bestDist = Infinity;

    for (const cand of candidates) {
      const clampedCand = Math.max(14, Math.min(mediaH - 14, cand));
      if (isPositionValid(b, clampedCand)) {
        const dist = Math.abs(clampedCand - b.anchorY);
        if (dist < bestDist) {
          bestDist = dist;
          bestY = clampedCand;
        }
      }
    }

    b.y = snapPx(bestY);
    placed.push(b);
  }

  return badges;
}

/**
 * 1. Background Renderer: Renders OB, FVG, OTE zones & 0.50 EQ line BEHIND candles (zOrder: "bottom")
 */
class TradingViewBackgroundZonesRenderer implements IPrimitivePaneRenderer {
  private _primitive: TradingViewZonesPrimitive;

  constructor(primitive: TradingViewZonesPrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    target.useMediaCoordinateSpace((scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => {
      const ctx = scope.context;
      const chart = this._primitive.chart;
      const series = this._primitive.series;
      if (!chart || !series) return;

      const data = this._primitive.data;
      if (!data) return;

      ctx.save();
      try {
        const timeScale = chart.timeScale();
        const mediaW = scope.mediaSize.width;
        const mediaH = scope.mediaSize.height;

        // Determine typical bar spacing in pixels to accurately bound future logical coordinates
        let barSpacing = 9;
        try {
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange && visibleRange.to > visibleRange.from) {
            barSpacing = Math.max(3, mediaW / (visibleRange.to - visibleRange.from));
          }
        } catch {}

        // 1. Draw Zones (OB, FVG, OTE)
        if (data.zones && data.zones.length > 0) {
          for (const zone of data.zones) {
            let x1: number | null = null;
            let x2: number | null = null;

            if (typeof zone.startLogical === "number") {
              const c1 = timeScale.logicalToCoordinate(zone.startLogical as any);
              if (c1 !== null) x1 = c1 as number;
            }
            if (x1 === null) {
              const rawX1 = timeScale.timeToCoordinate(zone.startTime as any);
              if (rawX1 !== null) x1 = rawX1 as number;
            }

            if (typeof zone.endLogical === "number") {
              const c2 = timeScale.logicalToCoordinate(zone.endLogical as any);
              if (c2 !== null) x2 = c2 as number;
            }
            if (x2 === null) {
              const rawX2 = timeScale.timeToCoordinate(zone.endTime as any);
              if (rawX2 !== null) x2 = rawX2 as number;
            }

            // Exact bar bounded fallback: NEVER allow zone to extend infinitely across viewport
            if (x1 !== null && x2 === null) {
              if (typeof zone.startLogical === "number" && typeof zone.endLogical === "number") {
                const deltaBars = Math.max(1, zone.endLogical - zone.startLogical);
                x2 = x1 + deltaBars * barSpacing;
              } else {
                x2 = x1 + 40;
              }
            }

            if (x1 === null || x2 === null) continue;

            const rawYTop = series.priceToCoordinate(zone.topPrice);
            const rawYBot = series.priceToCoordinate(zone.bottomPrice);
            if (rawYTop === null || rawYBot === null) continue;

            const yTop = rawYTop as number;
            const yBot = rawYBot as number;

            const left = snapHalf(Math.min(x1, x2));
            const width = snapPx(Math.max(Math.abs(x2 - x1), 10));
            const top = snapHalf(Math.min(yTop, yBot));
            const height = snapPx(Math.max(Math.abs(yBot - yTop), 2));

            if (left + width < 0 || left > mediaW) continue;
            if (top + height < 0 || top > mediaH) continue;

            // Semi-transparent fill
            ctx.fillStyle = zone.fillColor;
            ctx.fillRect(left, top, width, height);

            // Thin and crisp borders on mobile for OB, FVG, OTE, LIQ, and S&R zones
            const isMobile = mediaW < 640;
            ctx.strokeStyle = zone.borderColor;
            ctx.lineWidth = isMobile ? 0.7 : 1.0;
            if (zone.borderStyle === "dashed") {
              ctx.setLineDash(isMobile ? [4, 3] : [6, 4]);
            } else if (zone.borderStyle === "dotted") {
              ctx.setLineDash(isMobile ? [2, 2] : [4, 3]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.strokeRect(left, top, width, height);
            ctx.setLineDash([]);

            // Compact TradingView label inside or at the end of the zone box
            if (zone.label && width >= 20) {
              if (zone.type === "sr") {
                drawBadge(
                  ctx,
                  zone.label,
                  left + width + 4,
                  top + height / 2,
                  "rgba(8, 12, 21, 0.94)",
                  zone.borderColor,
                  zone.borderColor,
                  mediaW,
                  "left",
                  9
                );
              } else if (height >= 4) {
                ctx.fillStyle = zone.borderColor;
                ctx.font = `600 9px "JetBrains Mono", ui-monospace, -apple-system, BlinkMacSystemFont, sans-serif`;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(zone.label, snapPx(left + 4), snapPx(top + 2));
              }
            }
          }
        }

        // 2. Draw 0.50 EQ Equilibrium Line
        if (data.eqLine) {
          let x1: number | null = null;
          let x2: number | null = null;

          if (typeof data.eqLine.startLogical === "number") {
            const c1 = timeScale.logicalToCoordinate(data.eqLine.startLogical as any);
            if (c1 !== null) x1 = c1 as number;
          }
          if (x1 === null) {
            const rawX1 = timeScale.timeToCoordinate(data.eqLine.startTime as any);
            if (rawX1 !== null) x1 = rawX1 as number;
          }

          if (typeof data.eqLine.endLogical === "number") {
            const c2 = timeScale.logicalToCoordinate(data.eqLine.endLogical as any);
            if (c2 !== null) x2 = c2 as number;
          }
          if (x2 === null) {
            const rawX2 = timeScale.timeToCoordinate(data.eqLine.endTime as any);
            if (rawX2 !== null) x2 = rawX2 as number;
          }

          if (x1 !== null && x2 === null) {
            if (typeof data.eqLine.startLogical === "number" && typeof data.eqLine.endLogical === "number") {
              const deltaBars = Math.max(1, data.eqLine.endLogical - data.eqLine.startLogical);
              x2 = x1 + deltaBars * barSpacing;
            } else {
              x2 = x1 + 120;
            }
          }

          const rawY = series.priceToCoordinate(data.eqLine.price);

          if (x1 !== null && x2 !== null && rawY !== null) {
            const y = snapHalf(rawY as number);
            const lineLeft = snapPx(Math.min(x1, x2));
            const lineRight = snapPx(Math.max(x1, x2));

            ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(lineLeft, y);
            ctx.lineTo(lineRight, y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Right End Badge
            drawBadge(
              ctx,
              data.eqLine.label || "0.50 EQ",
              lineRight + 4,
              y,
              "rgba(8, 12, 21, 0.94)",
              "rgba(250, 204, 21, 0.75)",
              "#fde047",
              mediaW,
              "left",
              9
            );
          }
        }
      } finally {
        ctx.restore();
      }
    });
  }
}

/**
 * 2. Foreground Renderer: Renders Zigzag Forecast, Plan B & Target Tags ON TOP of candles (zOrder: "top")
 */
class TradingViewForegroundForecastRenderer implements IPrimitivePaneRenderer {
  private _primitive: TradingViewZonesPrimitive;

  constructor(primitive: TradingViewZonesPrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    target.useMediaCoordinateSpace((scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => {
      const ctx = scope.context;
      const chart = this._primitive.chart;
      const series = this._primitive.series;
      if (!chart || !series) return;

      const data = this._primitive.data;
      if (!data) return;

      ctx.save();
      try {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const timeScale = chart.timeScale();
        const mediaW = scope.mediaSize.width;
        const isMobile = mediaW < 480;

        // Determine typical bar spacing in pixels
        let barSpacing = 9;
        try {
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange && visibleRange.to > visibleRange.from) {
            barSpacing = Math.max(3, mediaW / (visibleRange.to - visibleRange.from));
          }
        } catch {}

        // 1. Draw BOS (Break of Structure)
        if (data.bos) {
          let x: number | null = null;
          if (typeof data.bos.logical === "number") {
            const c = timeScale.logicalToCoordinate(data.bos.logical as any);
            if (c !== null) x = c as number;
          }
          if (x === null) {
            const rawX = timeScale.timeToCoordinate(data.bos.time as any);
            if (rawX !== null) x = rawX as number;
          }
          const rawY = series.priceToCoordinate(data.bos.price);

          if (x !== null && rawY !== null) {
            const y = snapHalf(rawY as number);
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(snapPx(x - 18), y);
            ctx.lineTo(snapPx(x + 18), y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = "#facc15";
            ctx.font = `600 8.5px "JetBrains Mono", monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(data.bos.label, snapPx(x), snapPx(y - 2));
          }
        }

        // Check whether bounded price lines already render ВХОД / TP1 / TP2 / SL badges so we never draw duplicate labels
        const hasBoundedForecastLines = Boolean(
          data.lines && data.lines.some((l) => l.id === "tp1_line" || l.id === "sl_line" || l.id === "entry_line")
        );

        // 2. Draw TradingView-Style Forecast Zigzag Arrow (x0,y0 -> x1,y1 -> x2,y2 -> x3,y3)
        if (data.forecast) {
          const fc = data.forecast;
          let xStart: number | null = null;
          let xPullback: number | null = null;
          let xTp1: number | null = null;
          let xTp2: number | null = null;

          if (typeof fc.startLogical === "number") {
            const c = timeScale.logicalToCoordinate(fc.startLogical as any);
            if (c !== null) xStart = c as number;
          }
          if (xStart === null) {
            const raw = timeScale.timeToCoordinate(fc.startTime as any);
            if (raw !== null) xStart = raw as number;
          }

          if (typeof fc.pullbackLogical === "number") {
            const c = timeScale.logicalToCoordinate(fc.pullbackLogical as any);
            if (c !== null) xPullback = c as number;
          }
          if (xPullback === null && xStart !== null) {
            const delta = (fc.pullbackLogical ?? 3) - (fc.startLogical ?? 0);
            xPullback = xStart + Math.max(1, delta) * barSpacing;
          }

          if (typeof fc.tp1Logical === "number") {
            const c = timeScale.logicalToCoordinate(fc.tp1Logical as any);
            if (c !== null) xTp1 = c as number;
          }
          if (xTp1 === null && xStart !== null) {
            const delta = (fc.tp1Logical ?? 7) - (fc.startLogical ?? 0);
            xTp1 = xStart + Math.max(2, delta) * barSpacing;
          }

          if (typeof fc.tp2Logical === "number") {
            const c = timeScale.logicalToCoordinate(fc.tp2Logical as any);
            if (c !== null) xTp2 = c as number;
          }
          if (xTp2 === null && xStart !== null) {
            const delta = (fc.tp2Logical ?? 12) - (fc.startLogical ?? 0);
            xTp2 = xStart + Math.max(3, delta) * barSpacing;
          }

          const rawYStart = series.priceToCoordinate(fc.startPrice);
          const rawYTp1 = series.priceToCoordinate(fc.tp1Price);
          const rawYTp2 = series.priceToCoordinate(fc.tp2Price);

          if (xStart !== null && rawYStart !== null && rawYTp1 !== null && rawYTp2 !== null && xPullback !== null && xTp1 !== null && xTp2 !== null) {
            const yStart = rawYStart as number;
            const yTp1 = rawYTp1 as number;
            const yTp2 = rawYTp2 as number;

            let yPullback = yStart;
            if (typeof fc.pullbackPrice === "number") {
              const rawYP = series.priceToCoordinate(fc.pullbackPrice);
              if (rawYP !== null) yPullback = rawYP as number;
            } else {
              yPullback = fc.isBull ? yStart + 12 : yStart - 12;
            }

            const trajWidth = isMobile ? 1.35 : 1.5;

            // Node 0: Start bar circle & direction label
            ctx.fillStyle = fc.isBull ? "#089981" : "#f23645";
            ctx.beginPath();
            ctx.arc(xStart, yStart, isMobile ? 2.5 : 3, 0, Math.PI * 2);
            ctx.fill();

            if (fc.labelStart) {
              ctx.fillStyle = fc.isBull ? "#089981" : "#f23645";
              ctx.font = `600 ${isMobile ? 8.5 : 9}px "Manrope", sans-serif`;
              ctx.textAlign = "right";
              ctx.textBaseline = "middle";
              ctx.fillText(fc.labelStart, snapPx(xStart - 5), snapPx(yStart));
            }

            // Leg 1: (x0, y0) -> (x1, y1) Pullback / Entry line (line_fc_0)
            ctx.strokeStyle = fc.leg1Hit ? "#10b981" : "#f59e0b";
            ctx.lineWidth = trajWidth;
            if (!fc.leg1Hit) {
              ctx.setLineDash([5, 3.5]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xPullback, yPullback);
            ctx.stroke();
            ctx.setLineDash([]);

            // Node 1: Entry / Pullback node circle
            ctx.fillStyle = fc.leg1Hit ? "#10b981" : "#f59e0b";
            ctx.beginPath();
            ctx.arc(xPullback, yPullback, isMobile ? 2.5 : 3, 0, Math.PI * 2);
            ctx.fill();

            if (!hasBoundedForecastLines && fc.labelPullback) {
              drawBadge(
                ctx,
                fc.leg1Hit ? `${fc.labelPullback} ✓` : fc.labelPullback,
                xPullback + 6,
                yPullback + (fc.isBull ? 8 : -8),
                "rgba(8, 12, 21, 0.94)",
                fc.leg1Hit ? "#10b981" : "#f59e0b",
                fc.leg1Hit ? "#34d399" : "#fbbf24",
                mediaW,
                "left",
                9
              );
            }

            // Leg 2: (x1, y1) -> (x2, y2) Impulse line to TP1 (line_fc_1)
            ctx.strokeStyle = fc.leg2Hit ? (fc.isBull ? "#059669" : "#dc2626") : (fc.isBull ? "#089981" : "#f23645");
            ctx.lineWidth = trajWidth;
            if (!fc.leg1Hit && !fc.leg2Hit) {
              ctx.setLineDash([6, 4]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.moveTo(xPullback, yPullback);
            ctx.lineTo(xTp1, yTp1);
            ctx.stroke();
            ctx.setLineDash([]);

            // Node 2: TP1 circle
            ctx.fillStyle = fc.leg2Hit ? "#10b981" : (fc.isBull ? "#089981" : "#f23645");
            ctx.beginPath();
            ctx.arc(xTp1, yTp1, isMobile ? 2.5 : 3, 0, Math.PI * 2);
            ctx.fill();

            if (!hasBoundedForecastLines && fc.labelTp1) {
              drawBadge(
                ctx,
                fc.leg2Hit ? `${fc.labelTp1} ✓` : fc.labelTp1,
                xTp1 + 6,
                yTp1 + (fc.isBull ? -8 : 8),
                "rgba(8, 12, 21, 0.94)",
                fc.isBull ? "#089981" : "#f23645",
                fc.isBull ? "#34d399" : "#f87171",
                mediaW,
                "left",
                9
              );
            }

            // Leg 3: (x2, y2) -> (x3, y3) Impulse line to TP2 (line_fc_2)
            ctx.strokeStyle = fc.leg3Hit ? "#059669" : "#0284c7";
            ctx.lineWidth = trajWidth;
            if (!fc.leg2Hit && !fc.leg3Hit) {
              ctx.setLineDash([6, 4]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.moveTo(xTp1, yTp1);
            ctx.lineTo(xTp2, yTp2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Node 3: Arrowhead at TP2
            const angle = Math.atan2(yTp2 - yTp1, xTp2 - xTp1);
            const arrowLen = isMobile ? 6.5 : 7.5;
            ctx.fillStyle = fc.leg3Hit ? "#10b981" : "#0284c7";
            ctx.beginPath();
            ctx.moveTo(xTp2, yTp2);
            ctx.lineTo(
              xTp2 - arrowLen * Math.cos(angle - Math.PI / 6),
              yTp2 - arrowLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              xTp2 - arrowLen * Math.cos(angle + Math.PI / 6),
              yTp2 - arrowLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            if (!hasBoundedForecastLines && fc.labelTp2) {
              drawBadge(
                ctx,
                fc.labelTp2,
                xTp2 + 6,
                yTp2,
                "rgba(8, 12, 21, 0.94)",
                "#0284c7",
                "#38bdf8",
                mediaW,
                "left",
                9
              );
            }

            // Stop Loss Line (only if not already drawn by boundedLines)
            if (!hasBoundedForecastLines && typeof fc.slPrice === "number") {
              const rawYSl = series.priceToCoordinate(fc.slPrice);
              if (rawYSl !== null) {
                const ySl = snapHalf(rawYSl as number);
                const slEndX = snapPx(xTp2 + 16);
                ctx.strokeStyle = "#ef4444";
                ctx.lineWidth = 1.25;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(snapPx(xStart), ySl);
                ctx.lineTo(slEndX, ySl);
                ctx.stroke();
                ctx.setLineDash([]);

                drawBadge(
                  ctx,
                  fc.labelSl || `SL: ${fc.slPrice.toFixed(1)}`,
                  slEndX + 4,
                  ySl,
                  "rgba(8, 12, 21, 0.94)",
                  "#ef4444",
                  "#f87171",
                  mediaW,
                  "left",
                  9
                );
              }
            }
          }
        }

        // 3. Draw Alternative Plan B Breakdown Arrow
        if (data.altForecast) {
          const afc = data.altForecast;
          let axStart: number | null = null;
          let axTp1: number | null = null;
          let axTp2: number | null = null;

          if (typeof afc.startLogical === "number") {
            const c = timeScale.logicalToCoordinate(afc.startLogical as any);
            if (c !== null) axStart = c as number;
          }
          if (axStart === null) {
            const raw = timeScale.timeToCoordinate(afc.startTime as any);
            if (raw !== null) axStart = raw as number;
          }
          if (typeof afc.tp1Logical === "number") {
            const c = timeScale.logicalToCoordinate(afc.tp1Logical as any);
            if (c !== null) axTp1 = c as number;
          }
          if (axTp1 === null && axStart !== null) {
            axTp1 = axStart + 5 * barSpacing;
          }

          if (typeof afc.tp2Logical === "number") {
            const c = timeScale.logicalToCoordinate(afc.tp2Logical as any);
            if (c !== null) axTp2 = c as number;
          }
          if (axTp2 === null && axStart !== null) {
            axTp2 = axStart + 10 * barSpacing;
          }

          const ayStartRaw = series.priceToCoordinate(afc.startPrice);
          const ayTp1Raw = series.priceToCoordinate(afc.tp1Price);
          const ayTp2Raw = series.priceToCoordinate(afc.tp2Price);

          if (axStart !== null && axTp1 !== null && axTp2 !== null && ayStartRaw !== null && ayTp1Raw !== null && ayTp2Raw !== null) {
            const ayStart = ayStartRaw as number;
            const ayTp1 = ayTp1Raw as number;
            const ayTp2 = ayTp2Raw as number;

            ctx.strokeStyle = afc.isBull ? "#10b981" : "#f43f5e";
            ctx.lineWidth = isMobile ? 1.2 : 1.35;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(axStart, ayStart);
            ctx.lineTo(axTp1, ayTp1);
            ctx.lineTo(axTp2, ayTp2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Arrowhead at Plan B TP2
            const angle = Math.atan2(ayTp2 - ayTp1, axTp2 - axTp1);
            const arrowLen = isMobile ? 5.5 : 6.5;
            ctx.fillStyle = afc.isBull ? "#10b981" : "#f43f5e";
            ctx.beginPath();
            ctx.moveTo(axTp2, ayTp2);
            ctx.lineTo(
              axTp2 - arrowLen * Math.cos(angle - Math.PI / 6),
              ayTp2 - arrowLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              axTp2 - arrowLen * Math.cos(angle + Math.PI / 6),
              ayTp2 - arrowLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            if (afc.labelTp1) {
              drawBadge(
                ctx,
                afc.labelTp1,
                axTp1 + 4,
                ayTp1,
                "rgba(8, 12, 21, 0.94)",
                afc.isBull ? "#10b981" : "#f43f5e",
                afc.isBull ? "#34d399" : "#fb7185",
                mediaW,
                "left",
                8.5
              );
            }
            if (afc.labelTp2) {
              drawBadge(
                ctx,
                afc.labelTp2,
                axTp2 + 5,
                ayTp2,
                "rgba(8, 12, 21, 0.94)",
                afc.isBull ? "#10b981" : "#f43f5e",
                afc.isBull ? "#34d399" : "#fb7185",
                mediaW,
                "left",
                8.5
              );
            }
          }
        }

        // 4. Draw Bounded Price Lines (Entry, TP1, TP2, SL, CW, PW, Flip, Pain, Magnet, EM)
        // Strictly deduplicated by ID/label with deterministic multi-pass vertical anti-collision so badges never overlap
        if (data.lines && data.lines.length > 0) {
          const mediaH = scope.mediaSize.height;
          const seenLabels = new Set<string>();
          const minVertGap = isMobile ? 18 : 21;

          // Collect fixed obstacles already drawn by background/altForecast (0.50 EQ, Liq LT/IT, Plan B)
          // AND floating price-axis tags (spot, EMA9, EMA21, EMA200) so Flip/Magnet/Wall badges never overlap them
          const fixedObstacles: AntiCollisionObstacle[] = [];
          if (data.eqLine) {
            const eqY = series.priceToCoordinate(data.eqLine.price);
            let eqX2: number | null = null;
            if (typeof data.eqLine.endLogical === "number") {
              const c2 = timeScale.logicalToCoordinate(data.eqLine.endLogical as any);
              if (c2 !== null) eqX2 = c2 as number;
            }
            if (eqY !== null && eqX2 !== null) {
              fixedObstacles.push({ id: "eqLine", x: snapPx(eqX2 + 4), y: snapPx(eqY as number) });
            }
          }
          if (data.zones) {
            for (const z of data.zones) {
              if (z.type === "sr" && z.label) {
                const topY = series.priceToCoordinate(z.topPrice);
                const botY = series.priceToCoordinate(z.bottomPrice);
                const endX = typeof z.endLogical === "number" ? timeScale.logicalToCoordinate(z.endLogical as any) : null;
                if (topY !== null && botY !== null && endX !== null) {
                  fixedObstacles.push({
                    id: z.label,
                    x: snapPx((endX as number) + 4),
                    y: snapPx(((topY as number) + (botY as number)) / 2)
                  });
                }
              }
            }
          }
          if (data.altForecast) {
            const afc = data.altForecast;
            const ay1 = series.priceToCoordinate(afc.tp1Price);
            const ay2 = series.priceToCoordinate(afc.tp2Price);
            const ax1 = typeof afc.tp1Logical === "number" ? timeScale.logicalToCoordinate(afc.tp1Logical as any) : null;
            const ax2 = typeof afc.tp2Logical === "number" ? timeScale.logicalToCoordinate(afc.tp2Logical as any) : null;
            if (ay1 !== null && ax1 !== null) fixedObstacles.push({ id: "alt_tp1", x: snapPx((ax1 as number) + 4), y: snapPx(ay1 as number) });
            if (ay2 !== null && ax2 !== null) fixedObstacles.push({ id: "alt_tp2", x: snapPx((ax2 as number) + 5), y: snapPx(ay2 as number) });
          }

          // Floating price-axis tags (spot, EMA9, EMA21, EMA200) and bar countdown on the right price axis
          if (data.floatingPriceAxisTags && data.floatingPriceAxisTags.length > 0) {
            for (const tag of data.floatingPriceAxisTags) {
              if (!tag || !isFinite(tag.price) || tag.price <= 0) continue;
              const tagY = series.priceToCoordinate(tag.price);
              if (tagY !== null && (tagY as number) >= -10 && (tagY as number) <= mediaH + 10) {
                fixedObstacles.push({
                  id: tag.id,
                  x: snapPx(mediaW - 24),
                  y: snapPx(tagY as number),
                  isPriceAxisTag: true
                });
              }
            }
          }
          if (data.currentPriceCountdown && isFinite(data.currentPriceCountdown.price) && data.currentPriceCountdown.price > 0) {
            const spotY = series.priceToCoordinate(data.currentPriceCountdown.price);
            if (spotY !== null && (spotY as number) >= -10 && (spotY as number) <= mediaH + 10) {
              // Ensure both the spot price tag itself and the countdown badge below it are registered as right-axis obstacles
              const hasSpotObstacle = fixedObstacles.some(
                o => o.isPriceAxisTag && Math.abs(o.y - (spotY as number)) < 2
              );
              if (!hasSpotObstacle) {
                fixedObstacles.push({
                  id: "spot",
                  x: snapPx(mediaW - 24),
                  y: snapPx(spotY as number),
                  isPriceAxisTag: true
                });
              }
              fixedObstacles.push({
                id: "spot_countdown",
                x: snapPx(mediaW - 24),
                y: snapPx((spotY as number) + 13),
                isPriceAxisTag: true
              });
            }
          }

          const badgesToRender: AntiCollisionBadgeItem[] = [];

          // PASS 1: Calculate coordinates and draw all horizontal level lines first
          for (const pl of data.lines) {
            if (pl.label && seenLabels.has(pl.label)) continue;
            if (pl.label) seenLabels.add(pl.label);

            let x1: number | null = null;
            let x2: number | null = null;

            if (typeof pl.startLogical === "number") {
              const c1 = timeScale.logicalToCoordinate(pl.startLogical as any);
              if (c1 !== null) x1 = c1 as number;
            }
            if (x1 === null && typeof pl.startTime === "number") {
              const rawX1 = timeScale.timeToCoordinate(pl.startTime as any);
              if (rawX1 !== null) x1 = rawX1 as number;
            }

            if (typeof pl.endLogical === "number") {
              const c2 = timeScale.logicalToCoordinate(pl.endLogical as any);
              if (c2 !== null) x2 = c2 as number;
            }
            if (x2 === null && typeof pl.endTime === "number") {
              const rawX2 = timeScale.timeToCoordinate(pl.endTime as any);
              if (rawX2 !== null) x2 = rawX2 as number;
            }

            // Fallback bounded coordinate
            if (x1 !== null && x2 === null) {
              if (typeof pl.startLogical === "number" && typeof pl.endLogical === "number") {
                const deltaBars = Math.max(1, pl.endLogical - pl.startLogical);
                x2 = x1 + deltaBars * barSpacing;
              } else {
                x2 = x1 + 80;
              }
            }

            const rawY = series.priceToCoordinate(pl.price);
            if (x1 === null || x2 === null || rawY === null) continue;

            // Clamp rawY within visible canvas bounds for GEX levels (especially Monthly Magnet / Flip / Walls)
            // so even if the 15m chart is zoomed in tightly, the Monthly Magnet badge stays pinned at the canvas edge
            const isGexCoreLine =
              pl.id === "pain_line" ||
              pl.id === "flip_line" ||
              pl.id === "cw_line" ||
              pl.id === "pw_line";
            const clampedRawY = isGexCoreLine
              ? Math.max(16, Math.min(mediaH - 16, rawY as number))
              : (rawY as number);

            const y = snapHalf(rawY as number);
            const left = snapPx(Math.min(x1, x2));
            const right = snapPx(Math.max(x1, x2));

            // Stable anti-flicker horizontal level lines (drawn when within canvas vertical bounds)
            if ((rawY as number) >= -2 && (rawY as number) <= mediaH + 2) {
              ctx.strokeStyle = pl.color;
              ctx.lineWidth = isMobile ? 1.0 : 1.25;
              if (pl.lineStyle === "dashed") {
                ctx.setLineDash([6, 4]);
              } else if (pl.lineStyle === "dotted") {
                ctx.setLineDash([4, 3]);
              } else {
                ctx.setLineDash([]);
              }
              ctx.beginPath();
              ctx.moveTo(left, y);
              ctx.lineTo(right, y);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Collect badge for deterministic vertical anti-collision solver
            if (pl.label) {
              const anchorY = snapPx(clampedRawY);
              const badgeX = snapPx(right + 4);

              const isFlip = pl.id === "flip_line" || pl.label.includes("Граница Гаммы");
              const isSl = pl.id === "sl_line" || pl.label.includes("SL");
              const isPain = pl.id === "pain_line" || pl.label.includes("Магнит");

              const labelBg = pl.labelBg || (isFlip
                ? "rgba(18, 9, 31, 0.98)"
                : isSl
                ? "rgba(30, 9, 13, 0.98)"
                : isPain
                ? "rgba(6, 24, 32, 0.98)"
                : "rgba(8, 12, 21, 0.96)");
              const labelBorder = pl.labelBorderColor || (isFlip
                ? "#c084fc"
                : isSl
                ? "#f87171"
                : isPain
                ? "#22d3ee"
                : pl.color);
              const labelText = pl.labelTextColor || (isFlip
                ? "#f3e8ff"
                : isSl
                ? "#fecdd3"
                : isPain
                ? "#cffafe"
                : "#ffffff");

              badgesToRender.push({
                id: pl.id || pl.label,
                label: pl.label,
                x: badgeX,
                y: anchorY,
                anchorY,
                lineRight: right,
                lineColor: labelBorder,
                bg: labelBg,
                border: labelBorder,
                textColor: labelText,
                showBorder: true
              });
            }
          }

          // PASS 1.5: Deterministic multi-pass vertical anti-collision solver (including spot, EMA9, EMA21, EMA200 tags)
          solveBadgeAntiCollision(badgesToRender, fixedObstacles, mediaW, mediaH, minVertGap);

          // PASS 2: Render leader lines (when vertically displaced) and all badges ON TOP of all lines
          for (const b of badgesToRender) {
            if (Math.abs(b.y - b.anchorY) > 3) {
              ctx.save();
              ctx.strokeStyle = b.lineColor;
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.moveTo(b.lineRight, b.anchorY);
              ctx.lineTo(b.x, snapPx(b.y));
              ctx.stroke();
              ctx.restore();
            }

            drawBadge(
              ctx,
              b.label,
              b.x,
              snapPx(b.y),
              b.bg,
              b.border,
              b.textColor,
              mediaW,
              "left",
              9.5,
              { showBorder: b.showBorder }
            );
          }
        }
      } finally {
        ctx.restore();
      }
    });
  }
}

class TradingViewBackgroundZonesPaneView implements IPrimitivePaneView {
  private _renderer: TradingViewBackgroundZonesRenderer;

  constructor(primitive: TradingViewZonesPrimitive) {
    this._renderer = new TradingViewBackgroundZonesRenderer(primitive);
  }

  zOrder(): PrimitivePaneViewZOrder {
    // Renders behind candlesticks
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class TradingViewForegroundForecastPaneView implements IPrimitivePaneView {
  private _renderer: TradingViewForegroundForecastRenderer;

  constructor(primitive: TradingViewZonesPrimitive) {
    this._renderer = new TradingViewForegroundForecastRenderer(primitive);
  }

  zOrder(): PrimitivePaneViewZOrder {
    // Renders on top of candlesticks
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

/**
 * Custom series primitive implementing two-layer rendering:
 * 1. Background layer: OB, FVG, OTE zones and 0.50 EQ line behind candles
 * 2. Foreground layer: Zigzag Forecast, Plan B & tags on top of candles
 */
export class TradingViewZonesPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _data: TradingViewPrimitiveData | null = null;
  private _paneViews: IPrimitivePaneView[];

  constructor() {
    this._paneViews = [
      new TradingViewBackgroundZonesPaneView(this),
      new TradingViewForegroundForecastPaneView(this)
    ];
  }

  private _requestUpdate: (() => void) | null = null;

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = (param as any)?.requestUpdate || null;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  get chart(): IChartApi | null {
    return this._chart;
  }

  get series(): ISeriesApi<SeriesType, Time> | null {
    return this._series;
  }

  get data(): TradingViewPrimitiveData | null {
    return this._data;
  }

  setData(data: TradingViewPrimitiveData) {
    this._data = data;
    this.updateAllViews();
  }

  updateAllViews() {
    if (this._requestUpdate) {
      try {
        this._requestUpdate();
      } catch {}
    } else if (this._series) {
      try {
        (this._series as any).applyOptions?.({});
      } catch {}
    }
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }
}
