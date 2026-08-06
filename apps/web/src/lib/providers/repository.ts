import { createAdminSupabaseClient } from "@/lib/auth/admin";
import { DEV_TEST_USER_ID, ensureDevTestUser } from "@/lib/auth/dev-login";
import { normalizeProviderName } from "@/lib/providers/normalize";
import {
  parseProviderInput,
  parseProviderPatchInput,
  type ProviderInput,
  type ProviderPatchInput,
} from "@/lib/validation/providers";

type ProviderRecord = Record<string, unknown>;

type ListProvidersDeps = {
  getOwnedProviders: (userId: string) => Promise<ProviderRecord[]>;
};

type UpsertProviderDeps = {
  now: () => string;
  randomId: () => string;
  findOwnedByName: (userId: string, nameNormalized: string) => Promise<ProviderRecord | null>;
  insertProvider: (row: Record<string, unknown>) => Promise<ProviderRecord>;
  patchOwnedProvider: (
    userId: string,
    providerId: string,
    patch: Record<string, unknown>,
  ) => Promise<ProviderRecord | null>;
};

type UpdateProviderDeps = {
  now: () => string;
  patchOwnedProvider: (
    userId: string,
    providerId: string,
    patch: Record<string, unknown>,
  ) => Promise<ProviderRecord | null>;
};

export async function getOwnedProviders(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load providers: ${error.message}`);
  }

  return data ?? [];
}

export async function findOwnedProviderByName(
  userId: string,
  nameNormalized: string,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", userId)
    .eq("name_normalized", nameNormalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find provider: ${error.message}`);
  }

  return data;
}

export async function insertProviderRow(row: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  if (process.env.NODE_ENV !== "production" && row.user_id === DEV_TEST_USER_ID) {
    await ensureDevTestUser({
      listUsers: () => supabase.auth.admin.listUsers(),
      createUser: (args) => supabase.auth.admin.createUser(args),
    });
  }
  const { data, error } = await supabase.from("providers").insert(row).select("*").single();
  if (error) {
    throw new Error(`Failed to create provider: ${error.message}`);
  }
  return data;
}

export async function patchOwnedProviderRow(
  userId: string,
  providerId: string,
  patch: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("providers")
    .update(patch)
    .eq("id", providerId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update provider: ${error.message}`);
  }

  return data;
}

export async function listProviders(
  userId: string,
  deps: ListProvidersDeps = {
    getOwnedProviders,
  },
) {
  return {
    items: await deps.getOwnedProviders(userId),
  };
}

function providerRowFromInput(
  userId: string,
  input: ProviderInput,
  now: string,
  randomId: () => string,
) {
  return {
    id: randomId(),
    user_id: userId,
    name: input.name,
    name_normalized: normalizeProviderName(input.name),
    phone: input.phone ?? null,
    email: input.email ?? null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };
}

export async function upsertProvider(
  userId: string,
  input: unknown,
  deps: UpsertProviderDeps = {
    now: () => new Date().toISOString(),
    randomId: () => crypto.randomUUID(),
    findOwnedByName: findOwnedProviderByName,
    insertProvider: insertProviderRow,
    patchOwnedProvider: patchOwnedProviderRow,
  },
) {
  const parsed = parseProviderInput(input);
  const nameNormalized = normalizeProviderName(parsed.name);
  const existing = await deps.findOwnedByName(userId, nameNormalized);

  if (existing) {
    const patch: Record<string, unknown> = {
      name: parsed.name,
      name_normalized: nameNormalized,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      notes: parsed.notes ?? null,
      updated_at: deps.now(),
    };
    const updated = await deps.patchOwnedProvider(userId, String(existing.id), patch);
    if (!updated) {
      throw new Error("Provider not found");
    }
    return updated;
  }

  const now = deps.now();
  const row = providerRowFromInput(userId, parsed, now, deps.randomId);
  return deps.insertProvider(row);
}

export async function updateProvider(
  userId: string,
  providerId: string,
  input: unknown,
  deps: UpdateProviderDeps = {
    now: () => new Date().toISOString(),
    patchOwnedProvider: patchOwnedProviderRow,
  },
) {
  const parsed: ProviderPatchInput = parseProviderPatchInput(input);
  const patch: Record<string, unknown> = {
    updated_at: deps.now(),
  };

  if (parsed.name !== undefined) {
    patch.name = parsed.name;
    patch.name_normalized = normalizeProviderName(parsed.name);
  }
  if (parsed.phone !== undefined) patch.phone = parsed.phone;
  if (parsed.email !== undefined) patch.email = parsed.email;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;

  const updated = await deps.patchOwnedProvider(userId, providerId, patch);
  if (!updated) {
    throw new Error("Provider not found");
  }
  return updated;
}
