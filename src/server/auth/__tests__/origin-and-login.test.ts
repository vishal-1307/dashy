import { describe, expect, it } from "vitest";
// @ts-expect-error internal better-auth module without types
import { matchesOriginPattern } from "../../../../node_modules/better-auth/dist/auth/trusted-origins.mjs";
import { captchaHeaders, turnstileConfigured } from "@/features/auth/turnstile-utils";

describe("Dashy Origin Resolution and Captcha Guardrails", () => {
  describe("Trusted Origin Matching", () => {
    const devTrustedOrigins = [
      "http://localhost:3000",
      "http://localhost:*",
      "http://127.0.0.1:*",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002"
    ];

    it("accepts requests from standard port 3000", () => {
      const origin = "http://localhost:3000";
      const matches = devTrustedOrigins.some((pattern) => matchesOriginPattern(origin, pattern));
      expect(matches).toBe(true);
    });

    it("accepts requests from alternate development port 3001 (prevents login hang)", () => {
      const origin = "http://localhost:3001";
      const matches = devTrustedOrigins.some((pattern) => matchesOriginPattern(origin, pattern));
      expect(matches).toBe(true);
    });

    it("accepts requests from alternate development port 3002", () => {
      const origin = "http://localhost:3002";
      const matches = devTrustedOrigins.some((pattern) => matchesOriginPattern(origin, pattern));
      expect(matches).toBe(true);
    });

    it("accepts requests from 127.0.0.1 on any port", () => {
      const origin = "http://127.0.0.1:3001";
      const matches = devTrustedOrigins.some((pattern) => matchesOriginPattern(origin, pattern));
      expect(matches).toBe(true);
    });

    it("rejects untrusted external domains (prevents CSRF and domain hijacking)", () => {
      const untrustedOrigins = [
        "http://attacker.com",
        "https://evil-site.org",
        "http://localhost.evil.com",
        "http://127.0.0.1.attacker.net"
      ];
      for (const origin of untrustedOrigins) {
        const matches = devTrustedOrigins.some((pattern) => matchesOriginPattern(origin, pattern));
        expect(matches).toBe(false);
      }
    });
  });

  describe("Turnstile Header Construction", () => {
    it("returns x-captcha-response header when token is provided", () => {
      expect(captchaHeaders("valid-token-xyz")).toEqual({
        "x-captcha-response": "valid-token-xyz"
      });
    });

    it("returns empty object when token is empty", () => {
      expect(captchaHeaders("")).toEqual({});
    });

    it("reports turnstileConfigured as boolean", () => {
      expect(typeof turnstileConfigured).toBe("boolean");
    });
  });
});
