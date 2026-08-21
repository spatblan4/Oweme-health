import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "./admin";

export const DEMO_JUDGE_EMAIL = "demo-judge@oweme.local";
export const DEMO_JUDGE_USER_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_MODE_COOKIE = "oweme-demo-mode";

export async function ensureDemoUser() {
  const supabase = createAdminSupabaseClient();
  const existing = await supabase.auth.admin.listUsers();
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const matched = existing.data.users.find(
    (user) => user.id === DEMO_JUDGE_USER_ID || user.email === DEMO_JUDGE_EMAIL,
  );
  if (matched) {
    return matched.id;
  }

  const created = await supabase.auth.admin.createUser({
    id: DEMO_JUDGE_USER_ID,
    email: DEMO_JUDGE_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: "Judge Demo" },
  });
  if (created.error) {
    throw new Error(created.error.message);
  }

  const userId = created.data.user?.id;
  if (!userId) {
    throw new Error("Demo user was not returned by Supabase.");
  }
  return userId;
}

export function createDemoLoginResponse(origin: string) {
  const response = NextResponse.redirect(new URL("/?demoLoaded=1", origin), 303);
  response.cookies.set(DEMO_MODE_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  response.cookies.set("oweme-user-id", DEMO_JUDGE_USER_ID, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
