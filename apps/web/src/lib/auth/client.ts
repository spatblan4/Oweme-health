import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseEnv } from "./env";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}
