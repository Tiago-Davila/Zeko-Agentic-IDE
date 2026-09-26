import { describe, expect, it } from "vitest";
import { calculateCostTotals } from "../../src/policy/cost-totals.js";

describe("run cost totals", () => {
  it("sums reported values and marks totals partial or estimated without imputing missing nodes", () => {
    expect(calculateCostTotals([
      { nodeType: "agent", cost: { amountUsd: 1.2, basis: "billed" }, consumption: { inputTokens: 10, outputTokens: 2 } },
      { nodeType: "agent", cost: { amountUsd: 0.3, basis: "list_price_estimate" } },
      { nodeType: "agent" },
      { nodeType: "input" },
    ])).toEqual({ amountUsd: 1.5, partial: true, estimated: true, consumption: { inputTokens: 10, outputTokens: 2 } });
  });
  it("does not report an amount when no agent reports cost", () => {
    expect(calculateCostTotals([{ nodeType: "agent" }])).toEqual({ partial: true, estimated: false, consumption: {} });
  });
});
