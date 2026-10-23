import pytest

from peakcut.config import Config
from peakcut.data.synthetic import make_synthetic_dataset
from peakcut.db.connection import connect
from peakcut.db.loader import build_database
from peakcut.db.repository import Repository
from peakcut.eval.runner import persist_run
from peakcut.models.kmeans_baseline import kmeans_scores


@pytest.fixture(scope="session")
def records():
    return make_synthetic_dataset(n_videos=12, n_annotators=6, dim=16, seed=1)


@pytest.fixture
def db_path(tmp_path, records):
    p = tmp_path / "t.duckdb"
    build_database(p, records, tmp_path / "feats")
    return p


@pytest.fixture
def repo(db_path):
    con = connect(db_path)
    yield Repository(con)
    con.close()


@pytest.fixture
def populated_db(db_path, records):
    """DB with a k-means run, and two summaries, written before the API opens it read-only."""
    cfg = Config()
    con = connect(db_path)
    r = Repository(con)
    scores = {x.video_id: kmeans_scores(x.features, seed=0) for x in records}
    persist_run(r, "kmeans_s0", "kmeans", None, 0.0, 0, {}, records, scores, cfg.evaluation)
    first = r.list_highlights("kmeans_s0")[0]["highlight_id"]
    r.save_summary(first, "captions", "mock", "A title", "A summary.")
    con.close()
    return db_path
