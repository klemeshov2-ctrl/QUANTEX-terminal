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
  lastCandleLogical?: number;
  lastCandleTime?: number;
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
 * Helper to measure exact pixel width of a chart badge before drawing lines.
 */
function measureBadgeWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  mediaW: number,
  fontSize: number = 10,
  opts?: { customFontSize?: number }
): number {
  const isMobile = mediaW < 640;
  let baseFontSize = opts?.customFontSize || fontSize;
  try {
    const saved = typeof window !== "undefined" ? Number(localStorage.getItem("quantex_chart_font_size")) : 0;
    if (saved && saved >= 6 && saved <= 16) {
      baseFontSize = saved;
    }
  } catch {}
  const effectiveFontSize = isMobile ? Math.min(baseFontSize, 8) : baseFontSize;
  ctx.save();
  try {
    ctx.font = `600 ${effectiveFontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, -apple-system, BlinkMacSystemFont, sans-serif`;
    const textW = Math.ceil(ctx.measureText(text).width);
    const padX = isMobile ? 3 : 5;
    return Math.round(textW + padX * 2);
  } finally {
    ctx.restore();
  }
}

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
 * Deterministic horizontal anti-collision solver for chart badges.
 * Badges remain strictly anchored on their price line (badge center Y = anchorY).
 * When two or more badges overlap vertically (|A.y - B.y| < badgeH), collision
 * is resolved strictly horizontally by stepping badges leftwards along their respective lines.
 *
 * Rule:
 * Column 0: x = lineRight + 4 (or clamped to right edge: mediaW - width - 4)
 * Column 1: x = col0_x - width - 6
 * Column 2: x = col1_x - width - 6
 * Extreme case: If horizontal spread across the canvas is completely saturated,
 * a minimal micro-offset of at most ±(badgeH / 2) is permitted, with ZERO leader lines.
 */
export function solveBadgeAntiCollision<
  T extends {
    id: string;
    label: string;
    x: number;
    y: number;
    anchorY: number;
    width?: number;
    lineRight?: number;
  }
