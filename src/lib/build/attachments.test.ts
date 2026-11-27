// A Prompt tile records one message as it was sent: its attachments in order and place, the text, the model and effort, and what
// the app added. Checked at the payload, the steps read from it, and the copies.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
}));
vi.mock("./nodeTypes", () => ({ getNodeType: vi.fn(async () => ({ key: "x", is_active: true })) }));

import { attachBlock, attachmentsTitle, metaLine, moveAttachment, dragAttachment, namedFilesOf, placeholderFor, sentLine, zipEntriesOf } from "./attachments";
import { copyTogether } from "./copyTogether";
import { addAttachmentUses, buildSteps, orderAttachments, setFileMedia, usesInOrder, type Step, type Use } from "./graph";
import { fileKindFor, HEIC_REFUSAL } from "./media";
import { replacePicture } from "./pictureEdit";
import { promptZip } from "./promptZip";
import { runtimeFolder } from "./runtimeFolder";
import { EFFORTS, EFFORT_LABEL, SESSION_EFFORTS, cleanExtras, contextOf, settingsOf } from "./tileExtras";
import type { BuildNode, NodeTree } from "./types";
import { readZip } from "./zip";

const BUILD = "44444444-0000-4000-8000-000000000004";
const node = (over: Partial<Omit<NodeTree, "payload">> & { payload?: Record<string, unknown> }): NodeTree =>
  ({ id: "n", build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "2026-11-27T09:00:00.000Z", children: [], ...over }) as NodeTree;
const fileUse = (id: string): Use => ({ kind: "file", node_id: id });
const picture = (id: string, name: string, position: number, extra: Record<string, unknown> = {}) =>
  node({ id, type: "document", position, payload: { title: name, media_id: `m-${id}`, mime: "image/png", size: 120_000, attached: true, ...extra } });

/** The reference message: three screenshots and a markdown file above "Prompt example.", sent to Opus 5.5 at Medium. */
function referenceTree(at?: "after"): NodeTree[] {
  return [
    node({ id: "p1", position: 1, payload: { text: "Prompt example.", settings: { model: "claude-opus-5-5", effort: "medium", instructions: "" }, uses: [fileUse("f1"), fileUse("f2"), fileUse("f3"), fileUse("f4")], ...(at ? { attachments_at: at } : null), context: { from: "claude_app", web_search: true, earlier: 3 } } }),
    picture("f1", "screenshot-1.png", 2, { note: "Pricing reference" }),
    picture("f2", "screenshot-2.png", 3),
    picture("f3", "screenshot-3.png", 4),
    node({ id: "f4", type: "document", position: 5, payload: { title: "notes.md", media_id: "m-f4", mime: "text/markdown", size: 812, step: true } }),
  ];
}

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
});

describe("effort as the apps offer it", () => {
  it("lists six efforts with their words; Not given is still stored as default", () => {
    expect(EFFORTS).toEqual(["default", "low", "medium", "high", "xhigh", "max"]);
    expect(EFFORTS.map((effort) => EFFORT_LABEL[effort])).toEqual(["Not given", "Low", "Medium", "High", "Extra high", "Max"]);
  });

  it("reads an old prompt with High, and one with none, exactly as before", () => {
    expect(settingsOf({ model: "sonnet-5-5", effort: "high", instructions: "" })).toEqual({ model: "sonnet-5-5", effort: "high", instructions: "" });
    expect(settingsOf({ model: "", effort: "default", instructions: "" })).toBeNull();
    expect(settingsOf({ effort: "medium" })).toEqual({ model: "", effort: "medium", instructions: "" });
    const [old] = buildSteps([node({ id: "p", payload: { text: "Fix it.", settings: { model: "", effort: "low", instructions: "" } } })]);
    expect(old.settings?.effort).toBe("low");
    expect(copyTogether(old)).toBe("Fix it.");
  });

  it("leaves a session's three choices alone", () => {
    expect(SESSION_EFFORTS).toEqual(["default", "low", "high"]);
  });
});

