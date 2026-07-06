import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveAppAccess } from "@/lib/auth/access";
import { createMiddlewareSupabaseClient } from "@/lib/auth/middleware-client";

export async function middleware(request: NextRequest) {
  let userId: string | null = null;
  let response = NextResponse.next();

  try {
    const auth = createMiddlewareSupabaseClient(request);
    response = auth.response;
    const {
      data: { user },
    } = await auth.supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = request.cookies.get("oweme-user-id")?.value ?? null;
  }

  const decision = resolveAppAccess(userId, request.nextUrl.pathname);

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }

  if (userId) {
    response.cookies.set("oweme-user-id", userId, {
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
