// Acceptance cover for the Lovable intake reading (NS-P20).
//
// What a type checker cannot see: that a file is classified by its content and
// not its name, that an archive is unpacked without a dependency, and that the
// one undecidable case is reported as undecidable rather than guessed at.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { detectExportSource, isArchive, readArchive } from "@/lib/build/lovable";

// --- a zip, built by hand ----------------------------------------------------
// Stored entries only (method 0), so this needs no compressor and the reader's
// offset arithmetic is what is actually under test.

function zipOf(entries: { name: string; body: string }[]): File {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.body);

    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, 0, true); // stored
    localView.setUint32(18, data.length, true); // compressed size
    localView.setUint32(22, data.length, true); // uncompressed size
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true); // no extra field
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, 0, true); // stored
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);

  return new File([...locals, ...centrals, eocd] as BlobPart[], "export.zip", {
    type: "application/zip",
  });
}

const EXTENSION_EXPORT = JSON.stringify({
  exportedAt: "2026-08-20T18:04:11.522Z",
  url: "https://lovable.dev/projects/recipe-box-planner",
  messageCount: 1,
  messages: [
    {
      id: "umsg_01", role: "user",
      timestampText: "Aug 18, 2026, 9:12 AM", topPx: 120,
      contentHtml: "<p>Build me a recipe box.</p>",
      contentText: "Build me a recipe box.",
    },
  ],
});

const TRAJECTORY_MESSAGE = JSON.stringify({
  id: "m1", name: "Ada", role: "user", content: "Build me a recipe box.",
  createdAt: "2026-08-18T09:12:04.000Z", createTime: "2026-08-18T09:12:05.100Z",
  patch: [], images: [], raw: {},
});

describe("detectExportSource", () => {
  it("recognises the Chrome extension's export by its message fields", () => {
    expect(detectExportSource(EXTENSION_EXPORT)).toBe("lovable");
  });

  it("recognises the Firestore CLI's trajectory records", () => {
    expect(detectExportSource(`{"messages":[${TRAJECTORY_MESSAGE}]}`)).toBe("lovable");
    // A bare array is as likely as a wrapped one: raw/ is one file per message.
    expect(detectExportSource(`[${TRAJECTORY_MESSAGE}]`)).toBe("lovable");
  });

  it("sends a Lovable code download to the parser that can explain it", () => {
    // The obvious path a creator takes, and the one that carries no session.
    expect(detectExportSource('{"name":"app","dependencies":{"react":"18.3.1"}}')).toBe("lovable");
  });

  it("sends prose to the transcript parser", () => {
    expect(detectExportSource("You said:\nhello\n\nChatGPT said:\nhi")).toBe("transcript");
  });

  it("treats text that only looks like JSON as text", () => {
    expect(detectExportSource("{ this was never JSON")).toBe("transcript");
  });

  it("admits when JSON is genuinely undecidable rather than guessing", () => {
    expect(detectExportSource('{"foo":[1,2,3]}')).toBe("ambiguous");
  });

  it("classifies by content, never by filename", () => {
    // The same bytes decide the same way whatever the file was called; nothing
    // in detection can see a name.
    expect(detectExportSource(EXTENSION_EXPORT)).toBe("lovable");
    expect(detectExportSource("You said:\nhello")).toBe("transcript");
  });
});

describe("readArchive", () => {
  it("sniffs an archive from its first four bytes", async () => {
    expect(await isArchive(zipOf([{ name: "a.json", body: "{}" }]))).toBe(true);
    expect(await isArchive(new File(["You said:\nhi"], "chat.txt"))).toBe(false);
  });

  it("folds chat-history/raw/ into one messages array, in filename order", async () => {
    const second = JSON.stringify({
      id: "m2", name: "Lovable", role: "assistant", content: "Added the list.",
      createdAt: "2026-08-18T09:13:20.000Z",
      patch: [{ path: "src/pages/Recipes.tsx", action: "create" }],
      images: [], raw: {},
    });

    // Deliberately out of order in the archive: order is the parser's job.
    const text = await readArchive(
      zipOf([
        { name: "chat-history/raw/0002.json", body: second },
        { name: "chat-history/raw/0001.json", body: TRAJECTORY_MESSAGE },
      ]),
    );

    const parsed = JSON.parse(text) as { messages: { id: string }[] };
    expect(parsed.messages.map((message) => message.id)).toEqual(["m1", "m2"]);
    expect(detectExportSource(text)).toBe("lovable");
  });

  it("finds a single session .json among other files", async () => {
    const text = await readArchive(
      zipOf([
        { name: "README.md", body: "# notes" },
        { name: "lovable-chat-2026-08-20.json", body: EXTENSION_EXPORT },
      ]),
    );
    expect(detectExportSource(text)).toBe("lovable");
  });

  it("falls back to the manifest so a source-only download is explained, not rejected", async () => {
    const text = await readArchive(
      zipOf([
        { name: "src/App.tsx", body: "export default () => null;" },
        { name: "package.json", body: '{"name":"app","dependencies":{"react":"18.3.1"}}' },
      ]),
    );
    expect(JSON.parse(text).name).toBe("app");
    expect(detectExportSource(text)).toBe("lovable");
  });

  it("says so when an archive holds no session and no manifest", async () => {
    await expect(
      readArchive(zipOf([{ name: "notes.txt", body: "nothing useful" }])),
    ).rejects.toThrow(/no session history/i);
  });

  it("rejects a file that is not an archive at all", async () => {
    await expect(readArchive(new File(["not a zip"], "x.zip"))).rejects.toThrow(/not a zip/i);
  });
});

