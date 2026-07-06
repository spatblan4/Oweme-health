from pathlib import Path

from worker.jobs import process_payment_job


def test_process_payment_job_persists_rows_and_marks_file_processed(tmp_path: Path):
    lifecycle: list[tuple[str, str]] = []

    processed = process_payment_job(
        {
            "id": "job-2",
            "user_id": "user-1",
            "file_id": "file-2",
        },
        deps={
            "download_source_file": lambda file_record: tmp_path / f"{file_record['id']}.pdf",
            "extract_tables": lambda path: [{"merchant": "Stone Creek Village Dentistry", "amount": "$78.00"}],
            "normalize_payment_rows": lambda rows: [
                {
                    "provider_name_raw": "Stone Creek Village Dentistry",
                    "provider_name_normalized": "stone creek village dentistry",
                    "amount": "78.00",
                }
            ],
            "persist_payment_rows": lambda user_id, file_id, rows: len(rows),
            "mark_file_processed": lambda file_id: lifecycle.append((file_id, "processed")),
            "mark_job_succeeded": lambda job_id: lifecycle.append((job_id, "succeeded")),
        },
    )

    assert processed == 1
    assert lifecycle == [("file-2", "processed"), ("job-2", "succeeded")]

