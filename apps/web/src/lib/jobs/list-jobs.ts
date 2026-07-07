import { createAdminSupabaseClient } from "@/lib/auth/admin";

export async function listRecentJobs(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("file_jobs")
    .select("id,status,job_type,file_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(`Failed to load jobs: ${error.message}`);
  }

  return (data ?? []).map((job) => ({
    id: job.id,
    status: job.status,
    jobType: job.job_type,
    fileId: job.file_id,
    createdAt: job.created_at,
  }));
}
