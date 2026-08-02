import { NextResponse } from "next/server";

import { DEMO_MODE_COOKIE } from "@/lib/auth/demo-login";
import { requireRequestUserId } from "@/lib/auth/request-user";
import { getOwnedFileRow } from "@/lib/db/files";
import { runSyncAudit } from "@/lib/audit/run-sync-audit";

export async function POST(request: Request) {
  try {
    const userId = await requireRequestUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      claimFileIds?: string[];
      paymentFileIds?: string[];
    };

    const claimFileIds = Array.isArray(body.claimFileIds) ? body.claimFileIds.filter(Boolean) : [];
    const paymentFileIds = Array.isArray(body.paymentFileIds) ? body.paymentFileIds.filter(Boolean) : [];

    if (!claimFileIds.length && !paymentFileIds.length) {
      return NextResponse.json(
        { error: "Select at least one uploaded file before running the audit." },
        { status: 400 },
      );
    }

    for (const fileId of [...claimFileIds, ...paymentFileIds]) {
      const ownedFile = await getOwnedFileRow(userId, fileId);
      if (!ownedFile) {
        return NextResponse.json({ error: "One or more selected files are unavailable." }, { status: 404 });
      }
    }

    const result = await runSyncAudit({
      userId,
      claimFileIds,
      paymentFileIds,
    });

    const response = NextResponse.json(result);
    response.cookies.delete(DEMO_MODE_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
