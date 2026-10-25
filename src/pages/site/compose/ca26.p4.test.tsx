// CA-26 P4: one announcer. Every source says what it says through the one polite region, in its words; a newer message replaces
// the older; the old regions are gone.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);
vi.setConfig({ testTimeout: 40_000 });

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { pendingWrites } from "@/lib/build/pendingWrites";

import { ANNOUNCE_BEAT_MS, BuildAnnouncer, noticeWords, useAnnounce } from "./BuildAnnouncer";
import { BuildList } from "./BuildList";
import { DRAFT, mountComposer, setBrowserOnline, stubWidth } from "./ca23.harness";
import { keys, pickUp, press, sessionOps, stubLayout, stubMedia } from "./ca21Harness";
import { SaveLine } from "./SaveLine";
import { SessionHead } from "./SessionHead";
import type { SaveState } from "./composeModel";

const region = () => screen.getByTestId("build-announcer");
const heard = () => region().textContent;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

afterEach(() => {
  setBrowserOnline(true);
  cleanup();
  pendingWrites.reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Say({ say }: { say: readonly string[] }) {
  const announce = useAnnounce();
  return (
    <button type="button" onClick={() => say.forEach((message) => announce(message))}>
      say
    </button>
  );
}

describe("the announcer", () => {
  it("is one polite, visually hidden region, mounted with its message empty", () => {
    render(<BuildAnnouncer />);
    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(region().getAttribute("role")).toBe("status");
    expect(region().textContent).toBe("");
    expect(region().style.width).toBe("1px");
    expect(region().style.overflow).toBe("hidden");
  });

  it("says a message a beat after it is asked, and nothing before", async () => {
    render(
      <BuildAnnouncer>
        <Say say={["Saved."]} />
      </BuildAnnouncer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "say" }));
    expect(heard()).toBe("");
    await waitFor(() => expect(heard()).toBe("Saved."));
    expect(ANNOUNCE_BEAT_MS).toBeLessThan(100);
  });

  it("holds one message: a newer one asked within 500 ms replaces the older, which is never said", async () => {
    const seen: string[] = [];
    render(
      <BuildAnnouncer>
        <Say say={["Removed Prompt 2. Undo available.", "Moved Prompt 3 to Session 1."]} />
      </BuildAnnouncer>,
    );
    new MutationObserver(() => seen.push(heard() ?? "")).observe(region(), { childList: true, characterData: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: "say" }));
    await wait(200);
    expect(heard()).toBe("Moved Prompt 3 to Session 1.");
    expect(seen.filter(Boolean)).toEqual(["Moved Prompt 3 to Session 1."]);
  });

  it("says the same sentence twice when it is asked twice", async () => {
    const { rerender } = render(
      <BuildAnnouncer>
        <Say say={["Saved."]} />
      </BuildAnnouncer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "say" }));
    await waitFor(() => expect(heard()).toBe("Saved."));
    const seen: string[] = [];
    new MutationObserver(() => seen.push(heard() ?? "")).observe(region(), { childList: true, characterData: true, subtree: true });
    rerender(
      <BuildAnnouncer>
        <Say say={["Saved."]} />
      </BuildAnnouncer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "say" }));
    await waitFor(() => expect(heard()).toBe("Saved."));
    expect(seen).toContain("");
  });

  it("does nothing outside the page's announcer", () => {
    render(<Say say={["Saved."]} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "say" }))).not.toThrow();
  });
});

describe("a notice, in its words, and that Undo is there", () => {
  it("Removed Prompt 2. Undo available.", () => {
    expect(noticeWords({ sentence: "Removed Prompt 2" })).toBe("Removed Prompt 2. Undo available.");
  });
  it("a notice that is only news has no Undo, and keeps its own full stops once", () => {
    expect(noticeWords({ sentence: "Reconnected. 1 change saved.", noUndo: true })).toBe("Reconnected. 1 change saved.");
    expect(noticeWords({ sentence: "Moved Prompt 2.", noUndo: false })).toBe("Moved Prompt 2. Undo available.");
  });
});

describe("the save states", () => {
  const draw = (save: SaveState) => (
    <BuildAnnouncer>
      <SaveLine save={save} onRetry={() => undefined} />
    </BuildAnnouncer>
  );

  it("Saved. once after a save, whether or not saving… was long enough to be drawn; nothing when it is already saved, or when the connection comes back", async () => {
    const { rerender } = render(draw("saved"));
    await wait(120);
    expect(heard()).toBe("");
    rerender(draw("offline"));
    rerender(draw("saved"));
    await wait(120);
    expect(heard()).toBe("");
    rerender(draw("saving"));
    rerender(draw("saved"));
    await waitFor(() => expect(heard()).toBe("Saved."));
    await act(async () => {
      rerender(draw("saved"));
      await wait(120);
    });
    expect(heard()).toBe("Saved.");
  });

  it("Not saved. Retry available.", async () => {
    const { rerender } = render(draw("saving"));
    rerender(draw("error"));
    await waitFor(() => expect(heard()).toBe("Not saved. Retry available."));
  });
});

