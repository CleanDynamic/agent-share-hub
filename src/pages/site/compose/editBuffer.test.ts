import { describe, expect, it, vi } from "vitest";

import { WriteBuffer } from "./editBuffer";

describe("WriteBuffer (CA-18 P2)", () => {
  it("runs nothing until it is flushed, in the order first queued", () => {
    const buffer = new WriteBuffer();
    const calls: string[] = [];
    buffer.set("a", () => calls.push("a"));
    buffer.set("b", () => calls.push("b"));
    expect(calls).toEqual([]);
    expect(buffer.size).toBe(2);
    expect(buffer.flush()).toBe(2);
    expect(calls).toEqual(["a", "b"]);
    expect(buffer.size).toBe(0);
  });

  it("runs a write queued twice once, with the last value, in its first place", () => {
    const buffer = new WriteBuffer();
    const calls: string[] = [];
    buffer.set("a", () => calls.push("a1"));
    buffer.set("b", () => calls.push("b"));
    buffer.set("a", () => calls.push("a2"));
    buffer.flush();
    expect(calls).toEqual(["a2", "b"]);
  });

  it("writes nothing once cleared", () => {
    const buffer = new WriteBuffer();
    const run = vi.fn();
    buffer.set("a", run);
    buffer.set("p", run);
    buffer.clear();
    expect(buffer.flush()).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });
});
