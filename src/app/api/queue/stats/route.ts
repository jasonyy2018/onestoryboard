import { NextResponse } from "next/server";
import { queues } from "@/lib/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [shotActive, shotWaiting, parseActive, composeActive] = await Promise.all([
      queues.shot.getActiveCount(),
      queues.shot.getWaitingCount(),
      queues.parse.getActiveCount(),
      queues.compose.getActiveCount(),
    ]);

    const active = shotActive + parseActive + composeActive;
    const waiting = shotWaiting;
    const total = active + waiting;

    return NextResponse.json({ active, waiting, total });
  } catch {
    return NextResponse.json({ active: 0, waiting: 0, total: 0 });
  }
}
