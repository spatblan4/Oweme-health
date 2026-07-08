import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { createServerSupabaseClient } from "@/lib/auth/server";
import { loadDashboardData } from "@/lib/dashboard/load-dashboard-data";

function normalizeDashboardView(value: string | undefined) {
  return value === "past" || value === "future" || value === "actions" ? value : "overview";
}

type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;
const emptyDashboardData = {
  jobs: [],
  visits: [],
  findings: [],
} as DashboardData;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const initialView = normalizeDashboardView(params?.view);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;
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
      initialView={initialView}
    />
  );
}
