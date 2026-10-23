// CA-15 P9: a System prompt, a Dataset and a GitHub repository drawn as tiles in the composer's list.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { BuildList, type BuildListProps } from "./BuildList";

vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(() => Promise.resolve(null)) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let seq = 0;
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: `n${++seq}`, build_id: "b", parent_id: null, position: seq, type: "prompt", title: null, note: null, payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

function show(nodes: NodeTree[]) {
  const base = sandboxListProps("bakery");
  const props = {
    ...base,
    steps: buildSteps(nodes),
    dividers: new Map(),
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
  } as unknown as BuildListProps;
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

const card = (kind: string) => screen.getAllByTestId("step-card").find((el) => el.getAttribute("data-kind") === kind) as HTMLElement;

describe("a system prompt tile", () => {
  const system = () => node({ id: "sp", type: "system_prompt", title: "Brand voice", payload: { step: true, text: "Write in {tone}. Never use buzzwords.", scope: "all", version: "v2" } });

  it("has its type line, its title, its text with each variable drawn as a chip, braces left off, and a footer of facts", () => {
    show([system()]);
    const tile = card("system_prompt");
    expect(tile.getAttribute("aria-label")).toBe("System prompt 1: Brand voice");
    expect(within(tile).getByTestId("system_prompt-eyebrow").textContent).toBe("System prompt · Applies to 0 prompts");
    expect(within(tile).getByTestId("system-prompt-text").textContent).toBe("Write in tone. Never use buzzwords.");
    expect(within(tile).getAllByTestId("variable-chip").map((chip) => chip.textContent)).toEqual(["tone"]);
    expect(within(tile).getByTestId("tile-footer-facts").textContent).toBe("1 variable · v2");
  });

  it("clamps its text to two lines", () => {
    show([system()]);
    const textLine = within(card("system_prompt")).getByTestId("system-prompt-text");
    expect(textLine.style.overflow).toBe("hidden");
    expect(textLine.style.display).toBe("-webkit-box");
  });

  it("selects on a click, and on Enter when the tile itself has focus", () => {
    const props = show([system()]);
    fireEvent.click(card("system_prompt"));
    expect(props.onSelect).toHaveBeenCalledWith("sp");
    vi.mocked(props.onSelect).mockClear();
    fireEvent.keyDown(card("system_prompt"), { key: "Enter" });
    expect(props.onSelect).toHaveBeenCalledWith("sp");
  });
});

describe("a dataset tile", () => {
  it("shows what it is on one line, its columns on another, and its format, columns and records in the footer", () => {
    show([node({ id: "ds", type: "dataset", title: "Tickets", payload: { step: true, description: "Support tickets from 2025", use: "evaluation", format: "CSV", columns: ["id", "subject", "team"], record_count: 1200 } })]);
    const tile = card("dataset");
    expect(within(tile).getByTestId("dataset-eyebrow").textContent).toBe("Dataset · Evaluation");
    expect(within(tile).getByTestId("dataset-description").textContent).toBe("Support tickets from 2025");
    expect(within(tile).getByTestId("dataset-columns").textContent).toBe("id · subject · team");
    expect(within(tile).getByTestId("tile-footer-facts").textContent).toBe("CSV · 3 columns · 1,200 records");
  });

  it("draws no empty line and no footer for a dataset that gives only its description", () => {
    show([node({ id: "ds", type: "dataset", title: "Tickets", payload: { step: true, description: "Support tickets" } })]);
    const tile = card("dataset");
    expect(within(tile).queryByTestId("dataset-columns")).toBeNull();
    expect(within(tile).queryByTestId("tile-footer")).toBeNull();
  });
});

describe("a GitHub repository tile", () => {
  const repo = (extra: Record<string, unknown> = {}) => node({ id: "rp", type: "repo", payload: { step: true, url: "github.com/acme/shop", ownership: "third_party", ...extra } });

  it("is titled by owner and name, with its link and no body when it has no description or usage", () => {
    show([repo()]);
    const tile = card("repo");
    expect(tile.getAttribute("aria-label")).toBe("GitHub repository 1: acme/shop");
    expect(within(tile).getByTestId("repo-eyebrow").textContent).toBe("GitHub repository · Third-party");
    expect(within(tile).queryByTestId("repo-tile")).toBeNull();
    const link = within(tile).getByRole("link", { name: "Open on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/shop");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows its description and how it was used, and its language, licence and author in the footer", () => {
    show([repo({ description: "A shop router", usage: ["copied", "docs"], language: "Go", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", author: "acme" })]);
    const tile = card("repo");
    expect(within(tile).getByTestId("repo-description").textContent).toBe("A shop router");
    expect(within(tile).getByTestId("repo-usage").textContent).toBe("Copied source code · Followed its documentation");
    expect(within(tile).getByTestId("tile-footer-facts").textContent).toBe("Go · MIT · Author acme");
  });

  it("opening the link does not select the tile", () => {
    const props = show([repo()]);
    fireEvent.click(within(card("repo")).getByRole("link", { name: "Open on GitHub" }));
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
