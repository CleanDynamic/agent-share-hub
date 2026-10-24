// CA-23 P2: "Reconnected. 3 changes saved." once the connection is back and the held writes have landed.

import { describe, expect, it, vi } from "vitest";

import { createConnection } from "./connection";
import { createPendingStore } from "./pendingWrites";
import { RECONNECTED, watchReconnect } from "./reconnect";

function setup() {
  let on = true;
  const handlers: Record<string, Set<() => void>> = { online: new Set(), offline: new Set() };
  const connection = createConnection({
    onLine: () => on,
    ping: async () => on,
    listen: (event, handler) => {
      handlers[event].add(handler);
      return () => void handlers[event].delete(handler);
    },
  });
  connection.start();
  const store = createPendingStore();
  const saved = vi.fn();
  watchReconnect(connection, store, saved);
  return {
    store,
    saved,
    go: (next: boolean) => {
      on = next;
      for (const handler of [...handlers[next ? "online" : "offline"]]) handler();
    },
  };
}

describe("the reconnected notice", () => {
  it("says it once the writes held for the connection have all landed, with how many there were", () => {
    const { store, saved, go } = setup();
    go(false);
    const ends = [store.begin("nodes"), store.begin("nodes"), store.begin("making")];
    go(true);
    expect(saved).not.toHaveBeenCalled();
    ends[0]();
    ends[1]();
    expect(saved).not.toHaveBeenCalled();
    ends[2]();
    expect(saved).toHaveBeenCalledWith(3);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it("says nothing after a stretch offline with nothing to save", () => {
    const { saved, go } = setup();
    go(false);
    go(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it("counts the most that were waiting at once", () => {
    const { store, saved, go } = setup();
    go(false);
    const a = store.begin("nodes");
    const b = store.begin("nodes");
    a();
    go(true);
    b();
    expect(saved).toHaveBeenCalledWith(2);
  });

  it("is worded for one and for many", () => {
    expect(RECONNECTED.saved(3)).toBe("Reconnected. 3 changes saved.");
    expect(RECONNECTED.saved(1)).toBe("Reconnected. 1 change saved.");
  });
});
