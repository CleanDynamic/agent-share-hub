// UI-P93 — the current view's own suite, run against the refined fork under `?look=refined` (same names, handlers and
// behaviour), then a block for what the refined board draws. Styles are read through SSR markup.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { SandboxView as SandboxView } from "./SandboxView";
import { ADD_ITEMS, LIST_HINT, addEntries, countsLine, listHint, notSavedLine, type SandboxViewProps } from "./SandboxView";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

function view(over: Partial<SandboxViewProps> = {}) {
  const props = { ...sandboxViewProps("bakery"), onPublish: vi.fn(), onLens: vi.fn(), ...over };
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
      <SandboxView {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => {
  stubWidth(1440);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(cleanup);

describe("countsLine", () => {
  it("leaves out any zero", () => {
    expect(countsLine({ sessions: 3, prompts: 12, files: 2 })).toBe("3 sessions · 12 prompts · 2 files");
    expect(countsLine({ sessions: 1, prompts: 1, files: 0 })).toBe("1 session · 1 prompt");
    expect(countsLine({ sessions: 0, prompts: 0, files: 0 })).toBe("");
  });
});

describe("the Sources rail in Map", () => {
  it("folds Sources to a rail of 40-wide buttons with counts, and Show sources puts the panel back until it is closed", () => {
    view({ lens: "map", sources: <p>the sources panel</p> });
    const rail = screen.getByTestId("sources-rail");
    expect(within(rail).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Show sources", "Sessions", "Files", "Add a source"]);
    expect(within(rail).getByRole("button", { name: "Sessions" }).textContent).toBe("3");
    expect(within(rail).getByRole("button", { name: "Files" }).textContent).toBe("2");
    expect(screen.queryByText("the sources panel")).toBeNull();

    fireEvent.click(within(rail).getByRole("button", { name: "Show sources" }));
    expect(screen.getByTestId("sources-overlay")).toBeTruthy();
    expect(screen.getByText("the sources panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close sources" }));
    expect(screen.queryByTestId("sources-overlay")).toBeNull();
  });

  it("closes the opened panel on Esc, and is the full panel again in List", () => {
    view({ lens: "map", sources: <p>the sources panel</p> });
    fireEvent.click(screen.getByRole("button", { name: "Show sources" }));
    fireEvent.keyDown(screen.getByText("the sources panel"), { key: "Escape" });
    expect(screen.queryByTestId("sources-overlay")).toBeNull();
    cleanup();
    view({ lens: "list", sources: <p>the sources panel</p> });
    expect(screen.queryByTestId("sources-rail")).toBeNull();
    expect(screen.getByText("the sources panel")).toBeTruthy();
  });
});

describe("SandboxView frame", () => {
  it("draws Sources, Build and Details, and one primary button", () => {
    view();
    for (const name of ["Sources", "Build", "Details"]) expect(screen.getByRole("region", { name })).toBeTruthy();
    expect(screen.getByText("Select a prompt, session or file to see it here.")).toBeTruthy();
    expect(document.querySelectorAll('[data-variant="primary"]').length).toBe(1);
    expect(screen.getByTestId("sandbox-counts").textContent).toBe("3 sessions · 12 prompts · 2 files");
  });


  it("shows the Map tab only when Map is available, with the one-time line just after the tabs", () => {
    view();
    const tabs = screen.getByRole("group", { name: "Build view" });
    expect(within(tabs).getAllByRole("button").map((tab) => tab.textContent)).toEqual(["List", "Map"]);
    expect(within(tabs).getByText("Map is now available")).toBeTruthy();
    cleanup();
    view({ mapAvailable: false, mapHint: false });
    expect(screen.queryByRole("button", { name: "Map" })).toBeNull();
    expect(screen.queryByText("Map is now available")).toBeNull();
  });

  it("lists the twelve Add items in order, with no session in them (CA-12 P4, CA-15 P9); the three new tiles are live only once their node type is", () => {
    expect(ADD_ITEMS.map((item) => item.name)).toEqual(["Prompt", "Agent", "Decision", "System prompt", "File", "Dataset", "Tool", "GitHub repository", "Manual step", "Code", "Check", "Result"]);
    expect(ADD_ITEMS.filter((item) => item.ready).map((item) => item.key)).toEqual(["prompt", "agent", "decision", "file", "tool", "manual", "code", "check", "result"]);
    expect(ADD_ITEMS.find((item) => item.key === "code")?.line).toBe("Source code written or run");
    expect(ADD_ITEMS.find((item) => item.key === "check")).toEqual({ key: "check", name: "Check", line: "A test that verifies part of the build", ready: true });
  });

  it("turns System prompt, Dataset and GitHub repository on when their node type is live and a handler is given (CA-15 P9)", () => {
    const off = addEntries({ onAddSystemPrompt: vi.fn() });
    expect(off.find((item) => item.key === "system_prompt")?.enabled).toBe(false);
    const on = addEntries({ onAddSystemPrompt: vi.fn(), onAddDataset: vi.fn(), onAddRepo: vi.fn(), systemPromptAvailable: true, datasetAvailable: true, repoAvailable: true });
    expect(on.filter((item) => ["system_prompt", "dataset", "repo"].includes(item.key)).map((item) => item.enabled)).toEqual([true, true, true]);
    expect(on.find((item) => item.key === "repo")?.line).toBe("A repository used in this build");
  });

  it("lists Check but disables it until the build has an agent, a team or code (CA-03 P5)", () => {
    const onAddCheck = vi.fn();
    const off = addEntries({ onAddCheck, checkable: false }).find((item) => item.key === "check");
    expect(off).toMatchObject({ name: "Check", line: "Add an agent or code first", enabled: false });
    const on = addEntries({ onAddCheck, checkable: true }).find((item) => item.key === "check");
    expect(on).toMatchObject({ name: "Check", line: "A test that verifies part of the build", enabled: true });
    on?.onSelect?.();
    expect(onAddCheck).toHaveBeenCalledTimes(1);
    expect(addEntries({ checkable: true }).find((item) => item.key === "check")?.enabled).toBe(false);
  });

  it("opens the Classification Card from its button with the title, the preview and the Optional rows closed", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Classification Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).getByLabelText("Title")).toBeTruthy();
    expect(within(card).getByTestId("card-preview")).toBeTruthy();
    for (const name of ["Summary", "Build details"]) expect(within(card).getByRole("button", { name: new RegExp(`^${name}`) }).getAttribute("aria-expanded")).toBe("false");
    expect(within(card).queryByText("Cover")).toBeNull();
    expect(within(card).queryByLabelText("Who it's for")).toBeNull();
  });
});

