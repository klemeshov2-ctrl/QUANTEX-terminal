/**
 * PropDeskOverlay.ts
 * Отдельный оверлей-индикатор "🏦 Prop Desk Overlay" для lightweight-charts.
 * Отрисовывает:
 * - POC (сплошная оранжевая линия + бейдж), VAH/VAL (пунктирные линии + бейджи), мини-профиль справа
 * - Сессионные боксы по сезонному расписанию (Азия, Лондон, Нью-Йорк) с метками сезона
 * - Вертикальные линии US_OPEN и MACRO_0830 ("⚡ макро/открытие")
 * - Пулы ликвидности: EQH, EQL, PDH, PDL, ASIA_H, ASIA_L (активные и снятые/swept)
 * - Маркеры потока ордеров (дивергенции дельты DIV-/DIV+, поглощение ABS)
 * - ADR-бейдж в углу: "ADR использовано: XX% ⚠️"
 *
 * Полностью независим от волнового индикатора QUANTEX и GEX-стен.
 */

import {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  PrimitivePaneViewZOrder,
  Time,
  SeriesType,
  IChartApi,
  ISeriesApi
} from "lightweight-charts";
import { PropDeskContext } from "../../server/propContextEngine";
import { solveBadgeAntiCollision, AntiCollisionBadgeItem, AntiCollisionObstacle } from "./TradingViewZonesPrimitive";

export interface PropDeskOverlayOptions {
  showPropOverlay: boolean;
  showPropVP: boolean;
  showPropSessions: boolean;
  showPropPools: boolean;
  showPropFlow: boolean;
  showPropAdr: boolean;
}

export const DEFAULT_PROP_OVERLAY_OPTIONS: PropDeskOverlayOptions = {
  showPropOverlay: true,
  showPropVP: true,
  showPropSessions: true,
  showPropPools: true,
  showPropFlow: true,
  showPropAdr: true
};

const getDpr = (): number =>
  typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;

const snapPx = (v: number): number => {
  const dpr = getDpr();
  return Math.round(v * dpr) / dpr;
};

const snapHalf = (v: number): number => {
  const dpr = getDpr();
  return (Math.floor(v * dpr) + 0.5) / dpr;
};

/**
 * Отрисовка текста бейджа без рамок в соответствии с общей политикой терминала
 */
function drawPropBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string,
  textColor: string,
  align: "left" | "right" | "center" = "left",
  fontSize: number = 9,
  isStrikethrough: boolean = false
) {
  ctx.save();
  ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`;
  const textMetrics = ctx.measureText(text);
  const textW = Math.ceil(textMetrics.width);
  const padX = 4;
  const padY = 2;
  const badgeW = textW + padX * 2;
  const badgeH = fontSize + padY * 2;

  let drawX = x;
  if (align === "right") drawX = x - badgeW;
  else if (align === "center") drawX = x - badgeW / 2;

  const drawY = y - badgeH / 2;

  // Фон бейджа с мягким скруглением
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  const r = 3;
  ctx.roundRect(snapPx(drawX), snapPx(drawY), snapPx(badgeW), snapPx(badgeH), r);
  ctx.fill();

  // Текст
  ctx.fillStyle = textColor;
  ctx.textBaseline = "middle";
  ctx.fillText(text, snapPx(drawX + padX), snapPx(y));

  // Перечеркивание для снятых пулов
  if (isStrikethrough) {
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(snapPx(drawX + padX), snapPx(y));
    ctx.lineTo(snapPx(drawX + padX + textW), snapPx(y));
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 1. Background Renderer: сессионные боксы и мини-профиль справа под свечами
 */
class PropDeskBackgroundRenderer implements IPrimitivePaneRenderer {
  private _primitive: PropDeskOverlayPrimitive;

  constructor(primitive: PropDeskOverlayPrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    target.useMediaCoordinateSpace((scope: any) => {
      const ctx: CanvasRenderingContext2D = scope.context;
      const mediaW = scope.mediaSize.width;
      const mediaH = scope.mediaSize.height;
      const chart = this._primitive.chart;
      const series = this._primitive.series;
      const context = this._primitive.context;
      const opts = this._primitive.options;

      if (!chart || !series || !context || !context.available || !opts.showPropOverlay) return;

      const timeScale = chart.timeScale();

      // А. Сессионные боксы (Азия, Лондон, Нью-Йорк)
      if (opts.showPropSessions && context.sessionLevels) {
        const schedule = context.schedule;
        const sl = context.sessionLevels;

        const drawSessionBox = (
          session: { high: number; low: number; open: number; close: number; active: boolean } | null,
          fillColor: string,
          borderColor: string,
          label: string
        ) => {
          if (!session) return;
          const yTop = series.priceToCoordinate(session.high);
          const yBottom = series.priceToCoordinate(session.low);
          if (yTop === null || yBottom === null) return;

          const topY = Math.min(yTop, yBottom);
          const height = Math.abs(yBottom - yTop);
          if (height <= 0) return;

          // Рисуем полупрозрачную полосу уровня сессии
          ctx.save();
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          // Рисуем на ширину экрана графика
          ctx.fillRect(0, snapPx(topY), mediaW, snapPx(height));
          ctx.strokeRect(0, snapPx(topY), mediaW, snapPx(height));
          ctx.restore();
        };

        // Азия (серый)
        if (sl.asia) {
          drawSessionBox(
            sl.asia,
            "rgba(148, 163, 184, 0.04)",
            "rgba(148, 163, 184, 0.20)",
            `Asia 00:00–08:00 МСК`
          );
        }

        // Лондон (синий)
        if (sl.london) {
          drawSessionBox(
            sl.london,
            "rgba(59, 130, 246, 0.05)",
            "rgba(59, 130, 246, 0.25)",
            `London ${schedule.londonOpenMsk}–${schedule.londonCloseMsk} МСК`
          );
        }

        // Нью-Йорк (янтарный)
        if (sl.ny) {
          drawSessionBox(
            sl.ny,
            "rgba(245, 158, 11, 0.05)",
            "rgba(245, 158, 11, 0.25)",
            `NY ${schedule.usOpenMsk}–${schedule.usCloseMsk} МСК (${schedule.seasonUs === "WINTER" ? "зима" : "лето"})`
          );
        }
      }

      // Б. Мини-профиль объёма справа (12 бинов)
      if (opts.showPropVP && context.volumeProfile && context.volumeProfile.bins.length > 0) {
        const vp = context.volumeProfile;
        const maxVol = Math.max(...vp.bins.map(b => b.volume), 1);
        const maxBarW = Math.min(80, mediaW * 0.12);
        const rightX = mediaW - 10;

        ctx.save();
        for (const bin of vp.bins) {
          const y = series.priceToCoordinate(bin.price);
          if (y === null || y < 0 || y > mediaH) continue;

          const barW = (bin.volume / maxVol) * maxBarW;
          const isPoc = Math.abs(bin.price - vp.poc) < (vp.vah - vp.val) / 24;
          const isVa = bin.price >= vp.val && bin.price <= vp.vah;

          ctx.fillStyle = isPoc
            ? "rgba(245, 158, 11, 0.65)" // POC ярко-оранжевый
            : isVa
            ? "rgba(56, 189, 248, 0.35)" // Value Area голубой
            : "rgba(100, 116, 139, 0.20)"; // Вне VA серо-стальной

          ctx.fillRect(snapPx(rightX - barW), snapPx(y - 2), snapPx(barW), 4);
        }
        ctx.restore();
      }
    });
  }
}

/**
 * 2. Foreground Renderer: Линии POC/VAH/VAL, пулы ликвидности, маркеры Order Flow, ADR
 */
class PropDeskForegroundRenderer implements IPrimitivePaneRenderer {
  private _primitive: PropDeskOverlayPrimitive;

  constructor(primitive: PropDeskOverlayPrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    target.useMediaCoordinateSpace((scope: any) => {
      const ctx: CanvasRenderingContext2D = scope.context;
      const mediaW = scope.mediaSize.width;
      const mediaH = scope.mediaSize.height;
      const chart = this._primitive.chart;
      const series = this._primitive.series;
      const context = this._primitive.context;
      const opts = this._primitive.options;

      if (!chart || !series || !context || !context.available || !opts.showPropOverlay) return;

      const badgesToRender: AntiCollisionBadgeItem[] = [];
      const fixedObstacles: AntiCollisionObstacle[] = [];

      // 1. Линии Профиля Объёма (POC, VAH, VAL)
      if (opts.showPropVP && context.volumeProfile) {
        const vp = context.volumeProfile;

        // POC: сплошная оранжевая линия
        const yPoc = series.priceToCoordinate(vp.poc);
        if (yPoc !== null && yPoc >= 0 && yPoc <= mediaH) {
          ctx.save();
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, snapHalf(yPoc));
          ctx.lineTo(mediaW - 65, snapHalf(yPoc));
          ctx.stroke();
          ctx.restore();

          badgesToRender.push({
            id: "prop-poc",
            label: `POC ${vp.poc}`,
            x: mediaW - 60,
            y: yPoc,
            anchorY: yPoc,
            lineRight: mediaW,
            lineColor: "#f59e0b",
            bg: "rgba(245, 158, 11, 0.90)",
            border: "#f59e0b",
            textColor: "#000000",
            showBorder: false
          });
        }

        // VAH: пунктирная линия
        const yVah = series.priceToCoordinate(vp.vah);
        if (yVah !== null && yVah >= 0 && yVah <= mediaH) {
          ctx.save();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, snapHalf(yVah));
          ctx.lineTo(mediaW - 65, snapHalf(yVah));
          ctx.stroke();
          ctx.restore();

          badgesToRender.push({
            id: "prop-vah",
            label: `VAH ${vp.vah}`,
            x: mediaW - 60,
            y: yVah,
            anchorY: yVah,
            lineRight: mediaW,
            lineColor: "#fbbf24",
            bg: "rgba(251, 191, 36, 0.85)",
            border: "#fbbf24",
            textColor: "#000000",
            showBorder: false
          });
        }

        // VAL: пунктирная линия
        const yVal = series.priceToCoordinate(vp.val);
        if (yVal !== null && yVal >= 0 && yVal <= mediaH) {
          ctx.save();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, snapHalf(yVal));
          ctx.lineTo(mediaW - 65, snapHalf(yVal));
          ctx.stroke();
          ctx.restore();

          badgesToRender.push({
            id: "prop-val",
            label: `VAL ${vp.val}`,
            x: mediaW - 60,
            y: yVal,
            anchorY: yVal,
            lineRight: mediaW,
            lineColor: "#fbbf24",
            bg: "rgba(251, 191, 36, 0.85)",
            border: "#fbbf24",
            textColor: "#000000",
            showBorder: false
          });
        }
      }

      // 2. Пулы ликвидности (EQH, EQL, PDH, PDL, ASIA_H, ASIA_L)
      if (opts.showPropPools && Array.isArray(context.liquidityPools)) {
        for (const pool of context.liquidityPools.slice(0, 10)) {
          const y = series.priceToCoordinate(pool.price);
          if (y === null || y < 0 || y > mediaH) continue;

          ctx.save();
          if (pool.swept) {
            ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
          } else {
            ctx.strokeStyle = pool.type.includes("H") ? "#f43f5e" : "#10b981";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
          }

          ctx.beginPath();
          ctx.moveTo(0, snapHalf(y));
          ctx.lineTo(mediaW - 75, snapHalf(y));
          ctx.stroke();
          ctx.restore();

          const label = pool.swept ? `~${pool.label}~` : pool.label;
          const bg = pool.swept
            ? "rgba(51, 65, 85, 0.80)"
            : pool.type.includes("H")
            ? "rgba(244, 63, 94, 0.85)"
            : "rgba(16, 185, 129, 0.85)";
          const txtColor = pool.swept ? "#94a3b8" : "#ffffff";

          badgesToRender.push({
            id: `pool-${pool.id}`,
            label,
            x: mediaW - 75,
            y,
            anchorY: y,
            lineRight: mediaW,
            lineColor: ctx.strokeStyle as string,
            bg,
            border: "transparent",
            textColor: txtColor,
            showBorder: false
          });
        }
      }

      // 3. Маркеры Order Flow (дивергенции дельты DIV- / DIV+, поглощение ABS)
      if (opts.showPropFlow && context.orderFlow) {
        const of = context.orderFlow;

        if (of.deltaDivergence === "BEARISH") {
          // Рисуем бейдж DIV- над графиком
          drawPropBadge(
            ctx,
            "⚠️ DIV− (Медвежья дивергенция дельты)",
            mediaW / 2,
            24,
            "rgba(225, 29, 72, 0.85)",
            "#ffffff",
            "center",
            10
          );
        } else if (of.deltaDivergence === "BULLISH") {
          drawPropBadge(
            ctx,
            "⚠️ DIV+ (Бычья дивергенция дельты)",
            mediaW / 2,
            24,
            "rgba(16, 185, 129, 0.85)",
            "#ffffff",
            "center",
            10
          );
        }

        if (of.absorption) {
          const yAbs = series.priceToCoordinate(of.absorption.price);
          if (yAbs !== null && yAbs >= 0 && yAbs <= mediaH) {
            drawPropBadge(
              ctx,
              `🧱 ABS (${of.absorption.side} ${of.absorption.delta})`,
              80,
              yAbs,
              "rgba(99, 102, 241, 0.90)",
              "#ffffff",
              "left",
              9
            );
          }
        }
      }

      // 4. ADR-бейдж в углу
      if (opts.showPropAdr && context.adr) {
        const adr = context.adr;
        const color = adr.usedPct > 85 ? "#ef4444" : adr.usedPct >= 70 ? "#f59e0b" : "#94a3b8";
        const bg = adr.usedPct > 85 ? "rgba(239, 68, 68, 0.85)" : adr.usedPct >= 70 ? "rgba(245, 158, 11, 0.85)" : "rgba(30, 41, 59, 0.80)";
        const txt = `ADR: ${adr.usedPct}% (${adr.todayRange}/${adr.adr14} п.) ${adr.usedPct >= 85 ? "⚠️" : ""}`;

        drawPropBadge(
          ctx,
          txt,
          mediaW - 12,
          16,
          bg,
          "#ffffff",
          "right",
          10
        );
      }

      // 5. Сессионный бейдж активного сезона в левом верхнем углу
      if (context.schedule) {
        drawPropBadge(
          ctx,
          context.schedule.labelRu,
          12,
          16,
          "rgba(15, 23, 42, 0.80)",
          "#38bdf8",
          "left",
          10
        );
      }

      // Разрешение коллизий и финальная отрисовка бейджей уровней
      if (badgesToRender.length > 0) {
        solveBadgeAntiCollision(badgesToRender, fixedObstacles, mediaW, mediaH, 14);
        for (const b of badgesToRender) {
          drawPropBadge(
            ctx,
            b.label,
            b.x,
            b.y,
            b.bg,
            b.textColor,
            "left",
            9,
            b.label.startsWith("~") && b.label.endsWith("~")
          );
        }
      }
    });
  }
}

class PropDeskBackgroundPaneView implements IPrimitivePaneView {
  private _renderer: PropDeskBackgroundRenderer;

  constructor(primitive: PropDeskOverlayPrimitive) {
    this._renderer = new PropDeskBackgroundRenderer(primitive);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class PropDeskForegroundPaneView implements IPrimitivePaneView {
  private _renderer: PropDeskForegroundRenderer;

  constructor(primitive: PropDeskOverlayPrimitive) {
    this._renderer = new PropDeskForegroundRenderer(primitive);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

/**
 * Главный класс примитива Prop Desk Overlay
 */
export class PropDeskOverlayPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _context: PropDeskContext | null = null;
  private _options: PropDeskOverlayOptions = { ...DEFAULT_PROP_OVERLAY_OPTIONS };
  private _paneViews: IPrimitivePaneView[];
  private _requestUpdate: (() => void) | null = null;

  constructor(options?: Partial<PropDeskOverlayOptions>) {
    if (options) {
      this._options = { ...this._options, ...options };
    }
    this._paneViews = [
      new PropDeskBackgroundPaneView(this),
      new PropDeskForegroundPaneView(this)
    ];
  }

  get chart(): IChartApi | null {
    return this._chart;
  }

  get series(): ISeriesApi<SeriesType, Time> | null {
    return this._series;
  }

  get context(): PropDeskContext | null {
    return this._context;
  }

  get options(): PropDeskOverlayOptions {
    return this._options;
  }

  setData(context: PropDeskContext | null, options?: Partial<PropDeskOverlayOptions>) {
    this._context = context;
    if (options) {
      this._options = { ...this._options, ...options };
    }
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }

  setOptions(options: Partial<PropDeskOverlayOptions>) {
    this._options = { ...this._options, ...options };
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  timeAxisViews(): readonly any[] {
    return [];
  }

  priceAxisViews(): readonly any[] {
    return [];
  }

  updateAllViews(): void {
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }
}
