"""SSE activity stream endpoint."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request
from starlette.responses import StreamingResponse

from agents.sse.broadcaster import broadcaster

router = APIRouter()


@router.get("/activity/stream")
async def activity_stream(request: Request):
    """SSE endpoint that streams agent activity events."""
    queue = await broadcaster.subscribe()

    async def event_generator():
        try:
            # Send initial connection event
            yield "event: connected\ndata: {}\n\n"

            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    if message is None:
                        break
                    yield message
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield ": keepalive\n\n"

        finally:
            await broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
