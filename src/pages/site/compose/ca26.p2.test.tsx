// CA-26 P2: every window keeps focus inside, opens on its first field or primary action, closes onto what opened it, and
// answers Escape for itself alone.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishChecklist } from "@/lib/build/publishChecklist";

import { AddAgentDialog } from "./AddAgentDialog";
import { AddCheckDialog } from "./AddCheckDialog";
import { AddCodeDialog } from "./AddCodeDialog";
import { AddDatasetDialog } from "./AddDatasetDialog";
import { AddDecisionDialog } from "./AddDecisionDialog";
import { AddManualStepDialog } from "./AddManualStepDialog";
import { AddRepoDialog } from "./AddRepoDialog";
import { AddResultDialog } from "./AddResultDialog";
import { AddSystemPromptDialog } from "./AddSystemPromptDialog";
import { AddToolDialog } from "./AddToolDialog";
import { ClashWindow } from "./ClashWindow";
import { ClearBuildDialog } from "./ClearBuildDialog";
import { ConvertWindow } from "./ConvertWindow";
import { PublishChecklist } from "./PublishChecklist";
import { PublishConfirm } from "./PublishConfirm";
import { ConfirmDialog, KeepLinkDialog } from "./referencePieces";
import { RecentlyRemovedDialog } from "./RecentlyRemovedDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";

import { done, mountList, partsOf } from "./ca21Harness";
import { ModalShell } from "./ModalFrame";
import { SmallWindow } from "./removePieces";
import { RecipeWindow } from "./saveWindows";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(done);

type Render = (open: boolean, close: () => void) => ReactNode;

function Host({ draw }: { draw: Render }) {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <button type="button" onClick={() => setOpen(true)}>
        Opener
      </button>
      {draw(open, () => setOpen(false))}
    </MemoryRouter>
  );
}

const noop = () => undefined;
const checklist = publishChecklist({ missing: [], title: "Bakery homepage", description: "A warm homepage.", cover: "image", tiles: 18, blockers: [], threadHold: null, reminders: [], appless: [], cardFilled: true });

/** Every window the build page opens, drawn as the page draws it. */
const WINDOWS: readonly (readonly [string, Render])[] = [
  ["Add › Tool", (open, close) => <AddToolDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} />],
  ["Add › Dataset", (open, close) => <AddDatasetDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} />],
  ["Add › Repository", (open, close) => <AddRepoDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} inBuild={[]} fetchRepo={() => Promise.resolve(null)} />],
  ["Add › System prompt", (open, close) => <AddSystemPromptDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} prompts={[]} session="s1" />],
  ["Add › Result", (open, close) => <AddResultDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} />],
  ["Add › Check", (open, close) => <AddCheckDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} />],
  ["Add › Code", (open, close) => <AddCodeDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} />],
  ["Add › Decision", (open, close) => <AddDecisionDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} codeTiles={[]} stepChoices={[]} />],
  ["Add › Manual step", (open, close) => <AddManualStepDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} available after="3 · Fix it" />],
  ["Add › Agent", (open, close) => <AddAgentDialog open={open} onOpenChange={(next) => !next && close()} onAdd={noop} nextNumber={4} teamsAvailable />],
  ["Recently removed", (open, close) => <RecentlyRemovedDialog open={open} entries={[]} onRestore={noop} onClose={close} />],
  ["Clear build", (open, close) => <ClearBuildDialog open={open} counts={{ parts: 1, sessions: 2, tiles: 3, files: 0 }} onClose={close} onConfirm={close} />],
  ["Shortcuts", (open, close) => <ShortcutsDialog open={open} onClose={close} />],
  ["Convert", (open, close) => <ConvertWindow conversion={open ? { id: "n1", to: "agent", name: "Prompt 3", lost: ["Effort"] } : null} onClose={close} onConfirm={close} />],
  ["Clash", (open, close) => <ClashWindow view={open ? { title: "Prompt 2 changed in another tab", mineLabel: "This tab · 20:41", theirsLabel: "Other tab · 20:42", mine: [{ label: "", text: "mine" }], theirs: [{ label: "", text: "theirs" }] } : null} onUseOther={close} onKeepThis={close} />],
  ["Publish checklist", (open, close) => <PublishChecklist open={open} checklist={checklist} onClose={close} onAction={noop} onPublish={close} />],
  ["Publish confirm", (open, close) => <PublishConfirm open={open} title="Publish Bakery homepage" rows={[]} onCancel={close} onPublish={close} />],
  ["Keep which link", (open, close) => <KeepLinkDialog open={open} title="Keep which" action="Keep" choices={[{ key: "a", owner: "Code 4", words: "the order form", post: 1 }]} onPick={close} onCancel={close} />],
  ["Confirm", (open, close) => <ConfirmDialog open={open} title="Remove link" body="Remove it?" action="Remove" onConfirm={close} onCancel={close} />],
  ["Frame: ModalShell", (open, close) => <ModalShell open={open} onOpenChange={(next) => !next && close()} title="A window" subtitle="Does a thing" testId="frame"><input aria-label="Name" /></ModalShell>],
  ["Frame: SmallWindow", (open, close) => <SmallWindow open={open} onClose={close} title="Sure?" body="Really" testId="small" buttons={<button type="button" onClick={close}>Cancel</button>} />],
  ["Frame: RecipeWindow", (open, close) => <RecipeWindow open={open} onClose={close} title="Sure?" testId="recipe" width={420} buttons={<button type="button" data-variant="primary" onClick={close}>Go</button>} />],
];

const dialog = () => (screen.queryByRole("dialog") ?? screen.queryByRole("alertdialog")) as HTMLElement | null;
const TABBABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

