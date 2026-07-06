import { createServerSupabaseClient } from "@/lib/auth/server";

type FindingRecord = Record<string, unknown>;

type ListFindingsDeps = {
  getOwnedFindings: (userId: string) => Promise<FindingRecord[]>;
};

export async function getOwnedFindings(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("findings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load findings: ${error.message}`);
  }

  return data ?? [];
}

export async function listFindings(
  userId: string,
  deps: ListFindingsDeps = {
    getOwnedFindings,
  },
) {
  return {
    items: await deps.getOwnedFindings(userId),
  };
}
