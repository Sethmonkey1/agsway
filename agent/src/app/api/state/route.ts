import { NextResponse } from "next/server";
import { loadStoredState } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadStoredState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load stored data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
