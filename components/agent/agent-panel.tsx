"use client";

import { useRef, useCallback } from "react";
import { useAgentStore } from "@/lib/stores/agent-store";
import { PredictionSummary } from "../chart/prediction-summary";
import { AgentLog } from "./agent-log";

export function AgentPanel() {
  const panelOpen = useAgentStore((s) => s.agentPanelOpen);
  const panelHeight = useAgentStore((s) => s.agentPanelHeight);
  const setPanelHeight = useAgentStore((s) => s.setAgentPanelHeight);
  const togglePanel = useAgentStore((s) => s.toggleAgentPanel);
  const sseConnected = useAgentStore((s) => s.sseConnected);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startY.current = e.clientY;
      startHeight.current = panelHeight;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startY.current - ev.clientY;
        const newHeight = Math.max(120, Math.min(600, startHeight.current + delta));
        setPanelHeight(newHeight);
      };

      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [panelHeight, setPanelHeight],
  );

  return (
    <div className="border-t border-[#222] bg-[#0a0a0a] flex flex-col">
      {/* Toggle bar */}
      <button
        onClick={togglePanel}
        className="flex items-center gap-2 px-3 py-1 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50 transition-colors"
      >
        <div
          className={`h-2 w-2 rounded-full ${sseConnected ? "bg-violet-500" : "bg-neutral-600"}`}
        />
        <span className="font-medium">AI Agent</span>
        <span className="text-neutral-700">{panelOpen ? "\u25BC" : "\u25B2"}</span>
      </button>

      {panelOpen && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            className="h-1 cursor-ns-resize bg-[#1a1a1a] hover:bg-neutral-700 transition-colors"
          />

          {/* Panel content */}
          <div className="flex flex-col overflow-hidden" style={{ height: panelHeight }}>
            <PredictionSummary />
            <AgentLog />
          </div>
        </>
      )}
    </div>
  );
}
