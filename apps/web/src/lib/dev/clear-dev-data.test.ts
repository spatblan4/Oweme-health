import { describe, expect, it, vi } from "vitest";

import { clearDevTestData } from "./clear-dev-data";

describe("clearDevTestData", () => {
  it("deletes only the dev test account data in dependency order", async () => {
    const listFiles = vi.fn().mockResolvedValue([
      { bucket: "uploads", storage_path: "dev/user-1/claim.pdf" },
      { bucket: "uploads", storage_path: "dev/user-1/payment.csv" },
    ]);
    const removeObjects = vi.fn().mockResolvedValue(undefined);
    const deleteRows = vi.fn().mockResolvedValue(undefined);

    await clearDevTestData(
      {
        userId: "00000000-0000-0000-0000-000000000001",
        email: "dev-test@oweme.local",
      },
      {
        listFiles,
        removeObjects,
        deleteRows,
      },
    );

    expect(listFiles).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
    expect(removeObjects).toHaveBeenCalledWith("uploads", [
      "dev/user-1/claim.pdf",
      "dev/user-1/payment.csv",
    ]);
    expect(deleteRows.mock.calls).toEqual([
      ["findings", "00000000-0000-0000-0000-000000000001"],
      ["payments", "00000000-0000-0000-0000-000000000001"],
      ["claims", "00000000-0000-0000-0000-000000000001"],
      ["file_jobs", "00000000-0000-0000-0000-000000000001"],
      ["visits", "00000000-0000-0000-0000-000000000001"],
      ["files", "00000000-0000-0000-0000-000000000001"],
    ]);
  });

  it("rejects non-dev accounts", async () => {
    await expect(
      clearDevTestData({
        userId: "user-1",
        email: "person@example.com",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("allows the dev test email even when Supabase assigned a different user id", async () => {
    const listFiles = vi.fn().mockResolvedValue([]);
    const removeObjects = vi.fn().mockResolvedValue(undefined);
    const deleteRows = vi.fn().mockResolvedValue(undefined);

    await clearDevTestData(
      {
        userId: "actual-supabase-user-id",
        email: "dev-test@oweme.local",
      },
      {
        listFiles,
        removeObjects,
        deleteRows,
      },
    );

    expect(listFiles).toHaveBeenCalledWith("actual-supabase-user-id");
    expect(deleteRows.mock.calls).toEqual([
      ["findings", "actual-supabase-user-id"],
      ["payments", "actual-supabase-user-id"],
      ["claims", "actual-supabase-user-id"],
      ["file_jobs", "actual-supabase-user-id"],
      ["visits", "actual-supabase-user-id"],
      ["files", "actual-supabase-user-id"],
    ]);
    expect(removeObjects).not.toHaveBeenCalled();
  });
});
