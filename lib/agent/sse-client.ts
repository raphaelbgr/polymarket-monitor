/**
 * SSE client wrapper with auto-reconnect for the agent activity stream.
 */

import type { SSEEventType } from "./types";

type SSECallback = (eventType: SSEEventType, data: unknown) => void;
type StatusCallback = (connected: boolean) => void;

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_DELAY = 3000;

export function connectSSE(
  baseUrl: string,
  sessionId: string,
  onEvent: SSECallback,
  onStatus: StatusCallback,
): void {
  disconnectSSE();

  const url = `${baseUrl}?session_id=${encodeURIComponent(sessionId)}`;
  const es = new EventSource(url);
  eventSource = es;

  es.addEventListener("connected", () => {
    onStatus(true);
  });

  es.addEventListener("prediction", (e) => {
    try {
      onEvent("prediction", JSON.parse(e.data));
    } catch { /* ignore parse errors */ }
  });

  es.addEventListener("agent_log", (e) => {
    try {
      onEvent("agent_log", JSON.parse(e.data));
    } catch { /* ignore */ }
  });

  es.addEventListener("prediction_resolved", (e) => {
    try {
      onEvent("prediction_resolved", JSON.parse(e.data));
    } catch { /* ignore */ }
  });

  es.addEventListener("agent_status", (e) => {
    try {
      onEvent("agent_status", JSON.parse(e.data));
    } catch { /* ignore */ }
  });

  es.onerror = () => {
    onStatus(false);
    es.close();
    eventSource = null;

    // Auto-reconnect
    reconnectTimer = setTimeout(() => {
      connectSSE(baseUrl, sessionId, onEvent, onStatus);
    }, RECONNECT_DELAY);
  };
}

export function disconnectSSE(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
