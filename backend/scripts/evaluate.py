"""Run the unsupervised k-means baseline, then print the leaderboard."""
from _common import base_parser, cfg_from
from peakcut.db.connection import connect
from peakcut.db.repository import Repository
from peakcut.eval.runner import persist_run
from peakcut.models.kmeans_baseline import kmeans_scores

p = base_parser(__doc__)
p.add_argument("--method", choices=["kmeans", "none"], default="kmeans")
args = p.parse_args()
cfg = cfg_from(args)
con = connect(cfg.paths.db_path)
repo = Repository(con)
if args.method == "kmeans":
    records = repo.load_records()
    scores = {r.video_id: kmeans_scores(r.features, seed=cfg.seed) for r in records}
    persist_run(repo, f"kmeans_s{cfg.seed}", "kmeans", None, 0.0, cfg.seed, cfg.to_dict(),
                records, scores, cfg.evaluation)
for row in repo.leaderboard():
    print(f"{row['run_id']:<40} F1={row['f1']:.3f} mAP={row['map']:.3f}")
