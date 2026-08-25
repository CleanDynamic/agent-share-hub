// Acceptance cover for the content item to build record conversion (NS-P24).
//
// What a type checker cannot see, and what a reviewer cannot check by reading:
// that every block of a post survives the conversion somewhere, that the ones
// that survive cleanly keep the order the post presents them in, that the post
// itself is never written to, and that converting twice yields one draft.

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above every const, so the doubles have to be too.
const { from, getSession, createBuild, updateBuild } = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  createBuild: vi.fn(),
  updateBuild: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from, auth: { getSession } },
}));
vi.mock("@/lib/build/builds", () => ({
  BUILD_COLUMNS: "id",
  createBuild,
  updateBuild,
}));

import {
  blockTitle,
  convertContentItem,
  detectLanguage,
  detectSteps,
  mapBlock,
  parseModelParams,
  parseTable,
  planConversion,
  type NodePlan,
  type SourceBlock,
  type SourceItem,
} from "@/lib/build/convert";

const ITEM_ID = "11111111-2222-4333-8444-555555555555";
const CREATOR_ID = "99999999-8888-4777-8666-555555555555";
const BUILD_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const IMAGE_URL =
  "https://project.supabase.co/storage/v1/object/public/content-files/shot.png";

function item(overrides: Partial<SourceItem> = {}): SourceItem {
  return {
    id: ITEM_ID,
    creator_id: CREATOR_ID,
    title: "Inbox triage agent",
    description: "Drafts replies to a professional inbox without sending them.",
    ai_tools: ["Claude", "n8n"],
    use_cases: ["Lawyer", "Founder"],
    difficulty: "Intermediate",
    file_url: null,
    use_instructions: null,
    what_to_expect: null,
    monetisation_type: "paid",
    price_gbp: 12.5,
    donation_enabled: true,
    ...overrides,
  };
}

let blockCounter = 0;

function block(overrides: Partial<SourceBlock> = {}): SourceBlock {
  blockCounter += 1;
  return {
    id: `block-${blockCounter}`,
    content_id: ITEM_ID,
    position: blockCounter,
    block_type: "text",
    text_content: null,
    file_url: null,
    file_name: null,
    image_url: null,
    image_description: null,
    external_file_url: null,
    github_url: null,
    sub_blocks: null,
    use_instructions: null,
    ...overrides,
  };
}

// --- the supabase double -----------------------------------------------------
//
// A recording query builder. Every chain method returns the builder, the
// builder is thenable, and every write is recorded so a test can assert that
// the old path was only ever read.

interface Write {
  table: string;
  verb: string;
  rows?: unknown;
}

let reads: string[] = [];
let writes: Write[] = [];
let itemRow: SourceItem | null = null;
let blockRows: SourceBlock[] = [];
let existingBuild: unknown = null;

function result(table: string): { data: unknown; error: null } {
  if (table === "content_items") return { data: itemRow, error: null };
  if (table === "content_blocks") return { data: blockRows, error: null };
  if (table === "builds") return { data: existingBuild, error: null };
  return { data: null, error: null };
}

function makeBuilder(table: string) {
  const settle = () => Promise.resolve(result(table));
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(settle),
    single: vi.fn(settle),
    insert: vi.fn((rows: unknown) => {
      writes.push({ table, verb: "insert", rows });
      return Promise.resolve({ data: null, error: null });
    }),
    update: vi.fn(() => {
      writes.push({ table, verb: "update" });
      return builder;
    }),
    upsert: vi.fn(() => {
      writes.push({ table, verb: "upsert" });
      return Promise.resolve({ data: null, error: null });
    }),
    delete: vi.fn(() => {
      writes.push({ table, verb: "delete" });
      return builder;
    }),
    then: (onFulfilled: unknown, onRejected: unknown) =>
      settle().then(
        onFulfilled as (value: unknown) => unknown,
        onRejected as (reason: unknown) => unknown
      ),
  };
  return builder;
}

beforeEach(() => {
  blockCounter = 0;
  reads = [];
  writes = [];
  itemRow = item();
  blockRows = [];
  existingBuild = null;

  from.mockReset();
  from.mockImplementation((table: string) => {
    reads.push(table);
    return makeBuilder(table);
  });

  getSession.mockReset();
  getSession.mockResolvedValue({
    data: { session: { user: { id: CREATOR_ID } } },
    error: null,
  });

  createBuild.mockReset();
  createBuild.mockImplementation(async () => ({ id: BUILD_ID, status: "draft" }));

  updateBuild.mockReset();
  updateBuild.mockImplementation(async (id: string, patch: Record<string, unknown>) => ({
    id,
    status: "draft",
    ...patch,
  }));
});

// -----------------------------------------------------------------------------
// The mapping, block by block
// -----------------------------------------------------------------------------

