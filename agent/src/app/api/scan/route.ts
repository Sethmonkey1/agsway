import { NextResponse } from "next/server";
import { runMonitor } from "@/lib/monitor";
import { normalizeMonitorSettings } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await runMonitor(normalizeMonitorSettings(body.settings)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
