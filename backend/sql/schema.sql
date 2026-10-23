-- Peakcut schema (DuckDB). No FOREIGN KEY constraints on purpose: DuckDB cannot
-- delete/replace a parent row that children reference, which breaks re-running an
-- experiment. Referential integrity is checked in tests/test_db.py instead.

CREATE TABLE IF NOT EXISTS videos (
  video_id     TEXT PRIMARY KEY,
  dataset      TEXT NOT NULL,          -- 'tvsum' | 'summe' | 'synthetic'
  category     TEXT,
  duration_sec DOUBLE,
  fps          DOUBLE,                 -- original video fps
  n_frames     INTEGER,                -- original frame count
  n_samples    INTEGER,                -- number of sampled frames (feature rows)
  sample_rate  DOUBLE,                 -- samples per second = n_samples / duration_sec
  feature_path TEXT,
  media_path   TEXT
);

CREATE TABLE IF NOT EXISTS segments (
  video_id  TEXT,
  seg_idx   INTEGER,
  start_idx INTEGER,                   -- inclusive, in sampled-frame index
  end_idx   INTEGER,                   -- inclusive
  PRIMARY KEY (video_id, seg_idx)
);

CREATE TABLE IF NOT EXISTS annotations (
  video_id     TEXT,
  annotator_id INTEGER,
  frame_idx    INTEGER,                -- sampled-frame index
  score        DOUBLE,
  PRIMARY KEY (video_id, annotator_id, frame_idx)
);

CREATE TABLE IF NOT EXISTS annotator_agreement (
  video_id          TEXT PRIMARY KEY,
  mean_corr         DOUBLE,            -- mean pairwise Pearson correlation between annotators
  n_pairs           INTEGER,
  high_disagreement BOOLEAN            -- bottom quartile within its dataset
);

CREATE TABLE IF NOT EXISTS experiments (
  run_id       TEXT PRIMARY KEY,
  framework    TEXT,                   -- 'pytorch' | 'jax' | 'kmeans'
  loss         TEXT,                   -- 'bce' | 'ranking' | 'contrastive' | NULL
  label_noise  DOUBLE DEFAULT 0,
  seed         INTEGER,
  config_json  TEXT,
  created_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS predictions (
  run_id    TEXT,
  video_id  TEXT,
  frame_idx INTEGER,
  score     DOUBLE,
  PRIMARY KEY (run_id, video_id, frame_idx)
);

CREATE TABLE IF NOT EXISTS metrics (
  run_id   TEXT,
  scope    TEXT,                       -- 'overall' | 'category' | 'video'
  scope_id TEXT,                       -- '' | category name | video_id
  f1       DOUBLE,
  map      DOUBLE,
  PRIMARY KEY (run_id, scope, scope_id)
);

CREATE TABLE IF NOT EXISTS highlights (
  highlight_id TEXT PRIMARY KEY,       -- '<run_id>:<video_id>:<k>'
  run_id       TEXT,
  video_id     TEXT,
  start_sec    DOUBLE,
  end_sec      DOUBLE,
  start_idx    INTEGER,
  end_idx      INTEGER,
  score        DOUBLE
);

CREATE TABLE IF NOT EXISTS summaries (
  highlight_id   TEXT,
  prompt_variant TEXT,                 -- 'captions' | 'captions+asr' | 'few_shot'
  llm_model      TEXT,
  title          TEXT,
  summary        TEXT,
  PRIMARY KEY (highlight_id, prompt_variant)
);

CREATE TABLE IF NOT EXISTS llm_eval (
  highlight_id    TEXT,
  prompt_variant  TEXT,
  faithfulness    DOUBLE,
  informativeness DOUBLE,
  hallucinated    BOOLEAN,
  human_score     DOUBLE,
  PRIMARY KEY (highlight_id, prompt_variant)
);
