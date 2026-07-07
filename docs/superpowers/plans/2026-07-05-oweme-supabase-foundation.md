# OweMe Supabase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first backend-backed OweMe Health foundation using Next.js, Supabase Auth/Postgres/Storage, and a separate Python worker that processes uploaded files into visits, claims, payments, findings, and file jobs.

**Architecture:** The web app handles auth, UI, API routes, and upload orchestration. Supabase provides identity, Postgres, and private file storage. A Python worker polls explicit file jobs, downloads source files, extracts and normalizes structured records, and writes deterministic outputs back to Postgres.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth, Supabase Postgres, Supabase Storage, Python 3.11+, SQLAlchemy or psycopg, pdfplumber, pypdf, pytest, Vitest or Jest, Playwright

## Global Constraints

- Use Supabase as the primary platform for auth, database, and storage.
- Keep OCR, PDF extraction, and normalization out of Next.js and inside the Python worker.
- Do not commit real medical files, real claim exports, real payment exports, or personal context data.
- Preserve both source files and normalized database outputs.
- Prefer explicit tables and explicit jobs over hidden automation.
- Keep the first implementation deterministic, debuggable, and small.

---

## File Structure

- Create: `apps/web/`
- Create: `apps/web/src/app/`
- Create: `apps/web/src/app/(app)/dashboard/page.tsx`
- Create: `apps/web/src/app/api/files/upload-init/route.ts`
- Create: `apps/web/src/app/api/files/finalize/route.ts`
- Create: `apps/web/src/app/api/jobs/[id]/route.ts`
- Create: `apps/web/src/app/api/visits/route.ts`
- Create: `apps/web/src/app/api/findings/route.ts`
- Create: `apps/web/src/lib/auth/`
- Create: `apps/web/src/lib/db/`
- Create: `apps/web/src/lib/files/`
- Create: `apps/web/src/lib/jobs/`
- Create: `apps/web/src/lib/validation/`
- Create: `packages/db/`
- Create: `packages/db/schema/`
- Create: `packages/db/migrations/`
- Create: `packages/shared/`
- Create: `packages/shared/src/`
- Create: `services/worker/`
- Create: `services/worker/worker/`
- Create: `services/worker/tests/`
- Create: `infra/docker/`

This plan assumes a new backend app is created alongside the existing static prototype rather than mutating the prototype in place.

### Task 1: Scaffold repository structure and environment contracts

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/.env.example`
- Create: `services/worker/pyproject.toml`
- Create: `services/worker/.env.example`
- Create: `packages/shared/src/types.ts`
- Create: `infra/docker/docker-compose.yml`
- Modify: `README.md` if it exists, otherwise create `README.md`

**Interfaces:**
- Consumes: none
- Produces:
  - `packages/shared/src/types.ts` exports `FindingType`, `FileKind`, `FileJobStatus`
  - web env contract names for Supabase and app URLs
  - worker env contract names for database and storage access

- [ ] **Step 1: Write the failing structure test**

Create `apps/web/package.json`, `services/worker/pyproject.toml`, and `packages/shared/src/types.ts`, then verify the required top-level directories exist.

```bash
test -d apps/web && test -d services/worker && test -d packages/shared
```

- [ ] **Step 2: Run the structure check to verify it fails before scaffolding**

Run: `test -d apps/web && test -d services/worker && test -d packages/shared`
Expected: non-zero exit status because the directories do not exist yet

- [ ] **Step 3: Create the minimal scaffold**

Add shared type definitions like:

```ts
export type FileKind = "claim" | "payment" | "eob" | "receipt" | "other";

export type FileJobStatus = "queued" | "running" | "succeeded" | "failed";

export type FindingType =
  | "possible_credit"
  | "allocation_unclear"
  | "questionable_canceled_charge"
  | "claim_in_process"
  | "unmatched_payment";
```

Create `.env.example` files with exact variables:

```dotenv
# apps/web/.env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

```dotenv
# services/worker/.env.example
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_UPLOADS=
WORKER_POLL_SECONDS=10
```

- [ ] **Step 4: Run the structure check to verify it passes**

Run: `test -d apps/web && test -d services/worker && test -d packages/shared`
Expected: zero exit status

- [ ] **Step 5: Commit**

```bash
git add apps/web services/worker packages/shared infra/docker README.md
git commit -m "chore: scaffold oweme web worker and shared packages"
```

