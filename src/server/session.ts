import { headers } from "next/headers";
import { auth } from "./auth";

export class UnauthenticatedError extends Error {
  constructor(message: string = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class UnauthorizedOwnerError extends Error {
  constructor(message: string = "Access restricted to authorized owner only.") {
    super(message);
    this.name = "UnauthorizedOwnerError";
  }
}

/**
 * Validates the authenticated session and asserts that the session belongs
 * to the authorized Dashy owner (matching OWNER_EMAIL).
 */
export async function requireOwnerSession(): Promise<{ userId: string; email: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new UnauthenticatedError();
  }

  const configuredOwner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!configuredOwner) {
    throw new UnauthorizedOwnerError("Server security misconfiguration: OWNER_EMAIL is not configured.");
  }
  if (session.user.email?.trim().toLowerCase() !== configuredOwner) {
    throw new UnauthorizedOwnerError("Access restricted to authorized owner only.");
  }

  return { userId: session.user.id, email: session.user.email };
}

/**
 * Resolves the current owner's user id from the request's session cookie, verified
 * server-side against the database and owner configuration.
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await requireOwnerSession();
  return userId;
}