describe("a session head", () => {
  it("says how far past the limit a title has run, through the announcer", async () => {
    const [head] = [...sandboxListProps("bakery").dividers.values()];
    render(
      <BuildAnnouncer>
        <MemoryRouter>
          <SessionHead session={head} phone={false} tiles={3} collapsed={false} controls="x" first last onToggle={() => undefined} ops={sessionOps()} editable />
        </MemoryRouter>
      </BuildAnnouncer>,
    );
    const field = screen.getByTestId("session-title") as HTMLInputElement;
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "x".repeat(90) } });
    await waitFor(() => expect(heard()).toMatch(/^\d+\/\d+$/));
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  });
});

describe("the list's keyboard moves (CA-21's lines)", () => {
  beforeEach(stubMedia);

  it("pick up, move and drop each say their line, and only the last is left", async () => {
    stubLayout();
    render(
      <BuildAnnouncer>
        <MemoryRouter>
          <BuildList
            {...sandboxListProps("bakery")}
            onToggleCollapsed={vi.fn()}
            sessionOps={sessionOps()}
            onNest={vi.fn(() => Promise.resolve(true))}
            canNest={() => true}
            onMoveToSession={vi.fn(() => Promise.resolve(true))}
            onDropSession={vi.fn(() => Promise.resolve())}
            onDropOnWorkstream={vi.fn(() => Promise.resolve())}
            onDropWorkstream={vi.fn(() => Promise.resolve())}
          />
        </MemoryRouter>
      </BuildAnnouncer>,
    );
    expect(keys().length).toBeGreaterThan(0);
    const grip = screen.getAllByTestId("drag-handle")[0];
    await pickUp(grip);
    await waitFor(() => expect(heard()).toMatch(/^Picked up Prompt 1\. Session 1, 1 of \d+\.$/));
    await press("ArrowDown");
    await waitFor(() => expect(heard()).toMatch(/^Over /));
    await press("Escape");
    await waitFor(() => expect(heard()).toMatch(/^Put back in /));
    // The visible line is still drawn; it is no longer a live region of its own.
    expect(screen.getByTestId("nest-said").getAttribute("aria-live")).toBeNull();
    expect(screen.getByTestId("sessions-said").getAttribute("aria-live")).toBeNull();
  });
});

describe("the composer", () => {
  beforeEach(() => {
    stubWidth(1280);
    localStorage.clear();
    Element.prototype.scrollIntoView = () => undefined;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("has one live region of its own, and a notice and a save go through it", async () => {
    mountComposer(`/compose/${DRAFT}`);
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    const own = [...document.querySelectorAll("[aria-live]")].filter((el) => !el.closest('[aria-label^="Notifications"]'));
    expect(own).toHaveLength(1);
    expect(own[0]).toBe(region());
    expect(document.querySelector('[data-testid="reference-notice"][role="status"]')).toBeNull();

    // A save: Saved.
    fireEvent.click(await screen.findByRole("button", { name: "Classification Card" }, { timeout: 10_000 }));
    const dialog = await screen.findByTestId("sandbox-card");
    fireEvent.change(dialog.querySelector('input[aria-label="Title"], input#title, input') as HTMLInputElement, { target: { value: "A new title" } });
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Save") as HTMLElement);
    await waitFor(() => expect(screen.queryByTestId("sandbox-card")).toBeNull(), { timeout: 5_000 });
    const seen: string[] = [];
    seen.push(screen.getByTestId("sandbox-status").textContent ?? "");
    await waitFor(() => expect(heard()).toBe("Saved."), { timeout: 10_000 });

    // A notice that is news: Reconnected. 1 change saved.
    setBrowserOnline(false);
    fireEvent.click(await screen.findByRole("button", { name: "Classification Card" }));
    const again = await screen.findByTestId("sandbox-card");
    fireEvent.change(again.querySelector("input") as HTMLInputElement, { target: { value: "Offline title" } });
    fireEvent.click(Array.from(again.querySelectorAll("button")).find((button) => button.textContent === "Save") as HTMLElement);
    await waitFor(() => expect(screen.queryByTestId("sandbox-card")).toBeNull(), { timeout: 5_000 });
    setBrowserOnline(true);
    await waitFor(() => expect(screen.getByTestId("reference-notice").textContent).toMatch(/^Reconnected\. \d+ changes? saved\.$/), { timeout: 10_000 });
    await waitFor(() => expect(heard()).toMatch(/^Reconnected\. \d+ changes? saved\.$/), { timeout: 5_000 });
  });
});

describe("the old regions are gone", () => {
  const read = (file: string) => fs.readFileSync(path.resolve(__dirname, file), "utf8");
  it.each(["DetailsPanel.tsx", "AgentSetupFields.tsx", "BuildList.tsx", "SessionHead.tsx"])("%s has no aria-live of its own", (file) => {
    expect(read(file)).not.toMatch(/aria-live/);
  });
  it("nothing else in the composer's folder is a live region but the announcer (and the form errors' own alerts)", () => {
    const files = fs.readdirSync(__dirname).filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name));
    const live = files.filter((name) => /aria-live/.test(read(name)));
    expect(live).toEqual(["BuildAnnouncer.tsx"]);
  });
});
