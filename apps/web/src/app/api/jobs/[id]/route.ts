import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { getOwnedJobRow } from "@/lib/db/jobs";
import { getFileJob } from "@/lib/jobs/get-job";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const userId = requireRequestUserId(request);
    const { id } = await params;

    const result = await getFileJob(
      {
        userId,
        jobId: id,
      },
      {
        getOwnedJob: getOwnedJobRow,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Job not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
