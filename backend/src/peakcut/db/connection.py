"""DuckDB connections. Scripts open read-write; the API opens read-only."""
from __future__ import annotations

from pathlib import Path

import duckdb


def connect(db_path: str | Path, read_only: bool = False) -> duckdb.DuckDBPyConnection:
    path = Path(db_path)
    if read_only:
        if not path.exists():
            raise FileNotFoundError(f"Database not found: {path}. Run `make db` first.")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
    return duckdb.connect(str(path), read_only=read_only)
