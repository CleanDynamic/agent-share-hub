# Foundations

Reference for the document-editor runtime: one Zustand store, one persistence
worker, one event bus, one selection model. All modules live under `src/lib`
(except the selection hook under `src/hooks`) and import through the `@/` alias.

## Document store shape

The store is a single Zustand store with `immer` middleware, defined in
`src/lib/documentStore.ts` and exported as `useDocumentStore`. Entity
collections are keyed by id (plain objects, not `Map`s) so immer can produce
structural updates and React selectors stay cheap.

```ts
interface DocumentState {
  documentId: string | null;
  articleBody: unknown;                            // Tiptap JSON for the prose body
  stages: Record<string, Stage>;
  blocks: Record<string, Block>;
  connections: Record<string, Connection>;
  selection: Selection;                            // { kind, ids, range? }
  focusMode: 'edit' | 'view' | 'focus';
  dirty: Set<string>;                              // entity ids awaiting persist
  presence: Record<string, PresenceEntry>;         // keyed by userId

  // Actions
  loadDocument, setArticleBody,
  addStage, updateStage, removeStage,
  addBlock, updateBlock, removeBlock, moveBlock,
  addConnection, updateConnection, removeConnection,
  setSelection, clearSelection,
  setFocusMode,
  markDirty, clearDirty,
}
```

`Stage`, `Block`, `Connection` are defined in `src/types/document.ts` and
mirror the Supabase schema. `Selection` is `{ kind: SelectionKind, ids: string[], range?: unknown }` where `kind` is one of `none | prose | block | stage | arrow | multi`.

Mutating actions automatically add the affected id to `dirty`. `removeStage`
cascades to blocks on that stage; `removeBlock` cascades to connections that
reference it. Both mark every cascaded id dirty.

## Reading state from a component

Use `useDocumentStore` with a selector. Keep selectors narrow — components only
re-render when the selected slice changes. Action functions have stable
references, so selecting them with `(s) => s.fn` is safe.

```tsx
import { useDocumentStore } from '@/lib/documentStore';

export function StageList() {
  const stages = useDocumentStore((s) => s.stages);
  const focusMode = useDocumentStore((s) => s.focusMode);

  return (
    <ul data-focus-mode={focusMode}>
      {Object.values(stages)
        .sort((a, b) => a.order_in_document - b.order_in_document)
        .map((stage) => (
          <li key={stage.id}>{stage.stage_name ?? 'Untitled'}</li>
        ))}
    </ul>
  );
}
```

For one-shot reads outside render (event handlers, effects), use
`useDocumentStore.getState()`.

## Updating state

Grab the action off the store and call it. Patches are shallow
`Object.assign`ed into the target entity; nested objects (e.g. `block.properties`)
should be replaced wholesale. Actions are no-ops if the target id doesn't
exist.

```tsx
import { useDocumentStore } from '@/lib/documentStore';

export function StageHeader({ stageId }: { stageId: string }) {
  const name = useDocumentStore((s) => s.stages[stageId]?.stage_name ?? '');
  const updateStage = useDocumentStore((s) => s.updateStage);

  return (
    <input
      value={name}
      onChange={(e) => updateStage(stageId, { stage_name: e.target.value })}
    />
  );
}

// For block drags, prefer the specialized action — it only touches position
// fields, which keeps the diff in the fast "position" persistence pipeline.
useDocumentStore.getState().moveBlock(blockId, nextX, nextY);
```

You do **not** need to call `markDirty` yourself — every mutating action does
it. Use `markDirty` / `clearDirty` only for hand-rolled cases (e.g. reconciling
after a server-driven insert).

## Persistence layer

`src/lib/documentPersistence.ts` is a singleton that subscribes to the store
and flushes dirty entities to Supabase. Mount it once at the editor root:

```tsx
import { useDocumentPersistence, usePersistenceStatus } from '@/lib/documentPersistence';

export function EditorRoot() {
  useDocumentPersistence();            // mount subscription (ref-counted)
  const { saveStatus, lastSavedAt } = usePersistenceStatus();
  return <SaveIndicator status={saveStatus} at={lastSavedAt} />;
}
```

