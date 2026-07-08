import { describe, expect, it } from "vitest";

import {
  buildVisitCreatePayload,
  createDefaultFutureVisitDraft,
  buildProviderSuggestions,
} from "./future-visit-draft";

describe("future visit draft helpers", () => {
  it("starts with mostly empty fields so the form does not imply known visit details", () => {
    expect(createDefaultFutureVisitDraft()).toEqual({
      provider: "",
      visitType: "",
      visitDate: "",
      paidToday: "",
      paidWith: "",
      needsReimbursement: false,
      insurance: "",
      claimReadyIn: "3 weeks",
      notes: "",
    });
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
    ).toEqual([
      "Stone Creek Village Dentistry",
      "Quest Diagnostics",
      "BAY AREA OSM",
    ]);
  });
});
