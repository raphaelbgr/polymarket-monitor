"""Market Analysis Agent — fetches whale trades and computes sentiment."""

from __future__ import annotations

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.run import RunContext

from agents.config import ANALYSIS_MODEL
from agents.tools.polymarket_feed import fetch_whale_trades
from agents.tools.sentiment import compute_sentiment


def _parse_model_id(model_str: str) -> str:
    """Extract model ID from 'provider:model_id' format."""
    return model_str.split(":", 1)[1] if ":" in model_str else model_str


async def analyze_whale_trades(run_context: RunContext) -> str:
    """Fetch recent whale trades on BTC markets and compute sentiment.

    Returns a summary of whale activity and directional sentiment.
    """
    trades = await fetch_whale_trades(tags="btc", limit=50)

    if not trades:
        run_context.session_state["latest_sentiment"] = None
        return "No BTC whale trades found in the current window."

    sentiment = compute_sentiment(trades)
    run_context.session_state["latest_sentiment"] = sentiment.model_dump(mode="json")

    return (
        f"Whale Sentiment Analysis:\n"
        f"- Direction: {sentiment.direction.value.upper()}\n"
        f"- Confidence: {sentiment.confidence:.0%}\n"
        f"- Bullish volume: ${sentiment.bullish_volume:,.0f}\n"
        f"- Bearish volume: ${sentiment.bearish_volume:,.0f}\n"
        f"- Trades analyzed: {sentiment.num_trades}\n"
        f"- Top wallets: {', '.join(sentiment.dominant_wallets)}\n"
        f"- Reasoning: {sentiment.reasoning}"
    )


def create_analysis_agent() -> Agent:
    """Create the market analysis agent."""
    model_id = _parse_model_id(ANALYSIS_MODEL)

    return Agent(
        name="MarketAnalysis",
        model=OpenAIChat(id=model_id),
        tools=[analyze_whale_trades],
        session_state={
            "latest_sentiment": None,
        },
        instructions=(
            "You are a crypto market analyst. Your job is to analyze whale trading activity "
            "on Polymarket BTC prediction markets and summarize the sentiment.\n\n"
            "When asked to analyze, call the analyze_whale_trades tool. "
            "Summarize the key findings concisely.\n\n"
            "Current sentiment: {latest_sentiment}"
        ),
        markdown=True,
    )
