const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function getPublicSupabaseEnv() {
  const values = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const checks = [
    ["NEXT_PUBLIC_SUPABASE_URL", values.url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", values.anonKey],
  ] as const;

  for (const [key, value] of checks) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return values as { url: string; anonKey: string };
}

export function getServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return value;
}
