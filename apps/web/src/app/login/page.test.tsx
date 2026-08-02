import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

describe("LoginPage", () => {
  it("passes personal login feedback from the URL into the form", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        authError: "Could not reach Supabase right now.",
        email: "me@example.com",
      }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Could not reach Supabase right now.");
    expect(html).toContain("value=\"me@example.com\"");
    expect(html).toContain("role=\"alert\"");
  });
});
