"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";

import {
  buildVisitCreatePayload,
  buildProviderSuggestions,
  createDefaultFutureVisitDraft,
} from "@/lib/dashboard/future-visit-draft";
import { createSamplePastAuditState } from "@/lib/dashboard/sample-audit";

type DashboardShellProps = {
  jobs: Array<Record<string, unknown>>;
  visits: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  initialView?: ViewKey;
};

type ViewKey = "overview" | "past" | "future" | "actions";

const views: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: "overview", label: "Home", icon: "⌁" },
  { key: "past", label: "Past Credits", icon: "$" },
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

  const date = new Date(value);
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

function detailText(value: unknown, fallback = "Not found yet") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function findingDetails(finding: Record<string, unknown>) {
  const raw = finding.details;
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function findingStatusTone(findingType: string) {
  if (findingType === "possible_credit") {
    return "teal" as const;
  }
  if (findingType === "unexplained_payment") {
    return "slate" as const;
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

function findingStatusLabel(finding: Record<string, unknown>) {
  const findingType = String(finding.finding_type ?? "");
  if (findingType === "possible_credit") {
    return "Likely overpaid";
  }
  if (findingType === "unexplained_payment") {
    return "Unexplained payment";
  }
  if (hasBundledPaymentCandidate(finding)) {
    return "Possible overpayment";
  }
  return "Needs review";
}

function findingEvidenceBullets(finding: Record<string, unknown>) {
  const details = findingDetails(finding);
  const bullets: string[] = [];
  const provider = detailText(details.provider_name ?? finding.provider_name, "");
  const serviceDate = detailText(details.service_date, "");
  const paidAmount = detailText(details.paid_amount, "");
  const responsibility = detailText(details.responsibility_amount, "");

  if (provider) {
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
  if (candidatePayments(finding).length > 0) {
    bullets.push("We found a larger nearby payment that may include this visit, so you may already have overpaid.");
  }
  if (!bullets.length) {
    bullets.push("This item still needs manual review because the source evidence is incomplete.");
  }
  return bullets;
}

type UploadKind = "claim" | "payment";
type UploadStatus = "uploading" | "uploaded" | "error";
type LocalUpload = {
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
                key={`${upload.name}-${upload.fileId ?? upload.status}`}
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
        onChange={(event) => onFilesSelected(event.target.files)}
        style={{
          position: "absolute",
          width: 0.1,
          height: 0.1,
          opacity: 0,
          pointerEvents: "none",
          padding: 0,
          border: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
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
}: DashboardShellProps) {
  const activeView = initialView;
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
    findings[0] ? String(findings[0].id) : null,
  );

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

  const reviewItems = findingItems.filter((finding) => String(finding.status ?? "open") !== "resolved");
  const recentVisit = visitItems[0];
  const providerSuggestions = useMemo(
    () => buildProviderSuggestions(visitItems, findingItems),
    [visitItems, findingItems],
  );
  const matchSummary = useMemo(() => {
    return {
      matchedConfidently: 0,
      needReview: findingItems.filter((finding) =>
        ["allocation_unclear", "possible_credit"].includes(String(finding.finding_type ?? "")),
      ).length,
      unexplainedPayments: findingItems.filter(
        (finding) => String(finding.finding_type ?? "") === "unexplained_payment",
      ).length,
      possibleCredits: findingItems.filter(
        (finding) => String(finding.finding_type ?? "") === "possible_credit",
      ).length,
    };
  }, [findingItems]);
  const filteredFindings = useMemo(() => {
    if (matchFilter === "review") {
      return findingItems.filter((finding) =>
        ["allocation_unclear", "possible_credit"].includes(String(finding.finding_type ?? "")),
      );
    }
    if (matchFilter === "credit") {
      return findingItems.filter((finding) => String(finding.finding_type ?? "") === "possible_credit");
    }
    if (matchFilter === "unexplained") {
      return findingItems.filter(
        (finding) => String(finding.finding_type ?? "") === "unexplained_payment",
      );
    }
    return findingItems;
  }, [findingItems, matchFilter]);
  const selectedFinding =
    filteredFindings.find((finding) => String(finding.id) === selectedFindingId) ?? filteredFindings[0] ?? null;

  function isSupportedUpload(file: File) {
    const fileName = file.name.toLowerCase();
    return (
      ACCEPTED_UPLOAD_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
      ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type)
    );
  }

  function mergeUploads(kind: UploadKind, uploads: LocalUpload[]) {
    setSelectedUploads((current) => ({ ...current, [kind]: uploads }));
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

    const supportedFiles = Array.from(files).filter(isSupportedUpload).slice(0, MAX_FILES_PER_UPLOAD);
    if (!supportedFiles.length) {
      setPastAuditStatus("Unsupported file type. Use CSV, PDF, XLS, or XLSX.");
      return;
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      setPastAuditStatus(`Only the first ${MAX_FILES_PER_UPLOAD} files were added.`);
    } else {
      setPastAuditStatus("");
    }

    const placeholders = supportedFiles.map((file) => ({
      name: file.name,
      status: "uploading",
    })) satisfies LocalUpload[];

    mergeUploads(kind, placeholders);

    const completed: LocalUpload[] = [];
    for (const file of supportedFiles) {
      try {
        const fileId = await uploadFile(kind, file);
        completed.push({
          name: file.name,
          status: "uploaded",
          fileId,
        });
      } catch (error) {
        completed.push({
          name: file.name,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }

      mergeUploads(kind, [...completed, ...placeholders.slice(completed.length)]);
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
      window.location.assign("/dashboard?view=past");
    } catch (error) {
      setPastAuditStatus(error instanceof Error ? error.message : "Failed to run audit.");
    } finally {
      setIsRunningAudit(false);
    }
  }

  function handleUseSample() {
    const sample = createSamplePastAuditState();
    setSelectedUploads({
      claim: sample.selectedUploads.claim as LocalUpload[],
      payment: sample.selectedUploads.payment as LocalUpload[],
    });
    setFindingItems(sample.findings);
    setSelectedFindingId(sample.findings[0] ? String(sample.findings[0].id) : null);
    setPastAuditStatus(sample.status);
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

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "11px 18px",
                borderRadius: 999,
                border: "1px solid #dbe4ef",
                background: "#ffffff",
                color: "#7c879e",
                fontSize: 15,
                fontWeight: 700,
                boxShadow: "0 8px 20px rgba(18, 33, 58, 0.05)",
              }}
            >
              Privacy-first prototype
            </span>
          </header>

          <section
            className="oweme-home-hero"
            style={{
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              textAlign: "center",
              gap: 22,
              paddingBottom: 56,
            }}
          >
            <div className="oweme-flow-layer oweme-flow-layer--left" aria-label="Paid now flow">
              <div
                className="oweme-flow-trail"
                style={{
                  left: "-4%",
                  top: "26%",
                  width: "30%",
                  height: 160,
                  background:
                    "linear-gradient(90deg, rgba(251, 113, 133, 0.08), rgba(248, 113, 113, 0.22), rgba(255,255,255,0))",
                  transform: "rotate(10deg)",
                  animationDuration: "10s",
                }}
              />
              <div
                className="oweme-flow-winged"
                style={{
                  left: "15%",
                  top: "18%",
                  width: 92,
                  height: 52,
                  gridTemplateColumns: "22px 1fr 22px",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span className="oweme-flow-wing oweme-flow-wing--left" />
                <span
                  className="oweme-flow-bill"
                  style={{
                    position: "relative",
                    width: 40,
                    height: 24,
                    background: "rgba(254, 202, 202, 0.5)",
                    border: "1px solid rgba(248, 113, 113, 0.34)",
                    color: "rgba(220, 38, 38, 0.84)",
                    fontSize: 13,
                    animation: "none",
                  }}
                >
                  $
                </span>
                <span className="oweme-flow-wing oweme-flow-wing--right" />
              </div>
              <div
                className="oweme-flow-token"
                style={{
                  left: "9%",
                  top: "30%",
                  width: 52,
                  height: 52,
                  background: "rgba(252, 165, 165, 0.5)",
                  border: "1px solid rgba(248, 113, 113, 0.44)",
                  color: "rgba(220, 38, 38, 0.95)",
                  fontSize: 24,
                  animation: "oweme-float-fast 6.4s ease-in-out infinite",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-token"
                style={{
                  left: "13%",
                  top: "39%",
                  width: 68,
                  height: 68,
                  background: "rgba(254, 202, 202, 0.46)",
                  border: "1px solid rgba(248, 113, 113, 0.34)",
                  color: "rgba(220, 38, 38, 0.92)",
                  fontSize: 30,
                  animation: "oweme-float-fast 7.1s ease-in-out infinite",
                  animationDelay: "-2s",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-bill"
                style={{
                  left: "19%",
                  top: "34%",
                  width: 58,
                  height: 30,
                  background: "rgba(254, 202, 202, 0.46)",
                  border: "1px solid rgba(248, 113, 113, 0.32)",
                  color: "rgba(220, 38, 38, 0.88)",
                  fontSize: 16,
                  animation: "oweme-sweep-fast 8.6s ease-in-out infinite",
                  animationDelay: "-4s",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-bill"
                style={{
                  left: "15%",
                  top: "21%",
                  width: 46,
                  height: 26,
                  background: "rgba(254, 202, 202, 0.4)",
                  border: "1px solid rgba(248, 113, 113, 0.28)",
                  color: "rgba(220, 38, 38, 0.82)",
                  fontSize: 14,
                  animation: "oweme-sweep-fast 9.4s ease-in-out infinite",
                  animationDelay: "-8s",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-star"
                style={{
                  left: "23%",
                  top: "43%",
                  width: 12,
                  height: 12,
                  background: "rgba(248, 113, 113, 0.34)",
                  animationDelay: "-1s",
                }}
              />
              <div
                className="oweme-flow-star"
                style={{
                  left: "10%",
                  top: "22%",
                  width: 10,
                  height: 10,
                  background: "rgba(251, 146, 60, 0.34)",
                  animationDelay: "-2.4s",
                }}
              />
            </div>

            <div className="oweme-flow-layer" aria-label="Claim processing orbit">
              <div
                className="oweme-flow-orbit"
                style={{
                  width: 136,
                  height: 136,
                  top: "23%",
                  left: "45%",
                  border: "1.5px solid rgba(22, 163, 148, 0.13)",
                  animationDuration: "24s",
                }}
              />
              <div
                className="oweme-flow-star"
                style={{
                  left: "48.5%",
                  top: "27%",
                  width: 12,
                  height: 12,
                  background: "rgba(45, 212, 191, 0.22)",
                }}
              />
            </div>

            <div className="oweme-flow-layer oweme-flow-layer--right" aria-label="Credit return flow">
              <div
                className="oweme-flow-trail"
                style={{
                  right: "-3%",
                  top: "24%",
                  width: "32%",
                  height: 168,
                  background:
                    "linear-gradient(270deg, rgba(74, 222, 128, 0.08), rgba(74, 222, 128, 0.22), rgba(255,255,255,0))",
                  transform: "rotate(-10deg)",
                  animationDuration: "15s",
                  animationDelay: "-2.5s",
                }}
              />
              <div
                className="oweme-flow-token"
                style={{
                  right: "12%",
                  top: "30%",
                  width: 60,
                  height: 60,
                  background: "rgba(187, 247, 208, 0.5)",
                  border: "1px solid rgba(74, 222, 128, 0.38)",
                  color: "rgba(22, 163, 74, 0.96)",
                  fontSize: 28,
                  animation: "oweme-float-gentle 9.4s ease-in-out infinite",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-bag"
                style={{
                  right: "18%",
                  top: "38%",
                  width: 72,
                  height: 78,
                  background: "rgba(134, 239, 172, 0.52)",
                  border: "1px solid rgba(74, 222, 128, 0.28)",
                  color: "rgba(22, 163, 74, 0.9)",
                  fontSize: 36,
                }}
              >
                $
              </div>
              <div
                style={{
                  position: "absolute",
                  right: "20.2%",
                  top: "35.5%",
                  width: 32,
                  height: 18,
                  borderRadius: "50% 50% 34% 34%",
                  background: "rgba(110, 231, 183, 0.48)",
                  border: "1px solid rgba(74, 222, 128, 0.22)",
                  transform: "rotate(-2deg)",
                }}
              />
              <div
                className="oweme-flow-token"
                style={{
                  right: "27%",
                  top: "27%",
                  width: 56,
                  height: 28,
                  background: "rgba(187, 247, 208, 0.44)",
                  border: "1px solid rgba(74, 222, 128, 0.32)",
                  color: "rgba(22, 163, 74, 0.9)",
                  fontSize: 16,
                  animation: "oweme-sweep-gentle 13.5s ease-in-out infinite",
                  animationDelay: "-6s",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-bill"
                style={{
                  right: "19%",
                  top: "45%",
                  width: 46,
                  height: 24,
                  background: "rgba(220, 252, 231, 0.4)",
                  border: "1px solid rgba(74, 222, 128, 0.28)",
                  color: "rgba(22, 163, 74, 0.82)",
                  fontSize: 13,
                  animation: "oweme-sweep-gentle 14.4s ease-in-out infinite",
                  animationDelay: "-8s",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-token"
                style={{
                  right: "8%",
                  top: "41%",
                  width: 58,
                  height: 58,
                  background: "rgba(220, 252, 231, 0.46)",
                  border: "1px solid rgba(74, 222, 128, 0.3)",
                  color: "rgba(22, 163, 74, 0.92)",
                  fontSize: 26,
                  animation: "oweme-float-gentle 10.2s ease-in-out infinite",
                  animationDelay: "-4.4s",
                }}
              >
                $
              </div>
              <div
                className="oweme-flow-star"
                style={{
                  right: "10%",
                  top: "24%",
                  width: 14,
                  height: 14,
                  background: "rgba(74, 222, 128, 0.34)",
                  animationDelay: "-1.5s",
                }}
              />
              <div
                className="oweme-flow-star"
                style={{
                  right: "24%",
                  top: "20%",
                  width: 12,
                  height: 12,
                  background: "rgba(34, 197, 94, 0.28)",
                  animationDelay: "-3s",
                }}
              />
            </div>

            <p
              style={{
                margin: 0,
                color: "#0b7a75",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.02em",
              }}
            >
              Medical credits can hide in plain sight
            </p>

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
              Who still owes you?
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 860,
                color: "#667085",
                fontSize: 20,
                lineHeight: 1.5,
              }}
            >
              Medical bills settle weeks after you pay. OweMe helps you find provider credits and
              remember when to check claims.
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <Link
                href="/dashboard?view=past"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  border: "none",
                  background: "#152235",
                  color: "#ffffff",
                  padding: "18px 32px",
                  minWidth: 228,
                  fontWeight: 700,
                  fontSize: 18,
                  cursor: "pointer",
                  boxShadow: "0 14px 28px rgba(18, 33, 58, 0.14)",
                  textDecoration: "none",
                }}
              >
                Check past bills
              </Link>
              <Link
                href="/dashboard?view=future"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  border: "1px solid #dbe4ef",
                  background: "#ffffff",
                  color: "#152235",
                  padding: "18px 32px",
                  minWidth: 228,
                  fontWeight: 700,
                  fontSize: 18,
                  cursor: "pointer",
                  boxShadow: "0 14px 28px rgba(18, 33, 58, 0.05)",
                  textDecoration: "none",
                }}
              >
                Track a new visit
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

            <p style={{ margin: 0, color: "#98a2b3", fontSize: 15 }}>
              No account. No bank connection. No insurance API.
            </p>
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
          {renderView(
            "overview",
            activeView,
            surface(
              <div style={{ padding: 32, display: "grid", gap: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
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
                      Medical credits can hide in plain sight
                    </p>
                    <h1 style={{ margin: 0, fontSize: 56, lineHeight: 0.96, color: "#152235" }}>
                      Who still owes you?
                    </h1>
                    <p style={{ margin: 0, color: "#617086", fontSize: 19, lineHeight: 1.55 }}>
                      Medical bills settle weeks after you pay. OweMe helps you find provider
                      credits and remember when to check claims.
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
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 18,
                      border: "none",
                      background: "#152235",
                      color: "#ffffff",
                      padding: "16px 22px",
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    Check past bills
                  </Link>
                  <Link
                    href="/dashboard?view=future"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 18,
                      border: "1px solid #d9e3ef",
                      background: "#ffffff",
                      color: "#152235",
                      padding: "16px 22px",
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    Track a new visit
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
                    "Past Credits",
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
                        <button
                      type="button"
                      style={{
                        borderRadius: 18,
                        border: "1px solid #dbe4ef",
                        background: "#ffffff",
                        color: "#152235",
                        padding: "16px 24px",
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                      onClick={handleUseSample}
                    >
                      Use sample
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
                      padding: 20,
                      display: "grid",
                      gap: 14,
                      background: "#fbfdff",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: 18 }}>Manual fallback</strong>
                      <span style={{ color: "#617086" }}>
                        Add one row per EOB amount or allocated payment when a PDF needs OCR.
                      </span>
                    </div>
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
                  </div>
                </div>,
              )}

              {surface(
                <div style={{ padding: 28, display: "grid", gap: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 8 }}>
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
                        Audit result
                      </p>
                      <h3 style={{ margin: 0, fontSize: 46, lineHeight: 1, color: "#152235" }}>
                        <span style={{ color: "#117a72" }}>{formatCurrency(totalPossibleCredit)}</span> possible
                        {" "}credits found
                      </h3>
                      <p style={{ margin: 0, color: "#617086", fontSize: 16 }}>
                        {findingItems.length
                          ? `${findingItems.length} review item${findingItems.length === 1 ? "" : "s"} currently tracked.`
                          : "Run an audit to see possible provider credits."}
                      </p>
                    </div>
                    <Link
                      href="/dashboard?view=actions"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        borderRadius: 18,
                        border: "none",
                        background: "#117a72",
                        color: "#ffffff",
                        padding: "16px 22px",
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: "pointer",
                        textDecoration: "none",
                      }}
                    >
                      Review next steps
                    </Link>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
                    {[
                      ["Matched confidently", matchSummary.matchedConfidently, "#0f766d", "#def4f1"],
                      ["Need review", matchSummary.needReview, "#b56411", "#fff1df"],
                      ["Unexplained payments", matchSummary.unexplainedPayments, "#64748b", "#f3f6fb"],
                      ["Possible credits", matchSummary.possibleCredits, "#0f766d", "#e8fbf6"],
                    ].map(([label, value, color, background]) => (
                      <div
                        key={String(label)}
                        style={{
                          borderRadius: 18,
                          border: "1px solid #dbe4ef",
                          background: "#ffffff",
                          padding: 18,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <span style={{ color: "#617086", fontSize: 13, fontWeight: 700 }}>{label}</span>
                        <strong style={{ fontSize: 30, lineHeight: 1, color: String(color) }}>{value}</strong>
                        <span
                          style={{
                            display: "inline-flex",
                            width: "fit-content",
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: String(background),
                            color: String(color),
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          current run
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      ["all", "All"],
                      ["review", "Need review"],
                      ["credit", "Possible credits"],
                      ["unexplained", "Unexplained payments"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMatchFilter(key as MatchFilterKey)}
                        style={{
                          borderRadius: 999,
                          border: matchFilter === key ? "1px solid #117a72" : "1px solid #dbe4ef",
                          background: matchFilter === key ? "#def4f1" : "#ffffff",
                          color: matchFilter === key ? "#0f766d" : "#617086",
                          padding: "10px 14px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 18, alignItems: "start" }}>
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

                            return (
                              <button
                                key={String(finding.id)}
                                type="button"
                                onClick={() => setSelectedFindingId(String(finding.id))}
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
                                      {detailText(
                                        details.provider_name ?? finding.provider_name ?? finding.title,
                                        "Provider under review",
                                      )}
                                    </strong>
                                    <span style={{ color: "#617086", fontSize: 14 }}>
                                      Visit {detailText(details.service_date, "date not recorded")}
                                    </span>
                                  </div>
                                  {pill(findingStatusLabel(finding), findingStatusTone(findingType))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>EOB says you owe</span>
                                    <strong style={{ fontSize: 16 }}>{detailText(details.responsibility_amount, "--")}</strong>
                                  </div>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>Paid amount found</span>
                                    <strong style={{ fontSize: 16 }}>{detailText(details.paid_amount, "--")}</strong>
                                  </div>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <span style={{ color: "#7b879b", fontSize: 12, fontWeight: 700 }}>System read</span>
                                    <strong style={{ fontSize: 16 }}>{findingStatusLabel(finding)}</strong>
                                  </div>
                                </div>
                                <span style={{ color: "#617086", lineHeight: 1.5 }}>
                                  {String(finding.summary ?? "Review this item and confirm whether action is needed.")}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div style={{ color: "#617086" }}>No findings in this filter yet.</div>
                        )}
                      </div>,
                    )}

                    {surface(
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
                          <h3 style={{ margin: 0, fontSize: 22 }}>Match evidence</h3>
                        </div>
                        {selectedFinding ? (
                          <>
                            <div style={{ display: "grid", gap: 12 }}>
                              <div style={{ borderRadius: 18, border: "1px solid #e3ebf4", padding: 16, display: "grid", gap: 8 }}>
                                <strong style={{ fontSize: 16 }}>Claim / EOB</strong>
                                <span style={{ color: "#617086" }}>
                                  Provider: {detailText(findingDetails(selectedFinding).provider_name ?? selectedFinding.provider_name)}
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
                                  Payment source: {detailText(findingDetails(selectedFinding).payment_source, "Card / receipt / manual entry pending")}
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
                                <strong style={{ fontSize: 16 }}>Closest payment candidates</strong>
                                <div style={{ display: "grid", gap: 10 }}>
                                  {candidatePayments(selectedFinding).map((candidate) => (
                                    <div
                                      key={String(candidate.payment_id ?? candidate.provider_name ?? candidate.amount)}
                                      style={{
                                        borderRadius: 14,
                                        background: "#fbfdff",
                                        border: "1px solid #e8eef6",
                                        padding: 14,
                                        display: "grid",
                                        gap: 6,
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                        <strong style={{ fontSize: 15, color: "#152235" }}>
                                          {detailText(candidate.provider_name, "Provider candidate")}
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
                                          {detailText(candidate.match_hint, "Candidate")}
                                        </span>
                                      </div>
                                      <span style={{ color: "#617086" }}>
                                        Paid {detailText(candidate.amount)} on {detailText(candidate.payment_date, "date unknown")}
                                      </span>
                                      <span style={{ color: "#617086" }}>
                                        Source: {detailText(candidate.payment_source, "Card / receipt line item")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div style={{ display: "grid", gap: 10 }}>
                              <button
                                type="button"
                                style={{
                                  borderRadius: 16,
                                  border: "none",
                                  background: "#152235",
                                  color: "#ffffff",
                                  padding: "14px 16px",
                                  fontSize: 15,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Confirm match
                              </button>
                              <button
                                type="button"
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
                                Not the same visit
                              </button>
                              <button
                                type="button"
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
                                Add receipt or payment
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ color: "#617086" }}>Select a finding to review its evidence.</div>
                        )}
                      </div>,
                    )}
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
                    <label style={{ display: "grid", gap: 8 }}>
                      {futureFieldLabel("Provider or clinic")}
                      <input
                        value={futureVisitDraft.provider}
                        list="provider-suggestions"
                        onChange={(event) =>
                          setFutureVisitDraft((current) => ({ ...current, provider: event.target.value }))
                        }
                        placeholder="Start typing a clinic or provider name"
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
                      <datalist id="provider-suggestions">
                        {providerSuggestions.map((provider) => (
                          <option key={provider} value={provider} />
                        ))}
                      </datalist>
                    </label>

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
                  "Keep unresolved billing questions, credits to verify, and follow-up tasks in one queue.",
                )}

                <div style={{ display: "grid", gap: 14 }}>
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
                            {String(finding.title ?? "Review item")}
                          </strong>
                          {pill(String(finding.finding_type ?? "open").replace(/_/g, " "), "amber")}
                        </div>
                        <span style={{ color: "#617086", lineHeight: 1.5 }}>
                          {String(
                            finding.summary ??
                              "Check whether this item needs a refund request, clarification call, or manual correction.",
                          )}
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
                </div>
              </div>,
            ),
          )}
        </div>
      </div>
    </main>
  );
}
