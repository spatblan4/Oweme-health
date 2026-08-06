import { describe, expect, it } from "vitest";

import { buildActionDraft } from "./draft-action";

const creditFinding = {
  id: "f1",
  finding_type: "possible_credit",
  title: "LAiMA OBGYN INC",
  details: {
    provider_name: "LAiMA OBGYN INC",
    service_date: "2026-06-25",
    paid_amount: "100.00",
    responsibility_amount: "61.29",
    credit_amount: "38.71",
    matched_via: "facility",
  },
};

const unclearFinding = {
  id: "f2",
  finding_type: "allocation_unclear",
  title: "Quest Diagnostics",
  details: {
    provider_name: "Quest Diagnostics",
    service_date: "2026-05-08",
    responsibility_amount: "27.30",
  },
};

describe("buildActionDraft", () => {
  it("drafts a credit-focused email and phone script for a possible_credit", () => {
    const draft = buildActionDraft(creditFinding, { phone: "555-1234" });

    expect(draft.providerName).toBe("LAiMA OBGYN INC");
    expect(draft.emailSubject).toBe("Possible credit from LAiMA OBGYN INC");
    expect(draft.emailBody).toContain("$100.00");
    expect(draft.emailBody).toContain("$61.29");
    expect(draft.emailBody).toContain("$38.71");
    expect(draft.emailBody).toContain("2026-06-25");
    expect(draft.emailBody).toContain("refund");
    expect(draft.phoneScript).toContain("Call LAiMA OBGYN INC at 555-1234");
    expect(draft.phoneScript).toContain("$38.71");
  });

  it("drafts a billing-question email when there is no overpayment", () => {
    const draft = buildActionDraft(unclearFinding);

    expect(draft.emailSubject).toBe("Question about billing from Quest Diagnostics");
    expect(draft.emailBody).toContain("$27.30");
    expect(draft.emailBody).not.toContain("credit of");
    expect(draft.phoneScript).toContain("Quest Diagnostics");
  });

  it("omits the phone number in the script when the provider has none", () => {
    const draft = buildActionDraft(creditFinding);

    expect(draft.phoneScript).toContain("Call LAiMA OBGYN INC.");
    expect(draft.phoneScript).not.toContain(" at ");
  });

  it("falls back to a generic provider name when title and details are missing", () => {
    const draft = buildActionDraft({ finding_type: "possible_credit" });

    expect(draft.providerName).toBe("the provider");
    expect(draft.emailSubject).toContain("Possible credit");
  });
});
