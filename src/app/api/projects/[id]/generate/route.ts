import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispatchPipeline } from "@/lib/queue/flows";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (project.status === "GENERATING") {
      return NextResponse.json({ error: "Already generating" }, { status: 409 });
    }

    await db.project.update({
      where: { id },
      data: {
        status: "GENERATING",
        pipelineStage: "PARSING",
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    await dispatchPipeline(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, id }, "[/api/generate] failed");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
