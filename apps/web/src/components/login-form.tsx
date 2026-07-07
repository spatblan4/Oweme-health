"use client";

import React, { useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/auth/client";
import { readSupabaseSessionFromHash } from "@/lib/auth/hash-session";

export function LoginForm({ showDevLogin = false }: { showDevLogin?: boolean }) {
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsLocalHost(
      typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"),
    );
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const session = readSupabaseSessionFromHash(window.location.hash);
    if (!session) {
      return;
    }

    const client = supabase;
    const hashSession = session;
    let cancelled = false;

    async function finishDevLogin() {
      setStatus("sending");
      setMessage("Finishing sign in...");

      const { error } = await client.auth.setSession({
        access_token: hashSession.accessToken,
        refresh_token: hashSession.refreshToken,
      });

      if (cancelled) {
        return;
      }

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      const syncResponse = await fetch("/api/auth/sync-session", {
        method: "POST",
        credentials: "include",
      });

      if (!syncResponse.ok) {
        setStatus("error");
        setMessage("Signed in, but could not sync your local session yet.");
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.location.assign(next);
    }

    void finishDevLogin();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

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

      {showDevLogin || isLocalHost ? (
        <form action="/api/dev/login" method="post" style={{ marginTop: 12 }}>
          <button
            type="submit"
            style={{
              height: 48,
              width: "100%",
              borderRadius: 8,
              border: "1px solid #d9e1ea",
              background: "#f8fbff",
              color: "#152235",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Use dev test account
          </button>
        </form>
      ) : null}

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