>(
  badges: T[],
  fixedObstacles: AntiCollisionObstacle[],
  mediaW: number,
  mediaH: number,
  _minVertGap?: number
): T[] {
  if (!badges || badges.length === 0) return badges;
  const isMobile = mediaW < 640;
  const badgeH = isMobile ? 15 : 17;
  const halfBadgeH = badgeH / 2;

  // 1. Calculate estimated width and anchor all badges strictly to their price line (center Y = anchorY)
  for (const b of badges) {
    const estW =
      b.width ??
      Math.min(mediaW - 8, Math.max(80, b.label.length * (isMobile ? 6.2 : 7.0) + 16));
    b.width = estW;
    b.y = snapPx(b.anchorY); // Center Y strictly on its own price line

    // Initial default X: to the right of the price line (or clamped inside right border)
    const baseX = typeof b.lineRight === "number" && b.lineRight > 0
      ? snapPx(b.lineRight + 4)
      : snapPx(mediaW - estW - 4);

    b.x = snapPx(Math.max(4, Math.min(baseX, mediaW - estW - 4)));
  }

  // 2. Stable sort by anchorY ascending (with secondary tie-breaker by id)
  badges.sort((a, b) => a.anchorY - b.anchorY || a.id.localeCompare(b.id));

  // 3. Keep track of placed badge bounding boxes to resolve collisions strictly horizontally
  interface BBox {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    anchorY: number;
  }
  const placed: BBox[] = [];

  // Register fixed obstacles
  for (const obs of fixedObstacles) {
    if (obs.isPriceAxisTag) {
      placed.push({
        x1: mediaW - 45,
        x2: mediaW,
        y1: obs.y - 7,
        y2: obs.y + 7,
        anchorY: obs.y
      });
    } else if (obs.x && obs.y) {
      placed.push({
        x1: obs.x - 20,
        x2: obs.x + 80,
        y1: obs.y - 8,
        y2: obs.y + 8,
        anchorY: obs.y
      });
    }
  }

  for (const b of badges) {
    const bw = b.width || 120;
    let currX = b.x;
    let currY = b.anchorY; // Strictly stays on anchorY!

    const collides = (candX: number, candY: number): boolean => {
      const bx1 = candX;
      const bx2 = candX + bw;
      const by1 = candY - halfBadgeH;
      const by2 = candY + halfBadgeH;

      for (const p of placed) {
        // Vertical overlap check (within badge height)
        const vOverlap = Math.max(0, Math.min(by2, p.y2) - Math.max(by1, p.y1));
        if (vOverlap >= 2.0) {
          // Horizontal overlap check
          const hOverlap = Math.max(0, Math.min(bx2, p.x2) - Math.max(bx1, p.x1));
          if (hOverlap > 0) return true;
        }
      }
      return false;
    };

    if (collides(currX, currY)) {
      let resolved = false;

      // Candidate 1: Step left along ITS OWN LINE (x = lineRight + 4 - W_prev - 6)
      const overlapping = placed.filter(p => {
        const vOverlap = Math.max(0, Math.min(currY + halfBadgeH, p.y2) - Math.max(currY - halfBadgeH, p.y1));
        return vOverlap >= 2.0;
      });
      // Sort rightmost first
      overlapping.sort((a, b) => b.x1 - a.x1);

      for (const ov of overlapping) {
        const stepLeftX = ov.x1 - bw - 6;
        if (stepLeftX >= 4 && !collides(stepLeftX, currY)) {
          currX = snapPx(stepLeftX);
          resolved = true;
          break;
        }
      }

      // Candidate 2: Try near left canvas border (x = 6)
      if (!resolved) {
        const leftEdgeX = 6;
        if (!collides(leftEdgeX, currY)) {
          currX = leftEdgeX;
          resolved = true;
        }
      }

      // Candidate 3 (Extreme case): If horizontal spread across the canvas along this line is completely blocked,
      // allow a micro-offset of at most ±(badgeH / 2) up/down, strictly WITHOUT leader lines:
      if (!resolved) {
        const microOffsets = [-halfBadgeH, halfBadgeH];
        for (const dy of microOffsets) {
          const testY = snapPx(b.anchorY + dy);
          if (testY >= 10 && testY <= mediaH - 10) {
            if (!collides(b.x, testY)) {
              currY = testY;
              currX = b.x;
              resolved = true;
              break;
            }
            for (const ov of overlapping) {
              const stepLeftX = ov.x1 - bw - 6;
              if (stepLeftX >= 4 && !collides(stepLeftX, testY)) {
                currY = testY;
                currX = snapPx(stepLeftX);
                resolved = true;
                break;
              }
            }
            if (resolved) break;
          }
        }
      }
    }

    b.x = snapPx(currX);
    b.y = snapPx(currY);

    placed.push({
      x1: b.x,
      x2: b.x + bw,
      y1: b.y - halfBadgeH,
      y2: b.y + halfBadgeH,
      anchorY: b.anchorY
    });
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

        // Compute right edge of the last candlestick so labels never overlap candles
        let candleEndX = 0;
        if (typeof data.lastCandleLogical === "number") {
          const cx = timeScale.logicalToCoordinate(data.lastCandleLogical as any);
          if (cx !== null) candleEndX = (cx as number) + barSpacing * 0.65;
        } else if (typeof data.lastCandleTime === "number") {
          const cx = timeScale.timeToCoordinate(data.lastCandleTime as any);
          if (cx !== null) candleEndX = (cx as number) + barSpacing * 0.65;
        }

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
            const rawRight = Math.max(x1, x2);
            const zoneBadgeW = zone.label ? measureBadgeWidth(ctx, zone.label, mediaW, 9) : 0;
            const maxZoneRight = zone.label ? Math.max(left + 10, mediaW - zoneBadgeW - 8) : mediaW;
            const targetRight = zone.label && candleEndX > 0
              ? Math.min(maxZoneRight, Math.max(rawRight, candleEndX + 6))
              : Math.min(maxZoneRight, rawRight);
            const width = snapPx(Math.max(targetRight - left, 10));
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

            // Position label strictly to the right of the zone box and to the right of candlesticks
            if (zone.label && width >= 10) {
              const labelX = snapPx(Math.max(left + width + 5, candleEndX > 0 ? candleEndX + 6 : 0));
              drawBadge(
                ctx,
                zone.label,
                labelX,
                top + height / 2,
                "rgba(8, 12, 21, 0.94)",
                zone.borderColor,
                zone.borderColor,
                mediaW,
                "left",
                9
              );
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
            const eqLabel = data.eqLine.label || "0.50 EQ";
            const eqBadgeW = measureBadgeWidth(ctx, eqLabel, mediaW, 9);
            const lineLeft = snapPx(Math.min(x1, x2));
            const rawRight = Math.max(x1, x2, candleEndX > 0 ? candleEndX + 8 : 0);
            const lineRight = snapPx(Math.max(lineLeft + 10, Math.min(rawRight, mediaW - eqBadgeW - 8)));

            ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(lineLeft, y);
            ctx.lineTo(lineRight, y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Right End Badge strictly to the right of the line and candlesticks
            drawBadge(
              ctx,
              eqLabel,
              snapPx(Math.max(lineRight + 5, candleEndX > 0 ? candleEndX + 6 : 0)),
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

        // Compute right edge of the last candlestick so labels never overlap candles
        let candleEndX = 0;
        if (typeof data.lastCandleLogical === "number") {
          const cx = timeScale.logicalToCoordinate(data.lastCandleLogical as any);
          if (cx !== null) candleEndX = (cx as number) + barSpacing * 0.65;
        } else if (typeof data.lastCandleTime === "number") {
          const cx = timeScale.timeToCoordinate(data.lastCandleTime as any);
          if (cx !== null) candleEndX = (cx as number) + barSpacing * 0.65;
        }

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
            const bosRight = snapPx(Math.max(x + 18, candleEndX > 0 ? candleEndX + 8 : x + 18));
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(snapPx(x - 18), y);
            ctx.lineTo(bosRight, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = "#facc15";
            ctx.font = `600 8.5px "JetBrains Mono", monospace`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(data.bos.label, snapPx(bosRight + 5), y);
          }
        }

        // 2. Draw Forecast Zigzag Trajectory (Start -> Entry -> TP1 -> TP2)
        if (data.forecast) {
          const fc = data.forecast;
          const getPt = (logical?: number, time?: number, price?: number) => {
            if (price === undefined || !isFinite(price) || price <= 0) return null;
            let x: number | null = null;
            if (typeof logical === "number") {
              const c = timeScale.logicalToCoordinate(logical as any);
              if (c !== null) x = c as number;
            }
            if (x === null && typeof time === "number") {
              const c = timeScale.timeToCoordinate(time as any);
              if (c !== null) x = c as number;
            }
            const y = series.priceToCoordinate(price);
            if (x === null || y === null) return null;
            return { x: snapPx(x), y: snapHalf(y as number) };
          };

          const p0 = getPt(fc.startLogical, fc.startTime, fc.startPrice);
          const p1 = getPt(fc.pullbackLogical, fc.pullbackTime, fc.pullbackPrice);
          const p2 = getPt(fc.tp1Logical, fc.tp1Time, fc.tp1Price);
          const p3 = getPt(fc.tp2Logical, fc.tp2Time, fc.tp2Price);

          // Colors matched strictly to original design:
          // Bull: Teal/Cyan (#2dd4bf) -> Sky Blue (#38bdf8)
          // Bear: Rose/Coral (#f43f5e) -> Rose-400 (#fb7185)
          const primaryColor = fc.isBull ? "#2dd4bf" : "#f43f5e";
          const secondaryColor = fc.isBull ? "#38bdf8" : "#fb7185";

          ctx.save();
          ctx.lineWidth = isMobile ? 1.25 : 1.45;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // Leg 1: Start -> Entry (solid if hit, dashed if pending)
          if (p0 && p1) {
            ctx.strokeStyle = primaryColor;
            ctx.setLineDash(fc.leg1Hit ? [] : [4, 3]);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();

            // Start node marker
            ctx.fillStyle = primaryColor;
            ctx.beginPath();
            ctx.arc(p0.x, p0.y, 3, 0, Math.PI * 2);
            ctx.fill();

            // Pullback / Entry marker
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Leg 2: Entry -> TP1 (solid teal/cyan line to TP1 as shown on screenshot)
          if (p1 && p2) {
            ctx.strokeStyle = primaryColor;
            ctx.setLineDash(fc.leg1Hit ? [] : [4, 3]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            ctx.fillStyle = primaryColor;
            ctx.beginPath();
            ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Leg 3: TP1 -> TP2 (dashed cyan/sky-blue line up to TP2)
          if (p2 && p3) {
            ctx.strokeStyle = secondaryColor;
            ctx.setLineDash(fc.leg3Hit ? [] : [5, 4]);
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.stroke();

            ctx.fillStyle = secondaryColor;
            ctx.beginPath();
            ctx.arc(p3.x, p3.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 3. Draw AltForecast Contingency Trajectory (Plan B -> Target 2)
        // Rendered as a single continuous dashed ray (p0 -> p1 -> p2) with node markers and labels right next to the line
        if (data.altForecast) {
          const alt = data.altForecast;
          const getPt = (logical?: number, time?: number, price?: number) => {
            if (price === undefined || !isFinite(price) || price <= 0) return null;
            let x: number | null = null;
            if (typeof logical === "number") {
              const c = timeScale.logicalToCoordinate(logical as any);
              if (c !== null) x = c as number;
            }
            if (x === null && typeof time === "number") {
              const c = timeScale.timeToCoordinate(time as any);
              if (c !== null) x = c as number;
            }
            const y = series.priceToCoordinate(price);
            if (x === null || y === null) return null;
            return { x: snapPx(x), y: snapHalf(y as number) };
          };

          const p0 = getPt(alt.startLogical, alt.startTime, alt.startPrice);
          const p1 = getPt(alt.tp1Logical, alt.tp1Time, alt.tp1Price);
          const p2 = getPt(alt.tp2Logical, alt.tp2Time, alt.tp2Price);

          // In original design: When primary is Long, Plan B is Bearish rose/coral (#fb7185 / #f43f5e)
          // When primary is Short, Plan B is Bullish emerald (#34d399)
          const altColor = alt.isBull ? "#34d399" : "#fb7185";
          const altTextColor = alt.isBull ? "#6ee7b7" : "#fecdd3";
          const fontSize = isMobile ? 8.5 : 9.5;

          ctx.save();
          ctx.strokeStyle = altColor;
          ctx.lineWidth = isMobile ? 1.2 : 1.4;
          ctx.setLineDash([5, 4]);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // Single continuous diagonal ray: p0 -> p1 -> p2
          if (p0 && p1) {
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            if (p2) {
              ctx.lineTo(p2.x, p2.y);
            }
            ctx.stroke();

            // Node marker at p1
            ctx.fillStyle = altColor;
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Label for Plan B strictly to the right of p1 and candlesticks
            const label1 = alt.labelTp1 || `План Б: ${alt.tp1Price}`;
            ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, sans-serif`;
            ctx.fillStyle = altTextColor;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(label1, snapPx(Math.max(p1.x + 6, candleEndX > 0 ? candleEndX + 8 : p1.x + 6)), p1.y);
          }

          if (p2) {
            // Node marker at p2
            ctx.fillStyle = altColor;
            ctx.beginPath();
            ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Label for Target 2 strictly to the right of p2 and candlesticks
            const label2 = alt.labelTp2 || `Цель 2: ${alt.tp2Price}`;
            ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, sans-serif`;
            ctx.fillStyle = altTextColor;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(label2, snapPx(Math.max(p2.x + 6, candleEndX > 0 ? candleEndX + 8 : p2.x + 6)), p2.y);
          }
          ctx.restore();
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
              fixedObstacles.push({ id: "eqLine", x: snapPx(eqX2 + 5), y: snapPx(eqY as number) });
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
                    x: snapPx((endX as number) + 5),
                    y: snapPx(((topY as number) + (botY as number)) / 2)
                  });
                }
              }
            }
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
          interface PendingLineToDraw {
            pl: BoundedPriceLine;
            left: number;
            right: number;
            y: number;
            rawY: number;
            badgeItem?: AntiCollisionBadgeItem;
          }
          const linesToDraw: PendingLineToDraw[] = [];

          // PASS 1: Calculate coordinates and badge widths first so every label sits strictly to the right of its line
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
            const rawRight = Math.max(x1, x2);
            const badgeW = pl.label ? measureBadgeWidth(ctx, pl.label, mediaW, 9.5) : 0;

            // Stop the horizontal line in the right margin before its badge so the badge is always strictly to the right of the line
            const minRightPastCandles = candleEndX > 0 ? candleEndX + Math.max(8, barSpacing * 1.2) : left + 16;
            const maxRightForBadge = pl.label ? Math.max(left + 10, mediaW - badgeW - 8) : mediaW - 4;
            const right = snapPx(Math.max(left + 10, Math.min(Math.max(rawRight, minRightPastCandles), maxRightForBadge)));

            let badgeItem: AntiCollisionBadgeItem | undefined;

            // Collect badge for deterministic vertical anti-collision solver
            if (pl.label) {
              const anchorY = snapPx(clampedRawY);
              const badgeX = snapPx(right + 5);

              const isFlip = pl.id === "flip_line" || pl.label.includes("Граница Гаммы");
              const isSl = pl.id === "sl_line" || pl.label.includes("SL");
              const isPain = pl.id === "pain_line" || pl.label.includes("Магнит");
              const isAlt = pl.id === "alt_tp1_line" || pl.id === "alt_tp2_line" || pl.label.includes("План Б") || pl.label.includes("Цель 2");

              const labelBg = pl.labelBg || (isFlip
                ? "rgba(18, 9, 31, 0.98)"
                : isSl
                ? "rgba(30, 9, 13, 0.98)"
                : isPain
                ? "rgba(6, 24, 32, 0.98)"
                : isAlt
                ? "rgba(30, 9, 13, 0.98)"
                : "rgba(8, 12, 21, 0.96)");
              const labelBorder = pl.labelBorderColor || (isFlip
                ? "#c084fc"
                : isSl
                ? "#f87171"
                : isPain
                ? "#22d3ee"
                : isAlt
                ? "#fb7185"
                : pl.color);
              const labelText = pl.labelTextColor || (isFlip
                ? "#f3e8ff"
                : isSl
                ? "#fecdd3"
                : isPain
                ? "#cffafe"
                : isAlt
                ? "#fecdd3"
                : "#ffffff");

              badgeItem = {
                id: pl.id || pl.label,
                label: pl.label,
                x: badgeX,
                y: anchorY,
                anchorY,
                width: badgeW,
                lineRight: right,
                lineColor: labelBorder,
                bg: labelBg,
                border: labelBorder,
                textColor: labelText,
                showBorder: true
              };
              badgesToRender.push(badgeItem);
            }

            linesToDraw.push({ pl, left, right, y, rawY: rawY as number, badgeItem });
          }

          // PASS 1.5: Deterministic multi-pass vertical anti-collision solver (including spot, EMA9, EMA21, EMA200 tags)
          solveBadgeAntiCollision(badgesToRender, fixedObstacles, mediaW, mediaH, minVertGap);

          // Enforce that every badge remains strictly to the right of candlesticks and its line ends strictly to the left of the badge
          for (const item of linesToDraw) {
            let actualRight = item.right;
            if (item.badgeItem) {
              const b = item.badgeItem;
              const bw = b.width || measureBadgeWidth(ctx, b.label, mediaW, 9.5);
              if (candleEndX > 0 && candleEndX + bw + 12 < mediaW) {
                b.x = Math.max(b.x, snapPx(candleEndX + 8));
              }
              if (b.x + bw > mediaW - 3) {
                b.x = Math.max(3, snapPx(mediaW - bw - 3));
              }
              // Trim the line's right end so it finishes 5px to the left of the badge (label is strictly to the right of the line)
              actualRight = snapPx(Math.max(item.left + 6, Math.min(item.right, b.x - 5)));
              b.x = snapPx(Math.max(b.x, actualRight + 5));
            }

            if (item.rawY >= -2 && item.rawY <= mediaH + 2) {
              ctx.strokeStyle = item.pl.color;
              ctx.lineWidth = isMobile ? 1.0 : 1.25;
              if (item.pl.lineStyle === "dashed") {
                ctx.setLineDash([6, 4]);
              } else if (item.pl.lineStyle === "dotted") {
                ctx.setLineDash([4, 3]);
              } else {
                ctx.setLineDash([]);
              }
              ctx.beginPath();
              ctx.moveTo(item.left, item.y);
              ctx.lineTo(actualRight, item.y);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }

          // PASS 2: Render all badges ON TOP of all lines (leader lines removed: badges stay directly on their lines)
          for (const b of badgesToRender) {
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
