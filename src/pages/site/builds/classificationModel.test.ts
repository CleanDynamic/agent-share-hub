// SV-13 P1: what a Classification card says. The claims: a derived value with three source tiles reads "from 3 tiles"; a
// declared value reads "stated"; a facet in `disputes` reads "corrected"; a value links to the Table with its facet key in
// the address; blocked storage falls back to the default eight without throwing.

import { afterEach, describe, expect, it, vi } from "vitest";

import type { BuildsTableBuild } from "@/lib/build/gallery";
import { emptyClassification } from "@/lib/classify/facets";
import type { Classification } from "@/lib/classify/types";

import { DEFAULT_FACETS, FACET_CHOICE_KEY, cardOf, readFacetChoice, writeFacetChoice } from "./classificationModel";

const build = (classifiedAs?: Classification): BuildsTableBuild => ({
  id: "b1", slug: "b1", title: "Call notes", shape: "workflow", madeWith: [], reproductionCount: 6, lastConfirmedAt: "2026-10-20T09:00:00Z", lastConfirmedModel: null,
  publishedAt: "2025-01-01T09:00:00Z", rebuildCount: 0, maker: { handle: "maya", name: null }, open: { count: 0, reward: null }, ...(classifiedAs ? { classifiedAs } : null),
});

const NOW = Date.parse("2026-10-26T12:00:00Z");
const href = (key: string) => `/builds?f=${encodeURIComponent(key)}`;
const row = (card: ReturnType<typeof cardOf>, name: string) => card.rows.find((entry) => entry.name === name)!;

function classified(): Classification {
  const c = emptyClassification();
  c.declared.field = [{ id: "marketing-and-sales" }];
  c.declared.task = [{ custom: "Call wrap-up" }];
  c.declared.data = [{ id: "personal-data" }];
  c.declared.stack = [{ custom: "Our CRM" }];
  c.derived.built = { values: ["automation-workflow"], from: ["t1", "t2", "t3"] };
  c.derived.technique = { values: ["single-agent"], from: ["t1"] };
  c.derived.cost = { values: ["extra-usage-under-10-a-month"], from: ["t2"] };
  c.derived.stack = { values: ["ai-applications.claude"], from: [] };
  c.disputes.cost = { values: ["needs-a-paid-plan"], reason: "I pay for it", at: "2026-10-01T00:00:00Z" };
  return c;
}

describe("the card", () => {
  it("reads 'from 3 tiles' for a derived value with three source tiles, and 'from 1 tile' for one", () => {
    const card = cardOf(build(classified()), DEFAULT_FACETS, href, NOW);
    expect(row(card, "What was built").source).toBe("from 3 tiles");
    expect(row(card, "Techniques").source).toBe("from 1 tile");
  });

  it("reads 'stated' for a declared value and 'corrected' for a disputed facet", () => {
    const card = cardOf(build(classified()), DEFAULT_FACETS, href, NOW);
    expect(row(card, "Field").source).toBe("stated");
    expect(row(card, "Data handled").source).toBe("stated");
    expect(row(card, "Cost to run").source).toBe("corrected");
    expect(row(card, "Cost to run").values.map((value) => value.label)).toEqual(["Needs a paid plan"]);
  });

  it("links a listed value to the Table with its facet key, and leaves the maker's own words as text", () => {
    const card = cardOf(build(classified()), DEFAULT_FACETS, href, NOW);
    expect(row(card, "Field").values[0].href).toBe(href("field:marketing-and-sales"));
    expect(row(card, "Task").values).toEqual([{ label: "Call wrap-up", href: null }]);
  });

  it("puts the maker's own Tools and stack after the derived ones", () => {
    const card = cardOf(build(classified()), DEFAULT_FACETS, href, NOW);
    expect(row(card, "Tools and stack").values.map((value) => value.label)).toEqual(["Claude", "Our CRM"]);
    expect(row(card, "Tools and stack").source).toBe("derived");
  });

  it("names the shape and the regulated area, and shows only the facets chosen, in the taxonomy's order", () => {
    const c = classified();
    c.declared.data = [{ id: "health-data" }];
    const card = cardOf(build(c), ["cost", "field"], href, NOW);
    expect(card.subtitle).toBe("@maya · Workflow · Regulated area");
    expect(card.rows.map((entry) => entry.name)).toEqual(["Field", "Cost to run"]);
  });

  it("gives an unclassified build empty rows with no source and says nothing is faked", () => {
    const card = cardOf(build(), DEFAULT_FACETS, href, NOW);
    expect(card.rows).toHaveLength(8);
    expect(card.rows.every((entry) => entry.values.length === 0 && entry.source === "")).toBe(true);
    expect(card.subtitle).toBe("@maya · Workflow");
  });
});

describe("the facet choice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("defaults to the board's eight", () => {
    expect(readFacetChoice()).toEqual(["field", "task", "built", "technique", "autonomy", "stack", "data", "cost"]);
  });

  it("keeps the choice under a versioned key, holding only facet ids, and drops ids it does not know", () => {
    writeFacetChoice(["role", "cost"]);
    expect(FACET_CHOICE_KEY).toBe("builds:facets:v1");
    expect(JSON.parse(localStorage.getItem(FACET_CHOICE_KEY)!)).toEqual(["role", "cost"]);
    expect(readFacetChoice()).toEqual(["role", "cost"]);
    localStorage.setItem(FACET_CHOICE_KEY, JSON.stringify(["role", "nonsense", 4]));
    expect(readFacetChoice()).toEqual(["role"]);
    localStorage.setItem(FACET_CHOICE_KEY, "{not json");
    expect(readFacetChoice()).toEqual(DEFAULT_FACETS);
  });

  it("falls back to the default eight when storage is blocked, without throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readFacetChoice()).toEqual(DEFAULT_FACETS);
    expect(() => writeFacetChoice(["role"])).not.toThrow();
  });
});
