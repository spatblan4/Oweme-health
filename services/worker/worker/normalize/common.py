from datetime import date
from datetime import datetime
from decimal import Decimal
import re


def normalize_provider_name(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", " ", value).strip().lower()
    return re.sub(r"\s+", " ", cleaned)


def normalize_money(value: str | int | float | Decimal | None) -> str:
    if value is None:
        return "0.00"
    text = str(value).strip().replace("$", "").replace(",", "")
    negative = text.startswith("(") and text.endswith(")")
    text = text.replace("(", "").replace(")", "")
    amount = Decimal(text or "0")
    if negative:
        amount = amount * Decimal("-1")
    return f"{amount:.2f}"


def normalize_iso_date(value: str | date | datetime | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return text or None

