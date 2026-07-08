import { describe, expect, it, vi } from "vitest";

import { createManualPayment } from "./repository";

describe("payments repository helpers", () => {
  it("creates a manual payment row with generated metadata", async () => {
    const insertPayment = vi.fn().mockResolvedValue({
      id: "payment-1",
      provider_name_raw: "Stone Creek Village Dentistry",
    });

    const result = await createManualPayment(
      "user-1",
      {
        paymentSource: "Receipt",
        providerName: "Stone Creek Village Dentistry",
        paymentDate: "2026-07-03",
        amount: "78.00",
      },
      {
        randomId: () => "payment-1",
        now: () => "2026-07-07T10:00:00.000Z",
        insertPayment,
      },
    );

    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "payment-1",
        user_id: "user-1",
        source_file_id: null,
        provider_name_raw: "Stone Creek Village Dentistry",
        provider_name_normalized: "STONE CREEK VILLAGE DENTISTRY",
        payment_date: "2026-07-03",
        amount: 78,
        payment_source: "Receipt",
      }),
    );
    expect(result).toEqual({
      id: "payment-1",
      provider_name_raw: "Stone Creek Village Dentistry",
    });
  });
});
