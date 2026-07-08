import { describe, expect, it } from "vitest";

import { createSamplePastAuditState } from "./sample-audit";

describe("sample audit helpers", () => {
  it("returns a ready-to-render demo audit state", () => {
    const state = createSamplePastAuditState();

    expect(state.status).toContain("Sample");
    expect(state.findings).toHaveLength(3);
    expect(state.selectedUploads.claim[0]).toEqual(
      expect.objectContaining({ name: "ClaimResults-sample.xlsx", status: "uploaded" }),
    );
    expect(state.selectedUploads.payment[0]).toEqual(
      expect.objectContaining({ name: "AppleCard-sample.csv", status: "uploaded" }),
    );
  });
});
