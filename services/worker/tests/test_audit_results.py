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


def test_build_findings_matches_abbreviated_bank_provider_to_claim_provider():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Stone Creek Village Dentistry",
                "provider_name_normalized": "stone creek village dentistry",
                "service_date": "2026-05-08",
                "patient_responsibility": "78.00",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "STN CRK VLG DENT SAN JOSE",
                "provider_name_normalized": "stn crk vlg dent san jose",
                "payment_date": "2026-05-20",
                "amount": "78.00",
                "normalized_payload": {
                    "provider_aliases": ["STN CRK VLG DENT SAN JOSE"]
                },
            }
        ],
    )

    assert findings == []


def test_build_findings_does_not_match_same_day_specific_medical_merchant_without_verified_provider_identity():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "JAMES D KIM",
                "provider_name_normalized": "james d kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "12.40",
                "status": "processed",
            },
            {
                "id": "claim-2",
                "provider_name_raw": "JAMES KIM",
                "provider_name_normalized": "james kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "0.00",
                "status": "processed",
            },
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Stone Creek Village De",
                "provider_name_normalized": "stone creek village de",
                "payment_date": "2026-05-13",
                "amount": "142.00",
                "payment_source": "Purchase",
                "normalized_payload": {
                    "provider_aliases": [
                        "Stone Creek Village De",
                        "STONE CREEK VILLAGE DE463 CANYON DEL REY BLVD DEL REY OA93940 CA USA",
                        "Medical",
                    ],
                    "raw_row": {"Category": "Medical", "Type": "Purchase"},
                },
            }
        ],
    )

    assert len(findings) == 1
    claim_finding = findings[0]
    assert claim_finding["title"] == "Stone Creek Village De"
    assert claim_finding["finding_type"] == "allocation_unclear"
    assert claim_finding["details"]["claim_provider_name"] == "JAMES D KIM"
    assert claim_finding["details"]["candidate_payments"][0]["match_hint"] == "Provider conflict"


def test_build_findings_retains_multiple_payment_candidates_with_source_file_label():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "JAMES D KIM",
                "provider_name_normalized": "james d kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "12.40",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-133",
                "provider_name_raw": "Stone Creek Village De",
                "provider_name_normalized": "stone creek village de",
                "payment_date": "2026-05-13",
                "amount": "133.00",
                "payment_source": "Purchase",
                "source_file_name": "Apple Card Transactions - May 2026.csv",
                "normalized_payload": {
                    "provider_aliases": [
                        "Stone Creek Village De",
                        "STONE CREEK VILLAGE DE463 CANYON DEL REY BLVD DEL REY OA93940 CA USA",
                        "Medical",
                    ],
                    "raw_row": {"Category": "Medical", "Type": "Purchase"},
                },
            },
            {
                "id": "payment-142",
                "provider_name_raw": "Stone Creek Village De",
                "provider_name_normalized": "stone creek village de",
                "payment_date": "2026-05-13",
                "amount": "142.00",
                "payment_source": "Purchase",
                "source_file_name": "Apple Card Transactions - May 2026.csv",
                "normalized_payload": {
                    "provider_aliases": [
                        "Stone Creek Village De",
                        "STONE CREEK VILLAGE DE463 CANYON DEL REY BLVD DEL REY OA93940 CA USA",
                        "Medical",
                    ],
                    "raw_row": {"Category": "Medical", "Type": "Purchase"},
                },
            },
        ],
    )

    assert len(findings) == 1
    candidates = findings[0]["details"]["candidate_payments"]
    assert [candidate["amount"] for candidate in candidates] == ["133.00", "142.00"]
    assert [candidate["payment_source_label"] for candidate in candidates] == ["Apple Card", "Apple Card"]
    assert [candidate["payment_source"] for candidate in candidates] == ["Purchase", "Purchase"]


