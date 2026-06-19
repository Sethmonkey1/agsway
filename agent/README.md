# Swaya Opportunity Agent

A human-in-the-loop inbox for finding Reddit, Quora, and YouTube conversations where Swaya can provide a genuinely useful answer.

## What works now

- Reddit and Quora discovery through Google results via Serper
- YouTube video and question discovery through the official YouTube Data API
- Relevance scoring for club-side and brand-side opportunities
- Editable monitor settings for sources, subreddits, search phrases, freshness, cadence, and score threshold
- In-app API integration settings with masked status and server-only local storage
- Editable, non-promotional response suggestions
- Save, dismiss, drafts, monitor settings, and scan results stored in Postgres when `DATABASE_URL` is configured
- Browser storage fallback for the local desktop app
- Protected daily Vercel cron scan

The app deliberately does not auto-post. A person should read the full conversation, adapt the answer, and check each community's rules.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The inbox starts empty and only displays opportunities returned by connected live sources.

## Start from the Windows desktop

Double-click **Swaya Agent** on the Desktop. The shortcut runs `scripts/Start-Swaya.ps1`, starts the server invisibly on port `4317` if needed, waits for it to become healthy, and opens Swaya in an app-style Edge window.

Closing the window does not duplicate or damage the server. Click the shortcut again whenever you want to reopen Swaya; Windows will stop the small background server automatically when you sign out or restart.

## Connect live sources

Add these values to `.env.local`:

- `SERPER_API_KEY`: searches recent Google results for Reddit and Quora conversations.
- `YOUTUBE_API_KEY`: requires YouTube Data API v3 in a Google Cloud project.
- `CRON_SECRET`: protects the scheduled scan endpoint.
- `DATABASE_URL`: standard hosted Postgres connection string (Neon through the Vercel Marketplace is the simplest option).

Serper and YouTube keys can be added from **Settings → Integrations** in both versions. Locally, the server writes them to `.env.local`. On Vercel, enter `CRON_SECRET` once to unlock the screen; keys are AES-GCM encrypted before being stored in Neon. The browser only receives masked connection status—raw saved keys are never returned by the API or placed in localStorage.

Use a long, random `CRON_SECRET` in production. It protects scheduled scans, unlocks hosted key management, and derives the database-encryption key. If it is changed later, re-enter the source API keys in Swaya.

The manual scan endpoint is `POST /api/scan`. It stores new opportunities when Postgres is connected. Vercel calls `GET /api/cron/scan` daily using the schedule in `vercel.json`; `CRON_SECRET` protects that endpoint.

## Deploy on Vercel with durable storage

1. In the Vercel project, open **Storage** or **Marketplace** and add a Neon Postgres database.
2. Make sure its connection string is exposed to the project as `DATABASE_URL`.
3. Under **Project Settings → Environment Variables**, add `SERPER_API_KEY`, `YOUTUBE_API_KEY`, and a long random `CRON_SECRET`.
4. Redeploy the project so the new variables are available.

On the first request, Swaya creates its two tables and indexes automatically. API keys remain in Vercel; they are never written to Postgres or sent to the browser. The included free-friendly cron schedule runs once each day at 14:00 UTC.

## Sensible rollout

1. Run in review-only mode and tune false positives.
2. Add Slack/email alerts once the stored results and relevance tuning look good.
3. Add AI classification/drafting only after collecting examples of good and bad matches.
4. Keep publishing manual. Helpful participation is the product; automated posting is a fast route to spam.
