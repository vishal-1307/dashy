"use server";

import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth";
import { DEFAULT_WORKSPACES, validateOwnerRegistration } from "@/server/auth/owner-bootstrap";

export type BootstrapStatusResult = {
  setupRequired: boolean;
  configuredOwnerEmail?: string;
  hasBootstrapToken: boolean;
};

export type BootstrapActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Checks whether setup is required (user count == 0) and whether server environment is configured.
 */
export async function getSetupStatusAction(): Promise<BootstrapStatusResult> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  const bootstrapToken = process.env.OWNER_BOOTSTRAP_TOKEN?.trim();

  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch {
    // If DB is unreachable or tables not created yet
    userCount = 0;
  }

  return {
    setupRequired: userCount === 0,
    configuredOwnerEmail: ownerEmail || undefined,
    hasBootstrapToken: Boolean(bootstrapToken && bootstrapToken.length > 0)
  };
}

/**
 * Server action to bootstrap the first owner account and provision the 5 default workspaces.
 * Strictly verifies the bootstrap token and OWNER_EMAIL against environment variables.
 */
export async function bootstrapOwnerAction(formData: {
  email: string;
  password: string;
  bootstrapToken: string;
}): Promise<BootstrapActionResult> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  const bootstrapToken = process.env.OWNER_BOOTSTRAP_TOKEN?.trim();

  // 1. Check server environment configuration
  if (!ownerEmail) {
    return {
      success: false,
      error: "Server security misconfiguration: OWNER_EMAIL environment variable is not configured on the server."
    };
  }

  if (!bootstrapToken) {
    return {
      success: false,
      error: "Server security misconfiguration: OWNER_BOOTSTRAP_TOKEN environment variable is not configured on the server."
    };
  }

  // 2. Query user count in database
  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Database tables are not initialized or unreachable. Please ensure schema migrations are applied before running setup. (Details: ${msg})`
    };
  }

  // 3. Prevent duplicate setup
  if (userCount >= 1) {
    return {
      success: false,
      error: "Setup has already been completed. Registration is permanently closed."
    };
  }

  // 4. Validate registration credentials and bootstrap token
  const validation = validateOwnerRegistration(
    formData.email,
    formData.bootstrapToken,
    { ownerEmail, bootstrapToken },
    userCount
  );

  if (!validation.allowed) {
    return {
      success: false,
      error: validation.reason ?? "Bootstrap verification failed."
    };
  }

  if (!formData.password || formData.password.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters long."
    };
  }

  // 5. Call Better Auth to create the user with the bootstrap header so databaseHooks permits it
  try {
    const reqHeaders = new Headers();
    reqHeaders.set("x-owner-bootstrap-token", formData.bootstrapToken.trim());

    const result = await auth.api.signUpEmail({
      body: {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        name: "Owner"
      },
      headers: reqHeaders
    });

    if (!result?.user?.id) {
      return {
        success: false,
        error: "Failed to create user record in authentication service."
      };
    }

    const userId = result.user.id;

    // 6. Idempotently provision the 5 default workspaces
    try {
      for (const ws of DEFAULT_WORKSPACES) {
        await prisma.workspace.upsert({
          where: { userId_slug: { userId, slug: ws.slug } },
          create: {
            userId,
            slug: ws.slug,
            name: ws.name,
            description: ws.description,
            isDefault: ws.slug === "freelance-software"
          },
          update: {}
        });
      }
    } catch (wsErr) {
      console.warn("Notice: Workspace table not yet migrated or seeded:", wsErr);
    }

    return {
      success: true,
      message: "Owner account successfully initialized! You may now sign in."
    };
  } catch (signUpErr) {
    const msg = signUpErr instanceof Error ? signUpErr.message : String(signUpErr);
    return {
      success: false,
      error: `Registration failed: ${msg}`
    };
  }
}
