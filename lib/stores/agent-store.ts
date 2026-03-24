import { create } from "zustand";
import type { AIPrediction, AgentLogEntry, AgentSession, AgentType } from "../agent/types";

interface AgentState {
  // Connection
  sseConnected: boolean;
  agentServiceUrl: string;

  // Session
  activeSessionId: string;
  sessions: AgentSession[];

  // Predictions
  predictions: AIPrediction[];

  // Agent log
  agentLog: AgentLogEntry[];

  // UI state
  agentPanelOpen: boolean;
  agentPanelHeight: number;
  logFilterAgent: AgentType | "all";
  showPredictionBand: boolean;
  showAITags: boolean;
  showResolvedPredictions: boolean;

  // Actions
  setSseConnected: (connected: boolean) => void;
  setAgentServiceUrl: (url: string) => void;
  setActiveSessionId: (id: string) => void;
  setSessions: (sessions: AgentSession[]) => void;
  addPrediction: (pred: AIPrediction) => void;
  resolvePrediction: (pred: AIPrediction) => void;
  addLogEntry: (entry: AgentLogEntry) => void;
  toggleAgentPanel: () => void;
  setAgentPanelHeight: (h: number) => void;
  setLogFilterAgent: (filter: AgentType | "all") => void;
  togglePredictionBand: () => void;
  toggleAITags: () => void;
  toggleResolvedPredictions: () => void;
  clearLog: () => void;
}

const MAX_LOG = 500;
const MAX_PREDICTIONS = 200;

function loadPersisted(): Partial<Pick<AgentState, "agentPanelOpen" | "agentPanelHeight" | "showPredictionBand" | "showAITags" | "showResolvedPredictions" | "agentServiceUrl" | "activeSessionId">> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("agent-settings");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persist(state: AgentState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "agent-settings",
      JSON.stringify({
        agentPanelOpen: state.agentPanelOpen,
        agentPanelHeight: state.agentPanelHeight,
        showPredictionBand: state.showPredictionBand,
        showAITags: state.showAITags,
        showResolvedPredictions: state.showResolvedPredictions,
        agentServiceUrl: state.agentServiceUrl,
        activeSessionId: state.activeSessionId,
      }),
    );
  } catch { /* ignore */ }
}

export const useAgentStore = create<AgentState>((set, get) => {
  const saved = loadPersisted();

  return {
    sseConnected: false,
    agentServiceUrl: saved.agentServiceUrl ?? "/api/agent",
    activeSessionId: saved.activeSessionId ?? "default",
    sessions: [],
    predictions: [],
    agentLog: [],
    agentPanelOpen: saved.agentPanelOpen ?? false,
    agentPanelHeight: saved.agentPanelHeight ?? 250,
    logFilterAgent: "all",
    showPredictionBand: saved.showPredictionBand ?? true,
    showAITags: saved.showAITags ?? true,
    showResolvedPredictions: saved.showResolvedPredictions ?? false,

    setSseConnected: (connected) => set({ sseConnected: connected }),

    setAgentServiceUrl: (url) => {
      set({ agentServiceUrl: url });
      persist(get());
    },

    setActiveSessionId: (id) => {
      set({ activeSessionId: id });
      persist(get());
    },

    setSessions: (sessions) => set({ sessions }),

    addPrediction: (pred) =>
      set((s) => ({
        predictions: [pred, ...s.predictions].slice(0, MAX_PREDICTIONS),
      })),

    resolvePrediction: (pred) =>
      set((s) => ({
        predictions: s.predictions.map((p) =>
          p.id === pred.id ? { ...p, ...pred } : p,
        ),
      })),

    addLogEntry: (entry) =>
      set((s) => ({
        agentLog: [entry, ...s.agentLog].slice(0, MAX_LOG),
      })),

    toggleAgentPanel: () => {
      set({ agentPanelOpen: !get().agentPanelOpen });
      persist(get());
    },

    setAgentPanelHeight: (h) => {
      set({ agentPanelHeight: h });
      persist(get());
    },

    setLogFilterAgent: (filter) => set({ logFilterAgent: filter }),

    togglePredictionBand: () => {
      set({ showPredictionBand: !get().showPredictionBand });
      persist(get());
    },

    toggleAITags: () => {
      set({ showAITags: !get().showAITags });
      persist(get());
    },

    toggleResolvedPredictions: () => {
      set({ showResolvedPredictions: !get().showResolvedPredictions });
      persist(get());
    },

    clearLog: () => set({ agentLog: [] }),
  };
});
