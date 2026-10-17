import type { AiCompletionRequest, AiCompletionResponse } from "../types";

export const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

export async function completeWithClaude(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Please add it to your environment variables."
    );
  }

  const modelName = request.model || DEFAULT_CLAUDE_MODEL;
  const systemPrompt = `You are Dashy, an authoritative personal work management co-pilot for the owner.
You assist exclusively with tasks, projects, CRM leads, financial invoices, notes, and calendar planning.
Ground all answers strictly in actual workspace records. Never hallucinate unrecorded items.`;

  const messages = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "tool" ? "assistant" : m.role,
      content: m.content
    }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        messages,
        max_tokens: 1024,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    const replyText =
      data.content?.map((c: { text?: string }) => c.text ?? "").join("\n") ||
      "No response received from Claude.";

    const promptTokens = data.usage?.input_tokens ?? 150;
    const completionTokens = data.usage?.output_tokens ?? 80;

    // Approximate cost for Claude 3.5 Sonnet: ~$3.00 per 1M input, $15.00 per 1M output
    const estimatedCostUsd =
      (promptTokens / 1_000_000) * 3.0 + (completionTokens / 1_000_000) * 15.0;

    return {
      provider: "anthropic",
      model: modelName,
      replyText,
      promptTokens,
      completionTokens,
      estimatedCostUsd
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Anthropic API Error: ${message}`);
  }
}
