import { NextResponse } from "next/server";

import { authErrorMessage, validateMagicLinkEmail } from "@/lib/auth/magic-link";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("code") ?? "").trim();
  const emailError = validateMagicLinkEmail(email);

  if (emailError) {
    return NextResponse.json({ message: emailError }, { status: 400 });
  }
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ message: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.verifyOtp({ email, token, type: "email" });

    if (error || !user) {
      return NextResponse.json(
        { message: authErrorMessage(error) || "That code is invalid or expired. Request a new code." },
        { status: 400 },
      );
    }

    const response = NextResponse.json({ next: "/dashboard" });
    response.cookies.set("oweme-user-id", user.id, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return NextResponse.json(
      { message: "We could not verify that code. Request a new code and try again." },
      { status: 400 },
    );
  }
}
