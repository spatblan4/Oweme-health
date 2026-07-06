import { createServerSupabaseClient } from "@/lib/auth/server";

type JobRowInsert = {
  id: string;
  user_id: string;
  file_id: string;
  job_type: string;
  status: "queued";
  attempt_count: number;
  created_at: string;
};

type OwnedJobRow = {
  id: string;
  status: string;
  job_type: string;
  file_id: string;
};

export async function insertJobRow(job: JobRowInsert) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("file_jobs").insert(job);
  if (error) {
    throw new Error(`Failed to insert job row: ${error.message}`);
  }
}

export async function getOwnedJobRow(
  userId: string,
  jobId: string,
): Promise<OwnedJobRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("file_jobs")
    .select("id,status,job_type,file_id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch job row: ${error.message}`);
  }

  return data;
}
