import type { CostTotals, NodeRun } from "@zeko/contracts";

export function calculateCostTotals(nodes: Pick<NodeRun, "nodeType" | "cost" | "consumption">[]): CostTotals {
  const agents = nodes.filter((node) => node.nodeType === "agent");
  const withCost = agents.filter((node) => node.cost !== undefined);
  const withConsumption = agents.flatMap((node) => node.consumption ? [node.consumption] : []);
  const amountUsd = withCost.length > 0 ? withCost.reduce((sum, node) => sum + (node.cost?.amountUsd ?? 0), 0) : undefined;
  const consumptionFields = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheCreationTokens"] as const;
  const consumption: CostTotals["consumption"] = {};
  for (const field of consumptionFields) {
    const values = withConsumption.flatMap((reading) => reading[field] === undefined ? [] : [reading[field] as number]);
    if (values.length > 0) consumption[field] = values.reduce((sum, value) => sum + value, 0);
  }
  return {
    ...(amountUsd === undefined ? {} : { amountUsd }),
    partial: withCost.length < agents.length,
    estimated: withCost.some((node) => node.cost?.basis !== "billed"),
    consumption,
  };
}
