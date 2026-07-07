import { createAdminSupabaseClient } from "@/lib/auth/admin";

type FindingRecord = Record<string, unknown>;

type ListFindingsDeps = {
  getOwnedFindings: (userId: string) => Promise<FindingRecord[]>;
};

export async function getOwnedFindings(userId: string) {
  const supabase = createAdminSupabaseClient();
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

export async function patchOwnedFindingRow(
  userId: string,
  findingId: string,
  patch: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("findings")
    .update(patch)
    .eq("id", findingId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update finding: ${error.message}`);
  }

  return data;
}

type FindingStatus = "open" | "resolved" | "dismissed";
const FINDING_STATUSES: FindingStatus[] = ["open", "resolved", "dismissed"];

function parseFindingStatus(value: unknown): FindingStatus | null {
  return typeof value === "string" && (FINDING_STATUSES as string[]).includes(value)
    ? (value as FindingStatus)
    : null;
}

type UpdateFindingDeps = {
  now: () => string;
  patchOwnedFinding: (
    userId: string,
    findingId: string,
    patch: Record<string, unknown>,
  ) => Promise<FindingRecord | null>;
};

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

export async function updateFinding(
  userId: string,
  findingId: string,
  input: unknown,
  deps: UpdateFindingDeps = {
    now: () => new Date().toISOString(),
    patchOwnedFinding: patchOwnedFindingRow,
  },
) {
  const body = (input ?? {}) as { status?: unknown };
  const status = parseFindingStatus(body.status);
  if (!status) {
    throw new Error("Invalid finding status");
  }

  const updated = await deps.patchOwnedFinding(userId, findingId, {
    status,
    updated_at: deps.now(),
  });

  if (!updated) {
    throw new Error("Finding not found");
  }

  return updated;
}
