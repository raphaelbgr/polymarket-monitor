"""FastAPI agent service — entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.config import PORT, HOST
from agents.orchestrator.loop import start_loop, stop_loop
from agents.routes import health, predictions, sessions, activity, trading

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the prediction loop on startup, stop on shutdown."""
    logger.info(f"Agent service starting on {HOST}:{PORT}")
    start_loop()
    yield
    logger.info("Agent service shutting down")
    stop_loop()


app = FastAPI(
    title="Polymarket AI Agent Service",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3440", "http://127.0.0.1:3440"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes under /api
app.include_router(health.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(trading.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("agents.main:app", host=HOST, port=PORT, reload=True)
