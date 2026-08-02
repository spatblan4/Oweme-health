import { createDemoLoginResponse } from "@/lib/auth/demo-login";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  return createDemoLoginResponse(origin);
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return createDemoLoginResponse(origin);
}
