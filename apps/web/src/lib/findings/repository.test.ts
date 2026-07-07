import { describe, expect, it, vi } from "vitest";

import { listFindings, updateFinding } from "./repository";

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

  it("updates a finding status and stamps updated_at", async () => {
    const patchOwnedFinding = vi.fn().mockResolvedValue({
      id: "finding-1",
      status: "resolved",
    });
    const now = vi.fn().mockReturnValue("2026-07-08T00:00:00.000Z");

    const result = await updateFinding("user-1", "finding-1", { status: "resolved" }, {
      now,
      patchOwnedFinding,
    });

    expect(result).toEqual({ id: "finding-1", status: "resolved" });
    expect(patchOwnedFinding).toHaveBeenCalledWith("user-1", "finding-1", {
      status: "resolved",
      updated_at: "2026-07-08T00:00:00.000Z",
    });
  });

  it("rejects an unknown status", async () => {
    const patchOwnedFinding = vi.fn();
    await expect(
      updateFinding("user-1", "finding-1", { status: "done" }, {
        now: () => "2026-07-08T00:00:00.000Z",
        patchOwnedFinding,
      }),
    ).rejects.toThrow("Invalid finding status");
    expect(patchOwnedFinding).not.toHaveBeenCalled();
  });

  it("throws when the finding is not owned by the user", async () => {
    const patchOwnedFinding = vi.fn().mockResolvedValue(null);
    await expect(
      updateFinding("user-1", "finding-1", { status: "dismissed" }, {
        now: () => "2026-07-08T00:00:00.000Z",
        patchOwnedFinding,
      }),
    ).rejects.toThrow("Finding not found");
  });
});
