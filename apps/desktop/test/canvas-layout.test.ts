import { describe, expect, it } from "vitest";
import { COLUMN_WIDTH, ORIGIN_X, ORIGIN_Y, ROW_HEIGHT, layoutColumns, layoutPositions } from "../src/renderer/canvas/layout.js";

describe("canvas layout", () => {
  it("places each node one column after its deepest predecessor", () => {
    const columns = layoutColumns(["input", "a", "b", "gate", "c"], [
      { from: "input", to: "a" },
      { from: "input", to: "b" },
      { from: "a", to: "gate" },
      { from: "gate", to: "c" },
      { from: "b", to: "c" },
    ]);
    expect(Object.fromEntries(columns)).toEqual({ input: 0, a: 1, b: 1, gate: 2, c: 3 });
  });

  it("terminates on a cycle and ignores edges to unknown nodes", () => {
    const columns = layoutColumns(["a", "b"], [{ from: "a", to: "b" }, { from: "b", to: "a" }, { from: "ghost", to: "a" }]);
    expect(columns.size).toBe(2);
  });

  it("stacks nodes of the same column in input order", () => {
    expect(layoutPositions([{ id: "a", column: 0 }, { id: "b", column: 1 }, { id: "c", column: 1 }])).toEqual({
      a: { x: ORIGIN_X, y: ORIGIN_Y },
      b: { x: ORIGIN_X + COLUMN_WIDTH, y: ORIGIN_Y },
      c: { x: ORIGIN_X + COLUMN_WIDTH, y: ORIGIN_Y + ROW_HEIGHT },
    });
  });
});
