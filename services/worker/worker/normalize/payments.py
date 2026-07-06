from worker.normalize.common import normalize_money
from worker.normalize.common import normalize_provider_name


def normalize_payment_rows(rows: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for row in rows:
        provider_raw = str(row.get("merchant") or row.get("provider") or "").strip()
        normalized.append(
            {
                "provider_name_raw": provider_raw,
                "provider_name_normalized": normalize_provider_name(provider_raw),
                "amount": normalize_money(row.get("amount")),
                "raw_row": row,
            }
        )
    return normalized
