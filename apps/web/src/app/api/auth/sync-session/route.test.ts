import { describe, expect, it, vi } from "vitest";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";

const getUser = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser,
    },
  })),
}));

import { POST } from "./route";

describe("POST /api/auth/sync-session", () => {
  it("syncs the personal account cookie and exits demo mode", async () => {
    getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "personal-user-1",
          email: "me@example.com",
        },
      },
      error: null,
    });

    const response = await POST();
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "personal-user-1" });
    expect(setCookie).toContain("oweme-user-id=personal-user-1");
    expect(setCookie).toContain(`${DEMO_MODE_COOKIE}=`);
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});