### Task 2: Define database schema and migrations

**Files:**
- Create: `packages/db/schema/profiles.sql`
- Create: `packages/db/schema/files.sql`
- Create: `packages/db/schema/file_jobs.sql`
- Create: `packages/db/schema/visits.sql`
- Create: `packages/db/schema/claims.sql`
- Create: `packages/db/schema/payments.sql`
- Create: `packages/db/schema/findings.sql`
- Create: `packages/db/schema/manual_adjustments.sql`
- Create: `packages/db/migrations/0001_initial.sql`
- Create: `packages/db/schema/rls.sql`

**Interfaces:**
- Consumes:
  - `packages/shared/src/types.ts`
- Produces:
  - tables `profiles`, `files`, `file_jobs`, `visits`, `claims`, `payments`, `findings`, `manual_adjustments`
  - user-scoped RLS policies on all user-owned tables

- [ ] **Step 1: Write the failing migration smoke check**

Create a command that checks whether the initial migration exists and includes the required table names.

```bash
rg "create table .*files|create table .*file_jobs|create table .*visits|create table .*claims|create table .*payments|create table .*findings" packages/db/migrations/0001_initial.sql
```

- [ ] **Step 2: Run the migration smoke check to verify it fails**

Run: `rg "create table .*files|create table .*file_jobs|create table .*visits|create table .*claims|create table .*payments|create table .*findings" packages/db/migrations/0001_initial.sql`
Expected: file missing or no matches

- [ ] **Step 3: Write the initial SQL schema**

Use exact table names and include at minimum:

```sql
create table if not exists files (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  kind text not null,
  bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  file_size_bytes bigint,
  sha256 text,
  status text not null,
  uploaded_at timestamptz not null default now()
);
```

and:

```sql
create table if not exists file_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  file_id uuid not null references files(id) on delete cascade,
  job_type text not null,
  status text not null,
  attempt_count integer not null default 0,
  worker_version text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
```

Add RLS policies with `user_id = auth.uid()` semantics for user-facing tables.

- [ ] **Step 4: Run the migration smoke check to verify it passes**

Run: `rg "create table .*files|create table .*file_jobs|create table .*visits|create table .*claims|create table .*payments|create table .*findings" packages/db/migrations/0001_initial.sql`
Expected: matches for all required tables

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add initial oweme database schema"
```

### Task 3: Implement Supabase auth and web app bootstrap

**Files:**
- Create: `apps/web/src/lib/auth/server.ts`
- Create: `apps/web/src/lib/auth/client.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Produces:
  - authenticated app shell
  - login entrypoint
  - protected app routes

- [ ] **Step 1: Write the failing auth bootstrap test**

Create a minimal route or middleware assertion that redirects anonymous users from `/dashboard` to `/login`.

```ts
expect(redirectLocation).toBe("/login");
```

- [ ] **Step 2: Run the auth test to verify it fails**

Run: `npm test -- --runInBand auth` or the project's chosen test command
Expected: fail because auth bootstrap is not implemented

- [ ] **Step 3: Implement the minimal auth integration**

Create server and client Supabase helpers that read environment variables and expose authenticated session access. Protect the `(app)` route group through middleware or layout guard.

Required behavior:

- anonymous user hitting app pages is redirected
- authenticated user can reach `/dashboard`

- [ ] **Step 4: Run the auth test to verify it passes**

Run: `npm test -- --runInBand auth`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat: add supabase auth bootstrap for web app"
```

### Task 4: Implement file upload orchestration

**Files:**
- Create: `apps/web/src/app/api/files/upload-init/route.ts`
- Create: `apps/web/src/app/api/files/finalize/route.ts`
- Create: `apps/web/src/lib/files/create-upload.ts`
- Create: `apps/web/src/lib/files/finalize-upload.ts`
- Create: `apps/web/src/lib/validation/files.ts`

**Interfaces:**
- Consumes:
  - authenticated user session
  - table `files`
- Produces:
  - `POST /api/files/upload-init`
  - `POST /api/files/finalize`
  - `createUpload(input) -> { fileId: string, signedUrl: string, storagePath: string }`

- [ ] **Step 1: Write the failing upload-init test**

Test expected response shape:

```ts
expect(body).toEqual({
  fileId: expect.any(String),
  signedUrl: expect.any(String),
  storagePath: expect.stringContaining("uploads/")
});
```

- [ ] **Step 2: Run the upload-init test to verify it fails**

Run: `npm test -- --runInBand upload-init`
Expected: fail because the route does not exist

- [ ] **Step 3: Implement minimal upload-init and finalize flows**

Upload-init should:

- validate file metadata
- create a `files` row with status `uploaded`
- request a signed upload URL from Supabase Storage
- return identifiers needed by the frontend

Finalize should:

- verify the caller owns the `files` row
- confirm the file exists in storage
- leave the file row ready for job creation

- [ ] **Step 4: Run the upload-init test to verify it passes**

Run: `npm test -- --runInBand upload-init`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/files apps/web/src/lib/files apps/web/src/lib/validation/files.ts
git commit -m "feat: add supabase storage upload orchestration"
```

