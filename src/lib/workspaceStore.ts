import { create } from 'zustand';

export type WorkspaceToolId =
  | 'inspector'
  | 'library'
  | 'outline'
  | 'comments'
  | 'ai'
  | 'versions';

export interface WorkspaceState {
  activeTool: WorkspaceToolId;
  toolState: Record<WorkspaceToolId, unknown>;

  setActiveTool: (toolId: WorkspaceToolId) => void;
  getToolState: (toolId: WorkspaceToolId) => unknown;
  setToolState: (toolId: WorkspaceToolId, state: unknown) => void;
}

const initialToolState: Record<WorkspaceToolId, unknown> = {
  inspector: undefined,
  library: undefined,
  outline: undefined,
  comments: undefined,
  ai: undefined,
  versions: undefined,
};

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  activeTool: 'inspector',
  toolState: initialToolState,

  setActiveTool: (toolId) => set({ activeTool: toolId }),

  getToolState: (toolId) => get().toolState[toolId],

  setToolState: (toolId, state) =>
    set((prev) => ({
      toolState: { ...prev.toolState, [toolId]: state },
    })),
}));
