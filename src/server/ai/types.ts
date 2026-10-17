import type { WorkspaceSlug } from "@/features/workspace/types";

export type AiProviderName = "gemini" | "openai" | "anthropic";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: AiToolCall[];
  toolResults?: AiToolResult[];
  createdAt: string;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmationTokenId?: string;
}

export interface AiToolResult {
  callId: string;
  toolName: string;
  result: unknown;
  error?: string;
}

export interface AiConfirmationTokenData {
  id: string;
  userId: string;
  toolName: string;
  payloadHash: string; // SHA-256
  rawPayload: Record<string, unknown>;
  issuedAt: Date;
  expiresAt: Date;
  usedAt?: Date | null;
}

export interface AiCompletionRequest {
  provider: AiProviderName;
  model?: string;
  messages: AiChatMessage[];
  workspaceId?: WorkspaceSlug;
  userId: string;
}

export interface AiCompletionResponse {
  provider: AiProviderName;
  model: string;
  replyText: string;
  toolCalls?: AiToolCall[];
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}
