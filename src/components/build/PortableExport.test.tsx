// Acceptance cover for the two export controls (NS-P06).
//
// What is asserted here is what a reader ends up holding: markdown on the
// clipboard, and a file named after the slug whose bytes parse back into the
// same record, three levels deep.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuildRecord, NodeTree } from "@/lib/build";
import { PortableExport } from "./PortableExport";

const nodeTypes = [
  { key: "agent_config", label: "Agent configuration", category: "configuration", colour: "#7C3AED", icon: "Bot", renderer: "agent_config", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "model", label: "Model", type: "string" }] } },
  { key: "system_prompt", label: "System prompt", category: "instruction", colour: "#E8571A", icon: "ScrollText", renderer: "instruction", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "text", label: "System prompt", type: "text", required: true }] } },
  { key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A", icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Prompt text", type: "text", required: true }] } },
  { key: "screenshot", label: "Screenshot", category: "evidence", colour: "#2EC4B6", icon: "Camera", renderer: "evidence", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "media_id", label: "Media", type: "string", format: "media_id" }] } },
];

function node(id: string, type: string, title: string, payload: Record<string, unknown>, children: NodeTree[] = []): NodeTree {
  return {
    id, build_id: "11111111-0000-4000-8000-000000000001", parent_id: null, position: 0, type, title,
    note: null, payload, source_ref: null, event_id: null, is_gap: false,
    created_at: "2026-07-28T08:40:00Z", children,
  } as unknown as NodeTree;
}

const record = {
  build: {
    id: "11111111-0000-4000-8000-000000000001",
    creator_id: "22222222-0000-4000-8000-000000000001",
    slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent",
    outcome: "Sorts a full inbox.",
    shape: "app",
    made_for: ["founder"],
    made_with: ["Claude Opus 4.5"],
    live_url: null, repo_url: null, hero_node_id: null,
    cost_setup: 0, cost_monthly: null, currency: "GBP", time_to_first_result: 35,
  },
  tree: [
    node("11111111-2000-4000-8000-000000000002", "agent_config", "Triage agent configuration", { model: "claude-opus-4-5" }, [
      node("11111111-2000-4000-8000-000000000007", "system_prompt", "Triage system prompt", { text: "You triage a professional inbox." }, [
        node("11111111-2000-4000-8000-00000000000b", "prompt", "Per-email classify call", { text: "Classify." }),
      ]),
    ]),
  ],
  tray: [node("11111111-2000-4000-8000-00000000000d", "screenshot", "Triage view, second draft", { media_id: "shots/v2.png" })],
  events: [],
  nodeTypes,
} as unknown as BuildRecord;

afterEach(() => vi.restoreAllMocks());

/** jsdom's Blob has no text(). FileReader is the route that works there. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("PortableExport", () => {
  it("copies the markdown for an AI tool", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<PortableExport record={record} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const markdown = writeText.mock.calls[0][0] as string;
    expect(markdown.startsWith("# Inbox triage agent\n")).toBe(true);
    expect(markdown).toContain("## Steps");
    expect(markdown).toContain("You triage a professional inbox.");
    expect(await screen.findByRole("button", { name: "✓ Copied for AI" })).toBeTruthy();
  });

  it("downloads the record as <slug>.neoscale.json", async () => {
    let blob: Blob | undefined;
    const createObjectURL = vi.fn((value: Blob) => {
      blob = value;
      return "blob:neoscale";
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    render(<PortableExport record={record} />);

    // The anchor is created, clicked and removed inside one handler, so it is
    // caught on its way into the document rather than looked for afterwards.
    const appended = vi.spyOn(document.body, "appendChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    const anchor = appended.mock.calls
      .map((call) => call[0])
      .find((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement);

    expect(anchor?.getAttribute("download")).toBe("inbox-triage-agent-demo.neoscale.json");
    expect(anchor?.getAttribute("href")).toBe("blob:neoscale");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:neoscale");
    // Nothing is left behind in the document.
    expect(document.querySelector("a[download]")).toBeNull();

    const parsed = JSON.parse(await readBlob(blob as Blob));
    expect(parsed.neoscale_build).toBe(1);
    expect(parsed.nodes[0].children[0].children[0].title).toBe("Per-email classify call");
    expect(parsed.nodes[0].children[0].children[0].path).toBe("1.1.1");
    expect(JSON.stringify(parsed)).not.toContain("Triage view, second draft");
    expect(await screen.findByRole("button", { name: "✓ Downloaded" })).toBeTruthy();
  });
});
