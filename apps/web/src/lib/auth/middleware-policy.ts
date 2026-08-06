import { DEV_TEST_USER_ID } from "@/lib/auth/dev-login";

type SupabaseMiddlewareAuthArgs = {
  hostname: string;
  localUserId: string | null;
  nodeEnv: string;
  pathname: string;
};

export function shouldUseSupabaseMiddlewareAuth({
  hostname,
  localUserId,
  nodeEnv,
  pathname,
}: SupabaseMiddlewareAuthArgs) {
  if (pathname === "/auth/callback") {
    return false;
  }

  if (nodeEnv !== "production" && localUserId === DEV_TEST_USER_ID) {
    return false;
  }

  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (nodeEnv !== "production" && isLocalHost && !localUserId) {
    return false;
  }

  return true;
}

export function shouldUseDemoModeCookie(pathname: string) {
  return pathname !== "/login" && pathname !== "/auth/callback";
}
