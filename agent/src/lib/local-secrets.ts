import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IntegrationStatus } from "./types";

const ENV_FILE = path.join(process.cwd(), ".env.local");

const integrationKeys = {
  serper: "SERPER_API_KEY",
  youtube: "YOUTUBE_API_KEY",
} as const;

export type IntegrationName = keyof typeof integrationKeys;

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function canManageLocalSecrets(request: Request) {
  const url = new URL(request.url);
  return isLoopback(url.hostname) && !process.env.VERCEL;
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function readEnvFile() {
  try {
    return await readFile(ENV_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function parseManagedValues(content: string) {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match) values.set(match[1], unquote(match[2]));
  }
  return values;
}

function maskSecret(value: string | undefined) {
  if (!value) return null;
  return value.length <= 6 ? "••••••" : `••••••${value.slice(-4)}`;
}

export async function getIntegrationStatus(request: Request): Promise<IntegrationStatus> {
  const content = await readEnvFile();
  const fileValues = parseManagedValues(content);
  const serper = process.env.SERPER_API_KEY || fileValues.get("SERPER_API_KEY");
  const youtube = process.env.YOUTUBE_API_KEY || fileValues.get("YOUTUBE_API_KEY");
  const writable = canManageLocalSecrets(request);

  return {
    localOnly: true,
    writable,
    serper: { configured: Boolean(serper), masked: maskSecret(serper) },
    youtube: { configured: Boolean(youtube), masked: maskSecret(youtube) },
  };
}

function validateSecret(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 500 || /[\r\n]/.test(trimmed)) {
    throw new Error("API keys must be a single line under 500 characters.");
  }
  return trimmed;
}

export async function updateLocalIntegrations(
  request: Request,
  updates: { serper?: unknown; youtube?: unknown; clear?: unknown },
) {
  if (!canManageLocalSecrets(request)) {
    throw new Error("In-app key management is available only on the local Swaya server.");
  }

  const content = await readEnvFile();
  const lines = content ? content.split(/\r?\n/) : [];
  const clear = Array.isArray(updates.clear)
    ? new Set(updates.clear.filter((item): item is IntegrationName => item === "serper" || item === "youtube"))
    : new Set<IntegrationName>();
  const nextValues = {
    serper: validateSecret(updates.serper),
    youtube: validateSecret(updates.youtube),
  };

  const managedEnvKeys = new Set(Object.values(integrationKeys));
  const preserved = lines.filter((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    return !match || !managedEnvKeys.has(match[1] as typeof integrationKeys[IntegrationName]);
  });

  for (const name of Object.keys(integrationKeys) as IntegrationName[]) {
    const envKey = integrationKeys[name];
    if (clear.has(name)) {
      delete process.env[envKey];
      continue;
    }

    const value = nextValues[name];
    if (value) {
      preserved.push(`${envKey}=${JSON.stringify(value)}`);
      process.env[envKey] = value;
      continue;
    }

    const existing = process.env[envKey] || parseManagedValues(content).get(envKey);
    if (existing) preserved.push(`${envKey}=${JSON.stringify(existing)}`);
  }

  const normalized = `${preserved.filter((line, index, all) => line || index < all.length - 1).join("\n").trim()}\n`;
  await writeFile(ENV_FILE, normalized, { encoding: "utf8", mode: 0o600 });
  return getIntegrationStatus(request);
}
