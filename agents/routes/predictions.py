"""Prediction endpoints."""

from fastapi import APIRouter, Query

from agents.tools.prediction_store import prediction_store
from agents.orchestrator.loop import get_active_session

router = APIRouter(prefix="/predictions")


@router.get("/latest")
async def get_latest(session_id: str = Query(None)):
    sid = session_id or get_active_session()
    pred = prediction_store.get_latest(sid)
    if not pred:
        return {"prediction": None}
    return {"prediction": pred.model_dump(mode="json")}


@router.get("/history")
async def get_history(session_id: str = Query(None), limit: int = Query(50)):
    sid = session_id or get_active_session()
    preds = prediction_store.get_history(sid, limit)
    return {"predictions": [p.model_dump(mode="json") for p in preds]}


@router.get("/accuracy")
async def get_accuracy(session_id: str = Query(None)):
    sid = session_id or get_active_session()
    return prediction_store.accuracy(sid)
