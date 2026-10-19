"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { JobStatus as DbJobStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateFromDb, dateToDb } from "./mappers";

export type JobStatus =
  | "SAVED"
  | "APPLIED"
  | "SCREENING"
  | "TECHNICAL"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED";

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  jobType: "REMOTE" | "HYBRID" | "ONSITE";
  salaryRange?: string;
  location?: string;
  source?: string;
  status: JobStatus;
  currentStage?: string;
  appliedAt: string;
  followUpDeadline?: string;
  notes?: string;
}

const jobSchema = z.object({
  company: z.string().trim().min(1, "Company name is required").max(100),
  role: z.string().trim().min(1, "Role title is required").max(150),
  jobType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).default("REMOTE"),
  salaryRange: z.string().trim().max(100).optional(),
  location: z.string().trim().max(150).optional(),
  source: z.string().trim().max(100).optional(),
  status: z.enum(["SAVED", "APPLIED", "SCREENING", "TECHNICAL", "INTERVIEW", "OFFER", "REJECTED"]).default("APPLIED"),
  currentStage: z.string().trim().max(150).optional(),
  appliedAt: z.string().optional(),
  followUpDeadline: z.string().optional(),
  notes: z.string().trim().max(5000).optional()
});

function jobToRecord(job: {
  id: string;
  company: string;
  role: string;
  jobType: string;
  salaryRange: string | null;
  location: string | null;
  source: string | null;
  status: DbJobStatus;
  currentStage: string | null;
  appliedAt: Date;
  followUpDeadline: Date | null;
  notes: string | null;
}): JobApplication {
  return {
    id: job.id,
    company: job.company,
    role: job.role,
    jobType: (job.jobType as "REMOTE" | "HYBRID" | "ONSITE") || "REMOTE",
    salaryRange: job.salaryRange ?? undefined,
    location: job.location ?? undefined,
    source: job.source ?? undefined,
    status: job.status as JobStatus,
    currentStage: job.currentStage ?? undefined,
    appliedAt: dateFromDb(job.appliedAt) ?? new Date().toISOString().slice(0, 10),
    followUpDeadline: dateFromDb(job.followUpDeadline),
    notes: job.notes ?? undefined
  };
}

export async function listJobs(): Promise<JobApplication[]> {
  const userId = await requireUserId();
  const jobs = await prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { appliedAt: "desc" }
  });
  return jobs.map(jobToRecord);
}

export async function createJob(input: unknown): Promise<JobApplication> {
  const userId = await requireUserId();
  const parsed = jobSchema.parse(input);

  const appliedDate = dateToDb(parsed.appliedAt) ?? new Date();

  const job = await prisma.jobApplication.create({
    data: {
      id: randomUUID(),
      userId,
      company: parsed.company,
      role: parsed.role,
      jobType: parsed.jobType,
      salaryRange: parsed.salaryRange || null,
      location: parsed.location || null,
      source: parsed.source || null,
      status: parsed.status as DbJobStatus,
      currentStage: parsed.currentStage || null,
      appliedAt: appliedDate,
      followUpDeadline: dateToDb(parsed.followUpDeadline),
      notes: parsed.notes || null
    }
  });

  return jobToRecord(job);
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<JobApplication> {
  const userId = await requireUserId();
  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId }
  });
  if (!existing) {
    throw new Error("Job application not found or unauthorized");
  }

  const updated = await prisma.jobApplication.update({
    where: { id },
    data: { status: status as DbJobStatus }
  });

  return jobToRecord(updated);
}

export async function deleteJob(id: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId }
  });
  if (!existing) {
    throw new Error("Job application not found or unauthorized");
  }

  await prisma.jobApplication.delete({ where: { id } });
}
