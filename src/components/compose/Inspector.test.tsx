// Acceptance cover for NS-P09.
//
// The behaviours a type checker cannot see: a form that comes entirely from a
// database row, a payload that merges rather than replaces so an untouched
// field is never dropped, list rows that keep their order across a reorder, and
// the three-type gate showing a read-only payload for everything else.

import { readFileSync } from "node:fs";
import { useMemo } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn().mockResolvedValue({});
vi.mock("@/lib/build", () => ({
  upsertNode: (node: unknown) => upsertNode(node),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

/**
 * dnd-kit is replaced rather than driven.
 *
 * A drag in jsdom is a sequence of synthetic pointer events against elements
 * with no layout, which tests the sensor rather than the reorder. Capturing the
 * context's onDragEnd and the ids handed to each sortable row drives the same
 * code path deterministically — and the ids are the part worth testing, since
 * a reorder that moved the rows but not their keys would leave the next drag
 * reading the wrong row.
 */
const sortable: { onDragEnd?: (event: unknown) => void; ids: string[] } = { ids: [] };
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (e: unknown) => void }) => {
    sortable.onDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: () => [],
  useSensor: () => ({}),
  useSensors: () => [],
}));
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/sortable")>("@dnd-kit/sortable");
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSortable: ({ id }: { id: string }) => {
      if (!sortable.ids.includes(id)) sortable.ids.push(id);
      return {
        attributes: {},
        listeners: {},
        setNodeRef: () => {},
        transform: null,
        transition: undefined,
        isDragging: false,
      };
    },
  };
});

import type { Json } from "@/integrations/supabase/types";
import type { BuildNode, BuildRecord, NodeType } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { Inspector } from "./Inspector";
import { PAYLOAD_DEBOUNCE_MS } from "./SchemaForm";

const BUILD_ID = "build-1";

/** The real registry rows, copied from the NS-P02 migration. */
const PROMPT_TYPE = {
  key: "prompt",
  label: "Prompt",
  category: "instruction",
  colour: "#E8571A",
  schema: {
    fields: [
      { key: "text", label: "Prompt text", type: "text", required: true },
      {
        key: "variables",
        label: "Variables",
        type: "list",
        of: [
          { key: "name", label: "Name", type: "string" },
          { key: "description", label: "Description", type: "string" },
        ],
      },
      { key: "model", label: "Model", type: "string" },
      { key: "params", label: "Parameters", type: "text" },
      { key: "sent_at", label: "Sent at", type: "string", format: "timestamp" },
      { key: "output_ref", label: "Output", type: "string", format: "node_id" },
    ],
  },
} as unknown as NodeType;

const DATASET_TYPE = {
  key: "dataset",
  label: "Dataset",
  category: "data",
  colour: "#3B82F6",
  schema: { fields: [{ key: "name", label: "Name", type: "string" }] },
} as unknown as NodeType;

function makeNode(id: string, type: string, payload: Json = {}): BuildNode {
  return {
    id,
    build_id: BUILD_ID,
    parent_id: null,
    position: 0,
    type,
    title: null,
    note: null,
    payload,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-01-01T00:00:00Z",
  } as BuildNode;
}

/**
 * Stands in for useComposeBuild: subscribes to the same cache entry and hands
 * the Inspector what it holds, so an optimistic write comes back to the panel
 * exactly as it does in the workspace.
 */
function Harness({ record, selectedNodeId }: { record: BuildRecord; selectedNodeId: string }) {
  // Seeded into the cache before render, so the first paint already has the
  // record: under fake timers an async queryFn would never resolve.
  const { data } = useQuery({
    queryKey: composeBuildQueryKey(BUILD_ID),
    queryFn: () => record,
    staleTime: Infinity,
    initialData: record,
  });

  const compose = useMemo(
    () =>
      ({
        selectedNodeId,
        tree: data?.tree ?? [],
        tray: data?.tray ?? [],
        nodeTypes: data?.nodeTypes ?? [],
      }) as ComposeBuild,
    [data, selectedNodeId]
  );

  if (!data) return null;
  return <Inspector buildId={BUILD_ID} compose={compose} onDelete={() => {}} />;
}

function renderInspector(node: BuildNode, nodeTypes: NodeType[] = [PROMPT_TYPE, DATASET_TYPE]) {
  const record: BuildRecord = {
    build: { id: BUILD_ID } as BuildRecord["build"],
    tree: [{ ...node, children: [] }],
    tray: [],
    events: [],
    nodeTypes,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness record={record} selectedNodeId={node.id} />
    </QueryClientProvider>
  );
  return { ...view, client };
}

/** Let the debounce fire and the write's promise chain settle. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(PAYLOAD_DEBOUNCE_MS + 50);
  });
}

/** The payload of the most recent upsert. */
function lastPayload(): Record<string, unknown> {
  const calls = upsertNode.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0].payload as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sortable.ids = [];
  sortable.onDragEnd = undefined;
  vi.useFakeTimers();
});

