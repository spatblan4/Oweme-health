import { describe, expect, it, vi } from "vitest";

import { createFileJob } from "./create-job";

describe("createFileJob", () => {
  it("creates a queued job for an owned file", async () => {
    const getOwnedFile = vi.fn().mockResolvedValue({
      id: "file-1",
      user_id: "user-1",
    });
    const insertJob = vi.fn().mockResolvedValue(undefined);

    const result = await createFileJob(
      {
        userId: "user-1",
        fileId: "file-1",
        jobType: "extract_claims",
      },
      {
        now: () => new Date("2026-07-05T10:10:00.000Z"),
        randomId: () => "job-1",
        getOwnedFile,
        insertJob,
      },
    );

    expect(getOwnedFile).toHaveBeenCalledWith("user-1", "file-1");
    expect(insertJob).toHaveBeenCalledWith({
      id: "job-1",
      user_id: "user-1",
      file_id: "file-1",
      job_type: "extract_claims",
      status: "queued",
      attempt_count: 0,
      created_at: "2026-07-05T10:10:00.000Z",
    });
    expect(result).toEqual({
      id: "job-1",
      status: "queued",
    });
  });

  it("fails if the file does not belong to the user", async () => {
    await expect(
      createFileJob(
        {
          userId: "user-1",
          fileId: "file-1",
          jobType: "extract_claims",
        },
        {
          now: () => new Date(),
          randomId: () => "job-1",
          getOwnedFile: vi.fn().mockResolvedValue(null),
          insertJob: vi.fn(),
        },
      ),
    ).rejects.toThrow("File not found");
  });
});