describe("attachments belong to the prompt", () => {
  it("draws a File node used only by one prompt inside it, in the order of its inputs, and not as a step", () => {
    const steps = buildSteps(referenceTree());
    expect(steps.map((step) => step.kind)).toEqual(["prompt"]);
    const [prompt] = steps;
    expect(prompt.attachments?.map((attachment) => attachment.name)).toEqual(["screenshot-1.png", "screenshot-2.png", "screenshot-3.png", "notes.md"]);
    expect(prompt.attachments?.map((attachment) => attachment.kind)).toEqual(["picture", "picture", "picture", "text"]);
    expect(prompt.attachments?.[0].note).toBe("Pricing reference");
    expect(prompt.defaultTitle).toBe("Prompt example. · 4 attachments");
  });

  it("keeps a File tile used by two steps as its own tile", () => {
    const tree = [
      node({ id: "p1", position: 1, payload: { text: "One", uses: [fileUse("f1")] } }),
      node({ id: "p2", position: 2, payload: { text: "Two", uses: [fileUse("f1")] } }),
      node({ id: "f1", type: "document", position: 3, payload: { title: "menu.pdf", media_id: "m1", step: true } }),
    ];
    const steps = buildSteps(tree);
    expect(steps.map((step) => step.kind)).toEqual(["prompt", "prompt", "file"]);
    expect(steps.some((step) => step.attachments)).toBe(false);
  });

  it("leaves a Sources file one prompt uses as it was", () => {
    const tree = [node({ id: "p1", payload: { text: "Read it.", uses: [fileUse("f1")] } }), node({ id: "f1", type: "document", position: 2, payload: { title: "CLAUDE.md", media_id: "m1" } })];
    expect(buildSteps(tree)[0].attachments).toBeUndefined();
  });

  it("keeps a new order through a save and a reload", async () => {
    const tree = referenceTree();
    const prompt = tree[0] as unknown as BuildNode;
    const saved = await orderAttachments(prompt, ["f3", "f1", "f4", "f2"]);
    const reread = buildSteps([{ ...tree[0], payload: saved.payload } as NodeTree, ...tree.slice(1)]);
    expect(reread[0].attachments?.map((attachment) => attachment.id)).toEqual(["f3", "f1", "f4", "f2"]);
    expect(usesInOrder([{ kind: "output", node_id: "a" }, fileUse("x"), fileUse("y")], ["y", "x"])).toEqual([{ kind: "output", node_id: "a" }, fileUse("y"), fileUse("x")]);
    expect(moveAttachment(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveAttachment(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(dragAttachment(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("stores where they sat, a note and a captured day, and refuses what is out of range", () => {
    expect(cleanExtras("prompt", { attachments_at: "after" })).toEqual({ attachments_at: "after" });
    expect(cleanExtras("prompt", { attachments_at: "before" })).toEqual({ attachments_at: null });
    expect(cleanExtras("document", { note: " Pricing reference ", captured_at: "2026-11-20" })).toEqual({ note: "Pricing reference", captured_at: "2026-11-20" });
    expect(() => cleanExtras("document", { note: "x".repeat(141) })).toThrow("140 characters max");
    expect(() => cleanExtras("document", { captured_at: "2026-02-30" })).toThrow();
    expect(buildSteps(referenceTree("after"))[0].attachmentsAt).toBe("after");
  });

  it("refuses an iPhone HEIC photo with its own sentence", () => {
    expect(fileKindFor({ name: "IMG_0042.HEIC", type: "image/heic" })).toEqual({ refused: HEIC_REFUSAL });
    expect(fileKindFor({ name: "photo.heif", type: "" })).toEqual({ refused: HEIC_REFUSAL });
    expect(HEIC_REFUSAL).toBe("HEIC photos can't be added yet. Export it as JPEG and attach that.");
  });

  it("names a prompt by its text alone when it has four words or more", () => {
    expect(attachmentsTitle("Fix the menu on phones", 5, 2)).toBe("Fix the menu on phones");
    expect(attachmentsTitle("Prompt example.", 2, 1)).toBe("Prompt example. · 1 attachment");
  });
});

describe("what the app added", () => {
  it("reads and stores only what was given", () => {
    expect(contextOf({ from: "claude_app", web_search: true, earlier: 3, connectors: ["Linear", "Linear", " Notion "] })).toEqual({ from: "claude_app", webSearch: true, earlier: 3, connectors: ["Linear", "Notion"] });
    expect(contextOf({})).toBeNull();
    expect(cleanExtras("prompt", { context: { from: "harness", from_name: "Claude Code", memory: true } })).toEqual({ context: { from: "harness", from_name: "Claude Code", memory: true } });
    expect(() => cleanExtras("prompt", { context: { connectors: Array.from({ length: 9 }, (_, i) => `c${i}`) } })).toThrow("Connectors: 8 max");
  });

  it("says the meta line and the sent line from only the parts given", () => {
    const settings = { model: "claude-opus-5-5", effort: "medium" as const, instructions: "" };
    expect(metaLine("claude-opus-5-5", settings, null)).toBe("Opus 5.5 · Medium effort");
    expect(metaLine("claude-opus-5-5", settings, { from: "claude_app", webSearch: true, earlier: 3 })).toBe("Opus 5.5 · Medium effort · Sent from Claude app · web search on · 3 earlier messages");
    expect(sentLine("claude-opus-5-5", settings, { from: "claude_app", webSearch: true, earlier: 3 })).toBe("Sent to Opus 5.5 at Medium effort, from the Claude app, with web search on, after 3 earlier messages.");
    expect(sentLine(null, null, null)).toBeNull();
  });
});

describe("copies keep the order and say what cannot travel", () => {
  it("puts the numbered attach list first for before, then the text word for word, then the sent line", () => {
    const [prompt] = buildSteps(referenceTree());
    expect(copyTogether(prompt)).toBe(
      [
        "Attach these 4 files first, in this order:\n1. screenshot-1.png (Pricing reference)\n2. screenshot-2.png\n3. screenshot-3.png\n4. notes.md",
        "Prompt example.",
        "Sent to Opus 5.5 at Medium effort, from the Claude app, with web search on, after 3 earlier messages.",
      ].join("\n\n"),
    );
  });

  it("puts the attach list after the text for after", () => {
    const [prompt] = buildSteps(referenceTree("after"));
    const copy = copyTogether(prompt);
    expect(copy.startsWith("Prompt example.\n\nThen attach these 4 files, in this order:\n1. screenshot-1.png (Pricing reference)")).toBe(true);
    expect(copy.endsWith("after 3 earlier messages.")).toBe(true);
    expect(attachBlock([{ name: "a.png" }], "before")).toBe("Attach this file first:\n1. a.png");
  });

  it("lists them for Rebuild in", () => {
    const steps = buildSteps(referenceTree());
    const entry = runtimeFolder(steps).entries.find((file) => file.path === "ATTACHMENTS.md");
    expect(new TextDecoder().decode(entry?.data)).toContain("Attach these 4 files first, in this order:\n1. screenshot-1.png");
  });
});

describe("Download with files", () => {
  it("zips prompt.md and the attachments named by their place, in order", async () => {
    const [prompt] = buildSteps(referenceTree());
    const loaded: string[] = [];
    const { zip, missing } = await promptZip(prompt as Step, async (id) => {
      loaded.push(id);
      return new TextEncoder().encode(id);
    });
    expect(missing).toEqual([]);
    const entries = readZip(zip);
    expect(entries.map((entry) => entry.path)).toEqual(["prompt.md", "1-screenshot-1.png", "2-screenshot-2.png", "3-screenshot-3.png", "4-notes.md"]);
    expect(new TextDecoder().decode(entries[0].data).startsWith("Attach these 4 files first")).toBe(true);
    expect(loaded).toEqual(["m-f1", "m-f2", "m-f3", "m-f4"]);
    expect(zipEntriesOf([{ name: "a/b.png", mediaId: "m" }, { name: "c.md", mediaId: null }]).map((entry) => entry.name)).toEqual(["prompt.md", "1-a-b.png"]);
  });
});

describe("imports", () => {
  it("reads the files a turn named, keeps the text word for word, and makes placeholders that fill in place", async () => {
    expect(namedFilesOf("Prompt example.\n\n[files on this turn: shot.png, notes.md]")).toEqual({ text: "Prompt example.", names: ["shot.png", "notes.md"] });
    expect(namedFilesOf("Plain text")).toEqual({ text: "Plain text", names: [] });

    const prompt = node({ id: "p1", payload: { text: "Prompt example." } }) as unknown as BuildNode;
    const linked = await addAttachmentUses(prompt, ["f1", "f2"]);
    const tree = [
      { ...(prompt as unknown as NodeTree), payload: linked.payload } as NodeTree,
      node({ id: "f1", type: "document", position: 2, payload: { title: "shot.png", attached: true } }),
      node({ id: "f2", type: "document", position: 3, payload: { title: "notes.md", attached: true } }),
    ];
    const [step] = buildSteps(tree);
    expect(step.attachments?.map((attachment) => [attachment.name, attachment.mediaId])).toEqual([["shot.png", null], ["notes.md", null]]);
    expect(placeholderFor(step.attachments ?? [], "NOTES.md")).toBe("f2");
    expect(placeholderFor(step.attachments ?? [], "other.png")).toBeNull();

    const filled = await setFileMedia(tree[2] as unknown as BuildNode, { id: "m9", size: 812, mime: "text/markdown" });
    const [after] = buildSteps([tree[0], tree[1], { ...tree[2], payload: filled.payload } as NodeTree]);
    expect(after.attachments?.map((attachment) => [attachment.id, attachment.mediaId])).toEqual([["f1", null], ["f2", "m9"]]);
  });
});

describe("crop and blur before publishing", () => {
  it("uploads the new picture, repoints the node and deletes the old object", async () => {
    const calls: string[] = [];
    const done = await replacePicture(new File(["x"], "shot.jpg", { type: "image/jpeg" }), {
      oldMediaId: "m-old",
      upload: async () => (calls.push("upload"), { id: "m-new", bytes: 1, mime: "image/jpeg" }),
      repoint: async (media) => (calls.push(`repoint ${media.id}`), true),
      remove: async (id) => void calls.push(`remove ${id}`),
    });
    expect(done).toBe(true);
    expect(calls).toEqual(["upload", "repoint m-new", "remove m-old"]);
  });

  it("deletes the new upload, and keeps the old, when the node cannot be repointed", async () => {
    const removed: string[] = [];
    const done = await replacePicture(new File(["x"], "shot.jpg", { type: "image/jpeg" }), {
      oldMediaId: "m-old",
      upload: async () => ({ id: "m-new" }),
      repoint: async () => false,
      remove: async (id) => void removed.push(id),
    });
    expect(done).toBe(false);
    expect(removed).toEqual(["m-new"]);
  });
});
