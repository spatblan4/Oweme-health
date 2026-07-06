from collections.abc import Callable
from typing import Any

from worker.db import claim_next_job as default_claim_next_job
from worker.db import get_file_record as default_get_file_record
from worker.db import mark_file_processed as default_mark_file_processed
from worker.db import mark_job_running as default_mark_job_running
from worker.db import mark_job_succeeded as default_mark_job_succeeded
from worker.extract.tables import extract_tables as default_extract_tables
from worker.normalize.claims import normalize_claim_rows as default_normalize_claim_rows
from worker.normalize.payments import normalize_payment_rows as default_normalize_payment_rows
from worker.persist.claims import persist_claim_rows as default_persist_claim_rows
from worker.persist.payments import persist_payment_rows as default_persist_payment_rows
from worker.storage import download_source_file as default_download_source_file


def process_claim_job(
    job: dict,
    deps: dict[str, Callable[..., Any]] | None = None,
) -> int:
    resolved = deps or {}
    get_file_record = resolved.get("get_file_record", default_get_file_record)
    download_source_file = resolved.get("download_source_file", default_download_source_file)
    extract_tables = resolved.get("extract_tables", default_extract_tables)
    normalize_claim_rows = resolved.get(
        "normalize_claim_rows", default_normalize_claim_rows
    )
    persist_claim_rows = resolved.get("persist_claim_rows", default_persist_claim_rows)
    mark_file_processed = resolved.get(
        "mark_file_processed",
        (lambda file_id: None) if deps is not None else default_mark_file_processed,
    )
    mark_job_succeeded = resolved.get(
        "mark_job_succeeded",
        (lambda job_id: None) if deps is not None else default_mark_job_succeeded,
    )

    file_record = None
    if "get_file_record" in resolved or get_file_record is not default_get_file_record:
        file_record = get_file_record(job["file_id"])
    file_record = file_record or {
        "id": job["file_id"],
        "original_name": f"{job['file_id']}.pdf",
        "bucket": "uploads",
        "storage_path": f"uploads/{job['file_id']}.pdf",
    }
    downloaded_path = download_source_file(file_record)
    rows = extract_tables(downloaded_path)
    normalized_rows = normalize_claim_rows(rows)
    persist_claim_rows(job.get("user_id", ""), job["file_id"], normalized_rows)
    mark_file_processed(job["file_id"])
    mark_job_succeeded(job["id"])
    return 1


def process_payment_job(
    job: dict,
    deps: dict[str, Callable[..., Any]] | None = None,
) -> int:
    resolved = deps or {}
    get_file_record = resolved.get("get_file_record", default_get_file_record)
    download_source_file = resolved.get("download_source_file", default_download_source_file)
    extract_tables = resolved.get("extract_tables", default_extract_tables)
    normalize_payment_rows = resolved.get(
        "normalize_payment_rows", default_normalize_payment_rows
    )
    persist_payment_rows = resolved.get(
        "persist_payment_rows", default_persist_payment_rows
    )
    mark_file_processed = resolved.get(
        "mark_file_processed",
        (lambda file_id: None) if deps is not None else default_mark_file_processed,
    )
    mark_job_succeeded = resolved.get(
        "mark_job_succeeded",
        (lambda job_id: None) if deps is not None else default_mark_job_succeeded,
    )

    file_record = None
    if "get_file_record" in resolved or get_file_record is not default_get_file_record:
        file_record = get_file_record(job["file_id"])
    file_record = file_record or {
        "id": job["file_id"],
        "original_name": f"{job['file_id']}.pdf",
        "bucket": "uploads",
        "storage_path": f"uploads/{job['file_id']}.pdf",
    }
    downloaded_path = download_source_file(file_record)
    rows = extract_tables(downloaded_path)
    normalized_rows = normalize_payment_rows(rows)
    persist_payment_rows(job.get("user_id", ""), job["file_id"], normalized_rows)
    mark_file_processed(job["file_id"])
    mark_job_succeeded(job["id"])
    return 1


def poll_once(
    deps: dict[str, Callable[..., Any]] | None = None,
) -> int:
    resolved = deps or {}
    claim_next_job = resolved.get("claim_next_job", default_claim_next_job)
    mark_job_running = resolved.get("mark_job_running", default_mark_job_running)
    claim_job_processor = resolved.get("process_claim_job", process_claim_job)
    payment_job_processor = resolved.get("process_payment_job", process_payment_job)

    job = claim_next_job()
    if job is None:
        return 0

    mark_job_running(job["id"])
    if job.get("job_type", "extract_claims") == "extract_claims":
        return claim_job_processor(job, deps=resolved)
    if job.get("job_type") == "extract_payments":
        return payment_job_processor(job, deps=resolved)
    return 1
