import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv, getServiceRoleKey } from "./env";

export function createAdminSupabaseClient() {
  const { url } = getPublicSupabaseEnv();
  const serviceRoleKey = getServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
