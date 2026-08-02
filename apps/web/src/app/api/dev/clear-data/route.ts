import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/auth/server";
import { clearDevTestData } from "@/lib/dev/clear-dev-data";

function appendFlashParam(nextPath: string) {
  const target = new URL(nextPath, "http://localhost");
  target.searchParams.set("devDataCleared", "1");
  return `${target.pathname}${target.search}`;
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const nextPath = String(formData.get("next") || "/dashboard");

    await clearDevTestData({
      userId: user.id,
      email: user.email ?? null,
    });

    return NextResponse.redirect(new URL(appendFlashParam(nextPath), origin), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
