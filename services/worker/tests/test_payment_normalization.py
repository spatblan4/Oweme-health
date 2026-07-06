from worker.normalize.payments import normalize_payment_rows


def test_normalize_payment_rows_parses_amount_to_decimal_string():
    rows = [{"merchant": "Stone Creek Village Dentistry", "amount": "$78.00"}]

    normalized = normalize_payment_rows(rows)

    assert normalized[0]["provider_name_raw"] == "Stone Creek Village Dentistry"
    assert normalized[0]["provider_name_normalized"] == "stone creek village dentistry"
    assert normalized[0]["amount"] == "78.00"

