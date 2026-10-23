"""Generate, judge and hallucination-check highlight titles/summaries for a stored run.

Captions are read from <captions_dir>/<video_id>.json (a list with one caption per sampled
frame). --mock uses a stand-in model (stored as llm_model='mock'; for plumbing demos only).
"""
from pathlib import Path

from _common import base_parser, cfg_from
from peakcut.db.connection import connect
from peakcut.db.repository import Repository
from peakcut.llm.captioner import load_captions
from peakcut.llm.clients import MockLLM, get_client
from peakcut.llm.generator import run_summary_pipeline

p = base_parser(__doc__)
p.add_argument("--run-id", default=None, help="default: best clean run")
p.add_argument("--variants", nargs="*", default=None)
p.add_argument("--mock", action="store_true")
p.add_argument("--no-judge", action="store_true")
args = p.parse_args()
cfg = cfg_from(args)
repo = Repository(connect(cfg.paths.db_path))
run_id = args.run_id or repo.best_run_id()
if run_id is None:
    raise SystemExit("No evaluated run found; run train.py or evaluate.py first")
client = MockLLM() if args.mock else get_client(cfg.llm.provider, cfg.llm.model)
judge = None if args.no_judge else client
stats = run_summary_pipeline(
    repo, run_id,
    lambda vid: load_captions(Path(cfg.paths.captions_dir) / f"{vid}.json"),
    client, judge, args.variants or cfg.llm.prompt_variants,
)
print(run_id, stats)
for row in repo.llm_eval_summary():
    print(row)
