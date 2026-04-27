# Fix fullscreen stage: swap, don't overlay

The current "full mode" renders a `position: fixed` overlay from inside the TipTap node, while the article editor (header, toolbar, writing canvas, action row, status bar) stays mounted underneath. Result: blocks visibly overlap the editor and the editor still claims focus/scroll.

The fix is structural: at the middle-panel level, conditionally render either the article editor or a new `<StageFullscreen>`. Nothing overlays anything.

## What the user will experience

- Click a stage thumbnail → the middle panel's content is replaced. Article editor (header strip, TipTap toolbar, writing canvas, Insert Grid / Save / Publish row, bottom status strip) is gone — not hidden, unmounted. The middle panel itself (background, border-radius, padding) is unchanged. Left nav and right workspace panel keep working.
- The replacement surface: thin top strip with a single "Back to article" button on the left, dot-grid React Flow canvas filling the centre, thin bottom bar with zoom −/100%/+, fit-view, and minimap-toggle controls right-aligned.
- Press **Esc** or click **Back to article** → article editor re-mounts with all state intact, and the page smooth-scrolls to the thumbnail of the stage that was just open.
- Right workspace panel still auto-reorders to put Block Library first while a stage is open (behaviour from Prompt 5 unchanged — only the trigger wiring changes).

## Implementation

### 1. New file: `src/components/article/stage/StageFullscreen.tsx`

Props: `{ stageId: string; onClose: () => void }`.

Layout (single column, `height: 100%`, `display: flex; flex-direction: column`):

- **Top strip** — 44px tall, `padding: 8px 14px`, transparent, `border-bottom: 0.5px solid rgba(255,255,255,0.06)`. Contains only the "Back to article" button (left-aligned, lucide `ArrowLeft` 14px, label "Back to article" Inter 12px/500 `rgba(255,255,255,0.75)`, bg `rgba(255,255,255,0.04)`, border `0.5px solid rgba(255,255,255,0.06)`, `border-radius: 6px`, `padding: 6px 10px`, `gap: 6px`; hover bg `rgba(255,255,255,0.08)`). Clicking calls `onClose`.
- **Canvas body** — `flex: 1; min-height: 0`. Renders the existing React Flow canvas via the new `<StageCanvasInner stageId={stageId} />` (see §3). No overlaid frame, no name header, no Templates button.
- **Bottom bar** — 36px tall, `padding: 6px 14px`, transparent, `border-top: 0.5px solid rgba(255,255,255,0.06)`, `display: flex; justify-content: flex-end; align-items: center; gap: 0`. In order:
  - Zoom group: `−` icon button (lucide `Minus` 12px), label `100%` (Inter 11px/500 `rgba(255,255,255,0.70)`, `font-variant-numeric: tabular-nums`, `min-width: 36px; text-align: center`), `+` icon button (lucide `Plus` 12px). Each button 24px square, `border-radius: 5px`, hover bg `rgba(255,255,255,0.06)`. `−`/`+` call `zoomTo(clamp(currentZoom ± 0.1, 0.25, 2))` using `useReactFlow().getViewport()` and `setViewport` (or `zoomIn/zoomOut` with `duration: 0`). Label reflects the current zoom rounded to whole percent; subscribe via `useOnViewportChange`.
  - 1px vertical divider, height 16px, `rgba(255,255,255,0.06)`, `margin: 0 8px`.
  - Fit-view icon button (lucide `Maximize` 14px, `rgba(255,255,255,0.70)`). Click → `fitView({ padding: 0.15, duration: 200 })`.
  - 1px divider (same).
  - Minimap toggle (lucide `Map` 14px). Local `useState` boolean. When active: icon `#E8571A`, bg `rgba(232,87,26,0.10)`. Active state passed down to render React Flow's `<MiniMap />` inside the canvas.

`StageFullscreen` itself wraps everything in **one** `<ReactFlowProvider>` so the bottom-bar hooks share the same React Flow store as the canvas.

Esc key: `useHotkeys('esc', onClose, { enabled: true })` from `react-hotkeys-hook` (already a dep).

### 2. Middle-panel wiring — `src/pages/Upload.tsx`

`openStageId` already lives here as React state but is currently fed by event-bus listeners. Switch the source of truth to the document store:

