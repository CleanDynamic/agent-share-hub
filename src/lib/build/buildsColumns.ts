// BF-12: the Builds Table's column ids, as plain strings, where both the page (`BuildsTableView`) and the address
// (`galleryParams`, which reads `by` and `by2`) can reach them. `src/lib` imports nothing from a page, so the list lives here.

/** The board's twelve columns. */
export type BoardColumnId = "build" | "built" | "field" | "tools" | "steps" | "sessions" | "reproductions" | "confirmed" | "runs" | "rebuilds" | "open" | "cost";

/** SV-24 P2: the twelve more the Columns chooser offers, 24 in all: Shape and the classification facets that are not already a column.
    BF-10: and four more, 28: Works on model, Likes, Patterns (each a filter with no column till now) and Published (Newest's). */
export type ExtraColumnId = "shape" | "task" | "setting" | "role" | "technique" | "modality" | "method" | "autonomy" | "data" | "oversight" | "age" | "skill" | "works" | "likes" | "patterns" | "published";

export type ColumnId = BoardColumnId | ExtraColumnId;

export const COLUMN_ORDER: readonly ColumnId[] = ["build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"];

export const EXTRA_COLUMNS: readonly ExtraColumnId[] = ["shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill", "works", "likes", "patterns", "published"];

/** Every column, the extras after the board's twelve. */
export const ALL_COLUMNS: readonly ColumnId[] = [...COLUMN_ORDER, ...EXTRA_COLUMNS];

export const isColumnId = (value: unknown): value is ColumnId => typeof value === "string" && (ALL_COLUMNS as readonly string[]).includes(value);
