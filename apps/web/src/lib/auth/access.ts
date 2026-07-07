export type AccessDecision =
  | { action: "allow" }
  | { action: "redirect"; location: string };

const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

export function resolveAppAccess(
  userId: string | null,
  pathname: string,
): AccessDecision {
  const normalizedPath = pathname === "/" ? "/dashboard" : pathname;

  if (!userId && !PUBLIC_PATHS.has(normalizedPath)) {
    return { action: "redirect", location: "/login" };
  }

  if (userId && normalizedPath === "/login") {
    return { action: "redirect", location: "/dashboard" };
  }

  return { action: "allow" };
}
