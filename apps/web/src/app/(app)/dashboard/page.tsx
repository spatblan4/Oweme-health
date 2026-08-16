import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import React from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { DEMO_JUDGE_EMAIL, DEMO_JUDGE_USER_ID, DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";
import { DEV_TEST_EMAIL, DEV_TEST_USER_ID } from "@/lib/auth/dev-login";
import { createServerSupabaseClient } from "@/lib/auth/server";
import { loadDashboardData } from "@/lib/dashboard/load-dashboard-data";
import { loadSyntheticDashboardData } from "@/lib/demo/synthetic-dashboard-data";

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
  searchParams?: Promise<{ view?: string; auditComplete?: string; devDataCleared?: string }>;
}) {
  const params = await searchParams;
  const initialView = normalizeDashboardView(params?.view);
  const flashMessage =
    params?.auditComplete === "1"
      ? "Audit complete. Results refreshed."
      : params?.devDataCleared === "1"
        ? "Dev test data cleared."
        : undefined;
  const cookieStore = await cookies();
  const isDemoMode = cookieStore.get(DEMO_MODE_COOKIE)?.value === "1";
  const isLocalDevMode = cookieStore.get("oweme-user-id")?.value === DEV_TEST_USER_ID;

  let user: { id: string; email?: string | null } | null = null;
  if (isLocalDevMode) {
    user = {
      id: DEV_TEST_USER_ID,
      email: DEV_TEST_EMAIL,
    };
  } else {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();
      user = supabaseUser;
    } catch (error) {
      console.warn("Dashboard auth check failed; trying local dev fallback.", error);
    }
  }

  const hasRealSignedInUser = Boolean(user && user.id !== DEMO_JUDGE_USER_ID);
  if (isDemoMode && !hasRealSignedInUser) {
    return (
      <DashboardShell
        jobs={[]}
        visits={[]}
        findings={[]}
        initialView={initialView}
        flashMessage={flashMessage}
        pastAuditComplete={false}
        currentUser={{
          id: DEMO_JUDGE_USER_ID,
          email: DEMO_JUDGE_EMAIL,
          isDevTest: false,
          isDemo: true,
        }}
      />
    );
  }

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;
  let data: DashboardData = emptyDashboardData;
  if (!isLocalDevMode) {
    try {
      data = await loadDashboardData(userId);
    } catch (error) {
      console.warn("Dashboard data load failed; falling back to empty state.", error);
    }
  }
  return (
    <DashboardShell
      jobs={data.jobs}
      visits={data.visits}
      findings={data.findings}
      initialView={initialView}
      flashMessage={flashMessage}
      pastAuditComplete={params?.auditComplete === "1"}
      currentUser={{
        id: userId,
        email: user.email ?? null,
        isDevTest: user.email === DEV_TEST_EMAIL,
        isDemo: false,
      }}
    />
  );
}