describe("the shared envelope (NS-P13 <-> NS-P20)", () => {
  // Acceptance 2, kept as a standing guard rather than a one-off check: the
  // two parsers are deployed separately and nothing but this stops them
  // drifting. If one grows a field, this fails until the other grows it too.

  const TRANSCRIPT = "You said:\nBuild me a recipe box.\n\nChatGPT said:\nDone.\n\n```ts a.ts\nconst x = 1;\n```\n";

  /** Both sides must yield at least one event and one node, or the diff is vacuous. */
  const WITH_CODE = JSON.stringify({
    exportedAt: "2026-08-20T18:04:11.522Z",
    url: "https://lovable.dev/projects/recipe-box-planner",
    messageCount: 2,
    messages: [
      { id: "umsg_01", role: "user", timestampText: "Aug 18, 2026, 9:12 AM", topPx: 120,
        contentHtml: "", contentText: "Build me a recipe box." },
      { id: "amsg_01", role: "ai", timestampText: "Aug 18, 2026, 9:13 AM", topPx: 340,
        contentHtml: "",
        contentText: "Done.\n\n```ts src/lib/store.ts\nexport const store = {};\n```" },
    ],
  });

  async function both() {
    const { parseTranscript } = await import(
      "../../../supabase/functions/parse-transcript/parse.ts"
    );
    const { parseLovable } = await import(
      "../../../supabase/functions/parse-lovable/parse.ts"
    );
    const transcript = parseTranscript(TRANSCRIPT, { session_id: "t" });
    const lovable = parseLovable(WITH_CODE, { session_id: "l" });
    // Guard the guard: a vacuous diff would pass silently forever.
    expect(transcript.events.length).toBeGreaterThan(0);
    expect(transcript.nodes.length).toBeGreaterThan(0);
    expect(lovable.events.length).toBeGreaterThan(0);
    expect(lovable.nodes.length).toBeGreaterThan(0);
    return { transcript, lovable };
  }

  const keys = (value: object) => Object.keys(value).sort();

  it("returns the same top-level fields", async () => {
    const { transcript, lovable } = await both();
    expect(keys(lovable)).toEqual(keys(transcript));
  });

  it("returns the same summary fields", async () => {
    const { transcript, lovable } = await both();
    expect(keys(lovable.summary)).toEqual(keys(transcript.summary));
  });

  it("returns the same event fields, payload and source_ref included", async () => {
    const { transcript, lovable } = await both();
    expect(keys(lovable.events[0])).toEqual(keys(transcript.events[0]));
    expect(keys(lovable.events[0].payload)).toEqual(keys(transcript.events[0].payload));
    expect(keys(lovable.events[0].source_ref)).toEqual(keys(transcript.events[0].source_ref));
  });

  it("returns the same node fields", async () => {
    const { transcript, lovable } = await both();
    expect(keys(lovable.nodes[0])).toEqual(keys(transcript.nodes[0]));
  });

  it("returns the same proposed-field and warning shapes", async () => {
    const { transcript, lovable } = await both();
    expect(keys(lovable.summary.proposed_title!)).toEqual(
      keys(transcript.summary.proposed_title!),
    );
    // A file that is not a Lovable export answers 200 with a warning rather
    // than throwing — that is what lets the intake surface route on the
    // parser's own answer instead of on an exception.
    const { parseLovable } = await import(
      "../../../supabase/functions/parse-lovable/parse.ts"
    );
    const refused = parseLovable("You said:\nhello", { session_id: "l" });
    expect(refused.summary.detected_format).toBe("unrecognised");
    expect(keys(refused.warnings[0])).toEqual(["code", "message"]);
    expect(keys(refused.warnings[0])).toEqual(keys(transcript.warnings[0] ?? refused.warnings[0]));
  });

  it("differs only where a parser is SUPPOSED to differ", async () => {
    const { transcript, lovable } = await both();
    // source_ref.source is the discriminator, and detected_format names the
    // shape. intake.ts types both as string and branches on neither.
    expect(transcript.events[0].source_ref.source).toBe("transcript");
    expect(lovable.events[0].source_ref.source).toBe("lovable");
    expect(lovable.summary.detected_format).toBe("lovable_chat_export");
  });
});