describe("SandboxView on a phone", () => {
  it("is one column with Sources and Details behind buttons, and never Map", () => {
    stubWidth(390);
    view({ lens: "map" });
    expect(screen.queryByRole("group", { name: "Build view" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sources" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  });
});

describe("the Add menu (UI-P69)", () => {
  it("opens the Add dialog from Add › Agent", async () => {
    const onAddAgent = vi.fn();
    view({ onAddAgent });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: /^Agent/ });
    expect(item.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(item);
    expect(onAddAgent).toHaveBeenCalled();
  });

  it("leaves Agent disabled when nothing opens the dialog", async () => {
    view();
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: /^Agent/ });
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("the Add menu holds exactly 12 items, all enabled (UI-P70, CA-02 P7, CA-03 P5, CA-12 P4)", () => {
  it("enables every item once each has something to open", async () => {
    view({
      onAddCheck: vi.fn(),
      checkable: true,
      onAddFile: vi.fn(),
      onAddTool: vi.fn(),
      onAddResult: vi.fn(),
      onAddPromptFocus: vi.fn(),
      onAddAgent: vi.fn(),
      onAddDecision: vi.fn(),
      onAddManual: vi.fn(),
      onAddCode: vi.fn(),
      onAddSystemPrompt: vi.fn(),
      onAddDataset: vi.fn(),
      onAddRepo: vi.fn(),
      systemPromptAvailable: true,
      datasetAvailable: true,
      repoAvailable: true,
    });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(12);
    expect(items[0].textContent).toBe("PromptA message sent to a model");
    expect(items.map((item) => item.getAttribute("aria-disabled"))).toEqual(Array(12).fill(null));
    expect(items.map((item) => item.textContent).join(" ")).not.toMatch(/session/i);
  });

  it("lists Check disabled, saying why, when the build has nothing to check (CA-03 P5)", async () => {
    view({ onAddCheck: vi.fn(), checkable: false });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const check = await screen.findByRole("menuitem", { name: /^Check/ });
    expect(check.getAttribute("aria-disabled")).toBe("true");
    expect(check.textContent).toBe("CheckAdd an agent or code first");
  });

  it("opens the code dialog from Add › Code, and leaves it disabled when nothing opens it", async () => {
    const onAddCode = vi.fn();
    view({ onAddCode });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Code/ }));
    expect(onAddCode).toHaveBeenCalled();
    cleanup();
    view();
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    expect((await screen.findByRole("menuitem", { name: /^Code/ })).getAttribute("aria-disabled")).toBe("true");
  });

  it("opens the manual step dialog from Add › Manual step", async () => {
    const onAddManual = vi.fn();
    view({ onAddManual });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Manual step/ }));
    expect(onAddManual).toHaveBeenCalled();
  });
});

