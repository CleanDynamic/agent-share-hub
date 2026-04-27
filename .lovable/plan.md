# Plan: Wire block insertion when a stage is open in full mode

The previous attempt at this prompt was incomplete: `src/lib/blockInsertion.ts` was never created, `WorkspaceShell` doesn't pass any handler to `BlockLibraryTool`, `BlockLibraryTool` has no `onBlockClick` prop, and `StageCanvas` has no drop handlers. This plan completes all four parts of the original spec.

## What gets built

### 1. New file: `src/lib/blockInsertion.ts`

A small shared module exposing:

- `BLOCK_TYPE_ACCENT: Record<BlockType, string>` — accent colors mirroring the Block Library palette, used by both the ghost-preview and (later) other consumers.
- `insertBlockInStage(stageId, type, opts?)` — creates a `Block`, calls `documentStore.addBlock`, sets selection to the new block, and registers it as "newly created" so the canvas can play the scale-in.
  - **Click placement** (no `position` passed): auto-place using `x = (count * 240) % canvasWidth`, `y = 100 + floor(count / cols) * 160`, with `cols = max(1, floor(canvasWidth / 240))`, `canvasWidth = 1200` default.
  - **Drop placement** (explicit `position` passed): use given `x, y` (caller already snapped).
  - Default size: 220×120. Default `name`: capitalized type. Default `properties: {}`, `locked: false`, `z_index: 0`.
- `markBlockNewlyCreated(blockId)` / `isBlockNewlyCreated(blockId)` / `subscribeNewlyCreated(listener)` — tiny in-memory set with subscribers; entries auto-clear after 250ms (long enough to outlast the 200ms animation).

### 2. `BlockLibraryTool` — accept `onBlockClick`

- Add `onBlockClick?: (blockType: string) => void` to props and forward to each `BlockCard`.
- `BlockCard` gets a single-click handler that calls `onBlockClick`. Drag and double-click handlers stay as-is.
- Update the bottom hint text to `"Click or drag a block to add it"` so the click affordance is discoverable. (Visual styling unchanged.)

### 3. `WorkspaceShell` — provide the click handler

- Subscribe to `documentStore.stageOpen` to find the currently-open stage id (`Object.keys(stageOpen).find((id) => stageOpen[id])`).
- Define `handleLibraryClick(type)`: if no stage is open, no-op. Otherwise call `insertBlockInStage(openStageId, type)`.
- Render `<BlockLibraryTool onBlockClick={handleLibraryClick} />` instead of the bare component.

### 4. `StageCanvas` — drag-to-place + ghost preview

- Wrap the existing `<ReactFlow>` in a `ReactFlowProvider` (needed so `useReactFlow().screenToFlowPosition` works inside the canvas component). Split into a thin outer `StageCanvas` that provides, and an inner `StageCanvasInner` that consumes.
- Add local `ghost` state: `{ x, y, type } | null`.
- `onDragOver(e)`: if `dataTransfer.types.includes('application/x-block-type')`, `e.preventDefault()`, set `dropEffect = 'copy'`, compute flow coords via `screenToFlowPosition({ x: e.clientX, y: e.clientY })`, snap each axis to nearest 20px, update `ghost`. Read the dragged block's type defensively from a module-level `currentDragType` ref set by `BlockCard.onDragStart` (since `dataTransfer.getData` is empty during dragover in most browsers).
- `onDrop(e)`: read `application/x-block-type`, snap, call `insertBlockInStage(stageId, type, { position: { x, y } })`, clear `ghost`.
- `onDragLeave`: clear `ghost`.
- Ghost element: an absolutely-positioned 220×120 div, dashed 1px border in the type's accent color at 0.4 opacity, transformed by the React Flow viewport. Render inside the React Flow viewport via a small overlay div using `useReactFlow().getViewport()` to translate, OR render in CSS coords by converting flow→screen with `flowToScreenPosition`. Use the screen-coord approach to avoid React Flow internals.
- The currently used `currentDragType` module ref lives in `blockInsertion.ts` (`setDragType` / `getDragType` / `clearDragType`); `BlockCard.handleDragStart` sets it, `onDrop`/`dragend` clears it.

### 5. Scale-in animation

- Pick the smallest possible surface: wrap each registered block component (e.g. `PromptBlockNode`, `TextBlockNode`, etc.) is too many files. Instead, add the wrapper at the React Flow level by injecting a CSS class on `Node.className` when `isBlockNewlyCreated(block.id)` returns true at render time. The class `.block-scale-in` is defined in the existing `<style>` block inside `StageCanvas` and applies `@keyframes` from 0.96 → 1.0 over 200ms.
- `StageCanvasInner` subscribes to `subscribeNewlyCreated` to force a re-render so the class actually paints (since the in-memory set is outside Zustand).

### 6. Selection auto-switch override (already in place)

- `WorkspaceShell` already gates the selection effect behind `stageOpenRef.current` (lines 122–131). After insertion, `setSelection({ kind: 'block', ids: [newId] })` will fire but the effect skips. The active tool stays on Library. ✓ Confirmed by reading current code.

### 7. Defensive no-op when no stage is open

- `handleLibraryClick` early-returns if `openStageId` is null.
- `BlockLibraryTool` itself is hidden in article mode (Prompt 5 wiring already in place), so this is belt-and-suspenders.
- Drag from a card while no stage is open: `onDragOver` won't be called on the canvas (canvas isn't mounted), and dropping anywhere else does nothing because no other surface accepts `application/x-block-type`.

## Files touched

```text
src/lib/blockInsertion.ts                              (NEW)
src/components/workspace/tools/BlockLibraryTool.tsx   (add onBlockClick prop, update hint text)
src/components/workspace/WorkspaceShell.tsx           (pass handleLibraryClick to library)
src/components/article/stage/StageCanvas.tsx          (ReactFlowProvider split, drop handlers, ghost, scale-in CSS, newly-created subscription)
```

No other component is touched. Block Library visuals, canvas pan/zoom, and existing node renderers stay exactly as-is.

## Out of scope (intentionally)

- No persistence beyond the existing `documentStore.addBlock` (it already adds to `dirty` for the autosave loop).
- No multi-stage drop targeting — drops are only handled inside the open stage's canvas.
- No keyboard insertion path (`/` palette is a separate prompt).
