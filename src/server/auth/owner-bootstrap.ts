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
 * Validates whether an incoming registration or setup request is authorized to bootstrap
 * the single-owner account.
 */
export function validateOwnerRegistration(
  attemptEmail: string,
  providedToken: string | undefined,
  config: OwnerBootstrapConfig,
  currentExistingUserCount: number
): { allowed: boolean; reason?: string } {
  // If an owner account already exists, all future public registrations are permanently locked.
  if (currentExistingUserCount >= 1) {
    return {
      allowed: false,
      reason: "Registration is permanently closed. Only the single owner account is permitted."
    };
  }

  const normalizedAttempt = attemptEmail.trim().toLowerCase();
  const normalizedConfigured = config.ownerEmail.trim().toLowerCase();

  if (!normalizedConfigured) {
    return {
      allowed: false,
      reason: "OWNER_EMAIL configuration is missing on server. Refusing registration."
    };
  }

  if (normalizedAttempt !== normalizedConfigured) {
    return {
      allowed: false,
      reason: "Unauthorized email address. Only the configured owner email can be registered."
    };
  }

  // If a bootstrap token is configured, require it during initial setup
  if (config.bootstrapToken) {
    if (!providedToken || providedToken !== config.bootstrapToken) {
      return {
        allowed: false,
        reason: "Invalid or missing owner bootstrap token."
      };
    }
  }

  return { allowed: true };
}
