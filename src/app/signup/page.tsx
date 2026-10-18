"use client";

import Link from "next/link";
import { Lock, ShieldAlert } from "lucide-react";

export default function SignupPage() {
  return (
    <main className="auth-screen">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-card__head">
          <div
            style={{
              width: "3rem",
              height: "3rem",
              borderRadius: "999px",
              background: "rgb(var(--accent-soft))",
              color: "rgb(var(--accent))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 0.8rem"
            }}
          >
            <ShieldAlert style={{ width: "1.6rem", height: "1.6rem" }} />
          </div>
          <h1>Public Registration Closed</h1>
          <p>
            Dashy is a single-owner personal work management dashboard. Public self-registration is disabled.
          </p>
        </div>

        <div style={{ margin: "1.5rem 0", display: "grid", gap: "0.8rem" }}>
          <div
            style={{
              padding: "1rem",
              background: "rgb(var(--surface-strong))",
              border: "1px solid rgb(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: "0.82rem",
              color: "rgb(var(--muted))",
              lineHeight: 1.5,
              textAlign: "left"
            }}
          >
            <strong style={{ color: "rgb(var(--foreground))" }}>First-time Initialization:</strong>
            <br />
            If you are the owner initializing Dashy for the first time, use the secure Setup Wizard with your server bootstrap token.
          </div>

          <Link href="/setup" className="primary-button primary-button--full" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
            <Lock style={{ width: "1rem", height: "1rem" }} />
            Open Setup Wizard
          </Link>

          <Link href="/login" className="ghost-button" style={{ display: "inline-block", width: "100%", padding: "0.6rem", textAlign: "center", fontSize: "0.82rem" }}>
            Already initialized? Sign In
          </Link>
        </div>

        <p className="auth-legal" style={{ fontSize: "0.72rem", color: "rgb(var(--muted))" }}>
          Protected by single-owner verified bootstrap security.
        </p>
      </div>
    </main>
  );
}
