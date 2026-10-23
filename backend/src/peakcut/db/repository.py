"""All SQL access in one place. The API uses the read methods on a read-only connection."""
from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import duckdb
import numpy as np
import pandas as pd

from peakcut.data.common import VideoRecord
from peakcut.features.cache import load_features

from .loader import insert_df, read_sql


class Repository:
    def __init__(self, con: duckdb.DuckDBPyConnection):
        self.con = con

    # ---------- helpers ----------
    def _rows(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        cur = self.con.execute(sql, list(params or []))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

    def run_sql_file(self, name: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        return self._rows(read_sql(name), params)

    # ---------- videos ----------
    def list_videos(self) -> list[dict[str, Any]]:
        return self._rows(
            "SELECT video_id, dataset, category, duration_sec, n_samples, sample_rate, "
            "(media_path IS NOT NULL) AS has_media FROM videos ORDER BY video_id"
        )

    def get_video(self, video_id: str) -> dict[str, Any] | None:
        rows = self._rows(
            "SELECT v.*, a.mean_corr AS agreement, a.n_pairs, a.high_disagreement "
            "FROM videos v LEFT JOIN annotator_agreement a USING (video_id) WHERE v.video_id = ?",
            [video_id],
        )
        return rows[0] if rows else None

    def get_annotator_scores(self, video_id: str) -> dict[str, list[float]]:
        out: dict[str, list[float]] = {}
        for aid, score in self.con.execute(
            "SELECT annotator_id, score FROM annotations WHERE video_id = ? "
            "ORDER BY annotator_id, frame_idx",
            [video_id],
        ).fetchall():
            out.setdefault(str(aid), []).append(score)
        return out

    def load_records(self, video_ids: Sequence[str] | None = None) -> list[VideoRecord]:
        """Rebuild VideoRecords (features from disk, annotations and segments from the DB)."""
        vids = self._rows("SELECT * FROM videos ORDER BY video_id")
        records = []
        for v in vids:
            if video_ids is not None and v["video_id"] not in video_ids:
                continue
            vid = v["video_id"]
            scores = self.get_annotator_scores(vid)
            segs = np.array(
                self.con.execute(
                    "SELECT start_idx, end_idx FROM segments WHERE video_id = ? ORDER BY seg_idx", [vid]
                ).fetchall(),
                dtype=np.int64,
            )
            records.append(
                VideoRecord(
                    video_id=vid,
                    dataset=v["dataset"],
                    category=v["category"],
                    features=load_features(v["feature_path"]),
                    user_scores=np.array([scores[k] for k in sorted(scores, key=int)], dtype=np.float32),
                    change_points=segs,
                    duration_sec=v["duration_sec"],
                    fps=v["fps"],
                    n_frames=v["n_frames"],
                    media_path=v["media_path"],
                    feature_path=v["feature_path"],
                )
            )
        return records

    # ---------- experiments ----------
    def save_experiment(
        self, run_id: str, framework: str, loss: str | None, label_noise: float, seed: int, config: dict
    ) -> None:
        """Create/replace a run and delete its previous predictions, metrics and highlights."""
        for table in ("predictions", "metrics", "highlights"):
            self.con.execute(f"DELETE FROM {table} WHERE run_id = ?", [run_id])
        self.con.execute("DELETE FROM experiments WHERE run_id = ?", [run_id])
        self.con.execute(
            "INSERT INTO experiments (run_id, framework, loss, label_noise, seed, config_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [run_id, framework, loss, label_noise, seed, json.dumps(config, default=str)],
        )

    def save_predictions(self, run_id: str, scores_by_id: dict[str, np.ndarray]) -> None:
        frames = [
            pd.DataFrame(
                {
                    "run_id": run_id,
                    "video_id": vid,
                    "frame_idx": np.arange(len(s), dtype=np.int32),
                    "score": np.asarray(s, dtype=np.float64),
                }
            )
            for vid, s in scores_by_id.items()
        ]
        insert_df(self.con, "predictions", pd.concat(frames, ignore_index=True))

    def save_metrics(self, rows: Sequence[tuple[str, str, str, float, float]]) -> None:
        df = pd.DataFrame(rows, columns=["run_id", "scope", "scope_id", "f1", "map"])
        insert_df(self.con, "metrics", df)

    def save_highlights(self, rows: Sequence[tuple]) -> None:
        """rows: (highlight_id, run_id, video_id, start_sec, end_sec, start_idx, end_idx, score)"""
        cols = ["highlight_id", "run_id", "video_id", "start_sec", "end_sec", "start_idx", "end_idx", "score"]
        insert_df(self.con, "highlights", pd.DataFrame(rows, columns=cols))

    def get_predictions(self, run_id: str, video_id: str) -> list[float]:
        return [
            r[0]
            for r in self.con.execute(
                "SELECT score FROM predictions WHERE run_id = ? AND video_id = ? ORDER BY frame_idx",
                [run_id, video_id],
            ).fetchall()
        ]

    def get_highlights(self, run_id: str, video_id: str) -> list[dict[str, Any]]:
        return self._rows(
            "SELECT highlight_id, start_sec, end_sec, start_idx, end_idx, score FROM highlights "
            "WHERE run_id = ? AND video_id = ? ORDER BY start_idx",
            [run_id, video_id],
        )

    def list_highlights(self, run_id: str) -> list[dict[str, Any]]:
        return self._rows(
            "SELECT highlight_id, video_id, start_sec, end_sec, start_idx, end_idx, score "
            "FROM highlights WHERE run_id = ? ORDER BY video_id, start_idx",
            [run_id],
        )

    def best_run_id(self) -> str | None:
        """Best clean (no injected noise) run with stored highlights, by overall F1."""
        rows = self._rows(
            "SELECT e.run_id FROM experiments e JOIN metrics m "
            "ON m.run_id = e.run_id AND m.scope = 'overall' "
            "WHERE e.label_noise = 0 AND EXISTS (SELECT 1 FROM highlights h WHERE h.run_id = e.run_id) "
            "ORDER BY m.f1 DESC, m.map DESC, e.run_id LIMIT 1"
        )
        return rows[0]["run_id"] if rows else None

    def run_exists(self, run_id: str) -> bool:
        return bool(self.con.execute("SELECT 1 FROM experiments WHERE run_id = ?", [run_id]).fetchall())

    def leaderboard(self) -> list[dict[str, Any]]:
        return self.run_sql_file("leaderboard.sql")

    def run_metrics(self, run_id: str) -> dict[str, Any] | None:
        overall = self._rows(
            "SELECT f1, map FROM metrics WHERE run_id = ? AND scope = 'overall'", [run_id]
        )
        if not overall:
            return None
        return {
            "overall": overall[0],
            "by_category": self.run_sql_file("per_category_metrics.sql", [run_id]),
        }

    # ---------- summaries ----------
    def save_summary(self, highlight_id: str, variant: str, model: str, title: str, summary: str) -> None:
        self.con.execute(
            "INSERT OR REPLACE INTO summaries VALUES (?, ?, ?, ?, ?)",
            [highlight_id, variant, model, title, summary],
        )

    def save_llm_eval(
        self,
        highlight_id: str,
        variant: str,
        faithfulness: float | None,
        informativeness: float | None,
        hallucinated: bool,
        human_score: float | None = None,
    ) -> None:
        self.con.execute(
            "INSERT OR REPLACE INTO llm_eval VALUES (?, ?, ?, ?, ?, ?)",
            [highlight_id, variant, faithfulness, informativeness, hallucinated, human_score],
        )

    def get_summaries(self, highlight_ids: Sequence[str]) -> list[dict[str, Any]]:
        return self._rows(
            "SELECT highlight_id, prompt_variant, llm_model, title, summary FROM summaries "
            "WHERE highlight_id IN (SELECT UNNEST(?)) ORDER BY highlight_id, prompt_variant",
            [list(highlight_ids)],
        )

    def llm_eval_summary(self) -> list[dict[str, Any]]:
        return self._rows(
            "SELECT prompt_variant, count(*) AS n, avg(faithfulness) AS faithfulness, "
            "avg(informativeness) AS informativeness, avg(CAST(hallucinated AS INT)) AS hallucination_rate "
            "FROM llm_eval GROUP BY prompt_variant ORDER BY prompt_variant"
        )


def media_file(repo: Repository, video_id: str) -> Path | None:
    rows = repo.con.execute("SELECT media_path FROM videos WHERE video_id = ?", [video_id]).fetchall()
    return Path(rows[0][0]) if rows and rows[0][0] else None
