type OwnedJob = {
  id: string;
  status: string;
  job_type: string;
  file_id: string;
};

type GetFileJobDeps = {
  getOwnedJob: (userId: string, jobId: string) => Promise<OwnedJob | null>;
};

export async function getFileJob(
  args: {
    userId: string;
    jobId: string;
  },
  deps: GetFileJobDeps,
) {
  const job = await deps.getOwnedJob(args.userId, args.jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  return {
    id: job.id,
    status: job.status,
    jobType: job.job_type,
    fileId: job.file_id,
  };
}

