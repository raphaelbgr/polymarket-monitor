"""Session management endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from agents.orchestrator.loop import get_active_session, set_active_session
from agents.tools.prediction_store import prediction_store
from agents.tools.paper_trading import paper_trader

router = APIRouter(prefix="/sessions")

# In-memory session registry
_sessions: dict[str, dict] = {}


def _ensure_default():
    if "default" not in _sessions:
        _sessions["default"] = {
            "id": "default",
            "name": "Default Session",
            "created_at": datetime.utcnow().isoformat(),
        }


class CreateSessionRequest(BaseModel):
    name: str = "New Session"


@router.get("")
async def list_sessions():
    _ensure_default()
    active = get_active_session()
    sessions = []
    for sid, s in _sessions.items():
        accuracy = prediction_store.accuracy(sid)
        sessions.append({
            **s,
            "is_active": sid == active,
            "prediction_count": accuracy["total"],
            "accuracy": accuracy["accuracy"],
        })
    return {"sessions": sessions, "active_session_id": active}


@router.post("")
async def create_session(req: CreateSessionRequest):
    sid = str(uuid.uuid4())[:8]
    _sessions[sid] = {
        "id": sid,
        "name": req.name,
        "created_at": datetime.utcnow().isoformat(),
    }
    return _sessions[sid]


@router.put("/{session_id}/select")
async def select_session(session_id: str):
    _ensure_default()
    if session_id not in _sessions:
        return {"error": "Session not found"}, 404
    set_active_session(session_id)
    return {"active_session_id": session_id}


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    if session_id == "default":
        return {"error": "Cannot delete default session"}, 400
    if session_id in _sessions:
        del _sessions[session_id]
        prediction_store.clear_session(session_id)
        paper_trader.clear_session(session_id)
        if get_active_session() == session_id:
            set_active_session("default")
    return {"deleted": True}


@router.post("/{session_id}/reset")
async def reset_session(session_id: str):
    _ensure_default()
    if session_id not in _sessions:
        return {"error": "Session not found"}, 404
    prediction_store.clear_session(session_id)
    paper_trader.clear_session(session_id)
    return {"reset": True, "session_id": session_id}
