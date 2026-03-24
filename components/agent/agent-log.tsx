"use client";

import { useState } from "react";
import { useAgentStore } from "@/lib/stores/agent-store";
import type { AgentLogEntry, AgentType } from "@/lib/agent/types";

const AGENT_COLORS: Record<AgentType, string> = {
  analysis: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  prediction: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  trading: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const LEVEL_COLORS: Record<string, string> = {
  info: "text-neutral-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

function LogEntry({ entry }: { entry: AgentLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="border-b border-[#1a1a1a] px-3 py-1.5 hover:bg-neutral-900/50">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-neutral-600 w-20 shrink-0">{time}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${AGENT_COLORS[entry.agent]}`}
        >
          {entry.agent}
        </span>
        <span className={`flex-1 truncate ${LEVEL_COLORS[entry.level] ?? "text-neutral-400"}`}>
          {entry.message}
        </span>
        {entry.reasoning && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-600 hover:text-neutral-400 px-1 shrink-0"
          >
            {expanded ? "[-]" : "[+]"}
          </button>
        )}
      </div>
      {expanded && entry.reasoning && (
        <pre className="mt-1.5 ml-[88px] text-[10px] text-neutral-500 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto bg-neutral-950 rounded p-2 border border-[#1a1a1a]">
          {entry.reasoning}
        </pre>
      )}
    </div>
  );
}

export function AgentLog() {
  const agentLog = useAgentStore((s) => s.agentLog);
  const filter = useAgentStore((s) => s.logFilterAgent);
  const setFilter = useAgentStore((s) => s.setLogFilterAgent);
  const clearLog = useAgentStore((s) => s.clearLog);

  const filtered = filter === "all" ? agentLog : agentLog.filter((e) => e.agent === filter);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-[#222] px-3 py-1.5">
        {(["all", "analysis", "prediction", "trading"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              filter === f
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-neutral-600">{filtered.length} entries</span>
        <button
          onClick={clearLog}
          className="text-[10px] text-neutral-600 hover:text-neutral-400"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-neutral-600">
            No agent activity yet
          </div>
        ) : (
          filtered.map((entry) => <LogEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
