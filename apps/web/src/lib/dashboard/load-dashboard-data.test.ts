import { describe, expect, it, vi } from "vitest";

import { loadDashboardData } from "./load-dashboard-data";

describe("loadDashboardData", () => {
  it("loads jobs, visits, findings, and providers for the current user", async () => {
    const result = await loadDashboardData("user-1", {
      getRecentJobs: vi.fn().mockResolvedValue([{ id: "job-1" }]),
      getOwnedVisits: vi.fn().mockResolvedValue([{ id: "visit-1" }]),
      getOwnedFindings: vi.fn().mockResolvedValue([{ id: "finding-1" }]),
      getOwnedProviders: vi.fn().mockResolvedValue([{ id: "provider-1" }]),
    });

    expect(result).toEqual({
      jobs: [{ id: "job-1" }],
      visits: [{ id: "visit-1" }],
      findings: [{ id: "finding-1" }],
      providers: [{ id: "provider-1" }],
    });
  });
});
