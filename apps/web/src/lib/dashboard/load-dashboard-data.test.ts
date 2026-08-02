import { describe, expect, it, vi } from "vitest";

import { loadDashboardData } from "./load-dashboard-data";

describe("loadDashboardData", () => {
  it("loads jobs, visits, and findings for the current user", async () => {
    const result = await loadDashboardData("user-1", {
      getRecentJobs: vi.fn().mockResolvedValue([{ id: "job-1" }]),
      getOwnedVisits: vi.fn().mockResolvedValue([{ id: "visit-1" }]),
      getOwnedFindings: vi.fn().mockResolvedValue([{ id: "finding-1" }]),
    });

    expect(result).toEqual({
      jobs: [{ id: "job-1" }],
      visits: [{ id: "visit-1" }],
      findings: [{ id: "finding-1" }],
    });
  });

  it("filters synthetic demo findings out of personal dashboard data", async () => {
    const result = await loadDashboardData("user-1", {
      getRecentJobs: vi.fn().mockResolvedValue([]),
      getOwnedVisits: vi.fn().mockResolvedValue([]),
      getOwnedFindings: vi.fn().mockResolvedValue([
        {
          id: "real-finding",
          title: "Real imported claim",
          details: { source_files: ["uploaded-eob.csv"] },
        },
        {
          id: "demo-finding",
          title: "BAY AREA OSM DEMO",
          details: { source_files: ["oweme-synthetic-claims.csv"] },
        },
      ]),
    });

    expect(result.findings).toEqual([
      {
        id: "real-finding",
        title: "Real imported claim",
        details: { source_files: ["uploaded-eob.csv"] },
      },
    ]);
  });

  it("enriches existing candidate payments with source labels from payment file metadata", async () => {
    const result = await loadDashboardData("user-1", {
      getRecentJobs: vi.fn().mockResolvedValue([]),
      getOwnedVisits: vi.fn().mockResolvedValue([]),
      getOwnedFindings: vi.fn().mockResolvedValue([
        {
          id: "stone-creek-finding",
          title: "Stone Creek Village De",
          details: {
            candidate_payments: [
              {
                payment_id: "payment-133",
                amount: "133.00",
                payment_source: "Purchase",
              },
              {
                payment_id: "payment-142",
                amount: "142.00",
                payment_source: "Purchase",
              },
            ],
          },
        },
      ]),
      getPaymentSourceLabelsByIds: vi.fn().mockResolvedValue(
        new Map([
          ["payment-133", "Apple Card"],
          ["payment-142", "Apple Card"],
        ]),
      ),
    });

    expect(result.findings[0].details).toEqual({
      candidate_payments: [
        {
          payment_id: "payment-133",
          amount: "133.00",
          payment_source: "Purchase",
          payment_source_label: "Apple Card",
        },
        {
          payment_id: "payment-142",
          amount: "142.00",
          payment_source: "Purchase",
          payment_source_label: "Apple Card",
        },
      ],
    });
  });
});
