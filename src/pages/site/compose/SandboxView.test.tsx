// UI-P93 — the current view's own suite, run against the refined fork under `?look=refined` (same names, handlers and
// behaviour), then a block for what the refined board draws. Styles are read through SSR markup.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { SandboxView as SandboxView } from "./SandboxView";
import { ADD_ITEMS, addEntries, countsLine, type SandboxViewProps } from "./SandboxView";

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

beforeEach(() => stubWidth(1440));
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

  it("names what is missing and opens the Card at that field", () => {
    view({ missing: [{ key: "title", label: "a title" }] });
    expect(screen.getByTestId("sandbox-status").textContent).toContain("Missing: a title");
    fireEvent.click(screen.getByRole("button", { name: "a title" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).getByLabelText("Title")).toBe(document.activeElement);
  });

  it("shows the List and Map switch only when Map is available, with the one-time line", () => {
    view();
    expect(screen.getByRole("group", { name: "Build view" })).toBeTruthy();
    expect(screen.getByText("Map is now available")).toBeTruthy();
    cleanup();
    view({ mapAvailable: false, mapHint: false });
    expect(screen.queryByRole("group", { name: "Build view" })).toBeNull();
  });

  it("lists the nine Add items in order, Code after Manual step and Check after Code; all nine are live (UI-P64 to UI-P70, CA-02 P7, CA-03 P5)", () => {
    expect(ADD_ITEMS.map((item) => item.name)).toEqual(["Prompt", "Session", "Agent or team", "File", "Tool", "Manual step", "Code", "Check", "Result"]);
    expect(ADD_ITEMS.filter((item) => item.ready).map((item) => item.key)).toEqual(["prompt", "session", "agent", "file", "tool", "manual", "code", "check", "result"]);
    expect(ADD_ITEMS.find((item) => item.key === "code")?.line).toBe("Lines of code you wrote or ran");
    expect(ADD_ITEMS.find((item) => item.key === "check")).toEqual({ key: "check", name: "Check", line: "How it tested its own work", ready: true });
  });

  it("lists Check but disables it until the build has an agent, a team or code (CA-03 P5)", () => {
    const onAddCheck = vi.fn();
    const off = addEntries({ onAddCheck, checkable: false }).find((item) => item.key === "check");
    expect(off).toMatchObject({ name: "Check", line: "Add an agent or code first", enabled: false });
    const on = addEntries({ onAddCheck, checkable: true }).find((item) => item.key === "check");
    expect(on).toMatchObject({ name: "Check", line: "How it tested its own work", enabled: true });
    on?.onSelect?.();
    expect(onAddCheck).toHaveBeenCalledTimes(1);
    expect(addEntries({ checkable: true }).find((item) => item.key === "check")?.enabled).toBe(false);
  });

  it("opens the Card from its button with the six sections' fields", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    for (const label of ["Title", "One-line summary", "Who it's for"]) expect(within(card).getByLabelText(label)).toBeTruthy();
    expect(within(card).getByText("Cover")).toBeTruthy();
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

describe("the Build panel's head when an agent or a team is opened (UI-P69)", () => {
  const trail = [{ id: "t3", title: "Copy team" }, { id: "t3b", title: "Writer" }];

  it("reads 'Build › {title}', with Build a link back and a Back to build beside Add", () => {
    const props = view({ lens: "map", trail: [trail[0]], onTrail: vi.fn() });
    const head = screen.getByTestId("sandbox-trail");
    expect(head.textContent).toBe("Build›Copy team");
    expect(within(head).getByText("Copy team").getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(head).getByRole("button", { name: "Build" }));
    expect(props.onTrail).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Back to build" }));
    expect(props.onTrail).toHaveBeenLastCalledWith(0);
  });

  it("reads 'Build › {team} › {agent}' one level further in, and Back goes up one level", () => {
    const props = view({ lens: "map", trail, onTrail: vi.fn() });
    expect(screen.getByTestId("sandbox-trail").textContent).toBe("Build›Copy team›Writer");
    fireEvent.click(within(screen.getByTestId("sandbox-trail")).getByRole("button", { name: "Copy team" }));
    expect(props.onTrail).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to build" }));
    expect(props.onTrail).toHaveBeenLastCalledWith(1);
  });

  it("is the plain 'Build' title with nothing opened, and in List even when something is", () => {
    view({ lens: "map", trail: [] });
    expect(screen.queryByTestId("sandbox-trail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Back to build" })).toBeNull();
    cleanup();
    view({ lens: "list", trail });
    expect(screen.queryByTestId("sandbox-trail")).toBeNull();
  });

  it("opens the Add dialog from Add › Agent or team", async () => {
    const onAddAgent = vi.fn();
    view({ onAddAgent });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: /Agent or team/ });
    expect(item.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(item);
    expect(onAddAgent).toHaveBeenCalled();
  });

  it("leaves Agent or team disabled when nothing opens the dialog", async () => {
    view();
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: /Agent or team/ });
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("the Add menu holds exactly 9 items, all enabled (UI-P70, CA-02 P7, CA-03 P5)", () => {
  it("enables every item once each has something to open", async () => {
    view({
      onAddCheck: vi.fn(),
      checkable: true,
      onAddFile: vi.fn(),
      onAddTool: vi.fn(),
      onAddResult: vi.fn(),
      onAddPromptFocus: vi.fn(),
      onAddAgent: vi.fn(),
      onAddManual: vi.fn(),
      onAddCode: vi.fn(),
      onAddSession: vi.fn(),
      addableSessions: [{ id: "x", label: "A chat", line: "today" }],
    });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(9);
    expect(items.map((item) => item.getAttribute("aria-disabled"))).toEqual(Array(9).fill(null));
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

  it("draws the title row under a hairline, Card and Preview as secondary 30 and Publish as the one primary 30", () => {
    view();
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("style")).toMatch(/font-size:\s*20px/);
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish.getAttribute("data-variant")).toBe("primary");
    expect(publish.getAttribute("style")).toMatch(/height:\s*30px/);
    expect(screen.getByRole("button", { name: "Card" }).getAttribute("data-variant")).toBe("secondary");
    expect(screen.getByRole("link", { name: "Preview" }).getAttribute("style")).toMatch(/height:\s*30px/);
    expect(markup()).toContain("padding-bottom:20px;border-bottom:1px solid var(--hairline)");
  });

  it("puts Sources on the surface with a hairline on its right and Details in a module", () => {
    const html = markup();
    expect(html).toContain("flex:1 1 216px;max-width:232px;box-sizing:border-box;padding-right:24px;border-right:1px solid var(--hairline)");
    expect(html).toMatch(/aria-label="Details" style="background:var\(--module\)/);
    expect(html).toContain("flex:999 1 480px");
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

  it("makes Build a module beside the rail in Map, and leaves it on the surface in List", () => {
    expect(markup({ lens: "map" })).toMatch(/aria-label="Build" tabindex="-1" style="[^"]*background:var\(--module\)/);
    expect(markup({ lens: "map" })).toContain("flex:999 1 560px");
    expect(markup({ lens: "list" })).not.toMatch(/aria-label="Build" tabindex="-1" style="[^"]*background:var\(--module\)/);
    expect(markup({ lens: "list" })).not.toContain("flex:999 1 560px");
  });

  it("opens the Card as the refined side sheet", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(card.style.width).toBe("472px");
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
    expect(post.parentElement).toBe(build.parentElement);
    expect(post.compareDocumentPosition(build) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ["Sources", "Details"]) expect(screen.getByRole("region", { name })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("group", { name: "Upload steps" })).toBeNull();
    expect(screen.getByRole("group", { name: "Build view" })).toBeTruthy();
  });

  it("sits on the surface with a hairline under it, 16 below its last line", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/compose/x"]}>
        <SandboxView {...sandboxViewProps("bakery")} post={<p>the post body</p>} />
      </MemoryRouter>,
    );
    const style = /aria-label="Post"[^>]*style="([^"]*)"/.exec(markup)?.[1] ?? "";
    expect(style).toContain("padding-bottom:16px;border-bottom:1px solid var(--hairline)");
    expect(style).not.toContain("background");
  });

  it("is not drawn without a post, nor while an agent or a team is open in the Map", () => {
    viewAt("/compose/x", { post: undefined });
    expect(screen.queryByRole("region", { name: "Post" })).toBeNull();
    cleanup();
    viewAt("/compose/x", { lens: "map", trail: [{ id: "t3", title: "Research team" }] });
    expect(screen.queryByRole("region", { name: "Post" })).toBeNull();
  });

  it("puts a thread's waiting sentence in the status line", () => {
    viewAt("/compose/x", { threadNote: "Post 3 is over 1,000 characters", missing: [] });
    expect(screen.getByTestId("sandbox-status").textContent).toBe("Draft · saved just now · Post 3 is over 1,000 characters");
  });

  it("adds what kind of build it is after the save state (CA-03 P8)", () => {
    viewAt("/compose/x", { summary: "A team of 4 agents · checks its own work", missing: [] });
    expect(screen.getByTestId("sandbox-status").textContent).toBe("Draft · saved just now · A team of 4 agents · checks its own work");
    cleanup();
    viewAt("/compose/x", { summary: undefined, missing: [] });
    expect(screen.queryByTestId("sandbox-summary")).toBeNull();
  });
});

