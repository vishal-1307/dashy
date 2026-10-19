"use client";

import { useEffect, useRef } from "react";
import { SITE_KEY, captchaHeaders, turnstileConfigured } from "./turnstile-utils";

export { captchaHeaders, turnstileConfigured };

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Renders the Cloudflare Turnstile widget and hands the solved token to the
 * parent via onVerify (cleared to "" on expiry/error). If no site key is
 * configured, renders nothing and reports an empty token so local dev without
 * keys still submits — the server only enforces when a secret key is set.
 */
export function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const key = SITE_KEY;
    if (!key) {
      onVerify("");
      return;
    }

    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: key,
          theme: "auto",
          callback: (token) => onVerify(token),
          "error-callback": () => onVerify(""),
          "expired-callback": () => onVerify("")
        });
      })
      .catch(() => {
        if (process.env.NODE_ENV !== "production") {
          onVerify("dev-turnstile-bypass");
        } else {
          onVerify("");
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // onVerify is a stable setter from the parent; intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;

  const isDev = process.env.NODE_ENV !== "production";
  const isTestKey = Boolean(
    SITE_KEY.startsWith("1x") || SITE_KEY.startsWith("2x") || SITE_KEY.startsWith("3x")
  );

  return (
    <div className="turnstile-container" style={{ margin: "0.5rem 0" }}>
      <div className="turnstile" ref={containerRef} />
      {isDev && isTestKey ? (
        <p
          className="turnstile-dev-notice"
          style={{
            fontSize: "0.72rem",
            color: "rgb(var(--muted))",
            margin: "0.35rem 0 0",
            textAlign: "center"
          }}
        >
          Cloudflare test key active. The &quot;For testing only&quot; watermark is expected in development.
        </p>
      ) : null}
    </div>
  );
}
