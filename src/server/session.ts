import { headers } from "next/headers";
import { auth } from "./auth";

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Resolves the current user id from the request's session cookie, verified
 * server-side against the database. Never accept a userId from the client —
 * every Task/Project query must be scoped by this value.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session.user.id;
}
