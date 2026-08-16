import { createAdminSupabaseClient } from "@/lib/auth/admin";
import { DEV_TEST_USER_ID, ensureDevTestUser } from "@/lib/auth/dev-login";
import {
  parseVisitCreateInput,
  parseVisitPatchInput,
  type VisitCreateInput,
  type VisitPatchInput,
} from "@/lib/validation/visits";

type VisitRecord = Record<string, unknown>;

type ListVisitsDeps = {
  getOwnedVisits: (userId: string) => Promise<VisitRecord[]>;
};

type CreateVisitDeps = {
  randomId: () => string;
  now: () => string;
  insertVisit: (row: Record<string, unknown>) => Promise<VisitRecord>;
};

type UpdateVisitDeps = {
  now: () => string;
  patchOwnedVisit: (
    userId: string,
    visitId: string,
    patch: Record<string, unknown>,
  ) => Promise<VisitRecord | null>;
};

type DeleteVisitDeps = {
  deleteOwnedVisit: (userId: string, visitId: string) => Promise<boolean>;
};

export async function getOwnedVisits(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("user_id", userId)
    .order("visit_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load visits: ${error.message}`);
  }

  return data ?? [];
}

export async function insertVisitRow(row: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  if (process.env.NODE_ENV !== "production" && row.user_id === DEV_TEST_USER_ID) {
    await ensureDevTestUser({
      listUsers: () => supabase.auth.admin.listUsers(),
      createUser: (args) => supabase.auth.admin.createUser(args),
    });
  }
  const { data, error } = await supabase.from("visits").insert(row).select("*").single();
  if (error) {
    throw new Error(`Failed to create visit: ${error.message}`);
  }
  return data;
}

export async function patchOwnedVisitRow(
  userId: string,
  visitId: string,
  patch: Record<string, unknown>,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("visits")
    .update(patch)
    .eq("id", visitId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update visit: ${error.message}`);
  }

  return data;
}

export async function deleteOwnedVisitRow(userId: string, visitId: string) {
  const supabase = createAdminSupabaseClient();
  const { error, count } = await supabase
    .from("visits")
    .delete({ count: "exact" })
    .eq("id", visitId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete visit: ${error.message}`);
  }

  return Boolean(count);
}

export async function listVisits(
  userId: string,
  deps: ListVisitsDeps = {
    getOwnedVisits,
  },
) {
  return {
    items: await deps.getOwnedVisits(userId),
  };
}

export async function createVisit(
  userId: string,
  input: unknown,
  deps: CreateVisitDeps = {
    randomId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    insertVisit: insertVisitRow,
  },
) {
  const parsed: VisitCreateInput = parseVisitCreateInput(input);
  return deps.insertVisit({
    id: deps.randomId(),
    user_id: userId,
    provider_name: parsed.providerName,
    visit_date: parsed.visitDate,
    visit_type: parsed.visitType,
    status: parsed.status,
    insurance_name: parsed.insuranceName,
    paid_amount: parsed.paidAmount,
    payment_method: parsed.paymentMethod,
    reimbursement_needed: parsed.reimbursementNeeded ?? false,
    claim_check_after: parsed.claimCheckAfter,
    next_appointment_at: parsed.nextAppointmentAt,
    notes: parsed.notes,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
}

export async function updateVisit(
  userId: string,
  visitId: string,
  input: unknown,
  deps: UpdateVisitDeps = {
    now: () => new Date().toISOString(),
    patchOwnedVisit: patchOwnedVisitRow,
  },
) {
  const parsed: VisitPatchInput = parseVisitPatchInput(input);
  const patch: Record<string, unknown> = {
    updated_at: deps.now(),
  };

  if (parsed.providerName !== undefined) patch.provider_name = parsed.providerName;
  if (parsed.visitDate !== undefined) patch.visit_date = parsed.visitDate;
  if (parsed.visitType !== undefined) patch.visit_type = parsed.visitType;
  if (parsed.status !== undefined) patch.status = parsed.status;
  if (parsed.insuranceName !== undefined) patch.insurance_name = parsed.insuranceName;
  if (parsed.paidAmount !== undefined) patch.paid_amount = parsed.paidAmount;
  if (parsed.paymentMethod !== undefined) patch.payment_method = parsed.paymentMethod;
  if (parsed.reimbursementNeeded !== undefined) {
    patch.reimbursement_needed = parsed.reimbursementNeeded;
  }
  if (parsed.claimCheckAfter !== undefined) patch.claim_check_after = parsed.claimCheckAfter;
  if (parsed.nextAppointmentAt !== undefined) patch.next_appointment_at = parsed.nextAppointmentAt;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;

  const updated = await deps.patchOwnedVisit(userId, visitId, patch);
  if (!updated) {
    throw new Error("Visit not found");
  }
  return updated;
}

export async function deleteVisit(
  userId: string,
  visitId: string,
  deps: DeleteVisitDeps = {
    deleteOwnedVisit: deleteOwnedVisitRow,
  },
) {
  const deleted = await deps.deleteOwnedVisit(userId, visitId);
  if (!deleted) {
    throw new Error("Visit not found");
  }
}
