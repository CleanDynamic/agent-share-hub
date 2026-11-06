// UX-10 P8: Customise profile: each group's limits, one write on Save, Reset, Cancel's question, and the pins' order.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { draftProblem, saveProfile, savePayload, type ProfileDraft } from "@/lib/profile/customise";
import { DEFAULT_SETTINGS } from "@/lib/profile/settings";

import { CustomiseProfile } from "./CustomiseProfile";

afterEach(cleanup);
beforeEach(() => rpc.mockClear());

const draft = (over: Partial<ProfileDraft> = {}): ProfileDraft => ({
  displayName: "Maya Kent",
  oneLine: "Builds finance agents",
  location: "Leeds",
  links: ["https://maya.dev"],
  about: "",
  settings: { ...DEFAULT_SETTINGS, sideSections: DEFAULT_SETTINGS.sideSections.map((one) => ({ ...one })) },
  pins: [
    { kind: "topic", id: "t1" },
    { kind: "build", id: "b1" },
  ],
  ...over,
});

function mount(initial: ProfileDraft = draft()) {
  const onSave = vi.fn(async (_next: ProfileDraft) => undefined);
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <CustomiseProfile
        open
        onClose={onClose}
        initial={initial}
        pinLabels={new Map([["topic:t1", "How do you score a call summary?"], ["build:b1", "Call notes"]])}
        pictures={{ avatar: { url: null }, header: { url: null } }}
        onPicture={vi.fn()}
        onSave={onSave}
      />
    </MemoryRouter>,
  );
  return { onSave, onClose, window: screen.getByTestId("customise-profile") };
}

describe("the window", () => {
  it("has six groups, in order, each with its head", () => {
    const { window } = mount();
    expect(within(window).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["About you", "Pictures", "Pinned", "Feed", "Side sections", "Who sees"]);
    expect(within(window).getByText("Your saves are always private.")).toBeInTheDocument();
    expect(within(window).getByText("You can change one build from its ··· menu.")).toBeInTheDocument();
  });

  it("every control has an accessible name", () => {
    const { window } = mount();
    for (const control of [...within(window).queryAllByRole("button"), ...within(window).queryAllByRole("textbox"), ...within(window).queryAllByRole("radio"), ...within(window).queryAllByRole("switch")]) {
      expect(control.getAttribute("aria-label") || control.textContent?.trim() || (control as HTMLInputElement).labels?.[0]?.textContent, control.outerHTML.slice(0, 80)).toBeTruthy();
    }
  });
});

