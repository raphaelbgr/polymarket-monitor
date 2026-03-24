"""Shared SQLite database instance for agno agent storage."""

import os
from agno.storage.sqlite import SqliteStorage

from agents.config import DB_PATH

# Ensure data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Shared storage instance — all agents use this for session persistence
agent_storage = SqliteStorage(
    table_name="agent_sessions",
    db_file=DB_PATH,
)
