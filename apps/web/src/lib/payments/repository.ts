import { createAdminSupabaseClient } from "@/lib/auth/admin";
import { DEV_TEST_USER_ID, ensureDevTestUser } from "@/lib/auth/dev-login";
import { parseManualPaymentInput, type ManualPaymentInput } from "@/lib/validation/manual-payment";

type PaymentRecord = Record<string, unknown>;

type CreateManualPaymentDeps = {
  randomId: () => string;
  now: () => string;
  insertPayment: (row: Record<string, unknown>) => Promise<PaymentRecord>;
};

function normalizeProviderName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function insertPaymentRow(row: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  if (process.env.NODE_ENV !== "production" && row.user_id === DEV_TEST_USER_ID) {
    await ensureDevTestUser({
      listUsers: () => supabase.auth.admin.listUsers(),
      createUser: (args) => supabase.auth.admin.createUser(args),
    });
  }

  const { data, error } = await supabase.from("payments").insert(row).select("*").single();
  if (error) {
    throw new Error(`Failed to create payment: ${error.message}`);
  }
  return data;
}

export async function createManualPayment(
  userId: string,
  input: unknown,
  deps: CreateManualPaymentDeps = {
    randomId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    insertPayment: insertPaymentRow,
  },
) {
  const parsed: ManualPaymentInput = parseManualPaymentInput(input);
  return deps.insertPayment({
    id: deps.randomId(),
    user_id: userId,
    visit_id: null,
    source_file_id: null,
    source_job_id: null,
    provider_name_raw: parsed.providerName,
    provider_name_normalized: normalizeProviderName(parsed.providerName),
    payment_date: parsed.paymentDate,
    amount: parsed.amount,
    payment_method: "manual_fallback",
    payment_source: parsed.paymentSource,
    normalized_payload: {
      manual_entry: true,
      entered_at: deps.now(),
      provider_name: parsed.providerName,
      payment_source: parsed.paymentSource,
    },
    created_at: deps.now(),
  });
}
