import { NextRequest, NextResponse } from "next/server";
import { runMonitor } from "@/lib/monitor";
import { loadMonitorSettings, pruneExpiredRedditOpportunities, saveOpportunities } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await loadMonitorSettings();
    const result = await runMonitor(settings);
    await Promise.all([
      saveOpportunities(result.opportunities),
      pruneExpiredRedditOpportunities(settings.lookbackDays),
    ]);
    return NextResponse.json({ ...result, stored: result.opportunities.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled scan failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
