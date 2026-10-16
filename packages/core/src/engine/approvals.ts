import type { FlowFile, NodeRun, PredecessorResult } from "@zeko/contracts";
import { buildPredecessorResults } from "../prompt/predecessor-results.js";

export interface ApprovalRequest { nodeId: string; summary: PredecessorResult[] }

export function createApprovalRequest(flow: FlowFile, nodeId: string, nodeRuns: Map<string, NodeRun>): ApprovalRequest {
  return { nodeId, summary: buildPredecessorResults(flow, nodeId, nodeRuns) };
}
