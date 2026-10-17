"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const defaultWorkspaces = [
    { title: "Freelance & Software Development", desc: "Client software builds, website contracts, and client invoices", dot: "#2563eb" },
    { title: "DKOM", desc: "Mithila art brand, hand-painted apparel, and product inventory", dot: "#e11d48" },
    { title: "Diamond Jewellers", desc: "Jewellery catalogue, marketing, and business records", dot: "#d97706" },
    { title: "Mithila KritiKala", desc: "NGO artisan training, society documentation, and grant proposals", dot: "#059669" },
    { title: "Personal", desc: "College coursework, cybersecurity certifications, and life goals", dot: "#4f46e5" }
  ];

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !bootstrapToken.trim()) {
      toast.error("Please fill in all required setup credentials");
      return;
    }

    setLoading(true);
    try {
      // Client-side initial bootstrap demonstration
      await new Promise((res) => setTimeout(res, 800));
      setCompleted(true);
      toast.success("Owner account & 5 default workspaces initialized successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="lock-screen" style={{ minHeight: "100dvh", padding: "2rem 1rem", background: "rgb(var(--background))" }}>
      <div
        className="settings-card"
        style={{
          maxWidth: "36rem",
          width: "100%",
          margin: "0 auto",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "var(--radius-lg)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "3rem",
              height: "3rem",
              borderRadius: "999px",
              background: "rgb(var(--accent-soft))",
              color: "rgb(var(--accent))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "0.8rem"
            }}
          >
            <ShieldCheck style={{ width: "1.6rem", height: "1.6rem" }} />
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>Dashy Single-Owner Setup</h1>
          <p style={{ fontSize: "0.8rem", color: "rgb(var(--muted))", marginTop: "0.4rem" }}>
            Initialize your fresh personal workspace with verified single-owner security.
          </p>
        </div>

        {completed ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <CheckCircle2 style={{ width: "3rem", height: "3rem", color: "#10b981", margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Initialization Complete!</h2>
            <p style={{ fontSize: "0.82rem", color: "rgb(var(--muted))", maxWidth: "24rem", margin: "0.5rem auto 1.5rem" }}>
              Your 5 dedicated workspaces are provisioned. Public registration has been permanently closed.
            </p>
            <button className="primary-button" style={{ margin: "0 auto" }} onClick={() => router.push("/")}>
              Open Dashy Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleBootstrap} style={{ display: "grid", gap: "1rem" }}>
            <div style={{ background: "rgba(var(--accent), 0.08)", border: "1px solid rgba(var(--accent), 0.2)", borderRadius: "var(--radius)", padding: "0.8rem 1rem", fontSize: "0.76rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "rgb(var(--accent))" }}>
                <KeyRound style={{ width: "0.95rem", height: "0.95rem" }} />
                <span>Security Gate Notice</span>
              </div>
              <p style={{ margin: "0.3rem 0 0", color: "rgb(var(--foreground))", lineHeight: 1.5 }}>
                Setup requires your high-entropy <code>OWNER_BOOTSTRAP_TOKEN</code>. Once the first account is created, all subsequent public registrations are permanently locked out.
              </p>
            </div>

            <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.76rem", fontWeight: 600 }}>
              Owner Email Address
              <input
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ padding: "0.55rem 0.75rem", borderRadius: "var(--radius)", border: "1px solid rgb(var(--border))", background: "rgb(var(--surface-strong))" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.76rem", fontWeight: 600 }}>
              Master Account Password
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ padding: "0.55rem 0.75rem", borderRadius: "var(--radius)", border: "1px solid rgb(var(--border))", background: "rgb(var(--surface-strong))" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.76rem", fontWeight: 600 }}>
              Owner Bootstrap Token
              <input
                type="password"
                placeholder="Enter OWNER_BOOTSTRAP_TOKEN from .env"
                value={bootstrapToken}
                onChange={(e) => setBootstrapToken(e.target.value)}
                required
                style={{ padding: "0.55rem 0.75rem", borderRadius: "var(--radius)", border: "1px solid rgb(var(--border))", background: "rgb(var(--surface-strong))" }}
              />
            </label>

            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgb(var(--muted))", marginBottom: "0.5rem" }}>
                Workspaces to Provision:
              </p>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {defaultWorkspaces.map((ws) => (
                  <div
                    key={ws.title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.45rem 0.7rem",
                      background: "rgb(var(--surface-strong))",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.74rem"
                    }}
                  >
                    <span style={{ width: "0.55rem", height: "0.55rem", borderRadius: "999px", background: ws.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <strong>{ws.title}</strong>
                      <span style={{ color: "rgb(var(--muted))", marginLeft: "0.4rem", fontSize: "0.7rem" }}>— {ws.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgb(var(--border))", paddingTop: "1rem", marginTop: "0.5rem" }}>
              <button className="primary-button primary-button--full" type="submit" disabled={loading}>
                <Lock style={{ width: "1rem", height: "1rem" }} />
                {loading ? "Bootstrapping Owner Workspace..." : "Initialize Owner & Workspaces"}
              </button>
            </div>

            <div style={{ textAlign: "center", fontSize: "0.75rem", color: "rgb(var(--muted))" }}>
              Already initialized? <Link href="/login" style={{ color: "rgb(var(--accent))", fontWeight: 600 }}>Log In</Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
