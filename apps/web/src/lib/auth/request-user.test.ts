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
});
