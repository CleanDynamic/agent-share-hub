// UI-P75 — a fork keeps what a step uses. `rewritePayload` replaces any string that is a copied node's id,
// so `uses[].node_id` points at the copies; proved here for a prompt, an agent and a manual step.
// `dismissed` keys ("file:{id}") are not ids, so they are NOT rewritten: a fork may offer a suggestion the
// maker dismissed once more. Reported, and deliberately left as it is.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { rewritePayload } from "./fork";
import type { Json } from "@/integrations/supabase/types";

const idMap = new Map([
  ["p1", "p1-copy"],
  ["f1", "f1-copy"],
  ["t1", "t1-copy"],
  ["a1", "a1-copy"],
]);

describe("rewritePayload keeps uses pointing at the copies", () => {
  it("a prompt", () => {
    const out = rewritePayload({ text: "Build it.", uses: [{ kind: "output", node_id: "p1" }, { kind: "file", node_id: "f1" }] } as Json, undefined, idMap) as { uses: { node_id: string }[]; text: string };
    expect(out.uses.map((use) => use.node_id)).toEqual(["p1-copy", "f1-copy"]);
    expect(out.text).toBe("Build it.");
  });

  it("an agent, with its model and runs untouched", () => {
    const payload = { system_prompt: "Check.", model: "claude-haiku-5-5", runs: { how: "until", detail: "done" }, uses: [{ kind: "output", node_id: "a1" }, { kind: "tool", node_id: "t1" }] } as Json;
    const out = rewritePayload(payload, undefined, idMap) as { uses: { node_id: string }[]; model: string; runs: unknown };
    expect(out.uses.map((use) => use.node_id)).toEqual(["a1-copy", "t1-copy"]);
    expect(out.model).toBe("claude-haiku-5-5");
    expect(out.runs).toEqual({ how: "until", detail: "done" });
  });

  it("a manual step", () => {
    const out = rewritePayload({ tool: "Figma", text: "Draw the logo", uses: [{ kind: "output", node_id: "p1" }] } as Json, undefined, idMap) as { uses: { node_id: string }[]; tool: string };
    expect(out.uses[0].node_id).toBe("p1-copy");
    expect(out.tool).toBe("Figma");
  });

  it("leaves a use of a node that was not copied, and a dismissed key, exactly as they were", () => {
    const out = rewritePayload({ uses: [{ kind: "file", node_id: "gone" }], dismissed: ["file:f1"] } as Json, undefined, idMap) as { uses: { node_id: string }[]; dismissed: string[] };
    expect(out.uses[0].node_id).toBe("gone");
    expect(out.dismissed).toEqual(["file:f1"]);
  });
});
