import { createServerClient } from "@supabase/ssr";

import { getPublicSupabaseEnv } from "./env";

type RequestUserDeps = {
  getUserId?: (request: Request) => Promise<string | null>;
};

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const separatorIndex = chunk.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }

      return {
        name: decodeURIComponent(chunk.slice(0, separatorIndex).trim()),
        value: decodeURIComponent(chunk.slice(separatorIndex + 1).trim()),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } => cookie !== null);
}

async function getRequestUserId(request: Request) {
  const { url, anonKey } = getPublicSupabaseEnv();
  const requestCookies = parseCookieHeader(request.headers.get("cookie"));

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => requestCookies,
      setAll: () => {},
    },
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function requireRequestUserId(
  request: Request,
  deps: RequestUserDeps = {},
) {
  const userId = await (deps.getUserId ?? getRequestUserId)(request);
  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}
