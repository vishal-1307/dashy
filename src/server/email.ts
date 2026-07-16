import { Resend } from "resend";

/**
 * Thin email sender used by Better Auth for verification + password-reset
 * mail. Until a verified sending domain exists, RESEND_API_KEY is blank: in
 * that case we log the message server-side instead of throwing, so the auth
 * flows still work locally and enabling real delivery later is just setting
 * the two env vars.
 */

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Dashy <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

type SendArgs = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: SendArgs): Promise<void> {
  if (!resend) {
    // No sending domain configured yet — surface the content in dev logs so
    // verification/reset links are usable without real delivery.
    console.info(`[email:noop] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return;
  }

  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
