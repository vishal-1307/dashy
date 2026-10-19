"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { resetPassword } from "@/server/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || tokenError;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword({ newPassword: password, token });
      if (res?.error) {
        setError(res.error.message ?? "Could not reset your password. The link may have expired.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-card__head">
          <span className="brand__mark brand__mark--lg">D</span>
          <h1>Choose a new password</h1>
        </div>

        {invalidLink ? (
          <>
            <p className="auth-error" role="alert">
              This reset link is invalid or has expired.
            </p>
            <p className="auth-switch">
              <Link href="/forgot-password">Request a new link</Link>
            </p>
          </>
        ) : done ? (
          <>
            <p className="auth-note" role="status">Your password has been updated.</p>
            <button className="primary-button primary-button--full" onClick={() => router.push("/login")} type="button">
              Go to sign in
            </button>
          </>
        ) : (
          <>
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <form className="auth-form" onSubmit={submit}>
              <label>New password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>Confirm password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  required
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
              <button className="primary-button primary-button--full" disabled={loading} type="submit">
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