describe("mapping one block", () => {
  it("maps the ten exact types onto their node types, placed", () => {
    const cases: [string, Partial<SourceBlock>, string][] = [
      ["prompt", { text_content: "Summarise this thread." }, "prompt"],
      ["agent_config", { text_content: "You triage an inbox." }, "agent_config"],
      ["workflow", { text_content: "First read. Then draft." }, "stack"],
      ["model_params", { text_content: "model: claude-opus-5\ntemperature: 0.2" }, "model_params"],
      ["tool_setup", { text_content: "Connect Gmail with read scope." }, "integration"],
      ["code", { text_content: "export const x = 1;" }, "code"],
      ["result", { text_content: "Forty minutes a day back." }, "result"],
      [
        "comparison",
        { text_content: "| Model | Score |\n| --- | --- |\n| Opus | 9 |" },
        "comparison_table",
      ],
      ["text", { text_content: "Why this exists." }, "note"],
      ["image", { image_url: IMAGE_URL }, "screenshot"],
    ];

    for (const [blockType, overrides, nodeType] of cases) {
      const plan = mapBlock(block({ block_type: blockType, ...overrides }));
      expect(plan.type, blockType).toBe(nodeType);
      expect(plan.placed, blockType).toBe(true);
      expect(plan.trayReason, blockType).toBeNull();
    }
  });

  it("treats long_text as text, because that is what it is", () => {
    const plan = mapBlock(block({ block_type: "long_text", text_content: "A long body." }));
    expect(plan.type).toBe("note");
    expect(plan.placed).toBe(true);
    expect(plan.payload.body).toBe("A long body.");
  });

  it("sends a block type with no exact node type to the tray, saying why", () => {
    const resource = mapBlock(
      block({ block_type: "resource", text_content: "The paper", file_url: "https://arxiv.org/abs/1" })
    );
    expect(resource.placed).toBe(false);
    expect(resource.type).toBe("document");
    expect(resource.payload.url).toBe("https://arxiv.org/abs/1");
    expect(resource.trayReason).toMatch(/no node type/i);

    const heading = mapBlock(block({ block_type: "section_heading", text_content: "Setup" }));
    expect(heading.placed).toBe(false);
    expect(heading.type).toBe("note");

    const unknown = mapBlock(block({ block_type: "tutorial_step", text_content: "Click run." }));
    expect(unknown.placed).toBe(false);
    expect(unknown.type).toBe("note");
    expect(unknown.payload.body).toBe("Click run.");
  });

  it("sends an exactly-mapped block with nothing in it to the tray", () => {
    const plan = mapBlock(block({ block_type: "prompt", text_content: "   " }));
    expect(plan.placed).toBe(false);
    expect(plan.type).toBe("prompt");
    expect(plan.trayReason).toMatch(/no text/i);
  });

  it("references the post's own image URL rather than copying anything", () => {
    const plan = mapBlock(
      block({ block_type: "image", image_url: IMAGE_URL, image_description: "The drafts folder" })
    );
    expect(plan.payload.media_id).toBe(IMAGE_URL);
    expect(plan.payload.caption).toBe("The drafts folder");
  });

  it("keeps an image block whose image has gone, in the tray", () => {
    const plan = mapBlock(block({ block_type: "image", image_description: "It was here" }));
    expect(plan.placed).toBe(false);
    expect(plan.payload.media_id).toBeUndefined();
    expect(plan.payload.caption).toBe("It was here");
  });

  it("splits a workflow into ordered steps when the source states them", () => {
    const plan = mapBlock(
      block({
        block_type: "workflow",
        text_content: "How it runs:\n1. Read the thread\n2. Classify it\n3. Draft a reply",
      })
    );
    expect(plan.type).toBe("stack");
    expect(plan.children.map((child) => child.payload.text)).toEqual([
      "Read the thread",
      "Classify it",
      "Draft a reply",
    ]);
    expect(plan.children.every((child) => child.type === "prompt")).toBe(true);
  });

  it("leaves a workflow with no readable steps as one node", () => {
    const plan = mapBlock(
      block({ block_type: "workflow", text_content: "It reads the inbox and drafts replies." })
    );
    expect(plan.children).toHaveLength(0);
    expect(plan.payload.notes).toBe("It reads the inbox and drafts replies.");
  });

  it("keeps prose the payload cannot hold on the node's note", () => {
    const plan = mapBlock(
      block({
        block_type: "model_params",
        text_content: "temperature: 0.2\nWe landed there after a week of tuning.",
        use_instructions: "Lower it for classification.",
      })
    );
    expect(plan.payload.temperature).toBe(0.2);
    expect(plan.note).toContain("We landed there after a week of tuning.");
    expect(plan.note).toContain("Lower it for classification.");
  });

  it("trays a comparison it cannot read as a table, keeping the text", () => {
    const plan = mapBlock(
      block({ block_type: "comparison", text_content: "Opus was better than Sonnet at this." })
    );
    expect(plan.placed).toBe(false);
    expect(plan.type).toBe("comparison_table");
    expect(plan.note).toContain("Opus was better than Sonnet");
  });
});

