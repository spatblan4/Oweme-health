import { NextResponse } from "next/server";

export const DEMO_JUDGE_EMAIL = "demo-judge@oweme.local";
export const DEMO_JUDGE_USER_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_MODE_COOKIE = "oweme-demo-mode";

export function createDemoLoginResponse(origin: string) {
  const response = NextResponse.redirect(new URL("/dashboard?view=past&demoLoaded=1", origin), 303);
  response.cookies.set(DEMO_MODE_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  response.cookies.set("oweme-user-id", DEMO_JUDGE_USER_ID, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
