"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { signIn, signUp } from "@/server/auth-client";
import { Turnstile, captchaHeaders, turnstileConfigured } from "@/features/auth/turnstile";
import { track } from "@/shared/lib/analytics";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (turnstileConfigured && !captchaToken) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    const { error: signUpError } = await signUp.email(
      { name, email, password },
      { headers: captchaHeaders(captchaToken) }
    );
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account.");
      return;
    }
    track("signed_up", { method: "email" });
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
          <h1>Create your Dashy account</h1>
          <p>One workspace for tasks, projects, and everything else.</p>
        </div>

        {error ? <p className="auth-error" role="alert">{error}</p> : null}

        <form className="auth-form" onSubmit={submit}>
          <label>Name
            <input
              autoComplete="name"
              required
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
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
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Turnstile onVerify={setCaptchaToken} />
          <button className="primary-button primary-button--full" disabled={loading} type="submit">
            {loading ? "Creating account…" : "Create account"}
          </button>
          <p className="auth-legal">
            By creating an account you agree to the <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </form>

        <div className="auth-divider">or</div>

        <button className="auth-google" disabled={googleLoading} onClick={withGoogle} type="button">
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
