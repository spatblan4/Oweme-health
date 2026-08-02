# Multi-candidate payment confirmation design

Date: 2026-08-01

## Goal

When a Past Credits finding has multiple candidate payments for one visit, the user must be able to confirm exactly which payments belong to that visit. The confirmed state must preserve the selected payment IDs and amounts, show the confirmed total, compare it with the EOB patient responsibility, and keep the selection editable.

This is a user-confirmed allocation flow only. It must not change audit matching rules or synthesize payments that are not present in the finding evidence.

## Approved behavior

- Each candidate payment row is checkbox-selectable.
- All candidate payments default to selected when the finding has no prior confirmation.
- The right panel shows:
  - selected payment total;
  - EOB patient responsibility;
  - possible credit/refund difference: selected total minus EOB responsibility, floored at zero.
- Confirming persists the exact selected payment IDs and enough payment details to audit what was confirmed.
- Confirmed selections remain editable through a revision path.
- The left review-queue card must no longer show a confirmed finding as `Needs review` / `2 possible`; it should show the confirmed paid total and calculated possible credit.

## UI behavior

### Candidate rows

For a selected finding with `details.candidate_payments`:

- Render each candidate as a checkbox card.
- Use `payment_id` as the durable selection value.
- Display the same checkable evidence currently shown:
  - amount;
  - payment date;
  - merchant/provider;
  - source/account label;
  - match hint.
- A candidate without `payment_id` may be displayed but must not be confirmable. Show a clear disabled state such as `Missing payment ID — cannot confirm automatically`.

### Default selection

- If `details.confirmed_payment_ids` exists, preselect those IDs.
- Otherwise, preselect all candidates with valid `payment_id`.
- If no valid candidate IDs are selected, disable the confirm button and show `Select at least one payment to confirm`.

### Selected-total summary

Show a compact summary near the confirmation action:

`Selected payments: $275.00 across 2 payments · EOB responsibility: $12.40 · Possible credit: $262.60`

Rules:

- Selected total is the sum of selected candidate `amount` values.
- EOB responsibility comes from `details.responsibility_amount`.
- Possible credit is `max(0, selectedTotal - responsibility)`.
- If the EOB responsibility is missing or invalid, show the selected total but mark the difference as needing responsibility confirmation.

### Confirmation action

For candidate findings, the primary action should be phrased around the selected set, for example:

`Confirm selected payments match`

The button sends the selected payment IDs. It must not claim a specific payment or total that is not present in the payload.

### Confirmed left-card state

After a successful confirmation response updates the finding, the left card should reflect the confirmed result instead of pending ambiguity:

- badge: `Confirmed` or `Possible credit`;
- payment field label: `Confirmed payments`;
- payment value: confirmed total, for example `$275.00`;
- payment method/source: derived from selected confirmed payments, for example `Apple Card`;
- possible credit/difference: confirmed difference, for example `$262.60`;
- do not show `Needs review` or `2 possible` for the confirmed finding.

The confirmed finding may remain visible in Past Credits so the user can see the outcome. If the product later wants a strict pending-only queue, add a separate confirmed/history section before hiding it.

## Request payload

Extend the finding action payload for confirmation:

```json
{
  "action": "confirm_match",
  "paymentIds": ["payment-133", "payment-142"]
}
```

The existing bare payload `{ "action": "confirm_match" }` should not be used for candidate-payment findings because it does not identify the confirmed payment IDs.

## Server validation

On `PATCH /api/findings/[id]`:

- Require a non-empty `paymentIds` array for `confirm_match` when the finding has `details.candidate_payments`.
- Deduplicate `paymentIds` while preserving deterministic behavior.
- Verify every submitted ID is present in the current finding’s `details.candidate_payments`.
- Reject unknown IDs with a clear 400 error, for example `Selected payment is not a candidate for this finding`.
- Reject confirmation if no selected candidate has a valid amount.
- Do not look up or attach unrelated payments outside the candidate list for this action.

## Persistence

When validation succeeds, patch the finding by preserving existing `details` and adding/updating confirmation fields:

- `confirmed_payment_ids`: selected payment IDs;
- `confirmed_payments`: selected candidate payment records needed for auditability;
- `confirmed_paid_amount`: selected total as a currency string;
- `confirmed_responsibility_amount`: EOB responsibility as a currency string when available;
- `confirmed_credit_amount`: calculated possible credit as a currency string;
- `confirmation_source`: `Confirmed by you`.

Set `status` to `resolved` only after confirmation details are persisted.

Also insert a `manual_adjustments` audit row with a structured `new_value` containing the selected IDs, selected payments, totals, and calculated difference. If revising an existing confirmation, include the previous confirmation details in `previous_value`.

## Revision path

Confirmed selections must remain editable:

- The right panel still shows the confirmed payment rows.
- Show a secondary action such as `Revise selected payments`.
- Revising reopens the same checkbox list, preselected from `details.confirmed_payment_ids`.
- Saving a revision sends the same confirmation payload shape and replaces the confirmation fields.
- The audit log records the previous and new selected IDs/totals.

This avoids forcing users to dismiss or rerun the audit when they correct a selection.

## Error states

- No selected payment: disable confirmation and show `Select at least one payment to confirm`.
- Missing candidate `payment_id`: row disabled with explanatory text.
- Unknown submitted ID: server rejects; UI shows the returned error without changing local finding state.
- Invalid/missing amount: server rejects if no selected amount can be summed; UI should keep the selection editable.
- Missing EOB responsibility: allow payment confirmation only if selected payments are valid, but show possible credit as requiring responsibility confirmation.
- Network/API failure: keep checkbox state intact and show the error.

## Tests

Replace the stale queue-hiding regression with tests for the approved confirmed-payment behavior.

### Frontend tests

- Multiple candidates render as checked checkbox rows by default.
- Selected-total summary updates when a candidate is unchecked/rechecked.
- Confirm button sends selected `paymentIds`.
- A confirmed finding renders on the left as confirmed paid total and calculated possible credit, not `Needs review` / `2 possible`.
- A confirmed finding exposes a revision path preselected from `confirmed_payment_ids`.

### Repository/API tests

- `confirm_match` with valid `paymentIds` persists exact selected IDs, selected payment records, total paid, EOB responsibility, calculated credit, and `status: "resolved"`.
- Unknown `paymentIds` are rejected.
- Empty `paymentIds` are rejected for candidate findings.
- Revision replaces prior confirmation fields and writes previous/new values to `manual_adjustments`.

### Non-goals for this change

- Do not change matching/allocation rules.
- Do not infer new payments from statements.
- Do not merge demo data into real audit data.
- Do not auto-request a provider refund review.
- Do not hide confirmed findings unless a confirmed/history display exists.

## Self-review notes

- Scope is intentionally limited to confirming existing candidate payments already attached to a finding.
- The design avoids the earlier queue-only fix because hiding the item would lose the user-approved Stone Creek outcome: `$133 + $142 = $275`, compared with `$12.40` EOB responsibility.
- The only product choice embedded here is that all valid candidates default selected when no previous confirmation exists. This is approved for the current behavior; the checkbox UI still lets the user revise before saving.
- The spec requires exact `payment_id` persistence before the UI claims confirmation, preventing ambiguous “confirmed” state.
