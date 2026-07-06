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
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL(next, url));
  } catch {
    return NextResponse.redirect(new URL("/login", url));
  }
}
