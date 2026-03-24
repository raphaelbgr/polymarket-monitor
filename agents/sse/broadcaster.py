"""SSE event broadcaster — fan-out to all connected clients."""

from __future__ import annotations

import asyncio
import json
from typing import Any


class SSEBroadcaster:
    """Thread-safe fan-out broadcaster for SSE events."""

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue[str | None]] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[str | None]:
        """Create a new subscriber queue."""
        q: asyncio.Queue[str | None] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._queues.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[str | None]) -> None:
        """Remove a subscriber queue."""
        async with self._lock:
            self._queues = [x for x in self._queues if x is not q]

    async def publish(self, event_type: str, data: Any) -> None:
        """Publish an event to all subscribers."""
        payload = json.dumps(data) if not isinstance(data, str) else data
        message = f"event: {event_type}\ndata: {payload}\n\n"
        async with self._lock:
            dead: list[asyncio.Queue[str | None]] = []
            for q in self._queues:
                try:
                    q.put_nowait(message)
                except asyncio.QueueFull:
                    dead.append(q)
            # Remove dead/full queues
            if dead:
                self._queues = [x for x in self._queues if x not in dead]

    @property
    def subscriber_count(self) -> int:
        return len(self._queues)


# Singleton
broadcaster = SSEBroadcaster()
