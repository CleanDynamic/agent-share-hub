import { describe, expect, it, vi } from "vitest";

import type { TrackOptions } from "./useBuildHistory";
import { MotionChannel } from "./listMotion";
import { sendUnsentTile } from "./sendUnsentTile";

describe("UX-01 P1: Add as step tile", () => {
  it("labels the motion `add` with the new tile's id before the write starts, and writes with that id", async () => {
    const channel = new MotionChannel();
    const order: string[] = [];
    // The same thing useBuildHistory.track does first: it says what is coming.
    const track = async <T,>(_sentence: string, task: () => Promise<T>, options?: TrackOptions): Promise<T> => {
      channel.expect({ kind: options?.motion ?? "change", keys: options?.keys ?? [] });
      order.push("expect");
      return task();
    };
    const write = vi.fn(async (id: string) => {
      order.push(`write:${id}`);
      return true;
    });
    const saved = await sendUnsentTile({ track, sentence: "Added a prompt", write, newId: () => "tile-9" });
    expect(saved).toBe(true);
    expect(channel.waiting()).toEqual({ kind: "add", keys: ["tile-9"] });
    expect(order).toEqual(["expect", "write:tile-9"]);
  });
});
