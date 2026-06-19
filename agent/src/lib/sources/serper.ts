import type { Source, SourceCandidate } from "../types";

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

export async function searchWithSerper(
  query: string,
  source: Extract<Source, "reddit" | "quora">,
  apiKey: string,
  lookbackDays = 7,
): Promise<SourceCandidate[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      num: 10,
      tbs:
        lookbackDays <= 1
          ? "qdr:d"
          : lookbackDays <= 7
            ? "qdr:w"
            : "qdr:m",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const explanation =
      response.status === 401
        ? "the API key was not accepted"
        : response.status === 403
          ? "the account has no available credits or access is restricted"
          : response.status === 429
            ? "the account is being rate limited"
            : `the service returned ${response.status}`;
    throw new Error(`Serper could not search ${source}: ${explanation}.`);
  }

  const data = (await response.json()) as SerperResponse;
  return (data.organic ?? [])
    .filter((item): item is Required<Pick<SerperOrganicResult, "title" | "link">> & SerperOrganicResult => {
      if (!item.title || !item.link) return false;
      try {
        const hostname = new URL(item.link).hostname.replace(/^www\./, "");
        return source === "reddit"
          ? hostname === "reddit.com" || hostname.endsWith(".reddit.com")
          : hostname === "quora.com" || hostname.endsWith(".quora.com");
      } catch {
        return false;
      }
    })
    .map((item) => {
      const parsed = new URL(item.link);
      const parsedDate = item.date ? new Date(item.date) : null;
      const postedAt = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : new Date().toISOString();
      return {
        externalId: item.link,
        source,
        community:
          source === "reddit"
            ? parsed.pathname.match(/\/r\/([^/]+)/)?.[1]
              ? `r/${parsed.pathname.match(/\/r\/([^/]+)/)?.[1]}`
              : "Reddit"
            : "Quora",
        title: item.title,
        excerpt: item.snippet || "Open the result to review the full conversation.",
        url: item.link,
        postedAt,
      };
    });
}
