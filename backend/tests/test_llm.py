import pytest

from peakcut.config import Config
from peakcut.eval.runner import persist_run
from peakcut.llm.clients import MockLLM
from peakcut.llm.generator import (
    captions_for_highlight,
    generate_summary,
    judge_summary,
    parse_json_object,
    run_summary_pipeline,
)
from peakcut.llm.hallucination import flag_hallucination
from peakcut.llm.prompts import VARIANTS, build_judge_prompt, build_summary_prompt
from peakcut.models.kmeans_baseline import kmeans_scores


def test_prompt_variants_differ():
    caps = ["a dog runs", "a dog jumps"]
    prompts = {v: build_summary_prompt(v, caps, "bark bark") for v in VARIANTS}
    assert "Transcript: bark bark" in prompts["captions+asr"]
    assert "Transcript" not in prompts["captions"]
    assert "Example" in prompts["few_shot"]
    with pytest.raises(ValueError):
        build_summary_prompt("nope", caps)
    assert "Title: T" in build_judge_prompt(caps, "T", "S")


def test_parse_json_object_handles_noise():
    assert parse_json_object('Sure! {"a": 1} done') == {"a": 1}
    assert parse_json_object("no json") is None
    assert parse_json_object("{bad json}") is None


def test_generate_and_judge_with_mock():
    ok = MockLLM(lambda p: '{"title": " T ", "summary": "S"}')
    assert generate_summary(ok, "captions", ["x"]) == ("T", "S")
    assert generate_summary(MockLLM(lambda p: "garbage"), "captions", ["x"]) is None
    assert judge_summary(MockLLM(lambda p: '{"faithfulness": 4, "informativeness": 3}'), ["x"], "t", "s") == (4.0, 3.0)
    assert judge_summary(MockLLM(lambda p: '{"faithfulness": 9, "informativeness": 3}'), ["x"], "t", "s") == (None, None)


def test_hallucination_flag():
    caps = ["a man scores a goal in a football match", "players celebrate on the pitch"]
    clean, _ = flag_hallucination("Man scores goal", "Players celebrate the goal.", caps)
    bad, words = flag_hallucination("Dragon attacks castle", "A dragon burns the castle tower.", caps)
    assert not clean and bad and "dragon" in words


def test_captions_thinned():
    caps = [f"c{i}" for i in range(40)]
    out = captions_for_highlight(caps, 0, 39, max_n=8)
    assert len(out) == 8 and out[0] == "c0"


def test_pipeline_saves_summaries_and_eval(repo, records):
    cfg = Config()
    scores = {r.video_id: kmeans_scores(r.features, seed=0) for r in records}
    persist_run(repo, "r1", "kmeans", None, 0.0, 0, {}, records, scores, cfg.evaluation)

    def responder(prompt):
        if "Grade:" in prompt:
            return '{"faithfulness": 5, "informativeness": 4}'
        return '{"title": "Dragon attacks castle", "summary": "A dragon burns the tower."}'

    client = MockLLM(responder)
    have = {records[0].video_id: [f"a person walks {i}" for i in range(records[0].n_samples)]}
    stats = run_summary_pipeline(repo, "r1", have.get, client, client, ["captions", "few_shot"])
    n_h = len(repo.get_highlights("r1", records[0].video_id))
    assert stats["generated"] == 2 * n_h
    assert stats["skipped_no_captions"] == len(repo.list_highlights("r1")) - n_h
    rows = repo.llm_eval_summary()
    assert {r["prompt_variant"] for r in rows} == {"captions", "few_shot"}
    assert all(r["hallucination_rate"] == 1.0 and r["faithfulness"] == 5.0 for r in rows)
    assert repo.con.execute("SELECT DISTINCT llm_model FROM summaries").fetchall() == [("mock",)]
