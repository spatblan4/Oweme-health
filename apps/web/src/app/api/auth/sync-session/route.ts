import { NextResponse } from "next/server";

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
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
