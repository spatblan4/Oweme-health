import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildConfirmMatchPayload,
  buildCreditReviewDraft,
  DashboardShell,
  findingActionDestination,
} from "./dashboard-shell";

describe("DashboardShell", () => {
  it("gives Action Center items a route back to the matching Past Credits review", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[{
          id: "finding-action-1",
          provider_name: "Stone Creek Village De",
          finding_type: "possible_credit",
          status: "open",
          details: { credit_amount: "42.00" },
        }]}
        initialView="actions"
      />,
    );

    expect(html).toContain('data-testid="action-center-finding-finding-action-1"');
    expect(html).toContain("Review in Past Credits");
  });

  it("builds editable email and call communication drafts with combined visit evidence", () => {
    const draft = buildCreditReviewDraft(
      [
        {
          id: "demo-finding-1",
          provider_name: "ALI SALEHPOUR MD DDS",
          details: {
            service_date: "2026-02-18",
            responsibility_amount: "125.00",
            paid_amount: "275.00",
          },
        },
        {
          id: "demo-finding-2",
          provider_name: "ALI SALEHPOUR MD DDS",
          details: {
            service_date: "2026-02-27",
            responsibility_amount: "605.20",
            paid_amount: "1079.10",
          },
        },
      ],
      "combined",
    );

    expect(draft.total).toBe(623.9);
    expect(draft.visits).toHaveLength(2);
    expect(draft.emailTo).toBe("info@ofiscm.com");
    expect(draft.phone).toBe("(831) 884-5141");
    expect(draft.contactSource).toContain("Oral, Facial & Implant Surgery Center of Monterey");
    expect(draft.emailSubject).toBe("Request to review possible overpayment — 2026-02-18, 2026-02-27");
    expect(draft.emailMessage).toContain("Hello ALI SALEHPOUR MD DDS billing team,");
    expect(draft.emailMessage).toContain("I'm writing about my visits on 2026-02-18 and 2026-02-27.");
    expect(draft.emailMessage).toContain("My insurance EOB shows I was responsible for $730.20, but my payment record shows I paid $1,354.10, so I may have overpaid by $623.90.");
    expect(draft.emailMessage).toContain("Could you please review my account and let me know whether there is a credit on my account or a refund available to me?");
    expect(draft.emailMessage).toContain("$623.90");
    expect(draft.emailMessage).toContain("2026-02-18");
    expect(draft.emailMessage).toContain("2026-02-27");
    expect(draft.emailMessage).not.toContain("whether a credit or refund is due");
    expect(draft.callScript).toContain("$623.90");
    expect(draft.callScript).toContain("ALI SALEHPOUR MD DDS");
    expect(draft.callScript).toContain("I'm calling about my visits on 2026-02-18 and 2026-02-27.");
    expect(draft.callScript).toContain("Could you please review my account and let me know whether there is a credit on my account or a refund available to me?");
    expect(draft.callScript).not.toContain("whether a credit or refund is due");
  });

  it("builds natural separate visit communication drafts without ambiguous wording", () => {
    const draft = buildCreditReviewDraft(
      [
        {
          id: "demo-finding-2",
          provider_name: "ALI SALEHPOUR MD DDS",
          details: {
            service_date: "2026-02-27",
            responsibility_amount: "605.20",
            paid_amount: "1079.10",
          },
        },
      ],
      "separate",
    );

    expect(draft.total).toBe(473.9);
    expect(draft.emailSubject).toBe("Request to review possible overpayment — 2026-02-27");
    expect(draft.emailMessage).toContain("I'm writing about my visit on 2026-02-27.");
    expect(draft.emailMessage).toContain("My insurance EOB shows I was responsible for $605.20, but my payment record shows I paid $1,079.10, so I may have overpaid by $473.90.");
    expect(draft.emailMessage).toContain("a credit on my account or a refund available to me");
    expect(draft.emailMessage).not.toContain("whether a credit or refund is due");
    expect(draft.callScript).toContain("I'm calling about my visit on 2026-02-27.");
    expect(draft.callScript).toContain("possible overpayment");
    expect(draft.callScript).not.toContain("whether a credit or refund is due");
  });

  it("prefers provider contact details supplied with the finding", () => {
    const draft = buildCreditReviewDraft(
      [
        {
          id: "finding-with-contact",
          provider_name: "Stone Creek Village Dentistry",
          details: {
            service_date: "2026-06-03",
            responsibility_amount: "40.00",
            paid_amount: "90.00",
            billing_email: "billing@stonecreek.example",
            billing_phone: "(555) 010-2222",
            contact_source: "Uploaded provider statement",
          },
        },
      ],
      "separate",
    );

    expect(draft.emailTo).toBe("billing@stonecreek.example");
    expect(draft.phone).toBe("(555) 010-2222");
    expect(draft.contactSource).toBe("Uploaded provider statement");
  });

  it("shows multiple candidate payments without collapsing them into a single payment record", () => {
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
            summary: "Claim from 2026-05-13 shows $12.40 patient responsibility, and a larger payment may include this visit.",
            details: {
              provider_name: "Stone Creek Village De",
              claim_provider_name: "JAMES D KIM",
              service_date: "2026-05-13",
              responsibility_amount: "12.40",
              candidate_payments: [
                {
                  payment_id: "payment-133",
                  provider_name: "Stone Creek Village De",
                  payment_date: "2026-05-13",
                  amount: "133.00",
                  payment_source: "Purchase",
                  payment_source_label: "Apple Card",
                  match_hint: "Provider conflict",
                },
                {
                  payment_id: "payment-142",
                  provider_name: "Stone Creek Village De",
                  payment_date: "2026-05-13",
                  amount: "142.00",
                  payment_source: "Purchase",
                  payment_source_label: "Apple Card",
                  match_hint: "Provider conflict",
                },
              ],
            },
          },
        ]}
        initialView="past"
      />,
    );

    const reviewCard = html.match(
      /<button type="button" data-testid="review-finding-stone-creek-review"[\s\S]*?<\/button>/,
    )?.[0] ?? "";

    expect(reviewCard).toContain("Candidate payments");
    expect(reviewCard).toContain("2 possible");
    expect(reviewCard).not.toContain("Candidate payment</span><strong style=\"font-size:16px\">133.00");
    expect(html).toContain("Payment candidates");
    expect(html).not.toContain("Payment record");
    expect(html).toContain("Paid 133.00 on 2026-05-13");
    expect(html).toContain("Paid 142.00 on 2026-05-13");
    expect(html).toContain("Payment method: Apple Card");
    expect(html).not.toContain("Chase card");
  });

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
                  match_hint: "Provider conflict",
                },
                {
                  payment_id: "payment-142",
                  provider_name: "Stone Creek Village De",
                  payment_date: "2026-05-13",
                  amount: "142.00",
                  payment_source_label: "Apple Card",
                  match_hint: "Provider conflict",
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
    expect(html).toContain("Write provider for refund / credit");
    expect(html).toContain('data-testid="write-provider-refund-credit"');
    expect(html).toContain("Revise selected payments");
    expect(html).not.toContain("Confirm and save payment match");
    expect(html).not.toContain("reject-payment-match");
  });

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
    expect(html.match(/checked=""/g)?.length).toBe(2);
    expect(html).toContain("Selected payments: $275.00 across 2 payments");
    expect(html).toContain("Needs confirmation");
    expect(html).toContain("Confirm and save payment match");
    expect(html).toContain("These payments don&#x27;t match this visit");
    expect(html).not.toContain("Write provider for refund / credit");
    expect(html).toContain("EOB responsibility: $12.40");
    expect(html).toContain("Possible credit: $262.60");
    expect(html).toContain("Confirm and save payment match");
    expect(html.indexOf("Records to check")).toBeLessThan(html.indexOf("Claim / EOB"));
    expect(html).not.toContain("Next step");
    expect(html).toContain('data-testid="reject-payment-match"');
  });

  it("builds confirm-match payload with selected candidate payment IDs", () => {
    expect(buildConfirmMatchPayload(["payment-133", "payment-142"])).toEqual({
      action: "confirm_match",
      paymentIds: ["payment-133", "payment-142"],
    });
  });

  it("routes confirmed refund/credit requests to the Action Center", () => {
    expect(findingActionDestination("request_credit_refund")).toBe("actions");
    expect(findingActionDestination("confirm_match")).toBeNull();
  });

  it("keeps demo Past Credits upload-first until an audit is explicitly run", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[{ id: "demo-credit", provider_name: "Demo Provider", finding_type: "possible_credit", details: { credit_amount: "42.00" } }]}
        initialView="past"
        currentUser={{
          id: "11111111-1111-1111-1111-111111111111",
          email: "demo-judge@oweme.local",
          isDevTest: false,
          isDemo: true,
        }}
      />,
    );

    expect(html).toContain("Start by adding the claim/EOB and payment/receipt records you want OweMe to compare.");
    expect(html).not.toContain("Upload your evidence first");
    expect(html).toContain("Run audit");
    expect(html).not.toContain('data-testid="past-credits-upload-first-state"');
    expect(html).not.toContain("possible credits found");
    expect(html).not.toContain("Review queue");
    expect(html).not.toContain("Demo Provider");
    expect(html).not.toContain("Load sample claim + payment files");

    const auditedHtml = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[{ id: "demo-credit", provider_name: "Demo Provider", finding_type: "possible_credit", details: { credit_amount: "42.00" } }]}
        initialView="past"
        pastAuditComplete
        currentUser={{
          id: "11111111-1111-1111-1111-111111111111",
          email: "demo-judge@oweme.local",
          isDevTest: false,
          isDemo: true,
        }}
      />,
    );
    expect(auditedHtml).toContain("possible credits found");
    expect(auditedHtml).toContain("Review queue");
  });

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
        currentUser={{
          id: "user-1",
          email: "person@example.com",
          isDevTest: false,
        }}
      />,
    );

    expect(html).toContain("OweMe Health");
    expect(html).toContain("Don’t let a delayed EOB turn into a forgotten refund.");
    expect(html).toContain("Paid your medical bill? Check if you’re owed a refund.");
    expect(html).toContain(
      "When your EOB arrives weeks later, OweMe reminds you to compare it with what you paid—so potential refunds don’t get forgotten.",
    );
    expect(html).toContain("Check past bills");
    expect(html).not.toContain("Check past bills →");
    expect(html).toContain("Find past overpayments and possible refunds from old claims and payments.");
    expect(html).toContain("Track a new visit");
    expect(html).not.toContain("Track a new visit →");
    expect(html).toContain("Log new visits so OweMe can remind you when the EOB should arrive.");
    expect(html).not.toContain("Past bill audit");
    expect(html).not.toContain("Future visit tracking");
    expect(html).toContain("$262.60");
    expect(html).not.toContain("Account: person@example.com. No bank connection. No insurance API.");
    expect(html).toContain("My account");
    expect(html).toContain('data-testid="account-mode-menu-button"');
    expect(html).not.toContain("Personal account");
    expect(html).not.toContain("Switch");
    expect(html).not.toContain("Medical credits can hide in plain sight");
    expect(html).not.toContain("Paid now flow");
    expect(html).not.toContain("Claim processing orbit");
    expect(html).not.toContain("Credit return flow");
    expect(html).not.toContain("Paid bill");
    expect(html).not.toContain("OweMe match");
    expect(html).not.toContain("Refund");
    expect(html).not.toContain("RECEIPT");
  });

  it("shows prototype-style empty state copy when there is no data yet", () => {
    const html = renderToStaticMarkup(<DashboardShell jobs={[]} visits={[]} findings={[]} />);

    expect(html).toContain("$0.00");
    expect(html).toContain("across 0 providers");
    expect(html).not.toContain("Account: Signed-in account. No bank connection. No insurance API.");
  });

  it("keeps account details out of the workspace sidebar", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[]}
        initialView="past"
        currentUser={{
          id: "00000000-0000-0000-0000-000000000001",
          email: "dev-test@oweme.local",
          isDevTest: true,
        }}
      />,
    );

    expect(html).toContain("My account");
    expect(html).toContain('data-testid="account-mode-menu-button"');
    expect(html).not.toContain("Current account");
    expect(html).not.toContain("dev-test@oweme.local");
    expect(html).not.toContain("Local dev account");
    expect(html).not.toContain("Load synthetic demo");
    expect(html).not.toContain('action="/api/dev/load-demo"');
    expect(html).not.toContain("Clear dev data");
    expect(html).not.toContain("Sign out");
  });

  it("does not show dev data controls for a real account", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[]}
        initialView="past"
        currentUser={{
          id: "user-1",
          email: "person@example.com",
          isDevTest: false,
        }}
      />,
    );

    expect(html).not.toContain("Clear dev data");
    expect(html).not.toContain("Load synthetic demo");
  });

  it("labels the offline judge demo without dev-only data controls", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[]}
        initialView="past"
        currentUser={{
          id: "11111111-1111-1111-1111-111111111111",
          email: "demo-judge@oweme.local",
          isDevTest: false,
          isDemo: true,
        }}
      />,
    );

    expect(html).toContain("Demo");
    expect(html).toContain('data-testid="account-mode-menu-button"');
    expect(html).not.toContain("demo-judge@oweme.local");
    expect(html).not.toContain("Judge demo account");
    expect(html).not.toContain("Clear dev data");
    expect(html).not.toContain("Load synthetic demo");
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

    expect(html).toContain("Track a visit while you wait for the EOB");
    expect(html).toContain('aria-label="Provider or clinic"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain("Stone Creek Village Dentistry");
    expect(html).toContain("Quest Diagnostics");
    expect(html).toContain('value=""');
    expect(html).not.toContain('value="275.00"');
    expect(html).toContain('value="" selected="">Select payment method');
    expect(html).toContain("Provider balance / credit");
    expect(html).toContain('value="" selected="">Select visit type');

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("View details");
    expect(html).toContain('role="separator"');
    expect(html).toContain("Resize Future Visits form and tracked details");
  });

  it("renders the past credits workspace with visit-based matching UI", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[
          {
            id: "finding-6",
            provider_name: "ALI SALEHPOUR MD DDS",
            finding_type: "possible_credit",
            status: "open",
            title: "ALI SALEHPOUR MD DDS",
            summary: "Confirmed by you: HSA paid 1079.10 for 2026-02-27, but the claim says you owe 605.20.",
            details: {
              provider_name: "ALI SALEHPOUR MD DDS",
              claim_provider_name: "BAY AREA OSM",
              service_date: "2026-02-27",
              paid_amount: "1079.10",
              responsibility_amount: "605.20",
              credit_amount: "473.90",
              payment_date: "2026-03-04",
              payment_source: "Withdrawal",
              confirmation_source: "Confirmed by you",
            },
          },
          {
            id: "finding-5",
            provider_name: "ALI SALEHPOUR MD DDS",
            finding_type: "possible_credit",
            status: "open",
            title: "ALI SALEHPOUR MD DDS",
            summary: "Confirmed by you: HSA paid 275.00 for 2026-02-18, but the claim says you owe 125.00.",
            details: {
              provider_name: "ALI SALEHPOUR MD DDS",
              claim_provider_name: "BAY AREA OSM",
              service_date: "2026-02-18",
              paid_amount: "275.00",
              responsibility_amount: "125.00",
              credit_amount: "150.00",
              payment_date: "2026-02-19",
              payment_source: "Withdrawal",
              confirmation_source: "Confirmed by you",
            },
          },
          {
            id: "finding-3",
            provider_name: "Medical payment",
            finding_type: "unassigned_medical_payment",
            status: "open",
            title: "Medical payment",
            summary: "Found $142.00 medical payment on 2026-05-20, but the bank statement does not identify the provider.",
            details: {
              provider_name: "Medical payment",
              payment_date: "2026-05-20",
              paid_amount: "142.00",
              payment_source: "Purchase",
              possible_claims: [
                {
                  provider_name: "Quest Diagnostics",
                  service_date: "2026-05-08",
                  responsibility_amount: "32.40",
                },
                {
                  provider_name: "JAMES D KIM",
                  service_date: "2026-05-13",
                  responsibility_amount: "12.40",
                },
              ],
            },
          },
          {
            id: "finding-4",
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

    const firstCreditCard = html.match(
      /<button type="button" data-testid="review-finding-finding-6"[\s\S]*?<\/button>/,
    )?.[0] ?? "";

    expect(html).not.toContain("PAST CREDITS");
    expect(html).toContain("Find a potential refund in past bills");
    expect(html).toContain('for="claims-file-input"');
    expect(html).toContain('for="payments-file-input"');
    expect(html).toContain("Manual fallback");
    expect(html).toContain("Add manually");
    expect(html).not.toContain("Payment / receipt");
    expect(html).not.toContain("Add row");
    expect(html).toContain("$820.90");
    expect(html).toContain("possible credits found");
    expect(html).not.toContain("Matched confidently");
    expect(html).not.toContain("Need review");
    expect(html).not.toContain("Unexplained payments");
    expect(html).not.toContain("current run");
    expect(html).toContain("Review queue");
    expect(html).not.toContain("Match evidence");
    expect(html).not.toContain("Confirm match");
    expect(html).not.toContain("Not the same visit");
    expect(html).not.toContain("Add receipt or payment");
    expect(html).toContain("Unassigned payment");
    expect(html).not.toContain("Possible overpayment");
    expect(html).not.toContain("BAY AREA OSM payment picture");
    expect(html).toContain("ALI SALEHPOUR MD DDS");
    expect(html).toContain("Confirmed credit $150.00");
    expect(html).toContain("Confirmed credit $473.90");
    expect(html).toContain("You paid");
    expect(html).toContain("Payment method");
    expect(html).toContain("HSA");
    expect(html).toContain("275.00");
    expect(html).toContain("1079.10");
    expect(html).not.toContain("Likely HSA credit");
    expect(html).not.toContain("Likely HSA payment");
    expect(html).not.toContain("Confidence:");
    expect(html).not.toContain("HSA withdrawal covers the EOB responsibility");
    expect(html).not.toContain("Needs confirmation because the EOB provider and payment merchant are different");
    expect(html).toContain("Why this may be a credit/refund");
    expect(html).toContain("Confirm this visit &amp; ask for a refund");
    expect(html).not.toContain("Request a $473.90 credit/refund review from ALI SALEHPOUR MD DDS.");
    expect(html).toContain("Step 1 complete: payment matches confirmed");
    expect(html).toContain("Payment matches are confirmed for all 2 visits");
    expect(html).toContain("Confirm this visit &amp; ask for a refund");
    expect(html).not.toContain("Step 2");
    expect(html).toContain("Request separately");
    expect(firstCreditCard).not.toContain("Potential credit $473.90 — request a provider review.");
    expect(firstCreditCard).not.toContain("They may owe you $473.90");
    expect(firstCreditCard).not.toContain("Ask ALI SALEHPOUR MD DDS for a credit/refund review.");
    expect(html).toContain("Records to check");
    expect(html).toContain("Payment method: HSA");
    expect(html).not.toContain("Next step");
    expect(html).not.toContain("Request $473.90 credit/refund");
    expect(html).toContain("This payment is not for this visit");
    expect(html).toContain("Add receipt");
    expect(html).not.toContain("Confirm this payment matches");
    expect(html).not.toContain("They may owe you $150.00");
    expect(html).not.toContain("They may owe you $473.90");
    expect(html).not.toContain("Ask ALI SALEHPOUR DDS for a credit/refund review.");
    expect(html).not.toContain("Dental provider under review");
    expect(html).not.toContain("Dental payment under review");
    expect(html).not.toContain("Ask ALI SALEHPOUR MD DDS for a credit/refund review.");
    expect(html).toContain("Medical payment");
    expect(html).toContain("Stone Creek Village Dentistry");
    expect(html).not.toContain("Use sample");
  });
});
