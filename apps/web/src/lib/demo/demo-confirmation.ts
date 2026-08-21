export function confirmDemoReviewFinding(
  finding: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!finding) {
    return {};
  }

  const rawDetails = finding.details;
  const details = rawDetails && typeof rawDetails === "object"
    ? (rawDetails as Record<string, unknown>)
    : {};
  const paidAmount = String(details.paid_amount ?? details.credit_amount ?? "0.00");
  const responsibilityAmount = String(details.responsibility_amount ?? "0.00");
  const paymentDate = String(details.payment_date ?? details.service_date ?? "");
  const providerName = String(details.payment_provider_name ?? details.provider_name ?? finding.provider_name ?? finding.title ?? "");
  const paymentSource = String(details.payment_source ?? details.payment_method ?? "Payment record");

  return {
    ...finding,
    finding_type: "possible_credit",
    summary: `Confirmed by you: ${paymentSource} paid ${paidAmount} for ${String(details.service_date ?? "the visit")}, but the claim says you owe ${responsibilityAmount}.`,
    details: {
      ...details,
      confirmation_source: "Confirmed by you",
      confirmed_paid_amount: paidAmount,
      confirmed_responsibility_amount: responsibilityAmount,
      confirmed_credit_amount: (Number(paidAmount) - Number(responsibilityAmount)).toFixed(2),
      confirmed_payment_ids: ["demo-stone-creek-payment"],
      confirmed_payments: [
        {
          payment_id: "demo-stone-creek-payment",
          amount: paidAmount,
          payment_date: paymentDate,
          payment_source: paymentSource,
          payment_source_label: paymentSource,
          provider_name: providerName,
        },
      ],
    },
  };
}
