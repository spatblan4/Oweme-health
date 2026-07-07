import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { applyResponseHeaders } from "./middleware-client";

describe("applyResponseHeaders", () => {
  it("ignores missing headers from Supabase SSR callbacks", () => {
    const response = NextResponse.next();

    expect(() => applyResponseHeaders(response, undefined)).not.toThrow();
    expect(response.headers.get("x-oweme-test")).toBeNull();
  });

  it("copies provided headers onto the Next response", () => {
    const response = NextResponse.next();

    applyResponseHeaders(response, {
      "x-oweme-test": "ready",
    });

    expect(response.headers.get("x-oweme-test")).toBe("ready");
  });
});
