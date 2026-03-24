export * from "./shared/constants";

// Browser-specific constants (use NEXT_PUBLIC_ env vars)
export const COPY_TRADE_WS_URL = "ws://localhost:8765";
export const COPY_TRADE_WS_TOKEN = process.env.NEXT_PUBLIC_COPY_TRADE_WS_TOKEN || "";
