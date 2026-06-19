import { defaultMonitorSettings, normalizeMonitorSettings } from "./config";
import { candidateToOpportunity } from "./scoring";
import { searchWithSerper } from "./sources/serper";
import { findYouTubeQuestions } from "./sources/youtube";
import { loadHostedIntegrationSecrets } from "./storage";
import type { MonitorSettings, ScanResponse, Source, SourceCandidate } from "./types";

function uniqueCandidates(candidates: SourceCandidate[]) {
  return Array.from(new Map(candidates.map((candidate) => [candidate.url, candidate])).values());
}

const campusSignals = [
  "college", "university", "campus", "student organization", "student org", "student club",
  "fraternity", "sorority", "chapter", "r/frat", "r/sororities", "college students",
];

const partnershipSignals = [
  "sponsor", "sponsorship", "funding", "fundraiser", "fundraising", "brand partnership",
  "free products", "product sampling", "campus activation", "student ambassador",
];

function isSwayaRelevant(candidate: SourceCandidate) {
  const text = `${candidate.community} ${candidate.title} ${candidate.excerpt}`.toLowerCase();
  return campusSignals.some((signal) => text.includes(signal))
    && partnershipSignals.some((signal) => text.includes(signal));
}

function isWithinLookback(candidate: SourceCandidate, lookbackDays: number) {
  if (candidate.source !== "reddit" || !candidate.postedAt) return true;
  const postedAt = new Date(candidate.postedAt).getTime();
  if (!Number.isFinite(postedAt)) return true;
  return postedAt >= Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
}

const searchStopWords = new Set([
  "a", "and", "are", "brands", "for", "get", "how", "i", "ideas", "of", "our", "that", "the", "to", "what",
]);

function topicClause(keywords: string[], fallback: string[]) {
  const terms = keywords
    .flatMap((keyword) => keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((term) => term.length > 2 && !searchStopWords.has(term));
  const unique = Array.from(new Set(terms)).slice(0, 10);
  return (unique.length ? unique : fallback).join(" OR ");
}

function redditQueries(settings: MonitorSettings) {
  const communities = settings.subreddits
    .map((subreddit) => subreddit.replace(/^r\//i, "").replace(/[^a-z0-9_]/gi, ""))
    .filter(Boolean)
    .slice(0, 9);
  const clubTopics = topicClause(settings.clubKeywords, ["sponsor", "sponsorship", "funding", "club", "student"]);
  const brandTopics = topicClause(settings.brandKeywords, ["campus", "marketing", "ambassador", "college", "sampling"]);
  const communityQueries: string[] = [];

  for (let index = 0; index < communities.length; index += 3) {
    const sites = communities
      .slice(index, index + 3)
      .map((community) => `site:reddit.com/r/${community}/comments`)
      .join(" OR ");
    communityQueries.push(`(${sites}) (${clubTopics})`);
  }

  const allCommunitySites = communities
    .map((community) => `site:reddit.com/r/${community}/comments`)
    .join(" OR ");
  return [
    ...communityQueries.slice(0, 3),
    allCommunitySites ? `(${allCommunitySites}) (${brandTopics})` : `site:reddit.com/comments (${brandTopics})`,
  ];
}

async function runSerperQueries(
  queries: string[],
  source: Extract<Source, "reddit" | "quora">,
  apiKey: string,
  lookbackDays: number,
) {
  const results: SourceCandidate[] = [];
  let error: string | null = null;

  // Sequential requests are gentler on small/free Serper accounts.
  for (const query of queries) {
    try {
      results.push(...(await searchWithSerper(query, source, apiKey, lookbackDays)));
    } catch (caught) {
      error = caught instanceof Error ? caught.message : `Could not search ${source}.`;
      break;
    }
  }

  return { results, error };
}

export async function runMonitor(input?: MonitorSettings): Promise<ScanResponse> {
  const settings = input ? normalizeMonitorSettings(input) : defaultMonitorSettings;
  const hostedKeys = await loadHostedIntegrationSecrets();
  const serperKey = hostedKeys.serper || process.env.SERPER_API_KEY;
  const youtubeKey = hostedKeys.youtube || process.env.YOUTUBE_API_KEY;
  const scannedSources: Source[] = [];
  const notes: string[] = [];
  const candidates: SourceCandidate[] = [];
  const enabledSources = (Object.entries(settings.enabledSources)
    .filter(([, enabled]) => enabled)
    .map(([source]) => source)) as Source[];

  if (enabledSources.length === 0) {
    return {
      mode: "not_configured",
      scannedAt: new Date().toISOString(),
      scannedSources: [],
      opportunities: [],
      notes: ["No sources are enabled. Update the monitor settings before scanning."],
    };
  }

  if (!serperKey && !youtubeKey) {
    return {
      mode: "not_configured",
      scannedAt: new Date().toISOString(),
      scannedSources: enabledSources,
      opportunities: [],
      notes: ["No API connections are configured. Add a source in Settings before scanning."],
    };
  }

  if (serperKey) {
    if (settings.enabledSources.reddit) {
      const redditSearch = await runSerperQueries(
        redditQueries(settings),
        "reddit",
        serperKey,
        settings.lookbackDays,
      );
      candidates.push(...redditSearch.results);
      if (redditSearch.error) notes.push(redditSearch.error);
      scannedSources.push("reddit");
    }

    if (settings.enabledSources.quora) {
      const quoraSearch = await runSerperQueries(
        settings.quoraQueries
          .slice(0, 5)
          .map((query) => query.startsWith("site:quora.com") ? query : `site:quora.com "${query}"`),
        "quora",
        serperKey,
        settings.lookbackDays,
      );
      candidates.push(...quoraSearch.results);
      if (quoraSearch.error) notes.push(quoraSearch.error);
      scannedSources.push("quora");
    }
  } else if (settings.enabledSources.reddit || settings.enabledSources.quora) {
    notes.push("Reddit and Quora skipped because SERPER_API_KEY is not configured.");
  }

  if (settings.enabledSources.youtube) {
    if (youtubeKey) {
      candidates.push(...(await findYouTubeQuestions(
        settings.youtubeQueries.slice(0, 6),
        youtubeKey,
        settings.lookbackDays,
      )));
      scannedSources.push("youtube");
    } else {
      notes.push("YouTube skipped because YOUTUBE_API_KEY is not configured.");
    }
  }

  const opportunities = uniqueCandidates(candidates)
    .filter((candidate) => isWithinLookback(candidate, settings.lookbackDays))
    .filter((candidate) => candidate.source !== "reddit" || isSwayaRelevant(candidate))
    .map(candidateToOpportunity)
    .filter((opportunity) => opportunity.score >= settings.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  for (const source of scannedSources) {
    const found = opportunities.filter((opportunity) => opportunity.source === source).length;
    notes.push(`${source[0].toUpperCase()}${source.slice(1)}: ${found} matched ${found === 1 ? "opportunity" : "opportunities"}.`);
  }

  return {
    mode: scannedSources.length ? "live" : "not_configured",
    scannedAt: new Date().toISOString(),
    scannedSources,
    opportunities,
    notes,
  };
}
