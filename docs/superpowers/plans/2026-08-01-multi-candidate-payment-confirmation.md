# Multi-candidate Payment Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Past Credits multi-candidate confirmation flow so Stone Creek-style findings can confirm exact selected payment IDs, show selected total vs EOB responsibility, persist the confirmation, and update the left card away from `Needs review` / `2 possible`.

**Architecture:** Keep matching/audit generation unchanged. Treat this as a user-confirmed allocation overlay stored on the existing finding `details` JSON, with exact selected candidate `payment_id`s validated server-side and reflected in the client state returned from `PATCH /api/findings/[id]`.

**Tech Stack:** Next.js App Router, React/TypeScript, Vitest, Supabase-backed repository helpers, existing `findings.details` JSONB, existing `manual_adjustments` audit log.

## Global Constraints

- Work only in the live checkout `/Users/chongchongchao/Documents/hospital` on branch `codex/preserve-live-oweme-20260801`.
- Do not change matching rules, worker allocation logic, audit data, or database data.
- Do not operate the user's browser profile.
- Use strict TDD: write or replace the failing test, run it red, implement minimal code, run it green.
- Replace the stale queue-hiding RED test in `apps/web/src/components/dashboard.test.tsx`; do not keep a test that expects confirmed Stone Creek to disappear without showing the confirmed total.
- Confirmed payment state must persist exact selected candidate payment IDs and selected candidate amounts.
- All valid candidate payments default selected when no previous confirmation exists.
- Confirmed selections must remain editable.

---

## File Structure

- Modify: `apps/web/src/lib/findings/repository.ts`
  - Extend finding action validation and persistence for `confirm_match` with `paymentIds`.
  - Validate selected IDs against `details.candidate_payments`.
  - Persist confirmation fields on `details`.
  - Write previous/new confirmation details to `manual_adjustments`.
- Modify: `apps/web/src/lib/findings/repository.test.ts`
  - Add repository RED/GREEN coverage for selected candidate persistence, unknown IDs, empty IDs, and revision.
- Modify: `apps/web/src/components/dashboard-shell.tsx`
  - Add checkbox selection state for candidate payments.
  - Show selected-total / EOB responsibility / possible-credit summary.
  - Send selected `paymentIds` in confirm payload.
  - Render confirmed left-card state and revision path.
- Modify: `apps/web/src/components/dashboard.test.tsx`
  - Replace the stale queue-hiding regression with approved confirmed-total behavior tests.
  - Add UI tests for default selected candidates, summary, payload, confirmed card, and revision path.
- Leave unchanged: `apps/web/src/app/api/findings/[id]/route.ts`
  - It already forwards the parsed JSON body to `applyFindingAction` and returns repository errors as 400 responses.

### Task 1: Replace the stale RED test with approved UI regressions

**Files:**
- Modify: `apps/web/src/components/dashboard.test.tsx`

**Interfaces:**
- Consumes:
  - `DashboardShell` exported from `apps/web/src/components/dashboard-shell.tsx`
  - existing `renderToStaticMarkup`
- Produces:
  - failing tests that define the approved UI behavior before implementation

- [ ] **Step 1: Remove the stale queue-hiding test**

In `apps/web/src/components/dashboard.test.tsx`, remove the test named:

```ts
it("does not keep a resolved candidate finding in the pending review queue", () => {
  // stale expectation: hides confirmed finding
});
```

Do not remove the existing test named `shows multiple candidate payments without collapsing them into a single payment record`.

- [ ] **Step 2: Add a failing confirmed-left-card rendering test**

Add this test after the existing multi-candidate rendering test:

