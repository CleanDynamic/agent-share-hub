// CA-19 P6 — the reference group window (board "References: groups and the Colours window", left): opening from each
// place, every block, order by dragging, adding and removing, the notes count, linked text both ways, the two-member
// rule, Delete group with its confirmation, and Save as one step.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import ReferencesDemo from "@/pages/dev/ReferencesDemo";

import { GROUP_WINDOW_COPY } from "./ReferenceGroupWindow";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

beforeEach(() => {
  // jsdom has no layout: dnd-kit's keyboard drag scrolls the row it lifts into view.
  Element.prototype.scrollIntoView = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined })) as never;
});
afterEach(cleanup);

function inApp(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?build=references"]}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const mount = () => inApp(<ReferencesDemo fit="content" viewport="desktop" />);
const win = () => screen.getByTestId("group-window");
const openFromLabel = () => fireEvent.click(within(screen.getByRole("group", { name: /^Code 4:/ })).getByTestId("group-label"));
const members = () => [...win().querySelectorAll("[data-sortable]")].map((row) => row.getAttribute("data-sortable"));
const notice = () => screen.getByTestId("reference-notice").textContent ?? "";
const colourButton = (name: RegExp) => screen.getAllByRole("button", { name })[0];

describe("opening", () => {
  it("opens from a group's label, with its head", () => {
    mount();
    openFromLabel();
    expect(within(win()).getByText("Reference group")).toBeTruthy();
    expect(within(win()).getByText("Components that work together, under one colour")).toBeTruthy();
    expect(within(win()).getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("opens from Open group in a member's picker", () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Check 5/));
    fireEvent.click(screen.getByRole("button", { name: "Open group" }));
    expect((within(win()).getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Login flow");
  });

  it("opens from Make a group with the component in it, unsaved, and no Delete group", () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Manual step 2/));
    fireEvent.click(within(screen.getByTestId("picker-group")).getByRole("button", { name: "Make a group" }));
    expect(members()).toEqual(["node:rf-m2"]);
    expect(within(win()).queryByTestId("group-delete")).toBeNull();
    expect((within(win()).getByRole("textbox", { name: GROUP_WINDOW_COPY.colourCode }) as HTMLInputElement).value).toBe("#7FA7D9");
    expect(within(win()).getByTestId("group-linked").textContent).toContain("Save the group to link words to it.");
  });
});

describe("the blocks", () => {
  it("draws Name, Colour, Components, Notes and Linked text, top to bottom", () => {
    mount();
    openFromLabel();
    const body = within(win()).getByTestId("group-window-body");
    expect((within(body).getByRole("textbox", { name: "Name" }) as HTMLInputElement).placeholder).toBe("Add a name");
    expect((within(body).getByRole("textbox", { name: GROUP_WINDOW_COPY.colourCode }) as HTMLInputElement).value).toBe("#7FB88A");
    expect(within(body).getByRole("button", { name: "Change…" })).toBeTruthy();
    expect(within(body).getByTestId("group-components").textContent).toContain("3 · drag to set the order");
    expect(members()).toEqual(["session:typed-0b1c2d3e-0000-4000-8000-0000000000a2", "node:rf-c4", "node:rf-k5"]);
    expect([...body.querySelectorAll("[data-sortable]")].map((row) => row.textContent)).toEqual(["S2Session 2Session", "4Send the linkCode", "5Link opens onceCheck"]);
    expect(within(body).getByTestId("group-notes").textContent).toContain("How these components work together · optional");
    expect(within(body).getByTestId("group-linked").textContent).toContain("Linked text · 1 of 1");
    expect(within(body).getByTestId("group-linked-words").textContent).toBe("Signing in by email link");
  });

  it("opens the colour picker for the group in place, and Done changes the colour", () => {
    mount();
    openFromLabel();
    fireEvent.click(within(win()).getByRole("button", { name: "Change…" }));
    const picker = within(win()).getByTestId("colour-picker-inline");
    fireEvent.click(within(picker).getByRole("button", { name: "#B79AD6" }));
    fireEvent.click(within(picker).getByRole("button", { name: "Done" }));
    expect((within(win()).getByRole("textbox", { name: GROUP_WINDOW_COPY.colourCode }) as HTMLInputElement).value).toBe("#B79AD6");
  });

  it("counts the notes", () => {
    mount();
    openFromLabel();
    const area = within(win()).getByTestId("group-notes").querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "Twelve chars" } });
    expect(within(win()).getByTestId("group-notes-count").textContent).toBe("12 / 2,000");
  });
});

