import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DEMO_JUDGE_EMAIL, DEMO_JUDGE_USER_ID, DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getUser: vi.fn(),
  loadDashboardData: vi.fn(),
  loadSyntheticDashboardData: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  }),
}));

vi.mock("@/lib/auth/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

vi.mock("@/lib/dashboard/load-dashboard-data", () => ({
  loadDashboardData: mocks.loadDashboardData,
}));

vi.mock("@/lib/demo/synthetic-dashboard-data", () => ({
  loadSyntheticDashboardData: mocks.loadSyntheticDashboardData,
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("uses real signed-in findings instead of demo data when a stale demo cookie remains", async () => {
    mocks.cookies.mockResolvedValueOnce({
      get: (name: string) =>
        name === DEMO_MODE_COOKIE
          ? { value: "1" }
          : name === "oweme-user-id"
            ? { value: "11111111-1111-1111-1111-111111111111" }
            : undefined,
    });
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "personal-user-1",
          email: "me@example.com",
        },
      },
    });
    mocks.loadDashboardData.mockResolvedValueOnce({
      jobs: [],
      visits: [],
      findings: [{ id: "real-finding-1", title: "Real audit result" }],
    });
    mocks.loadSyntheticDashboardData.mockReturnValueOnce({
      jobs: [],
      visits: [],
      findings: [{ id: "demo-finding-1", title: "Demo audit result" }],
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({ view: "past", auditComplete: "1" }),
    });

    expect(page.props.currentUser).toEqual({
      id: "personal-user-1",
      email: "me@example.com",
      isDevTest: false,
      isDemo: false,
    });
    expect(page.props.findings).toEqual([{ id: "real-finding-1", title: "Real audit result" }]);
    expect(page.props.flashMessage).toBe("Audit complete. Results refreshed.");
    expect(mocks.loadSyntheticDashboardData).not.toHaveBeenCalled();
  });

  it("keeps judge demo on the upload-first state even when auditComplete is present", async () => {
    mocks.cookies.mockResolvedValueOnce({
      get: (name: string) =>
        name === DEMO_MODE_COOKIE
          ? { value: "1" }
          : name === "oweme-user-id"
            ? { value: DEMO_JUDGE_USER_ID }
            : undefined,
    });
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: null,
      },
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({ view: "past", auditComplete: "1" }),
    });

    expect(page.props.currentUser).toEqual({
      id: DEMO_JUDGE_USER_ID,
      email: DEMO_JUDGE_EMAIL,
      isDevTest: false,
      isDemo: true,
    });
    expect(page.props.findings).toEqual([]);
    expect(page.props.jobs).toEqual([]);
    expect(page.props.visits).toEqual([]);
    expect(page.props.pastAuditComplete).toBe(false);
    expect(mocks.loadSyntheticDashboardData).not.toHaveBeenCalled();
  });
});
