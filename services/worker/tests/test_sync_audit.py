import json

from worker import sync_audit


def test_sync_audit_marks_processed_files_and_queued_jobs_complete(monkeypatch, capsys):
    lifecycle: list[tuple[str, str]] = []

    def process_job(job, deps):
        deps["mark_file_processed"](job["file_id"])
        lifecycle.append((job["file_id"], job["job_type"]))
        return 1

    monkeypatch.setattr(sync_audit, "process_claim_job", process_job)
    monkeypatch.setattr(sync_audit, "process_payment_job", process_job)
    monkeypatch.setattr(sync_audit, "delete_claim_rows_for_file", lambda file_id: None)
    monkeypatch.setattr(sync_audit, "delete_payment_rows_for_file", lambda file_id: None)
    monkeypatch.setattr(sync_audit, "get_file_record", lambda file_id: {"id": file_id})
    monkeypatch.setattr(
        sync_audit,
        "mark_file_processed",
        lambda file_id: lifecycle.append((file_id, "processed")),
        raising=False,
    )
    monkeypatch.setattr(
        sync_audit,
        "mark_file_jobs_succeeded_for_file",
        lambda file_id: lifecycle.append((file_id, "jobs_succeeded")),
        raising=False,
    )
    monkeypatch.setattr(
        sync_audit,
        "run_audit_for_user",
        lambda user_id, claim_file_ids, payment_file_ids: {
            "claims_checked": len(claim_file_ids),
            "payments_checked": len(payment_file_ids),
            "findings_created": 1,
        },
    )

    assert sync_audit.main(
        [
            "--user-id",
            "user-1",
            "--claim-file-id",
            "claim-file-1",
            "--payment-file-id",
            "payment-file-1",
        ]
    ) == 0

    assert lifecycle == [
        ("claim-file-1", "processed"),
        ("claim-file-1", "extract_claims"),
        ("claim-file-1", "jobs_succeeded"),
        ("payment-file-1", "processed"),
        ("payment-file-1", "extract_payments"),
        ("payment-file-1", "jobs_succeeded"),
    ]
    assert json.loads(capsys.readouterr().out) == {
        "claims_checked": 1,
        "payments_checked": 1,
        "findings_created": 1,
    }
