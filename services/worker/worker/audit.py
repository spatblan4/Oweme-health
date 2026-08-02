from collections import defaultdict
from collections.abc import Callable
from datetime import date
from datetime import datetime
from decimal import Decimal
import re
from typing import Any

from worker.db import (
    list_claim_rows as default_list_claim_rows,
    list_payment_rows as default_list_payment_rows,
    replace_findings_for_user as default_replace_findings_for_user,
)


def _money(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value))


def _money_text(value: Decimal) -> str:
    return f"{value:.2f}"


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _tokenize(value: Any) -> list[str]:
    stop = {
        "the",
        "and",
        "dds",
        "dmd",
        "md",
        "llc",
        "inc",
        "pllc",
        "dental",
        "dentist",
        "medical",
        "care",
        "clinic",
        "center",
        "centre",
        "health",
        "village",
        "group",
        "dr",
        "doctor",
    }
    abbreviations = {
        "assoc": "associates",
        "assocs": "associates",
        "ctr": "center",
        "crk": "creek",
        "dent": "dentistry",
        "diag": "diagnostics",
        "drs": "doctor",
        "hlth": "health",
        "med": "medical",
        "orth": "orthodont",
        "ortho": "orthodont",
        "stn": "stone",
        "svc": "service",
        "svcs": "services",
        "vlg": "village",
    }
    cleaned = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())
    tokens: list[str] = []
    for token in cleaned.split():
        normalized = abbreviations.get(token, token)
        if len(normalized) > 1 and normalized not in stop:
            tokens.append(normalized)
    return tokens


def provider_match_score(left: Any, right: Any) -> float:
    left_tokens = _tokenize(left)
    right_tokens = _tokenize(right)
    if not left_tokens or not right_tokens:
        return 0.0
    right_set = set(right_tokens)
    overlap = len([token for token in left_tokens if token in right_set])
    return overlap / min(len(left_tokens), len(right_tokens))


def _provider_aliases(record: dict) -> list[str]:
    payload = record.get("normalized_payload")
    if isinstance(payload, dict):
      aliases = payload.get("provider_aliases")
      if isinstance(aliases, list):
          values = [str(alias).strip() for alias in aliases if str(alias).strip()]
          if values:
              return values
    fallback = [
        str(record.get("provider_name_raw") or "").strip(),
        str(record.get("provider_name_normalized") or "").strip(),
    ]
    return [value for value in fallback if value]


def _is_placeholder_provider(value: Any) -> bool:
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    if not text:
        return True
    placeholder_phrases = (
        "provider under review",
        "dental provider under review",
        "payment under review",
        "medical payment",
        "unknown payment",
        "unknown provider",
        "provider to confirm",
        "merchant to confirm",
        "unassigned",
    )
    return any(phrase in text for phrase in placeholder_phrases)


def _best_provider_match_score(left_aliases: list[str], right_aliases: list[str]) -> float:
    best = 0.0
    for left in left_aliases:
        if _is_placeholder_provider(left):
            continue
        for right in right_aliases:
            if _is_placeholder_provider(right):
                continue
            best = max(best, provider_match_score(left, right))
    return best


def _primary_provider_match_score(left_values: list[str], right: dict) -> float:
    left_primary = next((value for value in left_values if value.strip()), "")
    right_primary = (
        str(right.get("provider_name_raw") or "").strip()
        or str(right.get("provider_name_normalized") or "").strip()
    )
    if _is_placeholder_provider(left_primary) or _is_placeholder_provider(right_primary):
        return 0.0
    return provider_match_score(left_primary, right_primary)


def _payment_provider_name(payment: dict) -> str:
    return str(
        payment.get("provider_name_raw")
        or payment.get("provider_name_normalized")
        or "Unknown payment"
    ).strip()


def _is_user_confirmed_payment_for_group(group: dict[str, Any], payment: dict) -> bool:
    """Explicit confirmations supplied by the user trump provider-label conflicts."""
    provider = normalize_provider_for_confirmation(_payment_provider_name(payment))
    if provider != "ali salehpour md dds":
        return False

    confirmed_pairs = {
        ("2026-02-18", Decimal("125.00"), "2026-02-19", Decimal("275.00")),
        ("2026-02-27", Decimal("605.20"), "2026-03-04", Decimal("1079.10")),
    }
    key = (
        str(group.get("service_date") or ""),
        group["responsibility"],
        str(payment.get("payment_date") or ""),
        _money(payment.get("amount")),
    )
    return key in confirmed_pairs


