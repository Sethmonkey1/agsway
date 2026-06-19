# Swaya Opportunity Agent

A human-in-the-loop inbox for finding Reddit, Quora, and YouTube conversations where Swaya can provide a genuinely useful answer.

## What works now

- Reddit and Quora discovery through Google results via Serper
- YouTube video and question discovery through the official YouTube Data API
- Relevance scoring for club-side and brand-side opportunities
- Editable monitor settings for sources, subreddits, search phrases, freshness, cadence, and score threshold
- In-app API integration settings with masked status and server-only local storage
- Editable, non-promotional response suggestions
- Save, dismiss, copy, and mark-as-replied actions stored locally in the browser
- Protected endpoint for scheduled scans

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

For local use, Serper and YouTube keys can also be added from **Settings → Integrations**. The server writes them to `.env.local`; the browser only receives whether each key is configured plus a masked suffix. Raw keys are never saved in localStorage or returned by the API.

In-app secret editing is intentionally limited to `localhost`/`127.0.0.1`. A deployed version should store keys in encrypted hosting secrets or a server-side secrets vault.

The manual scan endpoint is `POST /api/scan`. A scheduler can call `GET /api/cron/scan` with `Authorization: Bearer <CRON_SECRET>`.

Monitor settings are currently saved in the browser and are sent with manual scans. Before multi-user or unattended deployment, move them into the same durable database used for opportunity deduplication.

## Sensible rollout

1. Run in review-only mode and tune false positives.
2. Add a durable database and Slack/email alerts before scheduling unattended scans.
3. Add AI classification/drafting only after collecting examples of good and bad matches.
4. Keep publishing manual. Helpful participation is the product; automated posting is a fast route to spam.
