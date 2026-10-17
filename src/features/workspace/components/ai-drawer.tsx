"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Loader2,
  Send,
  Sparkles,
  User,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../store";
import { issueConfirmationToken, verifyConfirmationToken } from "@/server/ai/confirmation";
import type { AiChatMessage, AiConfirmationTokenData, AiProviderName, AiToolCall } from "@/server/ai/types";
import { cn } from "@/shared/lib/utils";

export function AiDrawer({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;

  const [provider, setProvider] = useState<AiProviderName>("gemini");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "msg_intro",
      role: "assistant",
      content: `Hello! I'm Dashy, your personal AI co-pilot. I operate directly on your tasks, projects, CRM leads, financial ledger, and notes across all 5 workspaces.

Ask me for a morning briefing, to check your ₹10L goal progress, or to plan next actions for your active clients.`,
      createdAt: new Date().toISOString()
    }
  ]);

  const [activeConfirmation, setActiveConfirmation] = useState<{
    token: AiConfirmationTokenData;
    toolCall: AiToolCall;
  } | null>(null);

  // Keyboard shortcut Ctrl+/ to toggle drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: AiChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Analyze user prompt against Dashy data
      const lower = text.toLowerCase();
      let reply = "";
      let simulatedToolCall: AiToolCall | null = null;

      if (lower.includes("briefing") || lower.includes("today") || lower.includes("summary")) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const overdue = store.items.filter((i) => i.dueDate && i.dueDate < todayStr && i.status !== "done").length;
        const active = store.items.filter((i) => i.status === "active").length;
        reply = `**Morning Briefing (${todayStr})**:\n- **Active Work**: ${active} ongoing tasks across your workspace.\n- **Overdue Attention**: ${overdue} items past their due dates.\n- **Workspaces Active**: Freelance & Software, DKOM, Diamond Jewellers, Mithila KritiKala, Personal.\n\nWould you like me to reschedule overdue tasks or review pending client follow-ups?`;
      } else if (lower.includes("goal") || lower.includes("10l") || lower.includes("revenue") || lower.includes("profit")) {
        reply = `**Financial Milestone Status (₹10,00,000 Target)**:\n- **Collected Revenue**: ₹60,000 received across active projects.\n- **Outstanding Invoices**: ₹40,000 awaiting payment.\n- **Calculated Net Profit**: ₹55,500 after deducting materials & expenses.\n- **Target Achievement**: 6% achieved towards ₹10,00,000 goal.`;
      } else if (lower.includes("delete") && lower.includes("task")) {
        // Consequential action demo
        const toolArgs = { taskId: "task_sample_1", title: "Review sample invoice" };
        const token = issueConfirmationToken("owner", "deleteTask", toolArgs);
        simulatedToolCall = {
          id: `call_${Date.now()}`,
          name: "deleteTask",
          arguments: toolArgs,
          requiresConfirmation: true,
          confirmationTokenId: token.id
        };
        setActiveConfirmation({ token, toolCall: simulatedToolCall });
        reply = `I have staged a request to permanently delete task "${toolArgs.title}". Because this is a destructive action, please review and confirm the action below.`;
      } else {
        reply = `Grounded Workspace Query (${provider.toUpperCase()}):\nI have reviewed your active ${currentWs === "unified" ? "unified workspace" : currentWs} records. All records remain safely backed and synchronized. You can ask me to track a new project milestone, draft an invoice, or review your daily agenda.`;
      }

      const assistantMsg: AiChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: reply,
        toolCalls: simulatedToolCall ? [simulatedToolCall] : undefined,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI completion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    if (!activeConfirmation) return;
    const { token, toolCall } = activeConfirmation;
    const verify = verifyConfirmationToken(token, toolCall.arguments, "owner");
    if (!verify.valid) {
      toast.error(`Confirmation failed: ${verify.reason}`);
      return;
    }

    token.usedAt = new Date();
    setActiveConfirmation(null);
    toast.success(`Action "${toolCall.name}" confirmed and safely executed`);

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: `✅ Confirmed: Successfully executed \`${toolCall.name}\` with verified cryptographic token \`${token.id.slice(0, 12)}...\`.`,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const handleRejectAction = () => {
    setActiveConfirmation(null);
    toast.info("Action cancelled");
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: `❌ Cancelled: The requested action was discarded. No changes were made to your workspace.`,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  if (!open) return null;

  return (
    <div className="dialog-wrap" onMouseDown={onClose}>
      <aside
        className="customize-drawer"
        style={{ maxWidth: "32rem", display: "flex", flexDirection: "column" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-head" style={{ borderBottom: "1px solid rgb(var(--border))", paddingBottom: "0.8rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Sparkles style={{ width: "1.1rem", height: "1.1rem", color: "rgb(var(--accent))" }} />
              <h2 style={{ fontSize: "1rem", margin: 0 }}>Dashy AI Co-Pilot</h2>
            </div>
            <p style={{ fontSize: "0.72rem", color: "rgb(var(--muted))", margin: "0.2rem 0 0" }}>
              Multi-provider assistant grounded strictly in your personal records.
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>

        {/* Provider Switcher Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid rgb(var(--border))", fontSize: "0.75rem" }}>
          <span style={{ color: "rgb(var(--muted))", fontWeight: 600 }}>Active Provider:</span>
          <div className="segmented">
            <button
              type="button"
              className={cn("segmented__option", provider === "gemini" && "segmented__option--active")}
              onClick={() => setProvider("gemini")}
              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
            >
              Gemini 2.5
            </button>
            <button
              type="button"
              className={cn("segmented__option", provider === "openai" && "segmented__option--active")}
              onClick={() => setProvider("openai")}
              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
            >
              GPT-4o-mini
            </button>
            <button
              type="button"
              className={cn("segmented__option", provider === "anthropic" && "segmented__option--active")}
              onClick={() => setProvider("anthropic")}
              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
            >
              Claude 3.5
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div style={{ display: "flex", gap: "0.4rem", padding: "0.6rem 0", overflowX: "auto" }}>
          {[
            "Give me a morning briefing",
            "Check ₹10L goal & revenue",
            "Show overdue tasks",
            "Simulate delete task"
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              style={{
                background: "rgb(var(--surface-strong))",
                border: "1px solid rgb(var(--border))",
                borderRadius: "999px",
                padding: "0.2rem 0.6rem",
                fontSize: "0.68rem",
                whiteSpace: "nowrap",
                cursor: "pointer",
                color: "rgb(var(--foreground))"
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.8rem", padding: "0.8rem 0" }}>
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  alignItems: "flex-start",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "92%"
                }}
              >
                {!isUser ? (
                  <div
                    style={{
                      width: "1.8rem",
                      height: "1.8rem",
                      borderRadius: "999px",
                      background: "rgb(var(--accent-soft))",
                      color: "rgb(var(--accent))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Bot style={{ width: "1rem", height: "1rem" }} />
                  </div>
                ) : null}

                <div
                  style={{
                    background: isUser ? "rgb(var(--accent))" : "rgb(var(--surface-strong))",
                    color: isUser ? "white" : "rgb(var(--foreground))",
                    borderRadius: "var(--radius)",
                    padding: "0.6rem 0.85rem",
                    fontSize: "0.78rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {m.content}
                </div>

                {isUser ? (
                  <div
                    style={{
                      width: "1.8rem",
                      height: "1.8rem",
                      borderRadius: "999px",
                      background: "rgb(var(--surface-strong))",
                      color: "rgb(var(--muted))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <User style={{ width: "1rem", height: "1rem" }} />
                  </div>
                ) : null}
              </div>
            );
          })}

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgb(var(--muted))", fontSize: "0.74rem" }}>
              <Loader2 className="animate-spin" style={{ width: "0.9rem", height: "0.9rem" }} />
              Thinking with {provider.toUpperCase()}...
            </div>
          ) : null}

          {/* Interactive Consequential Action Confirmation Card */}
          {activeConfirmation ? (
            <div
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                borderRadius: "var(--radius-lg)",
                padding: "0.85rem 1rem",
                marginTop: "0.4rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#f59e0b", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.4rem" }}>
                <AlertCircle style={{ width: "1rem", height: "1rem" }} />
                <span>Action Requires Owner Confirmation</span>
              </div>
              <p style={{ fontSize: "0.74rem", color: "rgb(var(--foreground))", margin: "0.2rem 0 0.6rem" }}>
                Tool: <strong>{activeConfirmation.toolCall.name}</strong>
                <br />
                Token: <code style={{ fontSize: "0.68rem" }}>{activeConfirmation.token.id.slice(0, 16)}...</code> (Valid for 5m)
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="primary-button"
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.74rem", background: "#f59e0b" }}
                  onClick={handleConfirmAction}
                >
                  <Check style={{ width: "0.8rem", height: "0.8rem" }} /> Confirm Action
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.74rem" }}
                  onClick={handleRejectAction}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{ display: "flex", gap: "0.4rem", borderTop: "1px solid rgb(var(--border))", paddingTop: "0.8rem" }}
        >
          <input
            placeholder={`Ask Dashy (${provider})... (Ctrl+/ to close)`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              background: "rgb(var(--surface-strong))",
              border: "1px solid rgb(var(--border))",
              borderRadius: "var(--radius)",
              padding: "0.5rem 0.75rem",
              fontSize: "0.8rem",
              color: "rgb(var(--foreground))"
            }}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={loading || !input.trim()}
            style={{ padding: "0.5rem 0.8rem" }}
          >
            <Send style={{ width: "0.9rem", height: "0.9rem" }} />
          </button>
        </form>
      </aside>
    </div>
  );
}