describe("Inspector", () => {
  it("names what the panel does rather than rendering blank with nothing selected", () => {
    const record: BuildRecord = {
      build: { id: BUILD_ID } as BuildRecord["build"],
      tree: [],
      tray: [],
      events: [],
      nodeTypes: [],
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Harness record={record} selectedNodeId="" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Select a node to edit its fields/i)).toBeInTheDocument();
  });

  it("builds a prompt's form from the schema alone", () => {
    renderInspector(makeNode("n1", "prompt"));

    // Every control here comes from a row in node_types, not from this file.
    expect(screen.getByLabelText("Prompt text").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Model").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Parameters").tagName).toBe("TEXTAREA");
    // format hints still render as plain string inputs until NS-P10.
    expect(screen.getByLabelText("Sent at").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Output").tagName).toBe("INPUT");
    // The list widget, not an input.
    expect(screen.getByRole("button", { name: /Add variables/i })).toBeInTheDocument();
  });

  it("marks a required field quietly and never as an error before it is touched", () => {
    renderInspector(makeNode("n1", "prompt"));
    const marker = screen.getByText("required");
    expect(marker).toBeInTheDocument();
    // Muted, not the orange it takes once the creator has emptied it.
    expect(marker).not.toHaveStyle({ color: "#E8571A" });
  });

  it("writes one merged payload after the debounce, not one per keystroke", async () => {
    renderInspector(makeNode("n1", "prompt"));

    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "opus" } });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "opus-5" } });
    expect(upsertNode).not.toHaveBeenCalled();

    await settle();
    expect(upsertNode).toHaveBeenCalledTimes(1);
    expect(lastPayload()).toEqual({ model: "opus-5" });
  });

  it("keeps a field it did not touch when another is edited", async () => {
    renderInspector(makeNode("n1", "prompt"));

    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "opus-5" } });
    await settle();
    expect(lastPayload()).toEqual({ model: "opus-5" });

    fireEvent.change(screen.getByLabelText("Prompt text"), {
      target: { value: "Summarise this" },
    });
    await settle();

    // The second write carries both. This is the whole point of the merge.
    expect(lastPayload()).toEqual({ model: "opus-5", text: "Summarise this" });
  });

  it("never sends parent_id or position, so it cannot fight a drag", async () => {
    renderInspector(makeNode("n1", "prompt"));
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "opus-5" } });
    await settle();

    const row = upsertNode.mock.calls[0][0];
    expect(row).toMatchObject({ id: "n1", build_id: BUILD_ID, type: "prompt" });
    expect(row).not.toHaveProperty("parent_id");
    expect(row).not.toHaveProperty("position");
  });

  it("writes title and note without disturbing the payload", async () => {
    renderInspector(makeNode("n1", "prompt", { model: "opus-5" }));

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "The ask" } });
    await settle();

    const row = upsertNode.mock.calls[0][0];
    expect(row.title).toBe("The ask");
    // The title writer owns title and note only; payload is the other writer's.
    expect(row).not.toHaveProperty("payload");
  });

  describe("the list widget", () => {
    it("adds rows and persists them in order", async () => {
      renderInspector(makeNode("n1", "prompt"));
      const add = screen.getByRole("button", { name: /Add variables/i });

      fireEvent.click(add);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: /Add variables/i }));
      await settle();

      const names = screen.getAllByPlaceholderText("Name");
      expect(names).toHaveLength(2);

      fireEvent.change(names[0], { target: { value: "topic" } });
      await settle();
      fireEvent.change(screen.getAllByPlaceholderText("Name")[1], {
        target: { value: "tone" },
      });
      await settle();

      expect(lastPayload().variables).toEqual([{ name: "topic" }, { name: "tone" }]);
    });

    it("persists the new array order after a reorder", async () => {
      renderInspector(
        makeNode("n1", "prompt", {
          variables: [{ name: "topic" }, { name: "tone" }, { name: "length" }],
        })
      );

      expect(sortable.ids).toHaveLength(3);
      const [first, second] = sortable.ids;

      // Drag row 1 onto row 2.
      act(() => sortable.onDragEnd?.({ active: { id: first }, over: { id: second } }));
      await settle();
      expect(lastPayload().variables).toEqual([
        { name: "tone" },
        { name: "topic" },
        { name: "length" },
      ]);

      // The keys moved with the rows, so a second drag still addresses the row
      // the creator is looking at rather than the one that used to be there.
      act(() => sortable.onDragEnd?.({ active: { id: first }, over: { id: second } }));
      await settle();
      expect(lastPayload().variables).toEqual([
        { name: "topic" },
        { name: "tone" },
        { name: "length" },
      ]);
    });

    it("removes the row the creator asked for, not the one at its old index", async () => {
      renderInspector(
        makeNode("n1", "prompt", { variables: [{ name: "topic" }, { name: "tone" }] })
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove row 1" }));
      await settle();
      expect(lastPayload().variables).toEqual([{ name: "tone" }]);
    });
  });

  describe("the NS-P10 gate", () => {
    it("shows an un-wired type its payload read-only and no form", () => {
      renderInspector(makeNode("n2", "dataset", { name: "eval set", rows: 400 }));

      expect(screen.getByText("Editing Dataset nodes arrives in NS-P10")).toBeInTheDocument();
      // Read-only: the schema's own field is not rendered as a control.
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

      const payload = screen.getByText(/"eval set"/);
      expect(within(payload).getByText(/400/)).toBeInTheDocument();
    });

    it("still edits title and note on an un-wired type", async () => {
      renderInspector(makeNode("n2", "dataset"));
      fireEvent.change(screen.getByLabelText(/only free prose/i), {
        target: { value: "where this came from" },
      });
      await settle();
      expect(upsertNode.mock.calls[0][0].note).toBe("where this came from");
    });

    it("wires exactly prompt, model_params and result", () => {
      const source = readFileSync("src/components/compose/Inspector.tsx", "utf8");
      const gate = /const WIRED_TYPES = \[([^\]]*)\]/.exec(source);
      expect(gate).not.toBeNull();
      expect(gate?.[1].match(/"[a-z_]+"/g)).toEqual([
        '"prompt"',
        '"model_params"',
        '"result"',
      ]);
    });
  });
});
