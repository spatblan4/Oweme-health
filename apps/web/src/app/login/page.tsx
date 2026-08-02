import React from "react";

import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    authError?: string;
    authMessage?: string;
    devLoginError?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const devLoginError =
    params.devLoginError === "supabase_unavailable" ? "supabase_unavailable" : undefined;
  const authError = typeof params.authError === "string" ? params.authError : undefined;
  const authMessage = typeof params.authMessage === "string" ? params.authMessage : undefined;
  const notice = authError
    ? { tone: "error" as const, message: authError }
    : authMessage
      ? { tone: "success" as const, message: authMessage }
      : undefined;
  const initialEmail = typeof params.email === "string" ? params.email : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        display: "grid",
        placeItems: "center",
        padding: 32,
      }}
    >
      <LoginForm
        devLoginError={devLoginError}
        initialEmail={initialEmail}
        notice={notice}
        showDevLogin={process.env.NODE_ENV !== "production"}
      />
    </main>
  );
}
