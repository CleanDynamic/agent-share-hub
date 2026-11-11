// UX-02 P2: a source file has a way into a session. Its menu: Open file, Add to session (a submenu of the build's sessions), then
// Remove file. The panel by role and accessible name; then the composer mounted for real, where Add to session writes a File step
// tile at the end of that session and tells the List it is an add.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { sandboxSourcesProps } from "@/dev/fixtures/sandbox";
import { tableRows } from "@/lib/build/__audit__/fakeSupabase";

import { IDS, KEY_A, seedCa20 } from "./ca20Fixture";
import { DRAFT, harnessAfter, harnessBefore, mountCa20 } from "./ca20Harness";
import { MotionChannel } from "./listMotion";
import { SourcesPanel, type SourcesPanelProps } from "./SourcesPanel";

const openMenu = (name: string) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });

describe("UX-02 P2 · the file's menu", () => {
  beforeEach(() => vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })));
  afterEach(harnessAfter);

  function panel(over: Partial<SourcesPanelProps> = {}) {
    const props: SourcesPanelProps = {
      ...sandboxSourcesProps("bakery"),
      sessions: [
        { key: "s1", number: 1, tool: "Claude Code", detail: "", prompts: [] },
        { key: "s2", number: 2, tool: "ChatGPT", detail: "", prompts: [] },
      ],
      files: [{ id: "f1", name: "brief.md", note: "added by you" }],
      onSelect: vi.fn(),
      onAddSession: vi.fn(),
      onDropFiles: vi.fn(),
      onPick: vi.fn(),
      onRemoveFile: vi.fn(),
      onAddFileToSession: vi.fn(),
      ...over,
    };
    render(
      <MemoryRouter>
        <SourcesPanel {...props} />
      </MemoryRouter>,
    );
    return props;
  }

  it("lists Open file, Add to session and Remove file, in that order", () => {
    panel();
    openMenu("brief.md options");
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Open file", "Add to session", "Remove file"]);
  });

  it("Open file selects the file, as selecting a step does", () => {
    const props = panel();
    openMenu("brief.md options");
    fireEvent.click(screen.getByRole("menuitem", { name: "Open file" }));
    expect(props.onSelect).toHaveBeenCalledWith("f1");
  });

  it("Add to session opens the build's sessions; choosing one adds the file there", async () => {
    const props = panel();
    openMenu("brief.md options");
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Add to session" }), { key: "ArrowRight" });
    const session = await screen.findByRole("menuitem", { name: "Session 1 · Claude Code" });
    expect(screen.getByRole("menuitem", { name: "Session 2 · ChatGPT" })).toBeTruthy();
    fireEvent.click(session);
    expect(props.onAddFileToSession).toHaveBeenCalledWith("f1", "s1");
  });

  it("Remove file is as it was", () => {
    const props = panel();
    openMenu("brief.md options");
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove file" }));
    expect(props.onRemoveFile).toHaveBeenCalledWith("f1");
  });
});

describe("UX-02 P2 · Add to session on the composer", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("writes a File step at the end of that session, with the same stored file, labelled an add", async () => {
    const SOURCE = "0c1c1c1c-0000-4000-8000-000000000099";
    await mountCa20(
      (rows) => {
        seedCa20(rows);
        rows.build_nodes.push({ id: SOURCE, build_id: DRAFT, parent_id: null, position: 9, type: "document", title: null, note: null, payload: { title: "brief.md", media_id: "0f0f0f0f-0000-4000-8000-000000000001" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" });
      },
      { wide: true },
    );
    const expect_ = vi.spyOn(MotionChannel.prototype, "expect");
    fireEvent.keyDown(await screen.findByRole("button", { name: "brief.md options" }, { timeout: 10_000 }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Add to session" }), { key: "ArrowRight" });
    await act(async () => fireEvent.click(await screen.findByRole("menuitem", { name: /^Session 1 · / })));
    const tiles = () => tableRows("build_nodes").filter((row) => row.build_id === DRAFT && row.id !== SOURCE && (row.payload as { media_id?: string }).media_id === "0f0f0f0f-0000-4000-8000-000000000001");
    await waitFor(() => expect(tiles()).toHaveLength(1), { timeout: 10_000 });
    const [tile] = tiles();
    expect(tile.payload).toMatchObject({ step: true, session: KEY_A, title: "brief.md" });
    const inA = tableRows("build_nodes")
      .filter((row) => row.build_id === DRAFT && row.parent_id === null && (row.payload as { session?: string }).session === KEY_A)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((row) => row.id);
    expect(inA).toEqual([IDS.p1, IDS.p2, tile.id]);
    expect(expect_).toHaveBeenCalledWith(expect.objectContaining({ kind: "add", keys: [tile.id] }));
  });
});
