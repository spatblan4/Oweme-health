import { cookies } from "next/headers";

import { DashboardShell } from "@/components/dashboard-shell";
import { loadDashboardData } from "@/lib/dashboard/load-dashboard-data";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("oweme-user-id")?.value;

  if (!userId) {
    return <DashboardShell jobs={[]} visits={[]} findings={[]} />;
  }

  const data = await loadDashboardData(userId);
  return <DashboardShell jobs={data.jobs} visits={data.visits} findings={data.findings} />;
}
