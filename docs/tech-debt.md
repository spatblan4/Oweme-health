# Tech Debt — OweMe Health

Follow-up items deferred after the 2026-07-08 work session (tasks 1–5, Plan A facility matching, Plan B Take Action). These are non-blocking unless marked **[deploy prerequisite]**.

## Deploy prerequisites (do before shipping)
- **Apply migration `0003_claims_facility.sql`** before deploying the worker. The worker writes/reads `claims.facility_name` / `facility_name_normalized`; without the column every claim-extraction and audit run fails with `column "facility_name" does not exist`.
- **Apply migration `0004_providers.sql`** before relying on the providers feature. `loadDashboardData` degrades gracefully (providers section empty) if the table is missing, but `POST/PATCH /api/providers` will 500.

## Security
- **Unsigned `oweme-user-id` cookie + `/api/*` not in middleware matcher.** `requireRequestUserId` (apps/web/src/lib/auth/request-user.ts) now reads only the httpOnly cookie (header-trust IDOR was closed), but the cookie is still unsigned and the API routes never re-verify the Supabase session per-request (apps/web/src/middleware.ts matcher excludes `/api/*`). Fix: switch API auth to a verified Supabase session (per-request `getUser()`) or a signed/encrypted cookie, and extend the matcher to `/api/*`.
- **New providers/findings RLS inert for the API path.** All provider mutations use `createAdminSupabaseClient()` (service-role), which bypasses RLS, so the policies in `0004_providers.sql` don't enforce on writes; authorization rests on the app-level `.eq("user_id", ...)` (apps/web/src/lib/providers/repository.ts:38-51). Fix: use a per-request user-scoped client (anon + user access token) for writes, or keep service-role only behind a verified userId.

## Business logic / correctness
- **Facility matching false positives.** `audit.py` facility scoring reuses `provider_match_score` (denominator `min(len(left), len(right))`, threshold 0.25); common institutional tokens like "hospital" / "imaging" / "associates" are not in the `_tokenize` stop list, so e.g. "Lakeside Hospital" vs "Riverside Hospital" scores 0.5 and can cross-match (audit.py:158-169). Fix: raise the facility threshold (e.g. `facility_score > 0.5` + ≥2 overlapping tokens) or add institutional stopwords.

## Performance
- **Redundant re-tokenization in the audit matching loop.** `build_findings` is O(payments × groups) and calls `_tokenize` on both sides every pair; the facility branch doubled tokenize calls per pair (audit.py:152-177). Fix: precompute group provider/facility tokens and per-payment tokens once (tokenize count ~4·P·G → ~2·G+2·P).

## Duplication / drift
- **Two provider-name normalization implementations.** TS `apps/web/src/lib/providers/normalize.ts` and Python `services/worker/worker/normalize/common.py:7` are currently output-equivalent but unguarded by a shared test; any single-side change silently breaks cross-language matching once a Python-stored `provider_name_normalized` is compared to a TS-normalized value. Fix: add a shared golden fixture consumed by both a TS and a Python test, or compute `name_normalized` in one place.
- **Inconsistent `Provider not found` HTTP status.** POST `/api/providers` maps it to 400 (apps/web/src/app/api/providers/route.ts:26) while PATCH `/api/providers/[id]` maps it to 404 (route.ts:20). Fix: add `message === "Provider not found" ? 404` to the POST route, or centralize error→status mapping.

## Robustness / races
- **`upsertProvider` check-then-act race.** `findOwnedByName` then `insertProvider` can collide on the unique `(user_id, name_normalized)` index under concurrent saves and surface a 400 instead of updating (apps/web/src/lib/providers/repository.ts:151-171). Fix: catch the unique-violation and retry via patch, or use `insert ... on conflict (user_id, name_normalized) do update`.
- **Worker loop lacks operational hardening.** `main.py` only catches `KeyboardInterrupt`; SIGTERM (container stop) is unhandled, stale `running` jobs are never requeued (`claim_next_job` selects only `queued`), and there is no backoff on repeated errors (services/worker/worker/main.py:8-18). Fix: SIGTERM handler that stops after the current poll; startup sweep that requeues `running` jobs older than N minutes; exponential backoff on errors.
- **PDF OCR default path relies on directory depth.** `DEFAULT_PDF_TO_TXT_SCRIPT` uses `Path(__file__).resolve().parents[4] / "tools" / "pdf_to_txt.py"` (services/worker/worker/extract/pdf.py:10-13); any non-monorepo-root deploy layout breaks it. Fix: set `OWEME_PDF_TO_TXT_SCRIPT` in the deploy env and ship `tools/pdf_to_txt.py` to a fixed path.

## Dead code (minor)
- `audit.py` group init sets `"matched_via": "provider"` which is always overwritten before the only read or never read (the read uses `.get(..., "provider")`).
- `ProviderContact.name` and `ProviderContact.email` are declared but `buildActionDraft` only reads `phone` (apps/web/src/lib/findings/draft-action.ts:11-13).

## Pre-existing (not in this session's diff)
- **`run-sync-audit.ts` hardcodes a Unix venv path** `services/worker/.venv/bin/python` (apps/web/src/lib/audit/run-sync-audit.ts:37); breaks on Windows and deploys without that exact path. Fix: resolve via `OWEME_WORKER_PYTHON` with a platform-aware fallback (`Scripts/python.exe` on win32).
- **No ESLint config** in apps/web; `next lint` requires interactive setup. Add `.eslintrc.json` + wire `npm run lint`.
