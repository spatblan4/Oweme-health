from worker.normalize.common import normalize_iso_date
from worker.normalize.common import normalize_money
from worker.normalize.common import normalize_provider_name


def _pick(row: dict, keys: list[str]) -> str:
    lowered = {str(key).strip().lower(): value for key, value in row.items()}
    for key in keys:
        value = lowered.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def normalize_claim_rows(rows: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for row in rows:
        provider_raw = _pick(
            row,
            [
                "provider",
                "provider name",
                "provider_name",
                "rendering provider",
                "dentist",
                "facility",
                "merchant",
            ],
        )
        normalized.append(
            {
                "provider_name_raw": provider_raw,
                "provider_name_normalized": normalize_provider_name(provider_raw),
                "service_date": normalize_iso_date(
                    _pick(
                        row,
                        [
                            "service_date",
                            "date of service",
                            "service date",
                            "service begin date",
                            "service end date",
                            "dos",
                            "date",
                            "claim date",
                        ],
                    )
                ),
                "patient_responsibility": normalize_money(
                    _pick(
                        row,
                        [
                            "you may owe",
                            "you pay",
                            "patient responsibility",
                            "member responsibility",
                            "amount you owe",
                            "allowed patient",
                        ],
                    )
                ),
                "billed_amount": normalize_money(
                    _pick(row, ["billed amount", "billed", "charge", "submitted amount"])
                ),
                "allowed_amount": normalize_money(_pick(row, ["allowed amount", "allowed"])),
                "insurance_paid": normalize_money(
                    _pick(row, ["insurance paid", "plan paid", "paid by plan"])
                ),
                "status": _pick(row, ["claim status", "status", "claim status description"]),
                "raw_row": row,
            }
        )
    return normalized
