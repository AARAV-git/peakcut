"""Shared CLI helpers."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from peakcut.config import load_config  # noqa: E402


def base_parser(desc: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=desc)
    p.add_argument("--config", nargs="*", default=["configs/default.yaml"], help="YAML files, later ones override")
    p.add_argument("--db", default=None, help="DuckDB path (default from config)")
    return p


def cfg_from(args):
    cfg = load_config(*args.config)
    if args.db:
        cfg.paths.db_path = args.db
    return cfg
