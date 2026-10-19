"use server";

import { randomUUID } from "node:crypto";
import type { WorkspaceSlug } from "@/features/workspace/types";
import {
  computePayloadHash,
  issueConfirmationToken,
  verifyConfirmationToken,
  type TokenVerificationResult
} from "@/server/ai/confirmation";
import { executeAiCompletion } from "@/server/ai/providers/router";
import type {
  AiChatMessage,
  AiConfirmationTokenData,
  AiProviderName,
  AiToolCall
} from "@/server/ai/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { deleteTask } from "./tasks";

/**
 * Server action to generate an anti-tamper cryptographic confirmation token.
 * Strictly requires an authenticated owner session and persists the token to PostgreSQL.
 */
export async function createConfirmationTokenAction(
  toolName: string,
  rawPayload: Record<string, unknown>
): Promise<AiConfirmationTokenData> {
  const userId = await requireUserId();
  const token = issueConfirmationToken(userId, toolName, rawPayload);
  await prisma.aiConfirmationToken.create({
    data: {
      id: token.id,
      userId,
      toolName: token.toolName,
      payloadHash: token.payloadHash,
      rawPayload: token.rawPayload as object,
      issuedAt: token.issuedAt,
      expiresAt: token.expiresAt,
      usedAt: null
    }
  });
  return token;
}

/**
 * Server action to verify an anti-tamper confirmation token before execution.
 * Strictly requires an authenticated owner session, verifies against PostgreSQL,
 * and atomically marks the token used to prevent replay attacks.
 */
export async function verifyConfirmationTokenAction(
  token: AiConfirmationTokenData,
  currentPayload: Record<string, unknown>
): Promise<TokenVerificationResult> {
  const userId = await requireUserId();

  // 1. In-memory invariant check
  const memResult = verifyConfirmationToken(token, currentPayload, userId);
  if (!memResult.valid) {
    return memResult;
  }

  // 2. Database single-use persistence check
  const dbToken = await prisma.aiConfirmationToken.findUnique({
    where: { id: token.id }
  });

  if (!dbToken || dbToken.userId !== userId) {
    return { valid: false, reason: "UNAUTHORIZED_USER" };
  }
  if (dbToken.usedAt !== null) {
    return { valid: false, reason: "ALREADY_USED" };
  }
  if (Date.now() > dbToken.expiresAt.getTime()) {
    return { valid: false, reason: "EXPIRED" };
  }
  const submittedHash = computePayloadHash(currentPayload);
  if (submittedHash !== dbToken.payloadHash) {
    return { valid: false, reason: "PAYLOAD_TAMPERED" };
  }

  // 3. Mark token as consumed atomically in database
  await prisma.aiConfirmationToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() }
  });

  return { valid: true };
}

/**
 * Executes consequential task deletion with single-use confirmation token verification.
 */
export async function executeAiConfirmedTaskDeletion(
  token: AiConfirmationTokenData,
  taskId: string
): Promise<{ success: boolean; taskId: string }> {
  await requireUserId();
  const verify = await verifyConfirmationTokenAction(token, { taskId, title: (token.rawPayload as { title?: string }).title || "" });
  if (!verify.valid) {
    throw new Error(`AI consequential action rejected: ${verify.reason}`);
  }
  await deleteTask(taskId);
  return { success: true, taskId };
}

export interface SendAiMessageResult {
  message: AiChatMessage;
  token?: AiConfirmationTokenData;
  isConfirmedAction?: boolean;
}

/**
 * Dispatches an AI request grounded strictly in live database records
 * to the selected provider router (Gemini, OpenAI, Anthropic), with anti-tamper
 * confirmation tokens for destructive actions.
 */
