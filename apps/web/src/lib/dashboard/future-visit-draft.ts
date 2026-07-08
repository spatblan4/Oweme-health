export type FutureVisitDraft = {
  provider: string;
  visitType: string;
  visitDate: string;
  paidToday: string;
  paidWith: string;
  needsReimbursement: boolean;
  insurance: string;
  claimReadyIn: string;
  notes: string;
};

const visitTypeMap: Record<string, "medical" | "dental" | "vision" | "other"> = {
  Dental: "dental",
  Medical: "medical",
  Vision: "vision",
  Lab: "other",
  Therapy: "other",
};

export function createDefaultFutureVisitDraft(): FutureVisitDraft {
  return {
    provider: "",
    visitType: "",
    visitDate: "",
    paidToday: "",
    paidWith: "",
    needsReimbursement: false,
    insurance: "",
    claimReadyIn: "3 weeks",
    notes: "",
  };
}

export function buildProviderSuggestions(
  visits: Array<Record<string, unknown>>,
  findings: Array<Record<string, unknown>>,
) {
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const item of [...visits, ...findings]) {
    const raw = String(item.provider_name ?? item.providerName ?? item.title ?? "").trim();
    if (!raw) {
      continue;
    }

    const key = raw.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    suggestions.push(raw);
  }

  return suggestions;
}

function parsePaidAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function parseClaimReadyWeeks(value: string) {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function calculateClaimCheckAfter(visitDate: string, claimReadyIn: string) {
  const date = new Date(`${visitDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const weeks = parseClaimReadyWeeks(claimReadyIn);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function buildVisitCreatePayload(draft: FutureVisitDraft) {
  const providerName = draft.provider.trim();
  const insuranceName = draft.insurance.trim();
  const paymentMethod = draft.paidWith.trim();
  const notes = draft.notes.trim();

  return {
    providerName,
    visitDate: draft.visitDate,
    visitType: visitTypeMap[draft.visitType] ?? "other",
    status: "attended" as const,
    ...(insuranceName ? { insuranceName } : {}),
    ...(parsePaidAmount(draft.paidToday) !== undefined
      ? { paidAmount: parsePaidAmount(draft.paidToday) }
      : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    reimbursementNeeded: draft.needsReimbursement,
    ...(calculateClaimCheckAfter(draft.visitDate, draft.claimReadyIn)
      ? { claimCheckAfter: calculateClaimCheckAfter(draft.visitDate, draft.claimReadyIn) }
      : {}),
    ...(notes ? { notes } : {}),
  };
}
