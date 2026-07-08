import { createAdminSupabaseClient } from "@/lib/auth/admin";
import { DEV_TEST_USER_ID, ensureDevTestUser } from "@/lib/auth/dev-login";

type FileRowInsert = {
  id: string;
  user_id: string;
  kind: string;
  bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: string;
  uploaded_at: string;
};

type OwnedFileRow = {
  id: string;
  user_id: string;
  kind: string;
  bucket: string;
  storage_path: string;
  status: string;
};

type UpdateOwnedFileRowPatch = {
  status?: string;
};

export async function insertFileRow(file: FileRowInsert) {
  const supabase = createAdminSupabaseClient();
  if (process.env.NODE_ENV !== "production" && file.user_id === DEV_TEST_USER_ID) {
    await ensureDevTestUser({
      listUsers: () => supabase.auth.admin.listUsers(),
      createUser: (args) => supabase.auth.admin.createUser(args),
    });
  }
  const { error } = await supabase.from("files").insert(file);
  if (error) {
    throw new Error(`Failed to insert file row: ${error.message}`);
  }
}

export async function getOwnedFileRow(
  userId: string,
  fileId: string,
): Promise<OwnedFileRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("files")
    .select("id,user_id,kind,bucket,storage_path,status")
    .eq("id", fileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch file row: ${error.message}`);
  }

  return data;
}

export async function patchOwnedFileRow(
  userId: string,
  fileId: string,
  patch: UpdateOwnedFileRowPatch,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("files")
    .update(patch)
    .eq("id", fileId)
    .eq("user_id", userId)
    .select("id,user_id,kind,bucket,storage_path,status")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update file row: ${error.message}`);
  }

  return data;
}