describe("the refined look (UI-P93)", () => {
  const markup = (over: Partial<SandboxViewProps> = {}) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <SandboxView {...sandboxViewProps("bakery")} {...over} />
      </MemoryRouter>,
    );

  it("draws the title row under a hairline, 34 in at the sides: the title and its status line at the left, Card and Preview as secondary 28 and Publish as the one primary 28 (CA-17 P6)", () => {
    view();
    const row = screen.getByTestId("sandbox-tabrow");
    expect(row.getAttribute("style") ?? "").toContain("padding: 10px 33px 0px 137px");
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("style")).toMatch(/font-size:\s*20px/);
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish.getAttribute("data-variant")).toBe("primary");
    expect(publish.getAttribute("style")).toMatch(/height:\s*28px/);
    const card = screen.getByRole("button", { name: "Classification Card" });
    expect(card.getAttribute("data-variant")).toBe("secondary");
    expect(card.textContent).toBe("Card");
    expect(screen.getByRole("link", { name: "Preview" }).getAttribute("style")).toMatch(/height:\s*28px/);
    // The three sit 8 apart.
    expect(within(row).getByRole("link", { name: "Preview" }).parentElement?.getAttribute("style")).toContain("gap: 8px");
  });

  it("draws List and Map at 13, the selected one in --text at 500 with a 1.5px line under it (CA-17 P6)", () => {
    view({ lens: "list" });
    const list = screen.getByTestId("sandbox-tab-list");
    const map = screen.getByTestId("sandbox-tab-map");
    expect(list.getAttribute("aria-pressed")).toBe("true");
    expect(list.getAttribute("style")).toContain("font-weight: 500");
    expect(list.getAttribute("style")).toContain("font-size: 13px");
    expect(list.getAttribute("style")).toContain("padding: 0px 0px 13px");
    expect(list.getAttribute("style")).toContain("inset 0 -1.5px 0");
    expect(map.getAttribute("style")).toContain("font-weight: 400");
    expect(map.getAttribute("style")).not.toContain("inset");
    expect(screen.getByTestId("sandbox-tabs").getAttribute("style")).toContain("gap: 22px");
    fireEvent.click(map);
  });

  it("keeps the draft's title and status line in the title row in List and Map, the post heading the List's Build column (CA-18 P4)", () => {
    view({ lens: "list" });
    const head = screen.getByTestId("sandbox-build-head");
    // The title and its status line are in the title row; the post heads the column, 18 above the hairline (CA-18 P4).
    expect(within(head).queryByRole("heading", { level: 1 })).toBeNull();
    expect(within(screen.getByTestId("sandbox-tabrow")).getByTestId("sandbox-status")).toBeTruthy();
    expect(markup()).toContain("padding-bottom:18px;border-bottom:1px solid var(--hairline)");
    expect(within(screen.getByTestId("sandbox-tabrow")).getByRole("heading", { level: 1 })).toBeTruthy();
    cleanup();
    view({ lens: "map" });
    expect(screen.queryByTestId("sandbox-build-head")).toBeNull();
    expect(within(screen.getByTestId("sandbox-tabrow")).getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("puts Sources on the surface, 216 wide, with a hairline on its right", () => {
    const html = markup();
    expect(html).toContain("flex:0 0 216px;width:216px;box-sizing:border-box;padding-right:24px;border-right:1px solid var(--hairline)");
    expect(html).toContain("flex:0 1 640px;width:640px");
  });

  it("CA-18b: stands the three columns where frameOf puts them at 1440, not in a row", () => {
    const html = markup();
    // Window 1440: Build 640 from 400, Sources 216 from 144, Details 1080 wide room 320. The surface's 6, its border and the 34 are taken off.
    expect(html).toContain("left:137px;width:216px");
    expect(html).toContain('<div style="margin-left:359px">');
    expect(html).toContain("left:1073px;width:320px");
    expect(html).toContain("position:relative;display:block;padding:32px 34px 0");
  });

  it("opens Add from a menu button with no icon of its own but the chevron", () => {
    view();
    const add = screen.getByTestId("sandbox-add");
    expect(add.getAttribute("data-ui")).toBe("menu-button");
    expect(add.textContent).toBe("Add");
  });
});

describe("the refined Map and Card (UI-P94)", () => {
  const markup = (over: Partial<SandboxViewProps> = {}) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <SandboxView {...sandboxViewProps("bakery")} {...over} />
      </MemoryRouter>,
    );

  it("draws the Sources rail as a module 52 wide, its buttons 40 wide, 36 high or 44 with a count", () => {
    view({ lens: "map", sources: <p>the sources panel</p> });
    const rail = screen.getByTestId("sources-rail");
    expect(rail.style.flex).toBe("0 0 52px");
    expect(rail.style.padding).toBe("8px 0px");
    expect(rail.style.borderRadius).toBe("8px");
    const show = within(rail).getByRole("button", { name: "Show sources" });
    expect([show.style.width, show.style.height]).toEqual(["40px", "36px"]);
    const sessions = within(rail).getByRole("button", { name: "Sessions" });
    expect(sessions.style.height).toBe("44px");
    expect((sessions.lastElementChild as HTMLElement).style.fontSize).toBe("10.5px");
    expect(markup({ lens: "map" })).toContain("width:28px;height:1px;background:var(--hairline-module)");
  });

  it("draws the map column and its panel beside the rail in Map, with no Build panel and no Details; the List keeps them (CA-17 P4)", () => {
    const map = markup({ lens: "map", map: <p>the map</p>, mapPanel: <aside>the panel</aside> });
    expect(map).toContain('data-testid="map-view"');
    expect(map).toContain("the map");
    expect(map).toContain("the panel");
    expect(map).not.toContain('aria-label="Build"');
    expect(map).not.toContain('aria-label="Details"');
    const list = markup({ lens: "list" });
    expect(list).not.toContain('data-testid="map-view"');
    expect(list).toContain('aria-label="Build"');
    expect(list).toContain('aria-label="Details"');
  });

  it("opens the Card as the modal window", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Classification Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(card.style.width).toBe("560px");
  });
});

