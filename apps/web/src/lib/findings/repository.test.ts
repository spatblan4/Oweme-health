import { describe, expect, it, vi } from "vitest";

import { listFindings } from "./repository";

describe("findings repository helper", () => {
  it("lists findings for the current user", async () => {
    const getOwnedFindings = vi.fn().mockResolvedValue([
      { id: "finding-1", finding_type: "allocation_unclear" },
    ]);

    const result = await listFindings("user-1", { getOwnedFindings });

    expect(result).toEqual({
      items: [{ id: "finding-1", finding_type: "allocation_unclear" }],
    });
  });
});
