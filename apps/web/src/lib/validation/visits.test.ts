import { describe, expect, it } from "vitest";

import { parseVisitCreateInput, parseVisitPatchInput } from "./visits";

describe("visit validation", () => {
  it("accepts a minimal visit create payload", () => {
    expect(
      parseVisitCreateInput({
        providerName: "Stone Creek Village Dentistry",
        visitDate: "2026-07-03",
      }),
    ).toEqual({
      providerName: "Stone Creek Village Dentistry",
      visitDate: "2026-07-03",
      visitType: "other",
      status: "unknown",
    });
  });

  it("rejects an empty provider name", () => {
    expect(() =>
      parseVisitCreateInput({
        providerName: " ",
        visitDate: "2026-07-03",
      }),
    ).toThrow("Invalid visit payload");
  });

  it("accepts a patch payload with one editable field", () => {
    expect(
      parseVisitPatchInput({
        notes: "Need to check EOB later",
      }),
    ).toEqual({
      notes: "Need to check EOB later",
    });
  });
});

