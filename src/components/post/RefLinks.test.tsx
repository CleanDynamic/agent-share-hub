// CA-06 P3 — how a link looks: its fill for a coloured part, a plain one and a part that is gone; the reader's links
// inside and outside a provider; the editor's; the windows a link opens; the List's "Mentioned in the post"; and what
// the copies put on the clipboard.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PartWindow } from "@/components/build/PartWindow";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { LINKS_COLOURS, LINKS_S2, linksBuild, linksPost, linksTree } from "@/dev/fixtures/postLinks";
import { shapeListProps } from "@/dev/fixtures/shapes";
import { copyTogether } from "@/lib/build/copyTogether";
import { refGroups, refLookup } from "@/lib/build/postRefs";
import { readerSteps, stepsMarkdown } from "@/lib/build/readerSteps";
import { splitThread } from "@/lib/build/thread";
import { highlightFor } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";
import { BuildList } from "@/pages/site/compose/BuildList";
import { mountPostTab } from "@/pages/site/compose/postTabKit";

import { PostBody } from "./PostBody";
import { PostRefsProvider, REF_COPY, refPaint, refWordsStyle } from "./RefLinks";

let hover = false;
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: query.includes("hover: hover") ? hover : false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

afterEach(() => {
  cleanup();
  hover = false;
});

const build = linksBuild();
const lookup = refLookup(refGroups({ steps: build.steps, groups: build.groups }));
const posts = splitThread(linksPost);
const body = (index: number) => createElement(PostBody, { post: posts[index], mediaById: new Map(), srcByPath: new Map() });

describe("the fill", () => {
  it("is a coloured part's colour at the alpha the helper measured", () => {
    const paint = refPaint(lookup.get("node:o-p2"), "noon");
    const { fill, hover: strong } = highlightFor(LINKS_COLOURS.prompt, "noon");
    expect(paint).toEqual({ fill, hover: strong, number: "2", gone: false });
    expect(refPaint(lookup.get(`session:${LINKS_S2}`), "dusk").fill).toBe(highlightFor(LINKS_COLOURS.session, "dusk").fill);
  });

  it("is the plain row fill for a part with no colour, one step stronger on hover", () => {
    const paint = refPaint(lookup.get("node:o-k1"), "noon");
    expect(paint).toEqual({ fill: t.rowHighlight, hover: t.tagFill, number: "5", gone: false });
    expect(refWordsStyle(paint)).toMatchObject({ background: t.rowHighlight, borderRadius: 4, padding: "1px 4px", boxDecorationBreak: "clone" });
    expect(refWordsStyle(paint, true).background).toBe(t.tagFill);
  });

  it("is nothing for a part that is gone: plain words in --text2", () => {
    const paint = refPaint(lookup.get("node:o-gone"), "noon");
    expect(paint.gone).toBe(true);
    expect(refWordsStyle(paint)).toEqual({ color: t.text2 });
  });

  it("is never an underline", () => {
    for (const to of ["node:o-p2", "node:o-k1", "node:o-gone"]) expect(JSON.stringify(refWordsStyle(refPaint(lookup.get(to), "noon")))).not.toContain("underline");
  });
});

