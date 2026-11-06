// UX-12 P1: the shape of a legal text. The text is typed data, not JSX, so a reviewer can change wording without touching layout.
// A placeholder is written `{{NEED: what is needed}}`; it renders as itself, highlighted, while the text is a draft.

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export interface LegalSection {
  /** A stable kebab-case anchor, so a link like /privacy#your-rights keeps working. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalText {
  title: string;
  /** An ISO date, shown as "Last updated 4 November 2026". */
  lastUpdated: string;
  /** False until the text has been filled in and reviewed (see reviewed.ts). */
  reviewed: boolean;
  intro: string;
  sections: LegalSection[];
}

/** Every `{{NEED: …}}` in a string. */
export const NEED_PATTERN = /\{\{NEED:[^}]*\}\}/g;

/** Every string a text holds, for checks. */
export function textsOf(text: LegalText): string[] {
  const out: string[] = [text.title, text.intro];
  for (const section of text.sections) {
    out.push(section.heading);
    for (const block of section.blocks) {
      if (block.kind === "p") out.push(block.text);
      else if (block.kind === "list") out.push(...block.items);
      else out.push(...block.head, ...block.rows.flat());
    }
  }
  return out;
}
