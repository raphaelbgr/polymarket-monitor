"""Fetch whale trades from the copy-trade HTTP API."""

from __future__ import annotations

import httpx

from agents.config import COPY_TRADE_API


async def fetch_whale_trades(tags: str = "btc", limit: int = 50) -> list[dict]:
    """Fetch recent whale trades filtered by tag from the copy-trade server.

    Args:
        tags: Comma-separated tag filter (e.g. "btc" or "btc,directional")
        limit: Max trades to return

    Returns:
        List of trade dicts from the server API.
    """
    url = f"{COPY_TRADE_API}/api/v1/trades"
    params = {"tags": tags, "limit": str(limit)}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
