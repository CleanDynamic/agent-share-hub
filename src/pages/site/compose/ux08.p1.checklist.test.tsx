// UX-08 P1: the publish checklist's group under Required, Opens on OpenBuilds: one line, This opens <n> still-open topics, and an In
// control that applies to all of them. It never blocks Publish, and it is absent at zero.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { publishChecklist, type ChecklistInput } from "@/lib/build/publishChecklist";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { SandboxView, type SandboxViewProps } from "./SandboxView";

const input = (over: Partial<ChecklistInput> = {}): ChecklistInput => ({
  missing: [], title: "Bakery homepage", description: "A warm homepage.", cover: "image", tiles: 18, blockers: [], threadHold: null, reminders: [], appless: [], cardFilled: true, unsent: [], ...over,
});

function view(over: Partial<ChecklistInput> = {}, extra: Partial<NonNullable<SandboxViewProps["publish"]>> = {}) {
  const props = {
    ...sandboxViewProps("bakery"),
    onPublish: vi.fn(),
    onLens: vi.fn(),
    onAddPromptFocus: vi.fn(),
    post: <p contentEditable suppressContentEditableWarning>the post body</p>,
    publish: { checklist: publishChecklist(input(over)), confirm: () => ({ post: { words: 240, links: 3 }, parts: 1, sessions: 4, tiles: 18, files: [], card: [] }), onShowApps: vi.fn(), ...extra },
  } as SandboxViewProps;
  render(
    <MemoryRouter>
      <SandboxView {...props} />
    </MemoryRouter>,
  );
  return props;
}

const press = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  });
};

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return { matches: min ? 1440 >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(cleanup);

describe("publishChecklist · opens", () => {
  it("counts the topics, never counts as a required item, and asks for the checklist", () => {
    const out = publishChecklist(input({ opens: 2 }));
    expect(out.opens).toBe(2);
    expect(out.openRequired).toBe(0);
    expect(out.canPublish).toBe(true);
    expect(out.note).toBeNull();
    expect(out.needed).toBe(true);
    expect(out.line).toBe("");
  });

  it("is absent at zero, and the checklist is not asked for on its account", () => {
    const out = publishChecklist(input());
    expect(out.opens).toBe(0);
    expect(out.needed).toBe(false);
    expect(publishChecklist(input({ opens: 0 })).opens).toBe(0);
  });

  it("does not stop a build that is otherwise blocked from reading as blocked", () => {
    const out = publishChecklist(input({ opens: 3, missing: ["title"] }));
    expect(out.canPublish).toBe(false);
    expect(out.openRequired).toBe(1);
  });
});

describe("the checklist window · Opens on OpenBuilds", () => {
  it("draws the group with one line and the In control, and Publish stays live", async () => {
    const props = view({ opens: 2 }, { opensIn: <button type="button">In: No space</button> });
    await press();
    const window = screen.getByTestId("publish-checklist");
    const group = within(window).getByRole("region", { name: "Opens on OpenBuilds" });
    expect(within(group).getByText("This opens 2 still-open topics")).toBeTruthy();
    expect(within(group).getByRole("button", { name: "In: No space" })).toBeTruthy();
    const publish = screen.getByTestId("checklist-publish") as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
    expect(screen.queryByTestId("checklist-note")).toBeNull();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("says topic for one", async () => {
    view({ opens: 1 });
    await press();
    expect(screen.getByText("This opens 1 still-open topic")).toBeTruthy();
  });

  it("is not drawn at zero: with nothing else open, Publish goes straight to Confirm", async () => {
    view();
    await press();
    expect(screen.queryByTestId("publish-checklist")).toBeNull();
  });

  it("sits beside Required when something there is open, and does not turn Publish on", async () => {
    view({ opens: 2, missing: ["title"] });
    await press();
    const window = screen.getByTestId("publish-checklist");
    expect(within(window).getByRole("region", { name: "Required" })).toBeTruthy();
    expect(within(window).getByRole("region", { name: "Opens on OpenBuilds" })).toBeTruthy();
    expect((screen.getByTestId("checklist-publish") as HTMLButtonElement).disabled).toBe(true);
  });
});
