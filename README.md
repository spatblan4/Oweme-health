# OweMe Health

OweMe Health is a personal medical and dental bill follow-up app. It helps you record what you paid, wait for an insurance EOB, compare the EOB with your payment, and review potential overpayments or refunds.

## Repository shape

This repository now has two tracks:

- `oweme-health-prototype/`: the existing static prototype used to explore product flows
- `apps/web/`: the new Next.js app that will become the persisted product
- `services/worker/`: the Python worker for OCR, PDF extraction, normalization, and findings generation
- `packages/db/`: SQL schema and migrations
- `packages/shared/`: shared enums and types

## Privacy

Do not commit real medical files, claims exports, payment exports, backup JSON, or personal notes. The files in `demo-data/` are synthetic and safe for a public demo; use those instead of personal records. OweMe does not automatically retrieve EOBs or guarantee a refund.

## Architecture

- Frontend: Next.js
- Platform: Supabase Auth + Postgres + Storage
- Processing: Python worker

The web app handles UI, auth, uploads, and APIs. The worker handles OCR, PDF extraction, normalization, and audit finding generation.

## Run the web app

```bash
cd apps/web
npm install
npm run dev       # local development
npm test          # Vitest suite
npm run build     # production build check
```

The worker runtime is required for a real audit. Set the Supabase/database environment variables from the existing `.env.example` files, create the private uploads bucket, and apply the migrations below before using uploads.

## Hackathon demo path

Use an authenticated personal or dev-test account for the upload-and-audit recording; the judge demo shortcut is a synthetic presentation mode and does not provide the authenticated upload/audit backend path.

1. Open **Past bills** and upload `demo-data/oweme-synthetic-claims.csv` as the claims/EOB file.
2. Upload `demo-data/oweme-synthetic-hsa-transactions.csv` and `demo-data/oweme-synthetic-apple-card.csv` as payment files.
3. Select **Run audit**, wait for the results refresh, then open the review queue and **Action Center** for next steps.

The synthetic files are intentionally invented. The expected story includes potential overpayments that still need provider confirmation, unmatched claims, and an unassigned medical payment—not guaranteed refunds.

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
    "0003_allow_unassigned_medical_payment_findings.sql",
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
