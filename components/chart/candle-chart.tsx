"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type AreaData,
  type SeriesMarker,
  type SeriesType,
  type IPriceLine,
  type Time,
  type Logical,
  ColorType,
} from "lightweight-charts";
import type { CandleData, WhaleChartMarker, PriceThreshold, PredictionTag } from "@/lib/chart/types";
import { TIMEFRAME_CONFIG, type Timeframe } from "@/lib/chart/constants";
import type { ChartStyle } from "@/lib/stores/chart-store";

// lightweight-charts displays numeric timestamps as UTC.
// Offset by local timezone so the axis shows local time.
const TZ_OFFSET_SEC = new Date().getTimezoneOffset() * -60;

interface CandleChartProps {
  timeframe: Timeframe;
  candles: CandleData[];
  markers?: WhaleChartMarker[];
  priceThresholds?: PriceThreshold[];
  predictionTags?: PredictionTag[];
  chartStyle?: ChartStyle;
}

// ---------------------------------------------------------------------------
// Tag rail constants
// ---------------------------------------------------------------------------

const CARD_WIDTH = 190;
const CARD_HEIGHT = 44;
const CARD_GAP = 4;
const RAIL_PADDING_TOP = 8;
const RAIL_PADDING_RIGHT = 8;

// ---------------------------------------------------------------------------
// Tag DOM element factory — safe DOM methods only (no innerHTML)
// ---------------------------------------------------------------------------

function formatSize(size: number): string {
  if (Math.abs(size) >= 1000) return `$${(size / 1000).toFixed(1)}k`;
  return `$${size.toFixed(0)}`;
}

/** Format UTC seconds to a short local time string like "3:00 PM" */
function formatCloseTime(utcSec: number): string {
  const d = new Date(utcSec * 1000);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function makeSpan(text: string, styles: Partial<CSSStyleDeclaration>): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  Object.assign(span.style, styles);
  return span;
}

/** Compact single-row card: "1:25 PM ● whal ▲UP $140" */
function createTagElement(tag: PredictionTag): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    pointerEvents: "auto",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    lineHeight: "1.3",
    whiteSpace: "nowrap",
    backdropFilter: "blur(4px)",
    border: `1px solid ${tag.walletColor}40`,
    background: `${tag.walletColor}1a`,
    opacity: tag.isResolved ? "0.4" : "1",
    cursor: "default",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    width: `${CARD_WIDTH}px`,
    height: `${CARD_HEIGHT}px`,
    boxSizing: "border-box",
  });

  const isUp = tag.dominantOutcome === "Up";
  const dirColor = isUp ? "#10b981" : "#ef4444";

  // Time label
  el.appendChild(makeSpan(formatCloseTime(tag.closeTimeSec), { color: "#e5e5e5", fontWeight: "600", fontSize: "11px" }));

  // Wallet dot
  const dot = document.createElement("span");
  Object.assign(dot.style, {
    width: "6px", height: "6px", borderRadius: "50%",
    background: tag.walletColor, display: "inline-block", flexShrink: "0",
  });
  el.appendChild(dot);

  // Short wallet label (max 6 chars)
  const shortLabel = tag.walletLabel.length > 6 ? tag.walletLabel.slice(0, 6) : tag.walletLabel;
  el.appendChild(makeSpan(shortLabel, { color: "#d4d4d4", fontWeight: "500" }));

  // Direction arrow + label
  const arrow = isUp ? "\u25B2" : "\u25BC";
  el.appendChild(makeSpan(`${arrow}${tag.dominantOutcome.toUpperCase()}`, { color: dirColor, fontWeight: "600", fontSize: "10px" }));

  // Net size
  el.appendChild(makeSpan(formatSize(tag.netSize), { color: "#a3a3a3", fontSize: "10px" }));

  // Price to beat
  if (tag.priceThreshold !== null) {
    const p = tag.priceThreshold;
    const priceStr = p >= 1000 ? `$${(p / 1000).toFixed(p >= 10000 ? 0 : 1)}k` : `$${p.toLocaleString()}`;
    el.appendChild(makeSpan(`@${priceStr}`, { color: "#737373", fontSize: "10px" }));
  }

  // Tooltip with full details
  const timeLabel = formatCloseTime(tag.closeTimeSec);
  const buyStr = formatSize(tag.totalBuySize);
  const sellStr = formatSize(tag.totalSellSize);
  const avgStr = tag.avgPrice.toFixed(3);
  const threshStr = tag.priceThreshold ? `$${tag.priceThreshold.toLocaleString()}` : "N/A";
  el.title = `${tag.title}\n\nClose: ${timeLabel}\nThreshold: ${threshStr}\nBuy: ${buyStr} | Sell: ${sellStr}\nAvg price: ${avgStr}\nTrades: ${tag.tradeCount}${tag.isResolved ? "\n(Resolved)" : ""}`;

  return el;
}

