import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Dashy",
  description: "The terms for using Dashy."
};

const LAST_UPDATED = "July 14, 2026";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <p className="eyebrow">Draft — under review</p>
        <h1>Terms of Service</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

        <h2>The service</h2>
        <p>
          Dashy is a personal productivity workspace provided as-is by an individual developer. By creating an
          account you agree to these terms and the <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>You are responsible for keeping your credentials secure.</li>
          <li>You must provide a real email address you control.</li>
          <li>One person per account; automated/mass account creation is not allowed.</li>
        </ul>

        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t use Dashy to store or distribute unlawful content, malware, or spam.</li>
          <li>Don&apos;t attempt to access other users&apos; data, probe, or disrupt the service.</li>
          <li>Fair-use limits apply (for example, a cap on items per module) to keep the service healthy for everyone.</li>
        </ul>

        <h2>Your content</h2>
        <p>
          Everything you put in Dashy remains yours. We only store and process it to run the service, as described
          in the Privacy Policy. You can export your data or delete your account at any time from Settings.
        </p>

        <h2>Availability and changes</h2>
        <p>
          Dashy is an early-stage product offered free of charge, without uptime guarantees. Features may change.
          We may suspend accounts that violate these terms. We&apos;ll make reasonable efforts to preserve your data,
          but you should keep backups (Settings → Backup).
        </p>

        <h2>Disclaimer</h2>
        <p>
          The service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law,
          the operator is not liable for indirect or consequential damages arising from use of the service.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: <a href="mailto:thakurvishal1307@gmail.com">thakurvishal1307@gmail.com</a>
        </p>

        <p className="legal-footer">
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/login">Back to Dashy</Link>
        </p>
      </div>
    </main>
  );
}
