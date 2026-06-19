"use client";

import {
  CircleHelp,
  Clock3,
  Hash,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Video,
  X,
} from "lucide-react";
import { useState } from "react";
import type { MonitorSettings, Source } from "@/lib/types";

type ListField = "subreddits" | "clubKeywords" | "brandKeywords" | "quoraQueries" | "youtubeQueries";

interface MonitorSettingsPanelProps {
  settings: MonitorSettings;
  isDirty: boolean;
  isScanning: boolean;
  onChange: (settings: MonitorSettings) => void;
  onSave: () => void;
  onReset: () => void;
  onTestScan: () => void;
}

interface TagEditorProps {
  label: string;
  description: string;
  values: string[];
  placeholder: string;
  prefix?: string;
  onChange: (values: string[]) => void;
}

const sourceDetails: Record<Source, { label: string; description: string; icon: typeof MessageCircle }> = {
  reddit: {
    label: "Reddit",
    description: "Fresh posts from the communities you choose.",
    icon: MessageCircle,
  },
  quora: {
    label: "Quora",
    description: "Evergreen questions discovered through search.",
    icon: CircleHelp,
  },
  youtube: {
    label: "YouTube",
    description: "Questions inside comments on relevant videos.",
    icon: Video,
  },
};

function TagEditor({ label, description, values, placeholder, prefix = "", onChange }: TagEditorProps) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const cleaned = draft.trim().replace(prefix === "r/" ? /^r\//i : /^$/, "");
    if (!cleaned || values.some((value) => value.toLowerCase() === cleaned.toLowerCase())) return;
    onChange([...values, cleaned]);
    setDraft("");
  }

  return (
    <section className="monitor-editor-card">
      <div className="monitor-editor-heading">
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
        <span>{values.length}</span>
      </div>

      <div className="tag-editor-list">
        {values.map((value) => (
          <span className="editable-tag" key={value}>
            {prefix}{value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${prefix}${value}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="tag-editor-input">
        {prefix && <span>{prefix}</span>}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          aria-label={`Add to ${label}`}
        />
        <button type="button" onClick={addValue} disabled={!draft.trim()}>
          <Plus size={14} /> Add
        </button>
      </div>
    </section>
  );
}

export default function MonitorSettingsPanel({
  settings,
  isDirty,
  isScanning,
  onChange,
  onSave,
  onReset,
  onTestScan,
}: MonitorSettingsPanelProps) {
  const enabledCount = Object.values(settings.enabledSources).filter(Boolean).length;
  const phraseCount = settings.clubKeywords.length
    + settings.brandKeywords.length
    + settings.quoraQueries.length
    + settings.youtubeQueries.length;

  function updateList(field: ListField, values: string[]) {
    onChange({ ...settings, [field]: values });
  }

  function toggleSource(source: Source) {
    onChange({
      ...settings,
      enabledSources: {
        ...settings.enabledSources,
        [source]: !settings.enabledSources[source],
      },
    });
  }

  return (
    <div className="monitor-settings-page">
      <section className="page-heading monitor-page-heading">
        <div>
          <div className="eyebrow"><span /> Monitor settings</div>
          <h1>Tune what Swaya listens for.</h1>
          <p>Choose the communities, phrases, and signal strength that make an opportunity worth reviewing.</p>
        </div>
        <div className="monitor-heading-actions">
          <button type="button" className="reset-button" onClick={onReset}>
            <RotateCcw size={15} /> Reset
          </button>
          <button type="button" className="save-monitor-button" onClick={onSave} disabled={!isDirty}>
            <Save size={15} /> {isDirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </section>

      <section className="monitor-summary" aria-label="Monitor configuration summary">
        <div><Target size={17} /><strong>{enabledCount}</strong><span>sources enabled</span></div>
        <div><Hash size={17} /><strong>{settings.subreddits.length}</strong><span>communities</span></div>
        <div><Search size={17} /><strong>{phraseCount}</strong><span>search phrases</span></div>
        <div><Clock3 size={17} /><strong>{settings.scanCadenceHours}h</strong><span>scan cadence</span></div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><SlidersHorizontal size={17} /></div>
          <div><h2>Sources</h2><p>Pause a channel without losing its configuration.</p></div>
        </div>
        <div className="source-settings-grid">
          {(Object.keys(sourceDetails) as Source[]).map((source) => {
            const detail = sourceDetails[source];
            const Icon = detail.icon;
            const enabled = settings.enabledSources[source];
            return (
              <article className={`source-setting-card ${enabled ? "enabled" : ""}`} key={source}>
                <span className={`source-setting-icon source-${source}`}><Icon size={19} /></span>
                <div><h3>{detail.label}</h3><p>{detail.description}</p></div>
                <button
                  type="button"
                  className="source-switch"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? "Disable" : "Enable"} ${detail.label}`}
                  onClick={() => toggleSource(source)}
                >
                  <span />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon reddit-icon"><MessageCircle size={17} /></div>
          <div><h2>Reddit communities</h2><p>Prioritize focused communities over broad, noisy searches.</p></div>
        </div>
        <TagEditor
          label="Tracked subreddits"
          description="We pair these communities with your club-side phrases during discovery."
          values={settings.subreddits}
          placeholder="UniversityOfFlorida"
          prefix="r/"
          onChange={(values) => updateList("subreddits", values)}
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><Target size={17} /></div>
          <div><h2>Intent keywords</h2><p>Separate the student-organization problem from the brand-side opportunity.</p></div>
        </div>
        <div className="monitor-editor-grid">
          <TagEditor
            label="Club-side phrases"
            description="Questions from clubs looking for sponsors, products, or funding."
            values={settings.clubKeywords}
            placeholder="sponsorship proposal for student club"
            onChange={(values) => updateList("clubKeywords", values)}
          />
          <TagEditor
            label="Brand-side phrases"
            description="Questions from marketers looking for campus access or Gen Z reach."
            values={settings.brandKeywords}
            placeholder="how to activate on college campuses"
            onChange={(values) => updateList("brandKeywords", values)}
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><Search size={17} /></div>
          <div><h2>Channel searches</h2><p>Tailor the queries that find evergreen questions and recent videos.</p></div>
        </div>
        <div className="monitor-editor-grid">
          <TagEditor
            label="Quora searches"
            description="Plain phrases are automatically limited to quora.com."
            values={settings.quoraQueries}
            placeholder="brands that sponsor college events"
            onChange={(values) => updateList("quoraQueries", values)}
          />
          <TagEditor
            label="YouTube topics"
            description="Used to discover recent videos before checking their comments."
            values={settings.youtubeQueries}
            placeholder="college club fundraising"
            onChange={(values) => updateList("youtubeQueries", values)}
          />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><ShieldCheck size={17} /></div>
          <div><h2>Quality controls</h2><p>Control freshness, volume, and how strong a match must be.</p></div>
        </div>
        <div className="quality-settings-card">
          <label className="score-control">
            <span><strong>Minimum relevance</strong><small>Only surface opportunities scoring at least this high.</small></span>
            <div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={settings.minScore}
                onChange={(event) => onChange({ ...settings, minScore: Number(event.target.value) })}
              />
              <output>{settings.minScore}+</output>
            </div>
          </label>
          <label>
            <span><strong>Lookback window</strong><small>How far back source discovery should search.</small></span>
            <select
              value={settings.lookbackDays}
              onChange={(event) => onChange({ ...settings, lookbackDays: Number(event.target.value) })}
            >
              <option value={1}>Past 24 hours</option>
              <option value={7}>Past 7 days</option>
              <option value={14}>Past 14 days</option>
              <option value={30}>Past 30 days</option>
            </select>
          </label>
          <label>
            <span><strong>Scan cadence preference</strong><small>The free hosted schedule runs daily; faster schedules can be enabled later.</small></span>
            <select
              value={settings.scanCadenceHours}
              onChange={(event) => onChange({ ...settings, scanCadenceHours: Number(event.target.value) })}
            >
              <option value={3}>Every 3 hours</option>
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
              <option value={24}>Once a day</option>
            </select>
          </label>
        </div>
      </section>

      <section className="monitor-save-bar">
        <div>
          <ShieldCheck size={18} />
          <span><strong>Human review stays on.</strong> Swaya finds and drafts; you decide what gets posted.</span>
        </div>
        <button type="button" onClick={onTestScan} disabled={isScanning || enabledCount === 0}>
          <RefreshCw size={15} className={isScanning ? "spinning" : ""} />
          {isScanning ? "Testing monitor…" : "Save & run test scan"}
        </button>
      </section>
    </div>
  );
}
