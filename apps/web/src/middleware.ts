import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveAppAccess } from "@/lib/auth/access";
import { DEMO_JUDGE_USER_ID, DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";
import { DEV_TEST_USER_ID } from "@/lib/auth/dev-login";
import { createMiddlewareSupabaseClient } from "@/lib/auth/middleware-client";
import { shouldUseDemoModeCookie, shouldUseSupabaseMiddlewareAuth } from "@/lib/auth/middleware-policy";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const localUserId = request.cookies.get("oweme-user-id")?.value ?? null;
  let userId: string | null = null;
  if (request.cookies.get(DEMO_MODE_COOKIE)?.value === "1" && shouldUseDemoModeCookie(pathname)) {
    userId = DEMO_JUDGE_USER_ID;
  } else if (localUserId === DEV_TEST_USER_ID) {
    userId = DEV_TEST_USER_ID;
  }
  let response = NextResponse.next();

  if (
    !userId &&
    shouldUseSupabaseMiddlewareAuth({
      hostname: request.nextUrl.hostname,
      localUserId,
      nodeEnv: process.env.NODE_ENV,
      pathname,
    })
  ) {
    try {
      const auth = createMiddlewareSupabaseClient(request);
      response = auth.response;
      const {
        data: { user },
      } = await auth.supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = localUserId;
    }
  }

  const decision = resolveAppAccess(userId, request.nextUrl.pathname);

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }

  if (userId) {
    response.cookies.set("oweme-user-id", userId, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  } else {
    response.cookies.delete("oweme-user-id");
  }

  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/auth/callback"],
};