describe("for a reader", () => {
  it("draws each link as words and the part's number, and a gone part as plain words that take no focus", () => {
    const onGo = vi.fn();
    render(<PostRefsProvider value={{ lookup, onGo }}>{body(1)}</PostRefsProvider>);
    const session = document.querySelector(`[data-ref="session:${LINKS_S2}"]`) as HTMLElement;
    expect(session.getAttribute("role")).toBe("link");
    expect(session.getAttribute("tabindex")).toBe("0");
    expect(session.querySelector("[data-ref-number]")?.textContent).toBe("S2");
    const gone = document.querySelector('[data-ref="node:o-gone"]') as HTMLElement;
    expect(gone.getAttribute("title")).toBe(REF_COPY.gone);
    expect(gone.hasAttribute("tabindex")).toBe(false);
    fireEvent.click(session);
    expect(onGo).toHaveBeenCalledWith(`session:${LINKS_S2}`, session);
    fireEvent.click(gone);
    expect(onGo).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.querySelector('[data-ref="node:o-k1"]') as HTMLElement, { key: "Enter" });
    expect(onGo).toHaveBeenLastCalledWith("node:o-k1", expect.any(HTMLElement));
  });

  it("draws plain words where nothing can be gone to, as the Gallery does", () => {
    render(body(1));
    expect(document.querySelector("[data-ref]")).toBeNull();
    expect(screen.getByText(/the agents took over/).textContent).toContain("session 2");
  });

  it("opens the card after a rest on a link, with Go to it and no Change or Remove", async () => {
    hover = true;
    const onGo = vi.fn();
    render(<PostRefsProvider value={{ lookup, onGo }}>{body(0)}</PostRefsProvider>);
    fireEvent.mouseEnter(document.querySelector('[data-ref="node:o-p2"]') as HTMLElement);
    expect(screen.queryByTestId("ref-card")).toBeNull();
    const card = await screen.findByTestId("ref-card");
    expect(within(card).getByText("Prompt 2 · Session 1")).toBeTruthy();
    expect(within(card).queryByText(REF_COPY.change)).toBeNull();
    expect(within(card).queryByText(REF_COPY.remove)).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: REF_COPY.goTo }));
    expect(onGo).toHaveBeenCalledWith("node:o-p2", expect.any(HTMLElement));
  });

  it("opens no card on a pointer that cannot hover", async () => {
    render(<PostRefsProvider value={{ lookup, onGo: vi.fn() }}>{body(0)}</PostRefsProvider>);
    fireEvent.mouseEnter(document.querySelector('[data-ref="node:o-p2"]') as HTMLElement);
    await new Promise((done) => setTimeout(done, 450));
    expect(screen.queryByTestId("ref-card")).toBeNull();
  });
});

describe("in the editor", () => {
  it("paints the words, numbers them, and leaves a gone part's words plain and out of the tab order", () => {
    const groups = refGroups({ steps: build.steps, groups: build.groups });
    const onGo = vi.fn();
    mountPostTab(linksPost, {}, { references: { groups, lookup, onGo } });
    const prompt = document.querySelector('[contenteditable="true"] [data-ref="node:o-p2"]') as HTMLElement;
    expect((prompt.firstElementChild as HTMLElement).style.borderRadius).toBe("4px");
    expect(prompt.querySelector("[data-ref-number]")?.textContent).toBe("2");
    const gone = document.querySelector('[contenteditable="true"] [data-ref="node:o-gone"]') as HTMLElement;
    expect(gone.getAttribute("title")).toBe(REF_COPY.gone);
    expect(gone.hasAttribute("tabindex")).toBe(false);
    fireEvent.click(prompt);
    expect(onGo).toHaveBeenCalledWith("node:o-p2", prompt);
  });

  it("gives the maker's card Change and Remove the link; Remove keeps the words", async () => {
    hover = true;
    const groups = refGroups({ steps: build.steps, groups: build.groups });
    const { editor } = mountPostTab(linksPost, {}, { references: { groups, lookup, onGo: vi.fn() } });
    const prompt = document.querySelector('[contenteditable="true"] [data-ref="node:o-p2"]') as HTMLElement;
    act(() => {
      prompt.dispatchEvent(new MouseEvent("mouseenter"));
    });
    const card = await screen.findByTestId("ref-card");
    expect(within(card).getByText(REF_COPY.change)).toBeTruthy();
    fireEvent.click(within(card).getByText(REF_COPY.remove));
    await waitFor(() => expect(JSON.stringify(editor.getJSON())).not.toContain("node:o-p2"));
    expect(editor.getText()).toContain("form prompt");
  });
});