describe("the Card and the post", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("puts the caret in the post from a missing cover, and does not open the Card", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "a cover picture or video" }));
    vi.runAllTimers();
    expect(screen.queryByTestId("sandbox-card")).toBeNull();
    expect(document.activeElement?.textContent).toBe("the post body");
  });

  it("still opens the Card at the field for a missing title", () => {
    viewAt("/compose/x", { missing: [{ key: "title", label: "a title" }] });
    fireEvent.click(screen.getByRole("button", { name: "a title" }));
    expect(screen.getByTestId("sandbox-card")).toBeTruthy();
  });

  it("says the cover is the first picture of the post, and Edit the post closes the sheet and goes to the post", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).getByText("The cover is the first picture in your post.")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Edit the post" }));
    vi.runAllTimers();
    expect(screen.queryByTestId("sandbox-card")).toBeNull();
    expect(document.activeElement?.textContent).toBe("the post body");
  });

  it("keeps Title, One-line summary, Who it's for, Made with and More details", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    for (const label of ["Title", "One-line summary", "Who it's for"]) expect(within(card).getByLabelText(label)).toBeTruthy();
    expect(within(card).getByTestId("compose-made-with")).toBeTruthy();
    expect(within(card).getByRole("button", { name: /More details/ })).toBeTruthy();
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
