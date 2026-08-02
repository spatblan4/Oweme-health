import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({
  createAdminSupabaseClient: () => ({
    auth: {
      admin: {
        generateLink: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        listUsers: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        createUser: vi.fn(),
      },
    },
  }),
}));

import { POST } from "./route";

describe("POST /api/dev/login", () => {
  it("falls back to the local dev workspace when Supabase is unavailable", async () => {
    const response = await POST(new Request("http://localhost:3002/api/dev/login"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3002/dashboard");
    expect(response.headers.get("set-cookie")).toContain("oweme-user-id=");
  });
});