```tsx
it("shows confirmed payment total and possible credit on the left card", () => {
  const html = renderToStaticMarkup(
    <DashboardShell
      jobs={[]}
      visits={[]}
      findings={[
        {
          id: "stone-creek-confirmed",
          provider_name: "Stone Creek Village De",
          finding_type: "allocation_unclear",
          status: "resolved",
          title: "Stone Creek Village De",
          details: {
            provider_name: "Stone Creek Village De",
            service_date: "2026-05-13",
            responsibility_amount: "12.40",
            confirmed_payment_ids: ["payment-133", "payment-142"],
            confirmed_paid_amount: "275.00",
            confirmed_responsibility_amount: "12.40",
            confirmed_credit_amount: "262.60",
            confirmed_payments: [
              {
                payment_id: "payment-133",
                provider_name: "Stone Creek Village De",
                payment_date: "2026-05-13",
                amount: "133.00",
                payment_source_label: "Apple Card",
              },
              {
                payment_id: "payment-142",
                provider_name: "Stone Creek Village De",
                payment_date: "2026-05-13",
                amount: "142.00",
                payment_source_label: "Apple Card",
              },
            ],
            candidate_payments: [
              {
                payment_id: "payment-133",
                provider_name: "Stone Creek Village De",
                payment_date: "2026-05-13",
                amount: "133.00",
                payment_source_label: "Apple Card",
              },
              {
                payment_id: "payment-142",
                provider_name: "Stone Creek Village De",
                payment_date: "2026-05-13",
                amount: "142.00",
                payment_source_label: "Apple Card",
              },
            ],
          },
        },
      ]}
      initialView="past"
    />,
  );

  const reviewCard =
    html.match(/<button type="button" data-testid="review-finding-stone-creek-confirmed"[\s\S]*?<\/button>/)?.[0] ?? "";

  expect(reviewCard).toContain("Confirmed");
  expect(reviewCard).toContain("Confirmed payments");
  expect(reviewCard).toContain("275.00");
  expect(reviewCard).toContain("Apple Card");
  expect(reviewCard).toContain("$262.60");
  expect(reviewCard).not.toContain("Needs review");
  expect(reviewCard).not.toContain("2 possible");
});
```

- [ ] **Step 3: Add a failing checkbox default/summary test**

Add this test in the same file:

```tsx
it("renders candidate payment checkboxes selected by default with a selected-total summary", () => {
  const html = renderToStaticMarkup(
    <DashboardShell
      jobs={[]}
      visits={[]}
      findings={[
        {
          id: "stone-creek-review",
          provider_name: "Stone Creek Village De",
          finding_type: "allocation_unclear",
          status: "open",
          title: "Stone Creek Village De",
          details: {
            provider_name: "Stone Creek Village De",
            service_date: "2026-05-13",
            responsibility_amount: "12.40",
            candidate_payments: [
              {
                payment_id: "payment-133",
                provider_name: "Stone Creek Village De",
                payment_date: "2026-05-13",
                amount: "133.00",
                payment_source_label: "Apple Card",
              },
              {
                payment_id: "payment-142",
                provider_name: "Stone Creek Village De",
                payment_date: "2026-05-13",
                amount: "142.00",
                payment_source_label: "Apple Card",
              },
            ],
          },
        },
      ]}
      initialView="past"
    />,
  );

  expect(html).toContain('type="checkbox"');
  expect(html.match(/type="checkbox" checked=""/g)?.length).toBe(2);
  expect(html).toContain("Selected payments: $275.00 across 2 payments");
  expect(html).toContain("EOB responsibility: $12.40");
  expect(html).toContain("Possible credit: $262.60");
  expect(html).toContain("Confirm selected payments match");
});
```

