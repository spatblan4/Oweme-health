# OweMe Health Supabase Architecture Design

## Goal

Rebuild OweMe Health from a static prototype into a production-shaped personal medical bill audit app using Next.js, Supabase, and a separate Python worker, while preserving the current product focus: upload files, track visits, normalize claims and payments, generate findings, and support manual correction.

## Scope

This design covers one coherent subsystem: the first backend-backed version of OweMe Health.

Included:

- frontend and API architecture
- database and storage boundaries
- Python worker responsibilities
- core data model
- file processing flow
- security and privacy boundaries
- deployment shape

Excluded for now:

- advanced multi-user org features
- insurance portal integrations
- Gmail ingestion
- push notifications
- complex queue infrastructure
- OCR vendor selection beyond an interface boundary

## Product Constraints

- The app serves the user's real personal workflow first.
- The system must preserve original uploaded files and normalized structured outputs separately.
- Real personal medical data must never be committed into the public repo.
- The architecture should stay debuggable by one engineer.
- The first version should prefer explicit tables and explicit jobs over hidden automation.

## Chosen Architecture

### Stack

- Frontend: Next.js App Router with TypeScript
- Backend API: Next.js Route Handlers and server-side modules
- Auth: Supabase Auth
- Database: Supabase Postgres
- File storage: Supabase Storage
- Background processing: standalone Python worker

### Why this shape

This keeps Supabase in its strongest roles:

- identity
- Postgres
- file storage

It avoids forcing OCR and PDF extraction into serverless functions or frontend code. Heavy document processing stays in Python, where PDF and OCR tooling is better and operational behavior is easier to reason about.

## System Boundaries

### Next.js responsibilities

Next.js is responsible for:

- rendering the app
- handling authenticated user requests
- creating upload records
- issuing signed upload URLs
- creating processing jobs
- serving structured data to the UI
- accepting manual corrections and user actions

Next.js is not responsible for:

- OCR
- PDF table extraction
- claim normalization logic
- payment normalization logic
- long-running file processing

### Supabase responsibilities

Supabase is responsible for:

- user identity
- Postgres persistence
- row-level access control
- file storage buckets
- signed URLs for upload and download

Supabase is not treated as the main business logic runtime.

### Python worker responsibilities

The Python worker is responsible for:

- pulling queued jobs
- downloading source files from Storage
- extracting text and tables
- running OCR when needed
- normalizing claim and payment rows
- linking rows to visits when confidence is sufficient
- generating findings
- writing results back to Postgres
- updating job status and error detail

The worker must be idempotent at the job level. Re-running a job should update or replace derived rows deterministically instead of creating silent duplicates.

## Data Model

### `profiles`

Stores app-level user metadata linked to Supabase Auth.

Key fields:

- `id uuid primary key` same as auth user id
- `display_name text`
- `created_at timestamptz`

### `files`

Stores one row per uploaded source file.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `kind text not null` one of `claim`, `payment`, `eob`, `receipt`, `other`
- `bucket text not null`
- `storage_path text not null`
- `original_name text not null`
- `mime_type text`
- `file_size_bytes bigint`
- `sha256 text`
- `status text not null` one of `uploaded`, `processing`, `processed`, `failed`
- `uploaded_at timestamptz not null`

### `file_jobs`

Stores background processing tasks.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `file_id uuid not null`
- `job_type text not null` one of `extract_claims`, `extract_payments`, `normalize`, `audit`
- `status text not null` one of `queued`, `running`, `succeeded`, `failed`
- `attempt_count integer not null default 0`
- `worker_version text`
- `error_message text`
- `started_at timestamptz`
- `finished_at timestamptz`
- `created_at timestamptz not null`

### `visits`

Stores user-visible visit records.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `provider_name text not null`
- `provider_name_normalized text`
- `visit_type text` one of `medical`, `dental`, `vision`, `other`
- `visit_date date not null`
- `status text not null` one of `expected`, `attended`, `canceled`, `unknown`
- `insurance_name text`
- `paid_amount numeric(12,2)`
- `payment_method text`
- `reimbursement_needed boolean not null default false`
- `claim_check_after date`
- `next_appointment_at timestamptz`
- `notes text`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `claims`

Stores normalized claim or EOB rows derived from uploaded files.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `visit_id uuid`
- `source_file_id uuid not null`
- `source_job_id uuid`
- `provider_name_raw text`
- `provider_name_normalized text`
- `claim_number text`
- `service_date date`
- `patient_responsibility numeric(12,2)`
- `insurance_paid numeric(12,2)`
- `billed_amount numeric(12,2)`
- `allowed_amount numeric(12,2)`
- `status text`
- `normalized_payload jsonb not null`
- `created_at timestamptz not null`

### `payments`

Stores normalized payment rows derived from statements, receipts, or manually entered records.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `visit_id uuid`
- `source_file_id uuid`
- `source_job_id uuid`
- `provider_name_raw text`
- `provider_name_normalized text`
- `payment_date date`
- `amount numeric(12,2) not null`
- `payment_method text`
- `payment_source text`
- `normalized_payload jsonb not null`
- `created_at timestamptz not null`

### `findings`

