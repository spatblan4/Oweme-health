from worker.normalize.claims import normalize_claim_rows


def test_normalize_claim_rows_keeps_raw_and_normalized_provider_names():
    rows = [{"provider": "KIM,JAMES,D,DDS", "service_date": "2026-07-03"}]

    normalized = normalize_claim_rows(rows)

    assert normalized[0]["provider_name_raw"] == "KIM,JAMES,D,DDS"
    assert normalized[0]["provider_name_normalized"] == "kim james d dds"
    assert normalized[0]["service_date"] == "2026-07-03"

