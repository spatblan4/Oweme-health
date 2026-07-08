import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { patchOwnedFileRow, getOwnedFileRow } from "@/lib/db/files";
import { insertJobRow } from "@/lib/db/jobs";
import { finalizeUpload } from "@/lib/files/finalize-upload";
import { confirmObjectExists } from "@/lib/files/storage";
import { createFileJob } from "@/lib/jobs/create-job";

function resolveJobType(kind: string) {
  return kind === "payment" || kind === "receipt" ? "extract_payments" : "extract_claims";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { fileId?: string };
    const userId = await requireRequestUserId(request);
    const result = await finalizeUpload(
      {
        userId,
        fileId: body.fileId ?? "",
      },
      {
        getOwnedFile: getOwnedFileRow,
        confirmObjectExists,
      },
    );

    const job = await createFileJob(
      {
        userId,
        fileId: result.fileId,
        jobType: resolveJobType(result.kind),
      },
      {
        now: () => new Date(),
        randomId: () => crypto.randomUUID(),
        getOwnedFile: getOwnedFileRow,
        insertJob: insertJobRow,
      },
    );

    await patchOwnedFileRow(userId, result.fileId, {
      status: "processing",
    });

    return NextResponse.json({
      ...result,
      jobId: job.id,
      jobStatus: job.status,
      jobType: resolveJobType(result.kind),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
