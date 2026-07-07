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


def test_build_findings_matches_payment_to_facility_when_provider_is_a_doctor():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Leibovsky, Vladimir",
                "provider_name_normalized": "leibovsky vladimir",
                "facility_name": "LAiMA OBGYN INC",
                "facility_name_normalized": "laima obgyn inc",
                "service_date": "2026-06-25",
                "patient_responsibility": "61.29",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "LAiMA OBGYN INC",
                "provider_name_normalized": "laima obgyn inc",
                "payment_date": "2026-06-25",
                "amount": "100.00",
            }
        ],
    )

    assert len(findings) == 1
    assert findings[0]["finding_type"] == "possible_credit"
    assert findings[0]["details"]["credit_amount"] == "38.71"
    assert findings[0]["details"]["matched_via"] == "facility"
    assert findings[0]["title"] == "LAiMA OBGYN INC"
    assert findings[0]["details"]["provider_name"] == "LAiMA OBGYN INC"
    assert findings[0]["details"]["facility_name"] == "LAiMA OBGYN INC"
