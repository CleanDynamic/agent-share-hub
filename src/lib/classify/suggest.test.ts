import { describe, expect, it } from "vitest";

import { classificationLines } from "./lines";
import { emptyClassification } from "./facets";
import { suggestFor } from "./suggest";
import type { Classification } from "./types";

const ids = (facet: Parameters<typeof suggestFor>[0], texts: string[], chosen: Parameters<typeof suggestFor>[1]["chosen"] = [], derived?: Parameters<typeof suggestFor>[1]["derived"]) =>
  suggestFor(facet, { texts, chosen, derived }).map((value) => value.id);

describe("suggestFor", () => {
  it("matches the title, summary and prompts against labels and synonyms", () => {
    expect(ids("field", ["Hybrid search over our policy documents"])).toContain("ai-ml.retrieval.hybrid-search");
    expect(ids("field", ["An NLP pipeline"])).toContain("ai-ml.nlp");
    expect(ids("setting", ["Marking help for my dissertation"])).toEqual(expect.arrayContaining(["education.undergraduate-student", "education.postgraduate-student"]));
    expect(ids("stack", ["Built in Python with Stata exports"])).toEqual(expect.arrayContaining(["languages.python", "applications.stata"]));
  });

  it("suggests at most three, best first, and never what is chosen", () => {
    const text = ["Dentistry, nutrition, pharmacy, nursing and veterinary care"];
    expect(suggestFor("field", { texts: text, chosen: [] })).toHaveLength(3);
    const first = suggestFor("field", { texts: text, chosen: [] })[0];
    expect(ids("field", text, [{ id: first.id }])).not.toContain(first.id);
  });

  it("suggests from the derivation: an image result suggests the Task Images", () => {
    expect(ids("task", [], [], { built: { values: ["image-set"], from: [] } })).toContain("create.images");
    expect(ids("task", [], [{ id: "create.images", primary: true }], { built: { values: ["image-set"], from: [] } })).not.toContain("create.images");
  });

  it("suggests Data handled from the words people use, and nothing from empty text", () => {
    expect(ids("data", ["Summarises patient letters"])).toContain("health-data");
    expect(ids("data", ["A poem"])).toEqual([]);
    expect(ids("field", [""])).toEqual([]);
  });

  it("ignores words too common to mean anything alone", () => {
    expect(ids("field", ["data code app tool"])).toEqual([]);
  });
});

describe("classificationLines", () => {
  const make = (over: Partial<Classification> = {}, declared: Partial<Classification["declared"]> = {}): Classification => ({ ...emptyClassification(), ...over, declared: { ...emptyClassification().declared, ...declared } });

  it("gives nothing for a build with no classification", () => {
    expect(classificationLines(null)).toEqual({ line1: [], line2: [], regulated: false });
    expect(classificationLines(emptyClassification())).toEqual({ line1: [], line2: [], regulated: false });
  });

  it("builds line one from two tools, What was built, Role of AI and Skill needed", () => {
    const c = make({
      derived: {
        stack: { values: ["ai-applications.claude-code", "data-storage.supabase", "languages.python"], from: [] },
        built: { values: ["web-app", "dataset"], from: [] },
        role: { values: ["both"], from: [] },
        skill: { values: ["some-setup"], from: [] },
      },
    });
    expect(classificationLines(c).line1).toEqual(["Claude Code + Supabase", "Web app", "Both", "Some setup"]);
  });

  it("leaves out any value that is not set, and counts the maker's own stack entry", () => {
    const c = make({ derived: { skill: { values: ["no-coding"], from: [] } } }, { stack: [{ custom: "Acme" }] });
    expect(classificationLines(c).line1).toEqual(["Acme", "No coding"]);
  });

  it("shows a disputed value in place of the derived one", () => {
    const c = make({ derived: { skill: { values: ["some-setup"], from: [] } }, disputes: { skill: { values: ["no-coding"], reason: "x", at: "" } } });
    expect(classificationLines(c).line1).toEqual(["No coding"]);
  });

  it("builds line two from the Field, the primary Task and the first Setting", () => {
    const c = make({}, {
      field: [{ id: "ai-ml.retrieval.hybrid-search" }, { id: "law" }],
      task: [{ id: "find.literature-review" }, { id: "create.writing", primary: true }],
      setting: [{ custom: "A choir" }, { id: "personal.hobby" }],
    });
    expect(classificationLines(c).line2).toEqual(["Hybrid search", "Writing", "A choir"]);
  });

  it("carries the Regulated area flag", () => {
    expect(classificationLines(make({}, { field: [{ id: "law.contracts" }] })).regulated).toBe(true);
    expect(classificationLines(make({}, { data: [{ id: "health-data" }] })).regulated).toBe(true);
  });
});
