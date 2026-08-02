import { NextResponse } from "next/server";

import { createDevLoginFallbackResponse } from "@/lib/auth/dev-login";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  return createDevLoginFallbackResponse(origin);
}
