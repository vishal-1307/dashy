"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "@/server/auth-client";
import { Turnstile, captchaHeaders, turnstileConfigured } from "@/features/auth/turnstile";
import { track } from "@/shared/lib/analytics";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (turnstileConfigured && !captchaToken) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    const { error: signInError } = await signIn.email(
      { email, password },
      { headers: captchaHeaders(captchaToken) }
    );
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign in. Check your email and password.");
      return;
    }
    track("signed_in", { method: "email" });
    router.push("/");
    router.refresh();
  };

  const withGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: socialError } = await signIn.social({ provider: "google", callbackURL: "/" });
    if (socialError) {
      setGoogleLoading(false);
      setError(socialError.message ?? "Could not start Google sign-in.");
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-card__head">
          <span className="brand__mark brand__mark--lg">D</span>
          <h1>Sign in to Dashy</h1>
          <p>Your personal workspace, synced everywhere you use it.</p>
        </div>

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
          <label>Password
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <p className="auth-forgot">
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
          <Turnstile onVerify={setCaptchaToken} />
          <button className="primary-button primary-button--full" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button className="auth-google" disabled={googleLoading} onClick={withGoogle} type="button">
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <p className="auth-switch">
          No account yet? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </main>
  );
}
