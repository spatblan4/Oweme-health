import json
import socket
from contextlib import contextmanager
from functools import lru_cache
from urllib.parse import urlparse
from urllib.request import Request, urlopen


@lru_cache(maxsize=32)
def _resolve_supabase_ipv6(hostname: str) -> str | None:
    """Resolve Supabase direct DB hosts even when the local resolver drops AAAA records."""
    try:
        infos = socket.getaddrinfo(hostname, 5432, socket.AF_INET6, socket.SOCK_STREAM)
        if infos:
            return infos[0][4][0]
    except socket.gaierror:
        pass

    request = Request(
        f"https://dns.google/resolve?name={hostname}&type=AAAA",
        headers={"Accept": "application/dns-json"},
    )
    try:
        with urlopen(request, timeout=5) as response:
            payload = json.load(response)
    except OSError:
        return None

    for answer in payload.get("Answer") or []:
        if answer.get("type") == 28 and answer.get("data"):
            return answer["data"]

    return None


def _connection_kwargs(database_url: str) -> dict[str, str]:
    parsed = urlparse(database_url)
    hostname = parsed.hostname or ""
    if hostname.startswith("db.") and hostname.endswith(".supabase.co"):
        ipv6 = _resolve_supabase_ipv6(hostname)
        if ipv6:
            return {"hostaddr": ipv6}

    return {}


def connect():
    import psycopg

    from worker.config import load_config

    config = load_config()
    return psycopg.connect(
        config.database_url,
        row_factory=psycopg.rows.dict_row,
        **_connection_kwargs(config.database_url),
    )


@contextmanager
def get_cursor():
    with connect() as conn:
        with conn.cursor() as cur:
            yield cur


def claim_next_job():
    sql = """
    update file_jobs
       set status = 'running',
           attempt_count = attempt_count + 1,
           started_at = now()
     where id = (
       select id
         from file_jobs
        where status = 'queued'
        order by created_at asc
        for update skip locked
        limit 1
     )
    returning id, user_id, file_id, job_type
    """
    with get_cursor() as cur:
        cur.execute(sql)
        return cur.fetchone()


def mark_job_running(job_id: str):
    sql = """
    update file_jobs
       set status = 'running',
           started_at = coalesce(started_at, now())
     where id = %s
    """
    with get_cursor() as cur:
        cur.execute(sql, (job_id,))


def mark_job_succeeded(job_id: str):
    sql = """
    update file_jobs
       set status = 'succeeded',
           finished_at = now()
     where id = %s
    """
    with get_cursor() as cur:
        cur.execute(sql, (job_id,))


def mark_file_jobs_succeeded_for_file(file_id: str):
    sql = """
    update file_jobs
       set status = 'succeeded',
           started_at = coalesce(started_at, now()),
           finished_at = now()
     where file_id = %s
       and status in ('queued', 'running')
    """
    with get_cursor() as cur:
        cur.execute(sql, (file_id,))


def mark_file_processed(file_id: str):
    sql = """
    update files
       set status = 'processed'
     where id = %s
    """
    with get_cursor() as cur:
        cur.execute(sql, (file_id,))


def insert_claim_row(row: dict):
    sql = """
    insert into claims (
      id, user_id, source_file_id, provider_name_raw, provider_name_normalized,
      service_date, patient_responsibility, insurance_paid, billed_amount, allowed_amount,
      status, normalized_payload
    ) values (
      gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
    )
    """
    import json

    with get_cursor() as cur:
        cur.execute(
            sql,
            (
                row["user_id"],
                row["source_file_id"],
                row.get("provider_name_raw"),
                row.get("provider_name_normalized"),
                row.get("service_date"),
                row.get("patient_responsibility"),
                row.get("insurance_paid"),
                row.get("billed_amount"),
                row.get("allowed_amount"),
                row.get("status"),
                json.dumps(row["normalized_payload"]),
            ),
        )


def insert_payment_row(row: dict):
    sql = """
    insert into payments (
      id, user_id, source_file_id, provider_name_raw, provider_name_normalized,
      payment_date, amount, payment_source, normalized_payload
    ) values (
      gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s::jsonb
    )
    """
    import json

    with get_cursor() as cur:
        cur.execute(
            sql,
            (
                row["user_id"],
                row["source_file_id"],
                row.get("provider_name_raw"),
                row.get("provider_name_normalized"),
                row.get("payment_date"),
                row.get("amount"),
                row.get("payment_source"),
                json.dumps(row["normalized_payload"]),
            ),
        )


def delete_claim_rows_for_file(file_id: str):
    sql = "delete from claims where source_file_id = %s"
    with get_cursor() as cur:
        cur.execute(sql, (file_id,))


def delete_payment_rows_for_file(file_id: str):
    sql = "delete from payments where source_file_id = %s"
    with get_cursor() as cur:
        cur.execute(sql, (file_id,))


def list_claim_rows(user_id: str, source_file_ids: list[str] | None = None) -> list[dict]:
    sql = """
    select id, provider_name_raw, provider_name_normalized, service_date, patient_responsibility, status, normalized_payload
      from claims
     where user_id = %s
    """
    params: list = [user_id]
    if source_file_ids:
        sql += " and source_file_id = any(%s)"
        params.append(source_file_ids)
    sql += " order by service_date asc nulls last, created_at asc"
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall() or []


def list_payment_rows(user_id: str, source_file_ids: list[str] | None = None) -> list[dict]:
    sql = """
    select p.id, p.provider_name_raw, p.provider_name_normalized, p.payment_date, p.amount,
           p.payment_source, p.normalized_payload, p.source_file_id, f.original_name as source_file_name
      from payments p
      left join files f on f.id = p.source_file_id
     where p.user_id = %s
    """
    params: list = [user_id]
    if source_file_ids:
        sql += " and p.source_file_id = any(%s)"
        params.append(source_file_ids)
    sql += " order by p.payment_date asc nulls last, p.created_at asc"
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall() or []


def replace_findings_for_user(user_id: str, findings: list[dict]):
    delete_sql = "delete from findings where user_id = %s"
    insert_sql = """
    insert into findings (
      id, user_id, finding_type, severity, status, title, summary, details
    ) values (
      gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s::jsonb
    )
    """
    import json

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (user_id,))
            for finding in findings:
                cur.execute(
                    insert_sql,
                    (
                        user_id,
                        finding["finding_type"],
                        finding["severity"],
                        finding.get("status", "open"),
                        finding["title"],
                        finding["summary"],
                        json.dumps(finding.get("details", {})),
                    ),
                )


def get_file_record(file_id: str) -> dict | None:
    sql = """
    select id, original_name, bucket, storage_path, status
      from files
     where id = %s
    """
    with get_cursor() as cur:
        cur.execute(sql, (file_id,))
        return cur.fetchone()