- [ ] **Step 4: Run UI tests to verify RED**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/components/dashboard.test.tsx
```

Expected: FAIL because current UI still renders display-only candidate rows, has no selected-total summary, and does not render confirmed left-card totals.

### Task 2: Add repository validation and persistence for selected payment IDs

**Files:**
- Modify: `apps/web/src/lib/findings/repository.test.ts`
- Modify: `apps/web/src/lib/findings/repository.ts`

**Interfaces:**
- Consumes:
  - existing `applyFindingAction(userId, findingId, input, deps)`
  - existing `details.candidate_payments` array shape
- Produces:
  - `confirm_match` accepts `{ paymentIds: string[] }`
  - returned `item.details` includes `confirmed_payment_ids`, `confirmed_payments`, `confirmed_paid_amount`, `confirmed_responsibility_amount`, `confirmed_credit_amount`, `confirmation_source`

- [ ] **Step 1: Add a failing repository persistence test**

Append this test to `apps/web/src/lib/findings/repository.test.ts`:

```ts
it("persists selected candidate payment IDs and totals when confirming a match", async () => {
  const existing = {
    id: "finding-1",
    status: "open",
    details: {
      responsibility_amount: "12.40",
      candidate_payments: [
        {
          payment_id: "payment-133",
          amount: "133.00",
          payment_date: "2026-05-13",
          provider_name: "Stone Creek Village De",
          payment_source_label: "Apple Card",
        },
        {
          payment_id: "payment-142",
          amount: "142.00",
          payment_date: "2026-05-13",
          provider_name: "Stone Creek Village De",
          payment_source_label: "Apple Card",
        },
      ],
    },
  };
  const getOwnedFinding = vi.fn().mockResolvedValue(existing);
  const patchOwnedFinding = vi.fn().mockImplementation(async (_userId, _findingId, patch) => ({
    ...existing,
    ...patch,
  }));
  const insertManualAdjustment = vi.fn().mockResolvedValue(undefined);

  const result = await applyFindingAction(
    "user-1",
    "finding-1",
    { action: "confirm_match", paymentIds: ["payment-133", "payment-142"] },
    {
      getOwnedFinding,
      patchOwnedFinding,
      insertManualAdjustment,
      now: () => "2026-08-01T12:00:00.000Z",
    },
  );

  expect(patchOwnedFinding).toHaveBeenCalledWith(
    "user-1",
    "finding-1",
    expect.objectContaining({
      status: "resolved",
      details: expect.objectContaining({
        confirmed_payment_ids: ["payment-133", "payment-142"],
        confirmed_paid_amount: "275.00",
        confirmed_responsibility_amount: "12.40",
        confirmed_credit_amount: "262.60",
        confirmation_source: "Confirmed by you",
      }),
    }),
  );
  expect(result.item.details.confirmed_payments).toHaveLength(2);
  expect(insertManualAdjustment).toHaveBeenCalledWith(
    expect.objectContaining({
      field_name: "confirmed_payments",
      previous_value: null,
      new_value: expect.objectContaining({
        payment_ids: ["payment-133", "payment-142"],
        confirmed_paid_amount: "275.00",
        confirmed_credit_amount: "262.60",
      }),
    }),
  );
});
```

- [ ] **Step 2: Add failing validation tests**

Append:

```ts
it("rejects an unknown selected payment ID", async () => {
  await expect(
    applyFindingAction(
      "user-1",
      "finding-1",
      { action: "confirm_match", paymentIds: ["payment-not-a-candidate"] },
      {
        getOwnedFinding: vi.fn().mockResolvedValue({
          id: "finding-1",
          status: "open",
          details: {
            responsibility_amount: "12.40",
            candidate_payments: [{ payment_id: "payment-133", amount: "133.00" }],
          },
        }),
        patchOwnedFinding: vi.fn(),
        insertManualAdjustment: vi.fn(),
        now: () => "2026-08-01T12:00:00.000Z",
      },
    ),
  ).rejects.toThrow("Selected payment is not a candidate for this finding");
});

it("rejects an empty selected payment list for candidate findings", async () => {
  await expect(
    applyFindingAction(
      "user-1",
      "finding-1",
      { action: "confirm_match", paymentIds: [] },
      {
        getOwnedFinding: vi.fn().mockResolvedValue({
          id: "finding-1",
          status: "open",
          details: {
            responsibility_amount: "12.40",
            candidate_payments: [{ payment_id: "payment-133", amount: "133.00" }],
          },
        }),
        patchOwnedFinding: vi.fn(),
        insertManualAdjustment: vi.fn(),
        now: () => "2026-08-01T12:00:00.000Z",
      },
    ),
  ).rejects.toThrow("Select at least one payment to confirm");
});
```

- [ ] **Step 3: Run repository tests to verify RED**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/lib/findings/repository.test.ts
```

Expected: FAIL because the schema currently accepts only `{ action }` and persistence does not compute confirmation fields.

- [ ] **Step 4: Implement minimal repository helpers**

In `apps/web/src/lib/findings/repository.ts`, add helper functions near `findingActionDetails`:

