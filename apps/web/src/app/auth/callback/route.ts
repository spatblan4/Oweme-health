import { NextResponse } from "next/server";

import { resolveNextPath } from "@/lib/auth/callback";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = resolveNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login", url));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !user) {
      return NextResponse.redirect(new URL("/login?authError=Sign-in%20could%20not%20be%20completed.%20Please%20request%20a%20new%20magic%20link.", url));
    }

    const response = NextResponse.redirect(new URL(next, url));
    response.cookies.set("oweme-user-id", user.id, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?authError=Sign-in%20could%20not%20be%20completed.%20Please%20request%20a%20new%20magic%20link.", url));
  }
}
