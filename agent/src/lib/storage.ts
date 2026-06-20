import postgres from "postgres";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { defaultMonitorSettings, normalizeMonitorSettings } from "./config";
import type { MonitorSettings, Opportunity, OpportunityStatus, Source, Audience } from "./types";

let client: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

interface OpportunityRow {
  id: string;
  source: Source;
  audience: Audience;
  community: string;
  author: string;
  title: string;
  excerpt: string;
  url: string;
  posted_at: Date | string;
  score: number;
  intent: string;
  tags: string[];
  reasoning: string;
  draft: string;
  status: OpportunityStatus;
}

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  if (!client) {
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    client = postgres(connectionString, {
      max: 1,
      prepare: false,
      ssl: isLocal ? false : "require",
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return client;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureSchema() {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    const sql = getClient();
    schemaReady = (async () => {
      await sql`
        create table if not exists swaya_monitor_settings (
          id text primary key,
          settings jsonb not null,
          updated_at timestamptz not null default now()
        )
      `;
      await sql`
        create table if not exists swaya_opportunities (
          id text primary key,
          source text not null,
          audience text not null,
          community text not null,
          author text not null,
          title text not null,
          excerpt text not null,
          url text not null,
          posted_at timestamptz not null,
          score integer not null,
          intent text not null,
          tags jsonb not null default '[]'::jsonb,
          reasoning text not null,
          draft text not null,
          status text not null default 'new',
          discovered_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`create index if not exists swaya_opportunities_posted_at_idx on swaya_opportunities (posted_at desc)`;
      await sql`create index if not exists swaya_opportunities_status_idx on swaya_opportunities (status)`;
      await sql`alter table swaya_opportunities add column if not exists notified_at timestamptz`;
      await sql`
        create table if not exists swaya_integration_secrets (
          name text primary key,
          encrypted_value text not null,
          updated_at timestamptz not null default now()
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    source: row.source,
    audience: row.audience,
    community: row.community,
    author: row.author,
    title: row.title,
    excerpt: row.excerpt,
    url: row.url,
    postedAt: toIso(row.posted_at),
    score: row.score,
    intent: row.intent,
    tags: row.tags,
    reasoning: row.reasoning,
    draft: row.draft,
    status: row.status,
  };
}

export async function loadStoredState() {
  if (!isDatabaseConfigured()) {
    return { databaseConfigured: false, opportunities: [] as Opportunity[], settings: defaultMonitorSettings };
  }

  await ensureSchema();
  const sql = getClient();
  const [opportunityRows, settingRows] = await Promise.all([
    sql<OpportunityRow[]>`select id, source, audience, community, author, title, excerpt, url, posted_at, score, intent, tags, reasoning, draft, status from swaya_opportunities order by discovered_at desc limit 250`,
    sql<{ settings: unknown }[]>`select settings from swaya_monitor_settings where id = 'default' limit 1`,
  ]);

  return {
    databaseConfigured: true,
    opportunities: opportunityRows.map(rowToOpportunity),
    settings: settingRows[0] ? normalizeMonitorSettings(settingRows[0].settings) : defaultMonitorSettings,
  };
}

export async function loadMonitorSettings() {
  if (!isDatabaseConfigured()) return defaultMonitorSettings;
  await ensureSchema();
  const rows = await getClient()<{ settings: unknown }[]>`
    select settings from swaya_monitor_settings where id = 'default' limit 1
  `;
  return rows[0] ? normalizeMonitorSettings(rows[0].settings) : defaultMonitorSettings;
}

export async function saveMonitorSettings(settings: MonitorSettings) {
  if (!isDatabaseConfigured()) return false;
  await ensureSchema();
  const normalized = normalizeMonitorSettings(settings);
  await getClient()`
    insert into swaya_monitor_settings (id, settings, updated_at)
    values ('default', ${JSON.stringify(normalized)}::jsonb, now())
    on conflict (id) do update set settings = excluded.settings, updated_at = now()
  `;
  return true;
}

export async function saveOpportunities(opportunities: Opportunity[]) {
  if (!isDatabaseConfigured() || opportunities.length === 0) return false;
  await ensureSchema();
  const sql = getClient();

  await sql.begin(async (transaction) => {
    for (const opportunity of opportunities) {
      await transaction`
        insert into swaya_opportunities (
          id, source, audience, community, author, title, excerpt, url, posted_at,
          score, intent, tags, reasoning, draft, status, updated_at
        ) values (
          ${opportunity.id}, ${opportunity.source}, ${opportunity.audience}, ${opportunity.community},
          ${opportunity.author}, ${opportunity.title}, ${opportunity.excerpt}, ${opportunity.url},
          ${opportunity.postedAt}, ${opportunity.score}, ${opportunity.intent},
          ${JSON.stringify(opportunity.tags)}::jsonb, ${opportunity.reasoning}, ${opportunity.draft},
          ${opportunity.status}, now()
        )
        on conflict (id) do update set
          source = excluded.source,
          audience = excluded.audience,
          community = excluded.community,
          author = excluded.author,
          title = excluded.title,
          excerpt = excluded.excerpt,
          url = excluded.url,
          posted_at = excluded.posted_at,
          score = excluded.score,
          intent = excluded.intent,
          tags = excluded.tags,
          reasoning = excluded.reasoning,
          updated_at = now()
      `;
    }
  });
  return true;
}

export async function pruneExpiredRedditOpportunities(lookbackDays: number) {
  if (!isDatabaseConfigured()) return false;
  await ensureSchema();
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  await getClient()`
    delete from swaya_opportunities
    where source = 'reddit' and status = 'new' and posted_at < ${cutoff}
  `;
  return true;
}

export async function updateStoredOpportunity(
  id: string,
  update: { status?: OpportunityStatus; draft?: string },
) {
  if (!isDatabaseConfigured()) return false;
  await ensureSchema();
  const sql = getClient();

  if (update.status !== undefined && update.draft !== undefined) {
    await sql`update swaya_opportunities set status = ${update.status}, draft = ${update.draft}, updated_at = now() where id = ${id}`;
  } else if (update.status !== undefined) {
    await sql`update swaya_opportunities set status = ${update.status}, updated_at = now() where id = ${id}`;
  } else if (update.draft !== undefined) {
    await sql`update swaya_opportunities set draft = ${update.draft}, updated_at = now() where id = ${id}`;
  }
  return true;
}

type HostedIntegrationName = "serper" | "youtube" | "resend";
type HostedIntegrationSecrets = Partial<Record<HostedIntegrationName, string>>;

function encryptionKey() {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required for hosted key management.");
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored integration key is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function canManageHostedSecrets() {
  return isDatabaseConfigured() && Boolean(process.env.CRON_SECRET);
}

export async function loadHostedIntegrationSecrets(): Promise<HostedIntegrationSecrets> {
  if (!canManageHostedSecrets()) return {};
  await ensureSchema();
  const rows = await getClient()<{ name: HostedIntegrationName; encrypted_value: string }[]>`
    select name, encrypted_value from swaya_integration_secrets where name in ('serper', 'youtube', 'resend')
  `;
  const result: HostedIntegrationSecrets = {};
  for (const row of rows) {
    try {
      result[row.name] = decryptSecret(row.encrypted_value);
    } catch {
      // If the workspace encryption key was rotated, allow the owner to
      // unlock the page and replace the now-unreadable integration value.
    }
  }
  return result;
}

export async function updateHostedIntegrationSecrets(
  updates: HostedIntegrationSecrets,
  clear: HostedIntegrationName[] = [],
) {
  if (!canManageHostedSecrets()) {
    throw new Error("Connect Postgres and configure CRON_SECRET before editing hosted keys.");
  }
  await ensureSchema();
  const sql = getClient();
  await sql.begin(async (transaction) => {
    for (const name of clear) {
      await transaction`delete from swaya_integration_secrets where name = ${name}`;
    }
    for (const name of ["serper", "youtube", "resend"] as HostedIntegrationName[]) {
      const value = updates[name];
      if (!value) continue;
      await transaction`
        insert into swaya_integration_secrets (name, encrypted_value, updated_at)
        values (${name}, ${encryptSecret(value)}, now())
        on conflict (name) do update set encrypted_value = excluded.encrypted_value, updated_at = now()
      `;
    }
  });
}

export async function loadUnnotifiedOpportunities(candidateIds: string[]) {
  if (!isDatabaseConfigured() || candidateIds.length === 0) return [] as Opportunity[];
  await ensureSchema();
  const rows = await getClient()<OpportunityRow[]>`
    select id, source, audience, community, author, title, excerpt, url, posted_at, score, intent, tags, reasoning, draft, status
    from swaya_opportunities
    where notified_at is null
    order by discovered_at desc
    limit 250
  `;
  const candidates = new Set(candidateIds);
  return rows.filter((row) => candidates.has(row.id)).map(rowToOpportunity);
}

export async function markOpportunitiesNotified(ids: string[]) {
  if (!isDatabaseConfigured() || ids.length === 0) return false;
  await ensureSchema();
  const sql = getClient();
  await sql.begin(async (transaction) => {
    for (const id of ids) {
      await transaction`update swaya_opportunities set notified_at = now() where id = ${id}`;
    }
  });
  return true;
}
