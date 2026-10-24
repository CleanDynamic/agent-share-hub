/* CA-23 P2 and P4: put the write guard on the REST client while a build is open in the composer.

   It goes on in a layout effect, so it is there before the first read the page makes (the line kept from an earlier load is
   replayed ahead of that read). Writes kept from an earlier load that no live call is waiting on are counted as pending until
   they have gone.

   P4: each write that goes through is announced to the build's other tabs (`onWritten`); a write held offline keeps what the
   tab knew of its rows, so that after a reload, before it is replayed, it can be compared with what was changed meanwhile. */

import { useLayoutEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { replayBuildPatch } from "@/lib/build/builds";
import { readNodeRows, upsertRows } from "@/lib/build/nodes";
import { pendingWrites } from "@/lib/build/pendingWrites";
import { baseRow, checkRows, knownNodeRow } from "@/lib/build/staleWrites";
import { guardedTarget, installWriteGuard, type HeldWrite } from "@/lib/build/writeGuard";
import type { BuildNode, BuildPatch } from "@/lib/build/types";

export interface WriteGuardHooks {
  /** A write went through (live or replayed): announce it to the other tabs. */
  onWritten?: (write: { method: string; url: string; body: string | null }) => void;
}

const parse = (body: string | null): unknown => {
  try {
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
};

export function useWriteGuard(buildId: string | undefined, hooks: WriteGuardHooks = {}): void {
  const latest = useRef(hooks);
  latest.current = hooks;
  useLayoutEffect(() => {
    if (!buildId) return;
    const baseFor = (write: { method: string; url: string; body: string | null }): Record<string, unknown> | undefined => {
      const target = guardedTarget(write.url);
      const body = parse(write.body);
      if (target?.name === "builds" && write.method === "PATCH" && body && typeof body === "object") {
        const base = baseRow(buildId);
        return Object.keys(base).length > 0 ? Object.fromEntries(Object.keys(body).map((key) => [key, base[key] ?? null])) : undefined;
      }
      if (target?.name === "build_nodes" && write.method === "POST") {
        const rows = (Array.isArray(body) ? body : body ? [body] : []) as { id?: string }[];
        const base: Record<string, unknown> = {};
        for (const row of rows) {
          const known = row.id ? knownNodeRow(buildId, row.id) : undefined;
          if (row.id && known) base[row.id] = known;
        }
        return Object.keys(base).length > 0 ? base : undefined;
      }
      return undefined;
    };

    const beforeReplay = async (held: HeldWrite): Promise<HeldWrite | null> => {
      const target = guardedTarget(held.url);
      const body = parse(held.body);
      if (!held.base || !target || !body) return held;
      if (target.name === "builds" && held.method === "PATCH" && typeof body === "object") {
        // Compared with what is there now; what was changed elsewhere meanwhile is a clash, not overwritten.
        await replayBuildPatch(buildId, body as BuildPatch, held.base);
        return null;
      }
      if (target.name === "build_nodes" && held.method === "POST") {
        const rows = (Array.isArray(body) ? body : [body]) as BuildNode[];
        const bases = new Map(Object.entries(held.base) as [string, BuildNode][]);
        const { write } = await checkRows(buildId, rows, readNodeRows, upsertRows, bases);
        return { ...held, body: JSON.stringify(write) };
      }
      return held;
    };

    const { uninstall } = installWriteGuard(supabase, {
      buildId,
      onChange: ({ orphans }) => pendingWrites.set("queued", orphans),
      onWritten: (write) => latest.current.onWritten?.(write),
      baseFor,
      beforeReplay,
    });
    return () => {
      uninstall();
      pendingWrites.set("queued", 0);
    };
  }, [buildId]);
}
