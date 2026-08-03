import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { authErrorMessage, validateMagicLinkEmail } from "@/lib/auth/magic-link";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renders an email field and one-time-code submit button", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("Choose your OweMe workspace");
    expect(html).toContain("Your personal account");
    expect(html).toContain("name=\"email\"");
    expect(html).toContain("repeat(auto-fit, minmax(min(100%, 260px), 1fr))");
    expect(html).toContain("Email me a sign-in code");
    expect(html).toContain("Judge demo account");
    expect(html).toContain("Open judge demo");
    expect(html).toContain("/api/demo/login");
    expect(html).not.toContain("/api/dev/login");
    expect(html).not.toContain("Local developer shortcut");
    expect(html).not.toContain("No link to click");
  });

  it("shows server-returned personal login feedback", () => {
    const html = renderToStaticMarkup(
      <LoginForm
        initialEmail="me@example.com"
        notice={{ tone: "error", message: "Could not reach Supabase right now." }}
      />,
    );

    expect(html).toContain("value=\"me@example.com\"");
    expect(html).toContain("Could not reach Supabase right now.");
    expect(html).toContain("role=\"alert\"");
  });

  it("translates low-level fetch auth errors into useful fallback copy", () => {
    const message = authErrorMessage({ message: "Failed to fetch" });

    expect(message).toContain("Supabase auth is unavailable");
    expect(message).toContain("Check the Supabase project status and local credentials");
    expect(message).toContain("Judge demo remains safe to use");
  });

  it("keeps specific auth errors when Supabase is reachable", () => {
    expect(authErrorMessage({ message: "Email rate limit exceeded" })).toBe(
      "Email rate limit exceeded",
    );
  });

  it("validates personal account emails before calling Supabase", () => {
    expect(validateMagicLinkEmail("")).toBe("Enter your email to receive a sign-in code.");
    expect(validateMagicLinkEmail("not-an-email")).toBe("Enter a valid email address.");
    expect(validateMagicLinkEmail("me@example.com")).toBe("");
  });
});
