from collections.abc import Callable

from worker.db import insert_claim_rows as default_insert_claim_rows


def persist_claim_rows(
    user_id: str,
    file_id: str,
    rows: list[dict],
    insert_claim: Callable[[dict], None] | None = None,
) -> int:
    payloads = [
        {
            "user_id": user_id,
            "source_file_id": file_id,
            **row,
            "normalized_payload": row,
        }
        for row in rows
    ]
    if insert_claim is None:
        default_insert_claim_rows(payloads)
    else:
        for payload in payloads:
            insert_claim(payload)
    return len(payloads)
