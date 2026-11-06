// UX-11: "Where it broke" still shows a gap that an old-style request hangs on. The request is inserted directly by the fixture
// (src/test/oldRequest.ts); nothing in the app can file one any more.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { NodeTree } from "@/lib/build";
import type { BuildBounty } from "@/lib/bounty";
import { OLD_REQUEST, insertOldRequest, type OldRow } from "@/test/oldRequest";

import { BreakageBody } from "./BreakageBody";
import { openGaps } from "./buildModel";

function seeded(status: "open" | "closed" | "solved") {
  const tables: Record<string, OldRow[]> = {};
  const { bounty, gapNode } = insertOldRequest(tables, { status });
  const tree = [{ ...gapNode, children: [] }] as unknown as NodeTree[];
  const byNode = new Map<string, BuildBounty>([[OLD_REQUEST.gapNodeId, { bounty, solutions: 0, meToo: false } as unknown as BuildBounty]]);
  return { tree, byNode };
}

describe("Where it broke, with an old request on a gap", () => {
  it("names the gap, what was asked and the reward while the request was open", () => {
    const { tree, byNode } = seeded("open");
    const gaps = openGaps(tree, byNode);
    expect(gaps).toEqual([expect.objectContaining({ id: OLD_REQUEST.gapNodeId, title: "The retry prompt", problem: OLD_REQUEST.title, reward: "£50", solvable: true })]);

    render(<BreakageBody breakage={{ rows: [], gaps }} />);
    const section = screen.getByRole("region", { name: "Where it broke" });
    expect(within(section).getByText("The retry prompt")).toBeTruthy();
    expect(within(section).getByText(OLD_REQUEST.title)).toBeTruthy();
    expect(within(section).getByText("£50")).toBeTruthy();
  });

  it("still shows the gap, with no reward and nothing to solve, once the request is closed", () => {
    const { tree, byNode } = seeded("closed");
    const gaps = openGaps(tree, byNode);
    expect(gaps).toEqual([expect.objectContaining({ title: "The retry prompt", reward: null, solvable: false })]);
    render(<BreakageBody breakage={{ rows: [], gaps }} />);
    expect(screen.getByText("The retry prompt")).toBeTruthy();
    expect(screen.queryByText("£50")).toBeNull();
  });
});
