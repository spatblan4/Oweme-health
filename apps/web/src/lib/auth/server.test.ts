import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  set: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: mocks.getAll,
    set: mocks.set,
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("./env", () => ({
  getPublicSupabaseEnv: () => ({
    url: "https://supabase.test",
    anonKey: "anon-key",
  }),
}));

import { createServerSupabaseClient } from "./server";

describe("createServerSupabaseClient", () => {
  it("configures a persistent 30-day auth session", async () => {
    mocks.getAll.mockReturnValue([]);

    await createServerSupabaseClient();

    expect(mocks.createServerClient.mock.calls.at(-1)?.[2].cookieOptions.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("allows Server Component auth reads when Supabase attempts a cookie refresh", async () => {
    mocks.getAll.mockReturnValue([{ name: "oweme-demo-mode", value: "1" }]);
    mocks.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll([
            {
              name: "sb-refresh-token",
              value: "new-refresh-token",
              options: { path: "/" },
            },
          ]);
          return {
            data: {
              user: {
                id: "personal-user-1",
                email: "me@example.com",
              },
            },
          };
        },
      },
    }));

    const supabase = await createServerSupabaseClient();

    await expect(supabase.auth.getUser()).resolves.toEqual({
      data: {
        user: {
          id: "personal-user-1",
          email: "me@example.com",
        },
      },
    });
  });
});