```ts
function recordDetails(record: FindingRecord) {
  const raw = record.details;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function candidatePaymentsFromDetails(details: Record<string, unknown>) {
  const raw = details.candidate_payments;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function parseMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function confirmationFromPaymentIds(existing: FindingRecord, paymentIds: string[]) {
  const details = recordDetails(existing);
  const candidates = candidatePaymentsFromDetails(details);
  if (!candidates.length) {
    return null;
  }

  const selectedIds = Array.from(new Set(paymentIds.filter(Boolean)));
  if (!selectedIds.length) {
    throw new Error("Select at least one payment to confirm");
  }

  const candidateById = new Map(
    candidates
      .filter((candidate) => candidate.payment_id)
      .map((candidate) => [String(candidate.payment_id), candidate]),
  );
  const selectedPayments = selectedIds.map((id) => {
    const candidate = candidateById.get(id);
    if (!candidate) {
      throw new Error("Selected payment is not a candidate for this finding");
    }
    return candidate;
  });

  const selectedTotal = selectedPayments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0);
  if (selectedTotal <= 0) {
    throw new Error("Selected payments need a valid amount");
  }

  const responsibility = parseMoney(details.responsibility_amount);
  const credit = Math.max(0, selectedTotal - responsibility);

  return {
    previousValue:
      details.confirmed_payment_ids || details.confirmed_paid_amount || details.confirmed_credit_amount
        ? {
            payment_ids: details.confirmed_payment_ids ?? [],
            confirmed_paid_amount: details.confirmed_paid_amount ?? null,
            confirmed_credit_amount: details.confirmed_credit_amount ?? null,
          }
        : null,
    detailsPatch: {
      ...details,
      confirmed_payment_ids: selectedIds,
      confirmed_payments: selectedPayments,
      confirmed_paid_amount: formatMoney(selectedTotal),
      confirmed_responsibility_amount: formatMoney(responsibility),
      confirmed_credit_amount: formatMoney(credit),
      confirmation_source: "Confirmed by you",
    },
    auditValue: {
      payment_ids: selectedIds,
      confirmed_payments: selectedPayments,
      confirmed_paid_amount: formatMoney(selectedTotal),
      confirmed_responsibility_amount: formatMoney(responsibility),
      confirmed_credit_amount: formatMoney(credit),
    },
  };
}
```

Update the schema:

```ts
const findingActionSchema = z.object({
  action: z.enum(["confirm_match", "not_same_visit", "add_receipt_or_payment", "request_credit_refund"]),
  paymentIds: z.array(z.string()).optional(),
});
```

Inside `applyFindingAction`, after `actionDetails` is created:

```ts
const confirmation =
  parsed.data.action === "confirm_match"
    ? confirmationFromPaymentIds(existing, parsed.data.paymentIds ?? [])
    : null;

if (confirmation) {
  patch.details = confirmation.detailsPatch;
}
```

Change the manual adjustment insert values:

```ts
await deps.insertManualAdjustment({
  id: crypto.randomUUID(),
  user_id: userId,
  target_type: "finding",
  target_id: findingId,
  field_name: confirmation ? "confirmed_payments" : actionDetails.fieldName,
  previous_value: confirmation ? confirmation.previousValue : actionDetails.previousValue,
  new_value: confirmation ? confirmation.auditValue : actionDetails.newValue,
  reason: actionDetails.reason,
  created_at: timestamp,
});
```

- [ ] **Step 5: Run repository tests to verify GREEN**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/lib/findings/repository.test.ts
```

Expected: PASS.

### Task 3: Implement candidate checkbox selection and confirmation payload

**Files:**
- Modify: `apps/web/src/components/dashboard-shell.tsx`
- Modify: `apps/web/src/components/dashboard.test.tsx`

**Interfaces:**
- Consumes:
  - repository/API contract `{ action: "confirm_match", paymentIds: string[] }`
  - existing `candidatePayments(finding)`
- Produces:
  - selected candidate IDs in component state
  - selected-total summary
  - confirm action sends selected IDs

- [ ] **Step 1: Add a failing payload test**

In `apps/web/src/components/dashboard.test.tsx`, add a focused exported-helper test only if an existing client interaction test framework is not available. Export a pure helper from the component in implementation:

```ts
import { buildConfirmMatchPayload } from "./dashboard-shell";

