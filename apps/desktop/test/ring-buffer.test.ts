import { describe, expect, it } from "vitest";
import { RingBuffer } from "../src/renderer/run/ring-buffer.js";

describe("renderer output ring buffer", () => {
  it("retains only the newest events up to its capacity", () => {
    const buffer = new RingBuffer<number>(3);
    expect(buffer.push(1)).toBeUndefined();
    buffer.push(2); buffer.push(3);
    expect(buffer.push(4)).toBe(1);
    expect(buffer.snapshot()).toEqual([2, 3, 4]);
    expect(buffer.length).toBe(3);
  });

  it("rejects invalid capacities", () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
  });
});
