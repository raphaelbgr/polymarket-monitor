"""Trading endpoints."""

from fastapi import APIRouter, Query

from agents.config import TRADING_MODE
from agents.tools.paper_trading import paper_trader
from agents.orchestrator.loop import get_active_session

router = APIRouter(prefix="/trading")


@router.get("/positions")
async def get_positions(session_id: str = Query(None)):
    sid = session_id or get_active_session()
    positions = paper_trader.get_all_positions(sid)
    return {
        "positions": [p.model_dump(mode="json") for p in positions],
        "balance": paper_trader.get_balance(sid),
        "total_pnl": paper_trader.get_total_pnl(sid),
        "mode": TRADING_MODE,
    }


@router.get("/config")
async def get_config():
    return {
        "mode": TRADING_MODE,
        "active_session": get_active_session(),
    }
