import { cookies } from "next/headers";

import { DashboardShell } from "@/components/dashboard-shell";
import { loadDashboardData } from "@/lib/dashboard/load-dashboard-data";

function normalizeDashboardView(value: string | undefined) {
  return value === "past" || value === "future" || value === "actions" ? value : "overview";
}

type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;
const emptyDashboardData = {
  jobs: [],
  visits: [],
  findings: [],
  providers: [],
} as DashboardData;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("oweme-user-id")?.value;
  const params = await searchParams;
  const initialView = normalizeDashboardView(params?.view);

  if (!userId) {
    return (
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[]}
        providers={[]}
        initialView={initialView}
      />
    );
  }

  let data: DashboardData = emptyDashboardData;
  try {
    data = await loadDashboardData(userId);
  } catch (error) {
    console.warn("Dashboard data load failed; falling back to empty state.", error);
  }
  return (
    <DashboardShell
      jobs={data.jobs}
      visits={data.visits}
      findings={data.findings}
      providers={data.providers}
      initialView={initialView}
    />
  );
}
