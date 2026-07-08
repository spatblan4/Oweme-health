from worker.audit import build_findings


def test_build_findings_creates_possible_credit_for_overpayment():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Stone Creek Village Dentistry",
                "provider_name_normalized": "stone creek village dentistry",
                "service_date": "2026-05-08",
                "patient_responsibility": "10.00",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Stone Creek Village Dentistry",
                "provider_name_normalized": "stone creek village dentistry",
                "payment_date": "2026-05-20",
                "amount": "78.00",
            }
        ],
    )

    assert len(findings) == 1
    assert findings[0]["finding_type"] == "possible_credit"
    assert findings[0]["details"]["credit_amount"] == "68.00"


def test_build_findings_creates_allocation_unclear_when_claim_has_no_match():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Quest Diagnostics",
                "provider_name_normalized": "quest diagnostics",
                "service_date": "2026-05-08",
                "patient_responsibility": "27.30",
                "status": "processed",
            }
        ],
        payments=[],
    )

    assert len(findings) == 1
    assert findings[0]["finding_type"] == "allocation_unclear"
    assert findings[0]["details"]["responsibility_amount"] == "27.30"


def test_build_findings_ignores_non_medical_unmatched_payments():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Quest Diagnostics",
                "provider_name_normalized": "quest diagnostics",
                "service_date": "2026-05-08",
                "patient_responsibility": "0.00",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Fruit of the Loom",
                "provider_name_normalized": "fruit of the loom",
                "payment_date": "2026-05-20",
                "amount": "69.55",
            }
        ],
    )

    assert findings == []


def test_build_findings_matches_doctor_claim_to_clinic_payment_using_aliases():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "JAMES D KIM",
                "provider_name_normalized": "james d kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "12.40",
                "status": "processed",
                "normalized_payload": {
                    "provider_aliases": [
                        "JAMES D KIM",
                        "Stone Creek Village Dentistry",
                    ]
                },
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Stone Creek Village Dentistry",
                "provider_name_normalized": "stone creek village dentistry",
                "payment_date": "2026-05-20",
                "amount": "12.40",
                "normalized_payload": {
                    "provider_aliases": [
                        "Stone Creek Village Dentistry",
                        "JAMES D KIM DDS",
                    ]
                },
            }
        ],
    )

    assert findings == []


def test_build_findings_surfaces_bundled_payment_candidates_when_exact_match_is_missing():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "JAMES D KIM",
                "provider_name_normalized": "james d kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "12.40",
                "status": "processed",
                "normalized_payload": {
                    "provider_aliases": [
                        "JAMES D KIM",
                        "Stone Creek Village Dentistry",
                    ]
                },
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Stone Creek Village Dentistry",
                "provider_name_normalized": "stone creek village dentistry",
                "payment_date": "2026-05-20",
                "amount": "78.00",
                "normalized_payload": {
                    "provider_aliases": [
                        "Stone Creek Village Dentistry",
                        "JAMES D KIM DDS",
                    ]
                },
            }
        ],
    )

    assert len(findings) == 1
    assert findings[0]["finding_type"] == "allocation_unclear"
    assert findings[0]["details"]["responsibility_amount"] == "12.40"
    assert findings[0]["details"]["candidate_payments"] == [
        {
            "payment_id": "payment-1",
            "provider_name": "Stone Creek Village Dentistry",
            "payment_date": "2026-05-20",
            "amount": "78.00",
            "payment_source": "",
            "match_hint": "Possible bundled payment",
        }
    ]