### Task 5: Implement file job creation and job status API

**Files:**
- Create: `apps/web/src/app/api/files/[id]/process/route.ts`
- Create: `apps/web/src/app/api/jobs/[id]/route.ts`
- Create: `apps/web/src/lib/jobs/create-job.ts`
- Create: `apps/web/src/lib/jobs/get-job.ts`

**Interfaces:**
- Consumes:
  - `files` table
  - authenticated user id
- Produces:
  - `POST /api/files/:id/process`
  - `GET /api/jobs/:id`
  - `createFileJob(fileId: string, jobType: string): Promise<{ id: string }>`

- [ ] **Step 1: Write the failing job creation test**

```ts
expect(body).toMatchObject({
  id: expect.any(String),
  status: "queued"
});
```

- [ ] **Step 2: Run the job creation test to verify it fails**

Run: `npm test -- --runInBand file-job`
Expected: fail because no process route exists

- [ ] **Step 3: Implement minimal job creation and lookup**

Behavior:

- process endpoint inserts a `file_jobs` row with `status = 'queued'`
- job lookup endpoint returns only jobs owned by the authenticated user

- [ ] **Step 4: Run the job creation test to verify it passes**

Run: `npm test -- --runInBand file-job`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/files apps/web/src/app/api/jobs apps/web/src/lib/jobs
git commit -m "feat: add file job creation and status api"
```

### Task 6: Build Python worker job loop and storage download path

**Files:**
- Create: `services/worker/worker/config.py`
- Create: `services/worker/worker/db.py`
- Create: `services/worker/worker/storage.py`
- Create: `services/worker/worker/jobs.py`
- Create: `services/worker/worker/main.py`
- Create: `services/worker/tests/test_jobs.py`

**Interfaces:**
- Consumes:
  - `file_jobs`
  - `files`
  - worker env variables
- Produces:
  - `poll_once() -> int`
  - `claim_next_job() -> Job | None`
  - `download_source_file(file_id: str) -> Path`

- [ ] **Step 1: Write the failing worker poll test**

```python
def test_poll_once_marks_a_queued_job_running():
    processed = poll_once()
    assert processed == 1
```

- [ ] **Step 2: Run the worker test to verify it fails**

Run: `pytest services/worker/tests/test_jobs.py -v`
Expected: fail because the worker modules do not exist

- [ ] **Step 3: Implement the minimal worker loop**

Implement:

```python
def poll_once() -> int:
    job = claim_next_job()
    if job is None:
        return 0
    mark_job_running(job.id)
    download_source_file(job.file_id)
    return 1
```

This task stops at claiming jobs and downloading source files. It does not yet parse PDFs.

- [ ] **Step 4: Run the worker test to verify it passes**

Run: `pytest services/worker/tests/test_jobs.py -v`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add services/worker
git commit -m "feat: add worker job polling and storage download"
```

### Task 7: Implement normalization pipeline contracts

**Files:**
- Create: `services/worker/worker/extract/__init__.py`
- Create: `services/worker/worker/extract/text.py`
- Create: `services/worker/worker/extract/tables.py`
- Create: `services/worker/worker/normalize/claims.py`
- Create: `services/worker/worker/normalize/payments.py`
- Create: `services/worker/tests/test_claim_normalization.py`
- Create: `services/worker/tests/test_payment_normalization.py`

**Interfaces:**
- Consumes:
  - local downloaded source file path
