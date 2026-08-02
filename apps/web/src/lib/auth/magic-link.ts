export const SUPABASE_UNREACHABLE_MESSAGE =
  "Supabase auth is unavailable for the configured project. Check the Supabase project status and local credentials, then restart the web server. Judge demo remains safe to use.";
export const SUPABASE_PROJECT_UNRESOLVED_MESSAGE =
  "Supabase project URL could not be resolved. Update the local Supabase credentials or restore the Supabase project, then restart the web server.";

const MAGIC_LINK_EMAIL_REQUIRED_MESSAGE = "Enter your email to receive a magic link.";
const MAGIC_LINK_EMAIL_INVALID_MESSAGE = "Enter a valid email address.";

export function authErrorMessage(error: { message?: string } | null | undefined) {
  const message = error?.message?.trim();
  if (!message) {
    return SUPABASE_UNREACHABLE_MESSAGE;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  ) {
    return SUPABASE_UNREACHABLE_MESSAGE;
  }

  return message;
}

export function supabaseConnectionErrorMessage(error: unknown) {
  const code = nestedErrorCode(error);
  if (code === "ENOTFOUND") {
    return SUPABASE_PROJECT_UNRESOLVED_MESSAGE;
  }
  return SUPABASE_UNREACHABLE_MESSAGE;
}

export function magicLinkRedirectTo(requestOrigin: string) {
  const configuredOrigin =
    normalizedOrigin(process.env.NEXT_PUBLIC_APP_URL) ?? normalizedOrigin(process.env.APP_URL);
  const origin = configuredOrigin ?? normalizedOrigin(requestOrigin) ?? requestOrigin;
  return `${origin}/auth/callback?next=/dashboard`;
}

function nestedErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as { cause?: unknown; code?: unknown };
  if (typeof record.code === "string") {
    return record.code;
  }
  return nestedErrorCode(record.cause);
}

function normalizedOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return undefined;
  }
}

export function validateMagicLinkEmail(value: string) {
  const email = value.trim();
  if (!email) {
    return MAGIC_LINK_EMAIL_REQUIRED_MESSAGE;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return MAGIC_LINK_EMAIL_INVALID_MESSAGE;
  }
  return "";
}
