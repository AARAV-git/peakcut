"""Extract CLIP frame embeddings for a folder of your own videos (needs the 'features' extra).

Writes <out>/<name>.npy and <out>/<name>.json (duration, fps). This is NOT wired into the
TVSum/SumMe annotations: those datasets ship their own features aligned to their annotations.
"""
import json
from pathlib import Path

from _common import base_parser, cfg_from
from peakcut.features.cache import save_features
from peakcut.features.extractor import ClipExtractor

p = base_parser(__doc__)
p.add_argument("--video-dir", required=True)
p.add_argument("--out", default=None)
args = p.parse_args()
cfg = cfg_from(args)
out = Path(args.out or cfg.paths.features_dir)
ext = ClipExtractor(cfg.features.embedding_model, cfg.features.sample_fps, cfg.features.batch_size)
for path in sorted(Path(args.video_dir).glob("*")):
    if path.suffix.lower() not in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        continue
    feats, duration, fps = ext.extract(path)
    save_features(out / f"{path.stem}.npy", feats)
    (out / f"{path.stem}.json").write_text(json.dumps({"duration_sec": duration, "fps": fps}))
    print(f"{path.name}: {feats.shape}")
