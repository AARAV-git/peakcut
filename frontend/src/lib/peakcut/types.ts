// Peakcut — shared API types. These mirror the FastAPI response shapes
// described in the backend contract so swapping the mock client for a real
// fetch wrapper is a 1:1 change.

export type Dataset = "tvsum" | "summe";

export type HealthStatus = {
  status: "ok" | "degraded" | "down";
  model_loaded: boolean;
  db_reachable: boolean;
  version: string;
  uptime_sec: number;
};

export type VideoMeta = {
  video_id: string;
  dataset: Dataset;
  category: string;
  duration_sec: number;
  title: string;
  source: string;
};

export type Highlight = {
  highlight_id: string;
  start_sec: number;
  end_sec: number;
  score: number;
  rank: number;
};

export type HighlightsResponse = {
  video_id: string;
  run_id: string;
  fps: number;
  duration_sec: number;
  scores: number[];
  highlights: Highlight[];
  budget_ratio: number;
  processing_ms: number;
};

export type Summary = {
  highlight_id: string;
  title: string;
  summary: string;
  tags: string[];
};

export type ExperimentRun = {
  run_id: string;
  framework: "pytorch" | "tensorflow";
  loss: "ranking" | "triplet" | "mse" | "contrastive" | "knn";
  backbone: string;
  f1: number;
  map: number;
  precision: number;
  recall: number;
  trained_at: string;
  epochs: number;
  params_m: number;
  note?: string;
};

export type CategoryMetric = {
  category: string;
  n_videos: number;
  f1: number;
  map: number;
};

export type RunMetrics = {
  run_id: string;
  overall: { f1: number; map: number; precision: number; recall: number };
  by_category: CategoryMetric[];
};

export type AnnotatorAgreement = {
  video_id: string;
  category: string;
  duration_sec: number;
  agreement: number;
  high_disagreement: boolean;
  n_annotators: number;
  annotator_scores: Record<string, number[]>;
  model_scores: number[];
  fps: number;
  mean_correlation: number;
  variance: number;
};

export type AnalysisTab = "analyze" | "result" | "experiments" | "annotators";

export type PipelineStage = {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
};
