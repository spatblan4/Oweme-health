import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicSupabaseEnv } from "./env";

export function applyResponseHeaders(
  response: NextResponse,
  headers?: Record<string, string>,
) {
  Object.entries(headers ?? {}).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

export function createMiddlewareSupabaseClient(request: NextRequest) {
  const { url, anonKey } = getPublicSupabaseEnv();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: Parameters<typeof response.cookies.set>[2];
        }>,
        headers?: Record<string, string>,
      ) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
        applyResponseHeaders(response, headers);
      },
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });

  return { supabase, response };
}
