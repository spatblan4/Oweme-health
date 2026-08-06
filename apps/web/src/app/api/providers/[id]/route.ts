import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { updateProvider } from "@/lib/providers/repository";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireRequestUserId(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { id } = await params;
    const result = await updateProvider(userId, id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "Unauthorized" ? 401 : message === "Provider not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
