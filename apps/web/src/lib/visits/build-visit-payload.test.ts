import { describe, expect, it } from "vitest";

import {
  buildVisitPayload,
  computeClaimCheckAfter,
  mapVisitType,
  type VisitDraft,
} from "./build-visit-payload";

const baseDraft: VisitDraft = {
  provider: "Stone Creek Village Dentistry",
  visitType: "Dental",
  visitDate: "2026-07-04",
  paidToday: "275.00",
  paidWith: "Personal card",
  needsReimbursement: false,
  insurance: "",
  claimReadyIn: "3 weeks",
  notes: "",
};

describe("mapVisitType", () => {
  it("maps known visit types and lowercases", () => {
    expect(mapVisitType("Dental")).toBe("dental");
    expect(mapVisitType("medical")).toBe("medical");
    expect(mapVisitType("VISION")).toBe("vision");
  });

  it("falls back to other for unmapped types", () => {
    expect(mapVisitType("Lab")).toBe("other");
    expect(mapVisitType("Therapy")).toBe("other");
    expect(mapVisitType("")).toBe("other");
  });
});

describe("computeClaimCheckAfter", () => {
  it("adds the parsed number of weeks to the visit date in UTC", () => {
    expect(computeClaimCheckAfter("2026-07-04", "3 weeks")).toBe("2026-07-25");
    expect(computeClaimCheckAfter("2026-07-04", "1 week")).toBe("2026-07-11");
  });

  it("returns undefined when the input is not parseable", () => {
    expect(computeClaimCheckAfter("2026-07-04", "soon")).toBeUndefined();
    expect(computeClaimCheckAfter("2026-07-04", "0 weeks")).toBeUndefined();
    expect(computeClaimCheckAfter("", "3 weeks")).toBeUndefined();
    expect(computeClaimCheckAfter("not-a-date", "3 weeks")).toBeUndefined();
  });
});

describe("buildVisitPayload", () => {
  it("maps the dashboard draft to a POST /api/visits payload", () => {
    expect(buildVisitPayload(baseDraft)).toEqual({
      providerName: "Stone Creek Village Dentistry",
      visitDate: "2026-07-04",
      visitType: "dental",
      paymentMethod: "Personal card",
      reimbursementNeeded: false,
      paidAmount: 275,
      claimCheckAfter: "2026-07-25",
    });
  });

  it("maps Lab and Therapy visit types to other", () => {
    expect(buildVisitPayload({ ...baseDraft, visitType: "Therapy" }).visitType).toBe("other");
    expect(buildVisitPayload({ ...baseDraft, visitType: "Lab" }).visitType).toBe("other");
  });

  it("omits optional fields when the draft leaves them empty", () => {
    const payload = buildVisitPayload({
      ...baseDraft,
      paidToday: "",
      insurance: "",
      notes: "",
      claimReadyIn: "",
    });
    expect(payload).not.toHaveProperty("paidAmount");
    expect(payload).not.toHaveProperty("insuranceName");
    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("claimCheckAfter");
  });

  it("includes insurance and notes when provided", () => {
    const payload = buildVisitPayload({
      ...baseDraft,
      insurance: "Delta Dental",
      notes: "Possible overcharge",
    });
    expect(payload.insuranceName).toBe("Delta Dental");
    expect(payload.notes).toBe("Possible overcharge");
  });
});
