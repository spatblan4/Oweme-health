import { z } from "zod";

const manualPaymentSchema = z.object({
  paymentSource: z.string().trim().min(1),
  providerName: z.string().trim().min(1),
  paymentDate: z.string().trim().min(1),
  amount: z.preprocess((value) => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const cleaned = value.replace(/[$,\s]/g, "");
      return cleaned ? Number(cleaned) : Number.NaN;
    }
    return value;
  }, z.number().finite().nonnegative()),
});

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

export function parseManualPaymentInput(input: unknown): ManualPaymentInput {
  const result = manualPaymentSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid manual payment payload");
  }
  return result.data;
}
