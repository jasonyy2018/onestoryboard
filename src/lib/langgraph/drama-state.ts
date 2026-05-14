import { Annotation } from "@langchain/langgraph";

/**
 * Minimal orchestration state: BullMQ workers still own long-running I2V jobs.
 * LangGraph expresses the **documented agent order** and synchronous boundaries.
 */
export const DramaGraphState = Annotation.Root({
  projectId: Annotation<string>,
  /** Optional stub output from ContinuityCheckerAgent */
  continuityNotes: Annotation<string | undefined>,
});
