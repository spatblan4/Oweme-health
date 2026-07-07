import { describe, expect, it, vi } from "vitest";

import {
  DEV_TEST_EMAIL,
  DEV_TEST_USER_ID,
  createDevTestAccountLink,
  ensureDevTestUser,
} from "./dev-login";

describe("createDevTestAccountLink", () => {
  it("requests a magic link for the fixed development test account", async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: "https://example.test/magic",
        },
      },
      error: null,
    });

    const link = await createDevTestAccountLink("http://localhost:3001", {
      generateLink,
    });

    expect(link).toBe("https://example.test/magic");
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: DEV_TEST_EMAIL,
      options: {
        redirectTo: "http://localhost:3001/auth/callback?next=/dashboard",
      },
    });
  });

  it("throws when Supabase returns an auth error", async () => {
    await expect(
      createDevTestAccountLink("http://localhost:3001", {
        generateLink: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "rate limit exceeded" },
        }),
      }),
    ).rejects.toThrow("rate limit exceeded");
  });

  it("reuses the existing fixed development user when it already exists", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [{ id: DEV_TEST_USER_ID, email: DEV_TEST_EMAIL }],
      },
      error: null,
    });
    const createUser = vi.fn();

    const userId = await ensureDevTestUser({
      listUsers,
      createUser,
    });

    expect(userId).toBe(DEV_TEST_USER_ID);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates the fixed development user when it does not exist yet", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [],
      },
      error: null,
    });
    const createUser = vi.fn().mockResolvedValue({
      data: {
        user: { id: DEV_TEST_USER_ID, email: DEV_TEST_EMAIL },
      },
      error: null,
    });

    const userId = await ensureDevTestUser({
      listUsers,
      createUser,
    });

    expect(userId).toBe(DEV_TEST_USER_ID);
    expect(createUser).toHaveBeenCalledWith({
      id: DEV_TEST_USER_ID,
      email: DEV_TEST_EMAIL,
      email_confirm: true,
      user_metadata: {
        display_name: "Dev Test User",
      },
    });
  });
});
