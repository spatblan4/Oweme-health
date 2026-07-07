import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renders an email field and magic link submit button", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("Sign in to your private workspace");
    expect(html).toContain("name=\"email\"");
    expect(html).toContain("Send magic link");
  });

  it("renders a development test account button when enabled", () => {
    const html = renderToStaticMarkup(<LoginForm showDevLogin />);

    expect(html).toContain("Use dev test account");
    expect(html).toContain("/api/dev/login");
  });
});
