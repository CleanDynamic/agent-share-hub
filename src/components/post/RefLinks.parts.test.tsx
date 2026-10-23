// CA-17 P5 — a link to a whole part: its fill from its colour, its number after the words, its card, and a part that is
// gone drawn as plain words.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionGroup, Step } from "@/lib/build/graph";
import { refGroups, refLookup } from "@/lib/build/postRefs";
import { splitThread, type ThreadDoc } from "@/lib/build/thread";
import { highlightFor } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";

import { PostBody } from "./PostBody";
import { PostRefsProvider, REF_COPY, refPaint } from "./RefLinks";

let hover = false;
vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("hover: hover") ? hover : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
afterEach(() => {
  cleanup();
  hover = false;
});

const step = (id: string, number: string): Step =>
  ({ id, kind: "prompt", number, title: null, defaultTitle: `Prompt ${number}`, text: "Words", words: 1, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [] }) as Step;
const group = (key: string, number: number, over: Partial<SessionGroup>): SessionGroup =>
  ({ key, kind: "typed", sessionId: null, number, tool: "Claude", model: null, startedAt: "2026-10-09", stepNumbers: [String(number)], ...over }) as SessionGroup;

const steps = [step("a", "1"), step("b", "2")];
const groups = [group("typed-1", 1, {}), group("typed-2", 2, { tool: "n8n", startedAt: "2026-10-10" })];
const making = {
  part_labels: "letters",
  workstreams: [{ key: "ws-a", name: "Tenant portal", colour: "#8FBFB8" }, { key: "ws-b", name: "Support agent", colour: "#D98C8C" }],
  sessions_meta: { "typed-1": { tool: null, date: "2026-10-09" }, "typed-2": { tool: null, date: "2026-10-10", workstream: "ws-b" } },
};
const lookup = refLookup(refGroups({ steps, groups, making }));

const doc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "the support half", marks: [{ type: "ref", attrs: { to: "workstream:ws-b" } }] },
        { type: "text", text: " and " },
        { type: "text", text: "a part that is gone", marks: [{ type: "ref", attrs: { to: "workstream:ws-gone" } }] },
      ],
    },
  ],
} as unknown as ThreadDoc;
const body = createElement(PostBody, { post: splitThread(doc)[0], mediaById: new Map(), srcByPath: new Map() });

describe("a part's link", () => {
  it("is filled with the part's colour at the alpha the helper measured, with its letter after the words", () => {
    const paint = refPaint(lookup.get("workstream:ws-b"), "dusk");
    const { fill, hover: strong } = highlightFor("#D98C8C", "dusk");
    expect(paint).toEqual({ fill, hover: strong, number: "B", gone: false });
    render(<PostRefsProvider value={{ lookup, onGo: vi.fn() }}>{body}</PostRefsProvider>);
    const link = document.querySelector('[data-ref="workstream:ws-b"]') as HTMLElement;
    expect(link.getAttribute("role")).toBe("link");
    expect(link.querySelector("[data-ref-number]")?.textContent).toBe("B");
  });

  it("is plain words in --text2 once the part is gone, and takes no focus", () => {
    render(<PostRefsProvider value={{ lookup, onGo: vi.fn() }}>{body}</PostRefsProvider>);
    const gone = document.querySelector('[data-ref="workstream:ws-gone"]') as HTMLElement;
    expect(gone.getAttribute("title")).toBe(REF_COPY.gone);
    expect(gone.hasAttribute("tabindex")).toBe(false);
    expect(refPaint(lookup.get("workstream:ws-gone"), "noon").gone).toBe(true);
    expect(t.text2).toBeTruthy();
  });

  it("goes to the part when clicked", () => {
    const onGo = vi.fn();
    render(<PostRefsProvider value={{ lookup, onGo }}>{body}</PostRefsProvider>);
    const link = document.querySelector('[data-ref="workstream:ws-b"]') as HTMLElement;
    fireEvent.click(link);
    expect(onGo).toHaveBeenCalledWith("workstream:ws-b", link);
  });
});

describe("a part's card", () => {
  it("shows the eyebrow, the name, the sessions, apps and days, and Go to it; Change and Remove only for the maker", async () => {
    hover = true;
    const onGo = vi.fn();
    render(<PostRefsProvider value={{ lookup, onGo }}>{body}</PostRefsProvider>);
    fireEvent.mouseEnter(document.querySelector('[data-ref="workstream:ws-b"]') as HTMLElement);
    const card = await screen.findByTestId("ref-card");
    expect(within(card).getByText("Part B")).toBeTruthy();
    expect(within(card).getByText("Support agent")).toBeTruthy();
    expect(within(card).getByText("1 session · n8n · 10 Oct")).toBeTruthy();
    expect(within(card).queryByText(REF_COPY.change)).toBeNull();
    expect(within(card).queryByText(REF_COPY.remove)).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: REF_COPY.goTo }));
    expect(onGo).toHaveBeenCalledWith("workstream:ws-b", expect.any(HTMLElement));
    cleanup();

    const maker = { onChange: vi.fn(), onRemove: vi.fn() };
    render(<PostRefsProvider value={{ lookup, onGo, maker }}>{body}</PostRefsProvider>);
    fireEvent.mouseEnter(document.querySelector('[data-ref="workstream:ws-b"]') as HTMLElement);
    const again = await screen.findByTestId("ref-card");
    fireEvent.click(within(again).getByText(REF_COPY.change));
    expect(maker.onChange).toHaveBeenCalledWith("workstream:ws-b", expect.any(HTMLElement));
  });
});
