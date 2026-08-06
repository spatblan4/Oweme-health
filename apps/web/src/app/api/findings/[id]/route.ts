import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { updateFinding } from "@/lib/findings/repository";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireRequestUserId(request);
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const { id } = await params;
    const result = await updateFinding(userId, id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "Unauthorized" ? 401 : message === "Finding not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
