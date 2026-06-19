export type Source = "reddit" | "quora" | "youtube";

export type Audience = "club" | "brand";

export type OpportunityStatus = "new" | "saved" | "replied" | "dismissed";

export interface MonitorSettings {
  enabledSources: Record<Source, boolean>;
  subreddits: string[];
  clubKeywords: string[];
  brandKeywords: string[];
  quoraQueries: string[];
  youtubeQueries: string[];
  minScore: number;
  lookbackDays: number;
  scanCadenceHours: number;
}

export interface SourceCandidate {
  externalId: string;
  source: Source;
  community: string;
  author?: string;
  title: string;
  excerpt: string;
  url: string;
  postedAt?: string;
}

export interface Opportunity {
  id: string;
  source: Source;
  audience: Audience;
  community: string;
  author: string;
  title: string;
  excerpt: string;
  url: string;
  postedAt: string;
  score: number;
  intent: string;
  tags: string[];
  reasoning: string;
  draft: string;
  status: OpportunityStatus;
}

export interface ScanResponse {
  mode: "live" | "not_configured";
  scannedAt: string;
  scannedSources: Source[];
  opportunities: Opportunity[];
  notes: string[];
  storage?: {
    configured: boolean;
    savedCount: number;
  };
}

export interface IntegrationConnection {
  configured: boolean;
  masked: string | null;
}

export interface IntegrationStatus {
  localOnly: boolean;
  writable: boolean;
  requiresUnlock: boolean;
  serper: IntegrationConnection;
  youtube: IntegrationConnection;
}
