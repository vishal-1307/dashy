"use server";

import {
  issueConfirmationToken,
  verifyConfirmationToken,
  type TokenVerificationResult
} from "@/server/ai/confirmation";
import type { AiConfirmationTokenData } from "@/server/ai/types";
import { requireUserId } from "@/server/session";

/**
 * Server action to generate an anti-tamper cryptographic confirmation token.
 * Strictly requires an authenticated owner session.
 */
export async function createConfirmationTokenAction(
  toolName: string,
  rawPayload: Record<string, unknown>
): Promise<AiConfirmationTokenData> {
  const userId = await requireUserId();
  return issueConfirmationToken(userId, toolName, rawPayload);
}

/**
 * Server action to verify an anti-tamper confirmation token before execution.
 * Strictly requires an authenticated owner session matching the token issuer.
 */
export async function verifyConfirmationTokenAction(
  token: AiConfirmationTokenData,
  currentPayload: Record<string, unknown>
): Promise<TokenVerificationResult> {
  const userId = await requireUserId();
  return verifyConfirmationToken(token, currentPayload, userId);
}
