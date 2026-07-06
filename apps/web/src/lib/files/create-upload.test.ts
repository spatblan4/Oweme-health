import { describe, expect, it, vi } from "vitest";

import { createUpload } from "./create-upload";

describe("createUpload", () => {
  it("creates a files row and returns a signed upload url", async () => {
    const insertFile = vi.fn().mockResolvedValue(undefined);
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      signedUrl: "https://storage.test/upload",
      path: "uploads/user-1/file-1-claim-results-3.xlsx",
      token: "token-1",
    });

    const result = await createUpload(
      {
        userId: "user-1",
        input: {
          kind: "claim",
          originalName: "Claim Results 3.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileSizeBytes: 2048,
        },
      },
      {
        now: () => new Date("2026-07-05T10:00:00.000Z"),
        randomId: () => "file-1",
        insertFile,
        createSignedUploadUrl,
      },
    );

    expect(insertFile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "file-1",
        user_id: "user-1",
        kind: "claim",
        bucket: "uploads",
        storage_path: "uploads/user-1/file-1-claim-results-3.xlsx",
        original_name: "Claim Results 3.xlsx",
        status: "uploaded",
      }),
    );

    expect(result).toEqual({
      fileId: "file-1",
      signedUrl: "https://storage.test/upload",
      token: "token-1",
      storagePath: "uploads/user-1/file-1-claim-results-3.xlsx",
    });
  });
});
