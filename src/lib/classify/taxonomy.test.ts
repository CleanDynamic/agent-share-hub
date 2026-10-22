import { describe, expect, it } from "vitest";

import { TOOLS } from "@/lib/tools/registry";

import {
  FACETS,
  FIELD_VALUES,
  TAXONOMY,
  TAXONOMY_VERSION,
  STACK_VALUES,
  ancestorsOf,
  findAcross,
  findValues,
  isKnown,
  isTechnicalField,
  pathOf,
  valueByLabel,
  valueOf,
} from "./taxonomy";

describe("taxonomy: shape", () => {
  it("has a version", () => {
    expect(TAXONOMY_VERSION).toBe(1);
  });

  it("gives every id once per facet, in lowercase dotted slugs", () => {
    for (const facet of FACETS) {
      const ids = TAXONOMY[facet].map((value) => value.id);
      expect(new Set(ids).size, `${facet} ids are unique`).toBe(ids.length);
      for (const id of ids) expect(id, `${facet}:${id}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/);
    }
  });

  it("keeps a dash out of every label and synonym, and each parent real", () => {
    for (const facet of FACETS) {
      for (const value of TAXONOMY[facet]) {
        expect(value.label.includes("—"), value.label).toBe(false);
        expect(value.label.includes("!"), value.label).toBe(false);
        for (const synonym of value.synonyms) expect(synonym.includes("—")).toBe(false);
        if (value.parent !== null) expect(isKnown(facet, value.parent), `${facet}:${value.id} parent`).toBe(true);
      }
    }
  });

  it("gives every value at most five synonyms, none repeating its label", () => {
    for (const facet of FACETS) {
      for (const value of TAXONOMY[facet]) {
        expect(value.synonyms.length, value.label).toBeLessThanOrEqual(5);
        expect(value.synonyms.map((s) => s.toLowerCase()), value.label).not.toContain(value.label.toLowerCase());
      }
    }
  });

  it("gives most values a synonym", () => {
    const all = FACETS.flatMap((facet) => TAXONOMY[facet]);
    const withSynonyms = all.filter((value) => value.synonyms.length > 0).length;
    expect(withSynonyms / all.length).toBeGreaterThan(0.9);
  });

  it("has no node with more than 12 children (Tools and stack groups take every tool the registry names, so they are left out)", () => {
    for (const facet of FACETS.filter((f) => f !== "stack")) {
      const counts = new Map<string, number>();
      for (const value of TAXONOMY[facet]) if (value.parent) counts.set(value.parent, (counts.get(value.parent) ?? 0) + 1);
      for (const [parent, count] of counts) expect(count, `${facet}:${parent}`).toBeLessThanOrEqual(12);
    }
  });

  it("holds the depth limits: general Area, Field, Specialism; technical Domain to a fourth level", () => {
    for (const value of FIELD_VALUES) {
      if (value.branch === "general") expect(value.depth).toBeLessThanOrEqual(2);
      else expect(value.depth).toBeLessThanOrEqual(3);
    }
    for (const facet of ["task", "setting", "stack"] as const) for (const value of TAXONOMY[facet]) expect(value.depth).toBeLessThanOrEqual(1);
    for (const facet of FACETS.filter((f) => !["field", "task", "setting", "stack"].includes(f))) for (const value of TAXONOMY[facet]) expect(value.depth).toBe(0);
  });
});

describe("taxonomy: the lists", () => {
  it("has the seeded specialisms", () => {
    expect(pathOf("medicine.medical-research.clinical-text-mining")).toBe("Medicine and health › Medical research › Clinical text mining");
    for (const id of ["finance.trading-and-investing.algorithmic-trading", "social.sociology.quantitative-methods", "education.secondary-teaching.assessment", "education.primary-teaching.lesson-planning"]) {
      expect(isKnown("field", id), id).toBe(true);
    }
  });

  it("names the technical branch as the prompt does", () => {
    expect(pathOf("ai-ml.retrieval.hybrid-search")).toBe("AI and machine learning › Retrieval systems › Hybrid search");
    expect(valueOf("field", "ai-ml")?.branch).toBe("technical");
    expect(isTechnicalField("ai-ml.retrieval")).toBe(true);
    expect(isTechnicalField("medicine.dentistry")).toBe(false);
    const subdomains = FIELD_VALUES.filter((value) => value.parent === "ai-ml");
    expect(subdomains).toHaveLength(12);
  });

  it("lets a subdomain with no niches be chosen as it is", () => {
    expect(valueOf("field", "security.identity-and-access")?.selectable).toBe(true);
    expect(FIELD_VALUES.some((value) => value.parent === "security.identity-and-access")).toBe(false);
  });

  it("keeps product names out of Field", () => {
    const names = ["chatgpt", "claude", "pytorch", "react", "stata"];
    for (const value of FIELD_VALUES) expect(names.includes(value.label.toLowerCase()), value.label).toBe(false);
  });

  it("makes Mathematics and data an entry point to the three technical domains", () => {
    const hits = findValues("field", "maths").map((value) => value.id);
    expect(hits[0]).toBe("maths-data");
    expect(hits).toEqual(expect.arrayContaining(["data", "sci-computing", "formal"]));
  });

  it("makes Engineering and technology an entry point to the whole technical branch", () => {
    const hits = findValues("field", "engineering and technology").map((value) => value.id);
    expect(hits[0]).toBe("engineering");
    expect(hits).toEqual(expect.arrayContaining(["ai-ml", "software", "security", "networking", "web-publishing"]));
    const technicalRoots = FIELD_VALUES.filter((value) => value.branch === "technical" && value.parent === null);
    expect(valueOf("field", "engineering")?.pointsTo).toHaveLength(technicalRoots.length);
  });

  it("lists the Task, Setting and answer lists as written", () => {
    expect(TAXONOMY.task.filter((value) => value.parent === null).map((value) => value.label)).toEqual(["Create", "Analyse", "Assess", "Find", "Organise", "Communicate", "Act"]);
    expect(TAXONOMY.setting.filter((value) => value.parent === null).map((value) => value.label)).toEqual(["Personal", "Education", "Research", "Work", "Public and community"]);
    expect(TAXONOMY.built).toHaveLength(23);
    expect(TAXONOMY.technique).toHaveLength(22);
    expect(TAXONOMY.modality).toHaveLength(10);
    expect(TAXONOMY.method).toHaveLength(8);
    expect(TAXONOMY.autonomy.map((value) => value.label)).toEqual(["You do each step", "AI suggests and you approve", "AI acts with approval gates", "Fully autonomous"]);
    expect(TAXONOMY.cost).toHaveLength(6);
  });

  it("has Task and Setting groups that cannot be chosen themselves", () => {
    expect(valueOf("task", "create")?.selectable).toBe(false);
    expect(valueOf("task", "create.writing")?.selectable).toBe(true);
  });

  it("covers every tool already in the registry, once", () => {
    const labels = (name: string) => STACK_VALUES.filter((value) => value.label.toLowerCase() === name.toLowerCase());
    for (const tool of TOOLS) {
      const spellings = [tool.name, ...tool.aliases].map((s) => s.toLowerCase().replace(/[\s._-]+/g, ""));
      const present = STACK_VALUES.some((value) => [value.label, ...value.synonyms].some((s) => spellings.includes(s.toLowerCase().replace(/[\s._-]+/g, ""))));
      expect(present, tool.name).toBe(true);
    }
    // One entry per real product inside one group.
    const keys = STACK_VALUES.filter((value) => value.parent).map((value) => `${value.parent}|${value.label.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(labels("Claude").map((value) => value.parent).sort()).toEqual(["ai-applications", "models"]);
    expect(labels("n8n")).toHaveLength(1);
    expect(labels("Ollama")).toHaveLength(1);
  });
});

describe("taxonomy: helpers", () => {
  it("finds by label prefix, then synonym prefix, then contains", () => {
    const hits = findValues("field", "retr").map((value) => value.label);
    expect(hits[0]).toBe("Retrieval systems");
    expect(findValues("task", "text an")[0].label).toBe("Text analysis (NLP)");
  });

  it("is case-insensitive and reads synonyms", () => {
    expect(findValues("task", "NLP")[0].id).toBe("analyse.text-analysis-nlp");
    expect(findValues("technique", "rag")[0].label).toBe("Retrieval (RAG)");
    expect(findValues("field", "K8S")[0].label).toBe("Containers and orchestration");
    const dissertation = findValues("setting", "dissertation").map((value) => value.label);
    expect(dissertation).toEqual(expect.arrayContaining(["Undergraduate student", "Postgraduate student"]));
  });

  it("puts a prefix match above a contains match", () => {
    const hits = findValues("field", "search").map((value) => value.label);
    expect(hits.indexOf("Search optimisation")).toBeLessThan(hits.indexOf("Retrieval systems"));
  });

  it("returns nothing for empty text, and respects a limit", () => {
    expect(findValues("field", "  ")).toEqual([]);
    expect(findValues("field", "a", 8)).toHaveLength(8);
  });

  it("walks ancestors and paths", () => {
    expect(ancestorsOf("ai-ml.retrieval.hybrid-search")).toEqual(["ai-ml.retrieval", "ai-ml"]);
    expect(ancestorsOf("medicine")).toEqual([]);
    expect(pathOf("education.higher-education")).toBe("Education › Higher education");
  });

  it("knows what is known, and finds a label exactly", () => {
    expect(isKnown("field", "ai-ml")).toBe(true);
    expect(isKnown("field", "nope")).toBe(false);
    expect(isKnown("task", "ai-ml")).toBe(false);
    expect(valueByLabel("data", "health data")?.id).toBe("health-data");
  });

  it("maps a whole term across facets", () => {
    const stata = findAcross("Stata").map((hit) => `${hit.facet}:${hit.value.id}`);
    expect(stata).toContain("stack:applications.stata");
    const rag = findAcross("RAG").map((hit) => hit.facet);
    expect(rag).toEqual(expect.arrayContaining(["technique"]));
    expect(findAcross("x")).toEqual([]);
  });
});
