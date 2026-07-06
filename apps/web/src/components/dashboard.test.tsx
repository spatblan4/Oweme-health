import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardShell } from "./dashboard-shell";

describe("DashboardShell", () => {
  it("renders uploads, jobs, visits, and findings sections", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[{ id: "job-1", status: "queued", jobType: "extract_claims", fileId: "file-1" }]}
        visits={[{ id: "visit-1", provider_name: "Stone Creek Village Dentistry", visit_date: "2026-07-03" }]}
        findings={[{ id: "finding-1", finding_type: "allocation_unclear", title: "Allocation unclear" }]}
      />,
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Upload files");
    expect(html).toContain("Recent jobs");
    expect(html).toContain("Visits");
    expect(html).toContain("Findings");
    expect(html).toContain("Stone Creek Village Dentistry");
    expect(html).toContain("Allocation unclear");
  });

  it("shows calm empty states when there is no data yet", () => {
    const html = renderToStaticMarkup(
      <DashboardShell jobs={[]} visits={[]} findings={[]} />,
    );

    expect(html).toContain("No uploads yet");
    expect(html).toContain("No visits yet");
    expect(html).toContain("No findings yet");
  });
});
