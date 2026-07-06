from pathlib import Path

from worker.jobs import poll_once


def test_poll_once_dispatches_extract_claims_jobs(tmp_path: Path):
    seen: list[str] = []

    processed = poll_once(
        deps={
            "claim_next_job": lambda: {
                "id": "job-1",
                "file_id": "file-1",
                "user_id": "user-1",
                "job_type": "extract_claims",
            },
            "mark_job_running": lambda job_id: seen.append(f"running:{job_id}"),
            "process_claim_job": lambda job, deps=None: seen.append(f"processed:{job['id']}") or 1,
            "download_source_file": lambda file_id: tmp_path / f"{file_id}.pdf",
        }
    )

    assert processed == 1
    assert seen == ["running:job-1", "processed:job-1"]