Stores audit outputs shown to the user for review.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `visit_id uuid`
- `claim_id uuid`
- `payment_id uuid`
- `finding_type text not null`
- `severity text not null` one of `info`, `attention`, `urgent`
- `status text not null` one of `open`, `resolved`, `dismissed`
- `title text not null`
- `summary text not null`
- `details jsonb not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `manual_adjustments`

Stores user corrections that should override or augment extracted data.

Key fields:

- `id uuid primary key`
- `user_id uuid not null`
- `target_type text not null` one of `visit`, `claim`, `payment`, `finding`
- `target_id uuid not null`
- `field_name text not null`
- `previous_value jsonb`
- `new_value jsonb not null`
- `reason text`
- `created_at timestamptz not null`

## Core Rules

### Rule 1: original files are immutable

Uploaded files are never edited in place. Any derived value must be stored in Postgres, not written back into the file.

### Rule 2: raw and normalized data both matter

Provider names, dates, and amounts often need later verification. The system stores raw values and normalized values separately where ambiguity exists.

### Rule 3: findings are derived records

`findings` are outputs of matching and audit logic. They are not source-of-truth billing records.

### Rule 4: manual correction must survive reprocessing

If the user manually marks a visit as canceled or corrects a provider mapping, re-running processing must preserve the correction through explicit override rules or adjustment rows.

### Rule 5: every job is explicit

No hidden asynchronous side effects. Processing work always has a `file_jobs` row with visible status and error state.

## Request and Processing Flow

### Upload flow

1. User signs in with Supabase Auth.
2. Frontend asks Next.js for an upload session.
3. Next.js creates a `files` row with status `uploaded`.
4. Next.js returns a signed Supabase Storage upload URL.
5. Frontend uploads directly to Storage.
6. Frontend calls a finalize endpoint.
7. Next.js creates one or more `file_jobs` rows.
8. UI shows the file and job as pending.

### Processing flow

1. Python worker polls `file_jobs` where status is `queued`.
2. Worker marks a job `running`.
3. Worker downloads the source file from Storage using service credentials.
4. Worker extracts text, tables, and OCR output as needed.
5. Worker normalizes rows into `claims` or `payments`.
6. Worker links structured rows to visits where possible.
7. Worker generates `findings`.
8. Worker marks the job `succeeded` or `failed`.
9. UI refreshes from database-backed endpoints.

### Manual correction flow

1. User edits a visit, claim, payment, or finding context in the UI.
2. Next.js writes the correction and optionally a `manual_adjustments` row.
3. If needed, user triggers reprocess.
4. Worker re-runs matching using manual overrides as higher-priority inputs.

## Matching and Audit Strategy

The first backend version should keep matching deterministic and understandable.

Inputs:

- normalized provider names
- service dates
- payment dates
- amount proximity
- visit records entered by the user
- manual correction overrides

Initial finding types:

- `possible_credit`
- `allocation_unclear`
- `questionable_canceled_charge`
- `claim_in_process`
- `unmatched_payment`

The worker should produce a confidence-driven result rather than hiding uncertainty. Low-confidence matches should become findings, not silent links.

## Security and Privacy

### Auth and access

- All application reads and writes are scoped by Supabase Auth user id.
- Row Level Security must be enabled on all user-owned tables.
- The Python worker uses service-role credentials and must always write with explicit `user_id`.

### Storage

- Source documents live in private buckets.
- Public buckets are not used for real medical files.
- Download access for the UI should use short-lived signed URLs.

### Repo hygiene

The public repo must not include:

- real uploaded files
- real JSON exports
- context documents with personal data
- seeded real provider or claim data

The production app and the public demo must use different environments and different seed data.

## Deployment Shape

### Services

- `web`: Next.js app
- `worker`: Python processing service
- `db`: Supabase Postgres
- `storage`: Supabase Storage

### Runtime shape

The first production-shaped version may use:

- hosted Supabase for auth, Postgres, and storage
- one deployed Next.js app
- one deployed Python worker container

This is enough for a real personal workflow without introducing queue infrastructure or event buses.

## File and Module Layout

Recommended repository shape:

```text
apps/
  web/
services/
  worker/
packages/
  db/
  shared/
docs/
  superpowers/
    specs/
    plans/
```

### `apps/web`

- Next.js routes
- authenticated pages
- upload endpoints
- visit, claim, payment, and findings APIs

### `services/worker`

- job polling loop
- storage client
- OCR and PDF extraction
- normalization pipeline
- audit pipeline

### `packages/db`

- schema definitions
- migrations
- database access helpers

### `packages/shared`

- shared enums
- finding type constants
- validation schemas

## Testing Strategy

### Web

- unit tests for request validation and service functions
- integration tests for API routes against a test database

### Worker

- unit tests for normalization rules
- golden tests for representative claim and payment files using fake data
- integration tests for job lifecycle transitions

### End-to-end

- upload file -> create job -> worker writes results -> UI displays findings

The first implementation should prioritize tests around normalization and job idempotency, because those are the most failure-prone areas.

## Milestones

### Milestone 1

Backend foundation:

- Supabase Auth
- Supabase Postgres schema
- Supabase Storage upload flow
- Next.js authenticated shell

### Milestone 2

File processing foundation:

- `files` and `file_jobs`
- Python worker polling
- claim and payment extraction pipeline

### Milestone 3

Structured product workflows:

- visits CRUD
- findings generation
- manual corrections
- audit review screens

## Recommendation

Build the first backend version as a straightforward three-part system:

- Next.js for UI and API orchestration
- Supabase for auth, database, and storage
- Python worker for all document processing

This is the smallest architecture that supports real persistence, private file handling, and future OCR without locking the app into frontend-only storage or serverless document parsing.
