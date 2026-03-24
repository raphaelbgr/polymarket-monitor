"""Pydantic models for agent data."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Direction(str, Enum):
    UP = "up"
    DOWN = "down"
    NEUTRAL = "neutral"


class WhaleSentiment(BaseModel):
    """Aggregated whale sentiment from Polymarket trades."""

    direction: Direction
    confidence: float = Field(ge=0.0, le=1.0, description="0-1 confidence score")
    bullish_volume: float = 0.0
    bearish_volume: float = 0.0
    num_trades: int = 0
    dominant_wallets: list[str] = Field(default_factory=list)
    reasoning: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Prediction(BaseModel):
    """BTC price prediction from the prediction agent."""

    id: str = ""
    session_id: str = ""
    direction: Direction
    confidence: float = Field(ge=0.0, le=1.0)
    predicted_price: float
    current_price: float
    target_time: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reasoning: str = ""
    sentiment: Optional[WhaleSentiment] = None
    # Resolution
    resolved: bool = False
    actual_price: Optional[float] = None
    resolved_at: Optional[datetime] = None
    was_correct: Optional[bool] = None


class PaperPosition(BaseModel):
    """Paper trading position for simulated BTC perp futures."""

    id: str = ""
    session_id: str = ""
    side: str  # "long" or "short"
    size_usd: float
    entry_price: float
    current_price: float = 0.0
    exit_price: Optional[float] = None
    pnl: float = 0.0
    pnl_pct: float = 0.0
    prediction_id: str = ""
    opened_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None
    is_open: bool = True
    reasoning: str = ""


class AgentLogEntry(BaseModel):
    """Single log entry from any agent."""

    id: str = ""
    session_id: str = ""
    agent: str  # "analysis", "prediction", "trading"
    level: str = "info"  # "info", "warn", "error"
    message: str
    reasoning: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Optional[dict] = None