def test_build_findings_keeps_same_day_medical_payment_unmatched_when_provider_identity_is_unverified():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "JAMES KIM",
                "provider_name_normalized": "james kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "0.00",
                "status": "processed",
            },
            {
                "id": "claim-2",
                "provider_name_raw": "JAMES D KIM",
                "provider_name_normalized": "james d kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "12.40",
                "status": "processed",
            },
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Stone Creek Village De",
                "provider_name_normalized": "stone creek village de",
                "payment_date": "2026-05-13",
                "amount": "142.00",
                "payment_source": "Purchase",
                "normalized_payload": {
                    "provider_aliases": ["Stone Creek Village De", "Medical"],
                    "raw_row": {"Category": "Medical", "Type": "Purchase"},
                },
            }
        ],
    )

    assert len(findings) == 1
    claim_finding = findings[0]
    assert claim_finding["title"] == "Stone Creek Village De"
    assert claim_finding["finding_type"] == "allocation_unclear"
    assert claim_finding["details"]["claim_provider_name"] == "JAMES D KIM"
    assert claim_finding["details"]["candidate_payments"][0]["match_hint"] == "Provider conflict"


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
            "payment_source_label": "Card / receipt line item",
            "match_hint": "Possible bundled payment",
        }
    ]


def test_build_findings_surfaces_cross_provider_hsa_payment_as_review_candidate_not_credit():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "BAY AREA OSM",
                "provider_name_normalized": "bay area osm",
                "service_date": "2026-02-27",
                "patient_responsibility": "605.20",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "OTHER DENTAL GROUP DDS",
                "provider_name_normalized": "other dental group dds",
                "payment_date": "2026-03-04",
                "amount": "1079.10",
                "payment_source": "Withdrawal",
                "normalized_payload": {
                    "provider_aliases": ["OTHER DENTAL GROUP DDS"],
                    "raw_row": {"Type": "Withdrawal"},
                },
            }
        ],
    )

    assert len(findings) == 1
    claim_finding = findings[0]
    assert claim_finding["title"] == "OTHER DENTAL GROUP DDS"
    assert claim_finding["finding_type"] == "allocation_unclear"
    assert claim_finding["summary"] == (
        "Claim from 2026-02-27 shows 605.20 patient responsibility, and an HSA payment needs provider confirmation."
    )
    assert claim_finding["details"]["provider_name"] == "OTHER DENTAL GROUP DDS"
    assert claim_finding["details"]["claim_provider_name"] == "BAY AREA OSM"
    assert claim_finding["details"]["candidate_payments"] == [
        {
            "payment_id": "payment-1",
            "provider_name": "OTHER DENTAL GROUP DDS",
            "payment_date": "2026-03-04",
            "amount": "1079.10",
            "payment_source": "Withdrawal",
            "payment_source_label": "Withdrawal",
            "match_hint": "Provider conflict",
        }
    ]


def test_build_findings_surfaces_cross_provider_ali_payments_as_review_candidates_not_confirmed_credits():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "BAY AREA OSM",
                "provider_name_normalized": "bay area osm",
                "service_date": "2026-02-18",
                "patient_responsibility": "125.00",
                "status": "processed",
            },
            {
                "id": "claim-2",
                "provider_name_raw": "BAY AREA OSM",
                "provider_name_normalized": "bay area osm",
                "service_date": "2026-02-27",
                "patient_responsibility": "605.20",
                "status": "processed",
            },
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "ALI SALEHPOUR MD DDS",
                "provider_name_normalized": "ali salehpour md dds",
                "payment_date": "2026-02-19",
                "amount": "275.00",
                "payment_source": "Withdrawal",
            },
            {
                "id": "payment-2",
                "provider_name_raw": "ALI SALEHPOUR MD DDS",
                "provider_name_normalized": "ali salehpour md dds",
                "payment_date": "2026-03-04",
                "amount": "1079.10",
                "payment_source": "Withdrawal",
            },
        ],
    )

    # The ALI SALEHPOUR payments are a different provider than the BAY AREA OSM
    # claims. The worker must never fabricate a "Confirmed by you" credit; it
    # may only surface the payments as review candidates for the user to confirm
    # via the web applyFindingAction flow.
    assert not any(finding["finding_type"] == "possible_credit" for finding in findings)
    assert not any(
        finding.get("details", {}).get("confirmation_source") == "Confirmed by you"
        for finding in findings
    )

    review_findings = [
        finding for finding in findings if finding["finding_type"] == "allocation_unclear"
    ]
    assert len(review_findings) == 2
    assert {finding["title"] for finding in review_findings} == {"ALI SALEHPOUR MD DDS"}
    for finding in review_findings:
        assert finding["details"]["claim_provider_name"] == "BAY AREA OSM"
        assert finding["details"]["candidate_payments"], "expected review candidates"
        assert all(
            candidate["match_hint"] == "Provider conflict"
            for candidate in finding["details"]["candidate_payments"]
        )


