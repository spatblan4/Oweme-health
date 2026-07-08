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
      <DashboardShell
        jobs={[]}
        visits={[{ id: "visit-1", provider_name: "Stone Creek Village Dentistry" }]}
        findings={[{ id: "finding-1", provider_name: "Quest Diagnostics" }]}
        initialView="future"
      />,
    );

    expect(html).toContain("Log a visit before it disappears");
    expect(html).toContain('list="provider-suggestions"');
    expect(html).toContain('<datalist id="provider-suggestions">');
    expect(html).toContain("Stone Creek Village Dentistry");
    expect(html).toContain("Quest Diagnostics");
    expect(html).toContain('value=""');
    expect(html).not.toContain('value="275.00"');
    expect(html).toContain('value="" selected="">Select payment method');
    expect(html).toContain('value="" selected="">Select visit type');
  });

  it("renders the past credits workspace with visit-based matching UI", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[
          {
            id: "finding-3",
            provider_name: "JAMES D KIM",
            finding_type: "allocation_unclear",
            status: "open",
            title: "JAMES D KIM",
            summary: "Claim from 2026-05-13 shows $12.40 patient responsibility, and a larger payment may include this visit.",
            details: {
              provider_name: "JAMES D KIM",
              service_date: "2026-05-13",
              responsibility_amount: "12.40",
              candidate_payments: [
                {
                  payment_id: "payment-1",
                  provider_name: "Stone Creek Village Dentistry",
                  payment_date: "2026-05-20",
                  amount: "78.00",
                  match_hint: "Possible bundled payment",
                },
              ],
            },
          },
          {
            id: "finding-1",
            provider_name: "Stone Creek Village Dentistry",
            finding_type: "possible_credit",
            status: "open",
            title: "Stone Creek Village Dentistry",
            summary: "Paid $275.00 for Jul 4, 2026, but the claim says you owe $78.00.",
            details: {
              provider_name: "Stone Creek Village Dentistry",
              service_date: "2026-07-04",
              paid_amount: "275.00",
              responsibility_amount: "78.00",
              credit_amount: "197.00",
            },
          },
          {
            id: "finding-2",
            provider_name: "Quest Diagnostics",
            finding_type: "allocation_unclear",
            status: "open",
            title: "Quest Diagnostics",
            summary: "Claim from 2026-05-08 shows $32.40 patient responsibility, but no matching payment was found yet.",
            details: {
              provider_name: "Quest Diagnostics",
              service_date: "2026-05-08",
              responsibility_amount: "32.40",
            },
          },
        ]}
        initialView="past"
      />,
    );

    expect(html).toContain("Matched confidently");
    expect(html).toContain("Need review");
    expect(html).toContain("Unexplained payments");
    expect(html).toContain("Review queue");
    expect(html).toContain("Why we matched this");
    expect(html).toContain("Confirm match");
    expect(html).toContain("Not the same visit");
    expect(html).toContain("Add receipt or payment");
    expect(html).toContain("Possible bundled payment");
    expect(html).toContain("Closest payment candidates");
    expect(html).toContain("Stone Creek Village Dentistry");
    expect(html).toContain("Possible overpayment");
  });
});
