# Cloud-persisted Demo Data

## Goal

Make the judge Demo usable from any computer during a live pitch. Demo visits, uploaded Past Credits files, and audit results must persist in the dedicated Supabase project while remaining isolated from the creator's personal account.

## Design

The existing fixed Demo user ID (`DEMO_JUDGE_USER_ID`) becomes a real Supabase Auth user created idempotently by the server using the service role. Request authentication will recognize the existing Demo cookie and return that fixed user ID. Existing visits, files, claims, payments, and findings repositories will therefore use the same ownership path as personal data.

The Demo login route remains cookie-based and does not send an email. Demo data is clearly labeled in the UI. No localStorage fallback is used, so a second computer can continue the same Demo workspace.

## Safety

- Demo user ID is fixed and separate from personal users.
- Demo writes are limited to the Demo cookie path.
- Personal Supabase sessions continue to use normal `auth.getUser()` authentication.
- Demo uploads use the existing storage and audit pipeline with the Demo user ID.

## Verification

Add tests for Demo request authentication and Demo visit persistence behavior, then run the focused web test suite and production build.
