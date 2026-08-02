from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_findings_schema_allows_worker_finding_types():
    schema = (ROOT / "packages/db/schema/findings.sql").read_text()
    migration = (
        ROOT
        / "packages/db/migrations/0003_allow_unassigned_medical_payment_findings.sql"
    ).read_text()

    for finding_type in [
        "possible_credit",
        "allocation_unclear",
        "claim_in_process",
        "unmatched_payment",
        "unassigned_medical_payment",
    ]:
        assert finding_type in schema
        assert finding_type in migration
