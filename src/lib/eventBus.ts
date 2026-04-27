import { useEffect, useRef } from "react";

// ─── Event map ────────────────────────────────────
// Payload types keyed by event name. Use `void` for events with no payload.
export type EventMap = {
  "block:run:start": { blockId: string };
  "block:run:complete": { blockId: string; result: unknown };
  "block:run:error": { blockId: string; error: unknown };
  "arrow:data-flow": {
    connectionId: string;
    sourceId: string;
    targetId: string;
    data: unknown;
  };
  "selection:change": { blockIds: readonly string[]; arrowIds: readonly string[] };
  "command-palette:open": void;
  "focus-mode:toggle": void;
  "outline:scroll-to": { targetId: string };
  "stage:opened": { stageId: string };
  "stage:closed": { stageId: string };
  "canvas:fit-needed": { stageId?: string };
  "block:expand-toggle": { blockId: string };
};

export type EventName = keyof EventMap;

// Discriminated union view of every event, tagged by `type`.
export type EventBusEvent = {
  [K in EventName]: EventMap[K] extends void
    ? { type: K }
    : { type: K } & EventMap[K];
}[EventName];

type Listener<K extends EventName> = (payload: EventMap[K]) => void;
type EmitArgs<K extends EventName> = EventMap[K] extends void
  ? []
  : [EventMap[K]];

const listeners = new Map<EventName, Set<Listener<EventName>>>();

function on<K extends EventName>(eventName: K, callback: Listener<K>): () => void {
  let set = listeners.get(eventName);
  if (!set) {
    set = new Set();
    listeners.set(eventName, set);
  }
  set.add(callback as Listener<EventName>);
  return () => {
    set!.delete(callback as Listener<EventName>);
    if (set!.size === 0) listeners.delete(eventName);
  };
}

function emit<K extends EventName>(eventName: K, ...args: EmitArgs<K>): void {
  const set = listeners.get(eventName);
  if (!set) return;
  const payload = args[0] as EventMap[K];
  // Snapshot so listeners can unsubscribe during dispatch without skipping siblings.
  for (const cb of [...set]) {
    (cb as Listener<K>)(payload);
  }
}

export const eventBus = { emit, on };

export function useEvent<K extends EventName>(
  eventName: K,
  callback: Listener<K>,
): void {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => eventBus.on(eventName, (p) => ref.current(p)), [eventName]);
}
