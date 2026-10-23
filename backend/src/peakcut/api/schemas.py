"""Pydantic request/response models."""
from __future__ import annotations

from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str
    db: bool
    upload_ready: bool


class VideoItem(BaseModel):
    video_id: str
    dataset: str
    category: str | None = None
    duration_sec: float
    n_samples: int
    sample_rate: float
    has_media: bool


class VideoDetail(BaseModel):
    video_id: str
    dataset: str
    category: str | None = None
    duration_sec: float
    n_samples: int
    sample_rate: float
    agreement: float | None = None
    high_disagreement: bool | None = None
    annotator_scores: dict[str, list[float]]


class HighlightOut(BaseModel):
    highlight_id: str
    start_sec: float
    end_sec: float
    start_idx: int
    end_idx: int
    score: float


class HighlightsRequest(BaseModel):
    video_id: str
    run_id: str | None = None


class HighlightsResponse(BaseModel):
    video_id: str
    run_id: str
    sample_rate: float
    scores: list[float]
    highlights: list[HighlightOut]


class SummariesRequest(BaseModel):
    highlight_ids: list[str] = Field(min_length=1, max_length=500)
    prompt_variant: str | None = None


class SummaryOut(BaseModel):
    highlight_id: str
    prompt_variant: str
    llm_model: str
    title: str
    summary: str


class ExperimentRow(BaseModel):
    run_id: str
    framework: str | None = None
    loss: str | None = None
    label_noise: float | None = None
    seed: int | None = None
    f1: float
    map: float


class MetricPair(BaseModel):
    f1: float
    map: float


class CategoryMetric(BaseModel):
    category: str | None = None
    f1: float
    map: float
    n_videos: int


class RunMetrics(BaseModel):
    overall: MetricPair
    by_category: list[CategoryMetric]
