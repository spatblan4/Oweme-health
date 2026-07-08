type OwnedFile = {
  id: string;
  user_id: string;
  kind: string;
  bucket: string;
  storage_path: string;
  status: string;
};

type FinalizeUploadDeps = {
  getOwnedFile: (userId: string, fileId: string) => Promise<OwnedFile | null>;
  confirmObjectExists: (args: {
    bucket: string;
    storagePath: string;
  }) => Promise<boolean>;
};

export async function finalizeUpload(
  args: {
    userId: string;
    fileId: string;
  },
  deps: FinalizeUploadDeps,
) {
  const file = await deps.getOwnedFile(args.userId, args.fileId);
  if (!file) {
    throw new Error("File not found");
  }

  const objectExists = await deps.confirmObjectExists({
    bucket: file.bucket,
    storagePath: file.storage_path,
  });

  if (!objectExists) {
    throw new Error("Uploaded file is missing from storage");
  }

  return {
    fileId: file.id,
    ready: true,
    kind: file.kind,
  };
}
