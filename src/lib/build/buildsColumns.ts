// BF-12: the Builds table's column ids as plain strings, so the address (`galleryParams.ts`, in `src/lib`) can check `by` and
// `by2` without importing from a page. The Table's own names, kinds and order of drawing are in `BuildsTableView.tsx`, which
// reads this list as its `ALL_COLUMNS`: the board's twelve, then the sixteen the chooser adds.

export const ALL_COLUMN_IDS: readonly string[] = [
  "build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost",
  "shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill", "works", "likes", "patterns", "published",
];

export const isColumnId = (value: string | null | undefined): value is string => typeof value === "string" && ALL_COLUMN_IDS.includes(value);
