from worker.normalize.payments import normalize_payment_rows


def test_normalize_payment_rows_parses_amount_to_decimal_string():
    rows = [{"merchant": "Stone Creek Village Dentistry", "amount": "$78.00"}]

    normalized = normalize_payment_rows(rows)

    assert normalized[0]["provider_name_raw"] == "Stone Creek Village Dentistry"
    assert normalized[0]["provider_name_normalized"] == "stone creek village dentistry"
    assert normalized[0]["amount"] == "78.00"


def test_normalize_payment_rows_parses_payment_date():
    rows = [
        {
            "merchant": "Stone Creek Village Dentistry",
            "amount": "$78.00",
            "transaction date": "05/20/2026",
        }
    ]

    normalized = normalize_payment_rows(rows)

    assert normalized[0]["payment_date"] == "2026-05-20"


def test_normalize_payment_rows_collects_provider_aliases():
    rows = [
        {
            "merchant": "Stone Creek Village Dentistry",
            "description": "JAMES D KIM DDS",
            "amount": "$78.00",
        }
    ]

    normalized = normalize_payment_rows(rows)

    assert normalized[0]["provider_aliases"] == [
        "Stone Creek Village Dentistry",
        "JAMES D KIM DDS",
    ]


def test_normalize_payment_rows_falls_back_to_category_when_provider_is_missing():
    rows = [
        {
            "category": "Medical",
            "type": "Purchase",
            "amount": "$142.00",
            "transaction date": "05/20/2026",
        }
    ]

    normalized = normalize_payment_rows(rows)

    assert normalized[0]["provider_name_raw"] == "Medical"
    assert normalized[0]["provider_aliases"] == ["Medical"]
    assert normalized[0]["payment_source"] == "Purchase"


def test_normalize_payment_rows_treats_hsa_withdrawals_as_positive_paid_amounts():
    rows = [
        {
            "Type": "Withdrawal",
            "Amount": "-275.00",
            "Description": "ALI SALEHPOUR MD DDS",
            "Payment Date": "02/19/2026",
        }
    ]

    normalized = normalize_payment_rows(rows)

    assert normalized[0]["provider_name_raw"] == "ALI SALEHPOUR MD DDS"
    assert normalized[0]["payment_source"] == "Withdrawal"
    assert normalized[0]["amount"] == "275.00"
    assert normalized[0]["payment_date"] == "2026-02-19"
