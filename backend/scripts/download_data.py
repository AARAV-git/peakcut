"""Checks that TVSum / SumMe files are in data/raw and tells you what is missing.

Automatic download is deliberately not implemented: the commonly used HDF5 files are hosted on
third-party drives whose links change, and I could not verify any URL from the build sandbox.
Place these files in data/raw/:
  tvsum.h5                      (KTS/DSNet-style TVSum file)
  summe.h5                      (KTS/DSNet-style SumMe file)
  ydata-tvsum50-info.tsv        (optional; gives TVSum categories for the subgroup analysis)
"""
from _common import base_parser, cfg_from

args = base_parser(__doc__).parse_args()
raw = __import__("pathlib").Path(cfg_from(args).paths.raw_dir)
for name, required in (("tvsum.h5", True), ("summe.h5", False), ("ydata-tvsum50-info.tsv", False)):
    ok = (raw / name).exists()
    print(f"[{'ok' if ok else 'missing'}] {raw / name}" + ("" if ok or not required else "  <- needed"))
