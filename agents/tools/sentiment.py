"""Aggregate whale trades into a sentiment score."""

from __future__ import annotations

from datetime import datetime

from agents.models.prediction import Direction, WhaleSentiment


def compute_sentiment(trades: list[dict]) -> WhaleSentiment:
    """Aggregate whale trades into a directional sentiment.

    Looks at trade side (BUY/SELL) and title keywords (Up/Down)
    to compute a net bullish/bearish volume.
    """
    bullish_vol = 0.0
    bearish_vol = 0.0
    wallets: set[str] = set()

    for trade in trades:
        size = float(trade.get("size", 0))
        side = trade.get("side", "").upper()
        title = trade.get("title", "").lower()
        wallet = trade.get("walletAddress", trade.get("wallet", ""))

        # Determine if this trade is bullish or bearish for BTC
        is_up_market = "up" in title or "above" in title or "higher" in title
        is_down_market = "down" in title or "below" in title or "lower" in title

        if is_up_market:
            if side == "BUY":
                bullish_vol += size
            else:
                bearish_vol += size
        elif is_down_market:
            if side == "BUY":
                bearish_vol += size
            else:
                bullish_vol += size

        if wallet:
            wallets.add(wallet[:10])

    total = bullish_vol + bearish_vol
    if total == 0:
        return WhaleSentiment(
            direction=Direction.NEUTRAL,
            confidence=0.0,
            num_trades=len(trades),
            reasoning="No directional trades found",
        )

    net = bullish_vol - bearish_vol
    confidence = min(abs(net) / total, 1.0)

    if net > 0:
        direction = Direction.UP
    elif net < 0:
        direction = Direction.DOWN
    else:
        direction = Direction.NEUTRAL

    return WhaleSentiment(
        direction=direction,
        confidence=confidence,
        bullish_volume=bullish_vol,
        bearish_volume=bearish_vol,
        num_trades=len(trades),
        dominant_wallets=sorted(wallets)[:5],
        reasoning=f"Net {'bullish' if net > 0 else 'bearish'}: ${abs(net):,.0f} ({confidence:.0%} conf) from {len(trades)} trades",
        timestamp=datetime.utcnow(),
    )
