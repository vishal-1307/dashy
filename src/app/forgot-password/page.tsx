"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { requestPasswordReset } from "@/server/auth-client";
import { Turnstile, captchaHeaders, turnstileConfigured } from "@/features/auth/turnstile";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (turnstileConfigured && !captchaToken) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await requestPasswordReset(
      { email, redirectTo: "/reset-password" },
      { headers: captchaHeaders(captchaToken) }
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message ?? "Could not send the reset email.");
      return;
    }
    // Always show the same confirmation regardless of whether the email exists,
    // so this page can't be used to enumerate registered accounts.
    setSent(true);
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-card__head">
          <span className="brand__mark brand__mark--lg">D</span>
          <h1>Reset your password</h1>
          <p>Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        {sent ? (
          <p className="auth-note" role="status">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <form className="auth-form" onSubmit={submit}>
              <label>Email
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <Turnstile onVerify={setCaptchaToken} />
              <button className="primary-button primary-button--full" disabled={loading} type="submit">
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch">
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
