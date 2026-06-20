"use client";

import {
  Archive,
  Bookmark,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  ExternalLink,
  Inbox,
  KeyRound,
  Lightbulb,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Settings,
  Target,
  ThumbsUp,
  UserRound,
  UsersRound,
  Video,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import IntegrationSettingsPanel from "@/components/IntegrationSettingsPanel";
import MonitorSettingsPanel from "@/components/MonitorSettingsPanel";
import { defaultMonitorSettings, normalizeMonitorSettings } from "@/lib/config";
import type {
  IntegrationStatus,
  MonitorSettings,
  Opportunity,
  OpportunityStatus,
  ScanResponse,
  Source,
} from "@/lib/types";

const STORAGE_KEY = "swaya-opportunity-inbox-v2-live-only";
const LEGACY_DEMO_STORAGE_KEY = "swaya-opportunity-inbox-v1";
const MONITOR_SETTINGS_KEY = "swaya-monitor-settings-v1";

type Filter = "all" | Source;
type View = "opportunities" | "monitors" | "integrations";

interface OpportunityInboxProps {
  initialOpportunities: Opportunity[];
}

interface StoredStateResponse {
  databaseConfigured: boolean;
  opportunities: Opportunity[];
  settings: MonitorSettings;
  error?: string;
}

const sourceMeta: Record<Source, { label: string; className: string }> = {
  reddit: { label: "Reddit", className: "source-reddit" },
  quora: { label: "Quora", className: "source-quora" },
  youtube: { label: "YouTube", className: "source-youtube" },
};

function SourceGlyph({ source, size = 16 }: { source: Source; size?: number }) {
  if (source === "youtube") return <Video size={size} strokeWidth={2.3} />;
  if (source === "quora") return <CircleHelp size={size} strokeWidth={2.3} />;
  return <MessageCircle size={size} strokeWidth={2.3} />;
}

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scoreTone(score: number) {
  if (score >= 90) return "score-hot";
  if (score >= 80) return "score-strong";
  return "score-medium";
}

function repairStoredText(value: string) {
  return value
    .replaceAll("â€”", "—")
    .replaceAll("â€¦", "…")
    .replaceAll("Â·", "·");
}

function repairStoredOpportunity(item: Opportunity): Opportunity {
  return {
    ...item,
    community: repairStoredText(item.community),
    title: repairStoredText(item.title),
    excerpt: repairStoredText(item.excerpt),
    reasoning: repairStoredText(item.reasoning),
    draft: repairStoredText(item.draft),
    tags: item.tags.map(repairStoredText),
  };
}

export default function OpportunityInbox({ initialOpportunities }: OpportunityInboxProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [selectedId, setSelectedId] = useState(initialOpportunities[0]?.id ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [toast, setToast] = useState("");
  const [draftSaved, setDraftSaved] = useState(true);
  const [activeView, setActiveView] = useState<View>("opportunities");
  const [monitorSettings, setMonitorSettings] = useState<MonitorSettings>(defaultMonitorSettings);
  const [monitorSettingsDirty, setMonitorSettingsDirty] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [integrationStatusLoading, setIntegrationStatusLoading] = useState(true);
  const [databaseConfigured, setDatabaseConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    function loadLocalFallback() {
      try {
        window.localStorage.removeItem(LEGACY_DEMO_STORAGE_KEY);
        const storedOpportunities = window.localStorage.getItem(STORAGE_KEY);
        if (storedOpportunities) {
          const saved = (JSON.parse(storedOpportunities) as Opportunity[]).map(repairStoredOpportunity);
          setOpportunities(saved);
          setSelectedId(saved[0]?.id ?? "");
        }
        const storedSettings = window.localStorage.getItem(MONITOR_SETTINGS_KEY);
        if (storedSettings) setMonitorSettings(normalizeMonitorSettings(JSON.parse(storedSettings)));
      } catch {
        // Invalid local state should never block the inbox.
      }
    }

    fetch("/api/state", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as StoredStateResponse;
        if (!response.ok) throw new Error(result.error || "Could not load stored data");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setDatabaseConfigured(result.databaseConfigured);
        if (result.databaseConfigured) {
          const stored = result.opportunities.map(repairStoredOpportunity);
          setOpportunities(stored);
          setSelectedId(stored[0]?.id ?? "");
          setMonitorSettings(normalizeMonitorSettings(result.settings));
        } else {
          loadLocalFallback();
        }
      })
      .catch((error) => {
        if (!active) return;
        setDatabaseConfigured(false);
        loadLocalFallback();
        setToast(error instanceof Error ? error.message : "Using local browser storage");
      });

    return () => { active = false; };
  }, [initialOpportunities]);

  useEffect(() => {
    if (databaseConfigured === false) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(opportunities));
    }
  }, [databaseConfigured, opportunities]);

  useEffect(() => {
    let active = true;
    fetch("/api/integrations", { cache: "no-store" })
      .then((response) => response.json())
      .then((status: IntegrationStatus) => {
        if (active) setIntegrationStatus(status);
      })
      .catch(() => {
        if (active) setToast("Could not load integration status");
      })
      .finally(() => {
        if (active) setIntegrationStatusLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return opportunities.filter((item) => {
      if (item.status === "dismissed") return false;
      if (filter !== "all" && item.source !== filter) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.excerpt, item.community, item.intent, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, opportunities, query]);

  const selected = opportunities.find((item) => item.id === selectedId) ?? filtered[0];
  const activeCount = opportunities.filter((item) => item.status !== "dismissed").length;
  const newCount = opportunities.filter((item) => item.status === "new").length;
  const highIntentCount = opportunities.filter(
    (item) => item.status !== "dismissed" && item.score >= 90,
  ).length;
  const repliedCount = opportunities.filter((item) => item.status === "replied").length;
  const connectedSourceCount = integrationStatus
    ? Number(integrationStatus.serper.configured) + Number(integrationStatus.youtube.configured)
    : 0;

  function updateOpportunity(id: string, update: Partial<Opportunity>) {
    setOpportunities((items) =>
      items.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  async function persistOpportunity(id: string, update: { status?: OpportunityStatus; draft?: string }) {
    if (!databaseConfigured) {
      if (integrationStatus?.localOnly) return true;
      setToast("Cloud storage is not connected—this finding could not be saved");
      return false;
    }
    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save opportunity");
      if (!result.saved) throw new Error("Neon did not confirm the save");
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not save opportunity");
      return false;
    }
  }

  async function setStatus(status: OpportunityStatus) {
    if (!selected) return;
    const persisted = await persistOpportunity(selected.id, { status });
    if (!persisted) return;
    updateOpportunity(selected.id, { status });
    if (status === "dismissed") {
      const next = filtered.find((item) => item.id !== selected.id);
      if (next) setSelectedId(next.id);
      setToast("Opportunity dismissed");
    } else if (status === "replied") {
      setToast("Marked as replied");
    } else {
      setToast("Saved for later");
    }
  }

  async function copyDraft() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.draft);
    setToast("Draft copied to clipboard");
  }

  function changeMonitorSettings(settings: MonitorSettings) {
    setMonitorSettings(settings);
    setMonitorSettingsDirty(true);
  }

  async function saveMonitorSettings(settings = monitorSettings) {
    if (databaseConfigured) {
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not save monitor settings");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Could not save monitor settings");
        return;
      }
    } else {
      window.localStorage.setItem(MONITOR_SETTINGS_KEY, JSON.stringify(settings));
    }
    setMonitorSettingsDirty(false);
    setToast(databaseConfigured ? "Monitor settings saved to the database" : "Monitor settings saved locally");
  }

  function resetMonitorSettings() {
    setMonitorSettings(defaultMonitorSettings);
    setMonitorSettingsDirty(true);
    setToast("Recommended defaults restored");
  }

  async function runScan(scanSettings = monitorSettings) {
    setIsScanning(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: scanSettings }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Scan failed");
      const result = payload as ScanResponse;
      setOpportunities((items) => [
        ...result.opportunities.filter((candidate) => !items.some((item) => item.id === candidate.id)),
        ...items,
      ]);
      if (result.opportunities[0]) setSelectedId(result.opportunities[0].id);
      const sourceSummary = result.scannedSources
        .map((source) => `${source[0].toUpperCase()}${source.slice(1)}: ${result.opportunities.filter((item) => item.source === source).length}`)
        .join(" · ");
      const warning = result.notes.find((note) => note.startsWith("Serper could not") || note.includes("skipped"));
      const storageWarning = result.opportunities.length > 0 && result.storage && !result.storage.configured
        ? "Findings appeared, but Postgres is not connected—this scan was not saved"
        : null;
      const savedSummary = result.storage?.configured
        ? ` · ${result.storage.savedCount} saved to cloud`
        : "";
      const emailWarning = scanSettings.emailAlertsEnabled && result.notification && !result.notification.configured
        ? "Findings were saved, but Resend is not connected—no email was sent"
        : null;
      const emailSummary = result.notification?.sentCount
        ? ` · ${result.notification.sentCount} emailed`
        : "";
      if (result.storage) setDatabaseConfigured(result.storage.configured);
      setToast(result.mode === "not_configured"
        ? result.notes[0] || "Connect an API source before scanning"
        : warning || storageWarning || emailWarning || `Live scan complete · ${sourceSummary}${savedSummary}${emailSummary}`);
    } catch {
      setToast("Scan could not finish—check the server log");
    } finally {
      setIsScanning(false);
    }
  }

  async function testMonitor() {
    await saveMonitorSettings();
    await runScan(monitorSettings);
    setActiveView("opportunities");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup" aria-label="Swaya">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>Swaya</span>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <button
            type="button"
            className={activeView === "opportunities" ? "active" : ""}
            onClick={() => setActiveView("opportunities")}
          >
            <Inbox size={18} />
            Opportunities
            <span className="nav-count">{newCount}</span>
          </button>
          <button
            type="button"
            className={activeView === "monitors" ? "active" : ""}
            onClick={() => setActiveView("monitors")}
          >
            <Target size={18} />
            Monitors
          </button>
        </nav>

        <div className="sidebar-label">Sources</div>
        <nav className="source-nav" aria-label="Sources">
          {(Object.keys(sourceMeta) as Source[]).map((source) => (
            <button
              type="button"
              key={source}
              onClick={() => {
                setFilter(source);
                setActiveView("opportunities");
              }}
            >
              <span className={`source-mini ${sourceMeta[source].className}`}>
                <SourceGlyph source={source} size={14} />
              </span>
              {sourceMeta[source].label}
              <span className="source-count">
                {opportunities.filter((item) => item.source === source && item.status === "new").length}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="monitor-card">
          <div className="monitor-card-head">
            <span className="live-dot" />
            {connectedSourceCount
              ? `${connectedSourceCount} connection${connectedSourceCount === 1 ? "" : "s"} ready${databaseConfigured ? " · cloud saved" : ""}`
              : "Setup needed"}
          </div>
          <p>{databaseConfigured
            ? "Scans, drafts, and settings are stored in your hosted database."
            : connectedSourceCount
              ? "Your keys are server-side; data is using this browser until Postgres is connected."
              : "Connect API keys and Postgres when you&apos;re ready."}</p>
          <button type="button" onClick={() => setActiveView("integrations")}>
            {connectedSourceCount ? "Manage APIs" : "Connect APIs"} <ExternalLink size={12} />
          </button>
        </div>

        <nav className="utility-nav" aria-label="Account">
          <button
            type="button"
            className={activeView === "integrations" ? "active" : ""}
            onClick={() => setActiveView("integrations")}
          >
            <Settings size={17} /> Settings
          </button>
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="workspace-switcher">
            <span className="workspace-avatar">S</span>
            <span>Swaya workspace</span>
          </div>
          <div className="topbar-actions">
            <span className="profile-avatar">SK</span>
          </div>
        </header>

        <div className="content-wrap">
          {activeView === "monitors" ? (
            <MonitorSettingsPanel
              settings={monitorSettings}
              isDirty={monitorSettingsDirty}
              isScanning={isScanning}
              onChange={changeMonitorSettings}
              onSave={() => saveMonitorSettings()}
              onReset={resetMonitorSettings}
              onTestScan={testMonitor}
            />
          ) : activeView === "integrations" ? (
            <IntegrationSettingsPanel
              status={integrationStatus}
              isLoading={integrationStatusLoading}
              onStatusChange={setIntegrationStatus}
              onToast={setToast}
            />
          ) : (
            <>
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span /> Opportunity agent</div>
              <h1>Conversations worth joining.</h1>
              <p>High-intent questions from people Swaya can genuinely help.</p>
            </div>
            <button type="button" className="scan-button" onClick={() => runScan()} disabled={isScanning}>
              <RefreshCw size={16} className={isScanning ? "spinning" : ""} />
              {isScanning ? "Scanning sources…" : "Run scan"}
            </button>
          </section>

          <section className="stat-grid" aria-label="Opportunity summary">
            <article>
              <span className="stat-icon stat-icon-purple"><Inbox size={18} /></span>
              <div><strong>{activeCount}</strong><span>Active opportunities</span></div>
              <small>Live results only</small>
            </article>
            <article>
              <span className="stat-icon stat-icon-red"><Zap size={18} /></span>
              <div><strong>{highIntentCount}</strong><span>High intent</span></div>
              <small>90+ relevance</small>
            </article>
            <article>
              <span className="stat-icon stat-icon-green"><CheckCircle2 size={18} /></span>
              <div><strong>{repliedCount}</strong><span>Replies sent</span></div>
              <small>Marked by you</small>
            </article>
            <article>
              <span className="stat-icon stat-icon-blue"><KeyRound size={18} /></span>
              <div><strong>{connectedSourceCount}/2</strong><span>API connections</span></div>
              <small>Stored server-side</small>
            </article>
          </section>

          <section className="inbox-panel">
            <div className="inbox-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Filter by source">
                {(["all", "reddit", "quora", "youtube"] as Filter[]).map((item) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === item}
                    className={filter === item ? "active" : ""}
                    onClick={() => setFilter(item)}
                    key={item}
                  >
                    {item === "all" ? "All" : sourceMeta[item].label}
                    <span>
                      {item === "all"
                        ? activeCount
                        : opportunities.filter(
                            (opportunity) =>
                              opportunity.source === item && opportunity.status !== "dismissed",
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="toolbar-tools">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search opportunities"
                    aria-label="Search opportunities"
                  />
                </label>
              </div>
            </div>

            <div className="inbox-body">
              <div className="opportunity-list" aria-label="Opportunities">
                <div className="list-heading">
                  <span>{filtered.length} opportunities</span>
                  <span>Newest saved</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <Search size={24} />
                    <strong>{activeCount === 0 ? "No live opportunities yet" : "No matches"}</strong>
                    <p>{activeCount === 0 ? "Run a scan to find real conversations from your connected sources." : "Try a different source or search phrase."}</p>
                  </div>
                ) : (
                  filtered.map((item) => (
                      <button
                        type="button"
                        className={`opportunity-card ${selected?.id === item.id ? "selected" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                        key={item.id}
                      >
                        <div className="card-topline">
                          <span className={`source-badge ${sourceMeta[item.source].className}`}>
                            <SourceGlyph source={item.source} size={14} />
                            {item.community}
                          </span>
                          <span className="posted-time">{relativeTime(item.postedAt)}</span>
                          <span className={`score-pill ${scoreTone(item.score)}`}>{item.score}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.excerpt}</p>
                        <div className="card-footer">
                          <span className={`audience-pill audience-${item.audience}`}>
                            {item.audience === "club" ? <UsersRound size={12} /> : <Target size={12} />}
                            {item.audience === "club" ? "Club-side" : "Brand-side"}
                          </span>
                          <span className="intent-label">{item.intent}</span>
                          {item.status === "saved" && <Bookmark size={14} className="saved-icon" />}
                          {item.status === "replied" && <CheckCircle2 size={14} className="replied-icon" />}
                        </div>
                      </button>
                    ))
                )}
              </div>

              {selected ? (
                <aside className="detail-panel" aria-label="Selected opportunity">
                  <div className="detail-actions">
                    <span className={`source-badge ${sourceMeta[selected.source].className}`}>
                      <SourceGlyph source={selected.source} size={14} />
                      {sourceMeta[selected.source].label}
                    </span>
                    <div>
                      <button
                        type="button"
                        className={`save-finding-button ${selected.status === "saved" ? "active" : ""}`}
                        onClick={() => void setStatus("saved")}
                        aria-label={selected.status === "saved" ? "Finding saved" : "Save finding"}
                      >
                        <Bookmark size={17} fill={selected.status === "saved" ? "currentColor" : "none"} />
                        {selected.status === "saved" ? "Saved" : "Save finding"}
                      </button>
                    </div>
                  </div>

                  <div className="detail-content">
                    <div className="detail-meta">
                      <span>{selected.community}</span>
                      <i />
                      <span>u/{selected.author}</span>
                      <i />
                      <span>{relativeTime(selected.postedAt)}</span>
                    </div>
                    <h2>{selected.title}</h2>
                    <p className="original-post">{selected.excerpt}</p>
                    <a href={selected.url} target="_blank" rel="noreferrer" className="original-link">
                      Open original <ExternalLink size={13} />
                    </a>

                    <div className="analysis-card">
                      <div className="analysis-head">
                        <span><Lightbulb size={14} /> Why this matters</span>
                        <strong className={scoreTone(selected.score)}>{selected.score}% match</strong>
                      </div>
                      <p>{selected.reasoning}</p>
                      <div className="tag-row">
                        {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </div>

                    <div className="draft-section">
                      <div className="draft-heading">
                        <div>
                          <span className="sparkle-tile"><MessageSquareText size={15} /></span>
                          <div><strong>Suggested response</strong><small>Helpful, specific, zero hard pitch</small></div>
                        </div>
                        <button type="button" onClick={copyDraft}><Copy size={14} /> Copy</button>
                      </div>
                      <textarea
                        value={selected.draft}
                        onChange={(event) => {
                          updateOpportunity(selected.id, { draft: event.target.value });
                          setDraftSaved(false);
                        }}
                        onBlur={() => {
                          setDraftSaved(true);
                          void persistOpportunity(selected.id, { draft: selected.draft });
                        }}
                        aria-label="Suggested response draft"
                      />
                      <div className="draft-foot">
                        <span>{selected.draft.length} characters</span>
                        <span className={draftSaved ? "saved-state" : "saving-state"}>
                          {draftSaved ? <><Check size={12} /> {databaseConfigured ? "Saved" : "Saved locally"}</> : "Saving…"}
                        </span>
                      </div>
                    </div>

                    <div className="guardrail-note">
                      <ThumbsUp size={16} />
                      <p><strong>Keep it human.</strong> Read the full thread, adjust the draft, and follow the community&apos;s rules before posting.</p>
                    </div>
                  </div>

                  <div className="detail-footer">
                    <button type="button" className="dismiss-button" onClick={() => void setStatus("dismissed")}>
                      <Archive size={15} /> Dismiss
                    </button>
                    <button type="button" className="replied-button" onClick={() => void setStatus("replied")}>
                      <CheckCircle2 size={15} /> Mark as replied
                    </button>
                  </div>
                </aside>
              ) : (
                <aside className="detail-panel detail-empty">
                  <UserRound size={28} />
                  <strong>Select an opportunity</strong>
                </aside>
              )}
            </div>
          </section>
            </>
          )}
        </div>
      </main>

      {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  );
}
