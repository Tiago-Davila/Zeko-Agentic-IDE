import { describe, expect, it } from "vitest";
import { resolveNodeResult } from "../../src/result/resolve-node-result.js";
import { baseInput } from "./helpers.js";

describe("rule 4b: writes outside configured scope", () => {
  it.each([
    { reportsDenials: true, supportsTurnLimit: true },
    { reportsDenials: false, supportsTurnLimit: false },
  ])("blocks observed out of scope writes with capabilities $reportsDenials/$supportsTurnLimit", (capabilities) => {
    expect(resolveNodeResult(baseInput({ capabilities, observedFiles: [{ path: "docs/private.md" }], writeScope: ["src/**"] }))).toMatchObject({ status: "blocked", reason: { code: "WRITE_OUTSIDE_SCOPE", params: { files: ["docs/private.md"] } } });
  });
});
