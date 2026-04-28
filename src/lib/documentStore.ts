/**
 * documentStore
 *
 * Zustand store (with immer middleware) holding the entire editor state for
 * a document: article body, stages, blocks, connections, selection, focus
 * mode, dirty tracking, and presence.
 *
 * Example usage in a component:
 *
 *   import { useDocumentStore } from '@/lib/documentStore';
 *
 *   function StageList() {
 *     // Read a slice of state
 *     const stages = useDocumentStore((s) => s.stages);
 *     // Grab an action (stable reference)
 *     const addStage = useDocumentStore((s) => s.addStage);
 *
 *     return (
 *       <div>
 *         {Object.values(stages).map((stage) => (
 *           <div key={stage.id}>{stage.stage_name ?? 'Untitled'}</div>
 *         ))}
 *         <button
 *           onClick={() =>
 *             addStage({
 *               id: crypto.randomUUID(),
 *               content_item_id: 'doc-1',
 *               order_in_document: Object.keys(stages).length,
 *               grid_spacing: 20,
 *               background_style: 'dot',
 *               width_mode: 'wide',
 *               height: 360,
 *               stage_name: null,
 *               created_at: new Date().toISOString(),
 *               updated_at: new Date().toISOString(),
 *             })
 *           }
 *         >
 *           Add stage
 *         </button>
 *       </div>
 *     );
 *   }
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { Block, Connection, Stage } from '@/types/document';

enableMapSet();

export type SelectionKind =
  | 'none'
  | 'prose'
  | 'block'
  | 'stage'
  | 'arrow'
  | 'multi';

export interface Selection {
  kind: SelectionKind;
  ids: string[];
  range?: unknown;
}

export type FocusMode = 'edit' | 'view' | 'focus';

export interface PresenceEntry {
  userId: string;
  cursor: unknown;
  selection: unknown;
}

export interface DocumentState {
  documentId: string | null;
  documentTitle: string;
  articleBody: unknown;
  stages: Record<string, Stage>;
  blocks: Record<string, Block>;
  connections: Record<string, Connection>;
  /**
   * Local-only per-stage UI flag. `true` means the stage is currently
   * expanded into full mode in the editor. Not persisted to Supabase —
   * resets to `false` (closed/thumbnail) on every page load. Only one
   * stage can be open at a time.
   */
  stageOpen: Record<string, boolean>;
  selection: Selection;
  focusMode: FocusMode;
  /** 'blueprint' (default — full editor with workspace) or 'blog' (focus-only writing surface). */
  editorMode: 'blueprint' | 'blog';
  dirty: Set<string>;
  presence: Record<string, PresenceEntry>;

  loadDocument: (id: string) => void;
  setDocumentTitle: (title: string) => void;
  setArticleBody: (json: unknown) => void;

  addStage: (stage: Stage) => void;
  updateStage: (id: string, patch: Partial<Stage>) => void;
  removeStage: (id: string) => void;

  /** Open a stage (closes any other open stage). */
  openStage: (id: string) => void;
  /** Close a specific stage (or close whichever is open if no id given). */
  closeStage: (id?: string) => void;

  addBlock: (block: Block) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, x: number, y: number) => void;

  addConnection: (conn: Connection) => void;
  updateConnection: (id: string, patch: Partial<Connection>) => void;
  removeConnection: (id: string) => void;

  setSelection: (sel: Selection) => void;
  clearSelection: () => void;

  setFocusMode: (mode: FocusMode) => void;

  setEditorMode: (mode: 'blueprint' | 'blog') => void;

  markDirty: (id: string) => void;
  clearDirty: (id: string) => void;
}

const emptySelection: Selection = { kind: 'none', ids: [] };

export const useDocumentStore = create<DocumentState>()(
  immer((set) => ({
    documentId: null,
    documentTitle: '',
    articleBody: null,
    stages: {},
    blocks: {},
    connections: {},
    stageOpen: {},
    selection: emptySelection,
    focusMode: 'edit',
    editorMode: 'blueprint',
    dirty: new Set<string>(),
    presence: {},

    loadDocument: (id) =>
      set((state) => {
        state.documentId = id;
        state.documentTitle = '';
        state.articleBody = null;
        state.stages = {};
        state.blocks = {};
        state.connections = {};
        state.stageOpen = {};
        state.selection = { kind: 'none', ids: [] };
        state.focusMode = 'edit';
        state.editorMode = 'blueprint';
        state.dirty = new Set<string>();
        state.presence = {};
      }),

    setDocumentTitle: (title) =>
      set((state) => {
        state.documentTitle = title;
      }),

    setArticleBody: (json) =>
      set((state) => {
        state.articleBody = json;
      }),

    addStage: (stage) =>
      set((state) => {
        state.stages[stage.id] = stage;
        state.dirty.add(stage.id);
      }),

    updateStage: (id, patch) =>
      set((state) => {
        const stage = state.stages[id];
        if (!stage) return;
        Object.assign(stage, patch);
        state.dirty.add(id);
      }),

    removeStage: (id) =>
      set((state) => {
        delete state.stages[id];
        delete state.stageOpen[id];
        for (const block of Object.values(state.blocks)) {
          if (block.stage_id === id) {
            delete state.blocks[block.id];
            state.dirty.add(block.id);
          }
        }
        state.dirty.add(id);
      }),

    openStage: (id) =>
      set((state) => {
        // Only one stage open at a time — close every other.
        const next: Record<string, boolean> = {};
        next[id] = true;
        state.stageOpen = next;
      }),

    closeStage: (id) =>
      set((state) => {
        if (id) {
          delete state.stageOpen[id];
        } else {
          state.stageOpen = {};
        }
      }),

    addBlock: (block) =>
      set((state) => {
        state.blocks[block.id] = block;
        state.dirty.add(block.id);
      }),

    updateBlock: (id, patch) =>
      set((state) => {
        const block = state.blocks[id];
        if (!block) return;
        Object.assign(block, patch);
        state.dirty.add(id);
      }),

    removeBlock: (id) =>
      set((state) => {
        delete state.blocks[id];
        for (const conn of Object.values(state.connections)) {
          if (conn.from_block_id === id || conn.to_block_id === id) {
            delete state.connections[conn.id];
            state.dirty.add(conn.id);
          }
        }
        state.dirty.add(id);
      }),

    moveBlock: (id, x, y) =>
      set((state) => {
        const block = state.blocks[id];
        if (!block) return;
        block.position_x = x;
        block.position_y = y;
        state.dirty.add(id);
      }),

    addConnection: (conn) =>
      set((state) => {
        state.connections[conn.id] = conn;
        state.dirty.add(conn.id);
      }),

    updateConnection: (id, patch) =>
      set((state) => {
        const conn = state.connections[id];
        if (!conn) return;
        Object.assign(conn, patch);
        state.dirty.add(id);
      }),

    removeConnection: (id) =>
      set((state) => {
        delete state.connections[id];
        state.dirty.add(id);
      }),

    setSelection: (sel) =>
      set((state) => {
        state.selection = sel;
      }),

    clearSelection: () =>
      set((state) => {
        state.selection = { kind: 'none', ids: [] };
      }),

    setFocusMode: (mode) =>
      set((state) => {
        state.focusMode = mode;
      }),

    setEditorMode: (mode) =>
      set((state) => {
        state.editorMode = mode;
      }),

    markDirty: (id) =>
      set((state) => {
        state.dirty.add(id);
      }),

    clearDirty: (id) =>
      set((state) => {
        state.dirty.delete(id);
      }),
  })),
);
