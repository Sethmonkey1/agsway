"use client";

import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageCircle,
  Save,
  ShieldCheck,
  Trash2,
  Video,
} from "lucide-react";
import { useState } from "react";
import type { IntegrationStatus } from "@/lib/types";

interface IntegrationSettingsPanelProps {
  status: IntegrationStatus | null;
  isLoading: boolean;
  onStatusChange: (status: IntegrationStatus) => void;
  onToast: (message: string) => void;
}

type IntegrationName = "serper" | "youtube" | "resend";

const integrations = {
  serper: {
    name: "Serper",
    eyebrow: "Reddit + Quora discovery",
    description: "Searches recent Google results for relevant Reddit posts and evergreen Quora questions.",
    env: "SERPER_API_KEY",
    placeholder: "Paste your Serper API key",
    helpUrl: "https://serper.dev/api-key",
    icon: MessageCircle,
  },
  youtube: {
    name: "YouTube Data API",
    eyebrow: "YouTube comment monitoring",
    description: "Finds recent videos and surfaces high-intent questions from their comment sections.",
    env: "YOUTUBE_API_KEY",
    placeholder: "Paste your YouTube API key",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    icon: Video,
  },
  resend: {
    name: "Resend",
    eyebrow: "Email notifications",
    description: "Sends one digest containing newly discovered opportunities after each scan.",
    env: "RESEND_API_KEY",
    placeholder: "Paste your Resend API key",
    helpUrl: "https://resend.com/api-keys",
    icon: Mail,
  },
} as const;

