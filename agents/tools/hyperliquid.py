"""Hyperliquid SDK wrapper — gated behind TRADING_MODE=live."""

from __future__ import annotations

import os
from typing import Optional

from agents.config import TRADING_MODE


def _get_hl_client():
    """Lazy-load Hyperliquid client only when in live mode."""
    if TRADING_MODE != "live":
        raise RuntimeError("Hyperliquid live trading is disabled (TRADING_MODE=paper)")

    from hyperliquid.info import Info
    from hyperliquid.exchange import Exchange
    from hyperliquid.utils import constants

    secret_key = os.getenv("HL_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("HL_SECRET_KEY env var required for live trading")

    info = Info(constants.MAINNET_API_URL, skip_ws=True)
    exchange = Exchange(wallet=None, base_url=constants.MAINNET_API_URL)
    return info, exchange


async def get_hl_btc_price() -> Optional[float]:
    """Get BTC mark price from Hyperliquid."""
    try:
        info, _ = _get_hl_client()
        meta = info.meta_and_asset_ctxs()
        for ctx in meta[1]:
            if ctx.get("coin") == "BTC":
                return float(ctx["markPx"])
    except Exception:
        return None
    return None
