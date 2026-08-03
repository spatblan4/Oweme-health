import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({ auth: { signInWithOtp } })),
}));

import { POST } from "./route";

function request(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return new Request("http://localhost:3001/api/auth/send-code", { method: "POST", body: formData });
}

describe("POST /api/auth/send-code", () => {
  beforeEach(() => signInWithOtp.mockReset());

  it("requests an email OTP with the current app callback URL", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });

    const response = await POST(request("me@example.com"));

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "me@example.com",
      options: { emailRedirectTo: "http://localhost:3001/auth/callback?next=/dashboard" },
    });
    await expect(response.json()).resolves.toEqual({
      message: "Code sent. Check your email for the 6-digit code.",
    });
  });

  it("returns a rate-limit status without throwing", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: "Email rate limit exceeded" } });

    const response = await POST(request("me@example.com"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ message: "Email rate limit exceeded" });
  });
});
