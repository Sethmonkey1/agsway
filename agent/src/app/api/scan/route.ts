import { NextResponse } from "next/server";
import { runMonitor } from "@/lib/monitor";
import { normalizeMonitorSettings } from "@/lib/config";
import { saveMonitorSettings, saveOpportunities } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = normalizeMonitorSettings(body.settings);
    const result = await runMonitor(settings);
    await Promise.all([
      saveMonitorSettings(settings),
      saveOpportunities(result.opportunities),
    ]);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
