"""Background asyncio loop that runs prediction cycles at a configurable interval."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from agents.config import PREDICTION_INTERVAL_SEC
from agents.orchestrator.coordinator import run_cycle
from agents.tools.prediction_store import prediction_store
from agents.tools.binance_price import get_btc_price
from agents.sse.broadcaster import broadcaster

logger = logging.getLogger(__name__)

# Module-level state
_task: asyncio.Task | None = None
_active_session_id: str = "default"
_running = False


def set_active_session(session_id: str) -> None:
    global _active_session_id
    _active_session_id = session_id


def get_active_session() -> str:
    return _active_session_id


def is_running() -> bool:
    return _running


async def _resolve_expired_predictions() -> None:
    """Check and resolve predictions whose target time has passed."""
    session_id = _active_session_id
    unresolved = prediction_store.get_unresolved(session_id)

    for pred in unresolved:
        if datetime.utcnow() >= pred.target_time:
            try:
                actual_price = await get_btc_price()
                resolved = prediction_store.resolve(pred.id, actual_price)
                if resolved:
                    await broadcaster.publish("prediction_resolved", resolved.model_dump(mode="json"))
                    logger.info(
                        f"Resolved prediction {pred.id}: "
                        f"predicted=${pred.predicted_price:,.0f} actual=${actual_price:,.0f} "
                        f"correct={resolved.was_correct}"
                    )
            except Exception as e:
                logger.warning(f"Failed to resolve prediction {pred.id}: {e}")


async def _loop() -> None:
    """Main prediction loop."""
    global _running
    _running = True
    logger.info(f"Prediction loop started (interval={PREDICTION_INTERVAL_SEC}s)")

    while _running:
        try:
            session_id = _active_session_id
            logger.info(f"Running prediction cycle for session {session_id}")

            await run_cycle(session_id)
            await _resolve_expired_predictions()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Prediction loop error: {e}", exc_info=True)

        await asyncio.sleep(PREDICTION_INTERVAL_SEC)

    _running = False
    logger.info("Prediction loop stopped")


def start_loop() -> asyncio.Task:
    """Start the background prediction loop."""
    global _task
    if _task and not _task.done():
        return _task
    _task = asyncio.create_task(_loop())
    return _task


def stop_loop() -> None:
    """Stop the background prediction loop."""
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
    _task = None
