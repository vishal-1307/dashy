import { notFound } from "next/navigation";
import { DashyWorkspace } from "@/features/workspace/components/dashy-workspace";
import { modules } from "@/features/workspace/data";
import type { ModuleKey } from "@/features/workspace/types";

type ModulePageProps = {
  params: Promise<{ module: string }>;
};

export function generateStaticParams() {
  return modules
    .filter((module) => module.key !== "dashboard")
    .map((module) => ({ module: module.key }));
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { module } = await params;
  const definition = modules.find((item) => item.key === module && item.key !== "dashboard");

  if (!definition) {
    notFound();
  }

  return <DashyWorkspace module={module as ModuleKey} />;
}