- Produces:
  - `extract_text(path: Path) -> str`
  - `extract_tables(path: Path) -> list[dict]`
  - `normalize_claim_rows(rows: list[dict]) -> list[dict]`
  - `normalize_payment_rows(rows: list[dict]) -> list[dict]`

- [ ] **Step 1: Write the failing normalization tests**

```python
def test_normalize_claim_rows_keeps_raw_and_normalized_provider_names():
    rows = [{"provider": "KIM,JAMES,D,DDS", "service_date": "2026-07-03"}]
    normalized = normalize_claim_rows(rows)
    assert normalized[0]["provider_name_raw"] == "KIM,JAMES,D,DDS"
    assert "provider_name_normalized" in normalized[0]
```

```python
def test_normalize_payment_rows_parses_amount_to_decimal_string():
    rows = [{"merchant": "Stone Creek Village Dentistry", "amount": "$78.00"}]
    normalized = normalize_payment_rows(rows)
    assert normalized[0]["amount"] == "78.00"
```

- [ ] **Step 2: Run the normalization tests to verify they fail**

Run: `pytest services/worker/tests/test_claim_normalization.py services/worker/tests/test_payment_normalization.py -v`
Expected: fail because normalization functions are missing

- [ ] **Step 3: Implement minimal normalization**

Rules:

- preserve the raw provider field
- produce a normalized provider field
- normalize date fields to ISO strings where possible
- normalize money values into database-safe decimal strings

Do not implement fuzzy matching or cross-row audit logic in this task.

- [ ] **Step 4: Run the normalization tests to verify they pass**

Run: `pytest services/worker/tests/test_claim_normalization.py services/worker/tests/test_payment_normalization.py -v`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add services/worker
git commit -m "feat: add claim and payment normalization contracts"
```

### Task 8: Persist claims and payments from completed jobs

**Files:**
- Create: `services/worker/worker/persist/claims.py`
- Create: `services/worker/worker/persist/payments.py`
- Modify: `services/worker/worker/jobs.py`
- Create: `services/worker/tests/test_persist_results.py`

**Interfaces:**
- Consumes:
  - normalized claim rows
  - normalized payment rows
  - `claims` and `payments` tables
- Produces:
  - `persist_claim_rows(user_id: str, file_id: str, rows: list[dict]) -> int`
  - `persist_payment_rows(user_id: str, file_id: str, rows: list[dict]) -> int`

- [ ] **Step 1: Write the failing persistence test**

```python
def test_persist_claim_rows_inserts_rows_for_a_file():
    inserted = persist_claim_rows("user-1", "file-1", [{"provider_name_raw": "A"}])
    assert inserted == 1
```

- [ ] **Step 2: Run the persistence test to verify it fails**

Run: `pytest services/worker/tests/test_persist_results.py -v`
Expected: fail because persistence helpers do not exist

- [ ] **Step 3: Implement minimal database persistence**

Behavior:

- claim rows write into `claims`
- payment rows write into `payments`
- each row includes `user_id`, `source_file_id`, and normalized payload
- job completion marks file status `processed`

- [ ] **Step 4: Run the persistence test to verify it passes**

Run: `pytest services/worker/tests/test_persist_results.py -v`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add services/worker
git commit -m "feat: persist normalized claims and payments"
```

### Task 9: Implement visits CRUD and findings read APIs

**Files:**
- Create: `apps/web/src/app/api/visits/route.ts`
- Create: `apps/web/src/app/api/visits/[id]/route.ts`
- Create: `apps/web/src/app/api/findings/route.ts`
- Create: `apps/web/src/lib/validation/visits.ts`
- Create: `apps/web/src/lib/visits/repository.ts`
- Create: `apps/web/src/lib/findings/repository.ts`

**Interfaces:**
- Consumes:
  - `visits`
  - `findings`
  - authenticated user id
- Produces:
  - `GET /api/visits`
  - `POST /api/visits`
  - `PATCH /api/visits/:id`
  - `GET /api/findings`

- [ ] **Step 1: Write the failing visits API test**

```ts
expect(Array.isArray(body.items)).toBe(true);
```

and:

```ts
expect(created.provider_name).toBe("Stone Creek Village Dentistry");
```

- [ ] **Step 2: Run the visits API test to verify it fails**

Run: `npm test -- --runInBand visits`
Expected: fail because no visits route exists

