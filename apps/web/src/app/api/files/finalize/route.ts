import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { getOwnedFileRow } from "@/lib/db/files";
import { finalizeUpload } from "@/lib/files/finalize-upload";
import { confirmObjectExists } from "@/lib/files/storage";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { fileId?: string };
    const userId = requireRequestUserId(request);
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

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
