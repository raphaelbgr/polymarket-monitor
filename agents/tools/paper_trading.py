"""Paper trading simulator for BTC perp futures."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from agents.models.prediction import PaperPosition


class PaperTrader:
    """Simulated paper trading for BTC perpetual futures."""

    def __init__(self, initial_balance: float = 10_000.0) -> None:
        self._positions: dict[str, list[PaperPosition]] = {}  # session -> list
        self._balances: dict[str, float] = {}
        self._initial_balance = initial_balance

    def _ensure_session(self, session_id: str) -> None:
        if session_id not in self._positions:
            self._positions[session_id] = []
            self._balances[session_id] = self._initial_balance

    def open_position(
        self,
        session_id: str,
        side: str,
        size_usd: float,
        entry_price: float,
        prediction_id: str = "",
        reasoning: str = "",
    ) -> PaperPosition:
        """Open a paper position."""
        self._ensure_session(session_id)

        pos = PaperPosition(
            id=str(uuid.uuid4())[:8],
            session_id=session_id,
            side=side,
            size_usd=size_usd,
            entry_price=entry_price,
            current_price=entry_price,
            prediction_id=prediction_id,
            reasoning=reasoning,
        )
        self._positions[session_id].append(pos)
        return pos

    def close_position(self, session_id: str, position_id: str, exit_price: float) -> Optional[PaperPosition]:
        """Close a paper position and compute PnL."""
        for pos in self._positions.get(session_id, []):
            if pos.id == position_id and pos.is_open:
                pos.is_open = False
                pos.exit_price = exit_price
                pos.current_price = exit_price
                pos.closed_at = datetime.utcnow()

                # PnL calculation
                if pos.side == "long":
                    pos.pnl = pos.size_usd * (exit_price - pos.entry_price) / pos.entry_price
                else:
                    pos.pnl = pos.size_usd * (pos.entry_price - exit_price) / pos.entry_price
                pos.pnl_pct = pos.pnl / pos.size_usd * 100

                self._balances[session_id] += pos.pnl
                return pos
        return None

    def update_prices(self, session_id: str, current_price: float) -> list[PaperPosition]:
        """Update unrealized PnL for all open positions."""
        updated = []
        for pos in self._positions.get(session_id, []):
            if pos.is_open:
                pos.current_price = current_price
                if pos.side == "long":
                    pos.pnl = pos.size_usd * (current_price - pos.entry_price) / pos.entry_price
                else:
                    pos.pnl = pos.size_usd * (pos.entry_price - current_price) / pos.entry_price
                pos.pnl_pct = pos.pnl / pos.size_usd * 100
                updated.append(pos)
        return updated

    def get_open_positions(self, session_id: str) -> list[PaperPosition]:
        """Get all open positions for a session."""
        return [p for p in self._positions.get(session_id, []) if p.is_open]

    def get_all_positions(self, session_id: str) -> list[PaperPosition]:
        """Get all positions (open + closed) for a session."""
        return list(self._positions.get(session_id, []))

    def get_balance(self, session_id: str) -> float:
        """Get current balance."""
        self._ensure_session(session_id)
        return self._balances[session_id]

    def get_total_pnl(self, session_id: str) -> float:
        """Get total realized PnL."""
        closed = [p for p in self._positions.get(session_id, []) if not p.is_open]
        return sum(p.pnl for p in closed)

    def clear_session(self, session_id: str) -> None:
        """Clear all positions for a session."""
        self._positions.pop(session_id, None)
        self._balances.pop(session_id, None)


# Singleton
paper_trader = PaperTrader()
