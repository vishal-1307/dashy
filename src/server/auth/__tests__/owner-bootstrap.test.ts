import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACES,
  timingSafeCompare,
  validateOwnerRegistration
} from "../owner-bootstrap";

describe("Single-Owner Bootstrap & Registration Security Guardrails", () => {
  const validConfig = {
    ownerEmail: "owner@dashy.local",
    bootstrapToken: "high-entropy-secure-token-9876543210"
  };

  it("defines exactly the 5 approved business workspaces", () => {
    expect(DEFAULT_WORKSPACES).toHaveLength(5);
    const slugs = DEFAULT_WORKSPACES.map((w) => w.slug);
    expect(slugs).toEqual([
      "freelance-software",
      "dkom",
      "diamond-jewellers",
      "mithila-kritikala",
      "personal"
    ]);

    const dkom = DEFAULT_WORKSPACES.find((w) => w.slug === "dkom");
    expect(dkom?.name).toBe("DKOM");
    expect(dkom?.description).toContain("Mithila paintings");
  });

  describe("validateOwnerRegistration Policy", () => {
    it("permits owner registration when 0 users exist and all credentials match", () => {
      const result = validateOwnerRegistration(
        "owner@dashy.local",
        "high-entropy-secure-token-9876543210",
        validConfig,
        0
      );
      expect(result.allowed).toBe(true);
    });

    it("is case-insensitive and trims whitespace on owner email matching", () => {
      const result = validateOwnerRegistration(
        "  OWNER@DASHY.LOCAL  ",
        "high-entropy-secure-token-9876543210",
        validConfig,
        0
      );
      expect(result.allowed).toBe(true);
    });

    it("fails closed when OWNER_EMAIL is not configured on the server", () => {
      const configNoEmail = { ownerEmail: "", bootstrapToken: "token" };
      const result = validateOwnerRegistration(
        "owner@dashy.local",
        "token",
        configNoEmail,
        0
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("OWNER_EMAIL is not configured");
    });

    it("fails closed when OWNER_BOOTSTRAP_TOKEN is not configured on the server", () => {
      const configNoToken = { ownerEmail: "owner@dashy.local", bootstrapToken: "" };
      const result = validateOwnerRegistration(
        "owner@dashy.local",
        "some-token",
        configNoToken,
        0
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("OWNER_BOOTSTRAP_TOKEN is not configured");
    });

    it("rejects unauthorized email addresses", () => {
      const result = validateOwnerRegistration(
        "attacker@malicious.com",
        "high-entropy-secure-token-9876543210",
        validConfig,
        0
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Unauthorized email address");
    });

    it("rejects registration when bootstrap token is missing", () => {
      const result = validateOwnerRegistration(
        "owner@dashy.local",
        undefined,
        validConfig,
        0
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Invalid or missing owner bootstrap token");
    });

    it("rejects registration when bootstrap token is incorrect", () => {
      const result = validateOwnerRegistration(
        "owner@dashy.local",
        "wrong-token",
        validConfig,
        0
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Invalid or missing owner bootstrap token");
    });

    it("permanently locks registration once 1 or more users exist (duplicate init prevention)", () => {
      const result1 = validateOwnerRegistration(
        "owner@dashy.local",
        "high-entropy-secure-token-9876543210",
        validConfig,
        1
      );
      expect(result1.allowed).toBe(false);
      expect(result1.reason).toContain("Registration is permanently closed");

      const result5 = validateOwnerRegistration(
        "owner@dashy.local",
        "high-entropy-secure-token-9876543210",
        validConfig,
        5
      );
      expect(result5.allowed).toBe(false);
      expect(result5.reason).toContain("Registration is permanently closed");
    });
  });

  describe("timingSafeCompare", () => {
    it("returns true for identical strings", () => {
      expect(timingSafeCompare("secret-token-xyz", "secret-token-xyz")).toBe(true);
    });

    it("returns false for different strings of same length", () => {
      expect(timingSafeCompare("secret-token-abc", "secret-token-xyz")).toBe(false);
    });

    it("returns false for different strings of different lengths", () => {
      expect(timingSafeCompare("short", "much-longer-string")).toBe(false);
    });

    it("returns false for empty vs non-empty strings", () => {
      expect(timingSafeCompare("", "token")).toBe(false);
    });
  });
});
