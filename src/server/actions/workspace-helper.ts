import { prisma } from "@/server/db/client";

/**
 * Resolves the database Workspace ID for a given user and workspace slug.
 * If the slug is "unified" or undefined, falls back to the default or "freelance-software" workspace.
 */
export async function resolveWorkspaceId(userId: string, slug?: string | null): Promise<string | null> {
  if (!slug || slug === "unified") {
    const ws = await prisma.workspace.findFirst({
      where: { userId, OR: [{ slug: "freelance-software" }, { isDefault: true }] },
      select: { id: true }
    });
    return ws?.id ?? null;
  }
  const ws = await prisma.workspace.findUnique({
    where: { userId_slug: { userId, slug } },
    select: { id: true }
  });
  return ws?.id ?? null;
}
