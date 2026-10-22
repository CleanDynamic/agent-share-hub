import { describe, expect, it } from "vitest";

import { computeFacets, customEntriesOf, emptyClassification, hasClassification, readClassification, regulatedArea, shapeFromBuilt, shownValues } from "./facets";
import type { Classification } from "./types";

const classification = (over: Partial<Classification> = {}, declared: Partial<Classification["declared"]> = {}): Classification => ({
  ...emptyClassification(),
  ...over,
  declared: { ...emptyClassification().declared, ...declared },
});

describe("computeFacets", () => {
  it("is empty for an empty classification", () => {
    expect(computeFacets(emptyClassification())).toEqual([]);
  });

  it("writes `<facet>:<id>` and adds every ancestor of a Field value", () => {
    const facets = computeFacets(classification({}, { field: [{ id: "ai-ml.retrieval.hybrid-search" }] }));
    expect(facets).toEqual(["field:ai-ml", "field:ai-ml.retrieval", "field:ai-ml.retrieval.hybrid-search"]);
  });

  it("covers the declared facets, and a Task, Setting or tool brings its group", () => {
    const facets = computeFacets(
      classification({}, {
        task: [{ id: "analyse.text-analysis-nlp", primary: true }],
        setting: [{ id: "education.lecturer" }],
        data: [{ id: "health-data" }],
        age: "18-and-over",
        stack: [{ id: "applications.stata" }],
      }),
    );
    expect(facets).toEqual(["age:18-and-over", "data:health-data", "setting:education", "setting:education.lecturer", "stack:applications", "stack:applications.stata", "task:analyse", "task:analyse.text-analysis-nlp"]);
  });

  it("counts a group once: two Tasks in one group give one group entry", () => {
    const facets = computeFacets(classification({}, { task: [{ id: "create.writing", primary: true }, { id: "create.code" }] }));
    expect(facets.filter((facet) => facet === "task:create")).toHaveLength(1);
  });

  it("never puts a custom entry or an unknown id in facets", () => {
    const facets = computeFacets(classification({}, { field: [{ custom: "Bee keeping" }, { id: "nope" }], task: [{ custom: "Sorting socks", primary: true }] }));
    expect(facets).toEqual([]);
  });

  it("adds derived values, and a dispute replaces the derived one", () => {
    const c = classification({
      derived: { skill: { values: ["some-setup"], from: ["n1"] }, built: { values: ["web-app"], from: [] }, stack: { values: ["languages.python", "custom:Acme"], from: [] } },
      disputes: { skill: { values: ["no-coding"], reason: "A friend did it", at: "2026-10-22T10:00:00Z" } },
    });
    const facets = computeFacets(c);
    expect(facets).toContain("skill:no-coding");
    expect(facets).not.toContain("skill:some-setup");
    expect(facets).toContain("built:web-app");
    expect(facets).toContain("stack:languages.python");
    expect(facets.some((f) => f.includes("Acme"))).toBe(false);
  });

  it("does not repeat a value", () => {
    const facets = computeFacets(classification({}, { field: [{ id: "ai-ml.retrieval.hybrid-search" }, { id: "ai-ml.retrieval.reranking" }] }));
    expect(facets.filter((f) => f === "field:ai-ml")).toHaveLength(1);
  });
});

describe("shownValues", () => {
  it("shows a disputed value as stated by the maker, a derived one as derived, nothing as none", () => {
    const c = classification({ derived: { skill: { values: ["some-setup"], from: [] } }, disputes: { cost: { values: ["free-plans-are-enough"], reason: "Confirmed free", at: "" } } });
    expect(shownValues(c, "skill")).toEqual({ values: ["some-setup"], provenance: "derived" });
    expect(shownValues(c, "cost")).toEqual({ values: ["free-plans-are-enough"], provenance: "stated" });
    expect(shownValues(c, "oversight")).toEqual({ values: [], provenance: "none" });
  });
});

describe("regulatedArea", () => {
  it("is true for a Field under Medicine and health, Law, Finance and investing or Quantitative finance", () => {
    for (const id of ["medicine.dentistry", "law.contracts", "finance.tax", "quant-finance.backtesting"]) expect(regulatedArea(classification({}, { field: [{ id }] })), id).toBe(true);
  });

  it("is true for Health data, Student or child data or Financial data", () => {
    for (const id of ["health-data", "student-or-child-data", "financial-data"]) expect(regulatedArea(classification({}, { data: [{ id }] })), id).toBe(true);
  });

  it("is false otherwise, including other Fields and other data", () => {
    expect(regulatedArea(classification({}, { field: [{ id: "ai-ml.retrieval" }, { custom: "Law" }], data: [{ id: "personal-data" }] }))).toBe(false);
    expect(regulatedArea(emptyClassification())).toBe(false);
  });
});

describe("shapeFromBuilt", () => {
  it("maps What was built to the old shape", () => {
    const cases: [string, string][] = [
      ["web-app", "app"], ["mobile-app", "app"], ["game", "app"],
      ["autonomous-agent", "agent"], ["multi-agent-system", "agent"],
      ["automation-workflow", "workflow"], ["prompt-library", "prompt"], ["dataset", "dataset"],
      ["image-set", "media"], ["video", "media"], ["audio", "media"],
    ];
    for (const [built, shape] of cases) expect(shapeFromBuilt([built]), built).toBe(shape);
  });

  it("leaves shape alone for anything else", () => {
    expect(shapeFromBuilt(["document-or-report"])).toBeNull();
    expect(shapeFromBuilt([])).toBeNull();
  });
});

describe("readClassification", () => {
  it("reads anything that is not a classification as an empty one", () => {
    for (const raw of [null, undefined, "x", 4, [], {}]) expect(readClassification(raw)).toEqual(emptyClassification());
  });

  it("reads a stored one and drops what is malformed", () => {
    const read = readClassification({
      version: 1,
      declared: { field: [{ id: "law" }, { custom: " Bees " }, { nope: 1 }, "x"], task: [{ id: "create.writing", primary: true }], age: "13-and-over", setting: null },
      derived: { skill: { values: ["no-coding"], from: ["n1", 4] } },
      disputes: { cost: { values: ["cost-not-stated"], reason: "Because", at: "2026-10-22" } },
      questions_dismissed: ["a", 3],
    });
    expect(read.declared.field).toEqual([{ id: "law" }, { custom: "Bees" }]);
    expect(read.declared.task).toEqual([{ id: "create.writing", primary: true }]);
    expect(read.declared.age).toBe("13-and-over");
    expect(read.derived.skill).toEqual({ values: ["no-coding"], from: ["n1"] });
    expect(read.disputes.cost?.reason).toBe("Because");
    expect(read.questions_dismissed).toEqual(["a"]);
  });

  it("knows when a classification says anything", () => {
    expect(hasClassification(emptyClassification())).toBe(false);
    expect(hasClassification(classification({}, { age: "all-ages" }))).toBe(true);
    expect(hasClassification(classification({ derived: { skill: { values: ["no-coding"], from: [] } } }))).toBe(true);
  });
});

describe("customEntriesOf", () => {
  it("lists the maker's own entries and custom derived stack names", () => {
    const c = classification({ derived: { stack: { values: ["custom:Acme", "languages.python"], from: [] } } }, { field: [{ custom: "Bee keeping" }], task: [{ id: "create.writing", primary: true }] });
    expect(customEntriesOf(c)).toEqual([
      { facet: "field", text: "Bee keeping" },
      { facet: "stack", text: "Acme" },
    ]);
  });
});
