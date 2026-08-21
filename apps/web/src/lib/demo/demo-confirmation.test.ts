import { describe, expect, it } from "vitest";

import { loadSyntheticDashboardData } from "./synthetic-dashboard-data";
import { confirmDemoReviewFinding } from "./demo-confirmation";

describe("demo review confirmation", () => {
  it("turns the Stone Creek review into a confirmed credit", () => {
    const finding = loadSyntheticDashboardData().findings.find(
      (item) => item.title === "Stone Creek Village De",
    );

    const confirmed = confirmDemoReviewFinding(finding);
    const details = confirmed.details as Record<string, unknown>;

    expect(confirmed.finding_type).toBe("possible_credit");
    expect(details.confirmation_source).toBe("Confirmed by you");
    expect(details.confirmed_paid_amount).toBe("275.00");
    expect(details.confirmed_responsibility_amount).toBe("12.40");
    expect(details.confirmed_payment_ids).toEqual(["demo-stone-creek-payment"]);
  });
});
