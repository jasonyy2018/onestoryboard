import { logger } from "@/lib/logger";
import { getShortDramaGraph } from "@/lib/langgraph/graph";

export { DramaGraphState } from "@/lib/langgraph/drama-state";
export { getShortDramaGraph, buildShortDramaGraph } from "@/lib/langgraph/graph";

/**
 * 与 parse.worker 等价的主线编排入口，但以 LangGraph 显式表达 Agent 拓扑。
 * 解析 + 分镜表写入 DB 后，派发 shot → compose 的 BullMQ 流。
 */
export async function invokeShortDramaPipeline(projectId: string): Promise<void> {
  const graph = getShortDramaGraph();
  await graph.invoke(
    { projectId, continuityNotes: undefined },
    { configurable: { thread_id: `drama-${projectId}` } },
  );
  logger.info({ projectId }, "[langgraph] invokeShortDramaPipeline complete");
}
