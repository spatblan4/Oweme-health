import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type RunSyncAuditInput = {
  userId: string;
  claimFileIds: string[];
  paymentFileIds: string[];
};

type RunSyncAuditResult = {
  claims_checked: number;
  payments_checked: number;
  findings_created: number;
};

function resolveRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "services/worker"))) {
      return candidate;
    }
  }

  throw new Error("Unable to resolve repository root for worker runtime.");
}

function resolveWorkerPython(repoRoot: string) {
  const pythonPath = path.join(repoRoot, "services/worker/.venv/bin/python");
  if (!fs.existsSync(pythonPath)) {
    throw new Error("Worker virtualenv is missing. Expected services/worker/.venv/bin/python");
  }
  return pythonPath;
}

export async function runSyncAudit({
  userId,
  claimFileIds,
  paymentFileIds,
}: RunSyncAuditInput): Promise<RunSyncAuditResult> {
  const repoRoot = resolveRepoRoot();
  const workerRoot = path.join(repoRoot, "services/worker");
  const pythonPath = resolveWorkerPython(repoRoot);

  const args = ["-m", "worker.sync_audit", "--user-id", userId];
  for (const fileId of claimFileIds) {
    args.push("--claim-file-id", fileId);
  }
  for (const fileId of paymentFileIds) {
    args.push("--payment-file-id", fileId);
  }

  const env = {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };

  const { stdout, stderr } = await execFileAsync(pythonPath, args, {
    cwd: workerRoot,
    env,
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 4,
  });

  const output = stdout.trim();
  if (!output) {
    throw new Error(stderr.trim() || "Worker completed without returning audit output.");
  }

  try {
    return JSON.parse(output) as RunSyncAuditResult;
  } catch {
    throw new Error(stderr.trim() || output);
  }
}
