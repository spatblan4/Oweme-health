import { describe, expect, it, vi } from "vitest";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";

const mocks = vi.hoisted(() => ({
  requireRequestUserId: vi.fn(),
  getOwnedFileRow: vi.fn(),
  runSyncAudit: vi.fn(),
}));

vi.mock("@/lib/auth/request-user", () => ({
  requireRequestUserId: mocks.requireRequestUserId,
}));

vi.mock("@/lib/db/files", () => ({
  getOwnedFileRow: mocks.getOwnedFileRow,
}));

vi.mock("@/lib/audit/run-sync-audit", () => ({
  runSyncAudit: mocks.runSyncAudit,
}));

import { POST } from "./route";

describe("POST /api/audit/run", () => {
  it("exits demo mode after a real uploaded-file audit succeeds", async () => {
    mocks.requireRequestUserId.mockResolvedValueOnce("personal-user-1");
    mocks.getOwnedFileRow.mockResolvedValue({ id: "file-1", user_id: "personal-user-1" });
    mocks.runSyncAudit.mockResolvedValueOnce({
      claims_checked: 7,
      payments_checked: 42,
      findings_created: 3,
    });

    const response = await POST(
      new Request("http://localhost:3001/api/audit/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${DEMO_MODE_COOKIE}=1`,
        },
        body: JSON.stringify({
          claimFileIds: ["claim-file"],
          paymentFileIds: ["payment-file"],
        }),
      }),
    );

    const setCookie = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claims_checked: 7,
      payments_checked: 42,
      findings_created: 3,
    });
    expect(setCookie).toContain(`${DEMO_MODE_COOKIE}=`);
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(setCookie).toContain("Path=/");
  });
});