describe("About you's limits", () => {
  it("holds one line to 160 and the about to 600, with the count only in the last 60", () => {
    const { window } = mount();
    expect((within(window).getByLabelText("One line") as HTMLInputElement).maxLength).toBe(160);
    const about = within(window).getByLabelText("About", { selector: "textarea" }) as HTMLTextAreaElement;
    expect(about.maxLength).toBe(600);
    fireEvent.change(about, { target: { value: "a".repeat(540) } });
    expect(screen.queryByTestId("customise-about-count")).toBeNull();
    fireEvent.change(about, { target: { value: "a".repeat(541) } });
    expect(screen.getByTestId("customise-about-count").textContent).toBe("541 / 600");
  });

  it("takes up to three links, with Add link and Remove", () => {
    const { window } = mount();
    fireEvent.click(within(window).getByRole("button", { name: "Add link" }));
    fireEvent.click(within(window).getByRole("button", { name: "Add link" }));
    expect(within(window).getAllByRole("textbox", { name: /^Link / })).toHaveLength(3);
    expect(within(window).queryByRole("button", { name: "Add link" })).toBeNull();
    fireEvent.click(within(window).getByRole("button", { name: "Remove link 2" }));
    expect(within(window).getAllByRole("textbox", { name: /^Link / })).toHaveLength(2);
  });

  it("refuses a fourth link and a link that is not https before any request", async () => {
    expect(draftProblem(draft({ links: ["https://a.dev", "https://b.dev", "https://c.dev", "https://d.dev"] }))).toBe("A profile holds 3 links.");
    await expect(saveProfile(draft({ links: ["http://a.dev"] }))).rejects.toThrow("A link starts with https://.");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Save", () => {
  it("writes everything in one request", async () => {
    await saveProfile(draft({ links: ["https://maya.dev", " "] }));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_profile", { p: savePayload(draft({ links: ["https://maya.dev"] })) });
    expect(savePayload(draft()).pins).toEqual([{ kind: "topic", id: "t1" }, { kind: "build", id: "b1" }]);
  });

  it("hands the window's draft over once, and closes", async () => {
    const { window, onSave, onClose } = mount();
    fireEvent.change(within(window).getByLabelText("Location"), { target: { value: "York" } });
    fireEvent.click(within(window).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ location: "York" });
  });
});

describe("Cancel and Reset", () => {
  it("Cancel with nothing changed closes; with changes it asks once: Leave without saving?", () => {
    const first = mount();
    fireEvent.click(within(first.window).getByRole("button", { name: "Cancel" }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    cleanup();
    const second = mount();
    fireEvent.change(within(second.window).getByLabelText("Location"), { target: { value: "York" } });
    fireEvent.click(within(second.window).getByRole("button", { name: "Cancel" }));
    expect(second.onClose).not.toHaveBeenCalled();
    expect(within(second.window).getByText("Leave without saving?")).toBeInTheDocument();
    fireEvent.click(within(second.window).getByRole("button", { name: "Leave" }));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it("Reset to default puts the feed, side and who-sees settings back", async () => {
    const { window, onSave } = mount(draft({ settings: { ...DEFAULT_SETTINGS, feedFilter: "notes", notesVisible: "only_me", sideSections: [...DEFAULT_SETTINGS.sideSections].reverse() } }));
    fireEvent.click(within(window).getByRole("button", { name: "Reset to default" }));
    fireEvent.click(within(window).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("Pinned and Side sections", () => {
  it("orders pins with Move up and Move down, and removes one; Save keeps the order", async () => {
    const { window, onSave } = mount();
    fireEvent.click(within(window).getByRole("button", { name: "Move Call notes up" }));
    expect(within(window).getAllByTestId("customise-pin").map((row) => row.textContent?.split("Move")[0])).toEqual(["Call notes", "How do you score a call summary?"]);
    fireEvent.click(within(window).getByRole("button", { name: "Remove How do you score a call summary?" }));
    fireEvent.click(within(window).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].pins).toEqual([{ kind: "build", id: "b1" }]);
  });

  it("says how to pin when nothing is pinned", () => {
    const { window } = mount(draft({ pins: [] }));
    expect(within(window).getByText("Pin up to 3 things from your feed with ··· > Pin to profile.")).toBeInTheDocument();
  });

  it("hides a side section with its switch and moves another", async () => {
    const { window, onSave } = mount();
    fireEvent.click(within(window).getByLabelText("Show Marks"));
    fireEvent.click(within(window).getByRole("button", { name: "Move Marks up" }));
    fireEvent.click(within(window).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const sections = onSave.mock.calls[0][0].settings.sideSections;
    expect(sections.map((one: { key: string }) => one.key)).toEqual(["about", "spaces", "others", "marks", "collections"]);
    expect(sections.find((one: { key: string }) => one.key === "marks").hidden).toBe(true);
  });

  it("sets the feed's filter and who sees notes", async () => {
    const { window, onSave } = mount();
    fireEvent.click(within(within(window).getByRole("radiogroup", { name: "Open on" })).getByRole("radio", { name: "Topics" }));
    fireEvent.click(within(within(window).getByRole("radiogroup", { name: "Notes in your feed" })).getByRole("radio", { name: "Followers" }));
    fireEvent.click(within(window).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].settings).toMatchObject({ feedFilter: "topics", notesVisible: "followers" });
  });
});
