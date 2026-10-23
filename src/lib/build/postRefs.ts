// postRefs: what a post's words can point at (CA-06 P2, P3).
//
// PURE. The build's steps and sessions in; out come the picker's groups (each session's own row, then its tiles in
// order, nested tiles under their parent) and the lookup the post draws its links from. Nothing is fetched and
// nothing is written. The words of a link are the maker's: renaming a part changes nothing in the post, and a link
// whose part is gone is drawn as plain words (`refLook` says `gone`).

import { groupKey, groupKind, groupOfStep, shownGroups, stepTitle, type SessionGroup, type Step } from "./graph";
import { partLabelsOf } from "./making";
import { dayRange } from "./stages";
import { refTo } from "./thread";
import { workstreamLabel, workstreamMark, workstreamTitle, workstreamsOf } from "./workstreams";

/** One part a link can point at. */
export interface RefEntry {
  /** `node:<id>`, `session:<key>` or (CA-17) `workstream:<key>`. */
  to: string;
  /** What follows the words: "3", "3.1", "S2", and for a part "B" (letters) or "P2" (numbers). */
  number: string;
  /** "The whole session" for a session's own row, "The whole part · Support agent" for a part's; else the tile's title. */
  title: string;
  /** "Prompt", "Agent", "Session", "Part", ... */
  kind: string;
  /** 0 for a step or a session; one more for each level it is nested. */
  depth: number;
  /** The maker's colour for it (CA-06 P4), or null. */
  colour: string | null;
  /** The words a link made with nothing highlighted inserts: "brand brief", "session 2 · claude code". */
  name: string;
  /** The hover card's eyebrow: "Prompt 3 · Session 1", "Session 2". */
  eyebrow: string;
  /** The hover card's text: three lines of the part's own words, or a session's tool, model, date and tiles. */
  body: string;
  /** The part's title as the card heads it: for a session, "Session 2 · Claude Code". */
  heading: string;
  /** The step id, or the session key. */
  id: string;
  /** For a tile: the step kind. */
  stepKind?: Step["kind"];
}

/** A session's entries, led by its own row; `key` null holds the steps an old build has before any session. With two or more parts (CA-17), a part's own row stands in a group of its own, and its sessions' groups follow it, a level in. */
export interface RefGroup {
  key: string | null;
  /** "Session 2 · Claude Code", or null. */
  label: string | null;
  entries: RefEntry[];
}

