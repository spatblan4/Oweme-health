import { createAdminSupabaseClient } from "@/lib/auth/admin";
import { z } from "zod";

type FindingRecord = Record<string, unknown>;

type ListFindingsDeps = {
  getOwnedFindings: (userId: string) => Promise<FindingRecord[]>;
};

type FindingActionDeps = {
  getOwnedFinding: (userId: string, findingId: string) => Promise<FindingRecord | null>;
  patchOwnedFinding: (
    userId: string,
    findingId: string,
    patch: Record<string, unknown>,
  ) => Promise<FindingRecord | null>;
  insertManualAdjustment: (row: Record<string, unknown>) => Promise<void>;
  now: () => string;
};

const findingActionSchema = z.object({
  action: z.enum(["confirm_match", "not_same_visit", "add_receipt_or_payment", "request_credit_refund"]),
});

type FindingActionInput = z.infer<typeof findingActionSchema>;

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

export async function getOwnedFinding(userId: string, findingId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("findings")
    .select("*")
    .eq("user_id", userId)
    .eq("id", findingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load finding: ${error.message}`);
  }

  return data;
}

function paymentSourceLabelFromFileName(originalName: unknown, paymentSource: unknown) {
  const fileName = typeof originalName === "string" ? originalName.trim() : "";
  if (fileName) {
    const baseName = fileName
      .split("/")
      .pop()!
      .replace(/\.[A-Za-z0-9]+$/, "")
      .replace(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-/i, "")
      .replace(/_+/g, " ")
      .replace(/\b(transactions?|statement|activity|export|download)\b.*$/i, "")
      .trim()
      .replace(/[-\s]+$/g, "");

    if (baseName) {
      return baseName;
    }
  }

  const source = typeof paymentSource === "string" ? paymentSource.trim() : "";
  if (!source) {
    return "Card / receipt line item";
  }
  if (/purchase|card|credit|debit/i.test(source)) {
    return "Card purchase";
  }
  return source;
}

export async function getPaymentSourceLabelsByIds(paymentIds: string[]) {
  const uniquePaymentIds = Array.from(new Set(paymentIds.filter(Boolean)));
  if (!uniquePaymentIds.length) {
    return new Map<string, string>();
  }

  const supabase = createAdminSupabaseClient();
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, source_file_id, payment_source")
    .in("id", uniquePaymentIds);

  if (paymentsError) {
    throw new Error(`Failed to load payment source labels: ${paymentsError.message}`);
  }

  const sourceFileIds = Array.from(
    new Set((payments ?? []).map((payment) => payment.source_file_id).filter(Boolean)),
  );
  const fileNames = new Map<string, string>();

  if (sourceFileIds.length) {
    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("id, original_name")
      .in("id", sourceFileIds);

    if (filesError) {
      throw new Error(`Failed to load payment source files: ${filesError.message}`);
    }

    for (const file of files ?? []) {
      if (file.id && file.original_name) {
        fileNames.set(String(file.id), String(file.original_name));
      }
    }
  }

  return new Map(
    (payments ?? []).map((payment) => [
      String(payment.id),
      paymentSourceLabelFromFileName(fileNames.get(String(payment.source_file_id)), payment.payment_source),
    ]),
  );
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

export async function insertManualAdjustmentRow(row: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("manual_adjustments").insert(row);

  if (error) {
    throw new Error(`Failed to log manual adjustment: ${error.message}`);
  }
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

function findingActionDetails(
  action: FindingActionInput["action"],
  currentStatus: string | null | undefined,
) {
  switch (action) {
    case "confirm_match":
      return {
        status: "resolved" as const,
        fieldName: "status",
        previousValue: currentStatus ?? "open",
        newValue: "resolved",
        reason: "Confirmed match from review queue",
      };
    case "not_same_visit":
      return {
        status: "dismissed" as const,
        fieldName: "status",
        previousValue: currentStatus ?? "open",
        newValue: "dismissed",
        reason: "Marked as not the same visit",
      };
    case "add_receipt_or_payment":
      return {
        status: undefined,
        fieldName: "follow_up",
        previousValue: currentStatus ?? null,
        newValue: { action: "add_receipt_or_payment" },
        reason: "Requested additional receipt or payment evidence",
      };
    case "request_credit_refund":
      return {
        status: "resolved" as const,
        fieldName: "status",
        previousValue: currentStatus ?? "open",
        newValue: "resolved",
        reason: "Ready to request credit or refund from provider",
      };
  }
}

export async function applyFindingAction(
  userId: string,
  findingId: string,
  input: unknown,
  deps: FindingActionDeps = {
    getOwnedFinding,
    patchOwnedFinding: patchOwnedFindingRow,
    insertManualAdjustment: insertManualAdjustmentRow,
    now: () => new Date().toISOString(),
  },
) {
  const parsed = findingActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid finding action payload");
  }

  const existing = await deps.getOwnedFinding(userId, findingId);
  if (!existing) {
    throw new Error("Finding not found");
  }

  const currentStatus = typeof existing.status === "string" ? existing.status : undefined;
  const actionDetails = findingActionDetails(parsed.data.action, currentStatus);
  const timestamp = deps.now();
  const patch: Record<string, unknown> = {
    updated_at: timestamp,
  };

  if (actionDetails.status) {
    patch.status = actionDetails.status;
  }

  const updated = await deps.patchOwnedFinding(userId, findingId, patch);
  if (!updated) {
    throw new Error("Finding not found");
  }

  await deps.insertManualAdjustment({
    id: crypto.randomUUID(),
    user_id: userId,
    target_type: "finding",
    target_id: findingId,
    field_name: actionDetails.fieldName,
    previous_value: actionDetails.previousValue,
    new_value: actionDetails.newValue,
    reason: actionDetails.reason,
    created_at: timestamp,
  });

  return {
    item: updated,
    action: parsed.data.action,
  };
}
