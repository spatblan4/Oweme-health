import { createServerClient } from "@supabase/ssr";

import { DEMO_JUDGE_USER_ID, DEMO_MODE_COOKIE, ensureDemoUser } from "./demo-login";
import { getPublicSupabaseEnv } from "./env";

type RequestUserDeps = {
  getUserId?: (request: Request) => Promise<string | null>;
  getDemoUserId?: (request: Request) => Promise<string | null>;
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

  if (user?.id) {
    return user.id;
  }

  const demoMode = requestCookies.find((cookie) => cookie.name === DEMO_MODE_COOKIE)?.value;
  const demoUserId = requestCookies.find((cookie) => cookie.name === "oweme-user-id")?.value;
  if (demoMode === "1" && demoUserId === DEMO_JUDGE_USER_ID) {
    await ensureDemoUser();
    return DEMO_JUDGE_USER_ID;
  }

  return null;
}

export async function requireRequestUserId(
  request: Request,
  deps: RequestUserDeps = {},
) {
  const userId = await (deps.getUserId ?? getRequestUserId)(request);
  if (userId) {
    return userId;
  }

  const demoUserId = await deps.getDemoUserId?.(request);
  if (demoUserId) {
    return demoUserId;
  }

  throw new Error("Unauthorized");
}
