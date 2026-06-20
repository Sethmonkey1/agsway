import type { Audience, Opportunity, SourceCandidate } from "./types";

const clubSignals = [
  "club",
  "student organization",
  "fraternity",
  "sorority",
  "our chapter",
  "our college",
  "our school",
  "funding",
  "donation",
  "grant",
  "budget",
  "sponsor",
  "event",
];

const brandSignals = [
  "our brand",
  "marketing",
  "campus marketing",
  "college marketing",
  "reach college students",
  "partnership",
  "users",
  "customers",
  "customer acquisition",
  "user acquisition",
  "traction",
  "distribution",
  "early adopters",
  "go to market",
  "campus activation",
  "ambassador",
  "product sampling",
  "college students",
  "gen z",
  "cpg",
];

const highIntentSignals = [
  "how do",
  "how can",
  "what brands",
  "who should",
  "looking for",
  "need sponsors",
  "need funding",
  "need money",
  "where can",
  "can't find",
  "cannot find",
  "first users",
  "first customers",
  "no users",
  "no traction",
  "struggling",
  "send products",
  "small budget",
  "proposal",
  "contact",
];

function signalCount(text: string, signals: string[]) {
  return signals.reduce((total, signal) => total + (text.includes(signal) ? 1 : 0), 0);
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function classifyCandidate(candidate: SourceCandidate) {
  const text = `${candidate.title} ${candidate.excerpt}`.toLowerCase();
  const community = candidate.community.toLowerCase();
  const broadRedditCommunities = ["r/marketing", "r/advertising", "r/entrepreneur", "r/startups", "r/smallbusiness"];
  const focusedCommunityBonus = candidate.source === "reddit"
    && community.startsWith("r/")
    && !broadRedditCommunities.includes(community)
    ? 6
    : 0;
  const clubScore = signalCount(text, clubSignals);
  const brandScore = signalCount(text, brandSignals);
  const highIntent = signalCount(text, highIntentSignals);
  const questionBonus = text.includes("?") ? 8 : 0;
  const audience: Audience = brandScore > clubScore ? "brand" : "club";
  const score = Math.min(98, 54 + focusedCommunityBonus + Math.max(clubScore, brandScore) * 6 + highIntent * 5 + questionBonus);

  return {
    audience,
    score,
    intent:
      audience === "brand"
        ? text.includes("traction") || text.includes("users") || text.includes("customers")
          ? "Looking for users and distribution"
          : "Exploring campus marketing"
        : text.includes("proposal")
          ? "Building a sponsor proposal"
          : "Seeking sponsorship guidance",
  };
}

function draftFor(candidate: SourceCandidate, audience: Audience) {
  const text = `${candidate.title} ${candidate.excerpt}`.toLowerCase();
  if (text.includes("proposal")) {
    return "A strong proposal should make six things easy to understand: who your members are, what you're organizing, expected reach, what you're asking for, what the brand receives, and how you'll report results. Keep it to one or two pages and make the partnership idea specific rather than sending a general request for money.";
  }
  if (text.includes("smaller school") || text.includes("small school")) {
    return "Smaller schools can absolutely be valuable when the audience is specific and engaged. Brands often care more about fit and a credible activation plan than raw campus size. Lead with expected participation, why the product belongs in that setting, and exactly how the partnership would be executed.";
  }
  if (audience === "brand") {
    return "A practical first test is to partner with a few established student organizations whose members already match your customer. Give each group one clear activation, a lightweight brief, and a simple way to report participation and feedback. That produces a cleaner signal than recruiting a large ambassador cohort before you know what works.";
  }
  return "Start with a one-page brief covering your audience, event or initiative, timing, expected participation, and one specific partnership idea. Then target brands that naturally fit the experience. A concrete offer—such as product sampling, a workshop, or a sponsored activity—usually gets a better response than a broad request for funding.";
}

export function candidateToOpportunity(candidate: SourceCandidate): Opportunity {
  const classification = classifyCandidate(candidate);
  return {
    id: `${candidate.source}-${stableId(candidate.externalId || candidate.url)}`,
    source: candidate.source,
    audience: classification.audience,
    community: clean(candidate.community),
    author: clean(candidate.author || "unknown"),
    title: clean(candidate.title),
    excerpt: clean(candidate.excerpt),
    url: candidate.url,
    postedAt: candidate.postedAt || new Date().toISOString(),
    score: classification.score,
    intent: classification.intent,
    tags: [classification.audience === "club" ? "club-side" : "brand-side", "live result"],
    reasoning:
      classification.audience === "club"
        ? "This conversation contains direct signals around student-organization funding, sponsorship, or partnership execution."
        : "This conversation contains direct signals around campus marketing, ambassadors, sampling, or reaching college audiences.",
    draft: draftFor(candidate, classification.audience),
    status: "new",
  };
}
