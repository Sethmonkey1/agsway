import { monitoredQuestionPhrases } from "../config";
import type { SourceCandidate } from "../types";

interface YouTubeSearchResponse {
  items?: Array<{ id?: { videoId?: string }; snippet?: { channelTitle?: string } }>;
}

interface YouTubeCommentResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      topLevelComment?: {
        id?: string;
        snippet?: {
          authorDisplayName?: string;
          textDisplay?: string;
          publishedAt?: string;
        };
      };
    };
  }>;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function looksLikeQuestion(value: string) {
  const text = value.toLowerCase();
  return text.includes("?") || monitoredQuestionPhrases.some((phrase) => text.includes(phrase));
}

async function searchVideoIds(query: string, apiKey: string, lookbackDays: number) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "date",
    maxResults: "3",
    publishedAfter: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
    q: query,
    key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`YouTube search returned ${response.status}`);
  const data = (await response.json()) as YouTubeSearchResponse;
  return (data.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({ videoId: item.id!.videoId!, channel: item.snippet?.channelTitle || "YouTube" }));
}

async function questionComments(videoId: string, channel: string, apiKey: string): Promise<SourceCandidate[]> {
  const params = new URLSearchParams({
    part: "snippet",
    videoId,
    order: "time",
    maxResults: "40",
    textFormat: "html",
    key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = (await response.json()) as YouTubeCommentResponse;
  return (data.items ?? []).flatMap((item) => {
    const comment = item.snippet?.topLevelComment;
    const snippet = comment?.snippet;
    const text = stripHtml(snippet?.textDisplay || "");
    if (!comment?.id || !text || !looksLikeQuestion(text)) return [];
    return [{
      externalId: comment.id,
      source: "youtube" as const,
      community: channel,
      author: snippet?.authorDisplayName || "YouTube user",
      title: text.length > 105 ? `${text.slice(0, 102)}…` : text,
      excerpt: text,
      url: `https://www.youtube.com/watch?v=${videoId}&lc=${comment.id}`,
      postedAt: snippet?.publishedAt,
    }];
  });
}

export async function findYouTubeQuestions(queries: readonly string[], apiKey: string, lookbackDays = 14) {
  const videos = (await Promise.all(
    queries.map((query) => searchVideoIds(query, apiKey, lookbackDays)),
  )).flat();
  const uniqueVideos = Array.from(new Map(videos.map((video) => [video.videoId, video])).values());
  return (await Promise.all(
    uniqueVideos.map((video) => questionComments(video.videoId, video.channel, apiKey)),
  )).flat();
}
