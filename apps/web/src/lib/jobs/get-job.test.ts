import { describe, expect, it, vi } from "vitest";

import { getFileJob } from "./get-job";

describe("getFileJob", () => {
  it("returns an owned job", async () => {
    const getOwnedJob = vi.fn().mockResolvedValue({
      id: "job-1",
      status: "queued",
      job_type: "extract_claims",
      file_id: "file-1",
    });

    const result = await getFileJob(
      {
        userId: "user-1",
        jobId: "job-1",
      },
      {
        getOwnedJob,
      },
    );

    expect(result).toEqual({
      id: "job-1",
      status: "queued",
      jobType: "extract_claims",
      fileId: "file-1",
    });
  });

  it("fails when the job is missing", async () => {
    await expect(
      getFileJob(
        {
          userId: "user-1",
          jobId: "job-1",
        },
        {
          getOwnedJob: vi.fn().mockResolvedValue(null),
        },
      ),
    ).rejects.toThrow("Job not found");
  });
});
