import { z } from "zod";

const supportedUploadExtensions = [".csv", ".pdf", ".xls", ".xlsx"];
const supportedUploadMimeTypes = [
  "text/csv",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const uploadInitInputSchema = z.object({
  kind: z.enum(["claim", "payment", "eob", "receipt", "other"]),
  originalName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive(),
}).superRefine((value, ctx) => {
  const fileName = value.originalName.toLowerCase();
  const hasSupportedExtension = supportedUploadExtensions.some((extension) => fileName.endsWith(extension));
  const hasSupportedMimeType = supportedUploadMimeTypes.includes(value.mimeType);

  if (!hasSupportedExtension && !hasSupportedMimeType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unsupported upload type",
    });
  }
});

export type UploadInitInput = z.infer<typeof uploadInitInputSchema>;

export function parseUploadInitInput(input: unknown): UploadInitInput {
  const result = uploadInitInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid upload metadata");
  }
  return result.data;
}
