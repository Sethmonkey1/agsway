import { NextResponse } from "next/server";
import { normalizeMonitorSettings } from "@/lib/config";
import { saveMonitorSettings } from "@/lib/storage";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const settings = normalizeMonitorSettings(body.settings);
    const saved = await saveMonitorSettings(settings);
    return NextResponse.json({ saved, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save monitor settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
