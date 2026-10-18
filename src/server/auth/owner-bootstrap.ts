import { timingSafeEqual } from "node:crypto";

export interface DefaultWorkspaceDef {
  slug: string;
  name: string;
  description: string;
  accent: string;
}

export const DEFAULT_WORKSPACES: readonly DefaultWorkspaceDef[] = [
  {
    slug: "freelance-software",
    name: "Freelance & Software Development",
    description:
      "Website development clients, custom software, proposals, client follow-ups, invoices, and development tasks.",
    accent: "bg-blue-600"
  },
  {
    slug: "dkom",
    name: "DKOM",
    description:
      "Mithila paintings, hand-painted clothing, product catalogue, retail/custom orders, art supplies/expenses, and business goals.",
    accent: "bg-rose-600"
  },
  {
    slug: "diamond-jewellers",
    name: "Diamond Jewellers",
    description:
      "Website & digital catalogue upgrades, store tasks, supplier/business expenses, and records.",
    accent: "bg-amber-600"
  },
  {
    slug: "mithila-kritikala",
    name: "Mithila KritiKala",
    description:
      "NGO activities, documentation, artisan training programs, funding/grants, registration & compliance follow-ups.",
    accent: "bg-emerald-600"
  },
  {
    slug: "personal",
    name: "Personal",
    description:
      "College coursework, cybersecurity learning/certifications, self-development projects, habits, and life tasks.",
    accent: "bg-indigo-600"
  }
] as const;

export interface OwnerBootstrapConfig {
  ownerEmail: string;
  bootstrapToken?: string;
}

/**
 * Constant-time string comparison to prevent timing attacks on tokens.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates whether an incoming registration or setup request is authorized to bootstrap
 * the single-owner account. Fails closed under all circumstances.
 */
export function validateOwnerRegistration(
  attemptEmail: string,
  providedToken: string | undefined,
  config: OwnerBootstrapConfig,
  currentExistingUserCount: number
): { allowed: boolean; reason?: string } {
  // 1. If an owner account already exists, all future registrations are permanently locked.
  if (currentExistingUserCount >= 1) {
    return {
      allowed: false,
      reason: "Registration is permanently closed. Only the single owner account is permitted."
    };
  }

  const normalizedConfiguredEmail = config.ownerEmail ? config.ownerEmail.trim().toLowerCase() : "";
  const normalizedAttemptEmail = attemptEmail ? attemptEmail.trim().toLowerCase() : "";

  // 2. Fail closed if OWNER_EMAIL is not set on the server
  if (!normalizedConfiguredEmail) {
    return {
      allowed: false,
      reason: "Server security misconfiguration: OWNER_EMAIL is not configured. Registration is blocked."
    };
  }

  // 3. Fail closed if attempt email does not match configured OWNER_EMAIL
  if (!normalizedAttemptEmail || normalizedAttemptEmail !== normalizedConfiguredEmail) {
    return {
      allowed: false,
      reason: "Unauthorized email address. Only the configured owner email can be registered."
    };
  }

  // 4. Fail closed if OWNER_BOOTSTRAP_TOKEN is not configured on the server
  const configuredToken = config.bootstrapToken ? config.bootstrapToken.trim() : "";
  if (!configuredToken) {
    return {
      allowed: false,
      reason: "Server security misconfiguration: OWNER_BOOTSTRAP_TOKEN is not configured. Setup is blocked."
    };
  }

  // 5. Strictly require timing-safe verification of the bootstrap token
  const cleanedProvidedToken = providedToken ? providedToken.trim() : "";
  if (!cleanedProvidedToken || !timingSafeCompare(cleanedProvidedToken, configuredToken)) {
    return {
      allowed: false,
      reason: "Invalid or missing owner bootstrap token."
    };
  }

  return { allowed: true };
}
