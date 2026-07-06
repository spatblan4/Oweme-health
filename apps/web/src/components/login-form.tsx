"use client";

import React, { useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/auth/client";

export function LoginForm() {
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setStatus("error");
      setMessage("Supabase environment variables are not configured yet.");
      return;
    }

    setStatus("sending");
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Magic link sent. Check your email to finish signing in.");
  }

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 460,
        border: "1px solid #d9e1ea",
        borderRadius: 8,
        background: "#ffffff",
        padding: 28,
        boxShadow: "0 18px 45px rgba(17, 31, 52, 0.08)",
      }}
    >
      <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#0b7a75",
          }}
        >
          Secure access
        </div>
        <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.05, color: "#152235" }}>
          Sign in to your private workspace
        </h1>
        <p style={{ margin: 0, color: "#617086", lineHeight: 1.5 }}>
          We will email you a magic link so you can open your OweMe Health dashboard without a password.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#314255", fontWeight: 600, fontSize: 14 }}>Email</span>
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={{
              height: 52,
              borderRadius: 8,
              border: "1px solid #cfd8e3",
              padding: "0 14px",
              fontSize: 16,
              color: "#152235",
            }}
          />
        </label>

        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            height: 52,
            borderRadius: 8,
            border: 0,
            background: "#152235",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 700,
            cursor: status === "sending" ? "wait" : "pointer",
          }}
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {message ? (
        <p
          style={{
            margin: "14px 0 0",
            color: status === "error" ? "#b54708" : "#0b7a75",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

