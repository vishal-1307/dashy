import { createHash, randomUUID } from "node:crypto";
import type { AiConfirmationTokenData } from "./types";

export const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Produces a stable, key-sorted JSON string for cryptographic hashing.
 */
export function deterministicJsonString(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(deterministicJsonString).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${deterministicJsonString((obj as Record<string, unknown>)[k])}`
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Computes SHA-256 hash of arbitrary payload data.
 */
export function computePayloadHash(payload: unknown): string {
  return createHash("sha256").update(deterministicJsonString(payload)).digest("hex");
}

/**
 * Issues an in-memory or database-backed confirmation token for consequential AI actions.
 */
export function issueConfirmationToken(
  userId: string,
  toolName: string,
  rawPayload: Record<string, unknown>
): AiConfirmationTokenData {
  const now = new Date();
  return {
    id: `tok_${randomUUID()}`,
    userId,
    toolName,
    payloadHash: computePayloadHash(rawPayload),
    rawPayload,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS),
    usedAt: null
  };
}

export type TokenVerificationResult =
  | { valid: true }
  | { valid: false; reason: "EXPIRED" | "ALREADY_USED" | "UNAUTHORIZED_USER" | "PAYLOAD_TAMPERED" };

/**
 * Verifies that a confirmation token is unused, unexpired, matches the current user,
 * and that the payload has not been tampered with.
 */
export function verifyConfirmationToken(
  token: AiConfirmationTokenData,
  submittedPayload: Record<string, unknown>,
  currentUserId: string,
  now: Date = new Date()
): TokenVerificationResult {
  if (token.userId !== currentUserId) {
    return { valid: false, reason: "UNAUTHORIZED_USER" };
  }
  if (token.usedAt !== null && token.usedAt !== undefined) {
    return { valid: false, reason: "ALREADY_USED" };
  }
  if (now.getTime() > token.expiresAt.getTime()) {
    return { valid: false, reason: "EXPIRED" };
  }
  const submittedHash = computePayloadHash(submittedPayload);
  if (submittedHash !== token.payloadHash) {
    return { valid: false, reason: "PAYLOAD_TAMPERED" };
  }
  return { valid: true };
}
