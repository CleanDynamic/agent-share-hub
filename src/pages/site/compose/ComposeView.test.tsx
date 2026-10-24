import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { composeViewProps } from "@/dev/fixtures/compose";

import { ComposeView, type ComposeSession, type ComposeViewProps } from "./ComposeView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

const props = (over: Partial<ComposeViewProps> = {}): ComposeViewProps => ({ ...composeViewProps(), ...over });

function view(over: Partial<ComposeViewProps> = {}) {
  const base = props({
    onPublish: vi.fn(),
    onFiles: vi.fn(),
    onRetrySave: vi.fn(),
    onPromptText: vi.fn(),
    onMovePrompt: vi.fn(),
    onRemovePrompt: vi.fn(),
    onWritePrompt: vi.fn(),
    onAddSessionPrompt: vi.fn(),
    onSessionsOpen: vi.fn(),
    onToggleMadeWith: vi.fn(),
    onDetail: vi.fn(),
    onGapSwitch: vi.fn(),
    ...over,
  });
  render(
    <MemoryRouter>
      <ComposeView {...base} />
    </MemoryRouter>,
  );
  return base;
}

describe("ComposeView", () => {
  it("shows the untitled heading and what is still needed", () => {
    view({ title: "", slug: null, missing: ["a cover picture or video", "a prompt"] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Untitled build");
    expect(screen.getByTestId("compose-status").textContent).toContain("still needs a cover picture or video, a prompt");
  });

  it("keeps Publish clickable while something is missing", () => {
    const base = view();
    const button = screen.getByRole("button", { name: "Publish" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(base.onPublish).toHaveBeenCalledTimes(1);
  });

  it("reads each save state, with a retry on a failure", () => {
    view({ save: "error" });
    expect(screen.getByTestId("compose-status").textContent).toContain("not saved");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  });

  it("draws the published banner and disables Publish", () => {
    view({ missing: [], published: { slug: "x", inGallery: true, shortfall: "" } });
    expect(screen.getByTestId("compose-published").textContent).toContain("Published. It is in the Gallery now.");
    expect(screen.getByRole("link", { name: "See it" }).getAttribute("href")).toBe("/b2/x");
    const done = screen.getByRole("button", { name: "Published" }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
  });

  it("numbers the prompts, names each field and its controls, and says where each came from", () => {
    const base = view();
    const prompts = screen.getByRole("heading", { level: 2, name: /^Prompts/ });
    expect(prompts.textContent).toBe("Prompts3");
    expect(screen.getByRole("textbox", { name: "Prompt 1" })).toHaveProperty("value", composeViewProps().prompts[0].text);
    expect(screen.getAllByTestId("compose-prompt")[2].textContent).toContain("Session 2 · Opus 5.5");

    // The first cannot go up and the last cannot go down.
    expect((screen.getByRole("button", { name: "Move prompt 1 up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move prompt 3 down" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move prompt 1 down" }));
    expect(base.onMovePrompt).toHaveBeenCalledWith("prompt-1", 1);
    fireEvent.click(screen.getByRole("button", { name: "Remove prompt 2" }));
    expect(base.onRemovePrompt).toHaveBeenCalledWith("prompt-2");
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt 3" }), { target: { value: "HEIC too, please." } });
    expect(base.onPromptText).toHaveBeenCalledWith("prompt-3", "HEIC too, please.");
    fireEvent.click(screen.getByRole("button", { name: "write one" }));
    expect(base.onWritePrompt).toHaveBeenCalledTimes(1);
  });

  it("keeps a prompt that is not saved yet where it is", () => {
    view({ prompts: [{ key: "local-1", text: "", source: "Written by you", saved: false }] });
    expect((screen.getByRole("button", { name: "Move prompt 1 up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move prompt 1 down" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("compose-prompt").textContent).toContain("Written by you");
  });

  it("lists each session's prompts newest first, marks the added ones, and opens the first two", () => {
    const base = view();
    expect(base.onSessionsOpen).toHaveBeenLastCalledWith(["session-2", "session-1"]);
    const heads = screen.getAllByRole("button", { name: /^Session \d/ });
    expect(heads.map((head) => head.getAttribute("aria-expanded"))).toEqual(["true", "true"]);
    expect(heads.map((head) => head.textContent)).toEqual(["Session 2: Opus 5.5, Today", "Session 1: Sonnet 5.5, Yesterday"]);

    const rows = screen.getAllByTestId("session-prompt");
    expect(rows.map((row) => row.getAttribute("data-added") === "true")).toEqual([true, false, true, false, true, false]);
    expect(rows[0].textContent).toContain("added");
    fireEvent.click(screen.getByRole("button", { name: "Add to prompts: It says exiftool: command not found. What do I install?" }));
    expect(base.onAddSessionPrompt).toHaveBeenCalledWith("session-1", 2);

    fireEvent.click(heads[1]);
    expect(base.onSessionsOpen).toHaveBeenLastCalledWith(["session-2"]);
  });

  it("offers Add model when a session's model is not known", () => {
    const [first, second] = composeViewProps().sessions;
    view({ sessions: [first, { ...second, label: "Claude", modelKnown: false }] });
    expect(screen.getAllByRole("button", { name: /^Add model to session/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Add model to session 1",
    ]);
  });

  describe("the account's library", () => {
    /** n sessions, newest first, numbered oldest first, as the page hands them over. */
    const library = (n: number): ComposeSession[] =>
      Array.from({ length: n }, (_, at) => ({
        id: `library-${n - at}`,
        number: n - at,
        label: "Claude",
        modelKnown: true,
        date: "3 Oct",
        prompts: [],
        promptsError: false,
      }));

    it("counts every session in the header, with nothing else listed beside them", () => {
      view({ sessions: library(4) });
      const panel = screen.getByTestId("compose-sessions");
      expect(within(panel).getByRole("heading", { level: 2 }).textContent).toBe("Your sessions4");
      expect(within(panel).getAllByTestId("compose-session")).toHaveLength(4);
      expect(screen.queryByText("Not in a build yet")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Add to this build/ })).toBeNull();
    });

    it("says there are none yet when the account has no sessions", () => {
      view({ sessions: [] });
      const panel = screen.getByTestId("compose-sessions");
      expect(panel.textContent).toContain("No sessions yet.");
      expect(panel.textContent).not.toContain("in this build");
      expect(within(panel).getByRole("heading", { level: 2 }).textContent).toBe("Your sessions0");
    });

    it("shows six, then the rest in place", () => {
      view({ sessions: library(9) });
      expect(screen.getAllByTestId("compose-session")).toHaveLength(6);
      const more = screen.getByRole("button", { name: "Show 3 more" });
      expect(more.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(more);
      expect(screen.getAllByRole("button", { name: /^Session \d/ }).map((head) => head.textContent)).toEqual(
        Array.from({ length: 9 }, (_, at) => `Session ${9 - at}: Claude, 3 Oct`),
      );
      fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
      expect(screen.getAllByTestId("compose-session")).toHaveLength(6);
    });

    it("says when they did not load and offers a retry", () => {
      const base = view({ sessionsStatus: "error", onRetrySessions: vi.fn() });
      expect(screen.getByTestId("compose-sessions").textContent).toContain("Your sessions didn't load.");
      fireEvent.click(within(screen.getByTestId("compose-sessions")).getByRole("button", { name: /Try again/ }));
      expect(base.onRetrySessions).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull();
    });
  });

  it("changes Made with with toggles that say whether they are on", () => {
    const base = view();
    expect(screen.getByTestId("compose-made-with").textContent).toContain("Made withClaude Code · Sonnet 5.5Claude · Opus 5.5from your sessions.");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const toggle = screen.getByRole("button", { name: "Claude · Opus 5.5", pressed: true });
    fireEvent.click(toggle);
    expect(base.onToggleMadeWith).toHaveBeenCalledWith(expect.objectContaining({ model: "Opus 5.5" }), false);
    expect(screen.getByRole("button", { name: "Done" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("strikes out a model left out, and offers a free entry when there are no sessions", () => {
    const chips = composeViewProps().madeWith.map((chip) => (chip.model === "Opus 5.5" ? { ...chip, on: false } : chip));
    view({ madeWith: chips });
    expect(screen.getByTestId("compose-made-with").querySelector("s")?.textContent).toBe("Opus 5.5");
    cleanup();
    view({ sessions: [], madeWith: [] });
    expect(screen.getByRole("button", { name: "+ Add a tool or model" })).toBeTruthy();
    expect(screen.getByTestId("compose-made-with").textContent).not.toContain("from your sessions.");
  });

  it("keeps More details closed until asked, then shows the switch and the gap's input", () => {
    const base = view();
    const toggle = screen.getByRole("button", { name: /More details/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("What broke")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("What broke"), { target: { value: "exiftool: command not found" } });
    expect(base.onDetail).toHaveBeenCalledWith("symptom", "exiftool: command not found");
    fireEvent.change(screen.getByLabelText("First result in (minutes)"), { target: { value: "25" } });
    expect(base.onDetail).toHaveBeenCalledWith("firstResult", "25");
    const sw = screen.getByRole("switch", { name: "Leave one part open for someone else to solve" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(base.onGapSwitch).toHaveBeenCalledWith(true);
    expect(screen.queryByLabelText("What's left open?")).toBeNull();
  });

  it("asks what is left open once the switch is on", () => {
    view({ details: { ...composeViewProps().details, gapOn: true } });
    fireEvent.click(screen.getByRole("button", { name: /More details/ }));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("What's left open?")).toBeTruthy();
    expect(screen.getByText("Readers will see it as one part left open. You can add a reward on Bounties after publishing.")).toBeTruthy();
  });

  it("offers images and video only, and no glass", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ComposeView {...props()} />
      </MemoryRouter>,
    );
    expect(markup).toContain('accept="image/png,image/jpeg,video/mp4"');
    expect(markup).not.toContain("bg-glass");
    expect(markup).not.toContain("backdrop-filter");
  });
});
