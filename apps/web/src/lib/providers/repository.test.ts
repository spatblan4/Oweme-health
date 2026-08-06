import { describe, expect, it, vi } from "vitest";

import { listProviders, updateProvider, upsertProvider } from "./repository";

describe("providers repository helper", () => {
  it("lists providers for the current user", async () => {
    const getOwnedProviders = vi.fn().mockResolvedValue([
      { id: "p1", name: "LAiMA OBGYN INC" },
    ]);

    const result = await listProviders("user-1", { getOwnedProviders });

    expect(result).toEqual({ items: [{ id: "p1", name: "LAiMA OBGYN INC" }] });
  });

  it("upserts a new provider when none matches the normalized name", async () => {
    const findOwnedByName = vi.fn().mockResolvedValue(null);
    const insertProvider = vi.fn().mockResolvedValue({ id: "p1", name: "LAiMA OBGYN INC" });
    const patchOwnedProvider = vi.fn();

    const result = await upsertProvider(
      "user-1",
      { name: "LAiMA OBGYN INC", phone: "555-1234" },
      {
        now: () => "2026-07-08T00:00:00.000Z",
        randomId: () => "id-1",
        findOwnedByName,
        insertProvider,
        patchOwnedProvider,
      },
    );

    expect(result).toEqual({ id: "p1", name: "LAiMA OBGYN INC" });
    expect(insertProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "id-1",
        user_id: "user-1",
        name: "LAiMA OBGYN INC",
        name_normalized: "laima obgyn inc",
        phone: "555-1234",
      }),
    );
    expect(patchOwnedProvider).not.toHaveBeenCalled();
  });

  it("patches the existing provider when the normalized name matches", async () => {
    const findOwnedByName = vi.fn().mockResolvedValue({ id: "p1" });
    const patchOwnedProvider = vi.fn().mockResolvedValue({ id: "p1", phone: "555-9999" });
    const insertProvider = vi.fn();

    const result = await upsertProvider(
      "user-1",
      { name: "LAiMA OBGYN INC", phone: "555-9999" },
      {
        now: () => "2026-07-08T00:00:00.000Z",
        randomId: () => "id-2",
        findOwnedByName,
        insertProvider,
        patchOwnedProvider,
      },
    );

    expect(result).toEqual({ id: "p1", phone: "555-9999" });
    expect(patchOwnedProvider).toHaveBeenCalledWith(
      "user-1",
      "p1",
      expect.objectContaining({
        name_normalized: "laima obgyn inc",
        phone: "555-9999",
        updated_at: "2026-07-08T00:00:00.000Z",
      }),
    );
    expect(insertProvider).not.toHaveBeenCalled();
  });

  it("updates only the provided fields on patch", async () => {
    const patchOwnedProvider = vi.fn().mockResolvedValue({ id: "p1", phone: "555-0000" });

    const result = await updateProvider("user-1", "p1", { phone: "555-0000" }, {
      now: () => "2026-07-08T00:00:00.000Z",
      patchOwnedProvider,
    });

    expect(result).toEqual({ id: "p1", phone: "555-0000" });
    expect(patchOwnedProvider).toHaveBeenCalledWith(
      "user-1",
      "p1",
      expect.not.objectContaining({ name: expect.anything() }),
    );
  });

  it("throws when patching a provider the user does not own", async () => {
    const patchOwnedProvider = vi.fn().mockResolvedValue(null);

    await expect(
      updateProvider("user-1", "missing", { phone: "555-0000" }, {
        now: () => "2026-07-08T00:00:00.000Z",
        patchOwnedProvider,
      }),
    ).rejects.toThrow("Provider not found");
  });
});
