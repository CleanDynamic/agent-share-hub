/* CA-23 P1: the status line's words, the 300 ms delay, minutes then the clock, the ranking, and Retry. */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mergeSave, saveState, saveWords, SAVE_WORDS } from "./composeModel";
import { SaveLine } from "./SaveLine";
import { DANGER } from "./referencePieces";

const MIN = 60_000;
const at = (ms: number) => new Date(ms);

describe("saveWords", () => {
  const base = { lastSavedAt: at(0), pending: 0, now: 0 };
  it("says each state in its own words", () => {
    expect(SAVE_WORDS).toEqual({ saving: "saving…", saved: "saved", offline: "offline", error: "not saved" });
    expect(saveWords("saving", base)).toBe("saving…");
    expect(saveWords("error", base)).toBe("not saved");
    expect(saveWords("offline", { ...base, pending: 3 })).toBe("offline · 3 changes pending");
  });

  it("says one change in the singular", () => {
    expect(saveWords("offline", { ...base, pending: 1 })).toBe("offline · 1 change pending");
  });

  it("reads saved for the first minute, then minutes ago, then the clock after an hour", () => {
    const saved = new Date(2026, 9, 24, 14, 5, 0);
    const t0 = saved.getTime();
    expect(saveWords("saved", { lastSavedAt: saved, pending: 0, now: t0 + 59_000 })).toBe("saved");
    expect(saveWords("saved", { lastSavedAt: saved, pending: 0, now: t0 + MIN })).toBe("saved 1 min ago");
    expect(saveWords("saved", { lastSavedAt: saved, pending: 0, now: t0 + 2 * MIN + 5_000 })).toBe("saved 2 min ago");
    expect(saveWords("saved", { lastSavedAt: saved, pending: 0, now: t0 + 59 * MIN + 59_000 })).toBe("saved 59 min ago");
    expect(saveWords("saved", { lastSavedAt: saved, pending: 0, now: t0 + 60 * MIN })).toBe("saved at 14:05");
    expect(saveWords("saved", { lastSavedAt: new Date(2026, 9, 24, 9, 7), pending: 0, now: new Date(2026, 9, 24, 12, 0).getTime() })).toBe("saved at 09:07");
  });

  it("reads saved when there is no time to count from", () => {
    expect(saveWords("saved", { lastSavedAt: null, pending: 0, now: 1 })).toBe("saved");
  });
});

describe("the ranking", () => {
  it("puts error above offline, offline above saving, saving above saved", () => {
    expect(mergeSave("saved", "saving", "offline", "error")).toBe("error");
    expect(mergeSave("saved", "saving", "offline")).toBe("offline");
    expect(mergeSave("saved", "saving")).toBe("saving");
    expect(mergeSave("saved", "idle")).toBe("saved");
    expect(mergeSave("idle", "idle")).toBe("idle");
  });

  it("reads an error before no connection before a write in flight", () => {
    expect(saveState({ isSaving: true, saveError: new Error("x"), lastSavedAt: null, offline: true })).toBe("error");
    expect(saveState({ isSaving: true, saveError: null, lastSavedAt: null, offline: true })).toBe("offline");
    expect(saveState({ isSaving: true, saveError: null, lastSavedAt: null })).toBe("saving");
    expect(saveState({ isSaving: false, saveError: null, lastSavedAt: new Date() })).toBe("saved");
    expect(saveState({ isSaving: false, saveError: null, lastSavedAt: null })).toBe("idle");
  });
});

describe("SaveLine", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 24, 14, 5, 0) }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const line = (node: React.ReactElement) => render(<p data-testid="line">Draft{node}</p>);
  /** What is drawn: the words a screen reader reads as a description are hidden, so they are left out. */
  const text = () => {
    const copy = screen.getByTestId("line").cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[data-testid="reason"]').forEach((node) => node.remove());
    return copy.textContent;
  };

  it("holds saving… back for 300 ms so a quick save never flickers", () => {
    const savedAt = new Date();
    const view = line(<SaveLine save="saved" lastSavedAt={savedAt} onRetry={() => undefined} />);
    expect(text()).toBe("Draft · saved");
    view.rerender(<p data-testid="line">Draft<SaveLine save="saving" lastSavedAt={savedAt} onRetry={() => undefined} /></p>);
    act(() => void vi.advanceTimersByTime(299));
    expect(text()).toBe("Draft · saved");
    act(() => void vi.advanceTimersByTime(1));
    expect(text()).toBe("Draft · saving…");
    view.rerender(<p data-testid="line">Draft<SaveLine save="saved" lastSavedAt={new Date()} onRetry={() => undefined} /></p>);
    expect(text()).toBe("Draft · saved");
  });

  it("never shows a save that landed within 300 ms", () => {
    const view = line(<SaveLine save="idle" onRetry={() => undefined} />);
    view.rerender(<p data-testid="line">Draft<SaveLine save="saving" onRetry={() => undefined} /></p>);
    act(() => void vi.advanceTimersByTime(200));
    expect(text()).toBe("Draft");
    view.rerender(<p data-testid="line">Draft<SaveLine save="saved" lastSavedAt={new Date()} onRetry={() => undefined} /></p>);
    act(() => void vi.advanceTimersByTime(1000));
    expect(text()).toBe("Draft · saved");
  });

  it("moves saved on to minutes ago on one shared timer, then to the clock", () => {
    const savedAt = new Date();
    render(
      <>
        <p data-testid="a">Draft<SaveLine save="saved" lastSavedAt={savedAt} onRetry={() => undefined} /></p>
        <p data-testid="b">Published<SaveLine save="saved" lastSavedAt={savedAt} onRetry={() => undefined} /></p>
      </>,
    );
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getByTestId("a").textContent).toBe("Draft · saved");
    act(() => void vi.advanceTimersByTime(2 * MIN));
    expect(screen.getByTestId("a").textContent).toBe("Draft · saved 2 min ago");
    expect(screen.getByTestId("b").textContent).toBe("Published · saved 2 min ago");
    act(() => void vi.advanceTimersByTime(58 * MIN));
    expect(screen.getByTestId("a").textContent).toBe("Draft · saved at 14:05");
  });

  it("reads offline with the count of writes waiting", () => {
    line(<SaveLine save="offline" pending={3} onRetry={() => undefined} />);
    expect(text()).toBe("Draft · offline · 3 changes pending");
  });

  it("reads not saved in the danger colour, with Retry, and the detail as its tooltip and description", () => {
    const onRetry = vi.fn();
    line(<SaveLine save="error" detail="Not saved: no connection." onRetry={onRetry} />);
    expect(text()).toBe("Draft · not saved · Retry");
    const words = screen.getByTestId("save-problem");
    expect(renderToStaticMarkup(<SaveLine save="error" onRetry={() => undefined} />)).toContain(`<span data-testid="save-problem"`);
    expect(renderToStaticMarkup(<SaveLine save="error" onRetry={() => undefined} />)).toContain(`style="color:${DANGER}"`);
    expect(words.getAttribute("title")).toBe("Not saved: no connection.");
    expect(document.getElementById(words.getAttribute("aria-describedby") as string)?.textContent).toBe("Not saved: no connection.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
