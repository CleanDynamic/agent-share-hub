import { create } from 'zustand';

export type WorkspaceToolId =
  | 'nav'
  | 'inspector'
  | 'library'
  | 'outline'
  | 'comments'
  | 'versions';

export interface WorkspaceState {
  activeTool: WorkspaceToolId;
  toolState: Record<WorkspaceToolId, unknown>;
  /**
   * True when a stage grid is currently expanded into full mode. Drives
   * the workspace tab rail's order, the visibility of the Block Library
   * tab, and which tool is active by default.
   */
  stageOpen: boolean;

  setActiveTool: (toolId: WorkspaceToolId) => void;
  getToolState: (toolId: WorkspaceToolId) => unknown;
  setToolState: (toolId: WorkspaceToolId, state: unknown) => void;

  /** Notify the workspace that a stage entered full mode. */
  setStageOpen: (open: boolean) => void;
}

const initialToolState: Record<WorkspaceToolId, unknown> = {
  inspector: undefined,
  library: undefined,
  outline: undefined,
  comments: undefined,
  versions: undefined,
};

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  activeTool: 'inspector',
  toolState: initialToolState,
  stageOpen: false,

  setActiveTool: (toolId) => set({ activeTool: toolId }),

  getToolState: (toolId) => get().toolState[toolId],

  setToolState: (toolId, state) =>
    set((prev) => ({
      toolState: { ...prev.toolState, [toolId]: state },
    })),

  setStageOpen: (open) =>
    set((prev) => {
      if (open) {
        // Entering full mode → Block Library becomes the default tool.
        return { stageOpen: true, activeTool: 'library' };
      }
      // Leaving full mode → drop back to Inspector. Library is no longer
      // available in the rail, so anyone parked on it must move.
      const nextActive: WorkspaceToolId =
        prev.activeTool === 'library' ? 'inspector' : prev.activeTool;
      return { stageOpen: false, activeTool: nextActive };
    }),
}));
