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
    cleaned = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())
    return [token for token in cleaned.split() if len(token) > 1 and token not in stop]


def provider_match_score(left: Any, right: Any) -> float:
    left_tokens = _tokenize(left)
    right_tokens = _tokenize(right)
    if not left_tokens or not right_tokens:
        return 0.0
    right_set = set(right_tokens)
    overlap = len([token for token in left_tokens if token in right_set])
    return overlap / min(len(left_tokens), len(right_tokens))


def _likely_provider_payment(payment: dict, grouped_claims: dict[tuple[str, str], dict[str, Any]]) -> bool:
    provider_name = str(
        payment.get("provider_name_raw") or payment.get("provider_name_normalized") or ""
    )
    text = provider_name.lower()
    if re.search(
        r"\b(dental|dentist|dds|dmd|medical|clinic|hospital|health|care|orthodont|orthodontics|vision|optometr|doctor|physician|surgery|dermatology|radiology|imaging|laboratory|labcorp|quest|obgyn|obstetric|gynecolog|pediatric|pharmac|urgent)\b",
        text,
    ):
        return True

    return any(
        provider_match_score(group["provider_name"], provider_name) > 0.28
        for group in grouped_claims.values()
    )


def _days_between(left: Any, right: Any) -> int | None:
    left_date = _parse_date(left)
    right_date = _parse_date(right)
    if not left_date or not right_date:
        return None
    return (right_date - left_date).days


def build_findings(claims: list[dict], payments: list[dict]) -> list[dict]:
    grouped_claims: dict[tuple[str, str], dict[str, Any]] = {}

    for claim in claims:
        provider_name = str(
            claim.get("provider_name_raw")
            or claim.get("provider_name_normalized")
            or "Provider under review"
        ).strip()
        provider_key = str(
            claim.get("provider_name_normalized") or provider_name.lower()
        ).strip()
        facility_name = str(
            claim.get("facility_name")
            or claim.get("facility_name_normalized")
            or ""
        ).strip()
        service_date = str(claim.get("service_date") or "")
        facility_key = str(
            claim.get("facility_name_normalized") or facility_name.lower() or ""
        ).strip()
        key = (provider_key, facility_key, service_date)

        if key not in grouped_claims:
            grouped_claims[key] = {
                "provider_name": provider_name,
                "provider_key": provider_key,
                "facility_name": facility_name,
                "service_date": service_date,
                "responsibility": Decimal("0.00"),
                "claim_ids": [],
                "statuses": [],
                "matched_payments": [],
                "matched_via": "provider",
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
        best_key: tuple[str, str] | None = None
        best_score = 0.0
        best_via = "provider"

        for key, group in grouped_claims.items():
            provider_score = provider_match_score(
                group["provider_name"], payment.get("provider_name_raw")
            )
            facility_score = (
                provider_match_score(group["facility_name"], payment.get("provider_name_raw"))
                if group["facility_name"]
                else 0.0
            )
            name_score = max(provider_score, facility_score)
            via = "facility" if facility_score > provider_score and facility_score > 0 else "provider"
            day_gap = _days_between(group["service_date"], payment.get("payment_date"))
            if day_gap is None or day_gap < 0 or day_gap > 60 or name_score <= 0.25:
                continue

            date_score = 1 - (day_gap / 80)
            total_score = (name_score * 0.72) + (date_score * 0.28)
            if total_score > best_score:
                best_score = total_score
                best_key = key
                best_via = via

        if best_key is not None:
            grouped_claims[best_key]["matched_payments"].append(payment)
            grouped_claims[best_key]["matched_via"] = best_via
            matched_payment_ids.add(payment_id)

    findings: list[dict] = []
    for group in grouped_claims.values():
        paid_amount = sum(
            (_money(payment.get("amount")) for payment in group["matched_payments"]),
            start=Decimal("0.00"),
        )
        responsibility = group["responsibility"]
        credit_amount = paid_amount - responsibility
        provider_name = group["provider_name"]
        facility_name = group["facility_name"]
        matched_via = group.get("matched_via", "provider")
        display_name = facility_name if matched_via == "facility" and facility_name else provider_name
        service_date = group["service_date"] or "date not recorded"

        if credit_amount > Decimal("0.00"):
            findings.append(
                {
                    "finding_type": "possible_credit",
                    "severity": "attention",
                    "status": "open",
                    "title": display_name,
                    "summary": f"Paid {_money_text(paid_amount)} for {service_date}, but the claim says you owe {_money_text(responsibility)}.",
                    "details": {
                        "provider_name": display_name,
                        "facility_name": facility_name,
                        "service_date": service_date,
                        "paid_amount": _money_text(paid_amount),
                        "responsibility_amount": _money_text(responsibility),
                        "credit_amount": _money_text(credit_amount),
                        "matched_via": matched_via,
                        "claim_ids": group["claim_ids"],
                    },
                }
            )
            continue

        if responsibility > Decimal("0.00") and not group["matched_payments"]:
            findings.append(
                {
                    "finding_type": "allocation_unclear",
                    "severity": "attention",
                    "status": "open",
                    "title": display_name,
                    "summary": f"Claim from {service_date} shows {_money_text(responsibility)} patient responsibility, but no matching payment was found yet.",
                    "details": {
                        "provider_name": display_name,
                        "facility_name": facility_name,
                        "service_date": service_date,
                        "responsibility_amount": _money_text(responsibility),
                        "claim_ids": group["claim_ids"],
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
                    "title": display_name,
                    "summary": f"Claim from {service_date} still looks in process.",
                    "details": {
                        "provider_name": display_name,
                        "facility_name": facility_name,
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