/* ── PT-05: the post above the build ── */

function viewAt(entry: string, over: Partial<SandboxViewProps> = {}) {
  const props = { ...sandboxViewProps("bakery"), onPublish: vi.fn(), onLens: vi.fn(), post: <p contentEditable suppressContentEditableWarning>the post body</p>, sources: <p>the sources panel</p>, ...over };
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SandboxView {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("the post above the build", () => {
  it("heads the Build column, above the Build panel, with Sources and Details beside them and no tabs", () => {
    viewAt("/compose/x");
    const post = screen.getByRole("region", { name: "Post" });
    const build = screen.getByRole("region", { name: "Build" });
    expect(within(post).getByText("the post body")).toBeTruthy();
    expect(post.closest('[data-testid="sandbox-columns"]')).toBe(build.closest('[data-testid="sandbox-columns"]'));
    expect(screen.getByTestId("sandbox-tabrow").contains(screen.getByTestId("sandbox-heading"))).toBe(true);
    expect(post.compareDocumentPosition(build) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ["Sources", "Details"]) expect(screen.getByRole("region", { name })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("group", { name: "Upload steps" })).toBeNull();
    expect(screen.getByRole("group", { name: "Build view" })).toBeTruthy();
  });

  it("sits at the top of the Build head, 18 under it before the hairline", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/compose/x"]}>
        <SandboxView {...sandboxViewProps("bakery")} post={<p>the post body</p>} />
      </MemoryRouter>,
    );
    expect(markup).toMatch(/padding-bottom:18px;border-bottom:1px solid var\(--hairline\)"><section aria-label="Post"/);
    const style = /aria-label="Post"[^>]*style="([^"]*)"/.exec(markup)?.[1] ?? "";
    expect(style).not.toContain("background");
  });

  it("is not drawn without a post, nor in the Map view", () => {
    viewAt("/compose/x", { post: undefined });
    expect(screen.queryByRole("region", { name: "Post" })).toBeNull();
    cleanup();
    viewAt("/compose/x", { lens: "map" });
    expect(screen.queryByRole("region", { name: "Post" })).toBeNull();
  });

  it("puts a thread's waiting sentence in the status line", () => {
    viewAt("/compose/x", { threadNote: "Post 3 is over 1,000 characters", missing: [] });
    expect(screen.getByTestId("sandbox-status").textContent).toBe("Draft · saved · Post 3 is over 1,000 characters");
  });

  it("adds what kind of build it is after the save state (CA-03 P8)", () => {
    viewAt("/compose/x", { summary: "A team of 4 agents · checks its own work", missing: [] });
    expect(screen.getByTestId("sandbox-status").textContent).toBe("Draft · saved · A team of 4 agents · checks its own work");
    cleanup();
    viewAt("/compose/x", { summary: undefined, missing: [] });
    expect(screen.queryByTestId("sandbox-summary")).toBeNull();
  });
});

