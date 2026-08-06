import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { listFindings } from "@/lib/findings/repository";

export async function GET(request: Request) {
  try {
    const userId = await requireRequestUserId(request);
    const result = await listFindings(userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
