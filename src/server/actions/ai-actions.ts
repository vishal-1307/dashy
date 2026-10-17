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
 */
export async function createConfirmationTokenAction(
  toolName: string,
  rawPayload: Record<string, unknown>
): Promise<AiConfirmationTokenData> {
  const userId = await requireUserId().catch(() => "owner");
  return issueConfirmationToken(userId, toolName, rawPayload);
}

/**
 * Server action to verify an anti-tamper confirmation token before execution.
 */
export async function verifyConfirmationTokenAction(
  token: AiConfirmationTokenData,
  currentPayload: Record<string, unknown>
): Promise<TokenVerificationResult> {
  const userId = await requireUserId().catch(() => "owner");
  return verifyConfirmationToken(token, currentPayload, userId);
}
