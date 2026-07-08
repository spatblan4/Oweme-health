from worker.normalize.claims import normalize_claim_rows


def test_normalize_claim_rows_keeps_raw_and_normalized_provider_names():
    rows = [{"provider": "KIM,JAMES,D,DDS", "service_date": "2026-07-03"}]

    normalized = normalize_claim_rows(rows)

    assert normalized[0]["provider_name_raw"] == "KIM,JAMES,D,DDS"
    assert normalized[0]["provider_name_normalized"] == "kim james d dds"
    assert normalized[0]["service_date"] == "2026-07-03"


def test_normalize_claim_rows_parses_patient_responsibility_and_status():
    rows = [
        {
            "provider": "Stone Creek Village Dentistry",
            "date of service": "05/08/2026",
            "patient responsibility": "$2.37",
            "claim status": "In Process",
        }
    ]

    normalized = normalize_claim_rows(rows)

    assert normalized[0]["service_date"] == "2026-05-08"
    assert normalized[0]["patient_responsibility"] == "2.37"
    assert normalized[0]["status"] == "In Process"


def test_normalize_claim_rows_accepts_service_begin_date_headers():
    rows = [
        {
            "PROVIDER NAME": "JAMES KIM",
            "SERVICE BEGIN DATE": "05/13/2026",
        }
    ]

    normalized = normalize_claim_rows(rows)

    assert normalized[0]["provider_name_raw"] == "JAMES KIM"
    assert normalized[0]["service_date"] == "2026-05-13"


def test_normalize_claim_rows_collects_provider_aliases_from_doctor_and_facility_fields():
    rows = [
        {
            "PROVIDER NAME": "JAMES D KIM",
            "FACILITY": "Stone Creek Village Dentistry",
            "SERVICE BEGIN DATE": "05/13/2026",
        }
    ]

    normalized = normalize_claim_rows(rows)

    assert normalized[0]["provider_name_raw"] == "JAMES D KIM"
    assert normalized[0]["provider_aliases"] == [
        "JAMES D KIM",
        "Stone Creek Village Dentistry",
    ]
