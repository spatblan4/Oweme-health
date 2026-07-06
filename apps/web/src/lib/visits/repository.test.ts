import { describe, expect, it, vi } from "vitest";

import { createVisit, listVisits, updateVisit } from "./repository";

describe("visits repository helpers", () => {
  it("lists visits for the current user", async () => {
    const getOwnedVisits = vi.fn().mockResolvedValue([
      { id: "visit-1", provider_name: "Stone Creek Village Dentistry" },
    ]);

    const result = await listVisits("user-1", { getOwnedVisits });

    expect(result).toEqual({
      items: [{ id: "visit-1", provider_name: "Stone Creek Village Dentistry" }],
    });
  });

  it("creates a visit row with generated metadata", async () => {
    const insertVisit = vi.fn().mockResolvedValue({
      id: "visit-1",
      provider_name: "Stone Creek Village Dentistry",
    });

    const result = await createVisit(
      "user-1",
      {
        providerName: "Stone Creek Village Dentistry",
        visitDate: "2026-07-03",
        visitType: "dental",
        status: "attended",
      },
      {
        randomId: () => "visit-1",
        now: () => "2026-07-05T10:30:00.000Z",
        insertVisit,
      },
    );

    expect(insertVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "visit-1",
        user_id: "user-1",
        provider_name: "Stone Creek Village Dentistry",
        visit_date: "2026-07-03",
        visit_type: "dental",
        status: "attended",
      }),
    );
    expect(result).toEqual({
      id: "visit-1",
      provider_name: "Stone Creek Village Dentistry",
    });
  });

  it("updates an owned visit", async () => {
    const patchOwnedVisit = vi.fn().mockResolvedValue({
      id: "visit-1",
      notes: "Updated",
    });

    const result = await updateVisit(
      "user-1",
      "visit-1",
      { notes: "Updated" },
      {
        now: () => "2026-07-05T10:30:00.000Z",
        patchOwnedVisit,
      },
    );

    expect(result).toEqual({
      id: "visit-1",
      notes: "Updated",
    });
  });
});