- Replace the local `useState<string | null>(null)` + `eventBus.on('stage:opened' / 'stage:closed')` block with a derived value:
  ```ts
  const stageOpenMap = useDocumentStore((s) => s.stageOpen);
  const openStageId = useMemo(
    () => Object.keys(stageOpenMap).find((id) => stageOpenMap[id]) ?? null,
    [stageOpenMap],
  );
  ```
- Inside the `data-editor-middle-panel` container, conditionally render:
  - `openStageId === null` → existing `CanvasHeader` + `ArticleEditor` block (drop the `display: none` wrapper around `CanvasHeader`; it's no longer needed).
  - `openStageId !== null` → `<StageFullscreen stageId={openStageId} onClose={() => useDocumentStore.getState().closeStage()} />` only. The header/editor JSX is not in the tree.
- Scroll-to-thumbnail on close: `useEffect` watching `openStageId`. When it transitions from a string `prev` to `null`, `setTimeout(() => document.querySelector('[data-stage-id="' + prev + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)`.

### 3. `src/components/article/stage/StageCanvas.tsx` — minimal additive change

Today the file exports `StageCanvas`, which internally wraps `StageCanvasInner` in its own `ReactFlowProvider`. To let `StageFullscreen` own the provider (so its bottom-bar hooks can drive zoom/fit), also `export` the existing `StageCanvasInner`. Behaviour unchanged for current callers; `StageFullscreen` imports `StageCanvasInner` directly. Optional `<MiniMap />` is rendered inside `StageCanvasInner` only if `StageFullscreen` injects it via a new optional `overlay?: ReactNode` prop on `StageCanvasInner` — this keeps the React Flow viewport/store unified. (No other behaviour changes.)

### 4. `src/components/article/StageGridNode.tsx` — strip the overlay

- Delete the entire fullscreen branch (lines that render `data-stage-fullscreen-portal` + `<FullStageOverlay>`) and the `FullStageOverlay` component.
- Always render the `StageThumbnail` branch (when not open, identical to today; when open, the thumbnail still mounts in document flow so `scrollIntoView` has a target — `StageFullscreen` covers it via the middle-panel swap, so this is fine and matches step 8 of the spec).
- `handleOpen` still calls `openStageAction(stageId)` (the document store). Drop the `eventBus.emit('stage:opened' / 'stage:closed')` calls and the local Esc keydown handler — Esc is now owned by `StageFullscreen`. The cleanup-emit on unmount is also removed.

### 5. Workspace tab logic — `src/components/workspace/WorkspaceShell.tsx`

Per spec step 6, only the trigger source changes. Replace the event-bus subscription with a derived subscription to the document store:

```ts
const stageOpenMap = useDocumentStore((s) => s.stageOpen);
const docStageOpen = useMemo(
  () => Object.values(stageOpenMap).some(Boolean),
  [stageOpenMap],
);
useEffect(() => { setStageOpen(docStageOpen); }, [docStageOpen, setStageOpen]);
```

Remove the `eventBus.on('stage:opened' / 'stage:closed')` effect. Everything downstream (`STAGE_MODE_ORDER`, Library auto-active, return-to-Inspector on close) already derives from `useWorkspaceStore.stageOpen` and is unchanged.

### 6. Cleanup

- `src/lib/eventBus.ts`: leave `'stage:opened' / 'stage:closed'` in the type map (low-risk, no remaining emitters/subscribers after the changes above). No new emitters.

## Files touched

- **new** `src/components/article/stage/StageFullscreen.tsx`
- `src/pages/Upload.tsx` — swap conditional rendering in the middle panel; derive `openStageId` from the store; add scroll-on-close effect.
- `src/components/article/StageGridNode.tsx` — remove fullscreen overlay branch and `FullStageOverlay`; remove event-bus emits and local Esc handler.
- `src/components/article/stage/StageCanvas.tsx` — additive: export `StageCanvasInner`; add optional `overlay` slot for the MiniMap.
- `src/components/workspace/WorkspaceShell.tsx` — replace event-bus stage subscription with a `useDocumentStore` derived effect.

Not touched (per spec): `StageThumbnail`, `ArticleEditor`, the rest of the workspace tab logic.
