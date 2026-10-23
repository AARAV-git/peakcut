PY ?= python
export PYTHONPATH := src

.PHONY: data db features baseline train eval summaries test lint serve reproduce

data:       ## check raw dataset files
	$(PY) scripts/download_data.py
db:         ## build the database (synthetic by default; SOURCE=tvsum|summe for real data)
	$(PY) scripts/build_db.py --source $(or $(SOURCE),synthetic)
features:   ## CLIP features for your own videos: make features VIDEO_DIR=path
	$(PY) scripts/extract_features.py --video-dir $(VIDEO_DIR)
baseline:   ## unsupervised k-means baseline + leaderboard
	$(PY) scripts/evaluate.py --method kmeans
train:      ## one PyTorch run per loss
	for l in bce ranking contrastive; do $(PY) scripts/train.py --loss $$l; done
eval: baseline
summaries:  ## LLM titles/summaries (add --mock for an offline plumbing demo)
	$(PY) scripts/generate_summaries.py $(ARGS)
test:
	$(PY) -m pytest -q
lint:
	ruff check src tests scripts
serve:
	uvicorn peakcut.api.main:create_app --factory --host 0.0.0.0 --port 8000
reproduce: db baseline train summaries
