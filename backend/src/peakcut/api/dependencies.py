"""FastAPI dependencies: a per-request repository on the shared read-only connection."""
from __future__ import annotations

from fastapi import Request

from peakcut.db.repository import Repository


def get_repo(request: Request) -> Repository:
    # A DuckDB cursor per request keeps concurrent threadpool calls safe.
    return Repository(request.app.state.con.cursor())
