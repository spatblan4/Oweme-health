"use client";

import React, { useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/auth/client";
import { readSupabaseSessionFromHash } from "@/lib/auth/hash-session";
import { authErrorMessage, SUPABASE_UNREACHABLE_MESSAGE } from "@/lib/auth/magic-link";

export function LoginForm({
  devLoginError,
  initialEmail = "",
  notice,
  showDevLogin = false,
}: {
  devLoginError?: "supabase_unavailable";
  initialEmail?: string;
  notice?: { tone: "error" | "success"; message: string };
  showDevLogin?: boolean;
}) {
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    notice?.tone === "success" ? "sent" : notice?.tone === "error" ? "error" : "idle",
  );
  const [message, setMessage] = useState(notice?.message ?? "");

  useEffect(() => {
    setIsLocalHost(
      typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"),
    );
  }, []);

  useEffect(() => {
    const session = readSupabaseSessionFromHash(window.location.hash);
    if (!session) {
      return;
    }

    const hashSession = session;
    let cancelled = false;

    async function finishDevLogin() {
      let client: ReturnType<typeof createBrowserSupabaseClient>;
      try {
        client = createBrowserSupabaseClient();
      } catch {
        setStatus("error");
        setMessage("Supabase environment variables are not configured yet.");
        return;
      }

      setStatus("sending");
      setMessage("Finishing sign in...");

      let sessionResult: Awaited<ReturnType<typeof client.auth.setSession>>;
      try {
        sessionResult = await client.auth.setSession({
          access_token: hashSession.accessToken,
          refresh_token: hashSession.refreshToken,
        });
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage(SUPABASE_UNREACHABLE_MESSAGE);
        }
        return;
      }

      if (cancelled) {
        return;
      }

      if (sessionResult.error) {
        setStatus("error");
        setMessage(authErrorMessage(sessionResult.error));
        return;
      }

      let syncResponse: Response;
      try {
        syncResponse = await fetch("/api/auth/sync-session", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Signed in, but could not sync your local session yet.");
        }
        return;
      }

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
  }, []);

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 760,
        border: "1px solid #d9e1ea",
        borderRadius: 24,
        background: "#ffffff",
        padding: 30,
        boxShadow: "0 18px 45px rgba(17, 31, 52, 0.08)",
        display: "grid",
        gap: 22,
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
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
          Choose your OweMe workspace
        </h1>
        <p style={{ margin: 0, color: "#617086", lineHeight: 1.5 }}>
          Use your personal account for real visit tracking. Use the judge demo for a safe synthetic walkthrough.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            border: "1px solid #dbe4ef",
            borderRadius: 20,
            background: "#fbfdff",
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ color: "#152235", fontSize: 20 }}>Your personal account</strong>
            <span style={{ color: "#617086", lineHeight: 1.45 }}>
              For your own medical bills, insurance follow-ups, uploads, and future visit reminders.
            </span>
          </div>

          <form noValidate action="/api/auth/magic-link" method="post" style={{ display: "grid", gap: 14 }}>
            <label htmlFor="oweme-personal-email" style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#314255", fontWeight: 700, fontSize: 14 }}>Email</span>
              <input
                id="oweme-personal-email"
                name="email"
                type="email"
                defaultValue={initialEmail}
                placeholder="you@example.com"
                aria-describedby={message ? "oweme-login-message" : undefined}
                style={{
                  height: 52,
                  borderRadius: 14,
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
                borderRadius: 14,
                border: 0,
                background: "#152235",
                color: "#ffffff",
                fontSize: 16,
                fontWeight: 800,
                cursor: status === "sending" ? "wait" : "pointer",
              }}
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
          </form>

          <span style={{ color: "#7c879e", fontSize: 13, lineHeight: 1.45 }}>
            This is the account you should use day to day. It is separate from demo data.
          </span>
        </div>

        <form
          action="/api/demo/login"
          method="post"
          style={{
            border: "1px solid #b9e6df",
            borderRadius: 20,
            background: "linear-gradient(135deg, #f3fffc, #def4f1)",
            padding: 20,
            display: "grid",
            gap: 12,
            alignContent: "space-between",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                color: "#0b7a75",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Safe demo
            </span>
            <strong style={{ color: "#152235", fontSize: 20 }}>Judge demo account</strong>
            <span style={{ color: "#617086", lineHeight: 1.45 }}>
              Opens synthetic Ali Salehpour DDS / HSA / card examples. No real medical or bank files.
            </span>
          </div>
          <button
            type="submit"
            style={{
              height: 52,
              width: "100%",
              borderRadius: 14,
              border: "1px solid #0f766d",
              background: "#0f766d",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Open judge demo
          </button>
        </form>
      </div>

      {showDevLogin || isLocalHost ? (
        <div
          style={{
            display: "grid",
            gap: 10,
            borderTop: "1px solid #eef3f8",
            paddingTop: 16,
          }}
        >
          {devLoginError === "supabase_unavailable" ? (
            <p
              style={{
                margin: 0,
                border: "1px solid #fed7aa",
                borderRadius: 8,
                background: "#fff7ed",
                color: "#9a3412",
                lineHeight: 1.45,
                padding: "10px 12px",
                fontSize: 14,
              }}
            >
              Your local dev shortcut needs Supabase, which is unreachable right now.
              Use the judge demo for a safe offline walkthrough.
            </p>
          ) : null}
          <span style={{ color: "#7c879e", fontSize: 13, fontWeight: 800 }}>
            Local developer shortcut
          </span>
          <form action="/api/dev/login" method="post">
            <button
              type="submit"
              style={{
                height: 48,
                width: "100%",
                borderRadius: 14,
                border: "1px solid #d9e1ea",
                background: "#f8fbff",
                color: "#152235",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Use local dev account
            </button>
          </form>
        </div>
      ) : null}

      {message ? (
        <p
          id="oweme-login-message"
          role={status === "error" ? "alert" : "status"}
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
