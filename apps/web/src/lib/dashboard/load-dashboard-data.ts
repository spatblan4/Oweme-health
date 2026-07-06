import { getOwnedFindings } from "@/lib/findings/repository";
import { listRecentJobs } from "@/lib/jobs/list-jobs";
import { getOwnedVisits } from "@/lib/visits/repository";

type LoaderDeps = {
  getRecentJobs: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedVisits: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedFindings: (userId: string) => Promise<Record<string, unknown>[]>;
};

export async function loadDashboardData(
  userId: string,
  deps: LoaderDeps = {
    getRecentJobs: listRecentJobs,
    getOwnedVisits,
    getOwnedFindings,
  },
) {
  const [jobs, visits, findings] = await Promise.all([
    deps.getRecentJobs(userId),
    deps.getOwnedVisits(userId),
    deps.getOwnedFindings(userId),
  ]);

  return { jobs, visits, findings };
}
