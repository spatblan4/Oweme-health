from worker.normalize.common import normalize_money
from worker.normalize.common import normalize_iso_date
from worker.normalize.common import normalize_provider_name


def _pick(row: dict, keys: list[str]) -> str:
    lowered = {str(key).strip().lower(): value for key, value in row.items()}
    for key in keys:
        value = lowered.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def normalize_payment_rows(rows: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for row in rows:
        provider_raw = _pick(row, ["merchant", "provider", "description", "name", "payee"])
        normalized.append(
            {
                "provider_name_raw": provider_raw,
                "provider_name_normalized": normalize_provider_name(provider_raw),
                "payment_date": normalize_iso_date(
                    _pick(row, ["transaction date", "payment date", "posted date", "date"])
                ),
                "amount": normalize_money(
                    _pick(row, ["amount", "amount usd", "amount (usd)", "debit", "paid", "transaction amount"])
                ),
                "payment_source": _pick(row, ["source", "account", "card", "payment method", "type", "category"]),
                "raw_row": row,
            }
        )
    return normalized
