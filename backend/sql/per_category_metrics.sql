-- Parameter: run_id. Per-category F1 / mAP recomputed from per-video rows.
SELECT v.category AS category,
       avg(m.f1)  AS f1,
       avg(m.map) AS map,
       count(*)   AS n_videos
FROM metrics m
JOIN videos v ON m.scope = 'video' AND m.scope_id = v.video_id
WHERE m.run_id = ?
GROUP BY v.category
ORDER BY v.category;
