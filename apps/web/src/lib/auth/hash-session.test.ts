import { describe, expect, it } from "vitest";

import { readSupabaseSessionFromHash } from "./hash-session";

describe("readSupabaseSessionFromHash", () => {
  it("reads access and refresh tokens from the URL hash", () => {
    expect(
      readSupabaseSessionFromHash(
        "#access_token=access-123&expires_at=1&refresh_token=refresh-456&type=signup",
      ),
    ).toEqual({
      accessToken: "access-123",
      refreshToken: "refresh-456",
    });
  });

  it("returns null when the hash does not contain a session", () => {
    expect(readSupabaseSessionFromHash("#error=otp_expired")).toBeNull();
    expect(readSupabaseSessionFromHash("")).toBeNull();
  });
});
