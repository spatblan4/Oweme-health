from worker.jobs import poll_once


def test_poll_once_dispatches_extract_payments_jobs():
    seen: list[str] = []

    processed = poll_once(
        deps={
            "claim_next_job": lambda: {
                "id": "job-2",
                "file_id": "file-2",
                "user_id": "user-1",
                "job_type": "extract_payments",
            },
            "mark_job_running": lambda job_id: seen.append(f"running:{job_id}"),
            "process_payment_job": lambda job, deps=None: seen.append(f"processed:{job['id']}") or 1,
        }
    )

    assert processed == 1
    assert seen == ["running:job-2", "processed:job-2"]

