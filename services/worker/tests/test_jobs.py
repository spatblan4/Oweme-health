from pathlib import Path

from worker.jobs import poll_once


def test_poll_once_marks_a_queued_job_running(tmp_path: Path):
    transitions: list[tuple[str, str]] = []

    processed = poll_once(
        deps={
            "claim_next_job": lambda: {"id": "job-1", "file_id": "file-1"},
            "mark_job_running": lambda job_id: transitions.append((job_id, "running")),
            "download_source_file": lambda file_id: tmp_path / f"{file_id}.pdf",
        }
    )

    assert processed == 1
    assert transitions == [("job-1", "running")]


def test_poll_once_returns_zero_when_no_job_is_available():
    processed = poll_once(
        deps={
            "claim_next_job": lambda: None,
            "mark_job_running": lambda job_id: None,
            "download_source_file": lambda file_id: None,
        }
    )

    assert processed == 0

