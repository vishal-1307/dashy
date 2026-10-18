import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers())
}));

// Mock better-auth
const mockGetSession = vi.fn();
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args)
    }
  }
}));

import {
  requireOwnerSession,
  requireUserId,
  UnauthenticatedError,
  UnauthorizedOwnerError
} from "../../session";
import {
  createConfirmationTokenAction,
  verifyConfirmationTokenAction
} from "../../actions/ai-actions";

describe("Session & AI Action Authorization Guardrails", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("requireOwnerSession & requireUserId Fail-Closed Invariants", () => {
    it("throws UnauthenticatedError when session does not exist", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue(null);

      await expect(requireOwnerSession()).rejects.toThrow(UnauthenticatedError);
      await expect(requireUserId()).rejects.toThrow(UnauthenticatedError);
    });

    it("throws UnauthorizedOwnerError when OWNER_EMAIL is missing from environment (fails closed)", async () => {
      delete process.env.OWNER_EMAIL;
      mockGetSession.mockResolvedValue({
        user: { id: "user_123", email: "random@user.com" }
      });

      await expect(requireOwnerSession()).rejects.toThrow(UnauthorizedOwnerError);
      await expect(requireOwnerSession()).rejects.toThrow("Server security misconfiguration: OWNER_EMAIL is not configured.");
    });

    it("throws UnauthorizedOwnerError when session email does not match OWNER_EMAIL", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue({
        user: { id: "user_attacker", email: "attacker@malicious.com" }
      });

      await expect(requireOwnerSession()).rejects.toThrow(UnauthorizedOwnerError);
      await expect(requireOwnerSession()).rejects.toThrow("Access restricted to authorized owner only.");
    });

    it("returns userId and email when session belongs to the verified owner", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue({
        user: { id: "user_legit_owner", email: "owner@dashy.local" }
      });

      const session = await requireOwnerSession();
      expect(session.userId).toBe("user_legit_owner");
      expect(session.email).toBe("owner@dashy.local");

      const uid = await requireUserId();
      expect(uid).toBe("user_legit_owner");
    });
  });

  describe("AI Confirmation Server Actions (No 'owner' Fallback)", () => {
    it("rejects token creation when unauthenticated (does NOT fallback to 'owner')", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue(null);

      await expect(
        createConfirmationTokenAction("deleteTask", { taskId: "task_123" })
      ).rejects.toThrow(UnauthenticatedError);
    });

    it("rejects token verification when unauthenticated (does NOT fallback to 'owner')", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue(null);

      const fakeToken = {
        id: "tok_123",
        userId: "owner",
        toolName: "deleteTask",
        payloadHash: "abc",
        rawPayload: { taskId: "task_123" },
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null
      };

      await expect(
        verifyConfirmationTokenAction(fakeToken, { taskId: "task_123" })
      ).rejects.toThrow(UnauthenticatedError);
    });

    it("rejects token creation when caller is an unauthorized user", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue({
        user: { id: "user_attacker", email: "attacker@malicious.com" }
      });

      await expect(
        createConfirmationTokenAction("deleteTask", { taskId: "task_123" })
      ).rejects.toThrow(UnauthorizedOwnerError);
    });

    it("issues valid token bound to the authenticated owner's real userId", async () => {
      process.env.OWNER_EMAIL = "owner@dashy.local";
      mockGetSession.mockResolvedValue({
        user: { id: "user_owner_real_id", email: "owner@dashy.local" }
      });

      const token = await createConfirmationTokenAction("deleteTask", { taskId: "task_123" });
      expect(token.userId).toBe("user_owner_real_id");
      expect(token.toolName).toBe("deleteTask");
      expect(token.userId).not.toBe("owner");
    });
  });
});
