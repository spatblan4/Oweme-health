import { NextResponse } from "next/server";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";
import { DEV_TEST_USER_ID } from "@/lib/auth/dev-login";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const isLocalSession =
    cookieHeader.includes(`${DEMO_MODE_COOKIE}=1`) ||
    cookieHeader.includes(`oweme-user-id=${DEV_TEST_USER_ID}`);

  if (!isLocalSession) {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Sign out failed, clearing local cookies anyway.", error);
    }
  }

  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.cookies.delete("oweme-user-id");
  response.cookies.delete(DEMO_MODE_COOKIE);
  return response;
}
