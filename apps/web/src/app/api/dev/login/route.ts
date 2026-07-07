import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/auth/admin";
import {
  createDevLoginFallbackResponse,
  createDevTestAccountLink,
  ensureDevTestUser,
} from "@/lib/auth/dev-login";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  try {
    const supabase = createAdminSupabaseClient();
    const actionLink = await createDevTestAccountLink(origin, {
      generateLink: (args) => supabase.auth.admin.generateLink(args),
    });
    return NextResponse.redirect(actionLink, 303);
  } catch {
    const supabase = createAdminSupabaseClient();
    const userId = await ensureDevTestUser({
      listUsers: () => supabase.auth.admin.listUsers(),
      createUser: (args) => supabase.auth.admin.createUser(args),
    });
    return createDevLoginFallbackResponse(origin, userId);
  }
}
