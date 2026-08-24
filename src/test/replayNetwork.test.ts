// Acceptance cover for NS-P16 acceptance 2: the replay's network response
// carries no hidden event.
//
// The claim is about the WIRE, not the DOM, so this asserts the wire. It runs
// getEvents through a real @supabase/supabase-js client — the same PostgREST
// query builder the browser uses — with fetch captured, and reads the request
// that comes out. What a network tab would show is the URL below plus whatever
// the server returns for it.
//
// Two halves, and the second is the one that matters:
//
//   1. The request carries visibility=neq.hidden, so the server never selects a
//      hidden row in the first place.
//   2. getEvents hands back the response body untouched. There is no
//      client-side pass that drops hidden rows — which is exactly why the
//      predicate in the URL is load-bearing rather than decorative. Take it out
//      and hidden events reach the client; nothing downstream would catch it.
//
// RLS cannot stand in for this: build_events is readable by anyone who can read
// the build, hidden rows included. Visibility is a query contract, and this is
// the test of it.

import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  requests: [] as string[],
  body: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createClient: create } = await import("@supabase/supabase-js");
  return {
    supabase: create("https://project.supabase.co", "anon-key", {
      global: {
        fetch: (input: RequestInfo | URL) => {
          state.requests.push(String(input));
          return Promise.resolve(
            new Response(JSON.stringify(state.body), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        },
      },
    }),
  };
});

import { getEvents } from "@/lib/build/events";

const BUILD = "11111111-0000-4000-8000-000000000001";

function event(ordinal: number, visibility: string) {
  return {
    id: `ev${ordinal}`,
    build_id: BUILD,
    ordinal,
    occurred_at: "2026-07-28T09:00:00Z",
    kind: "note",
    payload: { text: `event ${ordinal}` },
    phase: 1,
    phase_title: "Reading the inbox",
    visibility,
    produced_node_id: null,
    created_at: "2026-07-28T00:00:00Z",
  };
}

beforeEach(() => {
  state.requests = [];
  state.body = [];
});

describe("the replay's network request", () => {
  it("asks the server to exclude hidden events", async () => {
    state.body = [event(1, "kept"), event(2, "folded")];
    await getEvents(BUILD);

    expect(state.requests).toHaveLength(1);
    const url = new URL(state.requests[0]);

    expect(url.pathname).toBe("/rest/v1/build_events");
    expect(url.searchParams.get("build_id")).toBe(`eq.${BUILD}`);
    // The whole guarantee, in the query string a network tab would show.
    expect(url.searchParams.get("visibility")).toBe("neq.hidden");
    expect(url.searchParams.get("order")).toBe("ordinal.asc");
  });

  it("does no filtering of its own, which is why the predicate matters", async () => {
    // A server that ignored the predicate would hand hidden rows straight
    // through. Nothing between the wire and the replay would stop them, and
    // that is deliberate: the defence belongs in the request.
    state.body = [event(1, "kept"), event(2, "hidden")];
    const events = await getEvents(BUILD);

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.visibility)).toEqual(["kept", "hidden"]);
  });

  it("drops the predicate only when a caller asks for hidden events", async () => {
    state.body = [];
    await getEvents(BUILD, { includeHidden: true });

    const url = new URL(state.requests[0]);
    expect(url.searchParams.get("visibility")).toBeNull();
  });

  it("names only the columns the page needs", async () => {
    state.body = [];
    await getEvents(BUILD);

    const select = new URL(state.requests[0]).searchParams.get("select") ?? "";
    expect(select.split(",").map((column) => column.trim())).toEqual([
      "id", "build_id", "ordinal", "occurred_at", "kind", "payload",
      "phase", "phase_title", "visibility", "produced_node_id", "created_at",
    ]);
  });
});

/** A guard on the client the app actually ships. */
describe("the client under test", () => {
  it("is a real supabase client, not a hand-rolled stand-in", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const reference = createClient("https://project.supabase.co", "anon-key");
    expect(Object.getPrototypeOf(supabase)).toBe(Object.getPrototypeOf(reference));
  });
});
