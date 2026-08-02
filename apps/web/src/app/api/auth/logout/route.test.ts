import { describe, expect, it, vi } from "vitest";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";
import { DEV_TEST_USER_ID } from "@/lib/auth/dev-login";

const signOut = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      signOut,
    },
  })),
}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("clears a local demo session without waiting on Supabase", async () => {
    const response = await POST(
      new Request("http://localhost:3002/api/auth/logout", {
        headers: {
          cookie: `${DEMO_MODE_COOKIE}=1; oweme-user-id=11111111-1111-1111-1111-111111111111`,
        },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3002/login");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("clears a local dev session without waiting on Supabase", async () => {
    const response = await POST(
      new Request("http://localhost:3002/api/auth/logout", {
        headers: {
          cookie: `oweme-user-id=${DEV_TEST_USER_ID}`,
        },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3002/login");
    expect(signOut).not.toHaveBeenCalled();
  });
});
