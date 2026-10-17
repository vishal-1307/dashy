import type { AiCompletionRequest, AiCompletionResponse } from "../types";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export async function completeWithOpenAi(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Please add it to your environment variables."
    );
  }

  const modelName = request.model || DEFAULT_OPENAI_MODEL;
  const systemPrompt = `You are Dashy, an authoritative personal work management co-pilot for the owner.
You assist exclusively with tasks, projects, CRM leads, financial invoices, notes, and calendar planning.
Ground all answers strictly in actual workspace records. Never hallucinate unrecorded items.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...request.messages.map((m) => ({
      role: m.role === "tool" ? "assistant" : m.role,
      content: m.content
    }))
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    const replyText = data.choices?.[0]?.message?.content || "No response received from OpenAI.";
    const promptTokens = data.usage?.prompt_tokens ?? 150;
    const completionTokens = data.usage?.completion_tokens ?? 80;

    // Approximate cost calculation for GPT-4o-mini: ~$0.15 per 1M prompt, $0.60 per 1M output
    const estimatedCostUsd =
      (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;

    return {
      provider: "openai",
      model: modelName,
      replyText,
      promptTokens,
      completionTokens,
      estimatedCostUsd
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API Error: ${message}`);
  }
}
