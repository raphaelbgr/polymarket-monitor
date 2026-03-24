"""In-memory prediction store with session scoping."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from agents.models.prediction import Prediction


class PredictionStore:
    """Stores predictions per session, tracks resolution."""

    def __init__(self) -> None:
        self._predictions: dict[str, list[Prediction]] = {}  # session_id -> list

    def add(self, session_id: str, prediction: Prediction) -> Prediction:
        """Add a prediction to the store."""
        prediction.id = str(uuid.uuid4())[:8]
        prediction.session_id = session_id
        if session_id not in self._predictions:
            self._predictions[session_id] = []
        self._predictions[session_id].append(prediction)
        return prediction

    def get_latest(self, session_id: str) -> Optional[Prediction]:
        """Get the most recent prediction for a session."""
        preds = self._predictions.get(session_id, [])
        return preds[-1] if preds else None

    def get_history(self, session_id: str, limit: int = 50) -> list[Prediction]:
        """Get prediction history for a session."""
        preds = self._predictions.get(session_id, [])
        return list(reversed(preds[-limit:]))

    def get_unresolved(self, session_id: str) -> list[Prediction]:
        """Get unresolved predictions."""
        return [p for p in self._predictions.get(session_id, []) if not p.resolved]

    def resolve(self, prediction_id: str, actual_price: float) -> Optional[Prediction]:
        """Resolve a prediction with the actual price."""
        for preds in self._predictions.values():
            for p in preds:
                if p.id == prediction_id and not p.resolved:
                    p.resolved = True
                    p.actual_price = actual_price
                    p.resolved_at = datetime.utcnow()
                    if p.direction.value == "up":
                        p.was_correct = actual_price >= p.predicted_price
                    elif p.direction.value == "down":
                        p.was_correct = actual_price <= p.predicted_price
                    else:
                        p.was_correct = abs(actual_price - p.predicted_price) / p.predicted_price < 0.005
                    return p
        return None

    def accuracy(self, session_id: str) -> dict:
        """Compute accuracy stats for a session."""
        preds = [p for p in self._predictions.get(session_id, []) if p.resolved]
        if not preds:
            return {"total": 0, "correct": 0, "accuracy": 0.0}
        correct = sum(1 for p in preds if p.was_correct)
        return {
            "total": len(preds),
            "correct": correct,
            "accuracy": correct / len(preds),
        }

    def clear_session(self, session_id: str) -> None:
        """Clear all predictions for a session."""
        self._predictions.pop(session_id, None)

    def all_sessions(self) -> list[str]:
        """List all session IDs with predictions."""
        return list(self._predictions.keys())


# Singleton
prediction_store = PredictionStore()
