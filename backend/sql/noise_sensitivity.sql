-- Parameter: framework. Metric vs injected label-noise level, per loss.
SELECT e.loss, e.label_noise,
       avg(m.f1) AS f1, avg(m.map) AS map, count(*) AS n_runs
FROM experiments e
JOIN metrics m ON m.run_id = e.run_id AND m.scope = 'overall'
WHERE e.framework = ?
GROUP BY e.loss, e.label_noise
ORDER BY e.loss, e.label_noise;
