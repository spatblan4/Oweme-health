import { describe, expect, it, vi } from "vitest";

import { requireRequestUserId } from "./request-user";

describe("requireRequestUserId", () => {
  it("returns the authenticated user id from the request session", async () => {
    const request = new Request("http://localhost/api/test");

    await expect(
      requireRequestUserId(request, {
        getUserId: vi.fn().mockResolvedValue("user-1"),
      }),
    ).resolves.toBe("user-1");
  });

  it("rejects when the request has no authenticated user", async () => {
    const request = new Request("http://localhost/api/test");

    await expect(
      requireRequestUserId(request, {
        getUserId: vi.fn().mockResolvedValue(null),
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("accepts the cloud demo session when the demo cookie is present", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: { cookie: "oweme-demo-mode=1; oweme-user-id=11111111-1111-1111-1111-111111111111" },
    });

    await expect(
      requireRequestUserId(request, {
        getUserId: vi.fn().mockResolvedValue(null),
        getDemoUserId: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
      }),
    ).resolves.toBe("11111111-1111-1111-1111-111111111111");
  });
});
