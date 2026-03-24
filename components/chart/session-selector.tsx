"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAgentStore } from "@/lib/stores/agent-store";

export function SessionSelector() {
  const sessions = useAgentStore((s) => s.sessions);
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const setActiveSessionId = useAgentStore((s) => s.setActiveSessionId);
  const setSessions = useAgentStore((s) => s.setSessions);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch { /* ignore */ }
  }, [setSessions]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = async (id: string) => {
    try {
      await fetch(`/api/agent/sessions/${id}/select`, { method: "PUT" });
      setActiveSessionId(id);
      setOpen(false);
      fetchSessions();
    } catch { /* ignore */ }
  };

  const createSession = async () => {
    try {
      const res = await fetch("/api/agent/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Session ${sessions.length + 1}` }),
      });
      if (res.ok) {
        const session = await res.json();
        await selectSession(session.id);
      }
    } catch { /* ignore */ }
  };

  const resetSession = async () => {
    try {
      await fetch(`/api/agent/sessions/${activeSessionId}/reset`, { method: "POST" });
      fetchSessions();
    } catch { /* ignore */ }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const label = activeSession?.name ?? activeSessionId;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
      >
        <span className="text-violet-400">AI</span>
        <span className="truncate max-w-[100px]">{label}</span>
        <span className="text-neutral-600">{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded border border-[#333] bg-[#111] shadow-xl z-50">
          <div className="p-1.5 border-b border-[#222]">
            <div className="flex items-center gap-1">
              <button
                onClick={createSession}
                className="flex-1 rounded px-2 py-1 text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                + New
              </button>
              <button
                onClick={resetSession}
                className="rounded px-2 py-1 text-[10px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                title="Reset active session"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSession(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  s.id === activeSessionId
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <div className="flex-1 truncate">{s.name}</div>
                {s.prediction_count > 0 && (
                  <span className="text-[10px] text-neutral-600">
                    {s.prediction_count}p
                    {s.accuracy > 0 && ` ${Math.round(s.accuracy * 100)}%`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
