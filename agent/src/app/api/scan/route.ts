import { NextResponse } from "next/server";
import { runMonitor } from "@/lib/monitor";
import { normalizeMonitorSettings } from "@/lib/config";
import { isDatabaseConfigured, saveMonitorSettings, saveOpportunities } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = normalizeMonitorSettings(body.settings);
    const result = await runMonitor(settings);
    const [, opportunitiesSaved] = await Promise.all([
      saveMonitorSettings(settings),
      saveOpportunities(result.opportunities),
    ]);
    if (isDatabaseConfigured() && result.opportunities.length > 0 && !opportunitiesSaved) {
      throw new Error("Neon did not save the scan findings.");
    }
    return NextResponse.json({
      ...result,
      storage: {
        configured: isDatabaseConfigured(),
        savedCount: opportunitiesSaved ? result.opportunities.length : 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
