import type { MonitorSettings } from "./types";

export const clubQueries = [
  "college club sponsorship",
  "student organization sponsorship",
  "campus event sponsors",
  "fraternity event sponsorship",
  "sorority event sponsorship",
  "product donations for student organizations",
  "student club brand partnerships",
  "sponsorship proposal for college event",
] as const;

export const brandQueries = [
  "campus marketing strategy",
  "reach college students",
  "student organization partnerships",
  "campus product sampling",
  "college event sponsorship",
  "student ambassador programs",
  "Gen Z campus activation",
] as const;

export const subreddits = [
  "college",
  "Frat",
  "Sororities",
  "marketing",
  "advertising",
] as const;

export const quoraQueries = [
  "college event sponsors",
  "student organization sponsorship",
  "brands sponsor college clubs",
  "market to college students",
  "campus ambassador program alternatives",
  "product sampling on college campuses",
] as const;

export const youtubeQueries = [
  "college club sponsorship",
  "college event sponsorship",
  "student organization sponsorship",
  "campus marketing strategy",
  "college brand ambassador program",
  "product sampling college campuses",
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
  lookbackDays: 30,
  scanCadenceHours: 24,
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
  const legacyPreset = Array.isArray(input.clubKeywords)
    && input.clubKeywords.includes("how to get sponsors for college club")
    && input.clubKeywords.includes("fundraising ideas for student organizations")
    && Array.isArray(input.brandKeywords)
    && input.brandKeywords.includes("college marketing ideas")
    && Array.isArray(input.youtubeQueries)
    && input.youtubeQueries.includes("student organization leadership funding");

  return {
    enabledSources: {
      reddit: input.enabledSources?.reddit !== false,
      quora: input.enabledSources?.quora !== false,
      youtube: input.enabledSources?.youtube !== false,
    },
    subreddits: legacyPreset
      ? [...defaultMonitorSettings.subreddits]
      : cleanList(input.subreddits, defaultMonitorSettings.subreddits, 40),
    clubKeywords: legacyPreset
      ? [...defaultMonitorSettings.clubKeywords]
      : cleanList(input.clubKeywords, defaultMonitorSettings.clubKeywords),
    brandKeywords: legacyPreset
      ? [...defaultMonitorSettings.brandKeywords]
      : cleanList(input.brandKeywords, defaultMonitorSettings.brandKeywords),
    quoraQueries: legacyPreset
      ? [...defaultMonitorSettings.quoraQueries]
      : cleanList(input.quoraQueries, defaultMonitorSettings.quoraQueries),
    youtubeQueries: legacyPreset
      ? [...defaultMonitorSettings.youtubeQueries]
      : cleanList(input.youtubeQueries, defaultMonitorSettings.youtubeQueries),
    minScore: legacyPreset
      ? defaultMonitorSettings.minScore
      : boundedNumber(input.minScore, defaultMonitorSettings.minScore, 50, 95),
    lookbackDays: legacyPreset
      ? defaultMonitorSettings.lookbackDays
      : boundedNumber(input.lookbackDays, defaultMonitorSettings.lookbackDays, 1, 30),
    scanCadenceHours: 24,
  };
}
