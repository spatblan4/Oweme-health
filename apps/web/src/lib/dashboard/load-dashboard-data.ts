import { getOwnedFindings } from "@/lib/findings/repository";
import { listRecentJobs } from "@/lib/jobs/list-jobs";
import { getOwnedProviders } from "@/lib/providers/repository";
import { getOwnedVisits } from "@/lib/visits/repository";

type LoaderDeps = {
  getRecentJobs: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedVisits: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedFindings: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedProviders: (userId: string) => Promise<Record<string, unknown>[]>;
};

export async function loadDashboardData(
  userId: string,
  deps: LoaderDeps = {
    getRecentJobs: listRecentJobs,
    getOwnedVisits,
    getOwnedFindings,
    getOwnedProviders,
  },
) {
  const [jobs, visits, findings] = await Promise.all([
    deps.getRecentJobs(userId),
    deps.getOwnedVisits(userId),
    deps.getOwnedFindings(userId),
  ]);

  let providers: Record<string, unknown>[] = [];
  try {
    providers = await deps.getOwnedProviders(userId);
  } catch (error) {
    console.warn("Providers load failed; continuing without provider contacts.", error);
  }

  return { jobs, visits, findings, providers };
}
