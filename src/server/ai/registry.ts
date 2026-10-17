import { issueConfirmationToken } from "./confirmation";
import type { AiToolCall } from "./types";

export const CONSEQUENTIAL_TOOLS = new Set([
  "deleteTask",
  "deleteProject",
  "createInvoice",
  "recordExpense",
  "recordPayment",
  "bulkUpdateTasks"
]);

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: "getWorkspaceSummary",
    description: "Returns aggregated statistics: active tasks, overdue deadlines, urgent leads, and cash metrics.",
    parameters: {
      type: "object",
      properties: {
        workspace: { type: "string", description: "Workspace slug or 'unified'" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "searchTasks",
    description: "Search tasks by query keywords, status (planned, active, done), priority, or workspace.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: { type: "string" },
        workspace: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "createTask",
    description: "Create a new task in a specified workspace.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        dueDate: { type: "string", description: "YYYY-MM-DD" },
        workspace: { type: "string" }
      },
      required: ["title"]
    },
    requiresConfirmation: false
  },
  {
    name: "updateTask",
    description: "Update an existing task status, progress, due date, or priority.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "string" },
        progress: { type: "number" },
        dueDate: { type: "string" }
      },
      required: ["id"]
    },
    requiresConfirmation: false
  },
  {
    name: "deleteTask",
    description: "Permanently delete a task. REQUIRES EXPLICIT USER CONFIRMATION.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" }
      },
      required: ["id"]
    },
    requiresConfirmation: true
  },
  {
    name: "searchProjects",
    description: "List projects, milestones, and blockers for a workspace.",
    parameters: {
      type: "object",
      properties: {
        workspace: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "createProject",
    description: "Create a new project roadmap.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string" },
        deadline: { type: "string" },
        workspace: { type: "string" }
      },
      required: ["title"]
    },
    requiresConfirmation: false
  },
  {
    name: "deleteProject",
    description: "Permanently delete a project and linked milestones. REQUIRES CONFIRMATION.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" }
      },
      required: ["id"]
    },
    requiresConfirmation: true
  },
  {
    name: "getCrmLeads",
    description: "List client leads, deal values, and scheduled follow-up dates.",
    parameters: {
      type: "object",
      properties: {
        workspace: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "createClient",
    description: "Log a new prospective client lead in the CRM.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        company: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        dealValue: { type: "number" },
        nextFollowUpAt: { type: "string" },
        workspace: { type: "string" }
      },
      required: ["name"]
    },
    requiresConfirmation: false
  },
  {
    name: "getFinancialSummary",
    description: "Compute invoiced revenue, collected cash, outstanding balance, expenses, and net profit.",
    parameters: {
      type: "object",
      properties: {
        workspace: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "createInvoice",
    description: "Generate a new client billing invoice. REQUIRES CONFIRMATION.",
    parameters: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string" },
        clientId: { type: "string" },
        totalAmount: { type: "number" },
        dueAt: { type: "string" },
        workspace: { type: "string" }
      },
      required: ["invoiceNumber", "totalAmount", "dueAt"]
    },
    requiresConfirmation: true
  },
  {
    name: "recordExpense",
    description: "Record a business expense. REQUIRES CONFIRMATION.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        category: { type: "string" },
        description: { type: "string" },
        workspace: { type: "string" }
      },
      required: ["amount", "category"]
    },
    requiresConfirmation: true
  },
  {
    name: "recordPayment",
    description: "Record an invoice payment or direct revenue. REQUIRES CONFIRMATION.",
    parameters: {
      type: "object",
      properties: {
        invoiceId: { type: "string" },
        amount: { type: "number" },
        paymentMethod: { type: "string" }
      },
      required: ["amount"]
    },
    requiresConfirmation: true
  },
  {
    name: "searchJobApplications",
    description: "Search tracked job applications and interview rounds.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "searchNotes",
    description: "Full-text search in Markdown documentation, folders, and tags.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    },
    requiresConfirmation: false
  },
  {
    name: "getCalendarAgenda",
    description: "Retrieve agenda events, tasks due, and follow-ups for a date range.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "generateDailyBriefing",
    description: "Synthesize today's morning briefing: priorities, appointments, and pending follow-ups.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string" }
      }
    },
    requiresConfirmation: false
  },
  {
    name: "bulkUpdateTasks",
    description: "Modify status or due dates for multiple tasks simultaneously. REQUIRES CONFIRMATION.",
    parameters: {
      type: "object",
      properties: {
        taskIds: { type: "array", items: { type: "string" } },
        status: { type: "string" }
      },
      required: ["taskIds", "status"]
    },
    requiresConfirmation: true
  }
];

/**
 * Prepares a tool call for execution, generating a cryptographic confirmation token if the tool is consequential.
 */
export function prepareToolCall(
  userId: string,
  toolName: string,
  rawArgs: Record<string, unknown>
): AiToolCall {
  const requiresConfirmation = CONSEQUENTIAL_TOOLS.has(toolName);
  let confirmationTokenId: string | undefined = undefined;

  if (requiresConfirmation) {
    const token = issueConfirmationToken(userId, toolName, rawArgs);
    confirmationTokenId = token.id;
  }

  return {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: toolName,
    arguments: rawArgs,
    requiresConfirmation,
    confirmationTokenId
  };
}