it("builds confirm-match payload with selected candidate payment IDs", () => {
  expect(buildConfirmMatchPayload(["payment-133", "payment-142"])).toEqual({
    action: "confirm_match",
    paymentIds: ["payment-133", "payment-142"],
  });
});
```

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/components/dashboard.test.tsx
```

Expected: FAIL because `buildConfirmMatchPayload` is not exported.

- [ ] **Step 2: Add small pure helpers**

In `apps/web/src/components/dashboard-shell.tsx`, export:

```ts
export function buildConfirmMatchPayload(paymentIds: string[]) {
  return {
    action: "confirm_match" as const,
    paymentIds,
  };
}

function candidatePaymentId(candidate: Record<string, unknown>) {
  return typeof candidate.payment_id === "string" ? candidate.payment_id : "";
}

function validCandidatePaymentIds(finding: Record<string, unknown>) {
  return candidatePayments(finding).map(candidatePaymentId).filter(Boolean);
}

function confirmedPaymentIds(finding: Record<string, unknown>) {
  const raw = findingDetails(finding).confirmed_payment_ids;
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function initialSelectedPaymentIds(finding: Record<string, unknown>) {
  const confirmed = confirmedPaymentIds(finding);
  return confirmed.length ? confirmed : validCandidatePaymentIds(finding);
}

function selectedCandidatePayments(finding: Record<string, unknown>, selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return candidatePayments(finding).filter((candidate) => selected.has(candidatePaymentId(candidate)));
}

function selectedPaymentSummary(finding: Record<string, unknown>, selectedIds: string[]) {
  const payments = selectedCandidatePayments(finding, selectedIds);
  const selectedTotal = payments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
  const responsibility = parseAmount(findingDetails(finding).responsibility_amount);
  return {
    count: payments.length,
    selectedTotal,
    responsibility,
    credit: Math.max(0, selectedTotal - responsibility),
  };
}
```

- [ ] **Step 3: Add selected IDs state reset on selected finding change**

In `DashboardShell`, add:

```ts
const [selectedCandidatePaymentIds, setSelectedCandidatePaymentIds] = useState<string[]>([]);
```

After `selectedFinding` is computed, add:

```ts
useEffect(() => {
  if (!selectedFinding) {
    setSelectedCandidatePaymentIds([]);
    return;
  }
  setSelectedCandidatePaymentIds(initialSelectedPaymentIds(selectedFinding));
}, [selectedFinding?.id]);
```

- [ ] **Step 4: Render checkbox cards and summary**

Replace the display-only candidate `<div>` rows with checkbox labels:

```tsx
const candidateId = candidatePaymentId(candidate);
const checked = candidateId ? selectedCandidatePaymentIds.includes(candidateId) : false;
```

Use:

```tsx
<label
  key={String(candidate.payment_id ?? candidate.provider_name ?? candidate.amount)}
  style={{
    borderRadius: 14,
    background: checked ? "#f4fbfa" : "#fbfdff",
    border: checked ? "1px solid #7ccfc6" : "1px solid #e8eef6",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 10,
  }}
>
  <input
    type="checkbox"
    checked={checked}
    disabled={!candidateId}
    onChange={(event) => {
      setSelectedCandidatePaymentIds((current) =>
        event.target.checked
          ? Array.from(new Set([...current, candidateId]))
          : current.filter((id) => id !== candidateId),
      );
    }}
    style={{ width: 20, height: 20 }}
  />
  <div style={{ display: "grid", gap: 6 }}>
    {/* keep existing provider, hint, amount/date/source labels here */}
  </div>
</label>
```

Near the confirm action, compute:

```ts
const selectedSummary = selectedFinding
  ? selectedPaymentSummary(selectedFinding, selectedCandidatePaymentIds)
  : null;
```

Render:

```tsx
{selectedSummary && candidatePayments(selectedFinding).length > 0 ? (
  <span style={{ color: "#385b64", lineHeight: 1.45 }}>
    Selected payments: {formatCurrency(selectedSummary.selectedTotal)} across {selectedSummary.count} payment{selectedSummary.count === 1 ? "" : "s"} · EOB responsibility: {formatCurrency(selectedSummary.responsibility)} · Possible credit: {formatCurrency(selectedSummary.credit)}
  </span>
) : null}
```

