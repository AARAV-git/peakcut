import numpy as np
import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from peakcut.api.main import create_app  # noqa: E402


class FakeExtractor:
    def extract(self, path):
        if open(path, "rb").read() == b"corrupt":
            raise ValueError("bad video")
        rng = np.random.default_rng(0)
        return rng.normal(size=(60, 8)).astype(np.float32), 30.0, 30.0


@pytest.fixture
def client(populated_db):
    app = create_app(populated_db, extractor=FakeExtractor(), scorer=lambda f: f[:, 0], auto_load_models=False)
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok", "db": True, "upload_ready": True}


def test_videos_and_detail(client, records):
    vids = client.get("/videos").json()
    assert len(vids) == len(records)
    d = client.get(f"/videos/{vids[0]['video_id']}").json()
    assert len(d["annotator_scores"]) == 6
    assert d["agreement"] is not None
    assert client.get("/videos/nope").status_code == 404


def test_highlights_known_video(client):
    vid = client.get("/videos").json()[0]["video_id"]
    r = client.post("/highlights", json={"video_id": vid})
    body = r.json()
    assert r.status_code == 200 and body["run_id"] == "kmeans_s0"
    assert len(body["scores"]) > 0 and len(body["highlights"]) > 0
    assert all(h["end_sec"] > h["start_sec"] for h in body["highlights"])


def test_highlights_errors(client):
    assert client.post("/highlights", json={"video_id": "nope"}).status_code == 404
    vid = client.get("/videos").json()[0]["video_id"]
    assert client.post("/highlights", json={"video_id": vid, "run_id": "zzz"}).status_code == 404


def test_highlights_bad_body_is_422(client):
    assert client.post("/highlights", json={"wrong": 1}).status_code == 422
    assert client.post("/highlights", json={}).status_code == 422
    r = client.post("/highlights", content=b"not json", headers={"content-type": "application/json"})
    assert r.status_code == 422


def test_upload_scoring(client):
    r = client.post("/highlights", files={"file": ("clip.mp4", b"fake video bytes", "video/mp4")})
    body = r.json()
    assert r.status_code == 200 and body["video_id"].startswith("upload_") and body["run_id"] == "upload"
    assert len(body["scores"]) == 60 and body["highlights"]
    assert sum(h["end_idx"] - h["start_idx"] + 1 for h in body["highlights"]) <= 9   # 15% of 60
    assert client.post("/highlights", files={"file": ("c.mp4", b"corrupt", "video/mp4")}).status_code == 422


def test_upload_disabled_without_models(populated_db):
    app = create_app(populated_db, auto_load_models=False)
    with TestClient(app) as c:
        assert c.get("/health").json()["upload_ready"] is False
        r = c.post("/highlights", files={"file": ("a.mp4", b"x", "video/mp4")})
        assert r.status_code == 501


def test_summaries(client):
    vid = client.get("/videos").json()[0]["video_id"]
    hs = client.post("/highlights", json={"video_id": vid}).json()["highlights"]
    ids = [h["highlight_id"] for h in hs]
    out = client.post("/summaries", json={"highlight_ids": ids}).json()
    assert out and out[0]["title"] == "A title" and out[0]["llm_model"] == "mock"
    assert client.post("/summaries", json={"highlight_ids": ["upload_x:0"]}).status_code == 501
    assert client.post("/summaries", json={"highlight_ids": []}).status_code == 422


def test_experiments_and_metrics(client):
    rows = client.get("/experiments").json()
    assert rows[0]["run_id"] == "kmeans_s0"
    m = client.get("/experiments/kmeans_s0/metrics").json()
    assert set(m) == {"overall", "by_category"} and len(m["by_category"]) == 4
    assert client.get("/experiments/nope/metrics").status_code == 404


def test_media_404_without_file(client):
    vid = client.get("/videos").json()[0]["video_id"]
    assert client.get(f"/media/{vid}").status_code == 404


def test_cors_header(client):
    r = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
