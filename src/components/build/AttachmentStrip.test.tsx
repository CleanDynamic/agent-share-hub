// The prompt's attachments: the tile's strip, the reader's message, and the window's Attached section.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build/media", async (importActual) => ({ ...(await importActual<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(async () => null), signedMediaUrl: vi.fn(async () => null) }));

import { buildSteps, type Use } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { MessageMetaLine, ReaderAttachmentStrip, TileAttachmentStrip } from "./AttachmentStrip";
import { FullPromptWindow } from "./FullPromptWindow";
import { metaLine } from "@/lib/build/attachments";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [], ...over }) as NodeTree;
const use = (id: string): Use => ({ kind: "file", node_id: id });

function steps(count: number, extra: Record<string, unknown> = {}) {
  const ids = Array.from({ length: count }, (_, i) => `f${i + 1}`);
  return buildSteps([
    node({ id: "p1", payload: { text: "Prompt example.", settings: { model: "claude-opus-5-5", effort: "medium", instructions: "" }, uses: ids.map(use), ...extra } as unknown as NodeTree["payload"] }),
    ...ids.map((id, i) => node({ id, type: "document", position: i + 2, payload: { title: i === count - 1 ? "notes.md" : `shot-${i + 1}.png`, media_id: `m${i}`, size: 812, attached: true, ...(i === 0 ? { note: "Pricing reference" } : null) } })),
  ]);
}

describe("the tile's strip", () => {
  it("draws pictures as 56 thumbnails and files as chips with their size, and counts what does not fit", () => {
    const [prompt] = steps(8);
    render(<TileAttachmentStrip attachments={prompt.attachments ?? []} phone={false} />);
    const strip = screen.getByTestId("attachment-strip");
    expect(strip.getAttribute("data-size")).toBe("56");
    expect(within(strip).getAllByTestId("attachment-thumb")).toHaveLength(6);
    expect(screen.getByTestId("attachment-more").textContent).toBe("+2");
  });

  it("uses 48 on a phone", () => {
    const [prompt] = steps(3);
    render(<TileAttachmentStrip attachments={prompt.attachments ?? []} phone />);
    expect(screen.getByTestId("attachment-strip").getAttribute("data-size")).toBe("48");
    expect(screen.getByTestId("attachment-chip").textContent).toContain("notes.md");
  });
});

describe("the reader sees one message", () => {
  it("draws the strip at 72 with each note under it, then the meta line", () => {
    const [prompt] = steps(4);
    render(
      <>
        <ReaderAttachmentStrip attachments={prompt.attachments ?? []} />
        <MessageMetaLine line={metaLine(prompt.settings?.model ?? null, prompt.settings, prompt.context)} />
      </>,
    );
    expect(screen.getByTestId("attachment-strip").getAttribute("data-size")).toBe("72");
    expect(screen.getAllByRole("button", { name: /^Open / }).map((button) => button.getAttribute("aria-label"))).toEqual(["Open shot-1.png", "Open shot-2.png", "Open shot-3.png", "Open notes.md"]);
    expect(screen.getByTestId("attachment-note").textContent).toBe("Pricing reference");
    expect(screen.getByTestId("message-meta").textContent).toBe("Opus 5.5 · Medium effort");
  });

  it("draws a placeholder as a dashed chip that says it was not imported", () => {
    const [prompt] = buildSteps([node({ id: "p1", payload: { text: "Hi", uses: [use("f1")] } as unknown as NodeTree["payload"] }), node({ id: "f1", type: "document", position: 2, payload: { title: "shot.png", attached: true } })]);
    render(<ReaderAttachmentStrip attachments={prompt.attachments ?? []} />);
    expect(screen.getByTestId("attachment-placeholder").textContent).toBe("Not imported: attach shot.png");
  });
});

describe("the window's Attached section", () => {
  it("lists them, moves one from its menu, and removes one only after asking", async () => {
    const onOrder = vi.fn();
    const onRemove = vi.fn();
    render(
      <MemoryRouter>
        <FullPromptWindow steps={steps(3)} openId="p1" mode="maker" onTitle={vi.fn()} onExtras={vi.fn()} onClose={vi.fn()} onAttach={vi.fn()} onOrderAttachments={onOrder} onRemoveAttachment={onRemove} onAttachmentExtras={vi.fn()} />
      </MemoryRouter>,
    );
    const section = screen.getByTestId("attached-section");
    expect(within(section).getAllByTestId("attached-item").map((item) => item.getAttribute("aria-label"))).toEqual(["shot-1.png", "shot-2.png", "notes.md"]);
    fireEvent.click(within(section).getByRole("button", { name: "Remove shot-2.png" }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(within(section).getByText("Remove this attachment?")).toBeTruthy();
    fireEvent.click(within(section).getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("p1", "f2");
    expect(within(section).getByRole("switch", { name: "Attached after the text" }).getAttribute("aria-checked")).toBe("false");
  });

  it("offers the six efforts with Not given first", () => {
    render(
      <MemoryRouter>
        <FullPromptWindow steps={steps(1)} openId="p1" mode="maker" onTitle={vi.fn()} onExtras={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    const toggle = screen.queryByTestId("optional-toggle");
    if (toggle && toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
    const efforts = screen.getByRole("radiogroup", { name: "Reasoning effort" });
    expect(within(efforts).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Not given", "Low", "Medium", "High", "Extra high", "Max"]);
  });
});
