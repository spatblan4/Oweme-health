# OweMe Health Synthetic Demo Files

These files are synthetic and safe for hackathon demos. They do not contain real medical, banking, insurance, or patient data.

Use them in Past Credits:

1. Upload `oweme-synthetic-claims.csv` as the claims file.
2. Upload both payment files:
   - `oweme-synthetic-hsa-transactions.csv`
   - `oweme-synthetic-apple-card.csv`
3. Run audit.

Expected demo story:

- `ALI SALEHPOUR MD DDS`, 2026-02-18: EOB says 125.00 and the HSA file shows a 275.00 HSA payment shortly after; this needs confirmation before showing any credit/refund.
- `ALI SALEHPOUR MD DDS`, 2026-02-27: EOB says 605.20 and the HSA file shows a larger 1,079.10 HSA payment; show this as allocation review, not a confirmed credit.
- `JAMES D KIM` and `QUEST DIAGNOSTICS`: small claims with no direct payment yet, useful for review-queue explainability.
- A generic Apple Card `Medical` purchase demonstrates unassigned medical payment handling without using a real bank statement.

All names, amounts, dates, and transaction rows are invented for product demonstration.