describe("components", () => {
  it("adds from the list, greys components of other groups, and removes", () => {
    mount();
    openFromLabel();
    fireEvent.click(within(win()).getByTestId("group-add"));
    const list = within(win()).getByTestId("group-add-list");
    const prompt7 = list.querySelector('[data-add-choice="node:rf-p7"]') as HTMLButtonElement;
    expect(prompt7).toBeDisabled();
    fireEvent.click(list.querySelector('[data-add-choice="node:rf-m2"]') as HTMLButtonElement);
    expect(members()).toContain("node:rf-m2");
    fireEvent.click(within(win()).getByRole("button", { name: "Remove Send the link" }));
    expect(members()).not.toContain("node:rf-c4");
  });

  it("sets the order by dragging a grip (with the keyboard)", async () => {
    mount();
    openFromLabel();
    const grip = within(win()).getByRole("button", { name: "Move Link opens once" });
    grip.focus();
    fireEvent.keyDown(grip, { key: " ", code: "Space" });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowUp", code: "ArrowUp" });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: " ", code: "Space" });
    // jsdom lays nothing out here, so the drag itself is held to its order in referencePieces.test.tsx; here, the rows stay.
    await waitFor(() => expect(members()).toHaveLength(3));
  });

  it("needs two or more components to save", () => {
    mount();
    openFromLabel();
    fireEvent.click(within(win()).getByRole("button", { name: "Remove Send the link" }));
    fireEvent.click(within(win()).getByRole("button", { name: "Remove Link opens once" }));
    expect(within(win()).getByTestId("group-window-note").textContent).toBe("A group needs two or more components");
    expect(within(win()).getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("saving and deleting", () => {
  it("saves as one step, with Undo", async () => {
    mount();
    openFromLabel();
    fireEvent.change(within(win()).getByRole("textbox", { name: "Name" }), { target: { value: "Sign-in" } });
    fireEvent.click(within(win()).getByRole("button", { name: "Save" }));
    expect(screen.queryByTestId("group-window")).toBeNull();
    expect(notice()).toContain("Saved Sign-in");
    await waitFor(() => expect(document.querySelectorAll('[data-group-label="Sign-in"]').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId("notice-undo"));
    await waitFor(() => expect(document.querySelectorAll('[data-group-label="Login flow"]').length).toBeGreaterThan(0));
  });

  it("asks before Delete group, and then the members lose the colour", async () => {
    mount();
    openFromLabel();
    fireEvent.click(within(win()).getByTestId("group-delete"));
    const confirm = screen.getByTestId("group-delete-confirm");
    expect(within(confirm).getByText("Delete Login flow?")).toBeTruthy();
    expect(confirm.textContent).toContain("Its 3 components lose this colour. The linked text becomes plain words. The components stay.");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("group-delete-confirm")).toBeNull();
    fireEvent.click(within(win()).getByTestId("group-delete"));
    act(() => void fireEvent.click(within(screen.getByTestId("group-delete-confirm")).getByRole("button", { name: "Delete" })));
    expect(notice()).toContain("Deleted Login flow");
    await waitFor(() => expect(document.querySelectorAll('[data-group-label="Login flow"]')).toHaveLength(0));
    // The linked text became plain words.
    expect(document.querySelector('[data-ref="group:rg-0b1c2d3e-0000-4000-8000-0000000000c1"]')).toBeNull();
  });

  it("removes and finds linked text for a saved group", () => {
    mount();
    openFromLabel();
    fireEvent.click(within(within(win()).getByTestId("group-linked")).getByRole("button", { name: "Remove" }));
    expect(notice()).toContain("Removed the link");
  });
});
