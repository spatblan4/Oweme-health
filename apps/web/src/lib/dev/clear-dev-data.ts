import { createAdminSupabaseClient } from "@/lib/auth/admin";
import { DEV_TEST_EMAIL } from "@/lib/auth/dev-login";
import { listOwnedFileRows } from "@/lib/db/files";
import { removeStorageObjects } from "@/lib/files/storage";

type DevIdentity = {
  userId: string;
  email: string | null;
};

type FileRecord = {
  bucket: string;
  storage_path: string;
};

type ClearDevDataDeps = {
  listFiles: (userId: string) => Promise<FileRecord[]>;
  removeObjects: (bucket: string, storagePaths: string[]) => Promise<void>;
  deleteRows: (table: string, userId: string) => Promise<void>;
};

const DELETE_ORDER = ["findings", "payments", "claims", "file_jobs", "visits", "files"] as const;

async function deleteRowsForUser(table: string, userId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from(table).delete().eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

export async function clearDevTestData(
  identity: DevIdentity,
  deps: ClearDevDataDeps = {
    listFiles: listOwnedFileRows,
    removeObjects: removeStorageObjects,
    deleteRows: deleteRowsForUser,
  },
) {
  if (identity.email !== DEV_TEST_EMAIL) {
    throw new Error("Forbidden");
  }

  const files = await deps.listFiles(identity.userId);
  const byBucket = new Map<string, string[]>();
  for (const file of files) {
    const current = byBucket.get(file.bucket) ?? [];
    current.push(file.storage_path);
    byBucket.set(file.bucket, current);
  }

  for (const [bucket, storagePaths] of byBucket.entries()) {
    if (storagePaths.length) {
      await deps.removeObjects(bucket, storagePaths);
    }
  }

  for (const table of DELETE_ORDER) {
    await deps.deleteRows(table, identity.userId);
  }
}
