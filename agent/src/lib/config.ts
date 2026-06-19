import type { MonitorSettings } from "./types";

export const clubQueries = [
  "how to get sponsors for college club",
  "student organization funding",
  "sponsors for fraternity event",
  "brands that sponsor college events",
  "free products for college clubs",
  "fundraising ideas for student organizations",
  "how to contact brands for sponsorship",
] as const;

export const brandQueries = [
  "college marketing ideas",
  "campus ambassador alternatives",
  "how to market to college students",
  "campus activation",
  "Gen Z product sampling",
  "student ambassador program",
] as const;

export const subreddits = [
  "college",
  "Frat",
  "Sororities",
  "marketing",
  "Entrepreneur",
  "startups",
  "advertising",
] as const;

export const quoraQueries = [
  'site:quora.com "sponsors for college events"',
  'site:quora.com "student organization funding"',
  'site:quora.com "market to college students"',
  'site:quora.com "campus ambassador program"',
  'site:quora.com "brands sponsor university clubs"',
] as const;

export const youtubeQueries = [
  "college club fundraising",
  "event sponsorships for student organizations",
  "student organization leadership funding",
  "campus marketing",
  "brand ambassador programs college",
  "Gen Z product sampling",
] as const;

export const monitoredQuestionPhrases = [
  "how do i find sponsors",
  "what brands should i contact",
  "how can our club get funding",
  "does this work for smaller schools",
  "how do companies find student ambassadors",
  "how much should a brand pay",
] as const;

export const defaultMonitorSettings: MonitorSettings = {
  enabledSources: {
    reddit: true,
    quora: true,
    youtube: true,
  },
  subreddits: [...subreddits],
  clubKeywords: [...clubQueries],
  brandKeywords: [...brandQueries],
  quoraQueries: [...quoraQueries],
  youtubeQueries: [...youtubeQueries],
  minScore: 70,
  lookbackDays: 14,
  scanCadenceHours: 6,
};

function cleanList(value: unknown, fallback: string[], limit = 30) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, limit);
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

export function normalizeMonitorSettings(value: unknown): MonitorSettings {
  const input = value && typeof value === "object" ? value as Partial<MonitorSettings> : {};
  return {
    enabledSources: {
      reddit: input.enabledSources?.reddit !== false,
      quora: input.enabledSources?.quora !== false,
      youtube: input.enabledSources?.youtube !== false,
    },
    subreddits: cleanList(input.subreddits, defaultMonitorSettings.subreddits, 40),
    clubKeywords: cleanList(input.clubKeywords, defaultMonitorSettings.clubKeywords),
    brandKeywords: cleanList(input.brandKeywords, defaultMonitorSettings.brandKeywords),
    quoraQueries: cleanList(input.quoraQueries, defaultMonitorSettings.quoraQueries),
    youtubeQueries: cleanList(input.youtubeQueries, defaultMonitorSettings.youtubeQueries),
    minScore: boundedNumber(input.minScore, defaultMonitorSettings.minScore, 50, 95),
    lookbackDays: boundedNumber(input.lookbackDays, defaultMonitorSettings.lookbackDays, 1, 30),
    scanCadenceHours: boundedNumber(
      input.scanCadenceHours,
      defaultMonitorSettings.scanCadenceHours,
      1,
      24,
    ),
  };
}