describe("the windows", () => {
  const open = (to: string, extra: Record<string, unknown> = {}) =>
    render(createElement(PartWindow, { steps: build.steps, groups: build.groups, open: to, onClose: vi.fn(), onGo: vi.fn(), ...extra }));

  it("draws code in a mono well with Copy code", () => {
    open("node:o-c1");
    expect(screen.getByRole("region", { name: "Code" }).textContent).toContain("export function OrderForm()");
    expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
  });

  it("draws an agent's instructions and models", () => {
    open("node:o-build");
    expect(screen.getByRole("region", { name: "Instructions" }).textContent).toContain("Build what the lead hands you");
    expect(screen.getByRole("heading", { name: "Models" })).toBeTruthy();
  });

  it("draws a team's agents as rows that each go to that agent", () => {
    const onGo = vi.fn();
    open("node:o-team", { onGo });
    fireEvent.click(screen.getAllByTestId("part-row")[1]);
    expect(onGo).toHaveBeenCalledWith("node:o-build");
  });

  it("draws a check's three answers and its runs", () => {
    open("node:o-k1");
    for (const label of ["What it tested", "What counts as passing", "When it failed", "Runs"]) expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    expect(screen.getByText("14 Oct · 40 of 40 passed")).toBeTruthy();
  });

  it("draws a file with Download", () => {
    const onDownload = vi.fn();
    open("node:o-f1", { onDownload });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownload).toHaveBeenCalledWith("o-f1");
  });

  it("draws a session's tool, model, day, setup and tiles", () => {
    const onGo = vi.fn();
    open(`session:${LINKS_S2}`, { onGo, setupCounts: { [LINKS_S2]: 4 } });
    expect(screen.getByText("Session 2 · Claude Code")).toBeTruthy();
    expect(screen.getByText("Setup · 4 items")).toBeTruthy();
    fireEvent.click(screen.getAllByTestId("part-row")[0]);
    expect(onGo).toHaveBeenCalledWith("node:o-team");
  });

  it("says where it was opened from, and Back to the post", () => {
    const onBackToPost = vi.fn();
    open("node:o-k1", { fromPost: true, onBackToPost });
    expect(screen.getByTestId("from-post").textContent).toBe("Opened from the post · Back to the post");
    fireEvent.click(screen.getByRole("button", { name: REF_COPY.backToPost }));
    expect(onBackToPost).toHaveBeenCalled();
  });

  it("puts the same footer on the full prompt window", () => {
    render(createElement(FullPromptWindow, { steps: build.steps, openId: "o-p2", mode: "maker", onClose: vi.fn(), fromPost: true, onBackToPost: vi.fn() }));
    expect(screen.getByTestId("from-post")).toBeTruthy();
  });
});

describe("the List", () => {
  it("says which parts the post mentions, each with its way back", () => {
    const onBackToPost = vi.fn();
    const list = shapeListProps("one-sitting", { tree: build.tree, making: build.making, selected: "o-p2" });
    render(createElement(MemoryRouter, null, createElement(BuildList, { ...list, mentioned: new Set(["node:o-p2", `session:${LINKS_S2}`]), onBackToPost })));
    const lines = screen.getAllByTestId("mentioned-line");
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe("Mentioned in the post · Back to the post");
    fireEvent.click(within(lines[0]).getByRole("button", { name: REF_COPY.backToPost }));
    expect(onBackToPost).toHaveBeenCalledWith("node:o-p2");
  });

  it("says nothing when the post mentions nothing", () => {
    const list = shapeListProps("one-sitting", { tree: build.tree, making: build.making, selected: "o-p2" });
    render(createElement(MemoryRouter, null, createElement(BuildList, list)));
    expect(screen.queryByTestId("mentioned-line")).toBeNull();
  });
});

describe("the copies", () => {
  it("never carry a link's target: Copy for AI and Copy together copy words only", () => {
    const markdown = stepsMarkdown({ title: "A bakery order page" }, readerSteps(linksTree, build.making));
    const together = build.steps.map(copyTogether).join("\n");
    for (const words of [markdown, together]) {
      expect(words).not.toMatch(/node:|session:/);
    }
  });
});
