import { logger } from "@/lib/logger";
import { runParseAndStoryboard } from "@/lib/orchestrator/director";
import { fanoutAssetsAndCompose } from "@/lib/queue/flows";
import { DramaGraphState } from "@/lib/langgraph/drama-state";

type State = typeof DramaGraphState.State;

/** ScriptParserAgent + StoryboardAgent + MRI 资产阶段（与 director.runParseAndStoryboard 对齐） */
export async function scriptParserAgentNode(state: State): Promise<Partial<State>> {
  await runParseAndStoryboard(state.projectId);
  return {};
}

/** 可选：角色/场景一致性抽检占位；后续可接多模态或 LLM 对照 */
export async function continuityCheckerNode(state: State): Promise<Partial<State>> {
  const note =
    "continuity_checker_stub: skipped (hook for cast/scene validation vs prior segment).";
  logger.info({ projectId: state.projectId }, `[langgraph] ${note}`);
  return { continuityNotes: note };
}

/** VideoGeneratorAgent + ComposerAgent：由 BullMQ shot/compose 队列异步执行 */
export async function dispatchRenderQueueNode(state: State): Promise<Partial<State>> {
  await fanoutAssetsAndCompose(state.projectId);
  return {};
}
