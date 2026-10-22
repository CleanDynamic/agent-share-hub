// CA-15: the writers and readers the tile modals use, checked at the payload they store.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
}));
const getNodeType = vi.fn();
vi.mock("./nodeTypes", () => ({ getNodeType: (...a: unknown[]) => getNodeType(...a) }));

import { addResultTile, setExtras } from "./graph";
import type { Json } from "@/integrations/supabase/types";

import type { BuildNode, NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";
let seq = 0;
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: `n${++seq}`, build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "one two" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

/** The payload of the last node written. */
const written = (): Record<string, unknown> => (upsertNode.mock.calls.at(-1)?.[0] as { payload: Record<string, Json> }).payload;

beforeEach(() => {
  seq = 0;
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  getNodeType.mockReset();
  getNodeType.mockResolvedValue({ key: "x", is_active: true });
});

describe("a result's newer kinds (CA-15 P3)", () => {
  it("stores each kind under its own `kind`, with its required fields and the caption", async () => {
    await addResultTile(BUILD, [], { kind: "text", text: " First line\nsecond ", caption: " A caption " });
    expect(written()).toEqual({ summary: "First line", kind: "text", text: "First line\nsecond", caption: "A caption" });

    await addResultTile(BUILD, [], { kind: "audio", mediaId: "m1", name: "memo.wav", size: 10, mime: "audio/wav", seconds: 82.6 });
    expect(written()).toEqual({ summary: "memo.wav", kind: "audio", media_id: "m1", file_name: "memo.wav", file_size: 10, file_mime: "audio/wav", duration: 83 });

    await addResultTile(BUILD, [], { kind: "deployed", url: "app.example.com/x" });
    expect(written()).toMatchObject({ summary: "app.example.com", kind: "deployed", url: "https://app.example.com/x" });

    await addResultTile(BUILD, [], { kind: "table", csv: "a,b,c\n1,2,3", columns: 3 });
    expect(written()).toEqual({ summary: "Data table", kind: "table", csv: "a,b,c\n1,2,3", columns: 3 });
    await addResultTile(BUILD, [], { kind: "table", mediaId: "m2", name: "orders.csv", size: 5, mime: "text/csv", columns: 6 });
    expect(written()).toEqual({ summary: "orders.csv", kind: "table", media_id: "m2", file_name: "orders.csv", file_size: 5, file_mime: "text/csv", columns: 6 });

    await addResultTile(BUILD, [], { kind: "message", channel: "slack", message: "Ready" });
    expect(written()).toEqual({ summary: "Slack: Ready", kind: "message", channel: "slack", message: "Ready" });

    await addResultTile(BUILD, [], { kind: "external_change", application: "GitHub", change: "Opened a pull request" });
    expect(written()).toEqual({ summary: "GitHub: Opened a pull request", kind: "external_change", application: "GitHub", change: "Opened a pull request" });

    await addResultTile(BUILD, [], { kind: "metric", value: "42", label: "Orders per week", unit: "orders", before: "31" });
    expect(written()).toEqual({ summary: "Orders per week", kind: "metric", value: "42", label: "Orders per week", unit: "orders", before: "31" });
    await addResultTile(BUILD, [], { kind: "metric", value: "42", label: "Orders", unit: "", before: " " });
    expect(written()).toEqual({ summary: "Orders", kind: "metric", value: "42", label: "Orders" });

    await addResultTile(BUILD, [], { kind: "offline", description: "Delivered by hand", photoId: "m3" });
    expect(written()).toEqual({ summary: "Delivered by hand", kind: "offline", description: "Delivered by hand", media_id: "m3" });
  });

  it("keeps the older four exactly as they were stored", async () => {
    await addResultTile(BUILD, [], { kind: "link", url: "plumandrye.example/shop" });
    expect(written()).toEqual({ summary: "plumandrye.example", url: "https://plumandrye.example/shop" });
    await addResultTile(BUILD, [], { kind: "model", baseModel: "Muse", method: "Fine-tuned" });
    expect(written()).toEqual({ summary: "Trained model", kind: "trained-model", base_model: "Muse", method: "Fine-tuned" });
  });

  it("refuses an empty required field, in plain words, and writes nothing", async () => {
    await expect(addResultTile(BUILD, [], { kind: "metric", value: "", label: "x" })).rejects.toThrow("Add the value.");
    await expect(addResultTile(BUILD, [], { kind: "message", channel: "email", message: " " })).rejects.toThrow("Add the message.");
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("setExtras (CA-15)", () => {
  const prompt = (payload: Record<string, Json>) => node({ id: "p", type: "prompt", payload }) as unknown as BuildNode;

  it("writes a prompt's settings and variables, and keeps every other key", async () => {
    await setExtras(prompt({ text: "Hi {name}", model: "Fable 5.1", colour: "#112233" }), {
      settings: { model: "", effort: "low", instructions: "" },
      variables: [{ name: "name", description: "First name" }],
    });
    expect(written()).toEqual({ text: "Hi {name}", model: "Fable 5.1", colour: "#112233", settings: { model: "", effort: "low", instructions: "" }, variables: [{ name: "name", description: "First name" }] });
  });

  it("a null or empty value takes the key off", async () => {
    await setExtras(prompt({ text: "x", settings: { model: "m", effort: "low", instructions: "" }, variables: [{ name: "a", description: "b" }] }), { settings: null, variables: [] });
    expect(written()).toEqual({ text: "x" });
  });

  it("refuses a key the node type does not take, without writing", async () => {
    await expect(setExtras(prompt({ text: "x" }), { colour: "#fff" })).rejects.toThrow(/not a field/);
    expect(upsertNode).not.toHaveBeenCalled();
  });
});
