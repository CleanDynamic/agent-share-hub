/* CA-18b P3: what the "colour and references" section at the foot of Details says, worked out from CA-19's colour model.

   PURE. Read only: nothing here writes. `referenceSectionOf` gives one of three states for a component (a tile, a session or a part):
   in a reference group (its group, notes, members and the group's linked text), a single colour (and the others that share it,
   not grouped), or uncoloured (a "Linked text" section if it has some, else nothing). */

import { shownName, type RefEntry } from "@/lib/build/postRefs";
import { alsoUsedBy, groupTo, stateIn, type ColourModel, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { parseRefTo } from "@/lib/build/thread";


export const DETAILS_REFS_COPY = {
  groupHead: "Reference group",
  sharesWith: (others: number) => `Shares its colour with ${others} other ${others === 1 ? "component" : "components"}`,
  components: (n: number) => `${n} components`,
  noName: "No name",
  openGroup: "Open group",
  notes: "Notes",
  componentsLabel: "Components",
  linkedText: "Linked text",
  goTo: "Go to it",
  readAll: "Read all",
  colourHead: "Colour",
  setOn: (kind: ComponentWord) => `Set on this ${kind} only`,
  single: "Single colour",
  alsoUsedBy: (names: string) => `Also used by ${names}, not grouped`,
  this: (kind: ComponentWord) => `This ${kind}`,
} as const;

export type ComponentWord = "tile" | "session" | "part";

/** "tile", "session" or "part" for a component's `to`. */
export function componentWord(to: string): ComponentWord {
  const kind = parseRefTo(to)?.kind;
  return kind === "session" ? "session" : kind === "workstream" ? "part" : "tile";
}

export interface LinkedWords {
  words: string;
  /** The post the words are in, 1-based. */
  post: number;
}

export interface MemberRow {
  to: string;
  badge: string;
  name: string;
  /** What the row says at the right: the kind, or "This tile" on the component being shown. */
  kind: string;
  current: boolean;
}

export type ReferenceSection =
  | { state: "group"; group: ReferenceGroup; others: number; members: MemberRow[]; notes?: string; linked: (LinkedWords & { to: string }) | null }
  | { state: "single"; colour: string; word: ComponentWord; linked: (LinkedWords & { to: string }) | null; alsoUsedBy: string[] }
  | { state: "linked"; linked: LinkedWords & { to: string } };

export interface ReferenceSectionInput {
  to: string;
  model: ColourModel;
  lookup: ReadonlyMap<string, RefEntry>;
  /** The words in the post that link to a target, if any. */
  linked: (to: string) => LinkedWords | null;
}

const join = (names: readonly string[]): string => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The section for a component, or null when it has no colour and no linked text. */
export function referenceSectionOf({ to, model, lookup, linked }: ReferenceSectionInput): ReferenceSection | null {
  const word = componentWord(to);
  const state = stateIn(model, to);
  const link = (target: string) => {
    const found = linked(target);
    return found ? { ...found, to: target } : null;
  };
  if (state.state === "group" && state.group) {
    const group = state.group;
    const members = group.members.map((ref): MemberRow => {
      const entry = lookup.get(ref);
      const sessionOrPart = entry?.kind === "Session" || entry?.kind === "Part";
      return {
        to: ref,
        badge: entry?.number ?? "",
        name: entry ? (sessionOrPart ? shownName(entry) : entry.title) : ref,
        kind: ref === to ? DETAILS_REFS_COPY.this(word) : (entry?.kind ?? ""),
        current: ref === to,
      };
    });
    return { state: "group", group, others: group.members.length - 1, members, ...(group.notes ? { notes: group.notes } : null), linked: link(groupTo(group.id)) };
  }
  if (state.state === "single" && state.colour) {
    const others = alsoUsedBy(model, state.colour, to).map((ref) => shownName(lookup.get(ref)) || ref);
    return { state: "single", colour: state.colour, word, linked: link(to), alsoUsedBy: others };
  }
  const own = link(to);
  return own ? { state: "linked", linked: own } : null;
}

/** "Session 3" or "Session 3 and Landing page", for the Also used by line. */
export const alsoUsedByLine = (names: readonly string[]): string => DETAILS_REFS_COPY.alsoUsedBy(join(names));