export const REF_KIND: Record<Step["kind"], string> = {
  prompt: "Prompt",
  agent: "Agent",
  team: "Team",
  manual: "Manual step",
  code: "Code",
  check: "Check",
  file: "File",
  tool: "Tool",
  decision: "Decision",
  system_prompt: "System prompt",
  dataset: "Dataset",
  repo: "GitHub repository",
} as Record<Step["kind"], string>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDay(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const at = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

const isInstructions = (step: Pick<Step, "id">) => step.id.endsWith(":instructions");

/** What a step holds that a link can point at: an agent's prompts, a team's agents, the tiles sent with it. */
const insideOf = (step: Step): Step[] => [...step.children.filter((child) => !isInstructions(child)), ...(step.sentWith ?? [])];

/** Three lines of a part's own words, at most. */
const threeLines = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");

export interface RefInput {
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** CA-17: `builds.making`, for the build's parts. With fewer than two the groups are as they always were. */
  making?: unknown;
}

/** The session a link can name: one that is stored, so never an old build's run of typed prompts. */
const linkable = (group: SessionGroup) => groupKind(group) !== "legacy";

function sessionLabel(group: SessionGroup): string {
  return `Session ${group.number}${group.tool ? ` · ${group.tool}` : ""}`;
}

function countTiles(steps: readonly Step[]): number {
  return steps.reduce((sum, step) => sum + 1 + countTiles(insideOf(step)), 0);
}

/** The picker's groups, in the build's order: each session's own row, then its tiles, nested tiles under their parent. */
export function refGroups({ steps, groups, making }: RefInput): RefGroup[] {
  const shown = shownGroups(groups);
  const out: RefGroup[] = [];
  const byKey = new Map<string, RefGroup>();
  const loose: RefGroup = { key: null, label: null, entries: [] };

  for (const group of shown) {
    const key = groupKey(group);
    const label = sessionLabel(group);
    const entry: RefGroup = { key, label, entries: [] };
    if (linkable(group)) {
      const mine = steps.filter((step) => group.stepNumbers.includes(step.number));
      const facts = [group.tool, group.model, shortDay(group.startedAt), `${countTiles(mine)} ${countTiles(mine) === 1 ? "tile" : "tiles"}`].filter(Boolean);
      entry.entries.push({
        to: refTo({ kind: "session", id: key }),
        number: `S${group.number}`,
        title: "The whole session",
        kind: "Session",
        depth: 0,
        colour: group.colour ?? null,
        name: label.toLowerCase(),
        eyebrow: `Session ${group.number}`,
        body: facts.join(" · "),
        heading: label,
        id: key,
      });
    }
    out.push(entry);
    byKey.set(key, entry);
  }

  const add = (target: RefGroup, step: Step, depth: number, number: string, session: SessionGroup | undefined) => {
    const shownNumber = step.number || number;
    const kind = REF_KIND[step.kind] ?? "Prompt";
    const title = stepTitle(step);
    target.entries.push({
      to: refTo({ kind: "node", id: step.id }),
      number: shownNumber,
      title,
      kind,
      depth,
      colour: step.colour ?? null,
      name: title.toLowerCase(),
      eyebrow: [`${kind}${shownNumber ? ` ${shownNumber}` : ""}`, session && linkable(session) ? `Session ${session.number}` : null].filter(Boolean).join(" · "),
      body: threeLines(step.text),
      heading: title,
      id: step.id,
      stepKind: step.kind,
    });
    for (const inner of insideOf(step)) add(target, inner, depth + 1, shownNumber, session);
  };

  for (const step of steps) {
    const session = groupOfStep(groups, step);
    const target = (session && byKey.get(groupKey(session))) || loose;
    add(target, step, 0, step.number, session);
  }

  const plain = [...(loose.entries.length > 0 ? [loose] : []), ...out].filter((group) => group.entries.length > 0);
  const parts = making ? workstreamsOf(making, shown.map((group) => groupKey(group))) : [];
  if (parts.length < 2) return plain;

  // CA-17 P5: with two or more parts the groups gain a level. Each part leads with its own row, then its sessions, a level in.
  const labels = partLabelsOf(making);
  const byGroup = new Map(plain.filter((group) => group.key !== null).map((group) => [group.key as string, group]));
  const sessionByKey = new Map(shown.map((group) => [groupKey(group), group]));
  const leveled: RefGroup[] = loose.entries.length > 0 ? [loose] : [];
  for (const part of parts) {
    const mine = part.sessions.flatMap((key) => (sessionByKey.has(key) ? [sessionByKey.get(key) as SessionGroup] : []));
    const apps = [...new Set(mine.map((group) => group.tool).filter((tool): tool is string => Boolean(tool)))];
    const days = mine.map((group) => (group.startedAt && /^\d{4}-\d{2}-\d{2}/.test(group.startedAt) ? group.startedAt.slice(0, 10) : "")).filter(Boolean).sort();
    const facts = [`${mine.length} ${mine.length === 1 ? "session" : "sessions"}`, apps.join(", "), dayRange(days[0], days[days.length - 1])].filter(Boolean);
    const label = workstreamLabel(part.index, labels);
    leveled.push({
      key: part.key,
      label: null,
      entries: [
        {
          to: refTo({ kind: "workstream", id: part.key }),
          number: labels === "letters" ? workstreamMark(part.index, labels) : `P${part.index + 1}`,
          title: part.name ? `The whole part · ${part.name}` : "The whole part",
          kind: "Part",
          depth: 0,
          colour: part.colour ?? null,
          name: workstreamTitle(part, part.index, labels).toLowerCase(),
          eyebrow: label,
          body: facts.join(" · "),
          heading: part.name ?? label,
          id: part.key,
        },
      ],
    });
    for (const key of part.sessions) {
      const group = byGroup.get(key);
      if (group) leveled.push({ ...group, entries: group.entries.map((entry) => ({ ...entry, depth: entry.depth + 1 })) });
    }
  }
  return leveled;
}

/** Whether the groups hold a part's own row: the picker then says "part, session or tile". */
export const hasPartRows = (groups: readonly RefGroup[]): boolean => groups.some((group) => group.entries.some((entry) => entry.kind === "Part"));

/** Every entry by its `to`. */
export function refLookup(groups: readonly RefGroup[]): Map<string, RefEntry> {
  return new Map(groups.flatMap((group) => group.entries.map((entry) => [entry.to, entry] as const)));
}

const words = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(Boolean);

/** Whether an entry answers a search: every word typed starts a word of its title or its kind, or starts its number. */
export function refMatches(entry: Pick<RefEntry, "title" | "kind" | "number">, query: string): boolean {
  const asked = words(query);
  if (asked.length === 0) return true;
  const have = [...words(entry.title), ...words(entry.kind), entry.number.toLowerCase()];
  return asked.every((word) => have.some((candidate) => candidate.startsWith(word)));
}

/** The groups narrowed to a search; a group with nothing left is dropped. */
export function filterRefGroups(groups: readonly RefGroup[], query: string): RefGroup[] {
  return groups.map((group) => ({ ...group, entries: group.entries.filter((entry) => refMatches(entry, query)) })).filter((group) => group.entries.length > 0);
}

/** CA-06 P4: every tile's colour by its id, inside agents, teams and steps too. */
export function partColours(steps: readonly Step[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (list: readonly Step[]) => {
    for (const step of list) {
      if (step.colour) out.set(step.id, step.colour);
      walk(insideOf(step));
    }
  };
  walk(steps);
  return out;
}
