import { createAdminSupabaseClient } from "@/lib/auth/admin";

function splitStoragePath(storagePath: string) {
  const lastSlash = storagePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return {
      folder: "",
      fileName: storagePath,
    };
  }

  return {
    folder: storagePath.slice(0, lastSlash),
    fileName: storagePath.slice(lastSlash + 1),
  };
}

export async function createSignedUploadUrl(args: {
  bucket: string;
  storagePath: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(args.bucket)
    .createSignedUploadUrl(args.storagePath);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function confirmObjectExists(args: {
  bucket: string;
  storagePath: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { folder, fileName } = splitStoragePath(args.storagePath);
  const { data, error } = await supabase.storage.from(args.bucket).list(folder, {
    limit: 10,
    search: fileName,
  });

  if (error) {
    throw new Error(`Failed to verify storage object: ${error.message}`);
  }

  return (data ?? []).some((item) => item.name === fileName);
}

export async function removeStorageObjects(bucket: string, storagePaths: string[]) {
  if (!storagePaths.length) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage.from(bucket).remove(storagePaths);

  if (error) {
    throw new Error(`Failed to remove storage objects: ${error.message}`);
  }
}
