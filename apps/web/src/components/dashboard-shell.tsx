"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

import {
  buildVisitCreatePayload,
  buildProviderSuggestions,
  createDefaultFutureVisitDraft,
  filterProviderSuggestions,
} from "@/lib/dashboard/future-visit-draft";

type DashboardShellProps = {
  jobs: Array<Record<string, unknown>>;
  visits: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  initialView?: ViewKey;
  flashMessage?: string;
  currentUser?: {
    id: string;
    email: string | null;
    isDevTest: boolean;
    isDemo?: boolean;
  };
};

type ViewKey = "overview" | "past" | "future" | "actions";

const views: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: "overview", label: "Home", icon: "⌁" },
  { key: "past", label: "Past Credits", icon: "▤" },
  { key: "future", label: "Future Visits", icon: "+" },
  { key: "actions", label: "Action Center", icon: "✓" },
];

export function normalizeViewKey(value: string | undefined): ViewKey {
  return views.some((view) => view.key === value) ? (value as ViewKey) : "overview";
}

function shellFont() {
  return {
    fontFamily:
      '"SF Pro Display","SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif',
  } as const;
}

function parseAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function hasAmount(value: unknown) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatVisitDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "Date not recorded";
  }

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sectionHeading(eyebrow: string, title: string, body: string) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {eyebrow ? (
        <p
          style={{
            margin: 0,
            color: "#0b7a75",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2 style={{ margin: 0, color: "#152235", fontSize: 28, lineHeight: 1.06 }}>{title}</h2>
      <p style={{ margin: 0, color: "#617086", fontSize: 17, lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

function pill(label: string, tone: "teal" | "amber" | "slate" = "slate") {
  const tones = {
    teal: { background: "#def4f1", color: "#0f766d", border: "#b9e6df" },
    amber: { background: "#fff1df", color: "#b56411", border: "#f2d3a8" },
    slate: { background: "#f3f6fb", color: "#64748b", border: "#d9e3ef" },
  } as const;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 999,
        background: tones[tone].background,
        color: tones[tone].color,
        border: `1px solid ${tones[tone].border}`,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function surface(children: React.ReactNode, extra?: React.CSSProperties) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #dbe4ef",
        borderRadius: 24,
        boxShadow: "0 22px 44px rgba(18, 33, 58, 0.08)",
        ...extra,
      }}
    >
      {children}
    </section>
  );
}

function futureFieldLabel(label: string) {
  return (
    <span
      style={{
        color: "#68748c",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

type MatchFilterKey = "all" | "review" | "credit" | "unexplained";

function getFilteredFindings(items: Array<Record<string, unknown>>, matchFilter: MatchFilterKey) {
  const openItems = items.filter((finding) => String(finding.status ?? "open") === "open");
  if (matchFilter === "review") {
    return openItems.filter((finding) =>
      ["allocation_unclear", "possible_credit"].includes(String(finding.finding_type ?? "")),
    );
  }
  if (matchFilter === "credit") {
    return openItems.filter((finding) => String(finding.finding_type ?? "") === "possible_credit");
  }
  if (matchFilter === "unexplained") {
    return openItems.filter((finding) => String(finding.finding_type ?? "") === "unexplained_payment");
  }
  return items;
}

function detailText(value: unknown, fallback = "Not found yet") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function amountText(value: unknown, fallback = "--") {
  const amount = parseAmount(value);
  return amount > 0 ? amount.toFixed(2) : fallback;
}

function paymentSourceText(value: unknown, fallback = "Card / receipt / manual entry pending") {
  const text = detailText(value, "").trim();
  if (!text) {
    return fallback;
  }
  if (/^(hsa|fsa)(\s+payment)?$/i.test(text) || /withdrawal/i.test(text)) {
    return "Paid via HSA";
  }
  if (/paid via/i.test(text)) {
    return text;
  }
  return `Paid via ${text}`;
}

function paymentMethodText(value: unknown, fallback = "Payment method to confirm") {
  const text = detailText(value, "").trim();
  if (!text) {
    return fallback;
  }
  if (/^(hsa|fsa)(\s+payment)?$/i.test(text) || /withdrawal/i.test(text)) {
    return "HSA";
  }
  if (/apple/i.test(text)) {
    return "Apple Card";
  }
  if (/chase/i.test(text)) {
    return "Chase card";
  }
  if (/cash/i.test(text)) {
    return "Cash";
  }
  if (/card|purchase|credit|debit/i.test(text)) {
    return "Card";
  }
  return text.replace(/^paid via\s+/i, "");
}

function amountWithPaymentSource(amount: unknown, source: unknown, fallback = "--") {
  const amountLabel = detailText(amount, fallback);
  if (amountLabel === fallback) {
    return fallback;
  }
  return `${amountLabel} (${paymentSourceText(source)})`;
}

function daysBetween(start: unknown, end: unknown) {
  if (typeof start !== "string" || typeof end !== "string" || !start || !end) {
    return null;
  }
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function findingDetails(finding: Record<string, unknown>) {
  const raw = finding.details;
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function stripDemoSuffix(value: unknown) {
  return String(value ?? "").replace(/\s+DEMO\b/gi, "").trim();
}

function findingProviderName(finding: Record<string, unknown>) {
  const details = findingDetails(finding);
  const candidate = candidatePayments(finding)[0];
  const candidateProvider = stripDemoSuffix(candidate?.provider_name);
  const candidateHint = String(candidate?.match_hint ?? "").toLowerCase();
  if (candidateProvider && candidateHint.includes("conflict")) {
    return candidateProvider;
  }
  return detailText(
    stripDemoSuffix(details.provider_name ?? finding.provider_name ?? finding.providerName ?? finding.title),
    "Provider under review",
  );
}

function normalizeProviderKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findingStatusTone(findingType: string) {
  if (findingType === "possible_credit") {
    return "teal" as const;
  }
  if (findingType === "unexplained_payment") {
    return "slate" as const;
  }
  if (findingType === "unassigned_medical_payment") {
    return "amber" as const;
  }
  return "amber" as const;
}

function hasBundledPaymentCandidate(finding: Record<string, unknown>) {
  return candidatePayments(finding).length > 0;
}

function candidatePayments(finding: Record<string, unknown>) {
  const raw = findingDetails(finding).candidate_payments;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function candidatePaymentId(candidate: Record<string, unknown>) {
  return typeof candidate.payment_id === "string" ? candidate.payment_id : "";
}

function validCandidatePaymentIds(finding: Record<string, unknown>) {
  return candidatePayments(finding).map(candidatePaymentId).filter(Boolean);
}

function confirmedPaymentIds(finding: Record<string, unknown>) {
  const raw = findingDetails(finding).confirmed_payment_ids;
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function initialSelectedPaymentIds(finding: Record<string, unknown>) {
  const confirmed = confirmedPaymentIds(finding);
  return confirmed.length ? confirmed : validCandidatePaymentIds(finding);
}

function selectedCandidatePayments(finding: Record<string, unknown>, selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return candidatePayments(finding).filter((candidate) => selected.has(candidatePaymentId(candidate)));
}

function selectedPaymentSummary(finding: Record<string, unknown>, selectedIds: string[]) {
  const payments = selectedCandidatePayments(finding, selectedIds);
  const selectedTotal = payments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
  const responsibility = parseAmount(findingDetails(finding).responsibility_amount);
  return {
    count: payments.length,
    selectedTotal,
    responsibility,
    credit: Math.max(0, selectedTotal - responsibility),
  };
}

function confirmedPayments(finding: Record<string, unknown>) {
  const raw = findingDetails(finding).confirmed_payments;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function hasConfirmedPayments(finding: Record<string, unknown>) {
  return confirmedPaymentIds(finding).length > 0 && hasAmount(findingDetails(finding).confirmed_paid_amount);
}

function confirmedPaidAmount(finding: Record<string, unknown>) {
  return parseAmount(findingDetails(finding).confirmed_paid_amount);
}

function confirmedCreditAmount(finding: Record<string, unknown>) {
  return parseAmount(findingDetails(finding).confirmed_credit_amount);
}

function candidatePaymentSourceText(candidate: Record<string, unknown>, fallback = "Card / receipt line item") {
  return paymentMethodText(candidate.payment_source_label ?? candidate.payment_source, fallback);
}

function candidatePaymentSourceSummary(candidates: Array<Record<string, unknown>>) {
  const labels = Array.from(
    new Set(
      candidates
        .map((candidate) => candidatePaymentSourceText(candidate, "Payment source to confirm"))
        .filter((label) => label && label !== "Payment source to confirm"),
    ),
  );
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length > 1) {
    return `${labels.length} sources`;
  }
  return "Payment source to confirm";
}

function possibleClaims(finding: Record<string, unknown>) {
  const raw = findingDetails(finding).possible_claims;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function candidatePotentialCredit(
  finding: Record<string, unknown>,
  candidate: Record<string, unknown> | undefined = candidatePayments(finding)[0],
) {
  if (!candidate) {
    return 0;
  }
  const details = findingDetails(finding);
  return Math.max(0, parseAmount(candidate.amount) - parseAmount(details.responsibility_amount));
}

function findingStatusLabel(finding: Record<string, unknown>) {
  const findingType = String(finding.finding_type ?? "");
  if (hasConfirmedPayments(finding)) {
    return "Confirmed";
  }
  if (findingType === "possible_credit") {
    return "Possible credit";
  }
  if (findingType === "unexplained_payment") {
    return "Unexplained payment";
  }
  if (findingType === "unassigned_medical_payment") {
    return "Unassigned payment";
  }
  if (hasBundledPaymentCandidate(finding)) {
    return "Needs review";
  }
  return "Needs review";
}

function findingConfidenceLabel(finding: Record<string, unknown>) {
  const findingType = String(finding.finding_type ?? "");
  if (findingType === "possible_credit") {
    return "High";
  }
  if (candidatePayments(finding).length > 0) {
    return "Medium";
  }
  if (findingType === "unassigned_medical_payment") {
    return possibleClaims(finding).length > 0 ? "Medium" : "Low";
  }
  return "Low";
}

function findingConfidenceReason(finding: Record<string, unknown>) {
  const candidate = candidatePayments(finding)[0];
  const details = findingDetails(finding);
  if (String(finding.finding_type ?? "") === "possible_credit") {
    return "Claim amount and payment amount are both present, so the system can estimate the credit directly.";
  }
  if (candidate) {
    const gap = daysBetween(details.service_date, candidate.payment_date);
    const gapText = gap === null ? "near the service date" : `${Math.max(0, gap)} days after the service date`;
    return `Payment timing and amount look plausible (${gapText}), but the merchant/provider still needs a human check.`;
  }
  if (String(finding.finding_type ?? "") === "unassigned_medical_payment") {
    return "The payment looks medical, but the statement row does not identify a provider.";
  }
  return "The uploaded claim/payment evidence is incomplete.";
}

function findingCardSummary(finding: Record<string, unknown>) {
  const details = findingDetails(finding);
  const paid = parseAmount(details.paid_amount);
  const responsibility = parseAmount(details.responsibility_amount);
  const creditAmount = hasAmount(details.paid_amount) && hasAmount(details.responsibility_amount)
    ? Math.max(0, paid - responsibility)
    : Math.max(0, parseAmount(details.credit_amount ?? finding.credit_amount));
  if (creditAmount > 0 || String(finding.finding_type ?? "") === "possible_credit") {
    return creditAmount > 0
      ? `Potential credit ${formatCurrency(creditAmount)} — request a provider review.`
      : "Potential credit found — request a provider review.";
  }
  return String(finding.summary ?? "Review this item and confirm whether action is needed.");
}

type CreditReviewMode = "combined" | "separate";

export function buildConfirmMatchPayload(paymentIds: string[]) {
  return {
    action: "confirm_match" as const,
    paymentIds,
  };
}

export type CreditReviewDraft = {
  mode: CreditReviewMode;
  provider: string;
  total: number;
  emailTo: string;
  phone: string;
  contactSource: string;
  emailSubject: string;
  emailMessage: string;
  callScript: string;
  visits: Array<{
    id: string;
    serviceDate: string;
    responsibility: number;
    paid: number;
    difference: number;
  }>;
};

function findingCreditAmount(finding: Record<string, unknown>) {
  const details = findingDetails(finding);
  if (hasAmount(details.paid_amount) && hasAmount(details.responsibility_amount)) {
    return Math.max(0, parseAmount(details.paid_amount) - parseAmount(details.responsibility_amount));
  }
  return Math.max(0, parseAmount(details.credit_amount ?? finding.credit_amount));
}

function formatDateList(dates: string[]) {
  if (dates.length <= 1) {
    return dates[0] ?? "the service date";
  }
  if (dates.length === 2) {
    return `${dates[0]} and ${dates[1]}`;
  }
  return `${dates.slice(0, -1).join(", ")}, and ${dates[dates.length - 1]}`;
}

function roundCurrencyAmount(amount: number) {
  return Math.round(amount * 100) / 100;
}

function firstDetailValue(findings: Array<Record<string, unknown>>, keys: string[]) {
  for (const finding of findings) {
    const details = findingDetails(finding);
    for (const key of keys) {
      const value = details[key] ?? finding[key];
      const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function providerContactForDraft(provider: string, findings: Array<Record<string, unknown>>) {
  const emailTo = firstDetailValue(findings, ["billing_email", "provider_email", "contact_email", "email"]);
  const phone = firstDetailValue(findings, ["billing_phone", "provider_phone", "contact_phone", "phone"]);
  const contactSource = firstDetailValue(findings, ["contact_source", "provider_contact_source"]);

  if (emailTo || phone || contactSource) {
    return {
      emailTo,
      phone,
      contactSource: contactSource || "Uploaded provider record",
    };
  }

  if (normalizeProviderKey(provider).includes("ali salehpour")) {
    return {
      emailTo: "info@ofiscm.com",
      phone: "(831) 884-5141",
      contactSource: "Oral, Facial & Implant Surgery Center of Monterey public contact page / NPI profile",
    };
  }

  return {
    emailTo: "",
    phone: "",
    contactSource: "",
  };
}

export function buildCreditReviewDraft(
  findings: Array<Record<string, unknown>>,
  mode: CreditReviewMode,
): CreditReviewDraft {
  const visits = findings.map((finding) => {
    const details = findingDetails(finding);
    return {
      id: String(finding.id),
      serviceDate: detailText(details.service_date, "Date to confirm"),
      responsibility: parseAmount(details.responsibility_amount),
      paid: parseAmount(details.paid_amount),
      difference: findingCreditAmount(finding),
    };
  });

  const provider = findings.length ? findingProviderName(findings[0]) : "Provider under review";
  const contact = providerContactForDraft(provider, findings);
  const total = roundCurrencyAmount(visits.reduce((sum, visit) => sum + visit.difference, 0));
  const responsibilityTotal = roundCurrencyAmount(visits.reduce((sum, visit) => sum + visit.responsibility, 0));
  const paidTotal = roundCurrencyAmount(visits.reduce((sum, visit) => sum + visit.paid, 0));
  const dates = visits.map((visit) => visit.serviceDate);
  const dateText = formatDateList(dates);
  const visitWord = visits.length === 1 ? "visit" : "visits";
  const detailLines = visits
    .map(
      (visit) =>
        `- ${visit.serviceDate}: EOB responsibility ${formatCurrency(visit.responsibility)}, payment record ${formatCurrency(visit.paid)}, possible overpayment ${formatCurrency(visit.difference)}.`,
    )
    .join("\n");
  const detailSection = visits.length > 1 ? `\n\nHere are the records I'm comparing:\n${detailLines}` : "";

  return {
    mode,
    provider,
    total,
    emailTo: contact.emailTo,
    phone: contact.phone,
    contactSource: contact.contactSource,
    emailSubject: `Request to review possible overpayment — ${dates.join(", ")}`,
    emailMessage: `Hello ${provider} billing team,\n\nI'm writing about my ${visitWord} on ${dateText}.\n\nMy insurance EOB shows I was responsible for ${formatCurrency(responsibilityTotal)}, but my payment record shows I paid ${formatCurrency(paidTotal)}, so I may have overpaid by ${formatCurrency(total)}.${detailSection}\n\nCould you please review my account and let me know whether there is a credit on my account or a refund available to me?\n\nI can provide the EOB and payment records if helpful. Thank you.`,
    callScript: `Hi, I'm calling about a possible overpayment on my account with ${provider}.\n\nI'm calling about my ${visitWord} on ${dateText}. My insurance EOB shows I was responsible for ${formatCurrency(responsibilityTotal)}, but my payment record shows I paid ${formatCurrency(paidTotal)}, so I may have overpaid by ${formatCurrency(total)}.${detailSection}\n\nCould you please review my account and let me know whether there is a credit on my account or a refund available to me?\n\nI can provide the EOB and payment records if helpful.`,
    visits,
  };
}

function whyOwedText(finding: Record<string, unknown>) {
  const details = findingDetails(finding);
  const paid = parseAmount(details.paid_amount);
  const responsibility = parseAmount(details.responsibility_amount);
  const creditAmount = hasAmount(details.paid_amount) && hasAmount(details.responsibility_amount)
    ? Math.max(0, paid - responsibility)
    : Math.max(0, parseAmount(details.credit_amount ?? finding.credit_amount));
  if (String(finding.finding_type ?? "") === "possible_credit" && creditAmount > 0 && hasAmount(details.paid_amount) && hasAmount(details.responsibility_amount)) {
    return `EOB patient responsibility ${formatCurrency(responsibility)} is compared with matched payment ${formatCurrency(paid)}. Difference: ${formatCurrency(creditAmount)} possible credit.`;
  }

  const candidate = candidatePayments(finding)[0];
  if (candidate) {
    return "This payment may belong to this visit, but OweMe needs your confirmation before calling it a credit.";
  }

  return "OweMe does not have enough payment evidence yet to calculate a credit.";
}

function nextStepText(
  finding: Record<string, unknown>,
  creditReview?: { mode: CreditReviewMode; findings: Array<Record<string, unknown>>; total: number },
) {
  if (creditReview && creditReview.findings.length > 1) {
    if (creditReview.mode === "separate") {
      return `Request separate credit/refund reviews for ${creditReview.findings.length} visits. Choose a visit below to request its amount.`;
    }
    return `Request a combined ${formatCurrency(creditReview.total)} credit/refund review for ${creditReview.findings.length} visits.`;
  }
  const details = findingDetails(finding);
  const creditAmount = findingCreditAmount(finding);
  if (String(finding.finding_type ?? "") === "possible_credit" && creditAmount > 0) {
    return `Request a ${formatCurrency(creditAmount)} credit/refund review from ${findingProviderName(finding)}.`;
  }
  if (candidatePayments(finding).length > 0) {
    return "Confirm this payment only if the receipt shows it belongs to this visit.";
  }
  return "Add a receipt or payment record so OweMe can finish the audit.";
}

function checkRecordsQuestion(finding: Record<string, unknown>) {
  const findingType = String(finding.finding_type ?? "");
  const candidate = candidatePayments(finding)[0];
  if (findingType === "unassigned_medical_payment" || findingType === "unmatched_payment") {
    return "Compare the provider/merchant name and receipt before linking this payment to a claim.";
  }
  if (candidate) {
    const hint = String(candidate.match_hint ?? "").toLowerCase();
    const claimProvider = normalizeProviderKey(
      findingDetails(finding).claim_provider_name ?? findingDetails(finding).provider_name ?? finding.provider_name,
    );
    const paymentProvider = normalizeProviderKey(candidate.provider_name);
    if (hint.includes("conflict") || (claimProvider && paymentProvider && claimProvider !== paymentProvider)) {
      return "Do the EOB provider and HSA merchant refer to the same dentist, or do you need a receipt before linking them?";
    }
    return "Does this HSA payment apply only to this visit, or also to another visit?";
  }
  if (findingType === "possible_credit") {
    return "Does this payment apply to this visit only, with no other EOB sharing the payment?";
  }
  return "Find the matching payment or receipt before closing this review.";
}

function findingEvidenceBullets(finding: Record<string, unknown>) {
  const details = findingDetails(finding);
  const bullets: string[] = [];
  const provider = detailText(details.provider_name ?? finding.provider_name, "");
  const serviceDate = detailText(details.service_date, "");
  const paidAmount = detailText(details.paid_amount, "");
  const responsibility = detailText(details.responsibility_amount, "");

  if (String(finding.finding_type ?? "") === "unassigned_medical_payment") {
    bullets.push("This payment came from your uploaded bank statement, but the row does not name a clinic or doctor.");
    if (paidAmount) {
      bullets.push(`Uploaded payment evidence shows ${paidAmount}, but the provider is still unassigned.`);
    }
    return bullets;
  }
  const claimProvider = detailText(stripDemoSuffix(details.claim_provider_name), "");
  if (claimProvider && claimProvider !== provider) {
    bullets.push(`Claim-side provider read as ${claimProvider}; payment merchant is ${provider || "still to confirm"}.`);
  } else if (provider) {
    bullets.push(`Provider alias matched around ${provider}.`);
  }
  if (serviceDate) {
    bullets.push(`Service date anchored on ${serviceDate}.`);
  }
  if (paidAmount && responsibility) {
    bullets.push(`Paid ${paidAmount} compared against EOB responsibility ${responsibility}.`);
  } else if (responsibility) {
    bullets.push(`EOB shows patient responsibility ${responsibility}, but payment evidence is still incomplete.`);
  } else if (paidAmount) {
    bullets.push(`Payment evidence shows ${paidAmount}, but the matching claim details are still incomplete.`);
  }
  const candidates = candidatePayments(finding);
  const candidate = candidates[0];
  if (candidates.length > 1) {
    bullets.push(`OweMe found ${candidates.length} payment candidates near this service date. Review each candidate amount, date, merchant, and account before linking a payment to this visit.`);
    bullets.push("Needs confirmation because the EOB provider and payment merchants may differ, and one larger payment may include multiple visits.");
  } else if (candidate) {
    const source = paymentSourceText(candidate.payment_source_label ?? candidate.payment_source, "Payment");
    const candidateAmount = amountText(candidate.amount);
    const dayGap = daysBetween(details.service_date, candidate.payment_date);
    const dayGapText =
      dayGap === null
        ? "near the service date"
        : `${Math.max(0, dayGap)} days after the service date`;

    bullets.push(`${source} candidate: ${detailText(candidate.provider_name, "merchant unknown")} paid ${candidateAmount} on ${detailText(candidate.payment_date, "date unknown")}.`);
    if (parseAmount(candidate.amount) >= parseAmount(responsibility)) {
      bullets.push("The payment amount is large enough to cover this EOB, but OweMe needs provider identity and allocation confirmation before estimating a credit.");
    }
    bullets.push(`The payment posted ${dayGapText}; HSA and card payments can process after the visit date.`);
    bullets.push("Needs confirmation because the EOB provider and payment merchant are different, and one larger payment may include multiple visits.");
  }
  if (!bullets.length) {
    bullets.push("This item still needs manual review because the source evidence is incomplete.");
  }
  return bullets;
}

type UploadKind = "claim" | "payment";
type UploadStatus = "uploading" | "uploaded" | "error";
type LocalUpload = {
  clientId: string;
  name: string;
  status: UploadStatus;
  fileId?: string;
  error?: string;
};

const ACCEPTED_UPLOAD_EXTENSIONS = [".csv", ".pdf", ".xls", ".xlsx"];
const ACCEPTED_UPLOAD_MIME_TYPES = [
  "text/csv",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ACCEPTED_UPLOAD_ATTR = ACCEPTED_UPLOAD_EXTENSIONS.join(",");
const MAX_FILES_PER_UPLOAD = 5;

type FileCardProps = {
  title: string;
  note: string;
  badge: string;
  badgeBg: string;
  inputId: string;
  accept: string;
  uploads: LocalUpload[];
  onFilesSelected: (files: FileList | null) => void;
};

function fileCard({
  title,
  note,
  badge,
  badgeBg,
  inputId,
  accept,
  uploads,
  onFilesSelected,
}: FileCardProps) {
  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #dbe4ef",
        borderRadius: 22,
        padding: 20,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 16,
        alignItems: "center",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: badgeBg,
          display: "grid",
          placeItems: "center",
          fontSize: 32,
        }}
      >
        {badge}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 18, color: "#152235" }}>{title}</strong>
        <span style={{ color: "#667089", lineHeight: 1.45 }}>{note}</span>
        {uploads.length ? (
          <div style={{ display: "grid", gap: 4 }}>
            {uploads.map((upload) => (
              <span
                key={upload.clientId}
                style={{
                  color:
                    upload.status === "error"
                      ? "#c2410c"
                      : upload.status === "uploaded"
                        ? "#0b7a75"
                        : "#667089",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {upload.name}{" "}
                {upload.status === "uploading"
                  ? "uploading..."
                  : upload.status === "uploaded"
                    ? "ready"
                    : upload.error ?? "failed"}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <label
        htmlFor={inputId}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 18,
          border: "1px solid #dbe4ef",
          background: "#f8fbff",
          color: "#152235",
          padding: "16px 22px",
          fontWeight: 700,
          fontSize: 16,
          cursor: "pointer",
          userSelect: "none",
        }}
        data-testid={`${inputId}-trigger`}
      >
        Choose files
      </label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={accept}
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.currentTarget.value = "";
        }}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          opacity: 0,
        }}
      />
    </div>
  );
}

function renderView(
  view: ViewKey,
  activeView: ViewKey,
  children: React.ReactNode,
) {
  return (
    <section
      aria-hidden={activeView !== view}
      style={{
        display: activeView === view ? "grid" : "none",
        gap: 22,
      }}
    >
      {children}
    </section>
  );
}

function viewHref(view: ViewKey) {
  return view === "overview" ? "/dashboard" : `/dashboard?view=${view}`;
}

export function DashboardShell({
  jobs,
  visits,
  findings,
  initialView = "overview",
  flashMessage,
  currentUser,
}: DashboardShellProps) {
  const [activeView, setActiveView] = useState<ViewKey>(initialView);
  const [visitItems, setVisitItems] = useState(visits);
  const [findingItems, setFindingItems] = useState(findings);
  const [selectedUploads, setSelectedUploads] = useState<Record<UploadKind, LocalUpload[]>>({
    claim: [],
    payment: [],
  });
  const [pastAuditStatus, setPastAuditStatus] = useState<string>("");
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [futureVisitDraft, setFutureVisitDraft] = useState(createDefaultFutureVisitDraft);
  const [futureVisitStatus, setFutureVisitStatus] = useState("");
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [manualFallbackDraft, setManualFallbackDraft] = useState({
    paymentSource: "Receipt",
    providerName: "",
    paymentDate: "",
    amount: "",
  });
  const [isSavingManualFallback, setIsSavingManualFallback] = useState(false);
  const [matchFilter, setMatchFilter] = useState<MatchFilterKey>("all");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  );
  const [findingActionStatus, setFindingActionStatus] = useState("");
  const [isSavingFindingAction, setIsSavingFindingAction] = useState(false);
  const [selectedCandidatePaymentIdsByFinding, setSelectedCandidatePaymentIdsByFinding] = useState<Record<string, string[]>>({});
  const [creditReviewMode, setCreditReviewMode] = useState<CreditReviewMode>("combined");
  const [creditReviewDraft, setCreditReviewDraft] = useState<CreditReviewDraft | null>(null);
  const [actionCenterStatus, setActionCenterStatus] = useState("");
  const [creditReviewSent, setCreditReviewSent] = useState(false);
  const [communicationMode, setCommunicationMode] = useState<"email" | "call">("email");
  const [copyStatus, setCopyStatus] = useState("");
  const [isProviderSuggestionsOpen, setIsProviderSuggestionsOpen] = useState(false);
  const [isManualFallbackOpen, setIsManualFallbackOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const totalPossibleCredit = useMemo(() => {
    return findingItems.reduce((sum, finding) => {
      const details = finding.details as Record<string, unknown> | undefined;
      return sum + parseAmount(details?.credit_amount ?? finding.credit_amount);
    }, 0);
  }, [findingItems]);

  const providerCount = useMemo(() => {
    const names = new Set(
      findingItems
        .map((finding) => String(finding.provider_name ?? finding.providerName ?? ""))
        .filter(Boolean),
    );
    return names.size || findingItems.length;
  }, [findingItems]);

  const reviewItems = findingItems.filter((finding) => String(finding.status ?? "open") === "open");
  const recentVisit = visitItems[0];
  const providerSuggestions = useMemo(
    () => buildProviderSuggestions(visitItems, findingItems),
    [visitItems, findingItems],
  );
  const visibleProviderSuggestions = useMemo(
    () => filterProviderSuggestions(providerSuggestions, futureVisitDraft.provider),
    [providerSuggestions, futureVisitDraft.provider],
  );
  const filteredFindings = useMemo(() => {
    return getFilteredFindings(findingItems, matchFilter);
  }, [findingItems, matchFilter]);
  const selectedFinding =
    selectedFindingId
      ? filteredFindings.find((finding) => String(finding.id) === selectedFindingId) ?? null
      : filteredFindings[0] ?? null;
  const selectedFindingKey = selectedFinding ? String(selectedFinding.id) : "";
  const currentSelectedCandidatePaymentIds =
    selectedFinding && Object.prototype.hasOwnProperty.call(selectedCandidatePaymentIdsByFinding, selectedFindingKey)
      ? selectedCandidatePaymentIdsByFinding[selectedFindingKey] ?? []
      : selectedFinding
        ? initialSelectedPaymentIds(selectedFinding)
        : [];
  const currentSelectedPaymentSummary = selectedFinding
    ? selectedPaymentSummary(selectedFinding, currentSelectedCandidatePaymentIds)
    : null;
  const selectedProviderFindings = useMemo(() => {
    if (!selectedFinding) {
      return [];
    }
    const providerKey = normalizeProviderKey(findingProviderName(selectedFinding));
    return findingItems.filter(
      (finding) =>
        String(finding.status ?? "open") === "open" &&
        normalizeProviderKey(findingProviderName(finding)) === providerKey,
    );
  }, [findingItems, selectedFinding]);
  const selectedCreditFindings = useMemo(
    () => selectedProviderFindings.filter((finding) => findingCreditAmount(finding) > 0),
    [selectedProviderFindings],
  );
  const selectedCreditTotal = selectedCreditFindings.reduce((sum, finding) => sum + findingCreditAmount(finding), 0);
  const accountModeLabel = currentUser?.isDemo ? "Demo" : "My account";

  function navigateToView(view: ViewKey) {
    setActiveView(view);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", viewHref(view));
    }
  }

  function updateSelectedCandidatePaymentIds(updater: (current: string[]) => string[]) {
    if (!selectedFinding) {
      return;
    }
    const findingKey = String(selectedFinding.id);
    setSelectedCandidatePaymentIdsByFinding((current) => ({
      ...current,
      [findingKey]: updater(current[findingKey] ?? initialSelectedPaymentIds(selectedFinding)),
    }));
  }

  function handleViewLinkClick(event: React.MouseEvent<HTMLAnchorElement>, view: ViewKey) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigateToView(view);
  }

  function accountMenu() {
    return (
      <div style={{ position: "relative", display: "inline-flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          aria-expanded={isAccountMenuOpen}
          aria-haspopup="menu"
          data-testid="account-mode-menu-button"
          onClick={() => setIsAccountMenuOpen((current) => !current)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: "#ffffff",
            border: "1px solid #dbe4ef",
            color: "#152235",
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 10px 22px rgba(18, 33, 58, 0.08)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: currentUser?.isDemo ? "#14b8a6" : "#152235",
            }}
          />
          {accountModeLabel}
          <span aria-hidden="true" style={{ color: "#71809a", fontSize: 12 }}>
            ▾
          </span>
        </button>
        {isAccountMenuOpen ? (
          <div
            role="menu"
            data-testid="account-mode-menu"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 20,
              minWidth: 188,
              borderRadius: 16,
              border: "1px solid #dbe4ef",
              background: "#ffffff",
              boxShadow: "0 18px 40px rgba(18, 33, 58, 0.14)",
              padding: 8,
              display: "grid",
              gap: 6,
            }}
          >
            {currentUser?.isDemo ? (
              <form action="/api/auth/logout" method="post" style={{ display: "grid" }}>
                <button
                  type="submit"
                  role="menuitem"
                  style={{
                    border: "none",
                    borderRadius: 12,
                    background: "#f8fbff",
                    color: "#152235",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 800,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Use my account
                </button>
              </form>
            ) : (
              <form action="/api/demo/login" method="post" style={{ display: "grid" }}>
                <button
                  type="submit"
                  role="menuitem"
                  style={{
                    border: "none",
                    borderRadius: 12,
                    background: "#f8fbff",
                    color: "#152235",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 800,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Open demo
                </button>
              </form>
            )}
            <form action="/api/auth/logout" method="post" style={{ display: "grid" }}>
              <button
                type="submit"
                role="menuitem"
                style={{
                  border: "none",
                  borderRadius: 12,
                  background: "#ffffff",
                  color: "#617086",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    );
  }

  function isSupportedUpload(file: File) {
    const fileName = file.name.toLowerCase();
    return (
      ACCEPTED_UPLOAD_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
      ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type)
    );
  }

  function appendUploads(kind: UploadKind, uploads: LocalUpload[]) {
    setSelectedUploads((current) => ({
      ...current,
      [kind]: [...current[kind], ...uploads].slice(0, MAX_FILES_PER_UPLOAD),
    }));
  }

  function updateUpload(kind: UploadKind, clientId: string, patch: Partial<LocalUpload>) {
    setSelectedUploads((current) => ({
      ...current,
      [kind]: current[kind].map((upload) =>
        upload.clientId === clientId ? { ...upload, ...patch } : upload,
      ),
    }));
  }

  async function uploadFile(kind: UploadKind, file: File) {
    const initResponse = await fetch("/api/files/upload-init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
      }),
    });

    if (!initResponse.ok) {
      const payload = (await initResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Upload init failed");
    }

    const initPayload = (await initResponse.json()) as {
      fileId: string;
      signedUrl: string;
    };

    const storageResponse = await fetch(initPayload.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });

    if (!storageResponse.ok) {
      throw new Error("Storage upload failed");
    }

    const finalizeResponse = await fetch("/api/files/finalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: initPayload.fileId,
      }),
    });

    if (!finalizeResponse.ok) {
      const payload = (await finalizeResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Finalize failed");
    }

    return initPayload.fileId;
  }

  async function handleSelectedFiles(kind: UploadKind, files: FileList | null) {
    if (!files) {
      return;
    }

    const remainingSlots = Math.max(0, MAX_FILES_PER_UPLOAD - selectedUploads[kind].length);
    if (remainingSlots === 0) {
      setPastAuditStatus(`You can upload up to ${MAX_FILES_PER_UPLOAD} ${kind} files.`);
      return;
    }

    const supportedFiles = Array.from(files).filter(isSupportedUpload).slice(0, remainingSlots);
    if (!supportedFiles.length) {
      setPastAuditStatus("Unsupported file type. Use CSV, PDF, XLS, or XLSX.");
      return;
    }
    if (files.length > remainingSlots) {
      setPastAuditStatus(`Only ${remainingSlots} more ${kind} file${remainingSlots === 1 ? "" : "s"} can be added.`);
    } else {
      setPastAuditStatus("");
    }

    const batchId = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholders = supportedFiles.map((file, index) => ({
      clientId: `${batchId}-${index}`,
      name: file.name,
      status: "uploading",
    })) satisfies LocalUpload[];

    appendUploads(kind, placeholders);

    for (const [index, file] of supportedFiles.entries()) {
      const clientId = placeholders[index].clientId;
      try {
        const fileId = await uploadFile(kind, file);
        updateUpload(kind, clientId, {
          status: "uploaded",
          fileId,
        });
      } catch (error) {
        updateUpload(kind, clientId, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }
  }

  async function handleRunAudit() {
    const uploads = [...selectedUploads.claim, ...selectedUploads.payment];
    const readyUploads = uploads.filter((upload) => upload.status === "uploaded" && upload.fileId);
    if (!readyUploads.length) {
      setPastAuditStatus("Choose and upload at least one file before running the audit.");
      return;
    }

    setIsRunningAudit(true);
    setPastAuditStatus("Running audit...");

    try {
      const response = await fetch("/api/audit/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimFileIds: selectedUploads.claim
            .filter((upload) => upload.status === "uploaded" && upload.fileId)
            .map((upload) => upload.fileId),
          paymentFileIds: selectedUploads.payment
            .filter((upload) => upload.status === "uploaded" && upload.fileId)
            .map((upload) => upload.fileId),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; findings_created?: number }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Audit failed");
      }

      setPastAuditStatus("Audit complete. Refreshing results...");
      window.location.assign("/dashboard?view=past&auditComplete=1");
    } catch (error) {
      setPastAuditStatus(error instanceof Error ? error.message : "Failed to run audit.");
    } finally {
      setIsRunningAudit(false);
    }
  }

  async function handleAddVisitTracker() {
    setIsSavingVisit(true);
    setFutureVisitStatus("Saving visit...");

    try {
      const payload = buildVisitCreatePayload(futureVisitDraft);
      const response = await fetch("/api/visits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error((body as { error?: string } | null)?.error ?? "Failed to save visit.");
      }

      setVisitItems((current) => [body as Record<string, unknown>, ...current]);
      setFutureVisitDraft(createDefaultFutureVisitDraft());
      setFutureVisitStatus(
        payload.claimCheckAfter
          ? `Visit saved. Claim check scheduled for ${formatVisitDate(payload.claimCheckAfter)}.`
          : "Visit saved.",
      );
    } catch (error) {
      setFutureVisitStatus(error instanceof Error ? error.message : "Failed to save visit.");
    } finally {
      setIsSavingVisit(false);
    }
  }

  async function handleAddManualFallback() {
    setIsSavingManualFallback(true);
    setPastAuditStatus("Saving manual payment...");

    try {
      const response = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(manualFallbackDraft),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save manual payment.");
      }

      setManualFallbackDraft({
        paymentSource: "Receipt",
        providerName: "",
        paymentDate: "",
        amount: "",
      });
      setPastAuditStatus("Manual payment added. Run audit again to match it against claims.");
    } catch (error) {
      setPastAuditStatus(error instanceof Error ? error.message : "Failed to save manual payment.");
    } finally {
      setIsSavingManualFallback(false);
    }
  }

  async function handleFindingAction(
    action: "confirm_match" | "not_same_visit" | "add_receipt_or_payment" | "request_credit_refund",
    targetFinding = selectedFinding,
    options?: { paymentIds?: string[] },
  ) {
    if (!targetFinding) {
      setFindingActionStatus("Select a finding first.");
      return;
    }

    setIsSavingFindingAction(true);
    setFindingActionStatus("Saving finding action...");

    if (currentUser?.isDemo) {
      if (action === "request_credit_refund") {
        const draft = buildCreditReviewDraft([targetFinding], "separate");
        setCreditReviewMode("separate");
        setCreditReviewDraft(draft);
        setCommunicationMode("email");
        setCopyStatus("");
        setCreditReviewSent(false);
        setActionCenterStatus(`Separate request draft ready for ${draft.visits.length} visit (${formatCurrency(draft.total)}).`);
        setFindingActionStatus(
          `Saved a ${formatCurrency(draft.total)} credit/refund request draft for ${draft.provider}.`,
        );
        navigateToView("actions");
      } else if (action === "add_receipt_or_payment") {
        setIsManualFallbackOpen(true);
        setPastAuditStatus("Manual receipt entry opened. Add provider, date, and amount here, or choose files above.");
        setFindingActionStatus("Manual receipt entry opened above. Add provider, date, and amount, or upload a file.");
      } else if (action === "not_same_visit") {
        setFindingActionStatus("Demo marked this payment as not for this visit.");
      } else if (action === "confirm_match") {
        setFindingActionStatus("Demo match confirmation saved locally.");
      } else {
        setFindingActionStatus("Demo action saved locally.");
      }
      setIsSavingFindingAction(false);
      return;
    }

    try {
      const response = await fetch(`/api/findings/${String(targetFinding.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "confirm_match" && options?.paymentIds
            ? buildConfirmMatchPayload(options.paymentIds)
            : { action },
        ),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        item?: Record<string, unknown>;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update finding.");
      }

      if (payload?.item) {
        setFindingItems((current) =>
          current.map((finding) =>
            String(finding.id) === String(payload.item?.id) ? payload.item! : finding,
          ),
        );
      }

      setFindingActionStatus(
        action === "request_credit_refund"
          ? "Marked ready for credit/refund request."
          : action === "confirm_match"
          ? "Marked as resolved."
          : action === "not_same_visit"
            ? "Marked as dismissed."
            : "Saved a follow-up request to the audit trail.",
      );
    } catch (error) {
      setFindingActionStatus(error instanceof Error ? error.message : "Failed to update finding.");
    } finally {
      setIsSavingFindingAction(false);
    }
  }

  function createCreditReviewDraft(targetFindings: Array<Record<string, unknown>>, mode: CreditReviewMode) {
    if (!targetFindings.length) {
      setFindingActionStatus("Select a credit finding first.");
      return;
    }

    const draft = buildCreditReviewDraft(targetFindings, mode);
    setCreditReviewMode(mode);
    setCreditReviewDraft(draft);
    setCommunicationMode("email");
    setCopyStatus("");
    setCreditReviewSent(false);
    setActionCenterStatus(
      mode === "combined"
        ? `Combined request draft ready for ${draft.visits.length} visits (${formatCurrency(draft.total)}).`
        : `Separate request draft ready for ${draft.visits.length} visit${draft.visits.length === 1 ? "" : "s"}.`,
    );
    setFindingActionStatus(
      mode === "combined"
        ? `Combined request draft ready for ${draft.visits.length} visits (${formatCurrency(draft.total)}).`
        : `Separate request draft ready for ${draft.visits.length} visit${draft.visits.length === 1 ? "" : "s"}.`,
    );
    navigateToView("actions");
  }

  function handleCombinedCreditReview() {
    createCreditReviewDraft(selectedCreditFindings, "combined");
  }

  function handleSeparateCreditReview(finding: Record<string, unknown>) {
    createCreditReviewDraft([finding], "separate");
    if (!currentUser?.isDemo) {
      void handleFindingAction("request_credit_refund", finding);
    }
  }

  function handleSendCreditReviewDraft() {
    if (!creditReviewDraft) {
      setActionCenterStatus("Create a credit/refund draft before sending.");
      return;
    }

    setCreditReviewSent(true);
    setActionCenterStatus(
      currentUser?.isDemo
        ? "Email sent from the demo Action Center. No external message was delivered."
        : "Email sent from the Action Center.",
    );
  }

  async function handleCopyCallScript() {
    if (!creditReviewDraft) {
      setCopyStatus("Create a request draft before copying the script.");
      return;
    }

    try {
      await navigator.clipboard.writeText(creditReviewDraft.callScript);
      setCopyStatus("Call script copied.");
    } catch {
      setCopyStatus("Select the script text and copy it manually.");
    }
  }

  if (activeView === "overview") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(17, 122, 114, 0.06), transparent 22%), radial-gradient(circle at top right, rgba(21, 34, 53, 0.05), transparent 18%), #f7f9fc",
          color: "#152235",
          ...shellFont(),
        }}
      >
        <div
          style={{
            maxWidth: 1680,
            margin: "0 auto",
            minHeight: "100vh",
            padding: "32px 48px 56px",
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
            <Link
              href="/dashboard"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 0,
                color: "#152235",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid #dbe4ef",
                  background: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 17,
                  fontWeight: 800,
                  boxShadow: "0 8px 20px rgba(18, 33, 58, 0.05)",
                }}
              >
                O
              </span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>OweMe Health</span>
            </Link>

            {accountMenu()}
          </header>

          <section
            className="oweme-home-hero"
            style={{
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              textAlign: "center",
              gap: 22,
              paddingTop: 158,
              paddingBottom: 56,
            }}
          >
            <h1
              style={{
                margin: 0,
                maxWidth: 860,
                color: "#0f172a",
                fontSize: 76,
                lineHeight: 0.98,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              Find medical credits you may be owed
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 760,
                color: "#536176",
                fontSize: 18,
                lineHeight: 1.5,
              }}
            >
              OweMe compares what you paid with what insurance says you owe, then flags credits,
              refunds, and visits to follow up.
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
              <Link
                href="/dashboard?view=past"
                data-testid="home-check-past-bills"
                onClick={(event) => handleViewLinkClick(event, "past")}
                style={{
                  display: "grid",
                  gap: 14,
                  textAlign: "left",
                  borderRadius: 22,
                  border: "1px solid #cfe0e8",
                  background: "#ffffff",
                  color: "#152235",
                  padding: "18px 20px",
                  width: 292,
                  minHeight: 112,
                  cursor: "pointer",
                  boxShadow: "0 14px 28px rgba(18, 33, 58, 0.08)",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    justifySelf: "start",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 134,
                    borderRadius: 999,
                    background: "#152235",
                    color: "#ffffff",
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  Check past bills
                </span>
                <span style={{ color: "#667085", fontSize: 14, lineHeight: 1.4 }}>
                  Find past overpayments and possible refunds from old claims and payments.
                </span>
              </Link>
              <Link
                href="/dashboard?view=future"
                data-testid="home-track-new-visit"
                onClick={(event) => handleViewLinkClick(event, "future")}
                style={{
                  display: "grid",
                  gap: 14,
                  textAlign: "left",
                  borderRadius: 22,
                  border: "1px solid #cfe0e8",
                  background: "#ffffff",
                  color: "#152235",
                  padding: "18px 20px",
                  width: 292,
                  minHeight: 112,
                  cursor: "pointer",
                  boxShadow: "0 14px 28px rgba(18, 33, 58, 0.08)",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    justifySelf: "start",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 134,
                    borderRadius: 999,
                    background: "#152235",
                    color: "#ffffff",
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  Track a new visit
                </span>
                <span style={{ color: "#667085", fontSize: 14, lineHeight: 1.4 }}>
                  Log new visits so OweMe can remind you when the EOB should arrive.
                </span>
              </Link>
            </div>

            <div
              style={{
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: "center",
                borderRadius: 999,
                border: "1px solid #dbe4ef",
                background: "#ffffff",
                padding: "14px 24px",
                boxShadow: "0 14px 28px rgba(18, 33, 58, 0.07)",
              }}
            >
              <span style={{ color: "#667085", fontSize: 16 }}>Demo audit found</span>
              <strong style={{ color: "#0b7a75", fontSize: 28, lineHeight: 1 }}>
                {formatCurrency(totalPossibleCredit)}
              </strong>
              <span style={{ color: "#667085", fontSize: 16 }}>across {providerCount || 0} providers</span>
            </div>

            {flashMessage ? (
              <div
                style={{
                  borderRadius: 999,
                  border: "1px solid #b9e6df",
                  background: "#effbf8",
                  color: "#0f766d",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {flashMessage}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(17, 122, 114, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(21, 34, 53, 0.08), transparent 20%), #f4f7fb",
        color: "#152235",
        ...shellFont(),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "168px minmax(0, 1fr)",
          minHeight: "100vh",
        }}
      >
        <aside
          style={{
            background: "#132036",
            color: "#f8fbff",
            padding: 12,
            display: "grid",
            gridTemplateRows: "auto auto 1fr",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: "#def4f1",
                color: "#117a72",
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              O
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>OweMe Health</p>
            </div>
          </div>

          <nav style={{ display: "grid", gap: 6 }}>
            {views.map((view) => {
              const active = view.key === activeView;
              return (
                <Link
                  key={view.key}
                  href={viewHref(view.key)}
                  onClick={(event) => handleViewLinkClick(event, view.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 14,
                    border: "1px solid",
                    borderColor: active ? "rgba(131, 215, 208, 0.38)" : "rgba(255,255,255,0.08)",
                    background: active ? "rgba(131, 215, 208, 0.14)" : "transparent",
                    color: "#f8fbff",
                    padding: "10px 10px",
                    fontSize: 14,
                    fontWeight: active ? 700 : 600,
                    cursor: "pointer",
                    textAlign: "left",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ width: 14, textAlign: "center", opacity: 0.88 }}>{view.icon}</span>
                  <span>{view.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={{ alignSelf: "end" }} />
        </aside>

        <div style={{ padding: 28, display: "grid", gap: 22 }}>
          <header style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            {accountMenu()}
          </header>
          {flashMessage ? (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid #b9e6df",
                background: "#effbf8",
                color: "#0f766d",
                padding: "14px 16px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {flashMessage}
            </div>
          ) : null}
          {renderView(
            "overview",
            activeView,
            surface(
              <div style={{ padding: 32, display: "grid", gap: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
                    <h1 style={{ margin: 0, fontSize: 56, lineHeight: 0.96, color: "#152235" }}>
                      Choose how OweMe helps today
                    </h1>
                    <p style={{ margin: 0, color: "#617086", fontSize: 19, lineHeight: 1.55 }}>
                      OweMe compares what you paid with what insurance says you owe, then flags
                      credits, refunds, and visits to follow up.
                    </p>
                  </div>
                  <div
                    style={{
                      minWidth: 240,
                      alignSelf: "start",
                      borderRadius: 22,
                      background: "#f4fbfa",
                      border: "1px solid #d7ece8",
                      padding: 22,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "#617086", fontSize: 14 }}>Demo audit found</span>
                    <strong style={{ fontSize: 42, lineHeight: 1, color: "#117a72" }}>
                      {formatCurrency(totalPossibleCredit)}
                    </strong>
                    <span style={{ color: "#617086", fontSize: 14 }}>
                      across {providerCount || 0} provider{providerCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <Link
                    href="/dashboard?view=past"
                    style={{
                      display: "grid",
                      gap: 14,
                      borderRadius: 18,
                      border: "1px solid #d9e3ef",
                      background: "#ffffff",
                      color: "#152235",
                      padding: "16px 18px",
                      width: 280,
                      cursor: "pointer",
                      boxShadow: "0 12px 24px rgba(18, 33, 58, 0.06)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        justifySelf: "start",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 134,
                        borderRadius: 999,
                        background: "#152235",
                        color: "#ffffff",
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1,
                      }}
                    >
                      Check past bills
                    </span>
                    <span style={{ color: "#617086", fontSize: 13, lineHeight: 1.4 }}>
                      Find past overpayments and possible refunds from old claims and payments.
                    </span>
                  </Link>
                  <Link
                    href="/dashboard?view=future"
                    style={{
                      display: "grid",
                      gap: 14,
                      borderRadius: 18,
                      border: "1px solid #d9e3ef",
                      background: "#ffffff",
                      color: "#152235",
                      padding: "16px 18px",
                      width: 280,
                      cursor: "pointer",
                      boxShadow: "0 12px 24px rgba(18, 33, 58, 0.06)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        justifySelf: "start",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 134,
                        borderRadius: 999,
                        background: "#152235",
                        color: "#ffffff",
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1,
                      }}
                    >
                      Track a new visit
                    </span>
                    <span style={{ color: "#617086", fontSize: 13, lineHeight: 1.4 }}>
                      Log new visits so OweMe can remind you when the EOB should arrive.
                    </span>
                  </Link>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                  {surface(
                    <div style={{ padding: 20, display: "grid", gap: 10 }}>
                      <strong style={{ fontSize: 16 }}>Past Credits</strong>
                      <span style={{ color: "#617086", lineHeight: 1.5 }}>
                        Upload claims and payment files, then run a private audit.
                      </span>
                      {pill(jobs.length ? `${jobs.length} job${jobs.length === 1 ? "" : "s"}` : "No uploads yet")}
                    </div>,
                  )}
                  {surface(
                    <div style={{ padding: 20, display: "grid", gap: 10 }}>
                      <strong style={{ fontSize: 16 }}>Future Visits</strong>
                      <span style={{ color: "#617086", lineHeight: 1.5 }}>
                        Record what you paid today and keep a claim-check date on your radar.
                      </span>
                      {pill(
                        recentVisit
                          ? `Latest ${formatVisitDate(recentVisit.visit_date ?? recentVisit.visitDate)}`
                          : "No visits tracked yet.",
                        recentVisit ? "teal" : "slate",
                      )}
                    </div>,
                  )}
                  {surface(
                    <div style={{ padding: 20, display: "grid", gap: 10 }}>
                      <strong style={{ fontSize: 16 }}>Action Center</strong>
                      <span style={{ color: "#617086", lineHeight: 1.5 }}>
                        Keep unresolved findings in one place so you know what still needs attention.
                      </span>
                      {pill(
                        reviewItems.length
                          ? `${reviewItems.length} action item${reviewItems.length === 1 ? "" : "s"}`
                          : "No action items yet.",
                        reviewItems.length ? "amber" : "slate",
                      )}
                    </div>,
                  )}
                </div>
              </div>,
            ),
          )}

          {renderView(
            "past",
            activeView,
            <>
              {surface(
                <div style={{ padding: 28, display: "grid", gap: 22 }}>
                  {sectionHeading(
                    "",
                    "Check old bills",
                    "Match what you paid against what insurance says you owe.",
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                    {fileCard({
                      title: "Claims file",
                      note: "Upload claim exports or PDFs from insurance.",
                      badge: "⎘",
                      badgeBg: "#e6ecff",
                      inputId: "claims-file-input",
                      accept: ACCEPTED_UPLOAD_ATTR,
                      uploads: selectedUploads.claim,
                      onFilesSelected: (files) => handleSelectedFiles("claim", files),
                    })}
                    {fileCard({
                      title: "Payments file",
                      note: "Upload card statements, receipts, or provider PDFs.",
                      badge: "▤",
                      badgeBg: "#def4f1",
                      inputId: "payments-file-input",
                      accept: ACCEPTED_UPLOAD_ATTR,
                      uploads: selectedUploads.payment,
                      onFilesSelected: (files) => handleSelectedFiles("payment", files),
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={{
                        borderRadius: 18,
                        border: "none",
                        background: "#152235",
                        color: "#ffffff",
                        padding: "16px 24px",
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                      onClick={handleRunAudit}
                    >
                      {isRunningAudit ? "Running..." : "Run audit"}
                    </button>
                    <span style={{ color: "#617086", fontSize: 16 }}>
                      {pastAuditStatus ||
                        (selectedUploads.claim.length || selectedUploads.payment.length
                          ? "Files selected."
                          : "No files selected.")}
                    </span>
                  </div>

                  <div
                    style={{
                      borderRadius: 22,
                      border: "1px dashed #cbd8e6",
                      padding: isManualFallbackOpen ? 20 : "14px 18px",
                      display: "grid",
                      gap: isManualFallbackOpen ? 14 : 0,
                      background: "#fbfdff",
                    }}
                  >
                    <button
                      type="button"
                      data-testid="manual-fallback-toggle"
                      onClick={() => setIsManualFallbackOpen((current) => !current)}
                      aria-expanded={isManualFallbackOpen}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textAlign: "left",
                        cursor: "pointer",
                        color: "#152235",
                      }}
                    >
                      <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <strong style={{ fontSize: 18 }}>Manual fallback</strong>
                        <span style={{ color: "#617086" }}>
                        Add one row per EOB amount or allocated payment when a PDF needs OCR.
                        </span>
                      </span>
                      <span style={{ color: "#0f766d", fontSize: 14, fontWeight: 800 }}>
                        {isManualFallbackOpen ? "Hide" : "Add manually"}
                      </span>
                    </button>
                    {isManualFallbackOpen ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "220px 1fr 220px 180px 140px",
                          gap: 12,
                        }}
                      >
                        <select
                          value={manualFallbackDraft.paymentSource}
                          onChange={(event) =>
                            setManualFallbackDraft((current) => ({
                              ...current,
                              paymentSource: event.target.value,
                            }))
                          }
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "16px 18px",
                            color: "#152235",
                            fontWeight: 600,
                            fontSize: 15,
                          }}
                        >
                          <option value="Receipt">Payment / receipt</option>
                          <option value="Provider statement">Provider statement</option>
                          <option value="Card statement">Card statement</option>
                        </select>
                        <input
                          value={manualFallbackDraft.providerName}
                          onChange={(event) =>
                            setManualFallbackDraft((current) => ({
                              ...current,
                              providerName: event.target.value,
                            }))
                          }
                          placeholder="Provider or clinic"
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "16px 18px",
                            color: "#152235",
                            fontWeight: 500,
                            fontSize: 15,
                          }}
                        />
                        <input
                          type="date"
                          value={manualFallbackDraft.paymentDate}
                          onChange={(event) =>
                            setManualFallbackDraft((current) => ({
                              ...current,
                              paymentDate: event.target.value,
                            }))
                          }
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "16px 18px",
                            color: manualFallbackDraft.paymentDate ? "#152235" : "#7a8599",
                            fontWeight: 600,
                            fontSize: 15,
                          }}
                        />
                        <input
                          inputMode="decimal"
                          value={manualFallbackDraft.amount}
                          onChange={(event) =>
                            setManualFallbackDraft((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                          placeholder="Amount"
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "16px 18px",
                            color: "#152235",
                            fontWeight: 600,
                            fontSize: 15,
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddManualFallback}
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "16px 18px",
                            color: "#152235",
                            fontWeight: 700,
                            fontSize: 15,
                            cursor: "pointer",
                          }}
                        >
                          {isSavingManualFallback ? "Saving..." : "Add row"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>,
              )}

              {surface(
                <div style={{ padding: 28, display: "grid", gap: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, color: "#152235" }}>
                    <span style={{ color: "#117a72" }}>{formatCurrency(totalPossibleCredit)}</span> possible
                    {" "}credits found
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: selectedFinding ? "1.15fr 0.85fr" : "1fr",
                      gap: 18,
                      alignItems: "start",
                    }}
                  >
                    {surface(
                      <div style={{ padding: 22, display: "grid", gap: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                          <h3 style={{ margin: 0, fontSize: 22 }}>Review queue</h3>
                          {pill(
                            `${filteredFindings.length} item${filteredFindings.length === 1 ? "" : "s"}`,
                            filteredFindings.length ? "amber" : "slate",
                          )}
                        </div>
                        {filteredFindings.length ? (
                          filteredFindings.map((finding) => {
                            const details = findingDetails(finding);
                            const findingType = String(finding.finding_type ?? "");
                            const isSelected = selectedFinding && String(selectedFinding.id) === String(finding.id);
                            const isUnassignedPayment = findingType === "unassigned_medical_payment";
                            const candidates = candidatePayments(finding);
                            const primaryCandidate = candidates[0];
                            const isConfirmed = hasConfirmedPayments(finding);
                            const displayPaymentRows = isConfirmed ? confirmedPayments(finding) : candidates;
                            const hasMultipleCandidates = candidates.length > 1;
                            const creditAmount = isConfirmed
                              ? confirmedCreditAmount(finding)
                              : parseAmount(details.credit_amount);
                            const paidValue = isConfirmed
                              ? confirmedPaidAmount(finding).toFixed(2)
                              : detailText(details.paid_amount ?? primaryCandidate?.amount, "--");

                            return (
                              <button
                                key={String(finding.id)}
                                type="button"
                                data-testid={`review-finding-${String(finding.id)}`}
                                onClick={() => {
                                  setSelectedFindingId(String(finding.id));
                                  setFindingActionStatus("");
                                  setCreditReviewMode("combined");
                                  setCreditReviewDraft(null);
                                }}
                                style={{
                                  textAlign: "left",
                                  border: isSelected ? "1px solid #7ccfc6" : "1px solid #e3ebf4",
                                  borderRadius: 18,
                                  padding: 18,
                                  display: "grid",
                                  gap: 10,
                                  background: isSelected ? "#f7fffd" : "#ffffff",
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <strong style={{ fontSize: 18, color: "#152235" }}>
                                      {findingProviderName(finding)}
                                    </strong>
                                    <span style={{ color: "#617086", fontSize: 14 }}>
                                      {isUnassignedPayment
                                        ? `Payment ${detailText(details.payment_date, "date not recorded")}`
                                        : `Visit ${detailText(details.service_date, "date not recorded")}`}
                                    </span>
                                  </div>
                                  {pill(findingStatusLabel(finding), findingStatusTone(findingType))}
                                </div>
                                {creditAmount > 0 ? (
                                  <div
                                    aria-label={`Possible credit ${formatCurrency(creditAmount)}`}
                                    style={{
                                      borderRadius: 16,
                                      background: "linear-gradient(135deg, #0f766d, #13a092)",
                                      color: "#ffffff",
                                      padding: "12px 14px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      alignItems: "center",
                                    }}
                                  >
                                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.02em" }}>
                                      Possible credit
                                    </span>
                                    <strong style={{ fontSize: 24, lineHeight: 1 }}>
                                      {formatCurrency(creditAmount)}
                                    </strong>
                                  </div>
                                ) : null}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>
                                      {isUnassignedPayment ? "Possible visits" : "EOB says you owe"}
                                    </span>
                                    <strong style={{ fontSize: 16 }}>
                                      {isUnassignedPayment ? `${possibleClaims(finding).length}` : detailText(details.responsibility_amount, "--")}
                                    </strong>
                                  </div>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>
                                      {isUnassignedPayment
                                        ? "You paid"
                                        : isConfirmed
                                          ? "Confirmed payments"
                                        : hasMultipleCandidates
                                          ? "Candidate payments"
                                          : primaryCandidate && !details.paid_amount
                                          ? "Candidate payment"
                                          : "You paid"}
                                    </span>
                                    <strong style={{ fontSize: 16 }}>
                                      {isConfirmed
                                        ? paidValue
                                        : hasMultipleCandidates
                                        ? `${candidates.length} possible`
                                        : paidValue}
                                    </strong>
                                  </div>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>
                                      Payment method
                                    </span>
                                    <strong style={{ fontSize: 16 }}>
                                      {isConfirmed
                                        ? candidatePaymentSourceSummary(displayPaymentRows)
                                        : hasMultipleCandidates
                                        ? candidatePaymentSourceSummary(displayPaymentRows)
                                        : paymentMethodText(details.payment_source ?? primaryCandidate?.payment_source_label ?? primaryCandidate?.payment_source)}
                                    </strong>
                                  </div>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>
                                      {creditAmount > 0 ? "Possible credit" : "Review status"}
                                    </span>
                                    <strong style={{ fontSize: 16 }}>
                                      {creditAmount > 0 ? formatCurrency(creditAmount) : findingStatusLabel(finding)}
                                    </strong>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div
                            style={{
                              position: "relative",
                              overflow: "hidden",
                              borderRadius: 22,
                              border: "1px solid #dbe4ef",
                              background:
                                "linear-gradient(135deg, rgba(248,251,255,0.95), rgba(232,251,246,0.72))",
                              padding: 24,
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) auto",
                              gap: 22,
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                right: -46,
                                top: -52,
                                width: 160,
                                height: 160,
                                borderRadius: "50%",
                                background: "rgba(17, 122, 114, 0.08)",
                              }}
                            />
                            <div style={{ position: "relative", display: "grid", gap: 10 }}>
                              <span
                                style={{
                                  color: "#0b7a75",
                                  fontSize: 12,
                                  fontWeight: 900,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                }}
                              >
                                Ready for a clean audit
                              </span>
                              <strong style={{ color: "#152235", fontSize: 26, lineHeight: 1.1 }}>
                                No review items yet.
                              </strong>
                              <span style={{ maxWidth: 620, color: "#617086", fontSize: 15, lineHeight: 1.55 }}>
                                Upload a claim/EOB file plus a payment file, then run audit. OweMe will show exact matches,
                                possible credits, and anything that needs confirmation.
                              </span>
                            </div>
                            <div
                              style={{
                                position: "relative",
                                display: "grid",
                                gap: 8,
                                minWidth: 220,
                              }}
                            >
                              {[
                                ["1", "Claims / EOB"],
                                ["2", "HSA or card file"],
                                ["3", "Run audit"],
                              ].map(([step, label]) => (
                                <div
                                  key={step}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "28px 1fr",
                                    gap: 10,
                                    alignItems: "center",
                                    borderRadius: 14,
                                    background: "#ffffff",
                                    border: "1px solid #dbe4ef",
                                    padding: "10px 12px",
                                    boxShadow: "0 10px 22px rgba(18, 33, 58, 0.05)",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 999,
                                      background: "#def4f1",
                                      color: "#0f766d",
                                      display: "grid",
                                      placeItems: "center",
                                      fontSize: 13,
                                      fontWeight: 900,
                                    }}
                                  >
                                    {step}
                                  </span>
                                  <strong style={{ color: "#152235", fontSize: 14 }}>{label}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>,
                    )}

                    {selectedFinding ? surface(
                      <div style={{ padding: 22, display: "grid", gap: 16 }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <p
                            style={{
                              margin: 0,
                              color: "#0b7a75",
                              fontSize: 13,
                              fontWeight: 800,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                            }}
                          >
                            Selected visit
                          </p>
                          <h3 style={{ margin: 0, fontSize: 22 }}>{findingProviderName(selectedFinding)}</h3>
                          <span style={{ color: "#617086", fontSize: 14 }}>
                            Service date: {detailText(findingDetails(selectedFinding).service_date, "Date to confirm")}
                          </span>
                        </div>
                        {selectedFinding ? (
                          <>
                            {selectedProviderFindings.length > 1 && String(selectedFinding.finding_type ?? "") !== "possible_credit" ? (
                              <div
                                style={{
                                  borderRadius: 18,
                                  border: "1px solid #b9e6df",
                                  background: "#f3fffc",
                                  padding: 16,
                                  display: "grid",
                                  gap: 12,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                  <strong style={{ fontSize: 16, color: "#152235" }}>
                                    {findingProviderName(selectedFinding)} payment picture
                                  </strong>
                                  {pill(`${selectedProviderFindings.length} visits`, "teal")}
                                </div>
                                <div style={{ display: "grid", gap: 10 }}>
                                  {selectedProviderFindings.map((providerFinding) => {
                                    const providerDetails = findingDetails(providerFinding);
                                    const providerCandidates = candidatePayments(providerFinding);
                                    const isCurrent = String(providerFinding.id) === String(selectedFinding.id);
                                    const candidate = providerCandidates[0];
                                    const potentialCredit = candidatePotentialCredit(providerFinding, candidate);

                                    return (
                                      <button
                                        key={String(providerFinding.id)}
                                        type="button"
                                        onClick={() => {
                                          setSelectedFindingId(String(providerFinding.id));
                                          setFindingActionStatus("");
                                        }}
                                        style={{
                                          textAlign: "left",
                                          border: isCurrent ? "1px solid #7ccfc6" : "1px solid #d8eee9",
                                          borderRadius: 14,
                                          background: isCurrent ? "#ffffff" : "rgba(255,255,255,0.68)",
                                          padding: 12,
                                          display: "grid",
                                          gap: 6,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                          <strong style={{ color: "#152235", fontSize: 14 }}>
                                            Visit {detailText(providerDetails.service_date, "date unknown")}
                                          </strong>
                                          <span style={{ color: "#0f766d", fontSize: 13, fontWeight: 800 }}>
                                            {findingStatusLabel(providerFinding)}
                                          </span>
                                        </div>
                                        <span style={{ color: "#617086", fontSize: 13, lineHeight: 1.45 }}>
                                          EOB {detailText(providerDetails.responsibility_amount, "--")}
                                          {providerDetails.paid_amount
                                            ? ` · paid ${detailText(providerDetails.paid_amount)}`
                                            : candidate
                                              ? ` · candidate ${detailText(candidate.amount)} on ${detailText(candidate.payment_date, "date unknown")}`
                                              : " · no payment found yet"}
                                          {providerDetails.credit_amount
                                            ? ` · possible credit ${detailText(providerDetails.credit_amount)}`
                                            : potentialCredit > 0
                                              ? ` · potential credit ${potentialCredit.toFixed(2)}`
                                            : ""}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {selectedCreditFindings.length > 1 ? (
                              <div
                                style={{
                                  borderRadius: 18,
                                  border: "1px solid #b9e6df",
                                  padding: 16,
                                  display: "grid",
                                  gap: 14,
                                  background: "#fbfffe",
                                }}
                              >
                                <div style={{ display: "grid", gap: 5 }}>
                                  <strong style={{ fontSize: 16 }}>
                                    {creditReviewMode === "combined" ? "Combined review" : "Separate review"} for {findingProviderName(selectedFinding)}
                                  </strong>
                                  <span style={{ color: "#385b64", lineHeight: 1.45 }}>
                                    {selectedCreditFindings.length} visits · Total possible credit {formatCurrency(selectedCreditTotal)}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gap: 8 }}>
                                  {selectedCreditFindings.map((finding) => {
                                    const details = findingDetails(finding);
                                    const responsibility = parseAmount(details.responsibility_amount);
                                    const paid = parseAmount(details.paid_amount);
                                    const difference = findingCreditAmount(finding);
                                    return (
                                      <div
                                        key={String(finding.id)}
                                        style={{
                                          borderRadius: 14,
                                          border: "1px solid #e3ebf4",
                                          background: "#ffffff",
                                          padding: 12,
                                          display: "grid",
                                          gridTemplateColumns: "1.15fr repeat(3, minmax(0, 1fr))",
                                          gap: 10,
                                          alignItems: "center",
                                        }}
                                      >
                                        <div style={{ display: "grid", gap: 3 }}>
                                          <span style={{ color: "#7b879b", fontSize: 11, fontWeight: 700 }}>Service date</span>
                                          <strong style={{ fontSize: 14 }}>{formatVisitDate(details.service_date)}</strong>
                                        </div>
                                        <div style={{ display: "grid", gap: 3 }}>
                                          <span style={{ color: "#7b879b", fontSize: 11, fontWeight: 700 }}>EOB responsibility</span>
                                          <strong style={{ fontSize: 14 }}>{formatCurrency(responsibility)}</strong>
                                        </div>
                                        <div style={{ display: "grid", gap: 3 }}>
                                          <span style={{ color: "#7b879b", fontSize: 11, fontWeight: 700 }}>Matched payment</span>
                                          <strong style={{ fontSize: 14 }}>{formatCurrency(paid)}</strong>
                                        </div>
                                        <div style={{ display: "grid", gap: 3 }}>
                                          <span style={{ color: "#7b879b", fontSize: 11, fontWeight: 700 }}>Difference</span>
                                          <strong style={{ fontSize: 14, color: "#117a72" }}>{formatCurrency(difference)}</strong>
                                        </div>
                                        {creditReviewMode === "separate" ? (
                                          <button
                                            type="button"
                                            data-testid={`request-separate-${String(finding.id)}`}
                                            onClick={() => handleSeparateCreditReview(finding)}
                                            disabled={isSavingFindingAction}
                                            style={{
                                              gridColumn: "1 / -1",
                                              borderRadius: 10,
                                              border: "1px solid #b9e6df",
                                              background: "#f4fbfa",
                                              color: "#0f766d",
                                              padding: "9px 11px",
                                              fontSize: 13,
                                              fontWeight: 700,
                                              cursor: "pointer",
                                            }}
                                          >
                                            Request {formatCurrency(difference)} credit/refund review
                                          </button>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                                {creditReviewMode === "combined" ? (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <button
                                      type="button"
                                      data-testid="request-combined-refund-review"
                                      onClick={handleCombinedCreditReview}
                                      disabled={isSavingFindingAction}
                                      style={{
                                        borderRadius: 14,
                                        border: "none",
                                        background: "#117a72",
                                        color: "#ffffff",
                                        padding: "13px 14px",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Request combined refund review
                                    </button>
                                    <button
                                      type="button"
                                      data-testid="request-separately"
                                      onClick={() => {
                                        setCreditReviewMode("separate");
                                        setCreditReviewDraft(null);
                                        setFindingActionStatus("Separate review mode: choose a visit below to request its amount.");
                                      }}
                                      disabled={isSavingFindingAction}
                                      style={{
                                        borderRadius: 14,
                                        border: "1px solid #dbe4ef",
                                        background: "#ffffff",
                                        color: "#152235",
                                        padding: "13px 14px",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Request separately
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    data-testid="back-to-combined-review"
                                    onClick={() => {
                                      setCreditReviewMode("combined");
                                      setCreditReviewDraft(null);
                                      setFindingActionStatus("Combined review mode restored.");
                                    }}
                                    style={{
                                      borderRadius: 14,
                                      border: "1px solid #b9e6df",
                                      background: "#f4fbfa",
                                      color: "#0f766d",
                                      padding: "13px 14px",
                                      fontSize: 14,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Back to combined review
                                  </button>
                                )}
                              </div>
                            ) : null}
                            <div
                              style={{
                                borderRadius: 18,
                                border: "1px solid #dbe4ef",
                                background: "#fbfdff",
                                padding: 16,
                                display: "grid",
                                gap: 8,
                              }}
                            >
                              <strong style={{ fontSize: 16 }}>Why this may be a credit/refund</strong>
                              <span style={{ color: "#617086", lineHeight: 1.45 }}>
                                {whyOwedText(selectedFinding)}
                              </span>
                            </div>
                            <div
                              style={{
                                borderRadius: 18,
                                border: "1px solid #cfe0e8",
                                background: "#f8fbff",
                                padding: 16,
                                display: "grid",
                                gap: 12,
                              }}
                            >
                              <strong style={{ fontSize: 16 }}>Records to check</strong>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 800 }}>
                                    Insurance / EOB
                                  </span>
                                  <span style={{ color: "#617086" }}>
                                    Claim provider read: {detailText(stripDemoSuffix(findingDetails(selectedFinding).claim_provider_name ?? findingDetails(selectedFinding).provider_name ?? selectedFinding.provider_name), "Provider to confirm")}
                                  </span>
                                  <span style={{ color: "#617086" }}>
                                    Service date: {detailText(findingDetails(selectedFinding).service_date, "Date to confirm")}
                                  </span>
                                  <span style={{ color: "#617086" }}>
                                    Patient responsibility: {detailText(findingDetails(selectedFinding).responsibility_amount, "Amount to confirm")}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 800 }}>
                                    {candidatePayments(selectedFinding).length > 1 ? "Payment candidates" : "Payment record"}
                                  </span>
                                  {candidatePayments(selectedFinding).length > 1 ? (
                                    <>
                                      <span style={{ color: "#617086" }}>
                                        Candidates found: {candidatePayments(selectedFinding).length}
                                      </span>
                                      <span style={{ color: "#617086" }}>
                                        Source/account: {candidatePaymentSourceSummary(candidatePayments(selectedFinding))}
                                      </span>
                                      <span style={{ color: "#617086" }}>
                                        Review each candidate payment below before linking it to this visit.
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span style={{ color: "#617086" }}>
                                        Payment method: {paymentMethodText(candidatePayments(selectedFinding)[0]?.payment_source_label ?? candidatePayments(selectedFinding)[0]?.payment_source ?? findingDetails(selectedFinding).payment_source)}
                                      </span>
                                      <span style={{ color: "#617086" }}>
                                        Payment date: {detailText(candidatePayments(selectedFinding)[0]?.payment_date ?? findingDetails(selectedFinding).payment_date, "Date to confirm")}
                                      </span>
                                      <span style={{ color: "#617086" }}>
                                        Amount: {detailText(candidatePayments(selectedFinding)[0]?.amount ?? findingDetails(selectedFinding).paid_amount, "Amount to confirm")}
                                      </span>
                                      <span style={{ color: "#617086" }}>
                                        Recorded merchant/provider: {detailText(stripDemoSuffix(candidatePayments(selectedFinding)[0]?.provider_name ?? findingDetails(selectedFinding).payment_provider_name ?? findingDetails(selectedFinding).provider_name), "Merchant to confirm")}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <strong style={{ color: "#152235", fontSize: 14, lineHeight: 1.45 }}>
                                {checkRecordsQuestion(selectedFinding)}
                              </strong>
                            </div>
                            <div
                              style={{
                                borderRadius: 18,
                                border: "1px solid #dbe4ef",
                                background: "#ffffff",
                                padding: 16,
                                display: "grid",
                                gap: 8,
                              }}
                            >
                              <strong style={{ fontSize: 16 }}>Next step</strong>
                              <span style={{ color: "#617086", lineHeight: 1.45 }}>
                                {nextStepText(selectedFinding, {
                                  mode: creditReviewMode,
                                  findings: selectedCreditFindings,
                                  total: selectedCreditTotal,
                                })}
                              </span>
                            </div>
                            {creditReviewDraft ? (
                              <div
                                data-testid="credit-review-draft"
                                style={{
                                  borderRadius: 18,
                                  border: "1px solid #b9e6df",
                                  background: "#f4fbfa",
                                  padding: 16,
                                  display: "grid",
                                  gap: 8,
                                }}
                              >
                                <strong style={{ fontSize: 16 }}>
                                  {creditReviewDraft.mode === "combined" ? "Combined request draft ready" : "Separate request draft ready"}
                                </strong>
                                <span style={{ color: "#385b64", lineHeight: 1.45 }}>
                                  {creditReviewDraft.provider} · {creditReviewDraft.visits.length} visit{creditReviewDraft.visits.length === 1 ? "" : "s"} · total {formatCurrency(creditReviewDraft.total)}
                                </span>
                                <div style={{ display: "grid", gap: 4 }}>
                                  {creditReviewDraft.visits.map((visit) => (
                                    <span key={visit.id} style={{ color: "#617086", lineHeight: 1.4 }}>
                                      {formatVisitDate(visit.serviceDate)} · {formatCurrency(visit.difference)} possible credit
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {String(selectedFinding.finding_type ?? "") === "unassigned_medical_payment" ? (
                              <>
                                <div style={{ display: "grid", gap: 12 }}>
                                  <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 8 }}>
                                    <strong style={{ fontSize: 16 }}>Bank statement payment</strong>
                                    <span style={{ color: "#617086" }}>
                                      Payment date: {detailText(findingDetails(selectedFinding).payment_date)}
                                    </span>
                                    <span style={{ color: "#617086" }}>
                                      Amount found: {detailText(findingDetails(selectedFinding).paid_amount)}
                                    </span>
                                    <span style={{ color: "#617086" }}>
                                      Payment method: {paymentMethodText(findingDetails(selectedFinding).payment_source, "Card / statement row")}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 10 }}>
                                  <strong style={{ fontSize: 16 }}>Why this is still unassigned</strong>
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {findingEvidenceBullets(selectedFinding).map((bullet) => (
                                      <span key={bullet} style={{ color: "#617086", lineHeight: 1.45 }}>
                                        {bullet}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 10 }}>
                                  <strong style={{ fontSize: 16 }}>Possible visits to assign</strong>
                                  <div style={{ display: "grid", gap: 10 }}>
                                    {possibleClaims(selectedFinding).length ? (
                                      possibleClaims(selectedFinding).map((claim) => (
                                        <div
                                          key={String(claim.provider_name ?? claim.service_date)}
                                          style={{
                                            borderRadius: 14,
                                            background: "#fbfdff",
                                            border: "1px solid #e8eef6",
                                            padding: 14,
                                            display: "grid",
                                            gap: 6,
                                          }}
                                        >
                                          <strong style={{ fontSize: 15, color: "#152235" }}>
                                            {detailText(claim.provider_name, "Visit candidate")}
                                          </strong>
                                          <span style={{ color: "#617086" }}>
                                            Visit {detailText(claim.service_date, "date unknown")} · EOB says you owe {detailText(claim.responsibility_amount, "--")}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <span style={{ color: "#617086" }}>No likely visits surfaced yet.</span>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : String(selectedFinding.finding_type ?? "") !== "possible_credit" ? (
                              <>
                            <div style={{ display: "grid", gap: 12 }}>
                              <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 8 }}>
                                <strong style={{ fontSize: 16 }}>Claim / EOB</strong>
                                <span style={{ color: "#617086" }}>
                                  Claim provider read: {detailText(stripDemoSuffix(findingDetails(selectedFinding).claim_provider_name ?? findingDetails(selectedFinding).provider_name ?? selectedFinding.provider_name))}
                                </span>
                                <span style={{ color: "#617086" }}>
                                  Service date: {detailText(findingDetails(selectedFinding).service_date)}
                                </span>
                                <span style={{ color: "#617086" }}>
                                  Patient responsibility: {detailText(findingDetails(selectedFinding).responsibility_amount)}
                                </span>
                              </div>

                              <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 8 }}>
                                <strong style={{ fontSize: 16 }}>Payment evidence</strong>
                                <span style={{ color: "#617086" }}>
                                  Amount found: {detailText(findingDetails(selectedFinding).paid_amount, "No payment found yet")}
                                </span>
                                <span style={{ color: "#617086" }}>
                                  Payment method: {paymentMethodText(findingDetails(selectedFinding).payment_source)}
                                </span>
                              </div>
                            </div>

                            <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 10 }}>
                              <strong style={{ fontSize: 16 }}>Why we matched this</strong>
                              <div style={{ display: "grid", gap: 8 }}>
                                {findingEvidenceBullets(selectedFinding).map((bullet) => (
                                  <span key={bullet} style={{ color: "#617086", lineHeight: 1.45 }}>
                                    {bullet}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {candidatePayments(selectedFinding).length > 0 ? (
                              <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 10 }}>
                                <strong style={{ fontSize: 16 }}>Payment candidates</strong>
                                <div style={{ display: "grid", gap: 10 }}>
                                  {candidatePayments(selectedFinding).map((candidate) => {
                                    const candidateId = candidatePaymentId(candidate);
                                    const checked = candidateId ? currentSelectedCandidatePaymentIds.includes(candidateId) : false;
                                    return (
                                      <label
                                        key={String(candidate.payment_id ?? candidate.provider_name ?? candidate.amount)}
                                        style={{
                                          borderRadius: 14,
                                          background: checked ? "#f4fbfa" : "#fbfdff",
                                          border: checked ? "1px solid #7ccfc6" : "1px solid #e8eef6",
                                          padding: 14,
                                          display: "grid",
                                          gridTemplateColumns: "auto 1fr",
                                          gap: 10,
                                          alignItems: "start",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!candidateId}
                                          onChange={(event) => {
                                            updateSelectedCandidatePaymentIds((current) =>
                                              event.target.checked
                                                ? Array.from(new Set([...current, candidateId]))
                                                : current.filter((id) => id !== candidateId),
                                            );
                                          }}
                                          style={{ width: 20, height: 20, marginTop: 2 }}
                                        />
                                        <div style={{ display: "grid", gap: 6 }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                            <strong style={{ fontSize: 15, color: "#152235" }}>
                                              {detailText(stripDemoSuffix(candidate.provider_name), "Provider candidate")}
                                            </strong>
                                            <span
                                              style={{
                                                display: "inline-flex",
                                                padding: "6px 10px",
                                                borderRadius: 999,
                                                background: "#fff1df",
                                                color: "#b56411",
                                                fontSize: 12,
                                                fontWeight: 700,
                                              }}
                                            >
                                              {candidateId ? detailText(candidate.match_hint, "Needs review") : "Missing payment ID"}
                                            </span>
                                          </div>
                                          <span style={{ color: "#617086" }}>
                                            Paid {detailText(candidate.amount)} on {detailText(candidate.payment_date, "date unknown")}
                                          </span>
                                          <span style={{ color: "#617086" }}>
                                            Payment method: {candidatePaymentSourceText(candidate, "Card / receipt line item")}
                                          </span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                                {currentSelectedPaymentSummary ? (
                                  <span style={{ color: "#385b64", lineHeight: 1.45 }}>
                                    Selected payments: {formatCurrency(currentSelectedPaymentSummary.selectedTotal)} across {currentSelectedPaymentSummary.count} payment{currentSelectedPaymentSummary.count === 1 ? "" : "s"} · EOB responsibility: {formatCurrency(currentSelectedPaymentSummary.responsibility)} · Possible credit: {formatCurrency(currentSelectedPaymentSummary.credit)}
                                  </span>
                                ) : null}
                                {currentSelectedCandidatePaymentIds.length === 0 ? (
                                  <span style={{ color: "#b56411", fontSize: 13 }}>Select at least one payment to confirm.</span>
                                ) : null}
                              </div>
                            ) : null}
                              </>
                            ) : null}

                            <div style={{ display: "grid", gap: 10 }}>
                              {selectedCreditFindings.length <= 1 &&
                              String(selectedFinding.finding_type ?? "") === "possible_credit" &&
                              parseAmount(findingDetails(selectedFinding).credit_amount) > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleFindingAction("request_credit_refund")}
                                  disabled={isSavingFindingAction}
                                  style={{
                                    borderRadius: 16,
                                    border: "none",
                                    background: isSavingFindingAction ? "#91a0b5" : "#152235",
                                    color: "#ffffff",
                                    padding: "14px 16px",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {isSavingFindingAction
                                    ? "Saving..."
                                    : `Request ${formatCurrency(parseAmount(findingDetails(selectedFinding).credit_amount))} credit/refund`}
                                </button>
                              ) : candidatePayments(selectedFinding).length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleFindingAction("confirm_match", selectedFinding, {
                                      paymentIds: currentSelectedCandidatePaymentIds,
                                    })
                                  }
                                  disabled={isSavingFindingAction || currentSelectedCandidatePaymentIds.length === 0}
                                  style={{
                                    borderRadius: 16,
                                    border: "none",
                                    background: isSavingFindingAction || currentSelectedCandidatePaymentIds.length === 0 ? "#91a0b5" : "#152235",
                                    color: "#ffffff",
                                    padding: "14px 16px",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: isSavingFindingAction || currentSelectedCandidatePaymentIds.length === 0 ? "default" : "pointer",
                                  }}
                                >
                                  {isSavingFindingAction ? "Saving..." : "Confirm selected payments match"}
                                </button>
                              ) : null}
                              {selectedFinding && hasConfirmedPayments(selectedFinding) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCandidatePaymentIdsByFinding((current) => ({
                                      ...current,
                                      [String(selectedFinding.id)]: initialSelectedPaymentIds(selectedFinding),
                                    }));
                                    setFindingActionStatus("Review and revise the selected payments, then save again.");
                                  }}
                                  style={{
                                    borderRadius: 16,
                                    border: "1px solid #117a72",
                                    background: "#ffffff",
                                    color: "#117a72",
                                    padding: "14px 16px",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Revise selected payments
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleFindingAction("not_same_visit")}
                                disabled={isSavingFindingAction}
                                style={{
                                  borderRadius: 16,
                                  border: "1px solid #dbe4ef",
                                  background: "#ffffff",
                                  color: "#152235",
                                  padding: "14px 16px",
                                  fontSize: 15,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {isSavingFindingAction ? "Saving..." : "This payment is not for this visit"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFindingAction("add_receipt_or_payment")}
                                disabled={isSavingFindingAction}
                                style={{
                                  borderRadius: 16,
                                  border: "1px solid #dbe4ef",
                                  background: "#f8fbff",
                                  color: "#152235",
                                  padding: "14px 16px",
                                  fontSize: 15,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {isSavingFindingAction ? "Saving..." : "Add receipt"}
                              </button>
                              {findingActionStatus ? (
                                <span style={{ color: "#617086", fontSize: 14, lineHeight: 1.45 }}>
                                  {findingActionStatus}
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: "#617086" }}>Select a finding to review its evidence.</div>
                        )}
                      </div>,
                    ) : null}
                  </div>
                </div>,
              )}
            </>,
          )}

          {renderView(
            "future",
            activeView,
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 0.72fr) minmax(300px, 0.28fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
              {surface(
                <div style={{ padding: 22, display: "grid", gap: 18 }}>
                  {sectionHeading(
                    "Future Visits",
                    "Log a visit before it disappears",
                    "Record what you paid today. OweMe creates a claim-check date and later compares the EOB.",
                  )}

                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ position: "relative", display: "grid", gap: 8 }}>
                      {futureFieldLabel("Provider or clinic")}
                      <input
                        aria-label="Provider or clinic"
                        value={futureVisitDraft.provider}
                        onFocus={() => setIsProviderSuggestionsOpen(true)}
                        onBlur={() => {
                          window.setTimeout(() => setIsProviderSuggestionsOpen(false), 120);
                        }}
                        onChange={(event) => {
                          setFutureVisitDraft((current) => ({ ...current, provider: event.target.value }));
                          setIsProviderSuggestionsOpen(true);
                        }}
                        placeholder="Start typing a clinic or provider name"
                        autoComplete="off"
                        style={{
                          height: 48,
                          borderRadius: 14,
                          border: "1px solid #dbe4ef",
                          background: "#ffffff",
                          padding: "0 14px",
                          color: "#68707d",
                          fontSize: 16,
                          fontWeight: 500,
                        }}
                      />
                      {isProviderSuggestionsOpen && visibleProviderSuggestions.length ? (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            right: 0,
                            zIndex: 5,
                            border: "1px solid #dbe4ef",
                            borderRadius: 14,
                            background: "#ffffff",
                            boxShadow: "0 18px 34px rgba(18, 33, 58, 0.12)",
                            padding: 6,
                            display: "grid",
                            gap: 4,
                          }}
                        >
                          {visibleProviderSuggestions.map((provider) => (
                            <button
                              key={provider}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setFutureVisitDraft((current) => ({ ...current, provider }));
                                setIsProviderSuggestionsOpen(false);
                              }}
                              style={{
                                border: "none",
                                borderRadius: 10,
                                background: "#fbfdff",
                                color: "#152235",
                                padding: "11px 12px",
                                textAlign: "left",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "grid",
                                gridTemplateColumns: "auto 1fr",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 999,
                                  background: "#def4f1",
                                  color: "#0f766d",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 12,
                                  fontWeight: 900,
                                }}
                              >
                                +
                              </span>
                              <span>{provider}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <label style={{ display: "grid", gap: 8 }}>
                        {futureFieldLabel("Visit type")}
                        <select
                          value={futureVisitDraft.visitType}
                          onChange={(event) =>
                            setFutureVisitDraft((current) => ({ ...current, visitType: event.target.value }))
                          }
                          style={{
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "0 14px",
                            color: "#152235",
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          <option value="">Select visit type</option>
                          {["Dental", "Medical", "Vision", "Lab", "Therapy"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        {futureFieldLabel("Date of visit")}
                        <input
                          type="date"
                          value={futureVisitDraft.visitDate}
                          onChange={(event) =>
                            setFutureVisitDraft((current) => ({ ...current, visitDate: event.target.value }))
                          }
                          style={{
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "0 14px",
                            color: "#152235",
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <label style={{ display: "grid", gap: 8 }}>
                        {futureFieldLabel("Paid today")}
                        <input
                          inputMode="decimal"
                          value={futureVisitDraft.paidToday}
                          onChange={(event) =>
                            setFutureVisitDraft((current) => ({ ...current, paidToday: event.target.value }))
                          }
                          style={{
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "0 14px",
                            color: "#68707d",
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                          placeholder="0.00"
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        {futureFieldLabel("Paid with")}
                        <select
                          value={futureVisitDraft.paidWith}
                          onChange={(event) =>
                            setFutureVisitDraft((current) => ({ ...current, paidWith: event.target.value }))
                          }
                          style={{
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "0 14px",
                            color: "#152235",
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          <option value="">Select payment method</option>
                          {["Personal card", "HSA card", "FSA card", "Cash", "Check"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 12,
                        alignItems: "center",
                        borderRadius: 14,
                        border: "1px solid #dbe4ef",
                        background: "#f8fbff",
                        padding: "12px 14px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={futureVisitDraft.needsReimbursement}
                        onChange={(event) =>
                          setFutureVisitDraft((current) => ({
                            ...current,
                            needsReimbursement: event.target.checked,
                          }))
                        }
                        style={{ width: 22, height: 22 }}
                      />
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ color: "#152235", fontSize: 14, fontWeight: 800 }}>
                          Need reimbursement
                        </span>
                        <span style={{ color: "#68748c", fontSize: 12, fontWeight: 600 }}>
                          Paid personally; reimburse later
                        </span>
                      </div>
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <label style={{ display: "grid", gap: 8 }}>
                        {futureFieldLabel("Insurance")}
                        <select
                          value={futureVisitDraft.insurance}
                          onChange={(event) =>
                            setFutureVisitDraft((current) => ({ ...current, insurance: event.target.value }))
                          }
                          style={{
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "0 14px",
                            color: "#152235",
                            fontSize: 15,
                            fontWeight: futureVisitDraft.insurance ? 600 : 500,
                          }}
                        >
                          <option value="">Select insurance</option>
                          <option value="GEHA">GEHA</option>
                          <option value="Aetna">Aetna</option>
                          <option value="Delta Dental">Delta Dental</option>
                          <option value="Cigna">Cigna</option>
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        {futureFieldLabel("Claim usually ready in")}
                        <select
                          value={futureVisitDraft.claimReadyIn}
                          onChange={(event) =>
                            setFutureVisitDraft((current) => ({ ...current, claimReadyIn: event.target.value }))
                          }
                          style={{
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid #dbe4ef",
                            background: "#ffffff",
                            padding: "0 14px",
                            color: "#152235",
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          {["1 week", "2 weeks", "3 weeks", "4 weeks", "6 weeks"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label style={{ display: "grid", gap: 8 }}>
                      {futureFieldLabel("Notes")}
                      <textarea
                        value={futureVisitDraft.notes}
                        onChange={(event) =>
                          setFutureVisitDraft((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder="Reason, cancellation, symptoms, or anything to remember"
                        style={{
                          minHeight: 84,
                          borderRadius: 14,
                          border: "1px solid #dbe4ef",
                          background: "#ffffff",
                          padding: "14px 16px",
                          color: "#68707d",
                          fontSize: 14,
                          fontWeight: 500,
                          resize: "vertical",
                        }}
                      />
                    </label>
                  </div>

                    <button
                    type="button"
                    onClick={handleAddVisitTracker}
                    style={{
                      borderRadius: 14,
                      border: "none",
                      background: "#152235",
                      color: "#ffffff",
                      padding: "13px 18px",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: "pointer",
                      justifySelf: "start",
                      minWidth: 180,
                    }}
                  >
                    {isSavingVisit ? "Saving..." : "Add visit tracker"}
                  </button>
                  {futureVisitStatus ? (
                    <span style={{ color: "#617086", fontSize: 14 }}>{futureVisitStatus}</span>
                  ) : null}
                </div>,
              )}

              {surface(
                <div style={{ padding: 22, display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 20 }}>Tracked visits</h3>
                    {pill(`${visitItems.length} visit${visitItems.length === 1 ? "" : "s"}`, visitItems.length ? "teal" : "slate")}
                  </div>

                  {visitItems.length ? (
                    visitItems.map((visit) => (
                      <div
                        key={String(visit.id)}
                        style={{
                          border: "1px solid #dbe4ef",
                          borderRadius: 16,
                          padding: 16,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <strong style={{ fontSize: 17 }}>
                              {String(visit.provider_name ?? visit.providerName ?? "Unknown provider")}
                            </strong>
                            <span style={{ color: "#617086", fontSize: 14 }}>
                              Visit {formatVisitDate(visit.visit_date ?? visit.visitDate)}
                            </span>
                          </div>
                          {pill(String(visit.status ?? "waiting"), "amber")}
                        </div>
                        <span style={{ color: "#617086", fontSize: 14 }}>
                          Paid {formatCurrency(parseAmount(visit.paid_amount ?? visit.paidAmount))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#617086", fontSize: 14 }}>No visits tracked yet.</div>
                  )}
                </div>,
              )}
            </div>,
          )}

          {renderView(
            "actions",
            activeView,
            surface(
              <div style={{ padding: 28, display: "grid", gap: 22 }}>
                {sectionHeading(
                  "Action Center",
                  "What still needs your attention",
                  creditReviewDraft
                    ? "Choose how you want to contact the provider, then edit the message before sending or calling."
                    : "Keep unresolved billing questions, credits to verify, and follow-up tasks in one queue.",
                )}

                {creditReviewDraft ? (
                  <div
                    data-testid="credit-review-action-draft"
                    style={{
                      border: "1px solid #b9e6df",
                      borderRadius: 20,
                      background: "#f4fbfa",
                      padding: 20,
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 5 }}>
                        <strong style={{ fontSize: 19 }}>
                          {creditReviewDraft.mode === "combined" ? "Combined credit/refund request" : "Separate credit/refund request"}
                        </strong>
                        <span style={{ color: "#385b64", lineHeight: 1.45 }}>
                          {creditReviewDraft.provider} · {creditReviewDraft.visits.length} visit{creditReviewDraft.visits.length === 1 ? "" : "s"} · {creditReviewDraft.visits.map((visit) => formatVisitDate(visit.serviceDate)).join(" · ")} · total {formatCurrency(creditReviewDraft.total)}
                        </span>
                      </div>
                      {pill(creditReviewSent ? "Sent" : "Draft", creditReviewSent ? "teal" : "amber")}
                    </div>

                    <div role="tablist" aria-label="Request communication mode" style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={communicationMode === "email"}
                        data-testid="credit-review-email-tab"
                        onClick={() => setCommunicationMode("email")}
                        style={{
                          borderRadius: 12,
                          border: communicationMode === "email" ? "1px solid #117a72" : "1px solid #dbe4ef",
                          background: communicationMode === "email" ? "#def4f1" : "#ffffff",
                          color: "#152235",
                          padding: "10px 14px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={communicationMode === "call"}
                        data-testid="credit-review-call-tab"
                        onClick={() => setCommunicationMode("call")}
                        style={{
                          borderRadius: 12,
                          border: communicationMode === "call" ? "1px solid #117a72" : "1px solid #dbe4ef",
                          background: communicationMode === "call" ? "#def4f1" : "#ffffff",
                          color: "#152235",
                          padding: "10px 14px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Call script
                      </button>
                    </div>

                    {communicationMode === "email" ? (
                      <>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ color: "#617086", fontSize: 13, fontWeight: 800 }}>To</span>
                          <input
                            data-testid="credit-review-email-to"
                            value={creditReviewDraft.emailTo}
                            placeholder="Provider billing email"
                            onChange={(event) =>
                              setCreditReviewDraft((current) => current ? { ...current, emailTo: event.target.value } : current)
                            }
                            style={{
                              height: 46,
                              borderRadius: 12,
                              border: "1px solid #cfe0e8",
                              background: "#ffffff",
                              padding: "0 14px",
                              color: "#152235",
                              fontFamily: '"SF Pro Text","Aptos","Segoe UI","Helvetica Neue",Arial,sans-serif',
                              fontSize: 16,
                            }}
                          />
                        </label>
                        {creditReviewDraft.contactSource ? (
                          <span style={{ color: "#617086", fontSize: 13, lineHeight: 1.4 }}>
                            Suggested contact from {creditReviewDraft.contactSource}. Please verify before sending.
                          </span>
                        ) : null}
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ color: "#617086", fontSize: 13, fontWeight: 800 }}>Subject</span>
                          <input
                            data-testid="credit-review-email-subject"
                            value={creditReviewDraft.emailSubject}
                            onChange={(event) =>
                              setCreditReviewDraft((current) => current ? { ...current, emailSubject: event.target.value } : current)
                            }
                            style={{
                              height: 44,
                              borderRadius: 12,
                              border: "1px solid #cfe0e8",
                              background: "#ffffff",
                              padding: "0 14px",
                              color: "#152235",
                              fontFamily: '"SF Pro Text","Aptos","Segoe UI","Helvetica Neue",Arial,sans-serif',
                              fontSize: 16,
                            }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ color: "#617086", fontSize: 13, fontWeight: 800 }}>Message</span>
                          <textarea
                            data-testid="credit-review-email-message"
                            value={creditReviewDraft.emailMessage}
                            onChange={(event) =>
                              setCreditReviewDraft((current) => current ? { ...current, emailMessage: event.target.value } : current)
                            }
                            style={{
                              minHeight: 240,
                              borderRadius: 12,
                              border: "1px solid #cfe0e8",
                              background: "#ffffff",
                              padding: "16px 18px",
                              color: "#152235",
                              fontFamily: '"SF Pro Text","Aptos","Segoe UI","Helvetica Neue",Arial,sans-serif',
                              fontSize: 16,
                              lineHeight: 1.6,
                              resize: "vertical",
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          data-testid="send-credit-review"
                          onClick={handleSendCreditReviewDraft}
                          disabled={creditReviewSent}
                          style={{
                            justifySelf: "start",
                            borderRadius: 14,
                            border: "none",
                            background: creditReviewSent ? "#91a0b5" : "#117a72",
                            color: "#ffffff",
                            padding: "13px 18px",
                            fontSize: 15,
                            fontWeight: 800,
                            cursor: creditReviewSent ? "default" : "pointer",
                          }}
                        >
                          {creditReviewSent ? "Email sent" : "Send email"}
                        </button>
                      </>
                    ) : (
                      <>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ color: "#617086", fontSize: 13, fontWeight: 800 }}>Phone</span>
                          <input
                            data-testid="credit-review-call-phone"
                            value={creditReviewDraft.phone}
                            placeholder="Provider billing phone"
                            onChange={(event) =>
                              setCreditReviewDraft((current) => current ? { ...current, phone: event.target.value } : current)
                            }
                            style={{
                              height: 46,
                              borderRadius: 12,
                              border: "1px solid #cfe0e8",
                              background: "#ffffff",
                              padding: "0 14px",
                              color: "#152235",
                              fontFamily: '"SF Pro Text","Aptos","Segoe UI","Helvetica Neue",Arial,sans-serif',
                              fontSize: 16,
                            }}
                          />
                        </label>
                        {creditReviewDraft.contactSource ? (
                          <span style={{ color: "#617086", fontSize: 13, lineHeight: 1.4 }}>
                            Suggested contact from {creditReviewDraft.contactSource}. Please verify before calling.
                          </span>
                        ) : null}
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ color: "#617086", fontSize: 13, fontWeight: 800 }}>Call script</span>
                          <textarea
                            data-testid="credit-review-call-script"
                            value={creditReviewDraft.callScript}
                            onChange={(event) =>
                              setCreditReviewDraft((current) => current ? { ...current, callScript: event.target.value } : current)
                            }
                            style={{
                              minHeight: 240,
                              borderRadius: 12,
                              border: "1px solid #cfe0e8",
                              background: "#ffffff",
                              padding: "16px 18px",
                              color: "#152235",
                              fontFamily: '"SF Pro Text","Aptos","Segoe UI","Helvetica Neue",Arial,sans-serif',
                              fontSize: 16,
                              lineHeight: 1.6,
                              resize: "vertical",
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          data-testid="copy-credit-review-script"
                          onClick={handleCopyCallScript}
                          style={{
                            justifySelf: "start",
                            borderRadius: 14,
                            border: "1px solid #117a72",
                            background: "#ffffff",
                            color: "#117a72",
                            padding: "13px 18px",
                            fontSize: 15,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Copy script
                        </button>
                        {copyStatus ? (
                          <span data-testid="copy-script-status" style={{ color: "#385b64", fontSize: 14 }}>
                            {copyStatus}
                          </span>
                        ) : null}
                      </>
                    )}
                    {actionCenterStatus ? (
                      <span data-testid="action-center-status" style={{ color: "#385b64", fontSize: 14, lineHeight: 1.45 }}>
                        {actionCenterStatus}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {!creditReviewDraft ? <div style={{ display: "grid", gap: 14 }}>
                  {reviewItems.length ? (
                    reviewItems.map((finding) => (
                      <div
                        key={String(finding.id)}
                        style={{
                          border: "1px solid #dbe4ef",
                          borderRadius: 20,
                          background: "#ffffff",
                          padding: 20,
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 19 }}>
                            {findingProviderName(finding)}
                          </strong>
                          {pill(String(finding.finding_type ?? "open").replace(/_/g, " "), "amber")}
                        </div>
                        <span style={{ color: "#617086", lineHeight: 1.5 }}>
                          {findingCardSummary(finding)}
                        </span>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {pill("Open", "slate")}
                          {pill("Needs review", "amber")}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#617086" }}>No action items yet.</div>
                  )}
                </div> : null}
              </div>,
            ),
          )}
        </div>
      </div>
    </main>
  );
}
