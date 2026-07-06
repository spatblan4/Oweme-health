from pathlib import Path

from worker.jobs import process_claim_job


def test_process_claim_job_persists_rows_and_marks_file_processed(tmp_path: Path):
    lifecycle: list[tuple[str, str]] = []

    processed = process_claim_job(
        {
            "id": "job-1",
            "user_id": "user-1",
            "file_id": "file-1",
        },
        deps={
            "download_source_file": lambda file_id: tmp_path / f"{file_id}.pdf",
            "extract_tables": lambda path: [{"provider": "KIM,JAMES,D,DDS", "service_date": "2026-07-03"}],
            "normalize_claim_rows": lambda rows: [
                {
                    "provider_name_raw": "KIM,JAMES,D,DDS",
                    "provider_name_normalized": "kim james d dds",
                    "service_date": "2026-07-03",
                }
            ],
            "persist_claim_rows": lambda user_id, file_id, rows: len(rows),
            "mark_file_processed": lambda file_id: lifecycle.append((file_id, "processed")),
            "mark_job_succeeded": lambda job_id: lifecycle.append((job_id, "succeeded")),
        },
    )

    assert processed == 1
    assert lifecycle == [("file-1", "processed"), ("job-1", "succeeded")]

