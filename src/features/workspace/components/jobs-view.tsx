"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Building,
  Calendar,
  Plus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import {
  createJob,
  deleteJob as deleteJobAction,
  listJobs,
  updateJobStatus,
  type JobApplication,
  type JobStatus
} from "@/server/actions/jobs";

const JOB_STAGES: { key: JobStatus; label: string; color: string }[] = [
  { key: "SAVED", label: "Bookmarked / Saved", color: "border-slate-500" },
  { key: "APPLIED", label: "Applied", color: "border-blue-500" },
  { key: "SCREENING", label: "HR Screening", color: "border-cyan-500" },
  { key: "TECHNICAL", label: "Technical / Take-Home", color: "border-indigo-500" },
  { key: "INTERVIEW", label: "Final Interviews", color: "border-purple-500" },
  { key: "OFFER", label: "Offers Received", color: "border-emerald-500" },
  { key: "REJECTED", label: "Archived / Rejected", color: "border-rose-500" }
];

export function JobsView() {
  const today = new Date().toISOString().slice(0, 10);

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobApplication | null>(null);

  // Form state
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobType, setJobType] = useState<"REMOTE" | "HYBRID" | "ONSITE">("REMOTE");
  const [salary, setSalary] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("LinkedIn");
  const [status, setStatus] = useState<JobStatus>("APPLIED");
  const [currentStage, setCurrentStage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listJobs()
      .then((data) => {
        if (active) {
          setApplications(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load jobs:", err);
          toast.error("Could not load job applications from database");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      toast.error("Please provide company and role title");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createJob({
        company: company.trim(),
        role: role.trim(),
        jobType,
        salaryRange: salary.trim() || undefined,
        location: location.trim() || undefined,
        source: source.trim() || undefined,
        status,
        currentStage: currentStage.trim() || undefined,
        appliedAt: today,
        followUpDeadline: followUp || undefined,
        notes: notes.trim() || undefined
      });

      setApplications((prev) => [created, ...prev]);
      setShowAddModal(false);
      setCompany("");
      setRole("");
      setSalary("");
      setLocation("");
      setNotes("");
      toast.success(`Application for ${created.role} at ${created.company} saved to database`);
    } catch (err) {
      console.error("Create job error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to track application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (jobId: string, nextStatus: JobStatus) => {
    const previous = applications.find((a) => a.id === jobId);
    if (!previous || previous.status === nextStatus) return;

    // Optimistic update
    setApplications((prev) =>
      prev.map((app) => (app.id === jobId ? { ...app, status: nextStatus } : app))
    );
    if (selectedJob && selectedJob.id === jobId) {
      setSelectedJob({ ...selectedJob, status: nextStatus });
    }

    try {
      await updateJobStatus(jobId, nextStatus);
      toast.info(`Updated status to ${nextStatus}`);
    } catch (err) {
      console.error("Update job status error:", err);
      // Rollback
      setApplications((prev) =>
        prev.map((app) => (app.id === jobId ? previous : app))
      );
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(previous);
      }
      toast.error("Failed to update status in database");
    }
  };

  const handleDeleteJob = async (jobId: string, roleTitle: string, companyName: string) => {
    if (!confirm(`Delete application for ${roleTitle} at ${companyName}?`)) return;

    const previous = applications;
    setApplications((prev) => prev.filter((a) => a.id !== jobId));
    if (selectedJob?.id === jobId) {
      setSelectedJob(null);
    }

    try {
      await deleteJobAction(jobId);
      toast.success("Application deleted");
    } catch (err) {
      console.error("Delete job error:", err);
      setApplications(previous);
      toast.error("Failed to delete application from database");
    }
  };

  const activeApps = applications.filter((a) => a.status !== "REJECTED");
  const upcomingInterviews = applications.filter(
    (a) => a.status === "TECHNICAL" || a.status === "INTERVIEW"
  );

  return (
    <div className="jobs-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><Briefcase /></div>
        <div>
          <p className="eyebrow">Career & Opportunities / User-Level Tracker</p>
          <h1>Job Application Tracker</h1>
          <p>Database-backed career tracking across all workspaces. Track interview rounds, deadlines, and offer packages.</p>
        </div>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          <Plus /> Track Application
        </button>
      </section>

      {/* Metrics Strip */}
      <section className="signal-strip" style={{ marginBottom: "1.5rem" }}>
        <div className="signal">
          <strong>{applications.length}</strong>
          <span>Total Tracked</span>
          <small>lifetime opportunities</small>
        </div>
        <div className="signal">
          <strong style={{ color: "rgb(var(--accent))" }}>{activeApps.length}</strong>
          <span>Active Pipelines</span>
          <small>in progress</small>
        </div>
        <div className="signal">
          <strong style={{ color: "#8b5cf6" }}>{upcomingInterviews.length}</strong>
          <span>In Interviews</span>
          <small>rounds scheduled</small>
        </div>
        <div className="signal">
          <strong style={{ color: "#10b981" }}>
            {applications.filter((a) => a.status === "OFFER").length}
          </strong>
          <span>Offers</span>
          <small>negotiation phase</small>
        </div>
      </section>

      {/* Loading indicator */}
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "rgb(var(--muted))" }}>
          Loading job applications from database...
        </div>
      ) : (
        /* Kanban Board */
        <div className="kanban-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          {JOB_STAGES.map((col) => {
            const colApps = applications.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className="kanban-col" style={{ minHeight: "22rem" }}>
                <div className="kanban-col__head">
                  <h3>{col.label}</h3>
                  <span className="kanban-col__count">{colApps.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {colApps.map((job) => (
                    <div
                      key={job.id}
                      className="item-card"
                      style={{ padding: "0.85rem", cursor: "pointer" }}
                      onClick={() => setSelectedJob(job)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                        <strong style={{ fontSize: "0.88rem" }}>{job.role}</strong>
                        <span
                          style={{
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.4rem",
                            borderRadius: "999px",
                            background: "rgb(var(--surface-strong))",
                            color: "rgb(var(--accent))"
                          }}
                        >
                          {job.jobType}
                        </span>
                      </div>

                      <p style={{ fontSize: "0.76rem", color: "rgb(var(--muted))", display: "flex", alignItems: "center", gap: "0.3rem", margin: "0.2rem 0" }}>
                        <Building style={{ width: "0.75rem", height: "0.75rem" }} /> {job.company}
                      </p>

                      {job.salaryRange ? (
                        <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgb(var(--foreground))", margin: "0.2rem 0" }}>
                          💰 {job.salaryRange}
                        </p>
                      ) : null}

                      {job.currentStage ? (
                        <div
                          style={{
                            fontSize: "0.68rem",
                            background: "rgba(var(--accent), 0.1)",
                            color: "rgb(var(--accent))",
                            padding: "0.2rem 0.4rem",
                            borderRadius: "var(--radius-sm)",
                            marginTop: "0.4rem",
                            fontWeight: 600
                          }}
                        >
                          📍 {job.currentStage}
                        </div>
                      ) : null}

                      {job.followUpDeadline ? (
                        <div style={{ fontSize: "0.68rem", color: "rgb(var(--muted))", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.4rem" }}>
                          <Calendar style={{ width: "0.7rem", height: "0.7rem" }} /> Next: {job.followUpDeadline}
                        </div>
                      ) : null}

                      <div style={{ marginTop: "0.6rem" }} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={job.status}
                          onChange={(e) => handleUpdateStatus(job.id, e.target.value as JobStatus)}
                          style={{ fontSize: "0.68rem", padding: "0.2rem 0.4rem", width: "100%", background: "rgb(var(--surface-strong))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius-sm)" }}
                        >
                          {JOB_STAGES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {colApps.length === 0 ? (
                    <div style={{ padding: "1.2rem", textAlign: "center", color: "rgb(var(--muted))", fontSize: "0.72rem" }}>
                      No applications
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Application Modal */}
      {showAddModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowAddModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Opportunity</p>
                <h2>Track Job Application</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddJob} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <div className="form-grid">
                <label>
                  Company Name *
                  <input autoFocus placeholder="e.g. Google, Vercel" value={company} onChange={(e) => setCompany(e.target.value)} required />
                </label>
                <label>
                  Role Title *
                  <input placeholder="e.g. Senior Software Engineer" value={role} onChange={(e) => setRole(e.target.value)} required />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Job Type
                  <select value={jobType} onChange={(e) => setJobType(e.target.value as "REMOTE" | "HYBRID" | "ONSITE")}>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONSITE">Onsite</option>
                  </select>
                </label>
                <label>
                  Compensation / Salary Range
                  <input placeholder="e.g. ₹30L - ₹40L or $150k" value={salary} onChange={(e) => setSalary(e.target.value)} />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Application Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
                    {JOB_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Current Round / Stage
                  <input placeholder="e.g. Technical Screen, Take-home" value={currentStage} onChange={(e) => setCurrentStage(e.target.value)} />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Source / Referral
                  <input placeholder="e.g. LinkedIn, Referral" value={source} onChange={(e) => setSource(e.target.value)} />
                </label>
                <label>
                  Follow-up Deadline
                  <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </label>
              </div>

              <label>
                Notes & Prep Links
                <textarea placeholder="e.g. Interviewer names, company tech stack, key talking points" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>

              <button className="primary-button primary-button--full" type="submit" disabled={isSubmitting}>
                <Briefcase /> {isSubmitting ? "Saving to database..." : "Save Application"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Detail Modal */}
      {selectedJob ? (
        <div className="dialog-wrap" onMouseDown={() => setSelectedJob(null)}>
          <div className="capture-dialog" style={{ maxWidth: "32rem" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">{selectedJob.company}</p>
                <h2>{selectedJob.role}</h2>
                <small style={{ color: "rgb(var(--muted))" }}>Applied on {selectedJob.appliedAt}</small>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="icon-button"
                  title="Delete Application"
                  onClick={() => handleDeleteJob(selectedJob.id, selectedJob.role, selectedJob.company)}
                  style={{ color: "rgb(var(--danger))" }}
                >
                  <Trash2 style={{ width: "1rem", height: "1rem" }} />
                </button>
                <button className="icon-button" onClick={() => setSelectedJob(null)}>×</button>
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.8rem", fontSize: "0.8rem" }}>
              <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                <span style={{ background: "rgb(var(--surface-strong))", padding: "0.25rem 0.6rem", borderRadius: "var(--radius-sm)" }}>
                  Type: <strong>{selectedJob.jobType}</strong>
                </span>
                {selectedJob.salaryRange ? (
                  <span style={{ background: "rgb(var(--surface-strong))", padding: "0.25rem 0.6rem", borderRadius: "var(--radius-sm)" }}>
                    Salary: <strong>{selectedJob.salaryRange}</strong>
                  </span>
                ) : null}
              </div>

              {selectedJob.currentStage ? (
                <div style={{ background: "rgba(var(--accent), 0.1)", color: "rgb(var(--accent))", padding: "0.6rem", borderRadius: "var(--radius)" }}>
                  <strong>Current Stage:</strong> {selectedJob.currentStage}
                </div>
              ) : null}

              {selectedJob.notes ? (
                <div style={{ background: "rgb(var(--surface-strong))", padding: "0.8rem", borderRadius: "var(--radius)" }}>
                  <p style={{ fontWeight: 600, marginBottom: "0.3rem" }}>Notes:</p>
                  <p style={{ whiteSpace: "pre-wrap", color: "rgb(var(--muted))", fontSize: "0.78rem" }}>{selectedJob.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
