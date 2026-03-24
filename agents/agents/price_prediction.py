"""Price Prediction Agent — generates BTC price predictions from sentiment + price data."""

from __future__ import annotations

from datetime import datetime, timedelta

from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.run import RunContext

from agents.config import PREDICTION_MODEL
from agents.tools.binance_price import get_btc_price


def _parse_model_id(model_str: str) -> str:
    return model_str.split(":", 1)[1] if ":" in model_str else model_str


async def fetch_current_price(run_context: RunContext) -> str:
    """Fetch the current BTC/USDT price from Binance.

    Returns the current price as a string.
    """
    price = await get_btc_price()
    run_context.session_state["current_btc_price"] = price
    return f"Current BTC price: ${price:,.2f}"


async def make_prediction(
    run_context: RunContext,
    direction: str,
    confidence: str,
    predicted_price: str,
    minutes_ahead: str,
    reasoning: str,
) -> str:
    """Record a BTC price prediction.

    Args:
        direction: "up", "down", or "neutral"
        confidence: confidence score 0.0-1.0 (as string)
        predicted_price: predicted BTC price (as string)
        minutes_ahead: how many minutes in the future (as string)
        reasoning: brief reasoning for the prediction
    """
    current = run_context.session_state.get("current_btc_price", 0)
    target_time = datetime.utcnow() + timedelta(minutes=int(minutes_ahead))

    prediction = {
        "direction": direction,
        "confidence": float(confidence),
        "predicted_price": float(predicted_price),
        "current_price": current,
        "target_time": target_time.isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "reasoning": reasoning,
    }

    run_context.session_state["latest_prediction"] = prediction
    run_context.session_state.setdefault("prediction_count", 0)
    run_context.session_state["prediction_count"] += 1

    return (
        f"Prediction recorded:\n"
        f"- Direction: {direction.upper()}\n"
        f"- Confidence: {float(confidence):.0%}\n"
        f"- Predicted price: ${float(predicted_price):,.2f}\n"
        f"- Target time: {target_time.strftime('%H:%M UTC')} ({minutes_ahead}m ahead)\n"
        f"- Current price: ${current:,.2f}\n"
        f"- Reasoning: {reasoning}"
    )


def create_prediction_agent() -> Agent:
    """Create the price prediction agent."""
    model_id = _parse_model_id(PREDICTION_MODEL)

    return Agent(
        name="PricePrediction",
        model=Claude(id=model_id),
        tools=[fetch_current_price, make_prediction],
        session_state={
            "latest_sentiment": None,
            "latest_prediction": None,
            "current_btc_price": 0,
            "prediction_count": 0,
        },
        instructions=(
            "You are a BTC price prediction agent. You receive whale sentiment data from "
            "Polymarket prediction markets and use it along with the current BTC price to "
            "make short-term price predictions.\n\n"
            "When given sentiment data:\n"
            "1. First call fetch_current_price to get the latest BTC price\n"
            "2. Analyze the sentiment direction and confidence\n"
            "3. Make a prediction using make_prediction with:\n"
            "   - direction: up/down/neutral\n"
            "   - confidence: 0.0-1.0 based on sentiment strength\n"
            "   - predicted_price: your best estimate\n"
            "   - minutes_ahead: 15-60 depending on sentiment clarity\n"
            "   - reasoning: brief explanation\n\n"
            "Be conservative — adjust confidence based on sentiment quality.\n"
            "If sentiment is weak or neutral, predict neutral with low confidence.\n\n"
            "Current sentiment: {latest_sentiment}\n"
            "Last prediction: {latest_prediction}"
        ),
        markdown=True,
    )
