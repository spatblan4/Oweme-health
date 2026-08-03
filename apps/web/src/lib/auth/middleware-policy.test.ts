import { describe, expect, it } from "vitest";

import { shouldUseDemoModeCookie, shouldUseSupabaseMiddlewareAuth } from "./middleware-policy";

describe("shouldUseSupabaseMiddlewareAuth", () => {
  it("does not probe Supabase for local development dashboard requests without a local session", () => {
    expect(
      shouldUseSupabaseMiddlewareAuth({
        hostname: "localhost",
        localUserId: null,
        pathname: "/dashboard",
        nodeEnv: "development",
      }),
    ).toBe(false);
  });

  it("keeps Supabase probing available for production protected requests", () => {
    expect(
      shouldUseSupabaseMiddlewareAuth({
        hostname: "oweme.example",
        localUserId: null,
        pathname: "/dashboard",
        nodeEnv: "production",
      }),
    ).toBe(true);
  });

  it("probes Supabase on localhost when an unrecognized local user cookie is present", () => {
    expect(
      shouldUseSupabaseMiddlewareAuth({
        hostname: "localhost",
        localUserId: "c866903e-f167-49b4-8bcf-3b9102f557ac",
        pathname: "/dashboard",
        nodeEnv: "development",
      }),
    ).toBe(true);
  });

  it("probes Supabase on the login page when a saved personal session exists", () => {
    expect(
      shouldUseSupabaseMiddlewareAuth({
        hostname: "localhost",
        localUserId: "c866903e-f167-49b4-8bcf-3b9102f557ac",
        pathname: "/login",
        nodeEnv: "development",
      }),
    ).toBe(true);
  });
});

describe("shouldUseDemoModeCookie", () => {
  it("does not let a stale demo cookie block the personal login page", () => {
    expect(shouldUseDemoModeCookie("/login")).toBe(false);
  });

  it("keeps explicit dashboard demo sessions available", () => {
    expect(shouldUseDemoModeCookie("/dashboard")).toBe(true);
  });
});
