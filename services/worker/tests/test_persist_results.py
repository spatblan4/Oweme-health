from worker.persist.claims import persist_claim_rows
from worker.persist.payments import persist_payment_rows


def test_persist_claim_rows_inserts_rows_for_a_file():
    inserted_rows: list[dict] = []

    inserted = persist_claim_rows(
        "user-1",
        "file-1",
        [{"provider_name_raw": "A"}],
        insert_claim=lambda row: inserted_rows.append(row),
    )

    assert inserted == 1
    assert inserted_rows == [
        {
            "user_id": "user-1",
            "source_file_id": "file-1",
            "provider_name_raw": "A",
            "normalized_payload": {"provider_name_raw": "A"},
        }
    ]


def test_persist_payment_rows_inserts_rows_for_a_file():
    inserted_rows: list[dict] = []

    inserted = persist_payment_rows(
        "user-1",
        "file-1",
        [{"provider_name_raw": "B", "amount": "78.00"}],
        insert_payment=lambda row: inserted_rows.append(row),
    )

    assert inserted == 1
    assert inserted_rows == [
        {
            "user_id": "user-1",
            "source_file_id": "file-1",
            "provider_name_raw": "B",
            "amount": "78.00",
            "normalized_payload": {"provider_name_raw": "B", "amount": "78.00"},
        }
    ]

