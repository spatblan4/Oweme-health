import { describe, expect, it } from "vitest";

import { resolveAppAccess } from "./access";

describe("resolveAppAccess", () => {
  it("redirects anonymous users away from protected routes", () => {
    expect(resolveAppAccess(null, "/dashboard")).toEqual({
      action: "redirect",
      location: "/login",
    });
  });

  it("allows anonymous users to reach the login page", () => {
    expect(resolveAppAccess(null, "/login")).toEqual({
      action: "allow",
    });
  });

  it("redirects authenticated users away from the login page", () => {
    expect(resolveAppAccess("user-1", "/login")).toEqual({
      action: "redirect",
      location: "/dashboard",
    });
  });

  it("allows authenticated users into the app", () => {
    expect(resolveAppAccess("user-1", "/dashboard")).toEqual({
      action: "allow",
    });
  });
});
