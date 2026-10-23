"""Cross-validated PyTorch training; stores predictions, metrics and highlights in the DB."""
from pathlib import Path

from _common import base_parser, cfg_from
from peakcut.db.connection import connect
from peakcut.db.repository import Repository
from peakcut.eval.runner import persist_run

p = base_parser(__doc__)
p.add_argument("--loss", choices=["bce", "ranking", "contrastive"])
p.add_argument("--label-noise", type=float)
p.add_argument("--seed", type=int)
p.add_argument("--epochs", type=int)
p.add_argument("--folds", type=int)
p.add_argument("--relabel", action="store_true", help="confident-learning relabelling of training labels")
p.add_argument("--save-final", metavar="PATH", help="also train on all videos and save a checkpoint")
args = p.parse_args()
cfg = cfg_from(args)
for k in ("loss", "label_noise", "epochs", "folds"):
    if getattr(args, k) is not None:
        setattr(cfg.train, k, getattr(args, k))
if args.seed is not None:
    cfg.seed = args.seed

from peakcut.training.trainer import build_targets, cross_validate, save_checkpoint, train_model  # noqa: E402

con = connect(cfg.paths.db_path)
repo = Repository(con)
records = repo.load_records()
tc = cfg.train
run_id = f"pytorch_{tc.loss}_n{tc.label_noise}_s{cfg.seed}" + ("_cl" if args.relabel else "")
scores = cross_validate(records, cfg, use_relabel=args.relabel)
res = persist_run(repo, run_id, "pytorch", tc.loss, tc.label_noise, cfg.seed, cfg.to_dict(),
                  records, scores, cfg.evaluation)
print(f"{run_id}: F1={res['overall']['f1']:.3f} mAP={res['overall']['map']:.3f}")
if args.save_final:
    model = train_model(records, build_targets(records, cfg, tc.label_noise), cfg)
    save_checkpoint(model, Path(args.save_final))
    print("saved", args.save_final)
