import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Dashy",
  description: "How Dashy stores and protects your data."
};

const LAST_UPDATED = "July 14, 2026";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <p className="eyebrow">Draft — under review</p>
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

        <h2>What Dashy is</h2>
        <p>
          Dashy is a personal workspace for tasks, projects, notes, and related productivity data, operated by an
          individual developer. This policy explains what data is stored and how it is used.
        </p>

        <h2>Data we store</h2>
        <ul>
          <li><strong>Account data:</strong> your name, email address, and a hash of your password (never the password itself). If you sign in with Google, we store your Google account id and the name/email/avatar Google shares.</li>
          <li><strong>Workspace content:</strong> the tasks, projects, and other items you create — titles, descriptions, dates, statuses. Tasks and Projects are stored in our database; content in modules marked &quot;device-only&quot; stays in your browser and never reaches our servers.</li>
          <li><strong>Session data:</strong> session tokens, and the IP address and browser user-agent attached to each session, used for security.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          Dashy uses a single essential session cookie to keep you signed in. No advertising or cross-site tracking
          cookies are used.
        </p>

        <h2>Analytics</h2>
        <p>
          We collect a small set of anonymous product events (for example: sign-ups, which modules are opened) via
          PostHog to understand what to improve. Autocapture and session recording are disabled. Your workspace
          content is never sent to analytics.
        </p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Vercel</strong> — application hosting</li>
          <li><strong>Neon</strong> — database hosting (Postgres)</li>
          <li><strong>Google</strong> — optional &quot;Sign in with Google&quot;</li>
          <li><strong>Cloudflare Turnstile</strong> — bot protection on sign-up and sign-in</li>
          <li><strong>Resend</strong> — transactional email (verification and password reset)</li>
          <li><strong>PostHog</strong> — product analytics as described above</li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <p>We do not sell your data, show ads, or share your workspace content with anyone.</p>

        <h2>Retention and deletion</h2>
        <p>
          Your data is kept for as long as your account exists. You can delete your account at any time from
          Settings → Danger zone; this permanently removes your account and all workspace data from the database.
          You can also export your data as JSON from Settings at any time.
        </p>

        <h2>Security</h2>
        <p>
          Passwords are hashed (scrypt), connections are encrypted (TLS), every query is scoped to your account,
          and abuse protections (rate limiting, bot checks) are in place. No system is perfectly secure — please
          use a strong, unique password.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or data requests: <a href="mailto:thakurvishal1307@gmail.com">thakurvishal1307@gmail.com</a>
        </p>

        <p className="legal-footer">
          <Link href="/terms">Terms of Service</Link> · <Link href="/login">Back to Dashy</Link>
        </p>
      </div>
    </main>
  );
}