describe("the Card and the post", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());


  it("carries no cover line and no Edit the post: the cover is edited in the post", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "Classification Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).queryByText("The cover is the first picture in your post.")).toBeNull();
    expect(within(card).queryByRole("button", { name: "Edit the post" })).toBeNull();
  });

  it("keeps the Title, the Summary, Tools and stack with Made with, and Build details", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "Classification Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).getByLabelText("Title")).toBeTruthy();
    for (const name of ["Summary", "Build details"]) expect(within(card).getByRole("button", { name: new RegExp(`^${name}`) })).toBeTruthy();
  });
});

describe("the post on a phone", () => {
  it("heads the Build column too, with no tabs, and the action bar stays", () => {
    stubWidth(390);
    viewAt("/compose/x");
    const post = screen.getByRole("region", { name: "Post" });
    expect(post.compareDocumentPosition(screen.getByRole("region", { name: "Build" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Upload steps" })).toBeNull();
    expect(screen.getByRole("group", { name: "Actions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
  });
});

/* ── CA-10: menus fit the screen; every Add item visibly does something ── */

describe("CA-10 · the Add menu fits the screen and keeps the focus a row gives", () => {
  it("draws the menu no taller than Radix's available height, scrolling inside itself", async () => {
    view({ onAddFile: vi.fn() });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(menu.style.maxHeight).toBe("var(--radix-dropdown-menu-content-available-height)");
    expect(menu.style.overflowY).toBe("auto");
    expect(menu.style.overscrollBehavior).toBe("contain");
  });

  it("Add › Prompt leaves the caret in the field the row focused, not on Add", async () => {
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    const onAddPromptFocus = vi.fn(() => {
      field.focus({ preventScroll: true });
      return true;
    });
    view({ onAddPromptFocus });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Prompt/ }));
    expect(onAddPromptFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(field);
    // Radix hands focus back on a timer as the menu closes: it must not.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(field);
    field.remove();
  });

  it("a row that moves no focus leaves focus with Add as before", async () => {
    const onAddManual = vi.fn();
    view({ onAddManual });
    const add = screen.getByTestId("sandbox-add");
    add.focus();
    fireEvent.keyDown(add, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Manual step/ }));
    expect(onAddManual).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(add);
  });
});

describe("CA-10 · on a phone, Add opens as a bottom sheet", () => {
  const all = () => ({
    onAddCheck: vi.fn(),
    checkable: true,
    onAddFile: vi.fn(),
    onAddTool: vi.fn(),
    onAddResult: vi.fn(),
    onAddAgent: vi.fn(),
    onAddManual: vi.fn(),
    onAddCode: vi.fn(),
  });

  it("holds the same twelve items as 44pt rows under a plain Add heading, with a grab line", () => {
    stubWidth(390);
    view({ ...all(), onAddPromptFocus: vi.fn() });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByTestId("sandbox-add"));
    const sheet = screen.getByRole("dialog", { name: "Add" });
    expect(within(sheet).getByRole("heading", { name: "Add" }).textContent).toBe("Add");
    expect(within(sheet).getByTestId("sheet-grab-line")).toBeTruthy();
    const rows = within(within(sheet).getByRole("group", { name: "Add" })).getAllByRole("button");
    expect(rows.map((row) => row.firstChild?.textContent)).toEqual(ADD_ITEMS.map((item) => item.name));
    for (const row of rows) expect(row.style.minHeight).toBe("44px");
  });

  it("Prompt shuts the sheet and focuses the field in the same tap", async () => {
    stubWidth(390);
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    let sheetOpenAtFocus: boolean | null = null;
    const onAddPromptFocus = vi.fn(() => {
      sheetOpenAtFocus = screen.queryByRole("dialog", { name: "Add" }) !== null;
      field.focus({ preventScroll: true });
      return true;
    });
    view({ ...all(), onAddPromptFocus });
    fireEvent.click(screen.getByTestId("sandbox-add"));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Add" })).getByRole("button", { name: /^Prompt/ }));
    expect(sheetOpenAtFocus).toBe(false);
    expect(screen.queryByRole("dialog", { name: "Add" })).toBeNull();
    expect(document.activeElement).toBe(field);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(field);
    field.remove();
  });

  it("any other row shuts the sheet, runs once, and gives focus back to Add", async () => {
    stubWidth(390);
    const props = all();
    view({ ...props, onAddPromptFocus: vi.fn() });
    fireEvent.click(screen.getByTestId("sandbox-add"));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Add" })).getByRole("button", { name: /^Tool/ }));
    expect(props.onAddTool).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Add" })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(screen.getByTestId("sandbox-add"));
  });

  it("Escape closes it", () => {
    stubWidth(390);
    view({ ...all(), onAddPromptFocus: vi.fn() });
    fireEvent.click(screen.getByTestId("sandbox-add"));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Add" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Add" })).toBeNull();
  });
});

