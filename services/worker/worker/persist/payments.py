from collections.abc import Callable

from worker.db import insert_payment_row as default_insert_payment_row


def persist_payment_rows(
    user_id: str,
    file_id: str,
    rows: list[dict],
    insert_payment: Callable[[dict], None] | None = None,
) -> int:
    inserted = 0
    writer = insert_payment or default_insert_payment_row

    for row in rows:
        payload = {
            "user_id": user_id,
            "source_file_id": file_id,
            **row,
            "normalized_payload": row,
        }
        writer(payload)
        inserted += 1

    return inserted
