/**
 * AI prediction tag card factory — matches existing whale tag card style.
 * Cards render on the LEFT rail (whale tags are on the right).
 */

import type { AIPrediction } from "@/lib/agent/types";

export const AI_CARD_WIDTH = 200;
export const AI_CARD_HEIGHT = 44;
export const AI_CARD_GAP = 4;
export const AI_RAIL_PADDING_TOP = 8;
export const AI_RAIL_PADDING_LEFT = 8;

const AI_COLOR = "#a855f7"; // Purple

function makeSpan(text: string, styles: Partial<CSSStyleDeclaration>): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  Object.assign(span.style, styles);
  return span;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${(price / 1000).toFixed(price >= 10000 ? 0 : 1)}k`;
  return `$${price.toLocaleString()}`;
}

/**
 * Create a compact AI prediction tag card.
 * Format: "2:00 PM [purple] AI ^UP 87% $98,500"
 * Resolved: "2:00 PM [green] AI ^UP 87% OK actual: $98,780"
 */
export function createAIPredictionTagElement(pred: AIPrediction): HTMLDivElement {
  const el = document.createElement("div");
  const isResolved = pred.resolved;
  const isCorrect = pred.was_correct;
  const borderColor = isResolved
    ? (isCorrect ? "#10b981" : "#ef4444")
    : AI_COLOR;

  Object.assign(el.style, {
    position: "absolute",
    pointerEvents: "auto",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    lineHeight: "1.3",
    whiteSpace: "nowrap",
    backdropFilter: "blur(4px)",
    border: `1px solid ${borderColor}40`,
    background: `${borderColor}1a`,
    opacity: isResolved ? "0.5" : "1",
    cursor: "default",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    width: `${AI_CARD_WIDTH}px`,
    height: `${AI_CARD_HEIGHT}px`,
    boxSizing: "border-box",
  });

  // Target time
  el.appendChild(makeSpan(formatTime(pred.target_time), {
    color: "#e5e5e5", fontWeight: "600", fontSize: "11px",
  }));

  // AI badge dot
  const dot = document.createElement("span");
  Object.assign(dot.style, {
    width: "6px", height: "6px", borderRadius: "50%",
    background: AI_COLOR, display: "inline-block", flexShrink: "0",
  });
  el.appendChild(dot);

  // "AI" label
  el.appendChild(makeSpan("AI", {
    color: AI_COLOR, fontWeight: "700", fontSize: "10px",
  }));

  // Direction arrow + confidence
  const isUp = pred.direction === "up";
  const dirColor = pred.direction === "neutral" ? "#a3a3a3" : (isUp ? "#10b981" : "#ef4444");
  const arrow = pred.direction === "neutral" ? "\u25C6" : (isUp ? "\u25B2" : "\u25BC");
  const confStr = `${Math.round(pred.confidence * 100)}%`;
  el.appendChild(makeSpan(`${arrow}${pred.direction.toUpperCase()} ${confStr}`, {
    color: dirColor, fontWeight: "600", fontSize: "10px",
  }));

  // Price or resolution status
  if (isResolved && pred.actual_price !== null) {
    const statusIcon = isCorrect ? "OK" : "X";
    const statusColor = isCorrect ? "#10b981" : "#ef4444";
    el.appendChild(makeSpan(statusIcon, { color: statusColor, fontWeight: "700", fontSize: "10px" }));
    el.appendChild(makeSpan(formatPrice(pred.actual_price), { color: "#737373", fontSize: "10px" }));
  } else {
    el.appendChild(makeSpan(formatPrice(pred.predicted_price), { color: "#a3a3a3", fontSize: "10px" }));
  }

  // Tooltip
  const lines = [
    `AI Prediction`,
    `Direction: ${pred.direction.toUpperCase()}`,
    `Confidence: ${confStr}`,
    `Predicted: ${formatPrice(pred.predicted_price)}`,
    `Current: ${formatPrice(pred.current_price)}`,
    `Target: ${formatTime(pred.target_time)}`,
  ];
  if (pred.reasoning) lines.push(`Reasoning: ${pred.reasoning}`);
  if (isResolved) {
    lines.push(`Actual: ${pred.actual_price ? formatPrice(pred.actual_price) : "N/A"}`);
    lines.push(`Result: ${isCorrect ? "Correct" : "Incorrect"}`);
  }
  el.title = lines.join("\n");

  return el;
}