export default function IntegrationSettingsPanel({
  status,
  isLoading,
  onStatusChange,
  onToast,
}: IntegrationSettingsPanelProps) {
  const [values, setValues] = useState<Record<IntegrationName, string>>({ serper: "", youtube: "", resend: "" });
  const [visible, setVisible] = useState<Record<IntegrationName, boolean>>({ serper: false, youtube: false, resend: false });
  const [isSaving, setIsSaving] = useState(false);
  const [confirming, setConfirming] = useState<IntegrationName | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const hasChanges = Boolean(values.serper.trim() || values.youtube.trim() || values.resend.trim());
  const hostedLocked = Boolean(status?.requiresUnlock && !unlocked);

  async function postIntegrations(payload: Record<string, unknown>) {
    const response = await fetch("/api/integrations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "X-Swaya-Admin-Key": adminKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update integrations.");
    return result as IntegrationStatus;
  }

  async function unlockHostedSettings() {
    if (!adminKey.trim()) return;
    setIsSaving(true);
    try {
      await postIntegrations({ verify: true });
      setUnlocked(true);
      onToast("Hosted key settings unlocked");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not unlock hosted settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function save() {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const next = await postIntegrations({
        ...(values.serper.trim() ? { serper: values.serper } : {}),
        ...(values.youtube.trim() ? { youtube: values.youtube } : {}),
        ...(values.resend.trim() ? { resend: values.resend } : {}),
      });
      setValues({ serper: "", youtube: "", resend: "" });
      setVisible({ serper: false, youtube: false, resend: false });
      onStatusChange(next);
      onToast("API connections saved securely");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not save API connections");
    } finally {
      setIsSaving(false);
    }
  }

  async function disconnect(name: IntegrationName) {
    if (confirming !== name) {
      setConfirming(name);
      return;
    }
    setIsSaving(true);
    try {
      const next = await postIntegrations({ clear: [name] });
      onStatusChange(next);
      setConfirming(null);
      onToast(`${integrations[name].name} disconnected`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not disconnect integration");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="integration-settings-page">
      <section className="page-heading integration-page-heading">
        <div>
          <div className="eyebrow"><span /> Workspace settings</div>
          <h1>Connect Swaya&apos;s sources.</h1>
          <p>Add each API key once. After saving, the app only shows a masked connection status.</p>
        </div>
        <button
          type="button"
          className="save-integrations-button"
          onClick={save}
          disabled={!hasChanges || isSaving || !status?.writable || hostedLocked}
        >
          {isSaving ? <LoaderCircle size={15} className="spinning" /> : <Save size={15} />}
          {isSaving ? "Saving…" : "Save connections"}
        </button>
      </section>

      <section className="secret-safety-banner">
        <span><ShieldCheck size={19} /></span>
        <div>
          <strong>Keys stay server-side.</strong>
          <p>{status?.localOnly
            ? <>They are written to the git-ignored <code>.env.local</code> file and never returned to the browser.</>
            : <>Hosted keys are encrypted before Neon stores them and are never returned to the browser.</>}
          </p>
        </div>
        <span className="local-only-pill"><LockKeyhole size={12} /> {status?.localOnly ? "Local workspace" : "Hosted securely"}</span>
      </section>

      {!isLoading && status && !status.writable && (
        <section className="deployment-secret-note">
          Connect Neon and configure <code>CRON_SECRET</code> in Vercel once to enable encrypted in-app key management.
        </section>
      )}

      {!isLoading && status?.requiresUnlock && (
        <section className="hosted-unlock-card">
          <div>
            <LockKeyhole size={17} />
            <span><strong>{unlocked ? "Hosted settings unlocked" : "Unlock hosted settings"}</strong><small>Enter your CRON_SECRET workspace admin key. It stays in memory only for this page.</small></span>
          </div>
          {!unlocked && (
            <div className="hosted-unlock-form">
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void unlockHostedSettings(); }}
                placeholder="Workspace admin key"
                autoComplete="off"
                aria-label="Workspace admin key"
              />
              <button type="button" onClick={unlockHostedSettings} disabled={!adminKey.trim() || isSaving}>Unlock</button>
            </div>
          )}
        </section>
      )}

      <section className="integration-card-list" aria-label="API integrations">
        {(Object.keys(integrations) as IntegrationName[]).map((name) => {
          const integration = integrations[name];
          const connection = status?.[name];
          const Icon = integration.icon;
          const configured = connection?.configured ?? false;
          return (
            <article className="integration-card" key={name}>
              <div className="integration-card-main">
                <span className={`integration-logo integration-logo-${name}`}><Icon size={21} /></span>
                <div className="integration-copy">
                  <div className="integration-title-row">
                    <div>
                      <span>{integration.eyebrow}</span>
                      <h2>{integration.name}</h2>
                    </div>
                    {isLoading ? (
                      <span className="connection-status checking"><LoaderCircle size={13} className="spinning" /> Checking</span>
                    ) : configured ? (
                      <span className="connection-status connected"><CheckCircle2 size={13} /> Connected</span>
                    ) : (
                      <span className="connection-status">Not connected</span>
                    )}
                  </div>
                  <p>{integration.description}</p>
                </div>
              </div>

              <div className="integration-form-area">
                <div className="integration-field-label">
                  <label htmlFor={`${name}-api-key`}>API key</label>
                  <code>{integration.env}</code>
                </div>
                <div className="secret-input-row">
                  <div className="secret-input-wrap">
                    <KeyRound size={15} />
                    <input
                      id={`${name}-api-key`}
                      aria-label={`${integration.name} key`}
                      type={visible[name] ? "text" : "password"}
                      value={values[name]}
                      onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                      placeholder={configured ? `${connection?.masked} — paste to replace` : integration.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!status?.writable || isSaving || hostedLocked}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}
                      aria-label={`${visible[name] ? "Hide" : "Show"} ${integration.name} key`}
                      disabled={!values[name]}
                    >
                      {visible[name] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <a href={integration.helpUrl} target="_blank" rel="noreferrer">
                    Get key <ExternalLink size={12} />
                  </a>
                </div>

                <div className="integration-card-footer">
                  <span>
                    {configured
                      ? `Saved as ${connection?.masked}. Leave blank to keep the current key.`
                      : "Nothing is sent until you choose Save connections."}
                  </span>
                  {configured && (
                    <button
                      type="button"
                      className={confirming === name ? "confirm-disconnect" : "disconnect-button"}
                      onClick={() => disconnect(name)}
                      onBlur={() => setConfirming((current) => current === name ? null : current)}
                      disabled={isSaving || !status?.writable || hostedLocked}
                      aria-label={confirming === name ? `Confirm disconnect ${integration.name}` : `Disconnect ${integration.name}`}
                    >
                      <Trash2 size={13} />
                      {confirming === name ? "Confirm disconnect" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="integration-next-step">
        <div><CheckCircle2 size={18} /><span><strong>After connecting:</strong> open Monitors and choose “Save &amp; run test scan” to verify live results.</span></div>
      </section>
    </div>
  );
}
