"""Create the schema and bulk-load videos, segments and annotations."""
from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from peakcut.data.common import VideoRecord
from peakcut.features.cache import save_features

from .connection import connect

SQL_DIR = Path(os.environ.get("PEAKCUT_SQL_DIR", Path(__file__).resolve().parents[3] / "sql"))


def read_sql(name: str) -> str:
    return (SQL_DIR / name).read_text()


def init_schema(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(read_sql("schema.sql"))


def _insert_df(con: duckdb.DuckDBPyConnection, table: str, df: pd.DataFrame) -> None:
    con.register("_tmp_df", df)
    try:
        con.execute(f"INSERT INTO {table} SELECT * FROM _tmp_df")
    finally:
        con.unregister("_tmp_df")


def insert_df(con: duckdb.DuckDBPyConnection, table: str, df: pd.DataFrame) -> None:
    """Public bulk insert (column order must match the table)."""
    _insert_df(con, table, df)


def load_records(con: duckdb.DuckDBPyConnection, records: Sequence[VideoRecord]) -> None:
    """Insert videos, segments and annotations, replacing existing rows for those ids."""
    if not records:
        return
    ids = [r.video_id for r in records]
    for table in ("annotations", "segments", "videos"):
        con.execute(f"DELETE FROM {table} WHERE video_id IN (SELECT UNNEST(?))", [ids])

    videos = pd.DataFrame(
        {
            "video_id": ids,
            "dataset": [r.dataset for r in records],
            "category": [r.category for r in records],
            "duration_sec": [float(r.duration_sec) for r in records],
            "fps": [float(r.fps) for r in records],
            "n_frames": [int(r.n_frames) for r in records],
            "n_samples": [int(r.n_samples) for r in records],
            "sample_rate": [float(r.sample_rate) for r in records],
            "feature_path": [r.feature_path for r in records],
            "media_path": [r.media_path for r in records],
        }
    )
    _insert_df(con, "videos", videos)

    seg_rows, ann_frames = [], []
    for r in records:
        for k, (s, e) in enumerate(np.asarray(r.change_points)):
            seg_rows.append((r.video_id, k, int(s), int(e)))
        u, t = r.user_scores.shape
        ann_frames.append(
            pd.DataFrame(
                {
                    "video_id": r.video_id,
                    "annotator_id": np.repeat(np.arange(u), t).astype(np.int32),
                    "frame_idx": np.tile(np.arange(t), u).astype(np.int32),
                    "score": r.user_scores.reshape(-1).astype(np.float64),
                }
            )
        )
    _insert_df(con, "segments", pd.DataFrame(seg_rows, columns=["video_id", "seg_idx", "start_idx", "end_idx"]))
    _insert_df(con, "annotations", pd.concat(ann_frames, ignore_index=True))


def compute_agreement(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("DELETE FROM annotator_agreement")
    con.execute(read_sql("annotator_agreement.sql"))


def build_database(
    db_path: str | Path,
    records: Sequence[VideoRecord],
    features_dir: str | Path | None = None,
    reset: bool = True,
) -> None:
    """Write features to disk (if features_dir is given), then (re)build the database."""
    path = Path(db_path)
    if reset and path.exists():
        path.unlink()
    if features_dir is not None:
        for r in records:
            r.feature_path = str(save_features(Path(features_dir) / f"{r.video_id}.npy", r.features))
    con = connect(path)
    try:
        init_schema(con)
        load_records(con, records)
        compute_agreement(con)
    finally:
        con.close()
