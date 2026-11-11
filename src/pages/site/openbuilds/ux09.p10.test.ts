// UX-09 Part 10: the OpenBuilds pages' titles and descriptions, and no em dash in any; the old OpenBuilds board is archived, so the
// design comparison no longer reads it.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { OPENBUILDS_SEO, spaceSeo, topicSeo } from "./openBuildsSeo";

const EM_DASH = String.fromCharCode(0x2014);

describe("UX-09 P10: titles", () => {
  it("/openbuilds is the name alone, with the new description", () => {
    expect(OPENBUILDS_SEO).toEqual({ title: "OpenBuilds", description: "Start a topic with anything, reply with anything. Spaces are made and run by the people in them." });
  });

  it("a space: <name> · OpenBuilds, with its description", () => {
    expect(spaceSeo({ name: "Claude Code", description: "Work made with Claude Code" })).toEqual({ title: "Claude Code · OpenBuilds.ai", description: "Work made with Claude Code" });
  });

  it("a topic: <heading> · OpenBuilds, with the first 150 characters of its text", () => {
    const text = "x".repeat(200);
    const seo = topicSeo({ body: `Can anyone make the scorer faster?\n${text}` });
    expect(seo.title).toBe("Can anyone make the scorer faster? · OpenBuilds.ai");
    expect(seo.description).toBe("x".repeat(150));
    // No text: the heading stands in.
    expect(topicSeo({ body: "Just a heading" }).description).toBe("Just a heading");
  });

  it("has no em dash in any", () => {
    const all = [OPENBUILDS_SEO, spaceSeo(null), spaceSeo({ name: "A", description: "" }), topicSeo(null), topicSeo({ body: "H\nT" })];
    for (const seo of all) expect(`${seo.title} ${seo.description}`).not.toContain(EM_DASH);
  });
});

describe("UX-09 P10: the old OpenBuilds board", () => {
  it("is archived beside the boards, and the compared index no longer lists it", () => {
    const compared = JSON.parse(readFileSync("design/reference/vision/index.json", "utf8")) as { page: string }[];
    expect(compared.map((board) => board.page)).not.toContain("openbuilds");
    expect(existsSync("design/reference/vision/dusk/openbuilds.html")).toBe(false);
    const archived = JSON.parse(readFileSync("design/reference/vision/archive/index.json", "utf8")) as { page: string; file: string }[];
    expect(archived).toEqual(expect.arrayContaining([expect.objectContaining({ page: "openbuilds", file: "reference/vision/archive/openbuilds.html" })]));
    expect(existsSync("design/reference/vision/archive/openbuilds.html")).toBe(true);
  });
});
