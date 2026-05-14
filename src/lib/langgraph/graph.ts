import { StateGraph, START, END } from "@langchain/langgraph";
import { DramaGraphState } from "@/lib/langgraph/drama-state";
import {
  continuityCheckerNode,
  dispatchRenderQueueNode,
  scriptParserAgentNode,
} from "@/lib/langgraph/nodes";

let compiled: ReturnType<typeof buildShortDramaGraph> | null = null;

/**
 * LangGraph 节点顺序与 PROJECT_BRIEF § Agent Workflow 对齐：
 * ScriptParser →（可选）Continuity → 派发 BullMQ（逐镜 Storyboard 图 + Seedance 视频 + FFmpeg 集成片）
 */
export function buildShortDramaGraph() {
  return new StateGraph(DramaGraphState)
    .addNode("script_parser_agent", scriptParserAgentNode)
    .addNode("continuity_checker", continuityCheckerNode)
    .addNode("dispatch_render_queue", dispatchRenderQueueNode)
    .addEdge(START, "script_parser_agent")
    .addEdge("script_parser_agent", "continuity_checker")
    .addEdge("continuity_checker", "dispatch_render_queue")
    .addEdge("dispatch_render_queue", END)
    .compile();
}

export function getShortDramaGraph() {
  if (!compiled) compiled = buildShortDramaGraph();
  return compiled;
}
