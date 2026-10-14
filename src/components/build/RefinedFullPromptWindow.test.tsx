// UI-P94 — the current window's own suite, run against the refined fork (same names, handlers and behaviour), then a
// block for what `refined/{dusk,noon}/prompt-window.html` draws.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { neighbours, windowPrompts, type FullPromptWindowProps } from "./FullPromptWindow";
import { RefinedFullPromptWindow as FullPromptWindow } from "./RefinedFullPromptWindow";

/* The server render has no portal to draw into, so the window is drawn in place there; jsdom drops `var()` and `min()`
   from inline styles, so the look is read from that markup. */
vi.mock("@radix-ui/react-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@radix-ui/react-dialog")>()),
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const list = sandboxListProps("bakery");

function open(openId: string, over: Partial<FullPromptWindowProps> = {}) {
  const props: FullPromptWindowProps = {
    steps: list.steps,
    names: list.names,
    openId,
    mode: "maker",
    onTitle: vi.fn(),
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?look=refined"]}>
      <FullPromptWindow {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("moving between prompts", () => {
  it("has no previous at the first prompt and no next at the last", () => {
    const prompts = windowPrompts(list.steps);
    expect(neighbours(prompts, prompts[0].id).previous).toBeNull();
    expect(neighbours(prompts, prompts[prompts.length - 1].id).next).toBeNull();
  });

  it("← and → go to the neighbours", () => {
    const props = open("p3");
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(props.onNavigate).toHaveBeenLastCalledWith("p4");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(props.onNavigate).toHaveBeenLastCalledWith("p2");
  });

  it("leaves out the previous button at the first prompt, and the arrows do nothing there", () => {
    const props = open("p1");
    expect(screen.queryByRole("button", { name: /^Previous prompt/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Next prompt/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(props.onNavigate).not.toHaveBeenCalled();
  });

  it("does not move while the title field has focus", () => {
    const props = open("p3");
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "ArrowRight" });
    expect(props.onNavigate).not.toHaveBeenCalled();
  });
});

describe("the title", () => {
  it("saves on Enter and on blur, and an empty title as the default", () => {
    const props = open("p3");
    const field = screen.getByLabelText("Title") as HTMLInputElement;
    expect(field.placeholder).toBe("Prompt 3");
    fireEvent.change(field, { target: { value: "Mobile fixes" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onTitle).toHaveBeenLastCalledWith("p3", "Mobile fixes");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(props.onTitle).toHaveBeenLastCalledWith("p3", "");
  });

  it("is a heading, with no field, for a reader", () => {
    open("p3", { mode: "reader", onTitle: undefined });
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.getByRole("heading", { name: "Fix the mobile layout" })).toBeTruthy();
    expect(screen.getByText("Before you send it")).toBeTruthy();
  });
});

describe("the window", () => {
  it("heads itself 'Prompt n of N · full prompt', shows the words, the uses and the hint", () => {
    open("p3");
    expect(screen.getByText("Prompt 3 of 5 · full prompt")).toBeTruthy();
    expect(screen.getByText("19 words")).toBeTruthy();
    expect(screen.getByText("Output of 2 · Prompt 2")).toBeTruthy();
    expect(screen.getByText("menu.pdf")).toBeTruthy();
    expect(screen.getByText("Esc closes · ← → move between prompts")).toBeTruthy();
  });

  it("puts focus on the text box", async () => {
    open("p3");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("full-prompt-text")));
  });

  it("copies the text and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open("p3");
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("The menu grid overflows")));
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => el.textContent === "Copied")).toBe(true));
  });

  it("closes with Done and with Close, and stays shut for an id that is not a prompt", () => {
    const props = open("p3");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    cleanup();
    open("nope");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

const markup = () =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?look=refined"]}>
      <FullPromptWindow steps={list.steps} names={list.names} openId="p3" mode="maker" onTitle={() => undefined} onNavigate={() => undefined} onClose={() => undefined} />
    </MemoryRouter>,
  );

describe("the refined look (UI-P94)", () => {
  it("is the window recipe, 760 wide, radius 12, padding 20 24, over the scrim", () => {
    const html = markup();
    expect(html).toContain("background:var(--scrim)");
    expect(html).toMatch(/data-testid="full-prompt-window"[^>]*style="[^"]*background:var\(--window\)[^"]*width:min\(760px, calc\(100vw - 32px\)\)[^"]*padding:20px 24px;border:1px solid var\(--window-border\);border-radius:12px;box-shadow:var\(--window-shadow\)/);
  });

  it("draws the title and the text in wells, the text 320 high at 14.5/25, and the footer under the module hairline", () => {
    const html = markup();
    expect(html).toMatch(/background:var\(--well\)[^"]*height:44px/);
    expect(html).toMatch(/data-testid="full-prompt-text" style="background:var\(--well\)[^"]*height:320px[^"]*padding:16px[^"]*font-size:14.5px[^"]*line-height:25px/);
    expect(html).toContain("padding-top:16px;border-top:1px solid var(--hairline-module)");
  });

  it("draws Copy prompt with no icon, the neighbours as ghosts and Done as the one primary", () => {
    open("p3");
    expect(screen.getByRole("button", { name: "Copy prompt" }).querySelector("svg")).toBeNull();
    expect(screen.getByRole("button", { name: "Copy prompt" }).getAttribute("data-variant")).toBe("secondary");
    expect(screen.getByRole("button", { name: "Done" }).getAttribute("data-variant")).toBe("primary");
    expect(screen.getByRole("button", { name: /^Previous prompt/ }).getAttribute("data-variant")).toBe("ghost");
  });
});
