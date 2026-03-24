"""Configuration for the agent service."""

import os

# Service
PORT = int(os.getenv("AGENT_PORT", "8770"))
HOST = os.getenv("AGENT_HOST", "0.0.0.0")

# Upstream services
COPY_TRADE_API = os.getenv("COPY_TRADE_API", "http://localhost:8766")
NEXTJS_API = os.getenv("NEXTJS_API", "http://localhost:3440")

# Agent models (override via env)
ANALYSIS_MODEL = os.getenv("ANALYSIS_MODEL", "openai:gpt-4.1-mini")
PREDICTION_MODEL = os.getenv("PREDICTION_MODEL", "anthropic:claude-sonnet-4-20250514")
TRADING_MODEL = os.getenv("TRADING_MODEL", "openai:gpt-4.1-mini")

# Prediction loop
PREDICTION_INTERVAL_SEC = int(os.getenv("PREDICTION_INTERVAL", "60"))

# Trading
TRADING_MODE = os.getenv("TRADING_MODE", "paper")  # "paper" or "live"

# Database
DB_PATH = os.getenv("AGENT_DB_PATH", "agents/data/agents.db")
