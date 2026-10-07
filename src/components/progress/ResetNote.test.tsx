// RC-P25 — the one-time reset note.
//
// Three promises: it is shown until it is read and then never again, a browser
// that refuses storage does not break the page the note sits on, and it says
// the sentence XP-DESIGN.md gives, dressed the way STATES.md dresses a notice.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESET_NOTE_KEY, RESET_NOTE_TEXT, ResetNote } from "./ResetNote";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the reset note is shown once", () => {
  it("shows the sentence to a reader who has not read it", () => {
    render(<ResetNote />);

    expect(screen.getByTestId("xp-reset-note")).toHaveTextContent(RESET_NOTE_TEXT);
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
  });

  it("is gone after Got it, and stays gone on the next visit", () => {
    const first = render(<ResetNote />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(screen.queryByTestId("xp-reset-note")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(RESET_NOTE_KEY)).not.toBeNull();

    // A new visit is a new mount.
    first.unmount();
    const second = render(<ResetNote />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it("shows nothing to a reader who said Got it in an earlier visit", () => {
    window.localStorage.setItem(RESET_NOTE_KEY, "1");

    const { container } = render(<ResetNote />);

    expect(container).toBeEmptyDOMElement();
  });

  it("remembers under the key the series named", () => {
    expect(RESET_NOTE_KEY).toBe("bg-xp-reset-note-seen");
  });
});

describe("the reset note survives a browser that refuses storage", () => {
  it("shows, and closes, when reading and writing storage both throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    render(<ResetNote />);
    expect(screen.getByTestId("xp-reset-note")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("xp-reset-note")).not.toBeInTheDocument();
  });

  it("shows, and closes, when window.localStorage cannot even be reached", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    render(<ResetNote />);
    expect(screen.getByTestId("xp-reset-note")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(screen.queryByTestId("xp-reset-note")).not.toBeInTheDocument();
  });
});

describe("the reset note says and looks as it was specified", () => {
  it("carries the sentence in XP-DESIGN.md, word for word", () => {
    const design = readFileSync(join("docs", "reconciliation", "XP-DESIGN.md"), "utf8");

    expect(design).toContain(`"${RESET_NOTE_TEXT}"`);
  });

  it("is a recess panel at the panel radius with one tertiary action and no amber", () => {
    // Static markup, because jsdom drops var() values from a style object.
    const html = renderToStaticMarkup(<ResetNote />);

    expect(html).toContain("background-color:var(--recess)");
    expect(html).toContain("border-radius:var(--r-panel)");
    expect(html).toContain("color:var(--text)");

    // One button, and the ghost one: primary and secondary buttons carry a visual slot, tertiary does not.
    expect(html.match(/<button\b/g) ?? []).toHaveLength(1);
    expect(html).not.toContain("data-visual-slot");

    // Amber is light, never type; raw colours are never spent in a component.
    expect(html).not.toContain("--lit");
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|oklch\(/i);
  });

  it("keeps its action a 44px touch target", () => {
    render(<ResetNote />);

    // UI-P52 density pass: the control kit's lg size is CONTROL_CLASS.button.lg —
    // 36px at desktop (it was h-11, 44px) and still 44px below 768px, the touch
    // target this asserts. The size is not set anywhere else.
    const className = screen.getByRole("button", { name: "Got it" }).className;
    expect(className).toContain("h-[36px]");
    expect(className).toContain("max-md:min-h-[44px]");
  });

  it("uses no word the vocabulary forbids", () => {
    const forbidden = /\b(blueprint|blog|post|reblog|remix|stage|block|rating|verification|neoscale|upload)\b/i;

    expect(RESET_NOTE_TEXT).not.toMatch(forbidden);
    expect("Got it").not.toMatch(forbidden);
  });
});
