"""Coordinator — runs the analysis → prediction → trading cycle."""

from __future__ import annotations

import uuid
import traceback
from datetime import datetime

from agents.agents.market_analysis import create_analysis_agent
from agents.agents.price_prediction import create_prediction_agent
from agents.agents.trading import create_trading_agent
from agents.models.prediction import AgentLogEntry, Prediction, Direction
from agents.tools.prediction_store import prediction_store
from agents.tools.paper_trading import paper_trader
from agents.sse.broadcaster import broadcaster


async def _log(session_id: str, agent: str, message: str, reasoning: str | None = None, level: str = "info", data: dict | None = None):
    """Publish a log entry via SSE."""
    entry = AgentLogEntry(
        id=str(uuid.uuid4())[:8],
        session_id=session_id,
        agent=agent,
        level=level,
        message=message,
        reasoning=reasoning,
        timestamp=datetime.utcnow(),
        data=data,
    )
    await broadcaster.publish("agent_log", entry.model_dump(mode="json"))
    return entry


async def run_cycle(session_id: str) -> dict | None:
    """Run one full analysis → prediction → trading cycle.

    Returns the prediction dict if one was made, or None.
    """
    # --- Step 1: Market Analysis ---
    await _log(session_id, "analysis", "Starting whale trade analysis...")

    analysis_agent = create_analysis_agent()
    try:
        response = await analysis_agent.arun(
            "Analyze the latest whale trades on BTC prediction markets.",
            session_id=f"{session_id}_analysis",
        )
        analysis_text = response.content if response else "No response"
        sentiment_data = analysis_agent.get_session_state().get("latest_sentiment")

        await _log(
            session_id, "analysis",
            f"Analysis complete: {sentiment_data.get('direction', 'unknown') if sentiment_data else 'no data'}",
            reasoning=analysis_text,
            data=sentiment_data,
        )
    except Exception as e:
        await _log(session_id, "analysis", f"Analysis failed: {e}", level="error", reasoning=traceback.format_exc())
        return None

    if not sentiment_data:
        await _log(session_id, "analysis", "No sentiment data — skipping prediction", level="warn")
        return None

    # --- Step 2: Price Prediction ---
    await _log(session_id, "prediction", "Generating BTC price prediction...")

    prediction_agent = create_prediction_agent()
    try:
        # Pass sentiment from analysis agent to prediction agent
        response = await prediction_agent.arun(
            f"Based on this whale sentiment, predict BTC price direction:\n{sentiment_data}",
            session_id=f"{session_id}_prediction",
            session_state={"latest_sentiment": sentiment_data},
        )
        pred_text = response.content if response else "No response"
        pred_data = prediction_agent.get_session_state().get("latest_prediction")

        if pred_data:
            # Store prediction
            prediction = Prediction(
                direction=Direction(pred_data["direction"]),
                confidence=pred_data["confidence"],
                predicted_price=pred_data["predicted_price"],
                current_price=pred_data["current_price"],
                target_time=datetime.fromisoformat(pred_data["target_time"]),
                reasoning=pred_data.get("reasoning", ""),
                sentiment=None,  # Stored separately
            )
            stored = prediction_store.add(session_id, prediction)
            pred_data["id"] = stored.id

            await broadcaster.publish("prediction", stored.model_dump(mode="json"))
            await _log(
                session_id, "prediction",
                f"Prediction: {stored.direction.value.upper()} {stored.confidence:.0%} → ${stored.predicted_price:,.0f}",
                reasoning=pred_text,
                data=pred_data,
            )
        else:
            await _log(session_id, "prediction", "No prediction generated", level="warn", reasoning=pred_text)
            return None

    except Exception as e:
        await _log(session_id, "prediction", f"Prediction failed: {e}", level="error", reasoning=traceback.format_exc())
        return None

    # --- Step 3: Trading ---
    await _log(session_id, "trading", "Evaluating trading action...")

    trading_agent = create_trading_agent()
    try:
        response = await trading_agent.arun(
            f"Based on this prediction, decide whether to trade:\n{pred_data}",
            session_id=f"{session_id}_trading",
            session_state={
                "session_id": session_id,
                "latest_prediction": pred_data,
            },
        )
        trade_text = response.content if response else "No response"

        # Update paper positions with current price
        if pred_data.get("current_price"):
            paper_trader.update_prices(session_id, pred_data["current_price"])

        await _log(
            session_id, "trading",
            "Trading evaluation complete",
            reasoning=trade_text,
            data={
                "open_positions": len(paper_trader.get_open_positions(session_id)),
                "balance": paper_trader.get_balance(session_id),
            },
        )
    except Exception as e:
        await _log(session_id, "trading", f"Trading failed: {e}", level="error", reasoning=traceback.format_exc())

    return pred_data