// ---------------------------------------------------------------------------
// Chart component
// ---------------------------------------------------------------------------

export function CandleChart({
  timeframe,
  candles,
  markers,
  priceThresholds,
  predictionTags,
  chartStyle = "area",
}: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  // Store latest tags in ref so viewport callbacks see fresh data
  const tagsRef = useRef<PredictionTag[]>([]);

  // Create chart — recreate when chartStyle changes
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#737373",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: {
        vertLine: { color: "#404040", labelBackgroundColor: "#262626" },
        horzLine: { color: "#404040", labelBackgroundColor: "#262626" },
      },
      timeScale: {
        borderColor: "#222",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 20,
      },
      rightPriceScale: {
        borderColor: "#222",
      },
    });

    const series =
      chartStyle === "area"
        ? chart.addSeries(AreaSeries, {
            lineColor: "#3b82f6",
            topColor: "rgba(59, 130, 246, 0.35)",
            bottomColor: "rgba(59, 130, 246, 0.02)",
            lineWidth: 2,
          })
        : chart.addSeries(CandlestickSeries, {
            upColor: "#10b981",
            downColor: "#ef4444",
            borderUpColor: "#10b981",
            borderDownColor: "#ef4444",
            wickUpColor: "#10b981",
            wickDownColor: "#ef4444",
          });

    const seriesMarkers = createSeriesMarkers(series, []);

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = seriesMarkers;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, [chartStyle]);

  // Update candle data + auto-extend visible range for future prediction tags
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    if (chartStyle === "area") {
      const areaData: AreaData<Time>[] = candles.map((c) => ({
        time: (c.time + TZ_OFFSET_SEC) as Time,
        value: c.close,
      }));
      seriesRef.current.setData(areaData);
    } else {
      const candleData: CandlestickData<Time>[] = candles.map((c) => ({
        time: (c.time + TZ_OFFSET_SEC) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      seriesRef.current.setData(candleData);
    }

    // Compute how many bars the furthest future tag is ahead of the last candle
    const tags = tagsRef.current;
    const intervalSec = TIMEFRAME_CONFIG[timeframe].seconds;
    const lastCandleTime = candles[candles.length - 1].time;
    let maxBarsAhead = 0;

    for (const tag of tags) {
      if (!tag.isResolved) {
        const barsAhead = (tag.closeTimeSec - lastCandleTime) / intervalSec;
        if (barsAhead > maxBarsAhead) maxBarsAhead = barsAhead;
      }
    }

    // Set rightOffset to fit the furthest future tag (+ padding), min 20
    const neededOffset = Math.ceil(maxBarsAhead) + 10;
    const rightOffset = Math.max(20, neededOffset);
    const secondsVisible = intervalSec < 60;
    chartRef.current?.timeScale().applyOptions({ rightOffset, secondsVisible });
    chartRef.current?.timeScale().fitContent();
  }, [candles, predictionTags, timeframe, chartStyle]);

  // Update markers
  useEffect(() => {
    if (!markersRef.current) return;

    if (!markers || markers.length === 0) {
      markersRef.current.setMarkers([]);
      return;
    }

    const sorted = [...markers].sort((a, b) => a.time - b.time);
    const lcMarkers: SeriesMarker<Time>[] = sorted.map((m) => ({
      time: (m.time + TZ_OFFSET_SEC) as Time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
    }));

    markersRef.current.setMarkers(lcMarkers);
  }, [markers]);

  // Update price threshold lines
  useEffect(() => {
    if (!seriesRef.current) return;

    for (const line of priceLinesRef.current) {
      seriesRef.current.removePriceLine(line);
    }
    priceLinesRef.current = [];

    if (!priceThresholds || priceThresholds.length === 0) return;

    for (const threshold of priceThresholds) {
      const line = seriesRef.current.createPriceLine({
        price: threshold.price,
        color: threshold.color,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: threshold.label,
      });
      priceLinesRef.current.push(line);
    }
  }, [priceThresholds]);

  // -----------------------------------------------------------------------
  // Prediction tag overlay — direct DOM for performance
  // -----------------------------------------------------------------------

  useEffect(() => {
    tagsRef.current = predictionTags ?? [];
  }, [predictionTags]);

  const repositionTags = useCallback(() => {
    const overlay = overlayRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!overlay || !chart || !series) return;

    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

    const tags = tagsRef.current;
    if (tags.length === 0) return;

    const timeScale = chart.timeScale();
    const intervalSec = TIMEFRAME_CONFIG[timeframe].seconds;

    const candleCount = candles.length;
    if (candleCount === 0) return;

    const lastCandle = candles[candleCount - 1];
    const lastCandleAdjusted = lastCandle.time + TZ_OFFSET_SEC;
    const lastLogicalIndex = candleCount - 1;

    const overlayWidth = overlay.clientWidth;
    const overlayHeight = overlay.clientHeight;

    // Sort tags by close time for consistent rail ordering
    const sortedTags = [...tags].sort((a, b) => a.closeTimeSec - b.closeTimeSec);

    // Layer 1: SVG for connector lines and anchor dots
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(overlayWidth));
    svg.setAttribute("height", String(overlayHeight));
    Object.assign(svg.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" });
    overlay.appendChild(svg);

    // Layer 2: Card rail on right edge
    const cardX = overlayWidth - CARD_WIDTH - RAIL_PADDING_RIGHT;

    for (let i = 0; i < sortedTags.length; i++) {
      const tag = sortedTags[i];
      const cardY = RAIL_PADDING_TOP + i * (CARD_HEIGHT + CARD_GAP);

      // Create and position card in the rail
      const el = createTagElement(tag);
      el.style.left = `${cardX}px`;
      el.style.top = `${cardY}px`;
      overlay.appendChild(el);

      // Compute anchor position on chart
      const closeAdjusted = tag.closeTimeSec + TZ_OFFSET_SEC;
      const barsAhead = (closeAdjusted - lastCandleAdjusted) / intervalSec;
      const logicalIndex = lastLogicalIndex + barsAhead;

      const anchorX = timeScale.logicalToCoordinate(logicalIndex as Logical);
      if (anchorX === null) continue; // off-screen: show card but skip line/dot

      let anchorY: number | null = null;
      if (tag.priceThreshold !== null) {
        anchorY = series.priceToCoordinate(tag.priceThreshold);
      }
      if (anchorY === null) {
        anchorY = overlayHeight / 2;
      }

      // Anchor dot
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", String(anchorX));
      circle.setAttribute("cy", String(anchorY));
      circle.setAttribute("r", "4");
      circle.setAttribute("fill", tag.walletColor);
      svg.appendChild(circle);

      // Connector line: anchor dot → left edge of card
      const cardCenterY = cardY + CARD_HEIGHT / 2;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", String(anchorX));
      line.setAttribute("y1", String(anchorY));
      line.setAttribute("x2", String(cardX));
      line.setAttribute("y2", String(cardCenterY));
      line.setAttribute("stroke", tag.walletColor);
      line.setAttribute("stroke-opacity", "0.3");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-dasharray", "4 3");
      svg.appendChild(line);
    }
  }, [candles, timeframe]);

  // Subscribe to viewport changes for tag repositioning
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const timeScale = chart.timeScale();

    repositionTags();

    timeScale.subscribeVisibleLogicalRangeChange(repositionTags);
    timeScale.subscribeSizeChange(repositionTags);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(repositionTags);
      timeScale.unsubscribeSizeChange(repositionTags);
      const overlay = overlayRef.current;
      if (overlay) while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    };
  }, [repositionTags, predictionTags]);

  const label = TIMEFRAME_CONFIG[timeframe].label;

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-[#222] bg-[#0a0a0a]">
      <div className="flex items-center gap-2 border-b border-[#222] px-3 py-1.5">
        <span className="text-xs font-medium text-neutral-400">{label}</span>
      </div>
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ zIndex: 10 }}
        />
      </div>
    </div>
  );
}
