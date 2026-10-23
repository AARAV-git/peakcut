"""Create the DuckDB database from synthetic data or TVSum/SumMe HDF5 files."""
from pathlib import Path

from _common import base_parser, cfg_from
from peakcut.data.summe import load_summe
from peakcut.data.synthetic import make_synthetic_dataset
from peakcut.data.tvsum import load_tvsum
from peakcut.db.loader import build_database

p = base_parser(__doc__)
p.add_argument("--source", choices=["synthetic", "tvsum", "summe"], default="synthetic")
p.add_argument("--h5", default=None, help="HDF5 path (default data/raw/<source>.h5)")
p.add_argument("--info", default=None, help="TVSum info TSV (categories)")
p.add_argument("--n-videos", type=int, default=24, help="synthetic only")
args = p.parse_args()
cfg = cfg_from(args)

if args.source == "synthetic":
    records = make_synthetic_dataset(args.n_videos, seed=cfg.seed)
else:
    h5 = args.h5 or str(Path(cfg.paths.raw_dir) / f"{args.source}.h5")
    if args.source == "tvsum":
        info = args.info or str(Path(cfg.paths.raw_dir) / "ydata-tvsum50-info.tsv")
        records = load_tvsum(h5, info if Path(info).exists() else None)
    else:
        records = load_summe(h5)

build_database(cfg.paths.db_path, records, cfg.paths.features_dir)
print(f"Built {cfg.paths.db_path} with {len(records)} videos ({args.source})")
