/* CA-16 P5: what the Classification Card is given, and how its draft becomes a classification. PURE.

   The Card edits a DRAFT of the classification and writes it when the maker presses Save; Cancel drops it. The derived
   values and the gap questions are not part of the draft: they are read from the build every time (`derive.ts`). */

import type { GapQuestion, QuestionAction } from "@/lib/classify/derive";
import { emptyClassification } from "@/lib/classify/facets";
import { TAXONOMY_VERSION } from "@/lib/classify/taxonomy";
import type { Classification, DerivedMap, DisputeMap, Entry } from "@/lib/classify/types";

export interface ClassificationDraft {
  field: Entry[];
  task: Entry[];
  setting: Entry[];
  data: Entry[];
  stack: Entry[];
  age: string | null;
  disputes: DisputeMap;
  dismissed: string[];
}

export interface ClassificationSaved {
  /** The classification reached the database. False while the columns are not there yet. */
  written: boolean;
  missing: boolean;
}

/** What the page hands the Card. Absent: the Card shows no classification rows (an old test, a dev page). */
export interface ClassificationCardData {
  /** The two new columns exist. While they do not, the Card says so and saves everything else. */
  live: boolean;
  /** What is stored now. */
  stored: Classification;
  /** Read from the build's tiles. */
  derived: DerivedMap;
  /** Every gap question the tiles raise, dismissed or not: the draft says which are dismissed. */
  questions: readonly GapQuestion[];
  /** The title, the summary and the prompt texts, for suggestions. */
  texts: readonly string[];
  /** Who the preview is drawn as. Absent: no maker line. */
  maker?: { id: string | null; name: string | null; handle: string | null; avatar: string | null };
  onSave: (draft: ClassificationDraft) => Promise<ClassificationSaved>;
  /** Selects the tile a derived value came from. */
  onSelectSource?: (tileId: string) => void;
  /** A gap question's action ("Add code"). */
  onAction?: (action: QuestionAction, question: GapQuestion) => void;
}

export const draftOf = (c: Classification): ClassificationDraft => ({
  field: [...c.declared.field],
  task: [...c.declared.task],
  setting: [...c.declared.setting],
  data: [...c.declared.data],
  stack: [...c.declared.stack],
  age: c.declared.age,
  disputes: { ...c.disputes },
  dismissed: [...c.questions_dismissed],
});

/** The classification a draft makes: declared and disputes from the draft, the latest derived values from the build. */
export function applyDraft(base: Classification | null, derived: DerivedMap, draft: ClassificationDraft): Classification {
  const start = base ?? emptyClassification();
  return {
    ...start,
    version: TAXONOMY_VERSION,
    declared: { field: draft.field, task: draft.task, setting: draft.setting, data: draft.data, age: draft.age, stack: draft.stack },
    derived,
    disputes: draft.disputes,
    questions_dismissed: draft.dismissed,
  };
}

export const sameDraft = (a: ClassificationDraft, b: ClassificationDraft): boolean => JSON.stringify(a) === JSON.stringify(b);
