import { describe, expect, it } from "vitest";

import { loadSyntheticDashboardData } from "./synthetic-dashboard-data";

describe("synthetic demo dashboard data", () => {
  it("includes the three recovered credits totaling $886.50", () => {
    const data = loadSyntheticDashboardData();
    const total = data.findings.reduce((sum, finding) => {
      const details = finding.details as Record<string, unknown>;
      return sum + Number(details.credit_amount ?? 0);
    }, 0);

    expect(total).toBe(886.5);
    expect(data.findings.filter((finding) => finding.finding_type === "possible_credit")).toHaveLength(3);
  });
});
