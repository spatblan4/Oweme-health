import React from "react";

type DashboardShellProps = {
  jobs: Array<Record<string, unknown>>;
  visits: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
};

function sectionCard(title: string, body: string) {
  return (
    <section
      style={{
        border: "1px solid #d9e1ea",
        borderRadius: 8,
        background: "#ffffff",
        padding: 20,
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 22, color: "#152235" }}>{title}</h2>
      <p style={{ margin: 0, color: "#617086", lineHeight: 1.5 }}>{body}</p>
    </section>
  );
}

function UploadPanel() {
  return sectionCard(
    "Upload files",
    "Add claim exports, payment statements, or receipts. Uploaded files will create processing jobs in the audit queue.",
  );
}

function JobsPanel({ jobs }: { jobs: Array<Record<string, unknown>> }) {
  if (jobs.length === 0) {
    return sectionCard("Recent jobs", "No uploads yet");
  }

  return (
    <section
      style={{
        border: "1px solid #d9e1ea",
        borderRadius: 8,
        background: "#ffffff",
        padding: 20,
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 22, color: "#152235" }}>Recent jobs</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {jobs.map((job) => (
          <li
            key={String(job.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              border: "1px solid #e8edf3",
              borderRadius: 8,
            }}
          >
            <span style={{ color: "#152235" }}>{String(job.jobType ?? job.id)}</span>
            <span style={{ color: "#617086" }}>{String(job.status)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VisitsPanel({ visits }: { visits: Array<Record<string, unknown>> }) {
  if (visits.length === 0) {
    return sectionCard("Visits", "No visits yet");
  }

  return (
    <section
      style={{
        border: "1px solid #d9e1ea",
        borderRadius: 8,
        background: "#ffffff",
        padding: 20,
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 22, color: "#152235" }}>Visits</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {visits.map((visit) => (
          <li
            key={String(visit.id)}
            style={{
              padding: "10px 12px",
              border: "1px solid #e8edf3",
              borderRadius: 8,
            }}
          >
            <div style={{ color: "#152235", fontWeight: 600 }}>
              {String(visit.provider_name ?? visit.providerName ?? "Unknown provider")}
            </div>
            <div style={{ color: "#617086", marginTop: 4 }}>
              {String(visit.visit_date ?? visit.visitDate ?? "")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FindingsPanel({ findings }: { findings: Array<Record<string, unknown>> }) {
  if (findings.length === 0) {
    return sectionCard("Findings", "No findings yet");
  }

  return (
    <section
      style={{
        border: "1px solid #d9e1ea",
        borderRadius: 8,
        background: "#ffffff",
        padding: 20,
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 22, color: "#152235" }}>Findings</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {findings.map((finding) => (
          <li
            key={String(finding.id)}
            style={{
              padding: "10px 12px",
              border: "1px solid #e8edf3",
              borderRadius: 8,
            }}
          >
            <div style={{ color: "#152235", fontWeight: 600 }}>
              {String(finding.title ?? finding.finding_type ?? "Finding")}
            </div>
            <div style={{ color: "#617086", marginTop: 4 }}>
              {String(finding.finding_type ?? "")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardShell({ jobs, visits, findings }: DashboardShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        padding: 32,
        color: "#152235",
        fontFamily:
          "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 20 }}>
        <header style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#0b7a75",
              fontWeight: 700,
            }}
          >
            OweMe Health
          </div>
          <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.05 }}>Dashboard</h1>
          <p style={{ margin: 0, color: "#617086", maxWidth: 720 }}>
            A private workspace for upload processing, visit tracking, and bill audit findings.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 20,
          }}
        >
          <UploadPanel />
          <JobsPanel jobs={jobs} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          <VisitsPanel visits={visits} />
          <FindingsPanel findings={findings} />
        </div>
      </div>
    </main>
  );
}
