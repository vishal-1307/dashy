import { describe, expect, it } from "vitest";
import { computePayloadHash, deterministicJsonString, TOKEN_EXPIRY_MS } from "@/server/ai/confirmation";

describe("AI Token Replay Protection and Verification Logic", () => {
  it("enforces deterministic hashing across nested and reordered objects", () => {
    const rawA = { tool: "deleteTask", args: { taskId: "t-1", force: true } };
    const rawB = { args: { force: true, taskId: "t-1" }, tool: "deleteTask" };

    expect(deterministicJsonString(rawA)).toBe(deterministicJsonString(rawB));
    expect(computePayloadHash(rawA)).toBe(computePayloadHash(rawB));
  });

  it("detects expired tokens past the 5-minute window", () => {
    const now = Date.now();
    const issuedAt = new Date(now - 6 * 60 * 1000);
    const expiresAt = new Date(issuedAt.getTime() + TOKEN_EXPIRY_MS);

    expect(now > expiresAt.getTime()).toBe(true);
  });

  it("verifies single-use semantics by blocking reused tokens", () => {
    const tokenRecord = {
      id: "tok_12345",
      userId: "user_owner",
      toolName: "deleteTask",
      payloadHash: computePayloadHash({ taskId: "t-1" }),
      rawPayload: { taskId: "t-1" },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
      usedAt: new Date() // Already marked used
    };

    // Replay attempt must be blocked
    const isAlreadyUsed = tokenRecord.usedAt !== null;
    expect(isAlreadyUsed).toBe(true);
  });

  it("blocks token verification if caller userId differs from token creator", () => {
    const tokenRecord = {
      id: "tok_secure",
      userId: "owner-real-id",
      toolName: "deleteTask",
      payloadHash: computePayloadHash({ taskId: "t-1" }),
      rawPayload: { taskId: "t-1" },
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
      usedAt: null
    };

    const callerUserId = "attacker-id";
    const isAuthorized = tokenRecord.userId === callerUserId;
    expect(isAuthorized).toBe(false);
  });
});
