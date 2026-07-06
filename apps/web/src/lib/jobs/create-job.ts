const ALLOWED_JOB_TYPES = new Set([
  "extract_claims",
  "extract_payments",
  "normalize",
  "audit",
]);

type OwnedFile = {
  id: string;
  user_id: string;
};

type JobRowInsert = {
  id: string;
  user_id: string;
  file_id: string;
  job_type: string;
  status: "queued";
  attempt_count: number;
  created_at: string;
};

type CreateFileJobDeps = {
  now: () => Date;
  randomId: () => string;
  getOwnedFile: (userId: string, fileId: string) => Promise<OwnedFile | null>;
  insertJob: (job: JobRowInsert) => Promise<void>;
};

export async function createFileJob(
  args: {
    userId: string;
    fileId: string;
    jobType: string;
  },
  deps: CreateFileJobDeps,
) {
  if (!ALLOWED_JOB_TYPES.has(args.jobType)) {
    throw new Error("Invalid job type");
  }

  const file = await deps.getOwnedFile(args.userId, args.fileId);
  if (!file) {
    throw new Error("File not found");
  }

  const id = deps.randomId();
  await deps.insertJob({
    id,
    user_id: args.userId,
    file_id: args.fileId,
    job_type: args.jobType,
    status: "queued",
    attempt_count: 0,
    created_at: deps.now().toISOString(),
  });

  return {
    id,
    status: "queued" as const,
  };
}

