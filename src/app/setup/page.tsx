"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { bootstrapOwnerAction, getSetupStatusAction } from "@/server/actions/bootstrap";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [setupRequired, setSetupRequired] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [hasOwnerEmail, setHasOwnerEmail] = useState(true);
  const [hasBootstrapToken, setHasBootstrapToken] = useState(true);

  const defaultWorkspaces = [
    { title: "Freelance & Software Development", desc: "Client software builds, website contracts, and client invoices", dot: "#2563eb" },
    { title: "DKOM", desc: "Mithila art brand, hand-painted apparel, and product inventory", dot: "#e11d48" },
    { title: "Diamond Jewellers", desc: "Jewellery catalogue, marketing, and business records", dot: "#d97706" },
    { title: "Mithila KritiKala", desc: "NGO artisan training, society documentation, and grant proposals", dot: "#059669" },
    { title: "Personal", desc: "College coursework, cybersecurity certifications, and life goals", dot: "#4f46e5" }
  ];

  useEffect(() => {
    let mounted = true;
    getSetupStatusAction()
      .then((status) => {
        if (!mounted) return;
        setSetupRequired(status.setupRequired);
        setHasOwnerEmail(status.hasOwnerEmail);
        setHasBootstrapToken(status.hasBootstrapToken);
        if (status.configuredOwnerEmail) {
          setEmail(status.configuredOwnerEmail);
        }
      })
      .catch(() => {
        // Fall back to allowing form entry
      })
      .finally(() => {
        if (mounted) setCheckingStatus(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !bootstrapToken.trim()) {
      toast.error("Please fill in all required setup credentials");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      const res = await bootstrapOwnerAction({
        email: email.trim(),
        password,
        bootstrapToken: bootstrapToken.trim()
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setCompleted(true);
      toast.success(res.message);
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

        {checkingStatus ? (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "rgb(var(--muted))" }}>
            Checking initialization status...
          </div>
        ) : !setupRequired ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <AlertTriangle style={{ width: "2.5rem", height: "2.5rem", color: "#f59e0b", margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700 }}>Setup Already Completed</h2>
            <p style={{ fontSize: "0.82rem", color: "rgb(var(--muted))", maxWidth: "24rem", margin: "0.5rem auto 1.5rem" }}>
              The single-owner account is already initialized. Public registration is permanently closed.
            </p>
            <Link href="/login" className="primary-button" style={{ display: "inline-block", margin: "0 auto" }}>
              Sign In to Dashy
            </Link>
          </div>
        ) : completed ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <CheckCircle2 style={{ width: "3rem", height: "3rem", color: "#10b981", margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Initialization Complete!</h2>
            <p style={{ fontSize: "0.82rem", color: "rgb(var(--muted))", maxWidth: "24rem", margin: "0.5rem auto 1.5rem" }}>
              Your owner account and 5 dedicated workspaces are initialized. Public registration has been permanently closed.
            </p>
            <button className="primary-button" style={{ margin: "0 auto" }} onClick={() => router.push("/login")}>
              Proceed to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleBootstrap} style={{ display: "grid", gap: "1rem" }}>
            {(!hasOwnerEmail || !hasBootstrapToken) && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: "var(--radius)",
                  padding: "0.85rem 1rem",
                  fontSize: "0.78rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "#ef4444" }}>
                  <AlertTriangle style={{ width: "1rem", height: "1rem" }} />
                  <span>Server Environment Configuration Needed</span>
                </div>
                <p style={{ margin: "0.4rem 0 0", color: "rgb(var(--foreground))", lineHeight: 1.5 }}>
                  The server is missing required configuration:
                  {!hasOwnerEmail && <strong> OWNER_EMAIL is not set.</strong>}
                  {!hasBootstrapToken && <strong> OWNER_BOOTSTRAP_TOKEN is not set.</strong>}
                  {" "}Please configure them in your <code>.env</code> file before submitting setup.
                </p>
              </div>
            )}

            <div style={{ background: "rgba(var(--accent), 0.08)", border: "1px solid rgba(var(--accent), 0.2)", borderRadius: "var(--radius)", padding: "0.8rem 1rem", fontSize: "0.76rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "rgb(var(--accent))" }}>
                <KeyRound style={{ width: "0.95rem", height: "0.95rem" }} />
                <span>Security Gate Notice</span>
              </div>
              <p style={{ margin: "0.3rem 0 0", color: "rgb(var(--foreground))", lineHeight: 1.5 }}>
                Setup requires your high-entropy <code>OWNER_BOOTSTRAP_TOKEN</code> and configured <code>OWNER_EMAIL</code>. Once initialized, all public registration paths are permanently closed.
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
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      background: "rgb(var(--surface-strong))",
                      border: "1px solid rgb(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: "0.74rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          width: "0.6rem",
                          height: "0.6rem",
                          borderRadius: "999px",
                          backgroundColor: ws.dot,
                          display: "inline-block"
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{ws.title}</span>
                    </div>
                    <span style={{ color: "rgb(var(--muted))", fontSize: "0.68rem" }}>Default Domain</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-button"
              style={{
                width: "100%",
                marginTop: "0.5rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                padding: "0.65rem 1rem",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              <Lock style={{ width: "0.95rem", height: "0.95rem" }} />
              {loading ? "Initializing..." : "Complete Setup & Initialize Workspaces"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
