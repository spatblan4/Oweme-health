import { describe, expect, it } from "vitest";

import { resolveNextPath } from "./callback";

describe("resolveNextPath", () => {
  it("keeps safe in-app paths", () => {
    expect(resolveNextPath("/dashboard")).toBe("/dashboard");
  });

  it("falls back to dashboard for external or empty values", () => {
    expect(resolveNextPath("https://evil.test")).toBe("/dashboard");
    expect(resolveNextPath("")).toBe("/dashboard");
  });
});
