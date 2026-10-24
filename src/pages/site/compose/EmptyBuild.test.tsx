// CA-24 P2 - the empty build: its words, the count, what each row does, and the drop zone.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmptyBuild, type EmptyBuildProps } from "./EmptyBuild";
import { EMPTY_BUILD_COPY, emptyDrop } from "./emptyBuildRecipes";
import type { SourceLibraryItem } from "./sourcesModel";

const item = (over: Partial<SourceLibraryItem> & { id: string }): SourceLibraryItem => ({
  label: "Claude",
  line: "",
  adding: false,
  inThisDraft: false,
  alsoIn: null,
  firstPrompt: "Plan the launch email",
  date: "22 Oct",
  promptCount: 3,
  app: "Claude",
  appKnown: true,
  model: null,
  createdAt: "2026-10-22T09:00:00Z",
  draftCount: 0,
  ...over,
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(over: Partial<EmptyBuildProps> = {}, library: SourceLibraryItem[] = [item({ id: "a" }), item({ id: "b" })]) {
  const props: EmptyBuildProps = {
    phone: false,
    fine: true,
    available: library.filter((row) => !row.inThisDraft).length,
    addSession: { library, adding: false, onAdd: vi.fn(), onStartNew: vi.fn() },
    onDropFiles: vi.fn(),
    onPick: vi.fn(),
    ...over,
  };
  render(<EmptyBuild {...props} />);
  return props;
}

describe("what it says", () => {
  it("has the heading, two rows and the drop zone, in the board's words", () => {
    mount({ available: 8 });
    expect(screen.getByRole("heading", { name: "Add your first session" })).toBeTruthy();
    const chats = screen.getByTestId("empty-build-chats");
    expect(chats.textContent).toBe("Import from connected chats8 available");
    expect(screen.getByTestId("empty-build-new").textContent).toBe("New empty session");
    expect(screen.getByTestId("empty-build-drop").textContent).toBe("Drop sessions or files");
  });

  it("counts the library rows not yet in this build", () => {
    mount({ available: 3 });
    expect(within(screen.getByTestId("empty-build-chats")).getByText("3 available")).toBeTruthy();
    expect(EMPTY_BUILD_COPY.availableOf(0)).toBe("0 available");
  });

  it("draws the box as the board does: a window, two rows of 56 with a rule between, a 24 mark and a chevron each", () => {
    // jsdom drops a var() colour from the DOM, so the paint is read from the markup.
    const html = renderToStaticMarkup(<EmptyBuild phone={false} fine available={2} addSession={{ library: [], adding: false, onAdd: () => undefined, onStartNew: () => undefined }} onDropFiles={() => undefined} onPick={() => undefined} />).replace(/\s+/g, " ");
    expect(html).toContain("background:var(--window);border:1px solid var(--window-border);border-radius:12px;padding:4px 14px;box-shadow:none");
    expect(html.match(/height:56px/g)).toHaveLength(2);
    expect(html.match(/width:24px;height:24px/g)).toHaveLength(2);
    expect(html).toContain("background:var(--control);border:1px solid var(--control-border);border-radius:5px");
    expect(html).toContain("border-top:1px solid var(--hairline)");
    expect(html.match(/<svg/g)).toHaveLength(2);
    mount();
    // The first row sits in the picker's anchor, so the box holds: the anchor, the rule, the second row.
    const box = screen.getByTestId("empty-build-chats").parentElement?.parentElement as HTMLElement;
    expect(box.children).toHaveLength(3);
  });
});

describe("what the rows do", () => {
  it("Import from connected chats opens the list of connected chats; choosing one adds it", () => {
    const props = mount();
    fireEvent.click(screen.getByTestId("empty-build-chats"));
    const picker = screen.getByTestId("add-session-picker");
    expect(within(picker).getAllByTestId("library-row")).toHaveLength(2);
    fireEvent.click(within(picker).getAllByTestId("library-row")[0]);
    expect(props.addSession.onAdd).toHaveBeenCalledWith("a");
  });

  it("New empty session runs the page's start-a-session", () => {
    const props = mount();
    fireEvent.click(screen.getByTestId("empty-build-new"));
    expect(props.addSession.onStartNew).toHaveBeenCalledTimes(1);
    expect(props.addSession.onAdd).not.toHaveBeenCalled();
  });

  it("holds both rows while a session is being added", () => {
    mount({ addSession: { library: [], adding: true, onAdd: vi.fn(), onStartNew: vi.fn() } });
    expect((screen.getByTestId("empty-build-chats") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("empty-build-new") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the drop zone", () => {
  const drop = (files: File[]) => ({ dataTransfer: { types: ["Files"], files, items: [], dropEffect: "none" } });

  it("is 64 tall with a dashed skeleton edge, radius 10, and takes the target edge while a file is over it", () => {
    mount();
    const zone = screen.getByTestId("empty-build-drop");
    expect(zone.getAttribute("data-over")).toBeNull();
    fireEvent.dragEnter(zone, drop([]));
    expect(zone.getAttribute("data-over")).toBe("true");
    fireEvent.dragLeave(zone);
    expect(zone.getAttribute("data-over")).toBeNull();
    const drawn = (over: boolean) => emptyDrop(over);
    expect(drawn(false)).toMatchObject({ height: 64, borderRadius: 10, border: "1px dashed var(--skeleton-edge)" });
    expect(drawn(true).border).toBe("1px dashed var(--skeleton-target)");
    expect(renderToStaticMarkup(<div style={drawn(false)} />)).toContain("border:1px dashed var(--skeleton-edge)");
    expect(renderToStaticMarkup(<div style={drawn(true)} />)).toContain("border:1px dashed var(--skeleton-target)");
  });

  it("hands dropped files to onDropFiles, a chat export among them", () => {
    const props = mount();
    const notes = new File(["hello"], "notes.txt", { type: "text/plain" });
    const chat = new File(["{}"], "conversations.json", { type: "application/json" });
    fireEvent.drop(screen.getByTestId("empty-build-drop"), drop([notes, chat]));
    expect(props.onDropFiles).toHaveBeenCalledWith([notes, chat]);
  });

  it("ignores a drag that carries no files", () => {
    const props = mount();
    fireEvent.drop(screen.getByTestId("empty-build-drop"), { dataTransfer: { types: ["text/plain"], files: [], items: [] } });
    expect(props.onDropFiles).not.toHaveBeenCalled();
  });

  it("is a button that opens the file picker where there is no mouse", () => {
    const props = mount({ fine: false });
    const zone = screen.getByTestId("empty-build-drop");
    expect(zone.tagName).toBe("BUTTON");
    fireEvent.click(zone);
    expect(props.onPick).toHaveBeenCalledTimes(1);
  });
});
