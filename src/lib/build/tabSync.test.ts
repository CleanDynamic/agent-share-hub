// CA-23 P4: tabs tell each other which rows they changed; a tab never hears itself; the rows a write changed are read from it.

import { describe, expect, it, vi } from "vitest";

import { channelName, openBuildChannel, rowsChanged, rowTimes, TAB_ID, type TabMessage } from "./tabSync";

/** BroadcastChannel in miniature: every instance of a name hears the others, not itself. */
class Fake {
  static all = new Map<string, Set<Fake>>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners = new Set<(event: MessageEvent) => void>();
  constructor(readonly name: string) {
    Fake.all.set(name, (Fake.all.get(name) ?? new Set()).add(this));
  }
  postMessage(data: unknown) {
    for (const other of Fake.all.get(this.name) ?? []) if (other !== this) for (const listener of other.listeners) listener({ data } as MessageEvent);
  }
  addEventListener(_: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  close() {
    Fake.all.get(this.name)?.delete(this);
  }
}
const make = (name: string) => new Fake(name) as unknown as BroadcastChannel;

describe("the channel", () => {
  it("is named bg-build-{buildId}", () => {
    expect(channelName("b1")).toBe("bg-build-b1");
    expect(new Set([...Fake.all.keys()])).toBeDefined();
  });

  it("has an id of its own for each tab", () => {
    expect(TAB_ID).toMatch(/^tab-/);
  });

  it("tells the other tabs of a build which rows a write changed, and not itself", () => {
    const a = openBuildChannel("b1", make, "tab-a");
    const b = openBuildChannel("b1", make, "tab-b");
    const heardByA = vi.fn();
    const heardByB = vi.fn();
    a.subscribe(heardByA);
    b.subscribe(heardByB);
    a.announce(["n1", "n2", "n1"]);
    expect(heardByA).not.toHaveBeenCalled();
    expect(heardByB).toHaveBeenCalledTimes(1);
    const message = heardByB.mock.calls[0][0] as TabMessage;
    expect(message).toMatchObject({ tab: "tab-a", buildId: "b1", rows: ["n1", "n2"] });
    expect(typeof message.at).toBe("number");
    expect(rowTimes.get("n1")).toBe(message.at);
    a.close();
    b.close();
  });

  it("keeps the builds apart", () => {
    const a = openBuildChannel("b1", make, "tab-a");
    const other = openBuildChannel("b2", make, "tab-c");
    const heard = vi.fn();
    other.subscribe(heard);
    a.announce(["n1"]);
    expect(heard).not.toHaveBeenCalled();
  });

  it("announces nothing for no rows, and does nothing where there is no BroadcastChannel", () => {
    const a = openBuildChannel("b1", make, "tab-a");
    const b = openBuildChannel("b1", make, "tab-b");
    const heard = vi.fn();
    b.subscribe(heard);
    a.announce([]);
    expect(heard).not.toHaveBeenCalled();
    const none = openBuildChannel("b1", () => null);
    expect(() => none.announce(["x"])).not.toThrow();
    none.close();
  });

  it("ignores a message that is not one", () => {
    const b = openBuildChannel("b9", make, "tab-b");
    const heard = vi.fn();
    b.subscribe(heard);
    const raw = make("bg-build-b9") as unknown as Fake;
    raw.postMessage("nonsense");
    raw.postMessage({ tab: "x", buildId: "other", rows: ["1"] });
    expect(heard).not.toHaveBeenCalled();
  });
});

describe("rowsChanged", () => {
  const rest = "https://x.supabase.co/rest/v1";
  it("reads the build's own row from its address", () => {
    expect(rowsChanged("PATCH", `${rest}/builds?id=eq.b1&select=id`, '{"title":"x"}')).toEqual(["b1"]);
  });
  it("reads node ids from the body of an upsert, and from the address of a delete", () => {
    expect(rowsChanged("POST", `${rest}/build_nodes?on_conflict=id`, JSON.stringify([{ id: "n1" }, { id: "n2" }]))).toEqual(["n1", "n2"]);
    expect(rowsChanged("DELETE", `${rest}/build_nodes?id=eq.n9`, null)).toEqual(["n9"]);
    expect(rowsChanged("DELETE", `${rest}/build_nodes?id=in.(n1,n2)`, null)).toEqual(["n1", "n2"]);
  });
  it("reads a session's key", () => {
    expect(rowsChanged("POST", `${rest}/build_sessions`, JSON.stringify({ build_id: "b1", session_key: "s1" }))).toEqual(["s1"]);
    expect(rowsChanged("PATCH", `${rest}/build_sessions?build_id=eq.b1&session_key=eq.s2`, "{}")).toEqual(["s2"]);
  });
  it("reads the build from the function that sets the post's pictures, and nothing from other calls", () => {
    expect(rowsChanged("POST", `${rest}/rpc/set_build_post_media`, JSON.stringify({ p_build_id: "b1", p_media_ids: [] }))).toEqual(["b1"]);
    expect(rowsChanged("POST", `${rest}/rpc/gallery_facets`, "{}")).toEqual([]);
    expect(rowsChanged("POST", "not a url at all", "{}")).toEqual([]);
  });
});
