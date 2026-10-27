/* SV-11: the Builds Table board's sample data, as `BuildsView` takes it.

   Copied from the `<script type="text/x-dc">` block of `design/reference/vision/source/Builds.dc.html`. DEV ONLY (the
   dev page `vision-builds-table` and the views' tests). Every name, number and sentence is sample content. The board's
   letter tiles are the real marks of the tools they stand for. */

import { statParts, type BuildsViewProps } from "@/pages/site/builds/BuildsView";
import type { CatalogueGroup, FilterSection, WordOption } from "@/pages/site/builds/BuildsFiltersView";
import { COLUMN_ORDER, type TableRowView } from "@/pages/site/builds/BuildsTableView";

const noop = () => undefined;

const words = (items: readonly (readonly [string, number, boolean])[]): WordOption[] =>
  items.map(([label, count, checked]) => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, count, checked }));

const bars = (values: readonly number[], from: number, to: number) => {
  const max = Math.max(...values);
  return values.map((value, index) => ({ height: value / max, inRange: index >= from && index <= to }));
};

export const visionBuildsSections: FilterSection[] = [
  {
    kind: "word",
    id: "field",
    name: "Field",
    order: "az",
    options: words([["AI and machine learning", 14, false], ["Education", 9, false], ["Finance", 11, false], ["Marketing", 18, false], ["Sales", 22, true], ["Software development", 31, false]]),
  },
  {
    kind: "range",
    id: "reproductions",
    name: "Reproductions",
    valueText: "3 or more",
    histogram: bars([22, 18, 14, 12, 10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1], 2, 19),
    min: 0,
    max: 40,
    value: [3, 40],
    describe: (value, end) => (end === "min" ? `${value} or more` : value >= 40 ? "40 or more" : `up to ${value}`),
    endLabels: ["0", "40+"],
  },
  {
    kind: "word",
    id: "model",
    name: "Works on model",
    order: "count",
    options: words([["Sonnet 4.5", 44, false], ["Opus 5.5", 31, true], ["GPT-5", 27, false], ["Gemini 3.5 Pro", 12, false]]),
  },
  {
    kind: "range",
    id: "steps",
    name: "Steps",
    valueText: "5 to 30",
    histogram: bars([3, 6, 9, 12, 14, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1], 2, 12),
    min: 0,
    max: 40,
    value: [5, 30],
    describe: (value, end) => (end === "min" ? `from ${value}` : `to ${value}`),
    endLabels: ["0", "40+"],
    bare: true,
  },
  {
    kind: "scale",
    id: "autonomy",
    name: "Autonomy",
    segments: [
      { key: "you-do-each-step", label: "You do each step", on: false },
      { key: "ai-suggests-and-you-approve", label: "AI suggests and you approve", on: true },
      { key: "ai-acts-with-approval-gates", label: "AI acts with approval gates", on: true },
      { key: "fully-autonomous", label: "Fully autonomous", on: false },
    ],
    endLabels: ["You do each step", "Fully autonomous"],
  },
  ...[["stack", "Tools and stack", "Claude Code"], ["task", "Task", "Any"], ["built", "What was built", "Any"], ["technique", "Techniques", "Any"], ["confirmed", "Last confirmed", "Any"], ["cost", "Cost to run", "Any"]].map(
    ([id, name, value]) => ({ kind: "closed" as const, id, name, value }),
  ),
];

export const visionBuildsCatalogue: CatalogueGroup[] = [
  ["Classification", 15, "Field, Task, Setting, What was built, Role of AI, Techniques, Modality, Build method, Autonomy, Tools and stack, Data handled, Human oversight, Age suitability, Skill needed, Cost to run"],
  ["Proof", 6, "Reproductions, Works on model, Last confirmed, Confirmed or stale, Rebuilds, Likes"],
  ["Structure", 8, "Shape, Steps, Sessions, Parts, Agents, Patterns, Tile categories, Completeness"],
  ["OpenBuilds", 3, "Open requests, Request type, Reward"],
  ["Lineage", 2, "Rebuilt from, Original build"],
  ["People", 3, "Maker, People you follow, Contributors"],
].map(([name, count, items]) => ({ name: name as string, count: count as number, items: items as string }));

const TOOL = { C: "claude-code", G: "gemini", S: "replit", L: "lovable", N: "n8n", Z: "zapier" } as const;
const NAME: Record<string, string> = { "claude-code": "Claude Code", gemini: "Gemini", replit: "Replit", lovable: "Lovable", n8n: "n8n", zapier: "Zapier" };

type Sample = readonly [string, string, string, string, string, number, number, number, boolean, string, readonly number[], number, string, string];

