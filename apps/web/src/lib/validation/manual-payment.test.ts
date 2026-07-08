import { describe, expect, it } from "vitest";

import { parseManualPaymentInput } from "./manual-payment";

describe("parseManualPaymentInput", () => {
  it("accepts manual payment rows from the fallback form", () => {
    expect(
      parseManualPaymentInput({
        paymentSource: "Receipt",
        providerName: "Stone Creek Village Dentistry",
        paymentDate: "2026-07-03",
        amount: "78.00",
      }),
    ).toEqual({
      paymentSource: "Receipt",
      providerName: "Stone Creek Village Dentistry",
      paymentDate: "2026-07-03",
      amount: 78,
    });
  });

  it("rejects invalid manual payment rows", () => {
    expect(() =>
      parseManualPaymentInput({
        paymentSource: "",
        providerName: " ",
        paymentDate: "",
        amount: "-1",
      }),
    ).toThrow("Invalid manual payment payload");
  });
});
