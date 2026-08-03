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

  if (localUserId === "00000000-0000-0000-0000-000000000001") {
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
