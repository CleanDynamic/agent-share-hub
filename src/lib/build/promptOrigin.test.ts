// SV-30 P3: prompt origin and kind.

import { describe, expect, it } from "vitest";

import { copyTogether } from "./copyTogether";
import { asksForOf, originLine, originNote, originOf } from "./promptOrigin";
import { cleanExtras } from "./tileExtras";
import type { Step } from "./graph";

describe("SV-30 P3: where a prompt came from", () => {
  it("saves each origin through the prompt's cleaners and shows it", () => {
    expect(cleanExtras("prompt", { sent_by: "schedule" })).toEqual({ sent_by: "schedule" });
    expect(cleanExtras("prompt", { sent_by: "agent_wakeup" })).toEqual({ sent_by: "agent_wakeup" });
    expect(cleanExtras("prompt", { sent_by: "heartbeat", interval: " daily 09:00 " })).toEqual({ sent_by: "heartbeat", interval: "daily 09:00" });
    expect(cleanExtras("prompt", { sent_by: "event", event: "a deploy finished" })).toEqual({ sent_by: "event", event: "a deploy finished" });
    expect(originLine(originOf({ sent_by: "agent_wakeup" })!)).toBe("Wake-up set by the agent");
    expect(originLine(originOf({ sent_by: "heartbeat", interval: "daily 09:00" })!)).toBe("Heartbeat · daily 09:00");
    expect(originLine(originOf({ sent_by: "event", event: "a deploy finished" })!)).toBe("Triggered by a deploy finished");
  });
  it("does not store the maker as the origin, and reads an old prompt as typed by the maker", () => {
    expect(cleanExtras("prompt", { sent_by: "maker" })).toEqual({ sent_by: null });
    expect(originOf({ text: "hello" })).toBeNull();
    expect(originOf({ sent_by: "maker" })).toBeNull();
    expect(originOf({ sent_by: "nonsense" })).toBeNull();
  });
  it("refuses an interval over 20 characters and an event over 80", () => {
    expect(() => cleanExtras("prompt", { interval: "x".repeat(21) })).toThrow("Interval: 20 characters max");
    expect(() => cleanExtras("prompt", { event: "x".repeat(81) })).toThrow("Event: 80 characters max");
  });
  it("keeps asks_for to the maker's two values and never infers it", () => {
    expect(cleanExtras("prompt", { asks_for: "outcome" })).toEqual({ asks_for: "outcome" });
    expect(cleanExtras("prompt", { asks_for: "steps" })).toEqual({ asks_for: null });
    expect(asksForOf({ text: "Do step 1, then step 2, then step 3" })).toBeNull();
    expect(asksForOf({ asks_for: "procedure" })).toBe("procedure");
  });
  it("says the origin when copied together, and nothing for the maker's own", () => {
    const step = (origin: Parameters<typeof originNote>[0]) => ({ kind: "prompt", text: "Check the queue", changes: [], sentWith: [], origin } as unknown as Step);
    expect(copyTogether(step(originOf({ sent_by: "heartbeat", interval: "daily 09:00" })))).toBe("Check the queue (sent daily at 09:00)");
    expect(copyTogether(step(null))).toBe("Check the queue");
    expect(originNote(originOf({ sent_by: "agent_wakeup" }))).toBe("(a wake-up the agent set for itself)");
  });
});
