from worker.normalize.common import normalize_iso_date
from worker.normalize.common import normalize_provider_name


def normalize_claim_rows(rows: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for row in rows:
      provider_raw = str(row.get("provider") or row.get("provider_name") or "").strip()
      normalized.append(
          {
              "provider_name_raw": provider_raw,
              "provider_name_normalized": normalize_provider_name(provider_raw),
              "service_date": normalize_iso_date(row.get("service_date")),
              "raw_row": row,
          }
      )
    return normalized

