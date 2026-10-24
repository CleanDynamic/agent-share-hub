// clashView: what the clash window says about one clash (CA-23 P4). PURE.
//
// Two panels, "This tab · 20:41" and "Other tab · 20:42": the time of each edit. In each, the text of the version; when the
// thing has several fields (a tile with a title and a note), only the fields that differ, each under its label. The post is its
// words, not its document.

import { fieldLabel, valueWords } from "./clash";

export const CLASH_COPY = {
  title: (name: string): string => `${name} changed in another tab`,
  body: "The version you don't keep goes to Recently removed.",
  useOther: "Use other tab's",
  keepThis: "Keep this tab's",
  /** The panel labels' stems: "This tab · 20:41". */
  thisTab: "This tab",
  otherTab: "Other tab",
  /** The entry in Recently removed for the version that was not kept: "Prompt 2 · other tab's version". */
  otherVersion: (name: string): string => `${name} · other tab's version`,
  thisVersion: (name: string): string => `${name} · this tab's version`,
} as const;

export interface PanelField {
  /** Shown above the text when the panel has several fields; empty for a thing with one. */
  label: string;
  text: string;
}

export interface ClashView {
  title: string;
  mineLabel: string;
  theirsLabel: string;
  mine: PanelField[];
  theirs: PanelField[];
}

const two = (n: number): string => String(n).padStart(2, "0");

/** "20:41", 24-hour, in the viewer's own time. */
export const clockOf = (at: number): string => `${two(new Date(at).getHours())}:${two(new Date(at).getMinutes())}`;

/** The words of a thread document (the post): paragraphs on their own lines, a new post after a blank one. */
export function postWords(doc: unknown): string {
  const lines: string[] = [];
  const walk = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") return n.text;
    return (n.content ?? []).map(walk).join("");
  };
  const top = doc && typeof doc === "object" ? ((doc as { content?: unknown[] }).content ?? []) : [];
  for (const block of top) {
    const type = (block as { type?: string }).type;
    if (type === "postBreak") lines.push("");
    else if (type === "postMedia") lines.push("(picture)");
    else lines.push(walk(block));
  }
  return lines.join("\n").trim();
}

/** The fields as a panel shows them: one field is its text alone; several are each under their label. */
export function panelFields(fields: readonly { key: string; mine: unknown; theirs: unknown }[], side: "mine" | "theirs"): PanelField[] {
  const one = fields.length === 1;
  return fields.map((field) => {
    const value = field[side];
    const text = field.key === "post_doc" ? postWords(value) || "(empty)" : valueWords(value);
    return { label: one ? "" : fieldLabel(field.key), text };
  });
}

export function clashView(name: string, fields: readonly { key: string; mine: unknown; theirs: unknown }[], mineAt: number, theirsAt: number): ClashView {
  return {
    title: CLASH_COPY.title(name),
    mineLabel: `${CLASH_COPY.thisTab} · ${clockOf(mineAt)}`,
    theirsLabel: `${CLASH_COPY.otherTab} · ${clockOf(theirsAt)}`,
    mine: panelFields(fields, "mine"),
    theirs: panelFields(fields, "theirs"),
  };
}
