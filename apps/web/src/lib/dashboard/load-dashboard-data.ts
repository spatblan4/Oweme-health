import { getOwnedFindings } from "@/lib/findings/repository";
import { getPaymentSourceLabelsByIds } from "@/lib/findings/repository";
import { listRecentJobs } from "@/lib/jobs/list-jobs";
import { getOwnedVisits } from "@/lib/visits/repository";

type LoaderDeps = {
  getRecentJobs: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedVisits: (userId: string) => Promise<Record<string, unknown>[]>;
  getOwnedFindings: (userId: string) => Promise<Record<string, unknown>[]>;
  getPaymentSourceLabelsByIds?: (paymentIds: string[]) => Promise<Map<string, string>>;
};

function isSyntheticDemoFinding(finding: Record<string, unknown>) {
  const details = finding.details;
  const detailsRecord = details && typeof details === "object" ? (details as Record<string, unknown>) : {};
  const sourceFiles = detailsRecord.source_files;
  const labels = [
    finding.title,
    finding.provider_name,
    detailsRecord.provider_name,
    ...(Array.isArray(sourceFiles) ? sourceFiles : []),
  ];

  return labels.some((value) => {
    const text = String(value ?? "").toLowerCase();
    return text.includes(" demo") || text.includes("oweme-synthetic");
  });
}

function candidatePayments(finding: Record<string, unknown>) {
  const details = finding.details;
  const detailsRecord = details && typeof details === "object" ? (details as Record<string, unknown>) : {};
  const raw = detailsRecord.candidate_payments;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

async function enrichCandidatePaymentSourceLabels(
  findings: Array<Record<string, unknown>>,
  getLabelsByIds: (paymentIds: string[]) => Promise<Map<string, string>>,
) {
  const missingPaymentIds = new Set<string>();
  for (const finding of findings) {
    for (const candidate of candidatePayments(finding)) {
      if (String(candidate.payment_source_label ?? "").trim()) {
        continue;
      }
      const paymentId = String(candidate.payment_id ?? "");
      if (paymentId) {
        missingPaymentIds.add(paymentId);
      }
    }
  }

  const labelsById = missingPaymentIds.size
    ? await getLabelsByIds([...missingPaymentIds])
    : new Map<string, string>();

  if (!labelsById.size) {
    return findings;
  }

  return findings.map((finding) => {
    const candidates = candidatePayments(finding);
    if (!candidates.length) {
      return finding;
    }

    const nextCandidates = candidates.map((candidate) => {
      if (String(candidate.payment_source_label ?? "").trim()) {
        return candidate;
      }
      const paymentId = String(candidate.payment_id ?? "");
      const sourceLabel = labelsById.get(paymentId);
      return sourceLabel ? { ...candidate, payment_source_label: sourceLabel } : candidate;
    });

    return {
      ...finding,
      details: {
        ...(finding.details && typeof finding.details === "object" ? finding.details : {}),
        candidate_payments: nextCandidates,
      },
    };
  });
}

export async function loadDashboardData(
  userId: string,
  deps: LoaderDeps = {
    getRecentJobs: listRecentJobs,
    getOwnedVisits,
    getOwnedFindings,
    getPaymentSourceLabelsByIds,
  },
) {
  const [jobs, visits, findings] = await Promise.all([
    deps.getRecentJobs(userId),
    deps.getOwnedVisits(userId),
    deps.getOwnedFindings(userId),
  ]);

  const personalFindings = findings.filter((finding) => !isSyntheticDemoFinding(finding));

  return {
    jobs,
    visits,
    findings: await enrichCandidatePaymentSourceLabels(
      personalFindings,
      deps.getPaymentSourceLabelsByIds ?? getPaymentSourceLabelsByIds,
    ),
  };
}
