import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { patchOwnedFileRow, getOwnedFileRow } from "@/lib/db/files";
import { insertJobRow } from "@/lib/db/jobs";
import { createFileJob } from "@/lib/jobs/create-job";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const userId = await requireRequestUserId(request);
    const body = (await request.json().catch(() => ({}))) as { jobType?: string };
    const { id } = await params;

    const result = await createFileJob(
      {
        userId,
        fileId: id,
        jobType: body.jobType ?? "extract_claims",
      },
      {
        now: () => new Date(),
        randomId: () => crypto.randomUUID(),
        getOwnedFile: getOwnedFileRow,
        insertJob: insertJobRow,
      },
    );

    await patchOwnedFileRow(userId, id, {
      status: "processing",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