describe("the readers", () => {
  it("reads a markdown table into columns and pipe-joined rows", () => {
    const table = parseTable(
      "Results:\n| Model | Score | Cost |\n| --- | --- | --- |\n| Opus | 9 | £4 |\n| Sonnet | 7 | £1 |"
    );
    expect(table?.columns.map((column) => column.label)).toEqual(["Model", "Score", "Cost"]);
    expect(table?.columns.map((column) => column.key)).toEqual(["model", "score", "cost"]);
    expect(table?.rows).toEqual([{ cells: "Opus | 9 | £4" }, { cells: "Sonnet | 7 | £1" }]);
  });

  it("refuses a table that is only a header, and prose with a stray pipe", () => {
    expect(parseTable("| Model | Score |\n| --- | --- |")).toBeNull();
    expect(parseTable("Opus | Sonnet, whichever you have")).toBeNull();
  });

  it("reads only the parameter keys the node type declares", () => {
    expect(
      parseModelParams("model: claude-opus-5\nTemperature = 0.2\nmax tokens: 4,096\nmood: cheerful")
    ).toEqual({ model: "claude-opus-5", temperature: 0.2, max_tokens: 4096 });
  });

  it("reads nothing out of prose that states no parameters", () => {
    expect(parseModelParams("We used a low temperature and a big context.")).toEqual({});
  });

  it("reads the sub-list the old editor stores, in both shapes", () => {
    expect(detectSteps(block({ sub_blocks: ["One", "Two"] }))).toEqual(["One", "Two"]);
    expect(
      detectSteps(block({ sub_blocks: { subheading: "Steps", subBlocks: ["One", "Two"] } }))
    ).toEqual(["One", "Two"]);
    expect(detectSteps(block({ text_content: "- Only one bullet" }))).toEqual([]);
  });

  it("names a code block's language from its filename, then its fence", () => {
    expect(detectLanguage(block({ file_name: "agent.py" }))).toBe("python");
    expect(detectLanguage(block({ text_content: "```typescript\nconst x = 1;\n```" }))).toBe("ts");
    expect(detectLanguage(block({ text_content: "just some code" }))).toBeUndefined();
  });

  it("titles a node from the subheading, the first line, then the type", () => {
    expect(blockTitle(block({ sub_blocks: { subheading: "The triage prompt" } }))).toBe(
      "The triage prompt"
    );
    expect(blockTitle(block({ text_content: "## Setting it up\nthen the rest" }))).toBe(
      "Setting it up"
    );
    expect(blockTitle(block({ block_type: "model_params" }))).toBe("Model Parameters");
  });
});

// -----------------------------------------------------------------------------
// The whole plan
// -----------------------------------------------------------------------------

function wholePost(): SourceBlock[] {
  return [
    block({ block_type: "text", text_content: "Why I built this." }),
    block({ block_type: "prompt", text_content: "Summarise this thread." }),
    block({ block_type: "code", text_content: "export const x = 1;", file_name: "index.ts" }),
    block({ block_type: "image", image_url: IMAGE_URL }),
    block({ block_type: "resource", text_content: "The paper" }),
    block({ block_type: "section_heading", text_content: "Setup" }),
    block({ block_type: "comparison", text_content: "Opus felt better." }),
  ];
}

