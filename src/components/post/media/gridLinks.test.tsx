// CA-07 P6 — Link a step and Add description under the grid, and the readers' From step line.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/media")>()),
  signedMediaUrl: vi.fn(async (ref: { path: string }) => `https://signed.test/${ref.path}`),
}));

import { postSpans } from "@/components/post/editor/pictures";
import { PostBody } from "@/components/post/PostBody";
import { PostRefsProvider } from "@/components/post/RefLinks";
import { descriptionLabel, stepGroupsOf, withoutGoneSteps } from "@/lib/build/gridSteps";
import type { RefEntry, RefGroup } from "@/lib/build/postRefs";
import type { PostBlock, ThreadBlock, ThreadDoc, ThreadPostMedia } from "@/lib/build/thread";
import { doc, mountPostTab as mount, p } from "@/pages/site/compose/postTabKit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const entry = (to: string, number: string, title: string, kind = "Prompt"): RefEntry => ({
  to,
  number,
  title,
  kind,
  depth: number.includes(".") ? 1 : 0,
  colour: null,
  name: title.toLowerCase(),
  eyebrow: "",
  body: "",
  heading: title,
  id: to.split(":")[1],
});
const GROUPS: RefGroup[] = [
  { key: "s1", label: "Session 1 · Claude", entries: [entry("session:s1", "S1", "The whole session", "Session"), entry("node:p2", "2", "Form prompt")] },
  { key: "s2", label: "Session 2 · Claude Code", entries: [entry("session:s2", "S2", "The whole session", "Session"), entry("node:t4", "4", "Order page team", "Team"), entry("node:a42", "4.2", "Build agent", "Agent")] },
];
const LOOKUP = new Map(GROUPS.flatMap((group) => group.entries).map((one) => [one.to, one]));
const REFERENCES = { groups: GROUPS, lookup: LOOKUP };

const pic = (mediaId: string, alt = ""): ThreadPostMedia => ({ type: "postMedia", attrs: { mediaId, width: 100, w: 800, h: 600, alt, crop: null, aspect: null, zoom: null, warn: [], caption: "" } });
const grid = (step: string | null, ...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step }, content: pictures });
const gridAttrs = (editor: Editor) => postSpans(editor.state.doc)[0].grid?.node.attrs as { step: string | null };
const links = () => document.querySelector("[data-grid-links]") as HTMLElement;

async function mountWith(content: ThreadBlock) {
  const mounted = mount(doc(p("words"), content), {}, { references: REFERENCES });
  await waitFor(() => expect(links()).toBeTruthy());
  return mounted;
}

describe("Link a step", () => {
  it("lists the build's steps in build order, numbered as the build page numbers them, and no sessions", async () => {
    expect(stepGroupsOf(GROUPS).flatMap((group) => group.entries.map((one) => `${one.number} ${one.title}`))).toEqual(["2 Form prompt", "4 Order page team", "4.2 Build agent"]);
    await mountWith(grid(null, pic("a")));
    fireEvent.click(within(links()).getByRole("button", { name: "Link a step" }));
    const options = within(screen.getByTestId("reference-picker")).getAllByRole("option");
    expect(options.map((option) => option.getAttribute("data-ref-option"))).toEqual(["node:p2", "node:t4", "node:a42"]);
  });

  it("links the grid to the chosen step, reads Linked to step, and Not linked clears it", async () => {
    const { editor } = await mountWith(grid(null, pic("a")));
    fireEvent.click(within(links()).getByRole("button", { name: "Link a step" }));
    fireEvent.click(screen.getByRole("option", { name: /Build agent/ }));
    expect(gridAttrs(editor).step).toBe("node:a42");
    const button = within(links()).getByRole("button", { name: "Linked to step 4.2 Build agent" });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("option", { name: "Not linked" }));
    expect(gridAttrs(editor).step).toBeNull();
    expect(within(links()).getByRole("button", { name: "Link a step" })).toBeInTheDocument();
  });

  it("reads Link a step for a step since deleted, and clears it from what is saved on the next save", async () => {
    const { editor, thread } = await mountWith(grid("node:gone", pic("a")));
    expect(within(links()).getByRole("button", { name: "Link a step" })).toBeInTheDocument();
    expect(thread.onDoc).not.toHaveBeenCalled();
    act(() => {
      editor.commands.insertContentAt(1, "x");
    });
    const saved = (thread.onDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as ThreadDoc;
    expect(saved.content.find((block) => block.type === "postMediaGrid")).toMatchObject({ attrs: { step: null } });
    const kept = doc(p("x"), grid("node:p2", pic("a")));
    expect(withoutGoneSteps(kept, LOOKUP)).toBe(kept);
  });
});

describe("Add description", () => {
  it("reads Add description, Add descriptions or Description added", () => {
    expect(descriptionLabel([""])).toBe("Add description");
    expect(descriptionLabel(["", "Words"])).toBe("Add descriptions");
    expect(descriptionLabel(["Words"])).toBe("Description added");
    expect(descriptionLabel(["Words", "More"])).toBe("Description added");
  });

  it("opens Edit on ALT at the first picture with no description", async () => {
    await mountWith(grid(null, pic("a", "Described"), pic("b")));
    fireEvent.click(within(links()).getByRole("button", { name: "Add descriptions" }));
    const dialog = await screen.findByTestId("edit-media-dialog");
    expect(within(dialog).getByRole("tab", { name: "ALT" }).getAttribute("aria-selected")).toBe("true");
    expect(dialog.querySelector('[data-thumb="1"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("sits 8 under the grid, 16 from Link a step, at 13 in --text2", async () => {
    await mountWith(grid(null, pic("a")));
    expect([links().style.marginTop, links().style.gap]).toEqual(["8px", "16px"]);
    const button = within(links()).getByRole("button", { name: "Add description" });
    expect(button.style.fontSize).toBe("13px");
    expect(button.querySelector("svg")?.getAttribute("width")).toBe("16");
  });
});

describe("the readers' line", () => {
  const content = (step: string | null) => [{ type: "paragraph", content: [{ type: "text", text: "words" }] }, grid(step, pic("a"))] as PostBlock[];
  const body = (step: string | null, provider = true, onGo = vi.fn()) => {
    const tree = <PostBody post={{ content: content(step) }} mediaById={new Map()} srcByPath={new Map()} />;
    return { onGo, ...render(provider ? <PostRefsProvider value={{ lookup: LOOKUP, onGo }}>{tree}</PostRefsProvider> : tree) };
  };

  it("says From step 4.2 Build agent under the grid, linked to the step on the build page", () => {
    const { onGo } = body("node:a42");
    const link = screen.getByRole("link", { name: "From step 4.2 Build agent" });
    expect(link.getAttribute("href")).toBe("#node-a42");
    expect(link.querySelector("svg")?.getAttribute("width")).toBe("15");
    fireEvent.click(link);
    expect(onGo).toHaveBeenCalledWith("node:a42", link);
  });

  it("is not drawn when the step is gone, nor on a Gallery card (no provider)", () => {
    body("node:gone");
    expect(screen.queryByText(/From step/)).toBeNull();
    cleanup();
    body("node:a42", false);
    expect(screen.queryByText(/From step/)).toBeNull();
  });
});
