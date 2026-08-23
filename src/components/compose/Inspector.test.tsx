// Acceptance cover for NS-P09 and NS-P10.
//
// The behaviours a type checker cannot see: a form that comes entirely from a
// database row, a payload that merges rather than replaces so an untouched
// field is never dropped, list rows that keep their order across a reorder,
// and — since NS-P10 — every one of the 26 registry types rendering an editable
// form, with the four format hints resolving to their own controls.
//
// The registry sweep reads the NS-P02 migration rather than a copy of it. The
// migration is the source of truth for what node_types holds, so a schema row
// edited there without a widget that can render it fails here rather than in a
// creator's panel.

import { readFileSync, readdirSync } from "node:fs";
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
import { acceptedSubFields, shouldStackRow } from "./fields/ListField";

const BUILD_ID = "build-1";

/**
 * The 26 registry rows, read out of the NS-P02 migration.
 *
 * A regex over the INSERT rather than a fixture: a fixture is a copy that goes
 * stale, and the point of these tests is that the panel renders whatever the
 * registry actually says.
 */
const REGISTRY_ROW =
  /\('([a-z_]+)', '([^']*)', '([a-z]+)', '(#[0-9A-Fa-f]{6})', '([A-Za-z0-9]+)', '([a-z_]+)', (?:true|false), (true|false), \d+, '(\{[\s\S]*?\})'::jsonb\)/g;

function readRegistry(): NodeType[] {
  const sql = readFileSync(
    "supabase/migrations/20260823130000_node_type_registry_seed.sql",
    "utf8"
  );
  const types: NodeType[] = [];
  for (const match of sql.matchAll(REGISTRY_ROW)) {
    const [, key, label, category, colour, icon, renderer, isActive, schema] = match;
    types.push({
      key,
      label,
      category,
      colour,
      icon,
      renderer,
      is_active: isActive === "true",
      schema: JSON.parse(schema),
    } as unknown as NodeType);
  }
  return types;
}

const REGISTRY = readRegistry();

/** One registry row by key. Throws rather than rendering a type that is gone. */
function registryType(key: string): NodeType {
  const type = REGISTRY.find((row) => row.key === key);
  if (!type) throw new Error(`node type "${key}" is not in the NS-P02 migration`);
  return type;
}

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

/** A whole build: several placed nodes, an optional tray, one of them selected. */
function renderBuild({
  nodes,
  selectedNodeId,
  nodeTypes,
  tray = [],
}: {
  nodes: BuildNode[];
  selectedNodeId: string;
  nodeTypes: NodeType[];
  tray?: BuildNode[];
}) {
  const record: BuildRecord = {
    build: { id: BUILD_ID } as BuildRecord["build"],
    tree: nodes.map((node) => ({ ...node, children: [] })),
    tray,
    events: [],
    nodeTypes,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness record={record} selectedNodeId={selectedNodeId} />
    </QueryClientProvider>
  );
  return { ...view, client };
}

function renderInspector(node: BuildNode, nodeTypes: NodeType[] = [PROMPT_TYPE, DATASET_TYPE]) {
  return renderBuild({ nodes: [node], selectedNodeId: node.id, nodeTypes });
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
    // format hints resolve to their own controls since NS-P10, and the schema
    // is still the only thing that said so.
    expect(screen.getByLabelText("Sent at")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByRole("combobox", { name: "Output" })).toBeInTheDocument();
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

  describe("the suggested-field summary", () => {
    it("counts what the type suggests, for this node only", () => {
      renderInspector(makeNode("n1", "prompt", { model: "opus-5" }));
      expect(screen.getByText("1 of 6 suggested fields filled")).toBeInTheDocument();
    });

    it("recounts as the creator fills a field", async () => {
      renderInspector(makeNode("n1", "prompt", { model: "opus-5" }));
      fireEvent.change(screen.getByLabelText("Prompt text"), {
        target: { value: "Summarise this" },
      });
      await settle();
      expect(screen.getByText("2 of 6 suggested fields filled")).toBeInTheDocument();
    });

    it("counts a false boolean as an answer, not a blank", () => {
      renderBuild({
        nodes: [makeNode("n1", "code", { entrypoint: false })],
        selectedNodeId: "n1",
        nodeTypes: [registryType("code")],
      });
      expect(screen.getByText("1 of 4 suggested fields filled")).toBeInTheDocument();
    });

    it("never reads as a gate or a grade", () => {
      renderInspector(makeNode("n1", "prompt"));
      const summary = screen.getByText("0 of 6 suggested fields filled");
      expect(summary.textContent).toMatch(/suggested/);
      // No score, no percentage, no incomplete/missing verdict on the node.
      expect(screen.queryByText(/%|complete|incomplete|score/i)).not.toBeInTheDocument();
    });

    it("says nothing at all for a type that stores no fields", () => {
      const EMPTY = { ...DATASET_TYPE, schema: { fields: [] } } as unknown as NodeType;
      renderInspector(makeNode("n1", "dataset"), [EMPTY]);
      expect(screen.queryByText(/suggested fields/)).not.toBeInTheDocument();
    });
  });

  describe("the full registry", () => {
    it("reads all 26 active rows out of the migration", () => {
      expect(REGISTRY).toHaveLength(26);
      expect(REGISTRY.every((type) => type.is_active)).toBe(true);
    });

    it("renders an editable form for every one of them, and no gate message", () => {
      for (const type of REGISTRY) {
        const view = renderBuild({
          nodes: [makeNode(`node-${type.key}`, type.key)],
          selectedNodeId: `node-${type.key}`,
          nodeTypes: [type],
        });

        // The NS-P09 gate copy is gone for every type, media's own NS-P12
        // placeholder notwithstanding.
        expect(
          view.queryByText(/arrives in NS-P10|not yet wired|no form yet/i)
        ).not.toBeInTheDocument();

        // Every field the row declares produced a control of some kind.
        for (const field of type.schema.fields) {
          const label = field.label;
          const rendered =
            view.queryAllByLabelText(label).length > 0 ||
            view.queryAllByText(label).length > 0;
          expect(rendered, `${type.key}.${field.key} rendered nothing`).toBe(true);
        }

        view.unmount();
      }
    });

    it("writes a payload for a type that had no form before NS-P10", async () => {
      renderBuild({
        nodes: [makeNode("n1", "tool_definition")],
        selectedNodeId: "n1",
        nodeTypes: [registryType("tool_definition")],
      });

      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "search_web" } });
      await settle();
      expect(lastPayload()).toEqual({ name: "search_web" });
    });

    it("keeps no list of wired type keys anywhere in the panel", () => {
      const source = readFileSync("src/components/compose/Inspector.tsx", "utf8");
      // No allow-list constant of any name, and no node type key quoted
      // anywhere: a gate can only come back as one or the other.
      expect(source).not.toMatch(/const\s+[A-Z][A-Z_]*_TYPES\s*=\s*\[/);
      for (const type of REGISTRY) {
        expect(source).not.toMatch(new RegExp(`["']${type.key}["']`));
      }
    });

    it("has no per-type form component in the compose directory", () => {
      const files = [
        ...readdirSync("src/components/compose"),
        ...readdirSync("src/components/compose/fields"),
      ];
      const pascal = (key: string) =>
        key.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
      for (const type of REGISTRY) {
        const named = files.filter((file) => file.includes(pascal(type.key)));
        expect(named, `a component is named after ${type.key}`).toEqual([]);
      }
    });
  });

  describe("the node reference picker", () => {
    const PROMPT = registryType("prompt");
    const RESULT = registryType("result");
    const AGENT = registryType("agent_config");
    const TOOL = registryType("tool_definition");

    function withTitle(node: BuildNode, title: string): BuildNode {
      return { ...node, title };
    }

    it("offers the build's other nodes and stores the id of the one picked", async () => {
      renderBuild({
        nodes: [makeNode("n1", "prompt"), withTitle(makeNode("n2", "result"), "The score")],
        selectedNodeId: "n1",
        nodeTypes: [PROMPT, RESULT],
      });

      fireEvent.click(screen.getByRole("combobox", { name: "Output" }));
      fireEvent.click(screen.getByRole("option", { name: /The score/ }));
      await settle();

      expect(lastPayload().output_ref).toBe("n2");
      // Resolved by title, once set — the uuid is never what the creator reads.
      expect(screen.getByRole("combobox", { name: "Output" })).toHaveTextContent("The score");
    });

    it("offers tray nodes too, since unplaced material is still referenceable", () => {
      renderBuild({
        nodes: [makeNode("n1", "prompt")],
        tray: [withTitle(makeNode("n2", "result"), "Unplaced result")],
        selectedNodeId: "n1",
        nodeTypes: [PROMPT, RESULT],
      });

      fireEvent.click(screen.getByRole("combobox", { name: "Output" }));
      expect(screen.getByRole("option", { name: /Unplaced result/ })).toBeInTheDocument();
    });

    it("never offers the node being edited, so nothing can point at itself", () => {
      renderBuild({
        nodes: [withTitle(makeNode("n1", "prompt"), "This very prompt")],
        selectedNodeId: "n1",
        nodeTypes: [PROMPT],
      });

      fireEvent.click(screen.getByRole("combobox", { name: "Output" }));
      expect(screen.queryByRole("option", { name: /This very prompt/ })).not.toBeInTheDocument();
      expect(screen.getByText(/no other nodes yet/i)).toBeInTheDocument();
    });

    it("renders a reference whose target was deleted as missing node, not a uuid", async () => {
      const { client } = renderBuild({
        nodes: [makeNode("n1", "prompt"), withTitle(makeNode("n2", "result"), "The score")],
        selectedNodeId: "n1",
        nodeTypes: [PROMPT, RESULT],
      });

      fireEvent.click(screen.getByRole("combobox", { name: "Output" }));
      fireEvent.click(screen.getByRole("option", { name: /The score/ }));
      await settle();
      expect(lastPayload().output_ref).toBe("n2");

      // The referenced node is deleted out from under the reference.
      act(() => {
        client.setQueryData<BuildRecord>(composeBuildQueryKey(BUILD_ID), (record) => ({
          ...(record as BuildRecord),
          tree: (record as BuildRecord).tree.filter((node) => node.id !== "n2"),
        }));
      });
      await settle();

      expect(screen.getByText("missing node")).toBeInTheDocument();
      expect(screen.queryByText("n2")).not.toBeInTheDocument();
    });

    it("clears a reference without leaving an empty string behind", async () => {
      renderBuild({
        nodes: [makeNode("n1", "prompt", { output_ref: "n2" }), makeNode("n2", "result")],
        selectedNodeId: "n1",
        nodeTypes: [PROMPT, RESULT],
      });

      fireEvent.click(screen.getByRole("button", { name: "Clear Output" }));
      await settle();
      expect(lastPayload().output_ref).toBeNull();
    });

    it("picks a tool definition by title inside an agent configuration's tool rows", async () => {
      renderBuild({
        nodes: [
          makeNode("n1", "agent_config"),
          withTitle(makeNode("n2", "tool_definition"), "search_web"),
        ],
        selectedNodeId: "n1",
        nodeTypes: [AGENT, TOOL],
      });

      fireEvent.click(screen.getByRole("button", { name: /Add tools/i }));
      await settle();

      // The row's picker is labelled by its sub-field, not by the parent list.
      fireEvent.click(screen.getByRole("combobox", { name: "Tool" }));
      fireEvent.click(screen.getByRole("option", { name: /search_web/ }));
      await settle();

      expect(lastPayload().tools).toEqual([{ tool_ref: "n2" }]);
    });
  });

  describe("the url field", () => {
    it("rejects a url with no scheme and accepts one that has it", async () => {
      renderBuild({
        nodes: [makeNode("n1", "repo")],
        selectedNodeId: "n1",
        nodeTypes: [registryType("repo")],
      });

      const input = screen.getByLabelText("URL");
      fireEvent.change(input, { target: { value: "example.com" } });
      await settle();
      // Nothing is said while it is still being typed.
      expect(screen.queryByText(/Needs a scheme/)).not.toBeInTheDocument();

      fireEvent.blur(input);
      expect(screen.getByText(/Needs a scheme/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("URL"), {
        target: { value: "https://example.com" },
      });
      await settle();
      fireEvent.blur(screen.getByLabelText("URL"));
      expect(screen.queryByText(/Needs a scheme/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Open URL in a new tab/i })).toHaveAttribute(
        "href",
        "https://example.com"
      );
    });

    it("keeps what was typed even when it does not validate", async () => {
      renderBuild({
        nodes: [makeNode("n1", "repo")],
        selectedNodeId: "n1",
        nodeTypes: [registryType("repo")],
      });

      fireEvent.change(screen.getByLabelText("URL"), { target: { value: "example.com" } });
      await settle();
      fireEvent.blur(screen.getByLabelText("URL"));

      expect(lastPayload().url).toBe("example.com");
      expect(screen.getByLabelText("URL")).toHaveValue("example.com");
    });

    it("offers no link affordance for a url it cannot open", () => {
      renderBuild({
        nodes: [makeNode("n1", "repo", { url: "example.com" })],
        selectedNodeId: "n1",
        nodeTypes: [registryType("repo")],
      });
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("the timestamp field", () => {
    it("stores what the creator picked as ISO 8601 UTC and reads it back", async () => {
      renderInspector(makeNode("n1", "prompt"));

      const input = screen.getByLabelText("Sent at");
      fireEvent.change(input, { target: { value: "2026-08-23T14:30" } });
      await settle();

      const stored = lastPayload().sent_at as string;
      expect(stored).toMatch(/Z$/);
      // The same instant the creator picked in their own zone.
      expect(new Date(stored).getTime()).toBe(new Date("2026-08-23T14:30").getTime());
      expect(screen.getByLabelText("Sent at")).toHaveValue("2026-08-23T14:30");
    });

    it("clears to null rather than to an empty string", async () => {
      renderInspector(makeNode("n1", "prompt", { sent_at: "2026-08-23T14:30:00.000Z" }));
      fireEvent.change(screen.getByLabelText("Sent at"), { target: { value: "" } });
      await settle();
      expect(lastPayload().sent_at).toBeNull();
    });
  });

  describe("the media placeholder", () => {
    it("names NS-P12, shows the stored id and offers nothing to write with", () => {
      renderBuild({
        nodes: [makeNode("n1", "screenshot", { media_id: "media-7" })],
        selectedNodeId: "n1",
        nodeTypes: [registryType("screenshot")],
      });

      expect(screen.getByText(/media upload arrives in NS-P12/)).toBeInTheDocument();
      expect(screen.getByText("media-7")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Media" })).not.toBeInTheDocument();
    });
  });

  describe("list rows at depth", () => {
    it("keeps sub-fields side by side while each can still be read", () => {
      // Nothing measured yet, and the two-line layouts the 340px rail affords.
      expect(shouldStackRow(0, 4)).toBe(false);
      expect(shouldStackRow(280, 3)).toBe(false);
      expect(shouldStackRow(280, 4)).toBe(false);
      // A third line is no longer one row, and a rail too narrow for even one
      // sub-field stacks whatever it holds.
      expect(shouldStackRow(280, 5)).toBe(true);
      expect(shouldStackRow(100, 2)).toBe(true);
      // The bottom sheet is wide enough to lay five out on one line.
      expect(shouldStackRow(600, 5)).toBe(false);
    });

    it("rejects a list inside a list with a warning instead of rendering it", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const nested = {
        key: "outer_list",
        label: "Outer",
        type: "list",
        of: [
          { key: "name", label: "Name", type: "string" },
          { key: "inner", label: "Inner", type: "list", of: [{ key: "x", label: "X", type: "string" }] },
        ],
      } as const;

      const accepted = acceptedSubFields(nested as never);
      expect(accepted.map((field) => field.key)).toEqual(["name"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("outer_list.inner"));
      warn.mockRestore();
    });

    it("renders only the sub-fields the dialect allows", async () => {
      const NESTED_TYPE = {
        key: "nested_demo",
        label: "Nested demo",
        category: "data",
        colour: "#3B82F6",
        schema: {
          fields: [
            {
              key: "rows",
              label: "Rows",
              type: "list",
              of: [
                { key: "name", label: "Name", type: "string" },
                {
                  key: "deeper",
                  label: "Deeper",
                  type: "list",
                  of: [{ key: "x", label: "X", type: "string" }],
                },
              ],
            },
          ],
        },
      } as unknown as NodeType;

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      renderInspector(makeNode("n1", "nested_demo"), [NESTED_TYPE]);
      fireEvent.click(screen.getByRole("button", { name: /Add rows/i }));
      await settle();

      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      // The nested list rendered no control of its own — not even an add button.
      expect(screen.queryByRole("button", { name: /Add deeper/i })).not.toBeInTheDocument();
      warn.mockRestore();
    });
  });
});
