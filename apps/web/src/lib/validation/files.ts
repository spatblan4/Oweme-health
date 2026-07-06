import { z } from "zod";

const uploadInitInputSchema = z.object({
  kind: z.enum(["claim", "payment", "eob", "receipt", "other"]),
  originalName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive(),
});

export type UploadInitInput = z.infer<typeof uploadInitInputSchema>;

export function parseUploadInitInput(input: unknown): UploadInitInput {
  const result = uploadInitInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid upload metadata");
  }
  return result.data;
}

