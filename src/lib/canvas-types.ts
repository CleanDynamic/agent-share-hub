// ─── Grid position ───────────────────────────────
export interface BlockPosition {
  col: number;       // 1-based column start (1–12)
  row: number;       // 1-based row start
  colSpan: number;   // columns wide (1–12)
  rowSpan: number;   // row units tall (min 1)
}

// ─── Arrow relationship between two blocks ───────
export type ArrowType =
  | 'produces'    // prompt → result
  | 'requires'    // code → tool_setup
  | 'references'  // block → block
  | 'compares'    // prompt A → comparison ← prompt B
  | 'validates'   // evaluation → prompt
  | 'branches'    // decision → block A or block B
  | 'follows'     // step N → step N+1
  | 'overrides'   // technique B supersedes A
  | 'explains'    // tutorial_step → block
  | 'custom';

export interface BlockArrow {
  id: string;
  fromBlockId: string;
  toBlockId: string;
  fromEdge: 'top' | 'right' | 'bottom' | 'left';
  toEdge: 'top' | 'right' | 'bottom' | 'left';
  label: string | null;
  arrowType: ArrowType;
  color: string;     // derived from arrowType
  waypoints?: { x: number; y: number }[];   // user-placed waypoints for manual routing
  toBlockIds?: string[];                     // multi-target arrow fan-out
}

// ─── Stage (numbered section / chapter) ──────────
export interface CanvasStage {
  id: string;
  contentId: string;
  stageNumber: number;    // 1, 2, 3…
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
  difficulty: 'beginner' | 'intermediate'
    | 'advanced' | null;
  blockIds: string[];     // ordered, reading sequence
  colour: string;         // subtle bg tint for this zone
}

// ─── Canvas-positioned block ──────────────────────
// All existing ContentBlock fields plus canvas fields
export interface CanvasBlock {
  id: string;
  type: string;           // block_type
  textContent: string;
  subheading: string | null;
  position: BlockPosition;
  stageId: string | null;
  stageIndex: string | null;  // '1a', '1b', '2a'…
  isLocked: boolean;
  lockType: 'none' | 'blur' | 'premium';
  mobileOrder: number | null;
  creatorAnnotation: string | null;
  // All other ContentBlock fields (prompt, code,
  // image, result, comparison, etc.) carry through
  // from the existing ContentBlock interface.
  [key: string]: any;
}

// ─── Arrow type metadata ──────────────────────────
export const ARROW_TYPE_META: Record<
  ArrowType,
  { label: string; color: string; dash: string }
> = {
  produces:   { label: 'produces',
    color: '#E8571A', dash: 'none' },
  requires:   { label: 'requires',
    color: '#3B82F6', dash: '6,3' },
  references: { label: 'references',
    color: 'rgba(255,255,255,0.35)', dash: '4,4' },
  compares:   { label: 'compares',
    color: '#7C3AED', dash: 'none' },
  validates:  { label: 'validates',
    color: '#22C55E', dash: '8,3' },
  branches:   { label: 'branches',
    color: '#F59E0B', dash: 'none' },
  follows:    { label: 'follows',
    color: 'rgba(255,255,255,0.25)', dash: '2,4' },
  overrides:  { label: 'overrides',
    color: '#EC4899', dash: 'none' },
  explains:   { label: 'explains',
    color: '#2EC4B6', dash: '6,3' },
  custom:     { label: 'custom',
    color: 'rgba(255,255,255,0.40)', dash: '4,4' },
};

// ─── Canvas layout mode ───────────────────────────
export type CanvasLayoutMode = 'freeform' | 'pipeline';

// ─── Full canvas document state ───────────────────
export interface CanvasDocument {
  contentId: string;
  columnCount: number;    // default 12
  rowHeight: number;      // px per row unit, default 32
  dotSpacing: number;     // grid dot spacing px, default 32
  layoutMode: CanvasLayoutMode;
  blocks: CanvasBlock[];
  arrows: BlockArrow[];
  stages: CanvasStage[];
  canvasTheme: 'blueprint' | 'terminal'
    | 'research' | 'default';
}

// ─── Canvas mode ──────────────────────────────────
export type CanvasMode = 'edit' | 'view';
