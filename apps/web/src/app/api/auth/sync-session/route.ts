import { NextResponse } from "next/server";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.json({ userId: user.id });
    response.cookies.set("oweme-user-id", user.id, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
    response.cookies.delete(DEMO_MODE_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
