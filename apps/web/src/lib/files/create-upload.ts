import { parseUploadInitInput, type UploadInitInput } from "@/lib/validation/files";

type FileRowInsert = {
  id: string;
  user_id: string;
  kind: UploadInitInput["kind"];
  bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: "uploaded";
  uploaded_at: string;
};

type CreateUploadDeps = {
  now: () => Date;
  randomId: () => string;
  insertFile: (file: FileRowInsert) => Promise<void>;
  createSignedUploadUrl: (args: {
    bucket: string;
    storagePath: string;
  }) => Promise<{ signedUrl: string; path: string; token: string }>;
};

function slugifyFileName(originalName: string) {
  return originalName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createUpload(
  args: {
    userId: string;
    input: unknown;
  },
  deps: CreateUploadDeps,
) {
  const input = parseUploadInitInput(args.input);
  const fileId = deps.randomId();
  const bucket = "uploads";
  const fileName = slugifyFileName(input.originalName);
  const storagePath = `${bucket}/${args.userId}/${fileId}-${fileName}`;

  await deps.insertFile({
    id: fileId,
    user_id: args.userId,
    kind: input.kind,
    bucket,
    storage_path: storagePath,
    original_name: input.originalName,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    status: "uploaded",
    uploaded_at: deps.now().toISOString(),
  });

  const signed = await deps.createSignedUploadUrl({
    bucket,
    storagePath,
  });

  return {
    fileId,
    signedUrl: signed.signedUrl,
    token: signed.token,
    storagePath: signed.path,
  };
}
