# OweMe Health

OweMe Health is a personal medical and dental bill audit app. The long-term product combines file upload, claim and payment normalization, visit tracking, and audit findings such as possible credits, unclear payment allocation, and questionable canceled-visit charges.

## Repository shape

This repository now has two tracks:

- `oweme-health-prototype/`: the existing static prototype used to explore product flows
- `apps/web/`: the new Next.js app that will become the persisted product
- `services/worker/`: the Python worker for OCR, PDF extraction, normalization, and findings generation
- `packages/db/`: SQL schema and migrations
- `packages/shared/`: shared enums and types

## Privacy

Do not commit real medical files, real claims exports, real payment exports, backup JSON, or personal notes. Use synthetic demo data in any public demo or hackathon submission.

## Architecture

- Frontend: Next.js
- Platform: Supabase Auth + Postgres + Storage
- Processing: Python worker

The web app handles UI, auth, uploads, and APIs. The worker handles OCR, PDF extraction, normalization, and audit finding generation.

## Local backend bootstrap

Use the worker virtualenv for Python-based database checks and one-off migration applies:

```bash
cd services/worker
source .venv/bin/activate
```

Apply the current database migrations to the configured Supabase project:

```bash
python - <<'PY'
from pathlib import Path
import psycopg
from worker.config import load_config

config = load_config()
for name in [
    "0001_initial.sql",
    "0002_storage_policies.sql",
]:
    sql = Path("../../packages/db/migrations", name).read_text()
    with psycopg.connect(config.database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            print("applied", name)
PY
```

Verify the core public tables exist:

```bash
python - <<'PY'
import psycopg
from worker.config import load_config

config = load_config()
with psycopg.connect(config.database_url) as conn:
    with conn.cursor() as cur:
        cur.execute("""
        select table_name
          from information_schema.tables
         where table_schema = 'public'
           and table_name in (
             'profiles','files','file_jobs','visits','claims','payments','findings','manual_adjustments'
           )
         order by table_name
        """)
        print([row[0] for row in cur.fetchall()])
PY
```

Create the private uploads bucket once per project:

```bash
python - <<'PY'
from supabase import create_client
from worker.config import load_config

config = load_config()
client = create_client(config.supabase_url, config.supabase_service_role_key)
buckets = {bucket.id for bucket in client.storage.list_buckets()}
if config.uploads_bucket not in buckets:
    client.storage.create_bucket(config.uploads_bucket)
print(sorted(bucket.id for bucket in client.storage.list_buckets()))
PY
```
