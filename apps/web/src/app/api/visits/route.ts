import { NextResponse } from "next/server";

import { requireRequestUserId } from "@/lib/auth/request-user";
import { createVisit, listVisits } from "@/lib/visits/repository";

export async function GET(request: Request) {
  try {
    const userId = await requireRequestUserId(request);
    const result = await listVisits(userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireRequestUserId(request);
    const body = await request.json();
    const result = await createVisit(userId, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

