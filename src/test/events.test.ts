// Acceptance cover for the hidden-event filter (NS-P15, acceptance 2).
//
// src/lib/build/events.ts is not modified by NS-P15 — this file only proves the
// guarantee the sequence panel's privacy control rests on, and proves it at the
// layer that has to hold it.
//
// The claim being tested is narrow and important: a hidden event is excluded by
// the QUERY, not by a component that renders the result. A filter in a renderer
// is a filter someone forgets, and forgetting it here means publishing a
// creator's private prompts. So the assertion is on the request that was built,
// not on the rows that came back.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as { filters: [string, unknown][]; nots: [string, string, unknown][] }[],
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const table = () => {
    const call = { filters: [] as [string, unknown][], nots: [] as [string, string, unknown][] };
    state.calls.push(call);

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      },
      neq: (column: string, value: unknown) => {
        call.nots.push([column, "neq", value]);
        return builder;
      },
      in: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: state.rows, error: null }),
    };
    return builder;
  };

  return { supabase: { from: table } };
});

import { getEvents } from "@/lib/build/events";

const BUILD_ID = "build-1";

function row(id: string, visibility: string) {
  return { id, build_id: BUILD_ID, ordinal: 1, kind: "prompt", visibility, payload: {} };
}

describe("getEvents and the hidden filter", () => {
  beforeEach(() => {
    state.calls = [];
    state.rows = [row("a", "kept"), row("b", "folded")];
  });

  it("excludes hidden events in the query on default arguments", async () => {
    await getEvents(BUILD_ID);

    expect(state.calls).toHaveLength(1);
    // The whole guarantee, in one assertion: the exclusion is a predicate on
    // the request. A hidden row never crosses the wire, so no consumer can leak
    // one by forgetting to filter it out.
    expect(state.calls[0].nots).toContainEqual(["visibility", "neq", "hidden"]);
  });

  it("asks for hidden events only when a caller says so explicitly", async () => {
    await getEvents(BUILD_ID, { includeHidden: true });

    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].nots).toHaveLength(0);
  });
});
