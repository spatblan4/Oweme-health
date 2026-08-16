import { describe, expect, it, vi } from "vitest";

const { requireRequestUserId, deleteVisit } = vi.hoisted(() => ({
  requireRequestUserId: vi.fn(),
  deleteVisit: vi.fn(),
}));

vi.mock("@/lib/auth/request-user", () => ({
  requireRequestUserId,
}));

vi.mock("@/lib/visits/repository", () => ({
  deleteVisit,
}));

import { DELETE } from "./route";

describe("DELETE /api/visits/[id]", () => {
  it("deletes the owned visit for the current user", async () => {
    requireRequestUserId.mockResolvedValueOnce("user-1");
    deleteVisit.mockResolvedValueOnce(undefined);

    const response = await DELETE(new Request("http://localhost:3001/api/visits/visit-1"), {
      params: Promise.resolve({ id: "visit-1" }),
    });

    expect(deleteVisit).toHaveBeenCalledWith("user-1", "visit-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
