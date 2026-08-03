import { describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: { exchangeCodeForSession },
  })),
}));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  it("persists the local user id after a successful Supabase exchange", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: { id: "personal-user-1" } },
      error: null,
    });

    const response = await GET(new Request("http://localhost:3001/auth/callback?code=test-code"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/dashboard");
    expect(response.headers.get("set-cookie")).toContain("oweme-user-id=personal-user-1");
  });

  it("returns to login when Supabase rejects the code", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("invalid code"),
    });

    const response = await GET(new Request("http://localhost:3001/auth/callback?code=bad-code"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("authError")).toContain("Sign-in could not be completed");
  });
});
