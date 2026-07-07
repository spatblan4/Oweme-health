export type VisitDraft = {
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

const VISIT_TYPE_MAP: Record<string, "medical" | "dental" | "vision" | "other"> = {
  dental: "dental",
  medical: "medical",
  vision: "vision",
};

export function mapVisitType(value: string): "medical" | "dental" | "vision" | "other" {
  return VISIT_TYPE_MAP[value.trim().toLowerCase()] ?? "other";
}

export function computeClaimCheckAfter(
  visitDate: string,
  claimReadyIn: string,
): string | undefined {
  if (!visitDate) {
    return undefined;
  }
  const weeks = parseInt(claimReadyIn, 10);
  if (!Number.isFinite(weeks) || weeks <= 0) {
    return undefined;
  }
  const base = new Date(`${visitDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return undefined;
  }
  const result = new Date(base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  return result.toISOString().slice(0, 10);
}

export function buildVisitPayload(draft: VisitDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    providerName: draft.provider.trim(),
    visitDate: draft.visitDate,
    visitType: mapVisitType(draft.visitType),
    paymentMethod: draft.paidWith,
    reimbursementNeeded: draft.needsReimbursement,
  };

  const paidAmount = draft.paidToday.trim() === "" ? NaN : Number(draft.paidToday);
  if (Number.isFinite(paidAmount) && paidAmount >= 0) {
    payload.paidAmount = paidAmount;
  }

  const insurance = draft.insurance.trim();
  if (insurance) {
    payload.insuranceName = insurance;
  }

  const notes = draft.notes.trim();
  if (notes) {
    payload.notes = notes;
  }

  const claimCheckAfter = computeClaimCheckAfter(draft.visitDate, draft.claimReadyIn);
  if (claimCheckAfter) {
    payload.claimCheckAfter = claimCheckAfter;
  }

  return payload;
}
