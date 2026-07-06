import { createServerSupabaseClient } from "@/lib/auth/server";

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
  bucket: string;
  storage_path: string;
  status: string;
};

export async function insertFileRow(file: FileRowInsert) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("files").insert(file);
  if (error) {
    throw new Error(`Failed to insert file row: ${error.message}`);
  }
}

export async function getOwnedFileRow(
  userId: string,
  fileId: string,
): Promise<OwnedFileRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("files")
    .select("id,user_id,bucket,storage_path,status")
    .eq("id", fileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch file row: ${error.message}`);
  }

  return data;
}
