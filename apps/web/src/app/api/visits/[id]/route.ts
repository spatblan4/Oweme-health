import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { deleteVisit, updateVisit } from "@/lib/visits/repository";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireRequestUserId(request);
    const body = await request.json();
    const { id } = await params;
    const result = await updateVisit(userId, id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "Unauthorized" ? 401 : message === "Visit not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const userId = await requireRequestUserId(request);
    const { id } = await params;
    await deleteVisit(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "Unauthorized" ? 401 : message === "Visit not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