Behavior:

- **Two pipelines**: block-position-only edits flush every **100ms**; all other
  edits (inserts, deletes, property changes, stages, connections, article body)
  flush every **400ms**. Classification compares the current block to the last
  synced snapshot — if only `position_x`/`position_y` differ, it rides the fast
  lane.
- **Optimistic writes**: the store is already updated; the layer replays the
  diff to Supabase. Inserts use `upsert`; deletes compare to the last synced
  snapshot and run connections → blocks → stages order.
- **Version guard**: every batch ends with a conditional update on
  `content_items.document_version` (expected = current, new = current + 1). A
  zero-row response means another client won the race — `saveStatus` becomes
  `error` and a sonner toast prompts the user to refresh.
- **Offline**: `online`/`offline` listeners set status to `offline` and replay
  pending work on reconnect.
- **Status**: `usePersistenceStatus()` exposes `saveStatus: 'saved' | 'saving' | 'error' | 'offline'` and `lastSavedAt: Date | null` — read from any component without importing the persistence internals.
- **Tests**: `__resetPersistenceForTests()` tears down the subscription and resets module state.

## Event bus

`src/lib/eventBus.ts` is a strongly-typed pub/sub for cross-cutting signals
that shouldn't live in the store (transient runs, palette toggles, outline
scrolls). Event names and payloads are declared in `EventMap`; adding a new
event means adding a key there.

```ts
// Current events
'block:run:start'       { blockId }
'block:run:complete'    { blockId, result }
'block:run:error'       { blockId, error }
'arrow:data-flow'       { connectionId, data }
'selection:change'      { blockIds, arrowIds }
'command-palette:open'  void
'focus-mode:toggle'     void
'outline:scroll-to'     { targetId }
```

Emit from anywhere:

```ts
import { eventBus } from '@/lib/eventBus';

eventBus.emit('block:run:start', { blockId });
eventBus.emit('command-palette:open');            // void payload → no second arg
```

Subscribe inside a component with `useEvent` (auto-unsubscribes on unmount and
always calls the latest callback):

```tsx
import { useEvent } from '@/lib/eventBus';

function RunIndicator({ blockId }: { blockId: string }) {
  const [running, setRunning] = useState(false);
  useEvent('block:run:start', (p) => { if (p.blockId === blockId) setRunning(true); });
  useEvent('block:run:complete', (p) => { if (p.blockId === blockId) setRunning(false); });
  return running ? <Spinner /> : null;
}
```

Outside React, use `eventBus.on(name, cb)` directly — it returns an
unsubscribe function. Listeners are snapshotted at dispatch time, so a
listener that unsubscribes during its own callback won't skip siblings.

## Selection model

Selection is a single `{ kind, ids, range? }` value on the store. Only one
kind is active at a time: selecting a block clears a prose range, selecting
prose clears block ids. Use the `useSelection` hook
(`src/hooks/useSelection.ts`) rather than touching `setSelection` directly —
it provides kind-specific helpers and a stable `isSelected` predicate.

```tsx
import { useSelection } from '@/hooks/useSelection';

function BlockChrome({ block }: { block: Block }) {
  const { isSelected, selectBlock, addToSelection, clear } = useSelection();
  const selected = isSelected(block.id);

  return (
    <div
      data-selected={selected}
      onClick={(e) => {
        if (e.shiftKey) addToSelection(block.id, 'block');
        else selectBlock(block.id);
      }}
      onKeyDown={(e) => { if (e.key === 'Escape') clear(); }}
    />
  );
}
```

Helpers: `selectProse(range?)`, `selectBlock(id)`, `selectStage(id)`,
`selectArrow(id)`, `addToSelection(id, kind)` (extends the current selection
if `kind` matches, otherwise replaces it), `clear()`, `isSelected(id)`.

A module-level subscription inside `useSelection.ts` bridges the store to the
event bus: any real change to `selection` emits `selection:change` with
`{ blockIds, arrowIds }`. That emission fires exactly once per change,
independent of how many components use the hook, so downstream consumers
(minimap highlighter, properties panel, keyboard handler) can subscribe
without coordinating.