async function openFrom(draw: Render) {
  render(<Host draw={draw} />);
  const opener = screen.getByRole("button", { name: "Opener" });
  act(() => opener.focus());
  fireEvent.click(opener);
  await waitFor(() => expect(dialog()).not.toBeNull());
  return opener;
}

describe.each([false, true])("every window (phone: %s)", (onPhone) => {
  beforeEach(() => {
    phone = onPhone;
  });

  it.each(WINDOWS)("%s: focus goes inside, not to Close; Tab and Shift+Tab stay inside; Escape closes it and focus comes back", async (_name, draw) => {
    const opener = await openFrom(draw);
    const win = dialog() as HTMLElement;
    await waitFor(() => expect(win.contains(document.activeElement)).toBe(true));
    const first = document.activeElement as HTMLElement;
    expect(first.getAttribute("aria-label") === "Close" || first.textContent === "Close").toBe(false);

    const tabs = [...win.querySelectorAll<HTMLElement>(TABBABLE)];
    expect(tabs.length).toBeGreaterThan(0);
    const last = tabs[tabs.length - 1];
    act(() => last.focus());
    fireEvent.keyDown(last, { key: "Tab" });
    expect(win.contains(document.activeElement)).toBe(true);
    act(() => tabs[0].focus());
    fireEvent.keyDown(tabs[0], { key: "Tab", shiftKey: true });
    expect(win.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    if (STAYS_FOR_ESCAPE.has(_name)) {
      // A question that has to be answered: Escape leaves it open and focus inside it.
      expect(dialog()).not.toBeNull();
      expect((dialog() as HTMLElement).contains(document.activeElement)).toBe(true);
      return;
    }
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

/** The clash window asks which version to keep: it has no way out but the two answers. */
const STAYS_FOR_ESCAPE = new Set(["Clash"]);

describe("a window opens on its first field, or its primary action", () => {
  it("a window with a field opens on the field", async () => {
    await openFrom(WINDOWS.find(([name]) => name === "Add › Code")![1]);
    await waitFor(() => expect(document.activeElement?.tagName).toMatch(/TEXTAREA|INPUT/));
  });
  it("a window with no field opens on its primary action", async () => {
    await openFrom(WINDOWS.find(([name]) => name === "Frame: RecipeWindow")![1]);
    await waitFor(() => expect(document.activeElement?.getAttribute("data-variant")).toBe("primary"));
  });
});

describe("Escape closes only the top window", () => {
  it("a window opened over a window: Escape closes the top one and leaves the one under it open, and focus goes back into it", async () => {
    function Stack() {
      const [over, setOver] = useState(false);
      return (
        <ModalShell open onOpenChange={noop} title="Under" subtitle="x" testId="under">
          <button type="button" onClick={() => setOver(true)}>
            Ask
          </button>
          <SmallWindow open={over} onClose={() => setOver(false)} title="Over" testId="over" buttons={<button type="button">Fine</button>} />
        </ModalShell>
      );
    }
    render(<Stack />);
    const ask = await screen.findByRole("button", { name: "Ask" });
    act(() => ask.focus());
    fireEvent.click(ask);
    await screen.findByTestId("over");
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("over")).toBeNull());
    expect(screen.getByTestId("under")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(ask));
  });
});

describe("when the opener is gone", () => {
  it("focus goes to the item now in its place in the build", async () => {
    const list = mountList({ parts: partsOf() });
    const tiles = () => [...document.querySelectorAll<HTMLElement>('[data-testid="build-list"] [data-testid="step-card"]')];
    const before = tiles();
    const opener = before[1];
    act(() => opener.focus());
    function Window({ open, close }: { open: boolean; close: () => void }) {
      return <SmallWindow open={open} onClose={close} title="Remove it?" testId="remove" buttons={<button type="button" data-variant="primary" onClick={close}>Remove</button>} />;
    }
    let setOpen: (value: boolean) => void = noop;
    function Open() {
      const [open, set] = useState(false);
      setOpen = set;
      return <Window open={open} close={() => set(false)} />;
    }
    render(<Open />);
    act(() => setOpen(true));
    await waitFor(() => expect(dialog()).not.toBeNull());
    // The tile that opened it is removed while the window is open.
    const key = opener.dataset.nodeId as string;
    opener.remove();
    expect(document.querySelector(`[data-node-id="${key}"]`)).toBeNull();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(document.querySelector('[data-testid="build-list"]')?.contains(document.activeElement)).toBe(true);
    list.unmount();
  });

  it("failing an item, focus goes to the build list", async () => {
    let setOpen: (value: boolean) => void = noop;
    let drop: () => void = noop;
    function Open() {
      const [open, set] = useState(false);
      const [there, setThere] = useState(true);
      setOpen = set;
      drop = () => setThere(false);
      return (
        <>
          <section aria-label="Build" tabIndex={-1}>
            <div data-testid="build-list" />
          </section>
          {there ? (
            <button type="button" id="gone">
              gone
            </button>
          ) : null}
          <SmallWindow open={open} onClose={() => set(false)} title="Sure?" testId="remove" buttons={<button type="button">Cancel</button>} />
        </>
      );
    }
    render(<Open />);
    const gone = document.getElementById("gone") as HTMLElement;
    act(() => gone.focus());
    act(() => setOpen(true));
    await waitFor(() => expect(dialog()).not.toBeNull());
    act(() => drop());
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[aria-label="Build"]')));
  });
});

describe("a window opened from a menu returns to the menu's button", () => {
  it("the menu item is gone by then; the button that opened the menu takes the focus", async () => {
    const { default: Menus } = await import("./ca26.menuHost");
    render(<Menus />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    act(() => trigger.focus());
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Remove" });
    fireEvent.click(item);
    await waitFor(() => expect(dialog()).not.toBeNull());
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
