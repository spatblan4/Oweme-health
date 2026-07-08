import { describe, expect, it, vi } from "vitest";

import { finalizeUpload } from "./finalize-upload";

describe("finalizeUpload", () => {
  it("verifies ownership and confirms the file exists in storage", async () => {
    const getOwnedFile = vi.fn().mockResolvedValue({
      id: "file-1",
      user_id: "user-1",
      kind: "claim",
      bucket: "uploads",
      storage_path: "uploads/user-1/file-1-claim-results-3.xlsx",
      status: "uploaded",
    });
    const confirmObjectExists = vi.fn().mockResolvedValue(true);

    const result = await finalizeUpload(
      {
        userId: "user-1",
        fileId: "file-1",
      },
      {
        getOwnedFile,
        confirmObjectExists,
      },
    );

    expect(getOwnedFile).toHaveBeenCalledWith("user-1", "file-1");
    expect(confirmObjectExists).toHaveBeenCalledWith({
      bucket: "uploads",
      storagePath: "uploads/user-1/file-1-claim-results-3.xlsx",
    });
    expect(result).toEqual({
      fileId: "file-1",
      ready: true,
      kind: "claim",
    });
  });

  it("fails when the object is missing from storage", async () => {
    await expect(
      finalizeUpload(
        {
          userId: "user-1",
          fileId: "file-1",
        },
        {
          getOwnedFile: vi.fn().mockResolvedValue({
            id: "file-1",
            user_id: "user-1",
            kind: "claim",
            bucket: "uploads",
            storage_path: "uploads/user-1/file-1.pdf",
            status: "uploaded",
          }),
          confirmObjectExists: vi.fn().mockResolvedValue(false),
        },
      ),
    ).rejects.toThrow("Uploaded file is missing from storage");
  });
});