const DATA: readonly Sample[] = [
  ["Inbox triage in one prompt", "kit", "Configured assistant", "Sales", "CG", 6, 1, 31, true, "2d ago on Opus 5.5", [2, 3, 3, 4, 5, 4, 6, 7, 6, 8, 9, 8], 4, "1 step", "Free plans"],
  ["Lead scoring from CRM notes", "luke", "Script or tool", "Sales", "CS", 9, 2, 12, true, "1w ago on Opus 5.5", [1, 1, 2, 2, 2, 3, 3, 2, 3, 3, 4, 4], 1, "", "Under £10/mo"],
  ["Proposal writer with pricing", "mira", "Document or report", "Sales", "C", 11, 2, 9, true, "3d ago on GPT-5", [0, 1, 1, 1, 2, 2, 2, 1, 3, 2, 2, 3], 3, "1 session", "Paid plan"],
  ["Weekly pipeline digest", "dax", "Automation workflow", "Sales", "CZ", 17, 4, 8, true, "5d ago on Opus 5.5", [1, 0, 1, 2, 1, 2, 2, 2, 1, 2, 3, 2], 0, "", "Under £10/mo"],
  ["Cold email personaliser", "jay", "Autonomous agent", "Sales", "CL", 22, 5, 7, false, "5mo ago on Opus 5.5", [3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1], 2, "1 step · £40", "£10 to £50/mo"],
  ["Call notes that write themselves", "maya", "Automation workflow", "Sales", "CN", 14, 3, 6, true, "4d ago on Opus 5.5", [0, 0, 1, 1, 2, 1, 2, 3, 2, 3, 4, 3], 2, "", "Under £10/mo"],
  ["Meeting to Linear tickets", "kit", "MCP server", "Sales", "CL", 8, 2, 6, true, "1d ago on Opus 5.5", [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4], 1, "", "Free plans"],
  ["Objection handling coach", "ava", "Chatbot or assistant", "Sales", "C", 5, 1, 5, true, "2w ago on Opus 5.5", [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], 0, "", "Free plans"],
  ["Account research brief", "mira", "Multi-agent system", "Sales", "CG", 26, 6, 4, true, "6d ago on GPT-5", [0, 0, 0, 0, 1, 1, 1, 1, 2, 1, 2, 2], 1, "1 part", "£10 to £50/mo"],
  ["Renewal risk alerts", "noah", "Automation workflow", "Sales", "CS", 12, 3, 4, false, "4mo ago on Opus 5.5", [2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1], 0, "Model test", "Under £10/mo"],
  ["Quote to invoice", "suntzu", "Web app", "Sales", "CS", 19, 4, 3, true, "3w ago on Opus 5.5", [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], 0, "1 session", "Paid plan"],
  ["Discovery call scorer", "luke", "Evaluation suite", "Sales", "C", 7, 2, 3, true, "1w ago on Opus 5.5", [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2], 0, "", "Free plans"],
];

export const visionBuildsRows: TableRowView[] = DATA.map((d, index) => ({
  id: `vb${index + 1}`,
  href: "#",
  title: d[0],
  maker: d[1],
  built: d[2],
  field: d[3],
  tools: d[4].split("").map((letter) => ({ id: TOOL[letter as keyof typeof TOOL], name: NAME[TOOL[letter as keyof typeof TOOL]] })),
  steps: d[5],
  sessions: d[6],
  reproductions: d[7],
  lit: d[8],
  confirmed: d[9],
  runs: d[10],
  rebuilds: d[11],
  open: d[12],
  cost: d[13],
}));

export function visionBuildsTableProps(): BuildsViewProps {
  return {
    figure: "18 builds",
    parts: statParts({ published: 120, runsThisWeek: 214, freshPct: 78 }),
    view: "table",
    hrefFor: () => "#",
    filters: {
      activeCount: 6,
      onAdd: noop,
      savedSets: {
        rows: [
          { id: "s1", name: "Sales on Claude Code", count: 34, href: "#" },
          { id: "s2", name: "Works on Opus 5.5, no code", count: 18, href: "#" },
        ],
        onSaveCurrent: noop,
      },
      sections: visionBuildsSections,
      catalogue: { total: 37, groups: visionBuildsCatalogue },
      onToggleOption: noop,
      onOrder: noop,
      onRange: noop,
      onToggleSegment: noop,
      onOpenClosed: noop,
      onMove: noop,
    },
    table: {
      lenses: [{ value: "all", label: "All" }, { value: "proven", label: "Reproduced" }, { value: "rebuilt", label: "Rebuilt" }, { value: "unsolved", label: "Open requests" }],
      lens: "all",
      onLens: noop,
      sort: {
        value: "reproduced",
        options: [{ value: "newest", label: "Newest" }, { value: "reproduced", label: "Reproductions" }, { value: "confirmed", label: "Confirmed" }, { value: "rebuilt", label: "Rebuilds" }],
        onChange: noop,
      },
      columnsLabel: "12 of 24",
      chips: [["Field", "Sales"], ["Tools", "Claude Code"], ["Reproductions", "3 or more"], ["Works on", "Opus 5.5"], ["Steps", "5 to 30"], ["Autonomy", "2 of 4"]].map(([name, value]) => ({ key: name, name, value })),
      onRemoveChip: noop,
      onClearAll: noop,
      columns: COLUMN_ORDER,
      rows: visionBuildsRows,
      sortColumn: { id: "reproductions", ascending: false },
      sortableBy: { reproductions: "reproduced", confirmed: "confirmed", rebuilds: "rebuilt" },
      footer: { count: "18 builds", mostCommon: "Most common · Sales, Claude Code", median: "Median 11 steps", total: "Total 214", onCalculate: noop },
    },
  };
}
