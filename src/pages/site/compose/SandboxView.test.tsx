// UI-P93 — the current view's own suite, run against the refined fork under `?look=refined` (same names, handlers and
// behaviour), then a block for what the refined board draws. Styles are read through SSR markup.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { SandboxView as SandboxView } from "./SandboxView";
import { ADD_ITEMS, buildTabCount, countsLine, postTabCount, type SandboxViewProps } from "./SandboxView";

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

  it("lists the seven Add items in order; all seven are live (UI-P64 to UI-P70)", () => {
    expect(ADD_ITEMS.map((item) => item.name)).toEqual(["Prompt", "Session", "Agent or team", "File", "Tool", "Manual step", "Result"]);
    expect(ADD_ITEMS.filter((item) => item.ready).map((item) => item.key)).toEqual(["prompt", "session", "agent", "file", "tool", "manual", "result"]);
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

describe("the Add menu holds exactly 7 items, all enabled (UI-P70)", () => {
  it("enables every item once each has something to open", async () => {
    view({
      onAddFile: vi.fn(),
      onAddTool: vi.fn(),
      onAddResult: vi.fn(),
      onAddPromptFocus: vi.fn(),
      onAddAgent: vi.fn(),
      onAddManual: vi.fn(),
      onAddSession: vi.fn(),
      addableSessions: [{ id: "x", label: "A chat", line: "today" }],
    });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(7);
    expect(items.map((item) => item.getAttribute("aria-disabled"))).toEqual(Array(7).fill(null));
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
    expect(markup({ lens: "map" })).toMatch(/aria-label="Build" tabindex="-1" style="[^"]*background:var\(--module\)[^"]*flex:999 1 560px/);
    expect(markup({ lens: "list" })).not.toContain("flex:999 1 560px");
  });

  it("opens the Card as the refined side sheet", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(card.style.width).toBe("472px");
  });
});

/* ── PT-05: the Build and Post tabs ── */

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function viewAt(entry: string, over: Partial<SandboxViewProps> = {}) {
  const props = { ...sandboxViewProps("bakery"), onPublish: vi.fn(), onLens: vi.fn(), post: <p>the post tab body</p>, sources: <p>the sources panel</p>, ...over };
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SandboxView {...props} />
      <Where />
    </MemoryRouter>,
  );
  return props;
}

const where = () => screen.getByTestId("where").textContent;

describe("the tab counts", () => {
  it("says 5 prompts, 1 prompt, and nothing for none", () => {
    expect(buildTabCount(5)).toBe("5 prompts");
    expect(buildTabCount(1)).toBe("1 prompt");
    expect(buildTabCount(0)).toBeUndefined();
  });

  it("says 4 posts, 1 post, and No posts yet", () => {
    expect(postTabCount(4)).toBe("4 posts");
    expect(postTabCount(1)).toBe("1 post");
    expect(postTabCount(0)).toBe("No posts yet");
    expect(postTabCount(null)).toBe("No posts yet");
    expect(postTabCount(undefined)).toBe("No posts yet");
  });
});

describe("the Build and Post tabs", () => {
  it("are tabs labelled Upload steps, Build with its prompt count and Post with its post count", () => {
    viewAt("/compose/x", { postCount: 4 });
    const tabs = screen.getByRole("tablist", { name: "Upload steps" });
    const [build, post] = within(tabs).getAllByRole("tab");
    expect(build.textContent).toBe("Build 12 prompts");
    expect(post.textContent).toBe("Post 4 posts");
    expect(build.getAttribute("aria-selected")).toBe("true");
    expect(post.getAttribute("aria-selected")).toBe("false");
  });

  it("say No posts yet while the thread is empty", () => {
    viewAt("/compose/x", { postCount: 0 });
    expect(within(screen.getByRole("tablist", { name: "Upload steps" })).getAllByRole("tab")[1].textContent).toBe("Post No posts yet");
  });

  it("show Build, exactly as before, when there is no tab in the address", () => {
    viewAt("/compose/x");
    for (const name of ["Sources", "Build", "Details"]) expect(screen.getByRole("region", { name })).toBeTruthy();
    expect(screen.queryByText("the post tab body")).toBeNull();
    expect(screen.getByRole("group", { name: "Build view" })).toBeTruthy();
  });

  it("follow ?tab=post in the address, so a refresh keeps the tab", () => {
    viewAt("/compose/x?tab=post");
    expect(screen.getByRole("tab", { name: /^Post/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("the post tab body")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Build" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Build view" })).toBeNull();
    expect(screen.getByRole("tabpanel", { name: /^Post/ })).toBeTruthy();
  });

  it("write the tab into the address when chosen, and take it out for Build", () => {
    viewAt("/compose/x?a=1");
    fireEvent.click(screen.getByRole("tab", { name: /^Post/ }));
    expect(where()).toBe("/compose/x?a=1&tab=post");
    expect(screen.getByText("the post tab body")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^Build/ }));
    expect(where()).toBe("/compose/x?a=1");
    expect(screen.getByRole("region", { name: "Build" })).toBeTruthy();
  });

  it("keep the Build side mounted, only hidden, while Post is shown", () => {
    viewAt("/compose/x?tab=post");
    expect(screen.getByText("the sources panel")).toBeTruthy();
    const panel = document.getElementById("compose-panel-build") as HTMLElement;
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(panel.style.display).toBe("none");
  });

  it("move with the arrow keys, as tabs do", () => {
    viewAt("/compose/x");
    fireEvent.keyDown(screen.getByRole("tab", { name: /^Build/ }), { key: "ArrowRight" });
    expect(where()).toBe("/compose/x?tab=post");
  });

  it("put a thread's waiting sentence in the status line", () => {
    viewAt("/compose/x?tab=post", { threadNote: "Post 3 is over 1,000 characters", missing: [] });
    expect(screen.getByTestId("sandbox-status").textContent).toBe("Draft · saved just now · Post 3 is over 1,000 characters");
  });
});