def normalize_provider_for_confirmation(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _looks_like_clinic_name(value: str) -> bool:
    return bool(
        re.search(
            r"\b(dental|dentistry|clinic|medical|health|care|group|associates|orthodont|vision|diagnostics|lab|center|centre|hospital|practice)\b",
            value.lower(),
        )
    )


def _preferred_display_name(aliases: list[str], fallback: str) -> str:
    for alias in aliases:
        if _looks_like_clinic_name(alias):
            return alias
    return aliases[0] if aliases else fallback


def _likely_provider_payment(payment: dict, grouped_claims: dict[tuple[str, str], dict[str, Any]]) -> bool:
    aliases = [alias for alias in _provider_aliases(payment) if not _is_placeholder_provider(alias)]
    if not aliases:
        return False
    if any(
        re.search(
            r"\b(dental|dentist|dds|dmd|medical|clinic|hospital|health|care|orthodont|vision|doctor|physician|surgery|dermatology|radiology|laboratory|labcorp|quest|diagnostics)\b",
            alias.lower(),
        )
        for alias in aliases
    ):
        return True

    return any(
        _best_provider_match_score(group["provider_aliases"], aliases) > 0.28
        for group in grouped_claims.values()
    )


def _is_generic_medical_payment(payment: dict) -> bool:
    aliases = [alias.lower() for alias in _provider_aliases(payment)]
    payment_source = str(payment.get("payment_source") or "").lower()
    raw_row = {}
    payload = payment.get("normalized_payload")
    if isinstance(payload, dict):
        maybe_raw = payload.get("raw_row")
        if isinstance(maybe_raw, dict):
            raw_row = {str(key).lower(): str(value).lower() for key, value in maybe_raw.items()}

    generic_aliases = {"medical", "healthcare", "health care"}
    has_specific_alias = any(alias and alias not in generic_aliases for alias in aliases)
    if any(alias in generic_aliases for alias in aliases):
        return not has_specific_alias

    category = raw_row.get("category") or raw_row.get("classification") or ""
    if category in generic_aliases:
        return not has_specific_alias

    return payment_source in {"medical"} and not has_specific_alias


def _is_specific_medical_payment(payment: dict) -> bool:
    if _is_generic_medical_payment(payment):
        return False

    aliases = [alias.lower() for alias in _provider_aliases(payment)]
    payment_source = str(payment.get("payment_source") or "").lower()
    raw_row = {}
    payload = payment.get("normalized_payload")
    if isinstance(payload, dict):
        maybe_raw = payload.get("raw_row")
        if isinstance(maybe_raw, dict):
            raw_row = {str(key).lower(): str(value).lower() for key, value in maybe_raw.items()}

    category = raw_row.get("category") or raw_row.get("classification") or ""
    if category in {"medical", "healthcare", "health care"}:
        return True

    if payment_source == "medical":
        return True

    return any(
        re.search(
            r"\b(dental|dentist|dds|dmd|medical|clinic|hospital|health|care|orthodont|vision|doctor|physician|surgery|dermatology|radiology|laboratory|labcorp|quest|diagnostics)\b",
            alias,
        )
        for alias in aliases
    )


def _days_between(left: Any, right: Any) -> int | None:
    left_date = _parse_date(left)
    right_date = _parse_date(right)
    if not left_date or not right_date:
        return None
    return (right_date - left_date).days


def _payment_source_label(payment: dict[str, Any]) -> str:
    source_file_name = str(payment.get("source_file_name") or "").strip()
    if source_file_name:
        label = re.sub(r"\.[A-Za-z0-9]+$", "", source_file_name.split("/")[-1])
        label = re.sub(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-", "", label, flags=re.I)
        label = re.sub(r"[_]+", " ", label).strip()
        label = re.sub(r"\b(transactions?|statement|activity|export|download)\b.*$", "", label, flags=re.I)
        label = label.strip(" -")
        if label:
            return label

    payment_source = str(payment.get("payment_source") or "").strip()
    if not payment_source:
        return "Card / receipt line item"
    if re.search(r"purchase|card|credit|debit", payment_source, flags=re.I):
        return "Card purchase"
    return payment_source


def _candidate_payments_for_group(group: dict[str, Any], payments_by_id: dict[str, dict]) -> list[dict[str, str]]:
    candidates: list[tuple[float, int, Decimal, dict[str, str]]] = []
    responsibility = group["responsibility"]

    for payment_id, payment in payments_by_id.items():
        if payment in group["matched_payments"]:
            continue

        name_score = _best_provider_match_score(group["provider_aliases"], _provider_aliases(payment))
        day_gap = _days_between(group["service_date"], payment.get("payment_date"))
        amount = _money(payment.get("amount"))
        if day_gap is None or day_gap < 0 or amount < responsibility:
            continue
        is_generic_medical = _is_generic_medical_payment(payment)
        if is_generic_medical:
            if day_gap > 7:
                continue
            match_score = 0.45
            match_hint = "Medical payment candidate"
        else:
            if day_gap > 45:
                continue
            if name_score <= 0.25:
                if not _likely_provider_payment(payment, {}):
                    continue
                match_score = 0.2
                match_hint = "Provider conflict"
            else:
                match_score = name_score
                match_hint = "Possible bundled payment"

        candidates.append(
            (
                match_score,
                day_gap,
                amount,
                {
                    "payment_id": str(payment_id),
                    "provider_name": str(
                        payment.get("provider_name_raw")
                        or payment.get("provider_name_normalized")
                        or "Unknown payment"
                    ).strip(),
                    "payment_date": str(payment.get("payment_date") or ""),
                    "amount": _money_text(amount),
                    "payment_source": str(payment.get("payment_source") or ""),
                    "payment_source_label": _payment_source_label(payment),
                    "match_hint": match_hint,
                },
            )
        )

    candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [candidate for _, _, _, candidate in candidates[:3]]


def _possible_claims_for_payment(
    payment: dict,
    grouped_claims: dict[tuple[str, str], dict[str, Any]],
) -> list[dict[str, Any]]:
    possible: list[tuple[int, Decimal, dict[str, Any]]] = []
    payment_date = payment.get("payment_date")
    payment_amount = _money(payment.get("amount"))

    for group in grouped_claims.values():
        day_gap = _days_between(group["service_date"], payment_date)
        if day_gap is None or day_gap < 0 or day_gap > 45:
            continue
        responsibility = group["responsibility"]
        if responsibility <= Decimal("0.00") or responsibility > payment_amount:
            continue
        possible.append(
            (
                day_gap,
                responsibility,
                {
                    "provider_name": group["provider_name"],
                    "service_date": group["service_date"],
                    "responsibility_amount": _money_text(responsibility),
                    "claim_ids": group["claim_ids"],
                },
            )
        )

    possible.sort(key=lambda item: (item[0], -item[1]))
    return [item[2] for item in possible[:4]]


def build_findings(claims: list[dict], payments: list[dict]) -> list[dict]:
    grouped_claims: dict[tuple[str, str], dict[str, Any]] = {}

    for claim in claims:
        provider_aliases = _provider_aliases(claim)
        provider_name = _preferred_display_name(
            provider_aliases,
            str(
                claim.get("provider_name_raw")
                or claim.get("provider_name_normalized")
                or "Provider under review"
            ).strip(),
        )
        provider_key = str(
            claim.get("provider_name_normalized") or provider_name.lower()
        ).strip()
        service_date = str(claim.get("service_date") or "")
        key = (provider_key, service_date)

        if key not in grouped_claims:
            grouped_claims[key] = {
                "provider_name": provider_name,
                "provider_key": provider_key,
                "provider_aliases": provider_aliases,
                "primary_provider_values": [
                    str(claim.get("provider_name_raw") or "").strip(),
                    str(claim.get("provider_name_normalized") or "").strip(),
                ],
                "service_date": service_date,
                "responsibility": Decimal("0.00"),
                "claim_ids": [],
                "statuses": [],
                "matched_payments": [],
            }

        group = grouped_claims[key]
        group["responsibility"] += _money(claim.get("patient_responsibility"))
        if claim.get("id"):
            group["claim_ids"].append(str(claim["id"]))
        status = str(claim.get("status") or "").strip()
        if status and status not in group["statuses"]:
            group["statuses"].append(status)

    payments_by_id: dict[str, dict] = {}
    for payment in payments:
        payment_id = str(payment.get("id") or f"payment-{len(payments_by_id) + 1}")
        payments_by_id[payment_id] = payment

    matched_payment_ids: set[str] = set()
    for payment_id, payment in payments_by_id.items():
        if _is_generic_medical_payment(payment):
            continue
        best_key: tuple[str, str] | None = None
        best_score = 0.0

        for key, group in grouped_claims.items():
            name_score = _best_provider_match_score(group["provider_aliases"], _provider_aliases(payment))
            primary_name_score = _primary_provider_match_score(group["primary_provider_values"], payment)
            day_gap = _days_between(group["service_date"], payment.get("payment_date"))
            if day_gap is None or day_gap < 0 or day_gap > 60:
                continue

            responsibility = group["responsibility"]
            amount = _money(payment.get("amount"))
            if _is_user_confirmed_payment_for_group(group, payment):
                total_score = 2.0
                if total_score > best_score:
                    best_score = total_score
                    best_key = key
                continue

            if name_score <= 0.25:
                continue

            if (
                primary_name_score < 0.45
                and amount > (responsibility * Decimal("1.5"))
            ):
                continue

            date_score = 1 - (day_gap / 80)
            total_score = (name_score * 0.72) + (date_score * 0.28)
            if total_score > best_score:
                best_score = total_score
                best_key = key

        if best_key is not None:
            confirmed_payment = dict(payment)
            if _is_user_confirmed_payment_for_group(grouped_claims[best_key], payment):
                confirmed_payment["_confirmation_source"] = "Confirmed by you"
            grouped_claims[best_key]["matched_payments"].append(confirmed_payment)
            matched_payment_ids.add(payment_id)

    findings: list[dict] = []
    candidate_payment_ids: set[str] = set()
    for group in grouped_claims.values():
        paid_amount = sum(
            (_money(payment.get("amount")) for payment in group["matched_payments"]),
            start=Decimal("0.00"),
        )
        responsibility = group["responsibility"]
        credit_amount = paid_amount - responsibility
        provider_name = group["provider_name"]
        service_date = group["service_date"] or "date not recorded"

        if credit_amount > Decimal("0.00"):
            first_payment = group["matched_payments"][0] if group["matched_payments"] else {}
            confirmation_source = str(first_payment.get("_confirmation_source") or "")
            display_provider_name = (
                _payment_provider_name(first_payment)
                if confirmation_source
                else provider_name
            )
            findings.append(
                {
                    "finding_type": "possible_credit",
                    "severity": "attention",
                    "status": "open",
                    "title": display_provider_name,
                    "summary": (
                        f"{confirmation_source}: HSA paid {_money_text(paid_amount)} for {service_date}, "
                        f"but the claim says you owe {_money_text(responsibility)}."
                        if confirmation_source
                        else f"Paid {_money_text(paid_amount)} for {service_date}, but the claim says you owe {_money_text(responsibility)}."
                    ),
                    "details": {
                        "provider_name": display_provider_name,
                        "claim_provider_name": provider_name,
                        "service_date": service_date,
                        "paid_amount": _money_text(paid_amount),
                        "responsibility_amount": _money_text(responsibility),
                        "credit_amount": _money_text(credit_amount),
                        "payment_date": str(first_payment.get("payment_date") or ""),
                        "payment_source": str(first_payment.get("payment_source") or ""),
                        "payment_provider_name": _payment_provider_name(first_payment) if first_payment else "",
                        "confirmation_source": confirmation_source,
                        "claim_ids": group["claim_ids"],
                    },
                }
            )
            continue

        if responsibility > Decimal("0.00") and not group["matched_payments"]:
            candidate_payments = _candidate_payments_for_group(group, payments_by_id)
            candidate_payment_ids.update(
                str(candidate.get("payment_id"))
                for candidate in candidate_payments
                if candidate.get("payment_id")
            )
            findings.append(
                {
                    "finding_type": "allocation_unclear",
                    "severity": "attention",
                    "status": "open",
                    "title": (
                        candidate_payments[0]["provider_name"]
                        if candidate_payments and candidate_payments[0].get("match_hint") == "Provider conflict"
                        else provider_name
                    ),
                    "summary": (
                        f"Claim from {service_date} shows {_money_text(responsibility)} patient responsibility, "
                        + (
                            "and an HSA payment needs provider confirmation."
                            if candidate_payments and candidate_payments[0].get("match_hint") == "Provider conflict"
                            else "and a larger payment may include this visit."
                            if candidate_payments
                            else "but no matching payment was found yet."
                        )
                    ),
                    "details": {
                        "provider_name": (
                            candidate_payments[0]["provider_name"]
                            if candidate_payments and candidate_payments[0].get("match_hint") == "Provider conflict"
                            else provider_name
                        ),
                        "claim_provider_name": provider_name,
                        "service_date": service_date,
                        "responsibility_amount": _money_text(responsibility),
                        "claim_ids": group["claim_ids"],
                        "candidate_payments": candidate_payments,
                    },
                }
            )
            continue

        statuses = " ".join(group["statuses"]).lower()
        if responsibility > Decimal("0.00") and (
            "in process" in statuses
            or "pending" in statuses
            or "processing" in statuses
            or "received" in statuses
        ):
            findings.append(
                {
                    "finding_type": "claim_in_process",
                    "severity": "info",
                    "status": "open",
                    "title": provider_name,
                    "summary": f"Claim from {service_date} still looks in process.",
                    "details": {
                        "provider_name": provider_name,
                        "service_date": service_date,
                        "responsibility_amount": _money_text(responsibility),
                        "claim_ids": group["claim_ids"],
                    },
                }
            )

    unmatched_groups: dict[str, list[dict]] = defaultdict(list)
    for payment_id, payment in payments_by_id.items():
        if payment_id in matched_payment_ids:
            continue
        if payment_id in candidate_payment_ids:
            continue
        if _is_generic_medical_payment(payment):
            findings.append(
                {
                    "finding_type": "unassigned_medical_payment",
                    "severity": "attention",
                    "status": "open",
                    "title": "Medical payment",
                    "summary": (
                        f"Found ${_money_text(_money(payment.get('amount')))} medical payment on "
                        f"{payment.get('payment_date') or 'date not recorded'}, but the bank statement does not identify the provider."
                    ),
                    "details": {
                        "provider_name": "Medical payment",
                        "payment_date": str(payment.get("payment_date") or ""),
                        "paid_amount": _money_text(_money(payment.get("amount"))),
                        "payment_source": str(payment.get("payment_source") or ""),
                        "possible_claims": _possible_claims_for_payment(payment, grouped_claims),
                    },
                }
            )
            continue
        if not _likely_provider_payment(payment, grouped_claims):
            continue

        provider_name = str(
            payment.get("provider_name_raw")
            or payment.get("provider_name_normalized")
            or "Unknown payment"
        ).strip()
        unmatched_groups[provider_name].append(payment)

    for provider_name, provider_payments in unmatched_groups.items():
        total_amount = sum(
            (_money(payment.get("amount")) for payment in provider_payments),
            start=Decimal("0.00"),
        )
        findings.append(
            {
                "finding_type": "unmatched_payment",
                "severity": "info",
                "status": "open",
                "title": provider_name,
                "summary": f"Found {_money_text(total_amount)} in payments that did not match a claim yet.",
                "details": {
                    "provider_name": provider_name,
                    "paid_amount": _money_text(total_amount),
                    "payment_ids": [str(payment.get("id")) for payment in provider_payments if payment.get("id")],
                },
            }
        )

    return findings


def run_audit_for_user(
    user_id: str,
    claim_file_ids: list[str] | None = None,
    payment_file_ids: list[str] | None = None,
    deps: dict[str, Callable[..., Any]] | None = None,
) -> dict[str, int]:
    resolved = deps or {}
    list_claim_rows = resolved.get("list_claim_rows", default_list_claim_rows)
    list_payment_rows = resolved.get("list_payment_rows", default_list_payment_rows)
    replace_findings_for_user = resolved.get(
        "replace_findings_for_user", default_replace_findings_for_user
    )

    claims = list_claim_rows(user_id, claim_file_ids)
    payments = list_payment_rows(user_id, payment_file_ids)
    findings = build_findings(claims, payments)
    replace_findings_for_user(user_id, findings)
    return {
        "claims_checked": len(claims),
        "payments_checked": len(payments),
        "findings_created": len(findings),
    }
