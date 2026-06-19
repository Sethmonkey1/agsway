import { NextResponse } from "next/server";
import {
  canManageLocalSecrets,
  getIntegrationStatus,
  updateLocalIntegrations,
} from "@/lib/local-secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
    if (loopbackHosts.has(originUrl.hostname) && loopbackHosts.has(requestUrl.hostname)) {
      return originUrl.port === requestUrl.port;
    }
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  return NextResponse.json(await getIntegrationStatus(request));
}

export async function POST(request: Request) {
  if (!canManageLocalSecrets(request) || !sameOrigin(request)) {
    return NextResponse.json(
      { error: "Local integration settings are not available for this request." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    return NextResponse.json(await updateLocalIntegrations(request, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update integrations.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
