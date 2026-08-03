"use client";

import React, { useState } from "react";

export function LoginForm({
  initialEmail = "",
  notice,
}: {
  initialEmail?: string;
  notice?: { tone: "error" | "success"; message: string };
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "code" | "verifying" | "error">(
    notice?.tone === "error" ? "error" : "idle",
  );
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState(notice?.message ?? "");

  async function sendCode() {
    if (status === "sending") return;
    setStatus("sending");
    setMessage("");
    const formData = new FormData();
    formData.set("email", email);
    try {
      const response = await fetch("/api/auth/send-code", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Could not send a code.");
      setCodeSent(true);
      setCode("");
      setStatus("code");
      setMessage(payload.message);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not send a code. Try again.");
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "verifying") return;
    setStatus("verifying");
    setMessage("");
    const formData = new FormData();
    formData.set("email", email);
    formData.set("code", code);
    try {
      const response = await fetch("/api/auth/verify-code", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "That code is invalid or expired.");
      window.location.assign(payload.next || "/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "That code is invalid or expired.");
    }
  }

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

          {!codeSent ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode();
            }}
            style={{ display: "grid", gap: 14 }}
          >
            <label htmlFor="oweme-personal-email" style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#314255", fontWeight: 700, fontSize: 14 }}>Email</span>
              <input
                id="oweme-personal-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              {status === "sending" ? "Sending code..." : "Email me a sign-in code"}
            </button>
          </form>
          ) : (
            <form onSubmit={verifyCode} style={{ display: "grid", gap: 14 }}>
              <label htmlFor="oweme-personal-code" style={{ display: "grid", gap: 8 }}>
                <span style={{ color: "#314255", fontWeight: 700, fontSize: 14 }}>6-digit code</span>
                <input
                  id="oweme-personal-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  aria-describedby="oweme-login-message"
                  style={{ height: 52, borderRadius: 14, border: "1px solid #cfd8e3", padding: "0 14px", fontSize: 20, letterSpacing: "0.2em", color: "#152235" }}
                />
              </label>
              <button
                type="submit"
                disabled={status === "verifying" || code.length !== 6}
                style={{ height: 52, borderRadius: 14, border: 0, background: code.length === 6 ? "#152235" : "#91a0b5", color: "#ffffff", fontSize: 16, fontWeight: 800, cursor: status === "verifying" ? "wait" : "pointer" }}
              >
                {status === "verifying" ? "Verifying..." : "Sign in"}
              </button>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void sendCode()} disabled={status === "sending"} style={{ border: 0, background: "transparent", color: "#0f766d", padding: 0, fontWeight: 800, cursor: "pointer" }}>
                  {status === "sending" ? "Sending..." : "Resend code"}
                </button>
                <button type="button" onClick={() => { setCodeSent(false); setCode(""); setStatus("idle"); setMessage(""); }} style={{ border: 0, background: "transparent", color: "#617086", padding: 0, fontWeight: 700, cursor: "pointer" }}>
                  Change email
                </button>
              </div>
            </form>
          )}

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