- [ ] **Step 3: Implement minimal visits and findings APIs**

Behavior:

- visits list only returns the authenticated user's rows
- visit create validates required fields
- visit patch allows user-owned updates
- findings list returns open findings ordered by newest first

- [ ] **Step 4: Run the visits API test to verify it passes**

Run: `npm test -- --runInBand visits`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/visits apps/web/src/app/api/findings apps/web/src/lib/validation apps/web/src/lib/visits apps/web/src/lib/findings
git commit -m "feat: add visits and findings api"
```

### Task 10: Generate first-pass findings in the worker

**Files:**
- Create: `services/worker/worker/audit/findings.py`
- Modify: `services/worker/worker/jobs.py`
- Create: `services/worker/tests/test_findings.py`

**Interfaces:**
- Consumes:
  - normalized claims
  - normalized payments
  - user visits
- Produces:
  - `generate_findings(user_id: str, file_id: str) -> list[dict]`

- [ ] **Step 1: Write the failing findings test**

```python
def test_generate_allocation_unclear_when_claim_has_patient_responsibility_but_no_matched_payment():
    findings = generate_findings("user-1", "file-1")
    assert findings[0]["finding_type"] == "allocation_unclear"
```

- [ ] **Step 2: Run the findings test to verify it fails**

Run: `pytest services/worker/tests/test_findings.py -v`
Expected: fail because the audit module does not exist

- [ ] **Step 3: Implement minimal finding generation**

Initial supported findings:

- `allocation_unclear`
- `claim_in_process`
- `questionable_canceled_charge`

Keep matching rules explicit. Do not add fuzzy heuristics beyond provider/date/amount checks in this task.

- [ ] **Step 4: Run the findings test to verify it passes**

Run: `pytest services/worker/tests/test_findings.py -v`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add services/worker
git commit -m "feat: add initial audit finding generation"
```

### Task 11: Build minimal dashboard UI for files, jobs, visits, and findings

**Files:**
- Create: `apps/web/src/app/(app)/dashboard/page.tsx`
- Create: `apps/web/src/components/upload-panel.tsx`
- Create: `apps/web/src/components/job-status-list.tsx`
- Create: `apps/web/src/components/visits-list.tsx`
- Create: `apps/web/src/components/findings-list.tsx`

**Interfaces:**
- Consumes:
  - `/api/files/upload-init`
  - `/api/files/:id/process`
  - `/api/jobs/:id`
  - `/api/visits`
  - `/api/findings`
- Produces:
  - one authenticated dashboard showing persisted data

- [ ] **Step 1: Write the failing dashboard render test**

```ts
expect(screen.getByText("Findings")).toBeInTheDocument();
expect(screen.getByText("Visits")).toBeInTheDocument();
```

- [ ] **Step 2: Run the dashboard test to verify it fails**

Run: `npm test -- --runInBand dashboard`
Expected: fail because dashboard components do not exist

- [ ] **Step 3: Implement the minimal dashboard**

The dashboard should include:

- upload panel
- job status panel
- visits list
- findings list

Do not recreate the entire static prototype in this task. This is a functional persistence-first dashboard.

- [ ] **Step 4: Run the dashboard test to verify it passes**

Run: `npm test -- --runInBand dashboard`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app apps/web/src/components
git commit -m "feat: add minimal persisted dashboard ui"
```

### Task 12: End-to-end verification and local run docs

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/upload-and-process.spec.ts`
- Create: `infra/docker/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes:
  - complete web and worker stack
- Produces:
  - documented local run path
  - e2e smoke test

- [ ] **Step 1: Write the failing end-to-end test**

```ts
test("user can upload a file and later see a job row", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Job status")).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test to verify it fails**

Run: `npx playwright test apps/web/tests/e2e/upload-and-process.spec.ts`
Expected: fail because the app and test harness are not fully wired

- [ ] **Step 3: Implement local run instructions and complete wiring**

Document:

- how to start Supabase
- how to run migrations
- how to start Next.js
- how to start the worker
- how to run the e2e smoke test

- [ ] **Step 4: Run the e2e test to verify it passes**

Run: `npx playwright test apps/web/tests/e2e/upload-and-process.spec.ts`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/tests/e2e infra/docker/README.md README.md
git commit -m "test: add end-to-end verification for oweme backend flow"
```