describe("the Card and the Post tab", () => {
  it("opens the Post tab from a missing cover, and not the Card", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "a cover picture or video" }));
    expect(where()).toBe("/compose/x?tab=post");
    expect(screen.queryByTestId("sandbox-card")).toBeNull();
    expect(screen.getByText("the post tab body")).toBeTruthy();
  });

  it("still opens the Card at the field for a missing title", () => {
    viewAt("/compose/x", { missing: [{ key: "title", label: "a title" }] });
    fireEvent.click(screen.getByRole("button", { name: "a title" }));
    expect(screen.getByTestId("sandbox-card")).toBeTruthy();
    expect(where()).toBe("/compose/x");
  });

  it("says the cover is the first picture of the post, and Edit the post closes the sheet and opens the tab", () => {
    viewAt("/compose/x");
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).getByText("The cover is the first picture in your post.")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Edit the post" }));
    expect(screen.queryByTestId("sandbox-card")).toBeNull();
    expect(where()).toBe("/compose/x?tab=post");
    expect(screen.getByText("the post tab body")).toBeTruthy();
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

describe("the tabs on a phone", () => {
  it("are a full-width Segmented, 40 high, and choosing Post writes the address", () => {
    stubWidth(390);
    viewAt("/compose/x");
    const group = screen.getByRole("group", { name: "Upload steps" });
    expect(group.style.height).toBe("40px");
    expect(group.style.width).toBe("100%");
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "Post" }));
    expect(where()).toBe("/compose/x?tab=post");
    expect(screen.getByText("the post tab body")).toBeTruthy();
    expect(within(group).getByRole("button", { name: "Post" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the action bar under either tab", () => {
    stubWidth(390);
    viewAt("/compose/x?tab=post");
    expect(screen.getByRole("group", { name: "Actions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
  });
});

describe("the Preview button on a phone (PT-07)", () => {
  it("is in the title row on the Post tab, 44 high, and asks for the preview sheet", () => {
    stubWidth(390);
    const onPreview = vi.fn();
    viewAt("/compose/x?tab=post", { onPreview });
    const button = screen.getByRole("button", { name: "Preview" });
    expect(button.style.height).toBe("44px");
    expect(screen.getByTestId("sandbox-heading").parentElement?.parentElement?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it("is not there on the Build tab, on a desktop, or when nothing handles it", () => {
    stubWidth(390);
    viewAt("/compose/x", { onPreview: vi.fn() });
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
    cleanup();
    viewAt("/compose/x?tab=post");
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
    cleanup();
    stubWidth(1440);
    viewAt("/compose/x?tab=post", { onPreview: vi.fn() });
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
  });
});