- [ ] **Step 5: Send selected IDs in confirm action**

Change `handleFindingAction` signature:

```ts
async function handleFindingAction(
  action: "confirm_match" | "not_same_visit" | "add_receipt_or_payment" | "request_credit_refund",
  targetFinding = selectedFinding,
  options?: { paymentIds?: string[] },
)
```

Change fetch body:

```ts
body: JSON.stringify(
  action === "confirm_match" && options?.paymentIds
    ? buildConfirmMatchPayload(options.paymentIds)
    : { action },
),
```

Change confirm button:

```tsx
onClick={() => handleFindingAction("confirm_match", selectedFinding, { paymentIds: selectedCandidatePaymentIds })}
disabled={isSavingFindingAction || selectedCandidatePaymentIds.length === 0}
```

Button text:

```tsx
{isSavingFindingAction ? "Saving..." : "Confirm selected payments match"}
```

Show disabled helper text:

```tsx
{selectedCandidatePaymentIds.length === 0 ? (
  <span style={{ color: "#b56411", fontSize: 13 }}>Select at least one payment to confirm.</span>
) : null}
```

- [ ] **Step 6: Run UI tests**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/components/dashboard.test.tsx
```

Expected: PASS for checkbox, summary, and payload tests once Task 4 rendering is also complete; if confirmed-left-card test still fails, proceed to Task 4.

### Task 4: Render confirmed state and revision path

**Files:**
- Modify: `apps/web/src/components/dashboard-shell.tsx`
- Modify: `apps/web/src/components/dashboard.test.tsx`

**Interfaces:**
- Consumes:
  - confirmation fields persisted by Task 2
  - checkbox state/helpers from Task 3
- Produces:
  - confirmed left-card rendering
  - right-panel revision path

- [ ] **Step 1: Add confirmed detail helpers**

In `apps/web/src/components/dashboard-shell.tsx`, add:

```ts
function hasConfirmedPayments(finding: Record<string, unknown>) {
  return confirmedPaymentIds(finding).length > 0 && hasAmount(findingDetails(finding).confirmed_paid_amount);
}

function confirmedPaidAmount(finding: Record<string, unknown>) {
  return parseAmount(findingDetails(finding).confirmed_paid_amount);
}

function confirmedCreditAmount(finding: Record<string, unknown>) {
  return parseAmount(findingDetails(finding).confirmed_credit_amount);
}

function confirmedPayments(finding: Record<string, unknown>) {
  const raw = findingDetails(finding).confirmed_payments;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}
```

Update `findingStatusLabel`:

```ts
if (hasConfirmedPayments(finding)) {
  return "Confirmed";
}
```

- [ ] **Step 2: Update left-card structured fields**

Inside the review-card map, compute:

```ts
const isConfirmed = hasConfirmedPayments(finding);
const displayCandidates = isConfirmed ? confirmedPayments(finding) : candidates;
const displayPaidAmount = isConfirmed ? confirmedPaidAmount(finding).toFixed(2) : detailText(details.paid_amount ?? primaryCandidate?.amount, "--");
const displayCreditAmount = isConfirmed ? confirmedCreditAmount(finding) : creditAmount;
```

Use these field labels:

```tsx
{isConfirmed ? "Confirmed payments" : hasMultipleCandidates ? "Candidate payments" : ...}
```

Use values:

```tsx
{isConfirmed
  ? displayPaidAmount
  : hasMultipleCandidates
    ? `${candidates.length} possible`
    : detailText(details.paid_amount ?? primaryCandidate?.amount, "--")}
```

Use source summary:

```tsx
{isConfirmed
  ? candidatePaymentSourceSummary(displayCandidates)
  : hasMultipleCandidates
    ? candidatePaymentSourceSummary(candidates)
    : paymentMethodText(...)}
