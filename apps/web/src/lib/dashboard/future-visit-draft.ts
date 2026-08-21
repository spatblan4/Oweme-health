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

const defaultProviderSuggestions = [
  "BAY AREA OSM",
  "Stone Creek Village Dentistry",
  "Quest Diagnostics",
  "JAMES D KIM",
  "Kaiser Permanente",
  "Sutter Health",
  "UCSF Medical Center",
  "Stanford Health Care",
  "One Medical",
  "Carbon Health",
  "Labcorp",
  "Walgreens Pharmacy",
  "CVS Pharmacy",
];

export function createDefaultFutureVisitDraft(): FutureVisitDraft {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

  return {
    provider: "",
    visitType: "",
    visitDate: localToday,
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

  function addSuggestion(value: unknown) {
    const raw = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!raw || isGenericProviderSuggestion(raw)) {
      return;
    }

    const key = raw.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    suggestions.push(raw);
  }

  for (const item of visits) {
    addSuggestion(item.provider_name ?? item.providerName ?? item.title);
  }

  for (const finding of findings) {
    const details = finding.details;
    if (details && typeof details === "object") {
      const typedDetails = details as Record<string, unknown>;
      addSuggestion(typedDetails.provider_name);
      addProvidersFromList(typedDetails.possible_claims, addSuggestion);
      addProvidersFromList(typedDetails.candidate_payments, addSuggestion);
    }

    addSuggestion(finding.provider_name ?? finding.providerName ?? finding.title);
  }

  for (const provider of defaultProviderSuggestions) {
    addSuggestion(provider);
  }

  return suggestions;
}

function addProvidersFromList(value: unknown, addSuggestion: (value: unknown) => void) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (item && typeof item === "object") {
      addSuggestion((item as Record<string, unknown>).provider_name);
    }
  }
}

function isGenericProviderSuggestion(value: string) {
  return ["medical", "medical payment", "healthcare", "health care", "possible match"].includes(
    value.toLowerCase(),
  );
}

function suggestionTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function filterProviderSuggestions(suggestions: string[], query: string, limit = 6) {
  const queryTokens = suggestionTokens(query);
  if (!queryTokens.length) {
    return suggestions.slice(0, limit);
  }

  return suggestions
    .filter((suggestion) => {
      const tokens = suggestionTokens(suggestion);
      return queryTokens.every((queryToken) =>
        tokens.some((token) => token.startsWith(queryToken)),
      );
    })
    .slice(0, limit);
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

export function buildVisitEditDraft(visit: Record<string, unknown>): FutureVisitDraft {
  const rawType = String(visit.visit_type ?? visit.visitType ?? "other");
  const visitType = ({ medical: "Medical", dental: "Dental", vision: "Vision", other: "Therapy" } as Record<string, string>)[rawType] ?? "";
  const visitDate = String(visit.visit_date ?? visit.visitDate ?? "");
  const claimCheckAfter = String(visit.claim_check_after ?? visit.claimCheckAfter ?? "");
  const days = claimCheckAfter && visitDate
    ? Math.max(0, Math.round((new Date(`${claimCheckAfter}T12:00:00Z`).getTime() - new Date(`${visitDate}T12:00:00Z`).getTime()) / (24 * 60 * 60 * 1000)))
    : 21;
  const weeks = [1, 2, 3, 4, 6].reduce((closest, candidate) => Math.abs(candidate * 7 - days) < Math.abs(closest * 7 - days) ? candidate : closest, 3);

  return {
    provider: String(visit.provider_name ?? visit.providerName ?? ""),
    visitType,
    visitDate,
    paidToday: visit.paid_amount ?? visit.paidAmount ? String(visit.paid_amount ?? visit.paidAmount) : "",
    paidWith: String(visit.payment_method ?? visit.paymentMethod ?? ""),
    needsReimbursement: Boolean(visit.reimbursement_needed ?? visit.reimbursementNeeded),
    insurance: String(visit.insurance_name ?? visit.insuranceName ?? ""),
    claimReadyIn: `${weeks} week${weeks === 1 ? "" : "s"}`,
    notes: String(visit.notes ?? ""),
  };
}
