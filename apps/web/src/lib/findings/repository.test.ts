import { describe, expect, it, vi } from "vitest";

import { applyFindingAction, listFindings } from "./repository";

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

  it("resolves a finding when the user confirms the match", async () => {
    const getOwnedFinding = vi.fn().mockResolvedValue({
      id: "finding-1",
      status: "open",
    });
    const patchOwnedFinding = vi.fn().mockResolvedValue({
      id: "finding-1",
      status: "resolved",
    });
    const insertManualAdjustment = vi.fn().mockResolvedValue(undefined);

    const result = await applyFindingAction(
      "user-1",
      "finding-1",
      { action: "confirm_match" },
      {
        getOwnedFinding,
        patchOwnedFinding,
        insertManualAdjustment,
        now: () => "2026-07-09T12:00:00.000Z",
      },
    );

    expect(getOwnedFinding).toHaveBeenCalledWith("user-1", "finding-1");
    expect(patchOwnedFinding).toHaveBeenCalledWith("user-1", "finding-1", {
      updated_at: "2026-07-09T12:00:00.000Z",
      status: "resolved",
    });
    expect(insertManualAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        target_type: "finding",
        target_id: "finding-1",
        field_name: "status",
        new_value: "resolved",
      }),
    );
    expect(result).toEqual({
      item: { id: "finding-1", status: "resolved" },
      action: "confirm_match",
    });
  });

  it("resolves a finding when the user is ready to request a credit refund", async () => {
    const getOwnedFinding = vi.fn().mockResolvedValue({
      id: "finding-1",
      status: "open",
    });
    const patchOwnedFinding = vi.fn().mockResolvedValue({
      id: "finding-1",
      status: "resolved",
    });
    const insertManualAdjustment = vi.fn().mockResolvedValue(undefined);

    const result = await applyFindingAction(
      "user-1",
      "finding-1",
      { action: "request_credit_refund" },
      {
        getOwnedFinding,
        patchOwnedFinding,
        insertManualAdjustment,
        now: () => "2026-07-09T12:00:00.000Z",
      },
    );

    expect(patchOwnedFinding).toHaveBeenCalledWith("user-1", "finding-1", {
      updated_at: "2026-07-09T12:00:00.000Z",
      status: "resolved",
    });
    expect(insertManualAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        field_name: "status",
        new_value: "resolved",
        reason: "Ready to request credit or refund from provider",
      }),
    );
    expect(result).toEqual({
      item: { id: "finding-1", status: "resolved" },
      action: "request_credit_refund",
    });
  });
});
