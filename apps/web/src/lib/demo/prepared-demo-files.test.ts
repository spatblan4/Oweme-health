import { describe, expect, it } from "vitest";

import { getPreparedDemoUpload, areDemoUploadsReady } from "./prepared-demo-files";

describe("prepared demo files", () => {
  it("provides one ready claim file and one ready payment file", () => {
    const claim = getPreparedDemoUpload("claim");
    const payment = getPreparedDemoUpload("payment");

    expect(claim.name).toBe("ClaimResults.xlsx");
    expect(payment.name).toBe("HSATransactionsAsOf_07032026.csv");
    expect(claim.status).toBe("uploaded");
    expect(payment.status).toBe("uploaded");
    expect(areDemoUploadsReady({ claim: [claim], payment: [payment] })).toBe(true);
    expect(areDemoUploadsReady({ claim: [claim], payment: [] })).toBe(false);
  });
});
