"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Lock } from "lucide-react";
import { verifyPasscode } from "../security";

const MAX_ATTEMPTS_BEFORE_DELAY = 5;
const DELAY_SECONDS = 30;

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const attempts = useRef(0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (checking) return;
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`Too many attempts. Wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
      return;
    }
    setChecking(true);
    const valid = await verifyPasscode(passcode);
    setChecking(false);
    if (valid) {
      onUnlock();
      return;
    }
    attempts.current += 1;
    setPasscode("");
    if (attempts.current >= MAX_ATTEMPTS_BEFORE_DELAY) {
      attempts.current = 0;
      setLockedUntil(Date.now() + DELAY_SECONDS * 1000);
      setError(`Too many attempts. Wait ${DELAY_SECONDS}s before trying again.`);
    } else {
      setError("Wrong passcode. Try again.");
    }
  };

  return (
    <main className="lock-screen">
      <form className="lock-card" onSubmit={submit}>
        <span className="brand__mark brand__mark--lg">D</span>
        <h1>Dashy is locked</h1>
        <p>Enter your passcode to open the workspace.</p>
        <div className="lock-input">
          <Lock />
          <input
            autoFocus
            aria-label="Passcode"
            autoComplete="current-password"
            inputMode="numeric"
            placeholder="Passcode"
            type="password"
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <p className="lock-error" role="alert">{error}</p> : null}
        <button className="primary-button primary-button--full" disabled={checking || !passcode} type="submit">
          {checking ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