```

Use possible credit:

```tsx
{displayCreditAmount > 0 ? formatCurrency(displayCreditAmount) : findingStatusLabel(finding)}
```

- [ ] **Step 3: Add revision action in right panel**

When `hasConfirmedPayments(selectedFinding)` is true, show:

```tsx
<button
  type="button"
  onClick={() => {
    setSelectedCandidatePaymentIds(initialSelectedPaymentIds(selectedFinding));
    setFindingActionStatus("Review and revise the selected payments, then save again.");
  }}
  style={{
    borderRadius: 16,
    border: "1px solid #117a72",
    background: "#ffffff",
    color: "#117a72",
    padding: "14px 16px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  }}
>
  Revise selected payments
</button>
```

Keep the checkbox list visible so revising does not need a separate modal.

- [ ] **Step 4: Run UI tests to verify GREEN**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/components/dashboard.test.tsx
```

Expected: PASS.

### Task 5: End-to-end verification and commit

**Files:**
- Verify only:
  - `apps/web/src/components/dashboard-shell.tsx`
  - `apps/web/src/components/dashboard.test.tsx`
  - `apps/web/src/lib/findings/repository.ts`
  - `apps/web/src/lib/findings/repository.test.ts`
  - optionally `apps/web/src/app/api/findings/[id]/route.ts`

**Interfaces:**
- Consumes:
  - all outputs from Tasks 1-4
- Produces:
  - one repair commit on `codex/preserve-live-oweme-20260801`

- [ ] **Step 1: Run focused web tests**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/components/dashboard.test.tsx src/lib/findings/repository.test.ts
```

Expected: PASS, with no failed tests.

- [ ] **Step 2: Run relevant auth/dashboard smoke tests**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital/apps/web
npm test -- --no-cache src/app/api/auth/sync-session/route.test.ts src/lib/auth/middleware-policy.test.ts 'src/app/(app)/dashboard/page.test.tsx'
```

Expected: PASS, confirming the repair did not disturb auth/demo dashboard loading.

- [ ] **Step 3: Run diff checks**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital
git diff --check
git diff --cached --check
```

Expected: both commands exit 0. `git diff --cached --check` may show no output if nothing is staged yet.

- [ ] **Step 4: Perform a safe non-mutating render check**

Use the existing server-side render tests as the primary safe context. Do not click the user's browser. If a browser check is available without touching user data, load only `/login` and do not PATCH findings.

Run:

```bash
python3 - <<'PY'
from urllib.request import urlopen
with urlopen('http://localhost:3001/login', timeout=10) as resp:
    body = resp.read().decode('utf-8', errors='replace')
print(resp.status)
print('Choose your OweMe workspace' in body)
print('__webpack_modules__[moduleId] is not a function' in body)
PY
```

Expected:

```text
200
True
False
```

- [ ] **Step 5: Inspect final diff**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital
git diff -- apps/web/src/components/dashboard-shell.tsx apps/web/src/components/dashboard.test.tsx apps/web/src/lib/findings/repository.ts apps/web/src/lib/findings/repository.test.ts
```

Expected: diff includes only checkbox confirmation UI, selected-ID persistence, and tests. It must not include matching-rule or worker changes.

- [ ] **Step 6: Commit repair**

Run:

```bash
cd /Users/chongchongchao/Documents/hospital
git status --short
git add apps/web/src/components/dashboard-shell.tsx apps/web/src/components/dashboard.test.tsx apps/web/src/lib/findings/repository.ts apps/web/src/lib/findings/repository.test.ts
git commit -m "Fix multi-candidate payment confirmation"
```

Expected: one commit on `codex/preserve-live-oweme-20260801`.

Do not commit unrelated files.

## Self-Review

- Spec coverage: This plan covers checkbox rows, all-valid default selection, selected-total summary, exact `paymentIds` payload, server validation, persistence fields, left-card confirmed display, revision path, error states, and focused tests.
- Placeholder scan: No task uses deferred-work markers or vague fill-in instructions. Each code task includes exact paths, snippets, commands, and expected outcomes.
- Type consistency: The plan consistently uses `paymentIds` in the request payload, `confirmed_payment_ids` / `confirmed_payments` / `confirmed_paid_amount` / `confirmed_responsibility_amount` / `confirmed_credit_amount` in `details`, and `buildConfirmMatchPayload(paymentIds: string[])` on the client.
- Scope check: Worker matching logic, audit-generation rules, database migrations, demo-data merging, and provider-refund drafting are explicitly out of scope.
