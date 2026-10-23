# Peakcut — backend and database

FastAPI + DuckDB backend for annotator-aware video highlight detection: a temporal transformer
(PyTorch, with a JAX port) scores frames, a knapsack picks highlights under a 15% budget, and an LLM
writes titles/summaries that are judged and checked for hallucinations.

## Quick start (no dataset needed)
```bash
pip install -e ".[api,jax,dev]"      # add ".[train]" for PyTorch, ".[features]" for CLIP uploads, ".[llm]" for the API model
make db                               # synthetic data -> data/db/peakcut.duckdb
make baseline                         # unsupervised k-means run + leaderboard
python scripts/train.py --loss ranking   # needs torch; also: bce, contrastive
python scripts/generate_summaries.py --mock   # plumbing demo only; real run needs ANTHROPIC_API_KEY + captions
make serve                            # http://localhost:8000/docs
make test
```
Real data: put `tvsum.h5` / `summe.h5` (KTS/DSNet-style HDF5) in `data/raw/`, run `make data`, then `make db SOURCE=tvsum`.

## Layout
`sql/` schema + analysis queries · `src/peakcut/db` connection/loader/repository · `data` loaders, synthetic data,
agreement · `models` torch, JAX, k-means · `losses` BCE/ranking/contrastive · `training` trainer, noise ·
`eval` metrics, knapsack, runner · `llm` clients, prompts, judge, hallucination, pipeline · `api` routes ·
`scripts/` CLI · `tests/`.

## API
`GET /health` · `GET /videos` · `GET /videos/{id}` (metadata, agreement, annotator curves) · `GET /media/{id}` ·
`POST /highlights` (JSON `{video_id, run_id?}` or multipart `file`) · `POST /summaries` ·
`GET /experiments` · `GET /experiments/{run_id}/metrics`. The API opens DuckDB **read-only**.

## Verification status (be honest about this in interviews)
- Ran and passing: schema/loader/repository, agreement (SQL matches numpy), knapsack (matches brute force), metrics,
  noise utilities, KTS-HDF5 parser (round-trip on a synthetic file), JAX model (shape, padding invariance, loss decreases),
  LLM pipeline with a mock client, API incl. upload path with a fake extractor, and a live uvicorn smoke test.
- **Written but not executed** (no torch in the build sandbox): PyTorch model/losses/trainer, CLIP extractor, BLIP captioner,
  Anthropic client. Their tests (`test_losses`, `test_models` parity) skip without torch and run in CI with CPU torch.
  Run `pytest -rs` once on your machine and fix whatever fails before trusting any number.
- The TVSum/SumMe loaders were not run on the real files. In the KTS HDF5 format, annotations are binary per-annotator
  summaries, not raw 1-5 scores, so agreement on TVSum is computed on those masks.
- Synthetic-data metrics are plumbing checks only; never report them as results.

## Known limits
- Uploads are scored and returned but not stored; titles/summaries for uploads return 501.
- JAX covers the model, parity and a BCE train step (throughput benchmark), not the loss study.
- `llm/hallucination.py` is a lexical heuristic; the LLM judge is a second, also imperfect, signal.
