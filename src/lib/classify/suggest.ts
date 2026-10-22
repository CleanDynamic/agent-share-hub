/* CA-16 P4 — the values the Card suggests, by rule and never by a model.

   PURE. A suggestion is a list value the build's own words or tiles point at: the derivation (an image result suggests
   the Task "Images"), and an exact match of the title, the summary and the prompts against a label or a synonym.
   Nothing is chosen for the maker; a suggestion is a chip they can press. */

import type { DerivedMap, Entry } from "./types";
import { isCustomEntry } from "./types";
import { TAXONOMY, valueOf, type Facet, type TaxonomyValue } from "./taxonomy";

export type SuggestFacet = "field" | "task" | "setting" | "data" | "stack";

/** One word the lists use that is too common to point at anything on its own. */
const COMMON = new Set(["data", "code", "app", "apps", "tool", "tools", "ai", "make", "build", "create", "web", "api", "search", "new", "free", "help", "text", "chat", "model", "models", "learning", "design", "game", "games", "work", "team", "test", "tests", "image", "images", "video", "audio", "music", "go", "pi", "tf", "ts", "js", "py", "rn", "r", "c", "ml", "ui", "ux", "sim", "ops", "dev", "net", "sql"]);

/** What the derived values suggest for Task: an image result means "Images", a classifier means "Classifying and routing". */
const TASK_FROM_DERIVED: readonly { facet: Facet; value: string; task: string }[] = [
  { facet: "built", value: "image-set", task: "create.images" },
  { facet: "built", value: "video", task: "create.video" },
  { facet: "built", value: "audio", task: "create.audio-and-music" },
  { facet: "built", value: "document-or-report", task: "create.writing" },
  { facet: "built", value: "presentation", task: "create.presentations" },
  { facet: "built", value: "script-or-tool", task: "create.code" },
  { facet: "built", value: "web-app", task: "create.code" },
  { facet: "built", value: "spreadsheet-or-data-model", task: "analyse.quantitative-analysis" },
  { facet: "technique", value: "classification", task: "organise.classifying-and-routing" },
  { facet: "technique", value: "extraction", task: "organise.extracting-data" },
  { facet: "technique", value: "evaluations", task: "assess.testing" },
  { facet: "technique", value: "retrieval-rag", task: "communicate.answering-questions" },
];

/** Words that point at the kind of data a build handles. */
const DATA_HINTS: readonly [RegExp, string][] = [
  [/\b(patients?|clinical|medical records?|diagnos\w+|nhs)\b/i, "health-data"],
  [/\b(pupils?|students?|children|child|school records?|gcse|safeguarding)\b/i, "student-or-child-data"],
  [/\b(invoices?|bank|payments?|transactions?|salary|payroll|mortgage)\b/i, "financial-data"],
  [/\b(confidential|contracts?|customer lists?|internal documents?|trade secrets?)\b/i, "confidential-business-data"],
  [/\b(open data|public data|government data)\b/i, "public-data-only"],
];

const NAMES = new Map<Facet, Map<string, { value: TaxonomyValue; label: boolean }[]>>();

function namesOf(facet: Facet) {
  let map = NAMES.get(facet);
  if (!map) {
    map = new Map();
    for (const value of TAXONOMY[facet]) {
      if (!value.selectable) continue;
      for (const [name, label] of [[value.label, true], ...value.synonyms.map((s) => [s, false] as const)] as const) {
        const key = name.toLowerCase();
        const list = map.get(key) ?? [];
        list.push({ value, label });
        map.set(key, list);
      }
    }
    NAMES.set(facet, map);
  }
  return map;
}

const words = (text: string): string[] => text.toLowerCase().match(/[a-z0-9][a-z0-9+#.'-]*[a-z0-9+#]|[a-z0-9]/g) ?? [];

/** The values a text names, with how strongly: a label counts for more than a synonym, and a repeat adds. */
function scoreText(facet: Facet, text: string, scores: Map<string, { value: TaxonomyValue; score: number }>): void {
  const names = namesOf(facet);
  const tokens = words(text);
  for (let start = 0; start < tokens.length; start += 1) {
    for (let length = 1; length <= 4 && start + length <= tokens.length; length += 1) {
      const gram = tokens.slice(start, start + length).join(" ");
      if (length === 1 && (gram.length < 3 || COMMON.has(gram))) continue;
      for (const hit of names.get(gram) ?? []) {
        if (length === 1 && !hit.label && COMMON.has(gram)) continue;
        const entry = scores.get(hit.value.id) ?? { value: hit.value, score: 0 };
        entry.score += (hit.label ? 2 : 1) * length;
        scores.set(hit.value.id, entry);
      }
    }
  }
}

export interface SuggestInput {
  /** The title, the summary and the prompt texts. */
  texts: readonly string[];
  derived?: DerivedMap;
  /** What the maker has already chosen: never suggested again. */
  chosen: readonly Entry[];
}

/** Up to `limit` values to suggest for one facet, best first. Nothing is ever pre-selected. */
export function suggestFor(facet: SuggestFacet, input: SuggestInput, limit = 3): TaxonomyValue[] {
  const taken = new Set(input.chosen.flatMap((entry) => (isCustomEntry(entry) ? [] : [entry.id])));
  const out: TaxonomyValue[] = [];
  const add = (value: TaxonomyValue | null) => {
    if (value && value.selectable && !taken.has(value.id) && !out.some((v) => v.id === value.id)) out.push(value);
  };

  if (facet === "task") {
    for (const hint of TASK_FROM_DERIVED) {
      if (input.derived?.[hint.facet]?.values.includes(hint.value)) add(valueOf("task", hint.task));
    }
  }
  if (facet === "data") {
    const joined = input.texts.join("\n");
    for (const [pattern, id] of DATA_HINTS) if (pattern.test(joined)) add(valueOf("data", id));
  }

  const scores = new Map<string, { value: TaxonomyValue; score: number }>();
  for (const text of input.texts) scoreText(facet, text.slice(0, 2000), scores);
  [...scores.values()]
    .sort((a, b) => b.score - a.score || b.value.depth - a.value.depth || a.value.label.localeCompare(b.value.label))
    .forEach((hit) => add(hit.value));

  return out.slice(0, limit);
}
