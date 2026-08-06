import { z } from "zod";

const providerInputSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  notes: z.string().optional(),
});

const providerPatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Patch payload cannot be empty",
  });

export type ProviderInput = z.infer<typeof providerInputSchema>;
export type ProviderPatchInput = z.infer<typeof providerPatchSchema>;

export function parseProviderInput(input: unknown): ProviderInput {
  const result = providerInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid provider payload");
  }
  return result.data;
}

export function parseProviderPatchInput(input: unknown): ProviderPatchInput {
  const result = providerPatchSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid provider payload");
  }
  return result.data;
}
