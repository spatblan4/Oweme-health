import { describe, expect, it } from "vitest";

import {
  buildVisitCreatePayload,
  createDefaultFutureVisitDraft,
  buildProviderSuggestions,
  filterProviderSuggestions,
} from "./future-visit-draft";

describe("future visit draft helpers", () => {
  it("starts with a usable date while leaving visit details empty", () => {
    const draft = createDefaultFutureVisitDraft();

    expect(draft).toMatchObject({
      provider: "",
      visitType: "",
      paidToday: "",
      paidWith: "",
      needsReimbursement: false,
      insurance: "",
      claimReadyIn: "3 weeks",
      notes: "",
    });
    expect(draft.visitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("builds a visit payload and computes claim check date from weeks", () => {
    const payload = buildVisitCreatePayload({
      ...createDefaultFutureVisitDraft(),
      provider: "Stone Creek Village Dentistry",
      visitType: "Dental",
      visitDate: "2026-07-04",
      paidToday: "275.00",
      paidWith: "Personal card",
      insurance: "GEHA",
      claimReadyIn: "3 weeks",
      notes: "Crown follow-up",
    });

    expect(payload).toEqual({
      providerName: "Stone Creek Village Dentistry",
      visitDate: "2026-07-04",
      visitType: "dental",
      status: "attended",
      insuranceName: "GEHA",
      paidAmount: 275,
      paymentMethod: "Personal card",
      reimbursementNeeded: false,
      claimCheckAfter: "2026-07-25",
      notes: "Crown follow-up",
    });
  });

  it("maps unsupported visit types to other and omits blank optional fields", () => {
    const payload = buildVisitCreatePayload({
      ...createDefaultFutureVisitDraft(),
      provider: "Quest Diagnostics",
      visitType: "Lab",
      visitDate: "2026-05-08",
      paidToday: "",
      paidWith: "",
      insurance: "",
      claimReadyIn: "1 week",
      notes: "",
    });

    expect(payload).toEqual({
      providerName: "Quest Diagnostics",
      visitDate: "2026-05-08",
      visitType: "other",
      status: "attended",
      reimbursementNeeded: false,
      claimCheckAfter: "2026-05-15",
    });
  });

  it("builds unique provider suggestions from existing visits and findings", () => {
    expect(
      buildProviderSuggestions(
        [
          { provider_name: "Stone Creek Village Dentistry" },
          { provider_name: "Quest Diagnostics" },
        ],
        [
          { provider_name: "Stone Creek Village Dentistry" },
          { provider_name: "BAY AREA OSM" },
        ],
      ),
    ).toEqual(
      expect.arrayContaining([
        "Stone Creek Village Dentistry",
        "Quest Diagnostics",
        "BAY AREA OSM",
      ]),
    );
  });

  it("includes useful default providers so autocomplete works before the user has history", () => {
    const suggestions = buildProviderSuggestions([], []);

    expect(suggestions).toEqual(
      expect.arrayContaining([
        "BAY AREA OSM",
        "Quest Diagnostics",
        "Kaiser Permanente",
        "Walgreens Pharmacy",
      ]),
    );
    expect(filterProviderSuggestions(suggestions, "bay")).toContain("BAY AREA OSM");
  });

  it("surfaces real providers from finding details while skipping generic payment labels", () => {
    expect(
      buildProviderSuggestions(
        [{ provider_name: "Stone Creek Village Dentistry", visit_date: "2026-07-04" }],
        [
          {
            provider_name: "Medical payment",
            finding_type: "unassigned_medical_payment",
            details: {
              possible_claims: [
                { provider_name: "Quest Diagnostics" },
                { provider_name: "JAMES D KIM" },
              ],
            },
          },
          {
            title: "Possible match",
            details: {
              provider_name: "Bay Area OSM",
              candidate_payments: [{ provider_name: "Stone Creek Village Dentistry" }],
            },
          },
        ],
      ),
    ).toEqual(
      expect.arrayContaining([
        "Stone Creek Village Dentistry",
        "Quest Diagnostics",
        "JAMES D KIM",
        "Bay Area OSM",
      ]),
    );
  });

  it("filters provider suggestions by token prefix without losing the empty-query defaults", () => {
    const suggestions = [
      "Stone Creek Village Dentistry",
      "Quest Diagnostics",
      "JAMES D KIM",
    ];

    expect(filterProviderSuggestions(suggestions, "")).toEqual(suggestions);
    expect(filterProviderSuggestions(suggestions, "sto den")).toEqual([
      "Stone Creek Village Dentistry",
    ]);
    expect(filterProviderSuggestions(suggestions, "quest")).toEqual(["Quest Diagnostics"]);
  });
});
