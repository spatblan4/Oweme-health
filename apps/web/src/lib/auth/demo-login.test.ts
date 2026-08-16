import { describe, expect, it } from "vitest";

import { createDemoLoginResponse } from "./demo-login";

describe("createDemoLoginResponse", () => {
  it("redirects judge demo sign-in back to the home hero instead of jumping straight into dashboard", () => {
    const response = createDemoLoginResponse("http://localhost:3001");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3001/?demoLoaded=1");
  });
});
