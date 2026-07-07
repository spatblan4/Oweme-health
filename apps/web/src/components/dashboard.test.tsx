import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardShell } from "./dashboard-shell";

describe("DashboardShell", () => {
  it("renders the prototype-aligned navigation and primary views", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[{ id: "job-1", status: "queued", jobType: "extract_claims", fileId: "file-1" }]}
        visits={[{ id: "visit-1", provider_name: "Stone Creek Village Dentistry", visit_date: "2026-07-03" }]}
        findings={[
          {
            id: "finding-1",
            finding_type: "allocation_unclear",
            title: "Allocation unclear",
            credit_amount: 262.6,
          },
        ]}
      />,
    );

    expect(html).toContain("OweMe Health");
    expect(html).toContain("Privacy-first prototype");
    expect(html).toContain("Who still owes you?");
    expect(html).toContain("Check past bills");
    expect(html).toContain("Track a new visit");
    expect(html).toContain("$262.60");
    expect(html).toContain("No account. No bank connection. No insurance API.");
    expect(html).toContain("Medical credits can hide in plain sight");
    expect(html).toContain("Paid now flow");
    expect(html).toContain("Claim processing orbit");
    expect(html).toContain("Credit return flow");
  });

  it("shows prototype-style empty state copy when there is no data yet", () => {
    const html = renderToStaticMarkup(<DashboardShell jobs={[]} visits={[]} findings={[]} />);

    expect(html).toContain("$0.00");
    expect(html).toContain("across 0 providers");
    expect(html).toContain("No account. No bank connection. No insurance API.");
  });

  it("can render directly into a non-overview workspace view", () => {
    const html = renderToStaticMarkup(
      <DashboardShell jobs={[]} visits={[]} findings={[]} initialView="past" />,
    );

    expect(html).toContain("Check old bills");
    expect(html).toContain("Run audit");
    expect(html).not.toContain("Privacy-first prototype");
    expect(html).toContain('id="claims-file-input"');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".csv,.pdf,.xls,.xlsx,.png,.jpg,.jpeg"');
    expect(html).toContain('for="claims-file-input"');
    expect(html).toContain('for="payments-file-input"');
    expect(html).not.toContain("file jobs ready");
  });
});
