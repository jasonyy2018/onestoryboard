import { db } from "@/lib/db";
import { pipelineSnapshotSignature } from "@/lib/pipeline/pipeline-snapshot-signature";
import { events, type QueueName } from "@/lib/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of pipeline + per-shot updates.
 *
 * Client usage:
 *   const es = new EventSource(`/api/projects/${id}/events`);
 *   es.onmessage = (e) => console.log(JSON.parse(e.data));
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch (err) {
          // Controller might be closed, cleanup
          cleanup();
        }
      };

      // 1) initial snapshot
      const snapshot = await db.project.findUnique({
        where: { id: projectId },
        include: {
          scenes: {
            orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
            include: { shots: { orderBy: { order: "asc" } } },
          },
        },
      });
      let lastSnapshotSig = pipelineSnapshotSignature(snapshot);
      send("snapshot", snapshot);

      // 2) live BullMQ events (queues actually registered in queues.ts).
      const queueNames = Object.keys(events) as QueueName[];
      const handlers = queueNames.map((qn) => {
        const q = events[qn];
        const onProgress = ({ jobId, data }: { jobId: string; data: unknown }) => {
          send("progress", { queue: qn, jobId, data });
        };
        const onCompleted = ({ jobId }: { jobId: string }) => {
          send("completed", { queue: qn, jobId });
        };
        const onFailed = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
          send("failed", { queue: qn, jobId, failedReason });
        };
        q.on("progress", onProgress);
        q.on("completed", onCompleted);
        q.on("failed", onFailed);
        return { q, onProgress, onCompleted, onFailed };
      });

      // 3) periodic DB poll — only push snapshot when pipeline / shots actually changed
      const interval = setInterval(async () => {
        const fresh = await db.project.findUnique({
          where: { id: projectId },
          include: {
            scenes: {
              orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
              include: { shots: { orderBy: { order: "asc" } } },
            },
          },
        });
        const sig = pipelineSnapshotSignature(fresh);
        if (sig !== lastSnapshotSig) {
          lastSnapshotSig = sig;
          send("snapshot", fresh);
        }
        if (fresh?.status === "COMPLETED" || fresh?.status === "FAILED") {
          send("done", { status: fresh.status });
          cleanup();
          controller.close();
        }
      }, 3000);

      function cleanup() {
        clearInterval(interval);
        for (const h of handlers) {
          h.q.off("progress", h.onProgress);
          h.q.off("completed", h.onCompleted);
          h.q.off("failed", h.onFailed);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
