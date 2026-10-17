import { assertWithinMonthlyBudget } from "../budget";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";
import { completeWithClaude } from "./anthropic";
import { completeWithGemini } from "./gemini";
import { completeWithOpenAi } from "./openai";

let inMemoryAccumulatedCostUsd = 0;

export function getAccumulatedSpendUsd(): number {
  return inMemoryAccumulatedCostUsd;
}

export function resetAccumulatedSpend(): void {
  inMemoryAccumulatedCostUsd = 0;
}

/**
 * Main AI Gateway Router: checks monthly budget, routes request to chosen provider,
 * and logs token usage.
 */
export async function executeAiCompletion(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  // 1. Budget Guardrail Verification
  assertWithinMonthlyBudget(inMemoryAccumulatedCostUsd);

  // 2. Dispatch to requested provider
  let response: AiCompletionResponse;
  switch (request.provider) {
    case "gemini":
      response = await completeWithGemini(request);
      break;
    case "openai":
      response = await completeWithOpenAi(request);
      break;
    case "anthropic":
      response = await completeWithClaude(request);
      break;
    default:
      throw new Error(`Unsupported AI provider: ${request.provider}`);
  }

  // 3. Accumulate cost and verify limit
  inMemoryAccumulatedCostUsd += response.estimatedCostUsd;

  return response;
}
