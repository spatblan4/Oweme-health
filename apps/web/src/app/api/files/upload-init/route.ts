import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { insertFileRow } from "@/lib/db/files";
import { createUpload } from "@/lib/files/create-upload";
import { createSignedUploadUrl } from "@/lib/files/storage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = requireRequestUserId(request);
    const result = await createUpload(
      {
        userId,
        input: body,
      },
      {
        now: () => new Date(),
        randomId: () => crypto.randomUUID(),
        insertFile: insertFileRow,
        createSignedUploadUrl,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
