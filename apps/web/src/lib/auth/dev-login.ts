import { NextResponse } from "next/server";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";

export const DEV_TEST_EMAIL = "dev-test@oweme.local";
export const DEV_TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

type GenerateLinkResult = {
  data: {
    properties?: {
      action_link?: string;
    } | null;
  } | null;
  error: { message: string } | null;
};

type DevLoginDeps = {
  generateLink: (args: {
    type: "magiclink";
    email: string;
    options: { redirectTo: string };
  }) => Promise<GenerateLinkResult>;
};

type AuthAdminUser = {
  id: string;
  email?: string | null;
};

type EnsureDevUserDeps = {
  listUsers: () => Promise<{
    data: { users?: AuthAdminUser[] | null } | null;
    error: { message: string } | null;
  }>;
  createUser: (args: {
    id: string;
    email: string;
    email_confirm: boolean;
    user_metadata?: Record<string, unknown>;
  }) => Promise<{
    data: { user?: AuthAdminUser | null } | null;
    error: { message: string } | null;
  }>;
};

export async function createDevTestAccountLink(
  origin: string,
  deps: DevLoginDeps,
) {
  const redirectTo = `${origin}/auth/callback?next=/dashboard`;
  const { data, error } = await deps.generateLink({
    type: "magiclink",
    email: DEV_TEST_EMAIL,
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    throw new Error("Dev login link was not returned by Supabase.");
  }

  return actionLink;
}

export async function ensureDevTestUser(deps: EnsureDevUserDeps) {
  const existing = await deps.listUsers();
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const users = existing.data?.users ?? [];
  const matched = users.find(
    (user) => user.id === DEV_TEST_USER_ID || user.email === DEV_TEST_EMAIL,
  );
  if (matched) {
    return matched.id;
  }

  const created = await deps.createUser({
    id: DEV_TEST_USER_ID,
    email: DEV_TEST_EMAIL,
    email_confirm: true,
    user_metadata: {
      display_name: "Dev Test User",
    },
  });

  if (created.error) {
    throw new Error(created.error.message);
  }

  const userId = created.data?.user?.id;
  if (!userId) {
    throw new Error("Dev test user was not returned by Supabase.");
  }

  return userId;
}

export function createDevLoginFallbackResponse(origin: string, userId = DEV_TEST_USER_ID) {
  const response = NextResponse.redirect(new URL("/dashboard", origin), 303);
  response.cookies.set("oweme-user-id", userId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  response.cookies.delete(DEMO_MODE_COOKIE);
  return response;
}
