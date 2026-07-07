export type FindingLike = {
  id?: string;
  finding_type?: string;
  title?: string;
  summary?: string;
  status?: string;
  details?: Record<string, unknown> | null;
};

export type ProviderContact = {
  name?: string;
  phone?: string | null;
  email?: string | null;
};

export type ActionDraft = {
  providerName: string;
  emailSubject: string;
  emailBody: string;
  phoneScript: string;
};

function detail(finding: FindingLike, key: string): string {
  const details = (finding.details ?? {}) as Record<string, unknown>;
  return details[key] != null ? String(details[key]) : "";
}

function moneyLabel(value: string): string {
  return value ? `$${value}` : "an amount";
}

export function buildActionDraft(
  finding: FindingLike,
  provider?: ProviderContact | null,
): ActionDraft {
  const providerName = String(
    finding.title || detail(finding, "provider_name") || "the provider",
  );
  const serviceDate = detail(finding, "service_date") || "a recent visit";
  const credit = detail(finding, "credit_amount");
  const responsibility = detail(finding, "responsibility_amount");
  const paid = detail(finding, "paid_amount");
  const findingType = String(finding.finding_type ?? "review");

  const isCredit = findingType === "possible_credit";

  const emailSubject = isCredit
    ? `Possible credit from ${providerName}`
    : `Question about billing from ${providerName}`;

  const emailBody = [
    `Hello ${providerName} billing team,`,
    ``,
    `I'm reviewing the statement for my visit on ${serviceDate}.`,
    isCredit
      ? `My records show I paid ${moneyLabel(paid)}, but the claim lists my responsibility as ${moneyLabel(responsibility)}, which suggests a possible credit of ${moneyLabel(credit)} on my account.`
      : `My records show a patient responsibility of ${moneyLabel(responsibility)} and I'd like to confirm how my payment was applied.`,
    ``,
    `Could you please verify whether a credit balance exists and, if so, how I can receive the refund?`,
    ``,
    `Thank you,`,
    `[Your name]`,
    `[Member ID / date of birth]`,
  ].join("\n");

  const phoneCallTarget = provider?.phone ? ` at ${provider.phone}` : "";
  const phoneScript = [
    `Call ${providerName}${phoneCallTarget}.`,
    ``,
    `Say: "Hi, I'm a patient and I'd like to verify the balance on my account for a visit on ${serviceDate}.`,
    isCredit
      ? `I paid ${moneyLabel(paid)} but my responsibility was ${moneyLabel(responsibility)}, so I believe there may be a credit of ${moneyLabel(credit)}."`
      : `My responsibility shows as ${moneyLabel(responsibility)} and I want to confirm how my payment was applied."`,
    ``,
    `Ask to confirm any credit balance and the refund process, and request a reference number.`,
  ].join("\n");

  return { providerName, emailSubject, emailBody, phoneScript };
}
