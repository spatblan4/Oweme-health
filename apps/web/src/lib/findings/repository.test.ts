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

  it("persists selected candidate payment IDs and totals when confirming a match", async () => {
    const existing = {
      id: "finding-1",
      status: "open",
      details: {
        responsibility_amount: "12.40",
        candidate_payments: [
          {
            payment_id: "payment-133",
            amount: "133.00",
            payment_date: "2026-05-13",
            provider_name: "Stone Creek Village De",
            payment_source_label: "Apple Card",
          },
          {
            payment_id: "payment-142",
            amount: "142.00",
            payment_date: "2026-05-13",
            provider_name: "Stone Creek Village De",
            payment_source_label: "Apple Card",
          },
        ],
      },
    };
    const getOwnedFinding = vi.fn().mockResolvedValue(existing);
    const patchOwnedFinding = vi.fn().mockImplementation(async (_userId, _findingId, patch) => ({
      ...existing,
      ...patch,
    }));
    const insertManualAdjustment = vi.fn().mockResolvedValue(undefined);

    const result = await applyFindingAction(
      "user-1",
      "finding-1",
      { action: "confirm_match", paymentIds: ["payment-133", "payment-142"] },
      {
        getOwnedFinding,
        patchOwnedFinding,
        insertManualAdjustment,
        now: () => "2026-08-01T12:00:00.000Z",
      },
    );

    expect(patchOwnedFinding).toHaveBeenCalledWith(
      "user-1",
      "finding-1",
      expect.objectContaining({
        status: "resolved",
        details: expect.objectContaining({
          confirmed_payment_ids: ["payment-133", "payment-142"],
          confirmed_paid_amount: "275.00",
          confirmed_responsibility_amount: "12.40",
          confirmed_credit_amount: "262.60",
          confirmation_source: "Confirmed by you",
        }),
      }),
    );
    expect(result.item.details.confirmed_payments).toHaveLength(2);
    expect(insertManualAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        field_name: "confirmed_payments",
        previous_value: null,
        new_value: expect.objectContaining({
          payment_ids: ["payment-133", "payment-142"],
          confirmed_paid_amount: "275.00",
          confirmed_credit_amount: "262.60",
        }),
      }),
    );
  });

  it("rejects an unknown selected payment ID", async () => {
    await expect(
      applyFindingAction(
        "user-1",
        "finding-1",
        { action: "confirm_match", paymentIds: ["payment-not-a-candidate"] },
        {
          getOwnedFinding: vi.fn().mockResolvedValue({
            id: "finding-1",
            status: "open",
            details: {
              responsibility_amount: "12.40",
              candidate_payments: [{ payment_id: "payment-133", amount: "133.00" }],
            },
          }),
          patchOwnedFinding: vi.fn(),
          insertManualAdjustment: vi.fn(),
          now: () => "2026-08-01T12:00:00.000Z",
        },
      ),
    ).rejects.toThrow("Selected payment is not a candidate for this finding");
  });

  it("rejects an empty selected payment list for candidate findings", async () => {
    await expect(
      applyFindingAction(
        "user-1",
        "finding-1",
        { action: "confirm_match", paymentIds: [] },
        {
          getOwnedFinding: vi.fn().mockResolvedValue({
            id: "finding-1",
            status: "open",
            details: {
              responsibility_amount: "12.40",
              candidate_payments: [{ payment_id: "payment-133", amount: "133.00" }],
            },
          }),
          patchOwnedFinding: vi.fn(),
          insertManualAdjustment: vi.fn(),
          now: () => "2026-08-01T12:00:00.000Z",
        },
      ),
    ).rejects.toThrow("Select at least one payment to confirm");
  });

  it("revises confirmed candidate payment IDs and records previous values", async () => {
    const existing = {
      id: "finding-1",
      status: "resolved",
      details: {
        responsibility_amount: "12.40",
        confirmed_payment_ids: ["payment-133"],
        confirmed_paid_amount: "133.00",
        confirmed_credit_amount: "120.60",
        candidate_payments: [
          { payment_id: "payment-133", amount: "133.00", payment_source_label: "Apple Card" },
          { payment_id: "payment-142", amount: "142.00", payment_source_label: "Apple Card" },
        ],
      },
    };
    const patchOwnedFinding = vi.fn().mockImplementation(async (_userId, _findingId, patch) => ({
      ...existing,
      ...patch,
    }));
    const insertManualAdjustment = vi.fn().mockResolvedValue(undefined);

    await applyFindingAction(
      "user-1",
      "finding-1",
      { action: "confirm_match", paymentIds: ["payment-133", "payment-142"] },
      {
        getOwnedFinding: vi.fn().mockResolvedValue(existing),
        patchOwnedFinding,
        insertManualAdjustment,
        now: () => "2026-08-01T12:00:00.000Z",
      },
    );

    expect(insertManualAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        field_name: "confirmed_payments",
        previous_value: {
          payment_ids: ["payment-133"],
          confirmed_paid_amount: "133.00",
          confirmed_credit_amount: "120.60",
        },
        new_value: expect.objectContaining({
          payment_ids: ["payment-133", "payment-142"],
          confirmed_paid_amount: "275.00",
          confirmed_credit_amount: "262.60",
        }),
      }),
    );
  });
});
