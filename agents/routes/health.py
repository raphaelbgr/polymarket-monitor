"""Health check endpoint."""

from fastapi import APIRouter

from agents.orchestrator.loop import is_running, get_active_session
from agents.sse.broadcaster import broadcaster

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "loop_running": is_running(),
        "active_session": get_active_session(),
        "sse_subscribers": broadcaster.subscriber_count,
    }
