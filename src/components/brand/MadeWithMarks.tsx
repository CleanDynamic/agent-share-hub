// The AI tools a build was made with, as their logos (PT-04).
//
// ONE MARK PER DISTINCT LOGO, IN THE ORDER THE BUILD NAMES THEM. made_with is
// read first: the entries that are tool labels ("ChatGPT", "Claude Code"), then
// the entries that are model names, then models_used for any model not covered
// yet. Several models of one lab are one mark, and a name with no mark is
// skipped. The build page can use the same component.
//
// THE GROUP IS ONE IMAGE FOR A SCREEN READER, "Made with ChatGPT, Claude,
// Gemini and Claude Code", and the same words are its title, so a mouse user
// can read them too. Each ModelMark is decorative on its own. Nothing is drawn
// behind a mark: no tile, no circle, no border.

import { ModelMark } from "@/components/brand/ModelMark";
import { markFor, type MarkKey } from "@/lib/models/marks";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

/** The most marks drawn, by width. The rest are counted. */
export const MARKS_DESKTOP = 4;
export const MARKS_PHONE = 3;

/** What a model's mark is called when only a model named it: the product, not the model. */
const PRODUCT: Partial<Record<MarkKey, string>> = {
  "claude-color": "Claude",
  openai: "OpenAI",
  "gemini-color": "Gemini",
  grok: "Grok",
  "deepseek-color": "DeepSeek",
};

export interface MadeWithMark {
  key: MarkKey;
  /** The plain name: the tool's label as stored, or the model's product. */
  name: string;
  /** The one the mark was found by: a tool label draws through `tool`, a model name through `model`. */
  by: { tool: string } | { model: string };
}

/** "A, B and C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The distinct marks of a build, in order. */
export function marksOf(madeWith: readonly string[] | null | undefined, modelsUsed: readonly string[] | null | undefined): MadeWithMark[] {
  const stored = (madeWith ?? []).map((entry) => entry.trim()).filter(Boolean);
  const models = (modelsUsed ?? []).map((entry) => entry.trim()).filter(Boolean);
  const out: MadeWithMark[] = [];
  const add = (key: MarkKey | null, name: string, by: MadeWithMark["by"]) => {
    if (key === null || out.some((mark) => mark.key === key)) return;
    out.push({ key, name: name || PRODUCT[key] || "", by });
  };

  for (const entry of stored) add(markFor({ tool: entry }), entry, { tool: entry });
  for (const entry of stored) {
    if (markFor({ tool: entry }) === null) {
      const key = markFor({ model: entry });
      add(key, key ? (PRODUCT[key] ?? "") : "", { model: entry });
    }
  }
  for (const entry of models) {
    const key = markFor({ model: entry });
    add(key, key ? (PRODUCT[key] ?? "") : "", { model: entry });
  }
  return out.filter((mark) => mark.name !== "");
}

export interface MadeWithMarksProps {
  /** builds.made_with. */
  madeWith?: readonly string[] | null;
  /** builds.models_used. */
  modelsUsed?: readonly string[] | null;
  /** Below 768px: three marks instead of four. */
  phone?: boolean;
}

export function MadeWithMarks({ madeWith, modelsUsed, phone = false }: MadeWithMarksProps) {
  const marks = marksOf(madeWith, modelsUsed);
  if (marks.length === 0) return null;

  const cap = phone ? MARKS_PHONE : MARKS_DESKTOP;
  const shown = marks.slice(0, cap);
  const rest = marks.length - shown.length;
  const label = `Made with ${listNames(marks.map((mark) => mark.name))}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-made-with=""
      style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, color: t.text }}
    >
      {shown.map((mark) => (
        <ModelMark key={mark.key} size={16} {...mark.by} />
      ))}
      {rest > 0 ? (
        <span aria-hidden="true" style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1, color: t.label }}>
          {`+${rest}`}
        </span>
      ) : null}
    </span>
  );
}

export default MadeWithMarks;