def test_build_findings_does_not_match_placeholder_provider_names():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Dental provider under review",
                "provider_name_normalized": "dental provider under review",
                "service_date": "2026-02-18",
                "patient_responsibility": "125.00",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Dental provider under review",
                "provider_name_normalized": "dental provider under review",
                "payment_date": "2026-02-19",
                "amount": "275.00",
                "payment_source": "HSA",
            }
        ],
    )

    assert len(findings) == 1
    claim_finding = next(finding for finding in findings if finding["finding_type"] == "allocation_unclear")
    assert claim_finding["title"] == "Dental provider under review"
    assert claim_finding["details"]["candidate_payments"] == []


def test_build_findings_surfaces_nearby_generic_medical_payment_as_claim_candidate():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "JAMES D KIM",
                "provider_name_normalized": "james d kim",
                "service_date": "2026-05-13",
                "patient_responsibility": "12.40",
                "status": "processed",
            },
            {
                "id": "claim-2",
                "provider_name_raw": "Quest Diagnostics",
                "provider_name_normalized": "quest diagnostics",
                "service_date": "2026-05-08",
                "patient_responsibility": "32.40",
                "status": "processed",
            },
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Medical",
                "provider_name_normalized": "medical",
                "payment_date": "2026-05-20",
                "amount": "142.00",
                "payment_source": "Purchase",
                "normalized_payload": {
                    "provider_aliases": ["Medical"],
                    "raw_row": {"category": "Medical", "type": "Purchase"},
                },
            }
        ],
    )

    assert len(findings) == 2
    james = next(finding for finding in findings if finding["title"] == "JAMES D KIM")
    quest = next(finding for finding in findings if finding["title"] == "Quest Diagnostics")
    assert james["finding_type"] == "allocation_unclear"
    assert james["summary"] == (
        "Claim from 2026-05-13 shows 12.40 patient responsibility, and a larger payment may include this visit."
    )
    assert james["details"]["candidate_payments"] == [
        {
            "payment_id": "payment-1",
            "provider_name": "Medical",
            "payment_date": "2026-05-20",
            "amount": "142.00",
            "payment_source": "Purchase",
            "payment_source_label": "Card purchase",
            "match_hint": "Medical payment candidate",
        }
    ]
    assert quest["details"]["candidate_payments"] == []


def test_build_findings_creates_unassigned_medical_payment_when_no_close_claim_candidate():
    findings = build_findings(
        claims=[
            {
                "id": "claim-1",
                "provider_name_raw": "Quest Diagnostics",
                "provider_name_normalized": "quest diagnostics",
                "service_date": "2026-05-01",
                "patient_responsibility": "32.40",
                "status": "processed",
            }
        ],
        payments=[
            {
                "id": "payment-1",
                "provider_name_raw": "Medical",
                "provider_name_normalized": "medical",
                "payment_date": "2026-05-20",
                "amount": "142.00",
                "payment_source": "Purchase",
                "normalized_payload": {
                    "provider_aliases": ["Medical"],
                    "raw_row": {"category": "Medical", "type": "Purchase"},
                },
            }
        ],
    )

    assert len(findings) == 2
    unassigned = next(
        finding for finding in findings if finding["finding_type"] == "unassigned_medical_payment"
    )
    assert unassigned["details"]["possible_claims"] == [
        {
            "provider_name": "Quest Diagnostics",
            "service_date": "2026-05-01",
            "responsibility_amount": "32.40",
            "claim_ids": ["claim-1"],
        }
    ]