describe("planning a whole post", () => {
  it("gives every block exactly one root node: placed plus tray equals blocks", () => {
    const plan = planConversion({ item: item(), blocks: wholePost() });

    const roots = plan.nodes.filter((node) => node.blockId !== null);
    expect(roots).toHaveLength(7);
    expect(plan.counts.blocks).toBe(7);
    expect(plan.counts.placed + plan.counts.tray).toBe(plan.counts.blocks);
    expect(plan.counts.placed).toBe(4);
    expect(plan.counts.tray).toBe(3);
  });

  it("keeps the post's order in the placed tree", () => {
    const plan = planConversion({ item: item(), blocks: wholePost() });
    const placed = plan.nodes.filter((node) => node.placed && node.blockId !== null);
    expect(placed.map((node) => node.type)).toEqual(["note", "prompt", "code", "screenshot"]);
    expect(placed.map((node) => node.blockId)).toEqual(["block-1", "block-2", "block-3", "block-4"]);
  });

  it("carries the header fields the two models share", () => {
    const plan = planConversion({ item: item(), blocks: [] });
    expect(plan.header.title).toBe("Inbox triage agent");
    expect(plan.header.outcome).toBe(
      "Drafts replies to a professional inbox without sending them."
    );
    expect(plan.header.made_with).toEqual(["Claude", "n8n"]);
    expect(plan.header.made_for).toEqual(["Lawyer", "Founder"]);
    expect(plan.header.monetisation_type).toBe("paid");
    expect(plan.header.price_gbp).toBe(12.5);
    expect(plan.header.donation_enabled).toBe(true);
    expect(plan.header.status).toBe("draft");
  });

  it("says out loud that difficulty is not carried", () => {
    const plan = planConversion({ item: item(), blocks: [] });
    expect(plan.notes.join(" ")).toMatch(/difficulty/i);
  });

  it("makes the post's attachment a document node and its loose prose tray notes", () => {
    const plan = planConversion({
      item: item({
        file_url: "https://project.supabase.co/storage/v1/object/public/content-files/kit.zip",
        use_instructions: "Unzip it into the project root.",
        what_to_expect: "Two files and a config.",
      }),
      blocks: [],
    });

    const fromPost = plan.nodes.filter((node) => node.blockId === null);
    expect(fromPost).toHaveLength(3);
    expect(plan.counts.fromPost).toBe(3);

    const document = fromPost.find((node) => node.type === "document") as NodePlan;
    expect(document.placed).toBe(true);
    expect(document.payload.url).toContain("kit.zip");

    const notes = fromPost.filter((node) => node.type === "note");
    expect(notes.every((node) => !node.placed)).toBe(true);
    expect(notes.map((node) => node.title)).toEqual(["How to use it", "What to expect"]);
  });
});

// -----------------------------------------------------------------------------
// Writing it
// -----------------------------------------------------------------------------

describe("converting a post", () => {
  it("writes a draft build and one node per block, and never writes to the old path", async () => {
    blockRows = wholePost();

    const build = await convertContentItem(ITEM_ID);

    expect(createBuild).toHaveBeenCalledTimes(1);
    expect(createBuild.mock.calls[0][0]).toMatchObject({ title: "Inbox triage agent" });
    expect(updateBuild).toHaveBeenCalledWith(BUILD_ID, {
      source_content_item_id: ITEM_ID,
      monetisation_type: "paid",
      price_gbp: 12.5,
      donation_enabled: true,
    });
    expect(build.status).toBe("draft");

    // The one and only write, and it is on the new path.
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "build_nodes", verb: "insert" });
    expect(reads).toContain("content_items");
    expect(reads).toContain("content_blocks");
    expect(
      writes.some((write) => write.table === "content_items" || write.table === "content_blocks")
    ).toBe(false);
  });

  it("places the tree in source order and leaves the tray unplaced", async () => {
    blockRows = wholePost();
    await convertContentItem(ITEM_ID);

    const rows = writes[0].rows as { position: number | null; type: string; parent_id: string | null }[];
    const placed = rows.filter((row) => row.position !== null);
    const tray = rows.filter((row) => row.position === null);

    expect(placed.map((row) => row.position)).toEqual([0, 1, 2, 3]);
    expect(placed.map((row) => row.type)).toEqual(["note", "prompt", "code", "screenshot"]);
    expect(tray).toHaveLength(3);
    expect(rows).toHaveLength(7);
  });

  it("nests a workflow's steps under the node they came from", async () => {
    blockRows = [
      block({ block_type: "workflow", text_content: "1. Read it\n2. Draft it" }),
    ];
    await convertContentItem(ITEM_ID);

    const rows = writes[0].rows as {
      id: string; parent_id: string | null; type: string; position: number | null;
    }[];
    expect(rows).toHaveLength(3);

    const parent = rows.find((row) => row.parent_id === null) as (typeof rows)[number];
    expect(parent.type).toBe("stack");

    const children = rows.filter((row) => row.parent_id === parent.id);
    expect(children.map((row) => row.position)).toEqual([0, 1]);
  });

  it("offers the existing draft rather than converting a second time", async () => {
    existingBuild = { id: BUILD_ID, status: "draft", source_content_item_id: ITEM_ID };

    const build = await convertContentItem(ITEM_ID);

    expect(build).toMatchObject({ id: BUILD_ID });
    expect(createBuild).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
    // Not even read: the check comes before the source is touched.
    expect(reads).not.toContain("content_blocks");
  });

  it("refuses to convert a post the signed-in creator does not own", async () => {
    itemRow = item({ creator_id: "00000000-1111-4222-8333-444444444444" });

    await expect(convertContentItem(ITEM_ID)).rejects.toThrow(/only the creator/i);
    expect(createBuild).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("refuses when nobody is signed in", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(convertContentItem(ITEM_ID)).rejects.toThrow(/no signed-in user/i);
    expect(writes).toHaveLength(0);
  });
});
