"use client";

import posthog from "posthog-js";

/**
 * Privacy-lean analytics: explicit events only, no autocapture, no session
 * recording, memory persistence (no analytics cookies). Everything no-ops
 * when NEXT_PUBLIC_POSTHOG_KEY is unset, so local dev and forks work without
 * an account. Workspace content (titles, descriptions) is never sent.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics(): void {
  if (!KEY || initialized || typeof window === "undefined") return;
  initialized = true;
  posthog.init(KEY, {
    api_host: HOST,
    autocapture: false,
    capture_pageview: false, // pageviews are sent manually on route change
    disable_session_recording: true,
    persistence: "memory"
  });
}

export function trackPageview(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: path });
}

export function track(event: string, properties?: Record<string, string | number | boolean>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identifyUser(userId: string): void {
  if (!initialized) return;
  posthog.identify(userId);
}

export function resetAnalyticsIdentity(): void {
  if (!initialized) return;
  posthog.reset();
}
