/** Types for the AI prediction agent system. */

export interface AIPrediction {
  id: string;
  session_id: string;
  direction: "up" | "down" | "neutral";
  confidence: number; // 0-1
  predicted_price: number;
  current_price: number;
  target_time: string; // ISO datetime
  created_at: string; // ISO datetime
  reasoning: string;
  // Resolution
  resolved: boolean;
  actual_price: number | null;
  resolved_at: string | null;
  was_correct: boolean | null;
}

export type AgentType = "analysis" | "prediction" | "trading";

export interface AgentLogEntry {
  id: string;
  session_id: string;
  agent: AgentType;
  level: "info" | "warn" | "error";
  message: string;
  reasoning: string | null;
  timestamp: string; // ISO datetime
  data: Record<string, unknown> | null;
}

export interface AgentSession {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  prediction_count: number;
  accuracy: number;
}

export type SSEEventType =
  | "connected"
  | "prediction"
  | "agent_log"
  | "prediction_resolved"
  | "agent_status";
