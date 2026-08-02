import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/auth/server";
import {
  authErrorMessage,
  magicLinkRedirectTo,
  supabaseConnectionErrorMessage,
  validateMagicLinkEmail,
} from "@/lib/auth/magic-link";

function redirectToLogin(origin: string, params: Record<string, string>) {
  const target = new URL("/login", origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      target.searchParams.set(key, value);
    }
  }
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const validationMessage = validateMagicLinkEmail(email);

  if (validationMessage) {
    return redirectToLogin(origin, {
      authError: validationMessage,
      email,
    });
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return redirectToLogin(origin, {
      authError: "Supabase environment variables are not configured yet.",
      email,
    });
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: magicLinkRedirectTo(origin),
      },
    });

    if (error) {
      return redirectToLogin(origin, {
        authError: authErrorMessage(error),
        email,
      });
    }
  } catch (error) {
    return redirectToLogin(origin, {
      authError: supabaseConnectionErrorMessage(error),
      email,
    });
  }

  return redirectToLogin(origin, {
    authMessage: "Magic link sent. Check your email to finish signing in.",
    email,
  });
}
