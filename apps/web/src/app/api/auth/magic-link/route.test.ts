import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SUPABASE_PROJECT_UNRESOLVED_MESSAGE,
  SUPABASE_UNREACHABLE_MESSAGE,
  supabaseConnectionErrorMessage,
} from "@/lib/auth/magic-link";

const signInWithOtp = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      signInWithOtp,
    },
  })),
}));

import { POST } from "./route";

function magicLinkRequest(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return new Request("http://localhost:3002/api/auth/magic-link", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/auth/magic-link", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects back to login with validation feedback when email is missing", async () => {
    const response = await POST(magicLinkRequest(""));

    expect(response.status).toBe(303);
    expect(signInWithOtp).not.toHaveBeenCalled();

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("authError")).toBe(
      "Enter your email to receive a sign-in code.",
    );
  });

  it("sends a Supabase OTP and redirects back with success feedback", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");

    const response = await POST(magicLinkRequest("me@example.com"));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "me@example.com",
      options: {
        emailRedirectTo: "http://localhost:3001/auth/callback?next=/dashboard",
      },
    });
    expect(response.status).toBe(303);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("authMessage")).toBe(
      "Magic link sent. Check your email to finish signing in.",
    );
    expect(location.searchParams.get("email")).toBe("me@example.com");
  });

  it("converts low-level Supabase fetch failures into useful login feedback", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: "Failed to fetch" } });

    const response = await POST(magicLinkRequest("me@example.com"));

    expect(response.status).toBe(303);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("authError")).toBe(SUPABASE_UNREACHABLE_MESSAGE);
    expect(location.searchParams.get("email")).toBe("me@example.com");
  });

  it("explains when the configured Supabase project host cannot be resolved", async () => {
    const dnsError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }),
    });
    signInWithOtp.mockRejectedValueOnce(dnsError);

    const response = await POST(magicLinkRequest("me@example.com"));

    expect(response.status).toBe(303);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("authError")).toBe(SUPABASE_PROJECT_UNRESOLVED_MESSAGE);
    expect(location.searchParams.get("email")).toBe("me@example.com");
  });

  it("classifies nested Supabase DNS failures", () => {
    expect(
      supabaseConnectionErrorMessage({
        cause: {
          code: "ENOTFOUND",
        },
      }),
    ).toBe(SUPABASE_PROJECT_UNRESOLVED_MESSAGE);
  });
});
