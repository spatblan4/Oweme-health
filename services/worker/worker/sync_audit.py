from argparse import ArgumentParser
import json

from worker.audit import run_audit_for_user
from worker.db import delete_claim_rows_for_file
from worker.db import delete_payment_rows_for_file
from worker.db import get_file_record
from worker.db import mark_file_jobs_succeeded_for_file
from worker.db import mark_file_processed
from worker.jobs import process_claim_job
from worker.jobs import process_payment_job


def _parser() -> ArgumentParser:
    parser = ArgumentParser()
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--claim-file-id", action="append", default=[])
    parser.add_argument("--payment-file-id", action="append", default=[])
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)

    for file_id in args.claim_file_id:
        process_claim_job(
            {
                "id": f"sync-claim-{file_id}",
                "user_id": args.user_id,
                "file_id": file_id,
                "job_type": "extract_claims",
            },
            deps={
                "delete_claim_rows_for_file": delete_claim_rows_for_file,
                "get_file_record": get_file_record,
                "mark_file_processed": mark_file_processed,
                "mark_job_succeeded": lambda job_id: None,
            },
        )
        mark_file_jobs_succeeded_for_file(file_id)

    for file_id in args.payment_file_id:
        process_payment_job(
            {
                "id": f"sync-payment-{file_id}",
                "user_id": args.user_id,
                "file_id": file_id,
                "job_type": "extract_payments",
            },
            deps={
                "delete_payment_rows_for_file": delete_payment_rows_for_file,
                "get_file_record": get_file_record,
                "mark_file_processed": mark_file_processed,
                "mark_job_succeeded": lambda job_id: None,
            },
        )
        mark_file_jobs_succeeded_for_file(file_id)

    result = run_audit_for_user(
        args.user_id,
        claim_file_ids=args.claim_file_id,
        payment_file_ids=args.payment_file_id,
    )
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
