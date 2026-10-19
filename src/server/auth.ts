import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { captcha } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db/client";
import { sendEmail } from "./email";

// Email verification is fully wired but gated: until a verified sending domain
// exists, keep EMAIL_VERIFICATION_ENABLED unset/false so signups proceed
// unverified (current behavior). Flip to "true" once real delivery works.
const emailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === "true";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const isDev = process.env.NODE_ENV !== "production";
const devOrigins = isDev
  ? [
      "http://localhost:*",
      "http://127.0.0.1:*",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002"
    ]
  : [];
const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const trustedOrigins = Array.from(new Set([appUrl, ...devOrigins, ...configuredOrigins]));

const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

// Rate limits are keyed per-IP by Better Auth. Values are requests-per-window
// (window in seconds). Strict on the credential + reset endpoints, which are
// the brute-force / enumeration surfaces.
const authRateLimitRules = {
  "/sign-in/email": { window: 60, max: 5 },
  "/sign-up/email": { window: 60, max: 3 },
  "/request-password-reset": { window: 600, max: 3 }
};

import { validateOwnerRegistration } from "./auth/owner-bootstrap";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const ownerEmail = process.env.OWNER_EMAIL?.trim();
          const bootstrapToken = process.env.OWNER_BOOTSTRAP_TOKEN?.trim();

          let userCount = 0;
          try {
            userCount = await prisma.user.count();
          } catch {
            userCount = 0;
          }

          let providedToken: string | undefined;
          if (context) {
            try {
              const ctx = context as { headers?: Headers; request?: Request };
              providedToken =
                ctx.headers?.get?.("x-owner-bootstrap-token") ??
                (ctx.request ? new Headers(ctx.request.headers).get("x-owner-bootstrap-token") ?? undefined : undefined);
            } catch {
              providedToken = undefined;
            }
          }

          const validation = validateOwnerRegistration(
            user.email ?? "",
            providedToken,
            { ownerEmail: ownerEmail ?? "", bootstrapToken },
            userCount
          );

          if (!validation.allowed) {
            throw new Error(validation.reason ?? "Registration rejected.");
          }

          return { data: user };
        }
      }
    }
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: emailVerificationEnabled,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Dashy password",
        text: `Reset your Dashy password by opening this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`
      });
    }
  },
  emailVerification: {
    sendOnSignUp: emailVerificationEnabled,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Dashy email",
        text: `Welcome to Dashy. Confirm your email by opening this link:\n\n${url}`
      });
    }
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    }
  },
  user: {
    deleteUser: {
      // No sendDeleteAccountVerification configured (email delivery is behind
      // the domain flag), so deletion happens immediately: the endpoint
      // requires the account password, or a fresh session for OAuth-only
      // users. DB-level onDelete: Cascade wipes every user-owned row.
      enabled: true
    }
  },
  account: {
    accountLinking: {
      // Only Google may implicitly link to an existing local account, and only
      // when that local row is already email-verified (requireLocalEmailVerified
      // defaults to true) — this is the guard against email-squatting: an
      // attacker who pre-registers an unverified account at a victim's address
      // cannot have the victim's Google identity linked into their row.
      trustedProviders: ["google"]
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5-min signed cookie cache to avoid a DB read per request
    }
  },
  rateLimit: {
    enabled: true,
    storage: "database", // persists across serverless invocations (Neon-backed)
    customRules: authRateLimitRules
  },
  trustedOrigins,
  plugins: [
    // Server-side captcha verification inside the auth flow. Default endpoints
    // are /sign-up/email, /sign-in/email, /request-password-reset. When no
    // secret is configured (shouldn't happen in prod), the plugin is omitted
    // so local dev without keys still works.
    ...(turnstileSecret
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: turnstileSecret
          })
        ]
      : []),
    nextCookies()
  ]
});
