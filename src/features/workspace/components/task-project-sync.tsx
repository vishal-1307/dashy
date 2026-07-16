"use client";

import { useEffect, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/server/auth-client";
import { useWorkspaceStore } from "../store";

/**
 * Mounted once at the app root. Pulls this user's Tasks/Projects from the
 * database on first authenticated load and, if the browser still has
 * local-only Task/Project data from before auth existed, offers a one-time
 * import prompt rather than silently adopting or discarding it.
 */
export function TaskProjectSync() {
  const { data: session } = useSession();
  const hydrateFromServer = useWorkspaceStore((state) => state.hydrateFromServer);
  const importLegacyItems = useWorkspaceStore((state) => state.importLegacyItems);
  const dismissLegacyImport = useWorkspaceStore((state) => state.dismissLegacyImport);
  const candidateIds = useWorkspaceStore((state) => state.legacyImportCandidateIds);
  const items = useWorkspaceStore((state) => state.items);
  const [importing, setImporting] = useState(false);
  // Keyed by user id: the root layout (and this component) survives
  // sign-out → sign-in as a different user, so a boolean would skip
  // hydration for the second account.
  const hydratedForUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || hydratedForUser.current === userId) return;
    hydratedForUser.current = userId;
    hydrateFromServer().catch(() => {
      hydratedForUser.current = null;
    });
  }, [session, hydrateFromServer]);

  if (!session || candidateIds.length === 0) {
    return null;
  }

  const candidates = items.filter((item) => candidateIds.includes(item.id));
  const taskCount = candidates.filter((item) => item.module === "tasks").length;
  const projectCount = candidates.filter((item) => item.module === "projects").length;

  const describe = () => {
    const parts: string[] = [];
    if (taskCount) parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`);
    if (projectCount) parts.push(`${projectCount} project${projectCount === 1 ? "" : "s"}`);
    return parts.join(" and ");
  };

  const onImport = async () => {
    setImporting(true);
    try {
      await importLegacyItems(candidateIds);
      toast.success("Imported your local data");
    } catch {
      toast.error("Could not import — try again from Settings later.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="dialog-wrap dialog-wrap--top">
      <section className="capture-dialog legacy-import-dialog">
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Local data found</p>
            <h2>Import your local Tasks and Projects?</h2>
          </div>
          <span className="settings-card__icon"><CloudUpload /></span>
        </div>
        <p className="drawer-copy">
          This browser has {describe()} saved before you signed in. Import them into your account so they sync
          everywhere, or leave them as-is on this device only.
        </p>
        <div className="settings-actions">
          <button className="primary-button" disabled={importing} onClick={onImport}>
            {importing ? "Importing…" : "Import"}
          </button>
          <button className="secondary-button" disabled={importing} onClick={dismissLegacyImport}>
            Not now
          </button>
        </div>
      </section>
    </div>
  );
}
