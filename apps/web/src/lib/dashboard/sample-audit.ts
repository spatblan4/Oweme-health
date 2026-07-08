export function createSamplePastAuditState() {
  return {
    status: "Sample loaded. Upload real files any time to replace these demo findings.",
    selectedUploads: {
      claim: [{ name: "ClaimResults-sample.xlsx", status: "uploaded" }],
      payment: [{ name: "AppleCard-sample.csv", status: "uploaded" }],
    },
    findings: [
      {
        id: "sample-finding-1",
        provider_name: "Stone Creek Village Dentistry",
        finding_type: "possible_credit",
        title: "Stone Creek Village Dentistry",
        summary: "Paid $275.00 for Jul 4, 2026, but the claim says you owe $78.00.",
        details: { credit_amount: "197.00" },
      },
      {
        id: "sample-finding-2",
        provider_name: "Quest Diagnostics",
        finding_type: "allocation_unclear",
        title: "Quest Diagnostics",
        summary: "Claim from May 8, 2026 shows $32.40 patient responsibility, but no matching payment was found yet.",
        details: { credit_amount: "0.00" },
      },
      {
        id: "sample-finding-3",
        provider_name: "BAY AREA OSM",
        finding_type: "possible_credit",
        title: "BAY AREA OSM",
        summary: "Paid $605.20 for Feb 27, 2026, but the claim says you owe $539.60.",
        details: { credit_amount: "65.60" },
      },
    ],
  };
}
