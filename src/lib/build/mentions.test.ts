// SV-28 Part 2: agent mentions, resolved by role then title, stored as written.

import { describe, expect, it } from "vitest";

import { layoutArchitecture } from "./architectureMap";
import { buildSteps } from "./graph";
import { mentionRuns, mentionsOf } from "./mentions";
import type { NodeTree } from "./types";

const team = [
  { id: "a1", role: "Researcher", title: "Ada" },
  { id: "a2", role: "Writer", title: "Ben" },
  { id: "a3", role: "Reviewer", title: "Cleo" },
];

describe("mentionsOf", () => {
  it("resolves @Writer to the agent whose role is Writer, case-insensitively", () => {
    const text = "Draft it, then pass it to @writer.";
    const { mentions, unmatched } = mentionsOf(text, team);
    expect(mentions).toEqual([{ start: 26, end: 33, id: "a2" }]);
    expect(text.slice(26, 33)).toBe("@writer");
    expect(unmatched).toEqual([]);
  });

  it("resolves by role first, then by title, and a name only where a word ends", () => {
    expect(mentionsOf("Ask @Cleo", team).mentions[0].id).toBe("a3");
    const clash = [{ id: "x", role: "Ben" }, { id: "y", title: "Ben" }];
    expect(mentionsOf("@Ben", clash).mentions[0].id).toBe("x");
    expect(mentionsOf("@Researchers", team).mentions).toEqual([]);
    expect(mentionsOf("mail ada@example.com", team)).toEqual({ mentions: [], unmatched: [] });
  });

  it("two agents with the same title make an ambiguous mention, left plain and listed", () => {
    const twins = [{ id: "a", title: "Helper" }, { id: "b", title: "Helper" }];
    expect(mentionsOf("Ask @Helper now", twins)).toEqual({ mentions: [], unmatched: [{ start: 4, end: 11, text: "@Helper", ambiguous: true }] });
  });

  it("keeps the text unchanged, and draws it as runs", () => {
    const text = "Ask @Reviewer, then @Writer.";
    const runs = mentionRuns(text, mentionsOf(text, team).mentions);
    expect(runs.map((run) => run.text).join("")).toBe(text);
    expect(runs.filter((run) => run.id).map((run) => run.id)).toEqual(["a3", "a2"]);
  });

  it("a renamed role leaves the old mention listed as not matched", () => {
    const renamed = team.map((agent) => (agent.id === "a3" ? { ...agent, role: "Editor" } : agent));
    expect(mentionsOf("Send it to @Reviewer", renamed).unmatched).toEqual([{ start: 11, end: 20, text: "@Reviewer" }]);
  });
});

describe("mentions on the map", () => {
  const node = (id: string, position: number, type: string, payload: Record<string, unknown>, title: string | null = null, children: NodeTree[] = []): NodeTree => {
    const made = { id, build_id: "b", parent_id: null, position, type, title, payload, children } as unknown as NodeTree;
    for (const child of children) (child as unknown as { parent_id: string }).parent_id = id;
    return made;
  };
  it("draws a dotted line for a mention with no handoff rule, and the rule's line replaces it", () => {
    const tree = [
      node("t", 1, "team", {}, "T", [
        node("a1", 0, "agent_config", { role: "Writer", system_prompt: "Ask @Reviewer." }),
        node("a2", 1, "agent_config", { role: "Reviewer", system_prompt: "Tell @Writer.", handoffs: [{ to: "a1", when: "changes are needed" }] }),
      ]),
      node("m", 2, "memory", { provider: "mem0", keeps: "x", agent: "a1", tagged_by_agent: false, connects: [] }),
    ];
    const lines = layoutArchitecture(tree).lines.filter((line) => line.label === "mentions" || line.label === "hands off to");
    expect(lines.map((line) => [line.from, line.to, line.label, line.dotted ?? false])).toEqual([
      ["a1", "a2", "mentions", true],
      ["a2", "a1", "hands off to", false],
    ]);
    expect(buildSteps(tree)[0].children[0].text).toBe("Ask @Reviewer.");
  });
});