describe("CA-10 · words on a phone (CA-09 F12)", () => {
  it("never says click or double-click on a phone", () => {
    expect(listHint(true)).toBe("Tap a tile to see its details");
    expect(listHint(false)).toBe(LIST_HINT);
    stubWidth(390);
    view({ list: undefined, lens: "list" });
    expect(screen.getByText("Tap a tile to see its details")).toBeTruthy();
    expect(screen.queryByText(/click/i)).toBeNull();
  });
});

describe("CA-10 · a save that stopped says what failed", () => {
  it("reads 'not saved · Retry', the reason and code in its tooltip (CA-23)", () => {
    const onRetrySave = vi.fn();
    view({ save: "error", saveProblem: { reason: "a value isn't allowed", code: "23514" }, onRetrySave });
    expect(screen.getByTestId("sandbox-status").textContent).toContain("Draft · not saved");
    expect(within(screen.getByTestId("sandbox-status")).getByRole("button", { name: "Retry" })).toBeTruthy();
    const words = screen.getByTestId("save-problem");
    expect(words.textContent).toBe("not saved");
    expect(words.getAttribute("title")).toBe("Not saved: a value isn't allowed. Code 23514.");
    expect(document.getElementById(words.getAttribute("aria-describedby") as string)?.textContent).toBe("Not saved: a value isn't allowed. Code 23514.");
    fireEvent.click(within(screen.getByTestId("sandbox-status")).getByRole("button", { name: "Retry" }));
    expect(onRetrySave).toHaveBeenCalled();
    expect(notSavedLine({ reason: "no connection" })).toBe("Not saved: no connection.");
  });

  it("shows the code under 'This build didn't load.'", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    view({ status: "error", loadError: { code: "57014", message: "canceling statement due to statement timeout" } });
    expect(screen.getByText("This build didn't load.")).toBeTruthy();
    expect(screen.getByText("Code 57014")).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith("[Compose] build read failed 57014 canceling statement due to statement timeout");
  });
});

describe("CA-13 P1 · Add › Decision", () => {
  it("is disabled, with the database line, until the decision type is live", () => {
    const off = addEntries({ onAddDecision: vi.fn(), decisionAvailable: false }).find((item) => item.key === "decision");
    expect(off?.enabled).toBe(false);
    expect(off?.line).toBe("Decisions need the CA-13 database change. Ask Lovable to apply it.");
    const on = addEntries({ onAddDecision: vi.fn(), decisionAvailable: true }).find((item) => item.key === "decision");
    expect(on?.enabled).toBe(true);
    expect(on?.line).toBe("A structured classification your application requests from a model");
  });
});
