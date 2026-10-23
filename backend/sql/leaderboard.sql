-- All runs ranked by overall F1, then mAP.
SELECT e.run_id, e.framework, e.loss, e.label_noise, e.seed, m.f1, m.map
FROM experiments e
JOIN metrics m ON m.run_id = e.run_id AND m.scope = 'overall'
ORDER BY m.f1 DESC, m.map DESC, e.run_id;
