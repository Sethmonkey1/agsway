import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  canManageLocalSecrets,
  getIntegrationStatus,
  updateHostedIntegrations,
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
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Integration settings must be changed from this Swaya workspace." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    if (canManageLocalSecrets(request)) {
      return NextResponse.json(await updateLocalIntegrations(request, body));
    }

    const expected = process.env.CRON_SECRET;
    const provided = request.headers.get("x-swaya-admin-key") || "";
    if (!expected) {
      return NextResponse.json({ error: "Configure CRON_SECRET in Vercel to unlock hosted key editing." }, { status: 503 });
    }
    const expectedHash = createHash("sha256").update(expected).digest();
    const providedHash = createHash("sha256").update(provided).digest();
    if (!timingSafeEqual(expectedHash, providedHash)) {
      return NextResponse.json({ error: "That workspace admin key is not correct." }, { status: 401 });
    }
    if (body.verify === true) {
      return NextResponse.json(await getIntegrationStatus(request));
    }
    return NextResponse.json(await updateHostedIntegrations(request, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update integrations.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
