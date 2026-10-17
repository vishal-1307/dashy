import { GoogleGenAI } from "@google/genai";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function completeWithGemini(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please add it to your environment variables."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = request.model || DEFAULT_GEMINI_MODEL;

  // Format messages into a cohesive prompt
  const systemPrompt = `You are Dashy, an authoritative personal work management co-pilot for the owner.
You assist exclusively with tasks, projects, CRM leads, financial invoices, notes, and calendar planning.
Rules:
1. Always ground your answers strictly in the owner's actual workspace data. Never fabricate or hallucinate unrecorded records.
2. For consequential actions (deletions, invoice creation, payments, expenses), state clearly what action is required so confirmation can be confirmed.`;

  const contents = request.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2
      }
    });

    const replyText = response.text || "No response received from Gemini.";
    const usage = response.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? 150;
    const completionTokens = usage?.candidatesTokenCount ?? 80;

    // Approximate cost calculation for Gemini Flash: ~$0.075 per 1M prompt tokens, $0.30 per 1M output
    const estimatedCostUsd =
      (promptTokens / 1_000_000) * 0.075 + (completionTokens / 1_000_000) * 0.3;

    return {
      provider: "gemini",
      model: modelName,
      replyText,
      promptTokens,
      completionTokens,
      estimatedCostUsd
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API Error: ${message}`);
  }
}
