"""Fetch current BTC price via the Next.js Binance proxy."""

from __future__ import annotations

import httpx

from agents.config import NEXTJS_API


async def get_btc_price() -> float:
    """Get current BTC/USDT price from Binance via the Next.js proxy.

    Returns:
        Current BTC price as float.
    """
    url = f"{NEXTJS_API}/api/binance"
    params = {"symbol": "BTCUSDT", "interval": "1m", "limit": "1"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        klines = resp.json()
        if klines and len(klines) > 0:
            # Binance kline format: [openTime, open, high, low, close, ...]
            return float(klines[-1][4])  # close price
    raise ValueError("No kline data returned from Binance")
