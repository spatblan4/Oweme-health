import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({ auth: { verifyOtp } })),
}));

import { POST } from "./route";

function request(email: string, code: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("code", code);
  return new Request("http://localhost:3001/api/auth/verify-code", { method: "POST", body: formData });
}

describe("POST /api/auth/verify-code", () => {
  beforeEach(() => verifyOtp.mockReset());

  it("verifies the email OTP and establishes the app user cookie", async () => {
    verifyOtp.mockResolvedValueOnce({ data: { user: { id: "personal-user-1" } }, error: null });

    const response = await POST(request("me@example.com", "123456"));

    expect(response.status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({ email: "me@example.com", token: "123456", type: "email" });
    expect(response.headers.get("set-cookie")).toContain("oweme-user-id=personal-user-1");
    await expect(response.json()).resolves.toEqual({ next: "/dashboard" });
  });

  it("rejects invalid code format before calling Supabase", async () => {
    const response = await POST(request("me@example.com", "12"));

    expect(response.status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ message: "Enter the 6-digit code from your email." });
  });
});
