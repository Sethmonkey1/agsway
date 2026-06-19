import { NextResponse } from "next/server";
import { updateStoredOpportunity } from "@/lib/storage";
import type { OpportunityStatus } from "@/lib/types";

const validStatuses = new Set<OpportunityStatus>(["new", "saved", "replied", "dismissed"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = validStatuses.has(body.status) ? body.status as OpportunityStatus : undefined;
    const draft = typeof body.draft === "string" && body.draft.length <= 10000 ? body.draft : undefined;

    if (status === undefined && draft === undefined) {
      return NextResponse.json({ error: "No valid opportunity update was provided." }, { status: 400 });
    }

    const saved = await updateStoredOpportunity(id, { status, draft });
    return NextResponse.json({ saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update opportunity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
