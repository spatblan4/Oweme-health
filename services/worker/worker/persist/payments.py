from collections.abc import Callable

from worker.db import insert_payment_rows as default_insert_payment_rows


def persist_payment_rows(
    user_id: str,
    file_id: str,
    rows: list[dict],
    insert_payment: Callable[[dict], None] | None = None,
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
    if insert_payment is None:
        default_insert_payment_rows(payloads)
    else:
        for payload in payloads:
            insert_payment(payload)
    return len(payloads)
