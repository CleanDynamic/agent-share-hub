// CA-25 P1: Publish opens the checklist, its actions, and no toast.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { publishChecklist, type ChecklistInput } from "@/lib/build/publishChecklist";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { SandboxView, type SandboxViewProps } from "./SandboxView";

const input = (over: Partial<ChecklistInput> = {}): ChecklistInput => ({
  missing: [],
  title: "Bakery homepage",
  description: "A warm homepage.",
  cover: "image",
  tiles: 18,
  blockers: [],
  threadHold: null,
  reminders: [],
  appless: [],
  cardFilled: true,
  ...over,
});

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

function view(over: Partial<ChecklistInput> = {}, extra: Partial<SandboxViewProps> = {}) {
  const onShowApps = vi.fn();
  const props = {
    ...sandboxViewProps("bakery"),
    onPublish: vi.fn(),
    onLens: vi.fn(),
    onAddPromptFocus: vi.fn(),
    post: <p contentEditable suppressContentEditableWarning>the post body</p>,
    publish: { checklist: publishChecklist(input(over)), confirm: () => ({ post: { words: 240, links: 3 }, parts: 1, sessions: 4, tiles: 18, files: [], card: [] }), onShowApps },
    ...extra,
  } as SandboxViewProps;
  render(
    <MemoryRouter>
      <SandboxView {...props} />
    </MemoryRouter>,
  );
  return { props, onShowApps };
}

const press = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  });
};

beforeEach(() => {
  stubWidth(1440);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  toast.mockClear();
  toast.error.mockClear();
});
afterEach(cleanup);

const OPEN = { missing: ["evidence", "title"] as const, cardFilled: false, appless: [{ key: "s2", number: 2 }, { key: "s4", number: 4 }] };

describe("the checklist window", () => {
  it("opens on Publish while something is open, with its title, its line and both sections", async () => {
    const { props } = view({ ...OPEN, missing: [...OPEN.missing] });
    await press();
    const window = screen.getByTestId("publish-checklist");
    expect(within(window).getByText("Publish checklist")).toBeTruthy();
    expect(within(window).getByTestId("checklist-line").textContent).toBe("2 required · 2 recommended");
    expect(within(window).getByRole("region", { name: "Required" })).toBeTruthy();
    expect(within(window).getByRole("region", { name: "Recommended" })).toBeTruthy();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("greys its Publish while a required item is open, with the note beside Close", async () => {
    const { props } = view({ ...OPEN, missing: [...OPEN.missing] });
    await press();
    expect((screen.getByTestId("checklist-publish") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("checklist-note").textContent).toBe("Complete 2 required items to publish");
    fireEvent.click(screen.getByTestId("checklist-publish"));
    expect(props.onPublish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("checklist-close"));
    expect(screen.queryByTestId("publish-checklist")).toBeNull();
  });

  it("shows only Recommended, and a live Publish with no note, when nothing required is open", async () => {
    const { props } = view({ cardFilled: false });
    await press();
    expect(screen.queryByRole("region", { name: "Required" })).toBeNull();
    expect(screen.getByRole("region", { name: "Recommended" })).toBeTruthy();
    expect(screen.queryByTestId("checklist-note")).toBeNull();
    const publish = screen.getByTestId("checklist-publish") as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
    fireEvent.click(publish);
    expect(screen.queryByTestId("publish-checklist")).toBeNull();
    expect(screen.getByTestId("publish-confirm")).toBeTruthy();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("goes straight to Confirm when nothing is open", async () => {
    const { props } = view();
    await press();
    expect(screen.queryByTestId("publish-checklist")).toBeNull();
    expect(screen.getByTestId("publish-confirm")).toBeTruthy();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("makes no toast", async () => {
    view({ ...OPEN, missing: [...OPEN.missing] });
    await press();
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("the checklist's actions, each of which closes the window", () => {
  const choose = async (label: string) => {
    await press();
    fireEvent.click(within(screen.getByTestId("publish-checklist")).getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(screen.queryByTestId("publish-checklist")).toBeNull();
  };

  it("Add cover goes to the post, with the caret in it", async () => {
    view({ ...OPEN, missing: [...OPEN.missing] });
    await choose("Add cover");
    await waitFor(() => expect(document.activeElement?.getAttribute("contenteditable")).toBe("true"));
  });

  it("Add title opens the Card on its title, and Add description on its summary", async () => {
    view({ ...OPEN, missing: ["title", "outcome"] });
    await choose("Add title");
    await waitFor(() => expect(screen.getByTestId("sandbox-card")).toBeTruthy());
    await waitFor(() => expect(document.activeElement?.id).toBe("card-title"));
    cleanup();
    view({ ...OPEN, missing: ["title", "outcome"] });
    await choose("Add description");
    await waitFor(() => expect(document.activeElement?.id).toBe("card-summary"));
  });

  it("Add prompt asks the page to put the cursor in the add field", async () => {
    const { props } = view({ ...OPEN, missing: ["instruction_or_artefact"] });
    await choose("Add prompt");
    await waitFor(() => expect(props.onAddPromptFocus).toHaveBeenCalledTimes(1));
  });

  it("Go to it scrolls to the item and outlines it", async () => {
    view(
      { missing: [], blockers: [{ line: "Decision 'Pick' needs at least two options for 'a'", stepId: "n1" }] },
      { list: <div data-tile-id="n1">the tile</div> },
    );
    await choose("Go to it");
    await waitFor(() => expect(screen.getByTestId("outline-once")).toBeTruthy());
  });

  it("Show hands the sessions with no app to the page", async () => {
    const { onShowApps } = view({ ...OPEN, missing: [...OPEN.missing] });
    await choose("Show");
    await waitFor(() => expect(onShowApps).toHaveBeenCalledWith(["s2", "s4"]));
  });

  it("Open card opens the Classification Card", async () => {
    view({ ...OPEN, missing: [...OPEN.missing] });
    await choose("Open card");
    await waitFor(() => expect(screen.getByTestId("sandbox-card")).toBeTruthy());
  });
});
