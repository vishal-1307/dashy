import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACES, validateOwnerRegistration } from "../owner-bootstrap";

describe("Single-Owner Bootstrap & Registration Validation", () => {
  const config = {
    ownerEmail: "owner@dashy.local",
    bootstrapToken: "secure-secret-token-12345"
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

  it("permits owner registration when 0 users exist and credentials match", () => {
    const result = validateOwnerRegistration(
      "owner@dashy.local",
      "secure-secret-token-12345",
      config,
      0
    );
    expect(result.allowed).toBe(true);
  });

  it("is case-insensitive for owner email matching", () => {
    const result = validateOwnerRegistration(
      "OWNER@DASHY.LOCAL",
      "secure-secret-token-12345",
      config,
      0
    );
    expect(result.allowed).toBe(true);
  });

  it("permanently locks registration once 1 or more users exist", () => {
    const result = validateOwnerRegistration(
      "owner@dashy.local",
      "secure-secret-token-12345",
      config,
      1
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("permanently closed");
  });

  it("rejects unauthorized email addresses", () => {
    const result = validateOwnerRegistration(
      "attacker@example.com",
      "secure-secret-token-12345",
      config,
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unauthorized email");
  });

  it("rejects invalid bootstrap token when token is configured", () => {
    const result = validateOwnerRegistration(
      "owner@dashy.local",
      "wrong-token",
      config,
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("bootstrap token");
  });

  it("fails securely when OWNER_EMAIL is empty or not configured", () => {
    const emptyConfig = { ownerEmail: "", bootstrapToken: "token" };
    const result = validateOwnerRegistration("any@email.com", "token", emptyConfig, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("missing");
  });
});
