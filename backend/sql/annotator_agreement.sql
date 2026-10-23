-- Mean pairwise Pearson correlation between annotators per video; bottom quartile
-- within each dataset is flagged as high disagreement.
INSERT OR REPLACE INTO annotator_agreement
WITH pairs AS (
  SELECT a.video_id, corr(a.score, b.score) AS r
  FROM annotations a
  JOIN annotations b
    ON a.video_id = b.video_id AND a.frame_idx = b.frame_idx AND a.annotator_id < b.annotator_id
  GROUP BY a.video_id, a.annotator_id, b.annotator_id
),
per_video AS (
  SELECT p.video_id, v.dataset, avg(p.r) AS mean_corr, count(p.r) AS n_pairs
  FROM pairs p JOIN videos v ON v.video_id = p.video_id
  WHERE p.r IS NOT NULL AND isfinite(p.r)
  GROUP BY p.video_id, v.dataset
)
SELECT video_id,
       mean_corr,
       CAST(n_pairs AS INTEGER),
       mean_corr < quantile_cont(mean_corr, 0.25) OVER (PARTITION BY dataset)
FROM per_video;
