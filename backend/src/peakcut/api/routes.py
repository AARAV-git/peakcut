"""Endpoint definitions."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import ValidationError

from peakcut.db.repository import Repository, media_file

from . import services
from .dependencies import get_repo
from .schemas import (
    ExperimentRow,
    Health,
    HighlightsRequest,
    HighlightsResponse,
    RunMetrics,
    SummariesRequest,
    SummaryOut,
    VideoDetail,
    VideoItem,
)

router = APIRouter()


def _raise(exc: services.ServiceError):
    raise HTTPException(status_code=exc.status, detail=exc.detail) from exc


@router.get("/health", response_model=Health)
def health(request: Request, repo: Repository = Depends(get_repo)):
    repo.con.execute("SELECT 1")
    st = request.app.state
    return Health(status="ok", db=True, upload_ready=st.extractor is not None and st.scorer is not None)


@router.get("/videos", response_model=list[VideoItem])
def list_videos(repo: Repository = Depends(get_repo)):
    return repo.list_videos()


@router.get("/videos/{video_id}", response_model=VideoDetail)
def get_video(video_id: str, repo: Repository = Depends(get_repo)):
    v = repo.get_video(video_id)
    if v is None:
        raise HTTPException(404, f"Unknown video_id '{video_id}'")
    return {**v, "annotator_scores": repo.get_annotator_scores(video_id)}


@router.get("/media/{video_id}")
def get_media(video_id: str, repo: Repository = Depends(get_repo)):
    path = media_file(repo, video_id)
    if path is None or not path.exists():
        raise HTTPException(404, f"No media file for '{video_id}'")
    return FileResponse(path)  # Starlette serves HTTP Range requests, so seeking works


@router.post("/highlights", response_model=HighlightsResponse)
async def highlights(request: Request, repo: Repository = Depends(get_repo)):
    """JSON {video_id, run_id?} -> stored highlights; multipart `file` -> live scoring."""
    ctype = request.headers.get("content-type", "")
    try:
        if ctype.startswith("multipart/form-data"):
            form = await request.form()
            f = form.get("file")
            if f is None or not hasattr(f, "read"):
                raise HTTPException(422, "multipart field 'file' is required")
            cfg = request.app.state.cfg
            return services.upload_highlights(
                request.app.state, await f.read(), f.filename, cfg.evaluation.fixed_segment_len,
                cfg.evaluation.budget_ratio,
            )
        try:
            body = HighlightsRequest.model_validate(await request.json())
        except ValidationError as exc:
            raise HTTPException(422, detail=exc.errors(include_url=False, include_context=False)) from exc
        except ValueError as exc:  # body is not valid JSON
            raise HTTPException(422, detail="Request body must be JSON {video_id, run_id?} or multipart with 'file'") from exc
        return services.known_video_highlights(repo, body.video_id, body.run_id)
    except services.ServiceError as exc:
        _raise(exc)


@router.post("/summaries", response_model=list[SummaryOut])
def summaries(body: SummariesRequest, repo: Repository = Depends(get_repo)):
    try:
        rows = services.summaries(repo, body.highlight_ids, body.prompt_variant)
    except services.ServiceError as exc:
        _raise(exc)
    return rows


@router.get("/experiments", response_model=list[ExperimentRow])
def experiments(repo: Repository = Depends(get_repo)):
    return repo.leaderboard()


@router.get("/experiments/{run_id}/metrics", response_model=RunMetrics)
def run_metrics(run_id: str, repo: Repository = Depends(get_repo)):
    m = repo.run_metrics(run_id)
    if m is None:
        raise HTTPException(404, f"Unknown run_id '{run_id}'")
    return m
