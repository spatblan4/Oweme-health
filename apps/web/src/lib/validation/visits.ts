import { z } from "zod";

const baseVisitSchema = {
  providerName: z.string().trim().min(1),
  visitDate: z.string().trim().min(1),
  visitType: z.enum(["medical", "dental", "vision", "other"]).default("other"),
  status: z.enum(["expected", "attended", "canceled", "unknown"]).default("unknown"),
  insuranceName: z.string().trim().min(1).optional(),
  paidAmount: z.number().nonnegative().optional(),
  paymentMethod: z.string().trim().min(1).optional(),
  reimbursementNeeded: z.boolean().optional(),
  claimCheckAfter: z.string().trim().min(1).optional(),
  nextAppointmentAt: z.string().trim().min(1).optional(),
  notes: z.string().optional(),
};

const visitCreateSchema = z.object(baseVisitSchema);

const visitPatchSchema = z
  .object({
    providerName: baseVisitSchema.providerName.optional(),
    visitDate: baseVisitSchema.visitDate.optional(),
    visitType: baseVisitSchema.visitType.optional(),
    status: baseVisitSchema.status.optional(),
    insuranceName: baseVisitSchema.insuranceName,
    paidAmount: baseVisitSchema.paidAmount,
    paymentMethod: baseVisitSchema.paymentMethod,
    reimbursementNeeded: baseVisitSchema.reimbursementNeeded,
    claimCheckAfter: baseVisitSchema.claimCheckAfter,
    nextAppointmentAt: baseVisitSchema.nextAppointmentAt,
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Patch payload cannot be empty",
  });

export type VisitCreateInput = z.infer<typeof visitCreateSchema>;
export type VisitPatchInput = z.infer<typeof visitPatchSchema>;

export function parseVisitCreateInput(input: unknown): VisitCreateInput {
  const result = visitCreateSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid visit payload");
  }
  return result.data;
}

export function parseVisitPatchInput(input: unknown): VisitPatchInput {
  const result = visitPatchSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid visit payload");
  }
  return result.data;
}

