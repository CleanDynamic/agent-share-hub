// tabSync: tabs of the same build hear of each other's writes (CA-23 P4). No React in here.
//
// Each tab makes an id when it loads. Every write it makes is announced on a BroadcastChannel named `bg-build-{buildId}` with
// the ids of the rows it changed (the build's own id for its row; a node's id; a session's key; a picture's id), and every tab
// of that build hears the others. A tab never hears itself. A browser without BroadcastChannel hears nothing and is none the
// worse: a write that would undo another's is still refused by `staleWrites`, which does not depend on this.

export const TAB_ID: string = `tab-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const channelName = (buildId: string): string => `bg-build-${buildId}`;

export interface TabMessage {
  tab: string;
  buildId: string;
  rows: string[];
  at: number;
}

export interface BuildChannel {
  announce: (rows: readonly string[]) => void;
  subscribe: (listener: (message: TabMessage) => void) => () => void;
  close: () => void;
}

/** When each row was last changed by another tab, as far as this tab has heard. */
export const rowTimes = new Map<string, number>();

type Make = (name: string) => BroadcastChannel | null;
const real: Make = (name) => (typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(name));

export function openBuildChannel(buildId: string, make: Make = real, tab: string = TAB_ID): BuildChannel {
  const channel = make(channelName(buildId));
  const listeners = new Set<(message: TabMessage) => void>();
  const onMessage = (event: MessageEvent) => {
    const data = event.data as Partial<TabMessage> | null;
    if (!data || typeof data !== "object" || data.tab === tab || data.buildId !== buildId || !Array.isArray(data.rows)) return;
    const message: TabMessage = { tab: String(data.tab), buildId, rows: data.rows.map(String), at: typeof data.at === "number" ? data.at : Date.now() };
    for (const row of message.rows) rowTimes.set(row, message.at);
    for (const listener of [...listeners]) listener(message);
  };
  channel?.addEventListener("message", onMessage);
  return {
    announce: (rows) => {
      if (!channel || rows.length === 0) return;
      channel.postMessage({ tab, buildId, rows: [...new Set(rows)], at: Date.now() } satisfies TabMessage);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    close: () => {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      listeners.clear();
    },
  };
}

/* ── which rows a write changed ── */

const idsIn = (filter: string | null): string[] => {
  if (!filter) return [];
  const eq = /^eq\.(.+)$/.exec(filter);
  if (eq) return [eq[1]];
  const list = /^in\.\((.*)\)$/.exec(filter);
  return list ? list[1].split(",").map((id) => id.replace(/^"|"$/g, "")).filter(Boolean) : [];
};

/** The ids of the rows a write to the composer's tables changed: from its address and its body. Pure. */
export function rowsChanged(method: string, url: string, body: string | null): string[] {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://local.invalid");
  } catch {
    return [];
  }
  const target = /\/rest\/v1\/(rpc\/)?([^/?]+)/.exec(parsed.pathname);
  if (!target) return [];
  const name = target[2];
  if (target[1]) {
    if (name !== "set_build_post_media") return [];
    try {
      const args = body ? (JSON.parse(body) as { p_build_id?: unknown }) : {};
      return typeof args.p_build_id === "string" ? [args.p_build_id] : [];
    } catch {
      return [];
    }
  }
  const ids: string[] = [];
  if (method === "POST" || method === "PUT") {
    try {
      const rows: unknown = body ? JSON.parse(body) : [];
      for (const row of Array.isArray(rows) ? rows : [rows]) {
        if (!row || typeof row !== "object") continue;
        const entry = row as { id?: unknown; session_key?: unknown };
        if (name === "build_sessions" && typeof entry.session_key === "string") ids.push(entry.session_key);
        else if (typeof entry.id === "string") ids.push(entry.id);
      }
    } catch {
      /* not JSON */
    }
  } else {
    ids.push(...idsIn(parsed.searchParams.get(name === "build_sessions" ? "session_key" : "id")));
  }
  return ids;
}
