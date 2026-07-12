"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Laptop, Lock, Moon, Palette, ShieldCheck, Sun, SunMoon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useInstallPrompt } from "../hooks/use-install-prompt";
import { workspaceExportSchema } from "../schema";
import { clearPasscode, hasPasscode, setPasscode, verifyPasscode } from "../security";
import { useWorkspaceStore } from "../store";
import type { ThemeMode, WorkspaceExport } from "../types";
import { cn } from "@/shared/lib/utils";

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: SunMoon }
];

export function SettingsPage() {
  const store = useWorkspaceStore();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const install = useInstallPrompt();

  useEffect(() => {
    setPinEnabled(hasPasscode());
  }, []);

  const handleInstall = async () => {
    const accepted = await install.promptInstall();
    if (accepted) toast.success("Dashy installed");
  };

  const savePasscode = async () => {
    if (pinEnabled) {
      if (!(await verifyPasscode(currentPin))) {
        toast.error("Current passcode is wrong");
        return;
      }
    }
    if (newPin.length < 4) {
      toast.error("Use at least 4 characters");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Passcodes do not match");
      return;
    }
    await setPasscode(newPin);
    setPinEnabled(true);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    toast.success("Passcode saved. Dashy will lock on the next reload.");
  };

  const removePasscode = async () => {
    if (!(await verifyPasscode(currentPin))) {
      toast.error("Current passcode is wrong");
      return;
    }
    clearPasscode();
    setPinEnabled(false);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    toast.success("Passcode removed");
  };

  const exportData = () => {
    const payload: WorkspaceExport = {
      app: "dashy",
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: store.theme,
      items: store.items,
      dashboardOrder: store.dashboardOrder,
      dashboardVisibleIds: store.dashboardVisibleIds
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dashy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const importData = async (file: File) => {
    try {
      const parsed = workspaceExportSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        toast.error("That file is not a valid Dashy backup");
        return;
      }
      store.importWorkspace(parsed.data as WorkspaceExport);
      toast.success(`Imported ${parsed.data.items.length} items`);
    } catch {
      toast.error("Could not read that file");
    }
  };

  const clearAll = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      window.setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    store.clearWorkspace();
    setConfirmingClear(false);
    toast.success("Workspace cleared");
  };

  return (
    <div className="settings">
      <section className="settings-card">
        <div className="settings-card__head">
          <span className="settings-card__icon"><Laptop /></span>
          <div>
            <h2>Install Dashy</h2>
            <p>
              {install.installed
                ? "Dashy is installed on this device and works offline."
                : "Add Dashy to your home screen or dock for one-tap access, its own window, and offline use."}
            </p>
          </div>
        </div>
        {install.installed ? (
          <p className="settings-note settings-note--success"><CheckCircle2 /> Installed</p>
        ) : install.canPromptInstall ? (
          <div className="settings-actions">
            <button className="primary-button" onClick={handleInstall}><Download /> Install on this device</button>
          </div>
        ) : install.isIosSafari ? (
          <p className="settings-note">
            On iPhone or iPad: tap the Share icon in Safari, then choose &quot;Add to Home Screen&quot;.
          </p>
        ) : (
          <p className="settings-note">
            Open Dashy in Chrome or Edge, then use the browser&apos;s &quot;Install app&quot; option (often in the
            address bar or the ⋮ menu) to add it to this device.
          </p>
        )}
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <span className="settings-card__icon"><Palette /></span>
          <div>
            <h2>Appearance</h2>
            <p>Choose how Dashy looks on this device.</p>
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Theme">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              className={cn("segmented__option", store.theme === option.value && "segmented__option--active")}
              onClick={() => store.setTheme(option.value)}
            >
              <option.icon /> {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <span className="settings-card__icon"><ShieldCheck /></span>
          <div>
            <h2>App lock</h2>
            <p>
              {pinEnabled
                ? "A passcode is required to open Dashy in a new session."
                : "Add a passcode so the workspace locks when the page reloads."}
            </p>
          </div>
        </div>
        <div className="settings-form">
          {pinEnabled ? (
            <label>Current passcode
              <input type="password" autoComplete="current-password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} />
            </label>
          ) : null}
          <div className="form-grid">
            <label>{pinEnabled ? "New passcode" : "Passcode"}
              <input type="password" autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(event.target.value)} />
            </label>
            <label>Confirm
              <input type="password" autoComplete="new-password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} />
            </label>
          </div>
          <div className="settings-actions">
            <button className="primary-button" onClick={savePasscode}>
              <Lock /> {pinEnabled ? "Change passcode" : "Enable app lock"}
            </button>
            {pinEnabled ? (
              <button className="secondary-button" onClick={removePasscode}>Remove passcode</button>
            ) : null}
          </div>
          <p className="settings-note">
            Only a salted PBKDF2 hash of the passcode is stored. Note: workspace data itself stays in browser
            storage — connect the database for encrypted, account-based storage.
          </p>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__head">
          <span className="settings-card__icon"><Download /></span>
          <div>
            <h2>Backup</h2>
            <p>{store.items.length} items in this workspace. Export a JSON backup or restore one.</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="primary-button" onClick={exportData}><Download /> Export backup</button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload /> Import backup</button>
          <input
            ref={fileInput}
            hidden
            accept="application/json,.json"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importData(file);
              event.target.value = "";
            }}
          />
        </div>
        <p className="settings-note">Imports are validated before anything is applied, and replace the current workspace.</p>
      </section>

      <section className="settings-card settings-card--danger">
        <div className="settings-card__head">
          <span className="settings-card__icon"><Trash2 /></span>
          <div>
            <h2>Danger zone</h2>
            <p>Remove every item from this workspace. Export a backup first.</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="danger-button" onClick={clearAll}>
            <Trash2 /> {confirmingClear ? "Click again to confirm" : "Clear all data"}
          </button>
        </div>
      </section>
    </div>
  );
}