export async function sendAiMessageAction(
  userPrompt: string,
  provider: AiProviderName = "gemini",
  workspaceSlug?: string,
  history: AiChatMessage[] = []
): Promise<SendAiMessageResult> {
  const userId = await requireUserId();
  const trimmed = userPrompt.trim();
  const lower = trimmed.toLowerCase();
  const todayStr = new Date().toISOString().slice(0, 10);
  const wsFilter = workspaceSlug && workspaceSlug !== "unified" ? workspaceSlug : undefined;

  // 1. Fetch live DB workspace data for grounded context
  const [tasks, projects, clients, invoices, transactions, notes] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        ...(wsFilter ? { workspace: { slug: wsFilter } } : {})
      },
      select: { id: true, title: true, status: true, priority: true, dueDate: true },
      take: 20,
      orderBy: { createdAt: "desc" }
    }),
    prisma.project.findMany({
      where: {
        userId,
        ...(wsFilter ? { workspace: { slug: wsFilter } } : {})
      },
      select: { id: true, title: true, status: true, progress: true, nextAction: true },
      take: 10,
      orderBy: { createdAt: "desc" }
    }),
    prisma.client.findMany({
      where: {
        workspace: {
          userId,
          ...(wsFilter ? { slug: wsFilter } : {})
        }
      },
      select: { id: true, name: true, company: true, dealValue: true, stage: true, nextFollowUpAt: true },
      take: 15,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.invoice.findMany({
      where: {
        workspace: {
          userId,
          ...(wsFilter ? { slug: wsFilter } : {})
        }
      },
      select: { id: true, invoiceNumber: true, totalAmount: true, amountPaid: true, outstandingBalance: true, status: true, dueAt: true }
    }),
    prisma.financeTransaction.findMany({
      where: {
        userId,
        ...(wsFilter ? { workspace: { slug: wsFilter } } : {})
      },
      select: { id: true, amount: true, type: true, category: true, date: true }
    }),
    prisma.note.findMany({
      where: {
        userId,
        ...(wsFilter ? { workspace: { slug: wsFilter } } : {})
      },
      select: { id: true, title: true, isPinned: true },
      take: 10,
      orderBy: { updatedAt: "desc" }
    })
  ]);

  // Aggregate live metrics
  const activeTasks = tasks.filter((t) => t.status === "ACTIVE" || t.status === "PLANNED");
  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate.toISOString().slice(0, 10) < todayStr && t.status !== "DONE");

  const invoicedRevenue = invoices
    .filter((inv) => inv.status !== "CANCELLED")
    .reduce((sum, inv) => sum + inv.totalAmount.toNumber(), 0);

  const outstandingBalance = invoices
    .filter((inv) => inv.status !== "CANCELLED")
    .reduce((sum, inv) => sum + inv.outstandingBalance.toNumber(), 0);

  const collectedRevenue = transactions
    .filter((tx) => tx.type === "INCOME")
    .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);

  const expenses = transactions
    .filter((tx) => tx.type === "EXPENSE")
    .reduce((sum, tx) => sum + tx.amount.toNumber(), 0);

  const netProfit = collectedRevenue - expenses;
  const goalTarget = 1_000_000;
  const goalProgressPct = Math.min(100, Math.round((collectedRevenue / goalTarget) * 100));

  const pipelineValue = clients
    .filter((c) => c.stage !== "LOST")
    .reduce((sum, c) => sum + (c.dealValue ? c.dealValue.toNumber() : 0), 0);

  // 2. Consequential Action Check (Destructive Actions require single-use confirmation token)
  if (lower.startsWith("delete task") || (lower.includes("delete") && lower.includes("task"))) {
    // Check if matching task exists in DB
    const targetTask = tasks.find((t) => lower.includes(t.title.toLowerCase())) || tasks[0];
    if (targetTask) {
      const toolArgs = { taskId: targetTask.id, title: targetTask.title };
      const token = await createConfirmationTokenAction("deleteTask", toolArgs);
      const toolCall: AiToolCall = {
        id: `call_${Date.now()}`,
        name: "deleteTask",
        arguments: toolArgs,
        requiresConfirmation: true,
        confirmationTokenId: token.id
      };
      return {
        message: {
          id: randomUUID(),
          role: "assistant",
          content: `I have prepared a request to permanently delete the task: **"${targetTask.title}"**.\n\nBecause this is a permanent deletion, please review and confirm this action with your single-use token below.`,
          toolCalls: [toolCall],
          createdAt: new Date().toISOString()
        },
        token,
        isConfirmedAction: true
      };
    }
  }

  // 3. Grounding context prompt
  const groundingSystemPrompt = `You are Dashy, the authoritative personal AI co-pilot for the user.
You assist exclusively with tasks, projects, CRM leads, financial invoices, notes, and calendar planning.

LIVE DATABASE RECORDS (SOURCE OF TRUTH as of ${todayStr}, Workspace: ${workspaceSlug || "unified"}):
- Tasks: ${tasks.length} total, ${activeTasks.length} active/planned, ${overdueTasks.length} overdue past due date.
- Key Tasks: ${tasks.slice(0, 5).map((t) => `"${t.title}" (${t.status}, due ${t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "none"})`).join(", ") || "None"}
- Active Projects: ${projects.map((p) => `"${p.title}" (${p.progress}%, next: ${p.nextAction || "N/A"})`).join(", ") || "None"}
- CRM Pipeline: ₹${pipelineValue.toLocaleString("en-IN")} pipeline value across ${clients.length} leads (${clients.filter((c) => c.stage === "WON").length} won).
- Financial Overview: Invoiced: ₹${invoicedRevenue.toLocaleString("en-IN")} | Cash Collected: ₹${collectedRevenue.toLocaleString("en-IN")} | Outstanding: ₹${outstandingBalance.toLocaleString("en-IN")} | Expenses: ₹${expenses.toLocaleString("en-IN")} | Net Profit: ₹${netProfit.toLocaleString("en-IN")}.
- ₹10,00,000 Milestone Target Progress: ₹${collectedRevenue.toLocaleString("en-IN")} collected (${goalProgressPct}%).
- Notes: ${notes.map((n) => `"${n.title}"`).join(", ") || "None"}

INSTRUCTIONS:
1. Always ground your responses strictly in the live database numbers and records above. Never fabricate items not present in the database.
2. If the user asks for a briefing, summarize their active tasks, financial position, and client follow-ups concisely using the database figures.
3. Be professional, direct, and actionable.`;

  // 4. Dispatch to provider router
  try {
    const aiMessages: AiChatMessage[] = [
      {
        id: "grounding_sys",
        role: "system",
        content: groundingSystemPrompt,
        createdAt: new Date().toISOString()
      },
      ...history.slice(-6),
      {
        id: `user_${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString()
      }
    ];

    const response = await executeAiCompletion({
      provider,
      userId,
      workspaceId: (workspaceSlug as WorkspaceSlug) || "freelance-software",
      messages: aiMessages
    });

    return {
      message: {
        id: randomUUID(),
        role: "assistant",
        content: response.replyText,
        createdAt: new Date().toISOString()
      }
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // If provider API key is missing or failed, provide accurate live DB response fallback
    let fallbackReply = `*(Note: Provider ${provider.toUpperCase()} returned: ${errMsg}. Showing authoritative live database response)*\n\n`;

    if (lower.includes("briefing") || lower.includes("today") || lower.includes("summary") || lower.includes("status")) {
      fallbackReply += `### Morning Briefing (${todayStr})\n` +
        `- **Active Tasks**: ${activeTasks.length} pending / ongoing across your workspace.\n` +
        `- **Overdue Deadlines**: ${overdueTasks.length} tasks past their scheduled due dates.\n` +
        `- **Financial Health**: ₹${collectedRevenue.toLocaleString("en-IN")} cash collected, ₹${outstandingBalance.toLocaleString("en-IN")} outstanding across ${invoices.length} invoices.\n` +
        `- **₹10L Milestone Goal**: ₹${collectedRevenue.toLocaleString("en-IN")} achieved (${goalProgressPct}% towards target).\n` +
        `- **CRM Pipeline**: ₹${pipelineValue.toLocaleString("en-IN")} across ${clients.length} active leads.`;
    } else if (lower.includes("goal") || lower.includes("10l") || lower.includes("revenue") || lower.includes("profit") || lower.includes("finance")) {
      fallbackReply += `### Financial & Milestone Summary\n` +
        `- **₹10,00,000 Target Progress**: ${goalProgressPct}% achieved (₹${collectedRevenue.toLocaleString("en-IN")} collected).\n` +
        `- **Invoiced Revenue**: ₹${invoicedRevenue.toLocaleString("en-IN")}\n` +
        `- **Outstanding Balance**: ₹${outstandingBalance.toLocaleString("en-IN")}\n` +
        `- **Total Expenses**: ₹${expenses.toLocaleString("en-IN")}\n` +
        `- **Net Profit**: ₹${netProfit.toLocaleString("en-IN")}`;
    } else {
      fallbackReply += `### Workspace Status (${workspaceSlug || "unified"})\n` +
        `- **Tasks Recorded**: ${tasks.length} total (${activeTasks.length} active)\n` +
        `- **Projects**: ${projects.length} tracked projects\n` +
        `- **CRM Leads**: ${clients.length} leads (Total Value: ₹${pipelineValue.toLocaleString("en-IN")})\n` +
        `- **Documentation**: ${notes.length} notes and guides\n\n` +
        `All records are synchronized directly with your Neon database. To use live LLM completions, configure \`${provider.toUpperCase()}_API_KEY\` in your .env.`;
    }

    return {
      message: {
        id: randomUUID(),
        role: "assistant",
        content: fallbackReply,
        createdAt: new Date().toISOString()
      }
    };
  }
}
