import { describe, expect, it } from "vitest";
import {
  computePayloadHash,
  deterministicJsonString,
  issueConfirmationToken,
  TOKEN_EXPIRY_MS,
  verifyConfirmationToken
} from "../confirmation";

describe("AI Confirmation Token Security & Anti-Tamper Protocol", () => {
  it("produces identical deterministic JSON and SHA-256 hash regardless of object key order", () => {
    const payloadA = { amount: 50000, clientId: "cli_123", invoiceNumber: "INV-001" };
    const payloadB = { invoiceNumber: "INV-001", amount: 50000, clientId: "cli_123" };

    const strA = deterministicJsonString(payloadA);
    const strB = deterministicJsonString(payloadB);

    expect(strA).toBe(strB);
    expect(computePayloadHash(payloadA)).toBe(computePayloadHash(payloadB));
  });

  it("issues a valid token with 5-minute expiry", () => {
    const payload = { taskId: "task_456" };
    const token = issueConfirmationToken("user_owner", "deleteTask", payload);

    expect(token.id).toMatch(/^tok_/);
    expect(token.userId).toBe("user_owner");
    expect(token.toolName).toBe("deleteTask");
    expect(token.usedAt).toBeNull();
    expect(token.expiresAt.getTime() - token.issuedAt.getTime()).toBe(TOKEN_EXPIRY_MS);
  });

  it("successfully verifies an untouched token within the 5-minute window", () => {
    const payload = { taskId: "task_456" };
    const token = issueConfirmationToken("user_owner", "deleteTask", payload);

    const result = verifyConfirmationToken(token, payload, "user_owner");
    expect(result.valid).toBe(true);
  });

  it("rejects verification if token has expired", () => {
    const payload = { taskId: "task_456" };
    const token = issueConfirmationToken("user_owner", "deleteTask", payload);

    // Simulated 6 minutes later
    const future = new Date(Date.now() + 6 * 60 * 1000);
    const result = verifyConfirmationToken(token, payload, "user_owner", future);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("EXPIRED");
    }
  });

  it("rejects verification if token has already been marked used", () => {
    const payload = { taskId: "task_456" };
    const token = issueConfirmationToken("user_owner", "deleteTask", payload);
    token.usedAt = new Date();

    const result = verifyConfirmationToken(token, payload, "user_owner");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("ALREADY_USED");
    }
  });

  it("rejects verification if payload arguments were tampered with", () => {
    const originalPayload = { taskId: "task_456", force: false };
    const token = issueConfirmationToken("user_owner", "deleteTask", originalPayload);

    const tamperedPayload = { taskId: "task_456", force: true };
    const result = verifyConfirmationToken(token, tamperedPayload, "user_owner");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("PAYLOAD_TAMPERED");
    }
  });

  it("rejects verification if attempted by a different user id", () => {
    const payload = { taskId: "task_456" };
    const token = issueConfirmationToken("user_owner", "deleteTask", payload);

    const result = verifyConfirmationToken(token, payload, "attacker_user");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("UNAUTHORIZED_USER");
    }
  });
});
