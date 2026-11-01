// SV-29 P6: the pipeline row on the architecture map.

import { describe, expect, it } from "vitest";

import { productCategoriesTree } from "@/dev/fixtures/pipeline/product-categories";
import { supportBotEvalsTree } from "@/dev/fixtures/pipeline/support-bot-evals";

import { hasPipeline, layoutArchitecture, pipelineOf } from "./architectureMap";

describe("the pipeline row", () => {
  it("draws Retrieval to Decision as top 30 candidates, with the Code tile first and the Check last", () => {
    const map = layoutArchitecture(productCategoriesTree);
    const row = map.boxes.filter((box) => box.column === 6);
    expect(row.map((box) => box.id)).toEqual(["pc-c1", "pc-r1", "pc-d1", "pc-k1"]);
    expect(map.lines.find((line) => line.from === "pc-r1" && line.to === "pc-d1" && line.label === "top 30 candidates")).toBeTruthy();
    expect(row.every((box, at) => at === 0 || box.x > row[at - 1].x)).toBe(true);
    expect(new Set(row.map((box) => box.y)).size).toBe(1);
  });

  it("draws a Check's tiles as a dotted measured by line", () => {
    const map = layoutArchitecture(productCategoriesTree);
    const lines = map.lines.filter((line) => line.label === "measured by");
    expect(lines.map((line) => line.from).sort()).toEqual(["pc-d1", "pc-r1"]);
    expect(lines.every((line) => line.dotted === true && line.to === "pc-k1")).toBe(true);
  });

  it("is drawn when the build has no agent", () => {
    expect(productCategoriesTree.some((node) => node.type === "agent_config")).toBe(false);
    expect(hasPipeline(productCategoriesTree)).toBe(true);
    expect(layoutArchitecture(productCategoriesTree).boxes.length).toBeGreaterThan(0);
  });

  it("falls back to List order when there are no Uses links", () => {
    const bare = productCategoriesTree.map((node) => ({ ...node, payload: { ...(node.payload as Record<string, unknown>), uses: undefined } }));
    expect(pipelineOf(bare as never).steps.map((step) => step.id)).toEqual(["pc-c1", "pc-r1", "pc-d1"]);
  });

  it("follows the Uses links when they disagree with the List", () => {
    const swapped = [productCategoriesTree[0], { ...productCategoriesTree[2], position: 1 }, { ...productCategoriesTree[1], position: 2 }, productCategoriesTree[3]];
    expect(pipelineOf(swapped as never).steps.map((step) => step.id)).toEqual(["pc-c1", "pc-r1", "pc-d1"]);
  });

  it("puts the row under the agent boxes in a build that has an agent", () => {
    const map = layoutArchitecture(supportBotEvalsTree);
    const agent = map.boxes.find((box) => box.kind === "agent");
    const retrieval = map.boxes.find((box) => box.id === "sb-r1");
    expect(agent && retrieval && retrieval.y > agent.y + agent.h).toBe(true);
  });

  it("stacks the row top to bottom on a phone", () => {
    const row = layoutArchitecture(productCategoriesTree, "vertical").boxes.filter((box) => box.column === 6);
    expect(row.every((box, at) => at === 0 || box.y > row[at - 1].y)).toBe(true);
    expect(new Set(row.map((box) => box.x)).size).toBe(1);
  });
});
