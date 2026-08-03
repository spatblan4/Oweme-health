import { NextResponse } from "next/server";

import {
  authErrorMessage,
  magicLinkRedirectTo,
  supabaseConnectionErrorMessage,
  validateMagicLinkEmail,
} from "@/lib/auth/magic-link";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const validationMessage = validateMagicLinkEmail(email);

  if (validationMessage) {
    return NextResponse.json({ message: validationMessage }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: magicLinkRedirectTo(origin) },
    });

    if (error) {
      const message = authErrorMessage(error);
      const status = /rate limit|too many|seconds/i.test(message) ? 429 : 400;
      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Code sent. Check your email for the 6-digit code." });
  } catch (error) {
    return NextResponse.json({ message: supabaseConnectionErrorMessage(error) }, { status: 503 });
  }
}
