// BG-P21 — the build page's actions.
//
// The claim the whole file exists for: ONE PRIMARY. "Rebuild this" is the act
// this record exists to invite and it is the only filled `--action` surface on
// the page; every other control — copy, download, record a reproduction, load
// the embed — is secondary or ghost. Two filled buttons in one view ask the
// reader twice which thing matters most, and the theme names that as a rule.
//
// Colour is read off static markup: every value is a `var(--token)` and jsdom's
// CSS parser drops those on assignment. See src/test/tokenStyle.tsx.

import { describe, expect, it, vi } from "vitest";

/** The reader looking at the page. Reassigned per test, like the sibling spec. */
const auth = { user: { id: "reader-2" } as { id: string } | null, isLoggedIn: true };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { ForkControl, type ForkState } from "./ForkControl";

import { staticDoc, styleOf } from "@/test/tokenStyle";

const forkState: ForkState = {
  fork: () => {},
  pending: false,
  error: null,
  signedIn: true,
};

describe("Rebuild this is the page's one primary", () => {
  it("fills --action and puts --on-action on it", () => {
    const doc = staticDoc(<ForkControl state={forkState} />);
    const button = doc.querySelector("button");

    expect(button?.textContent).toBe("Rebuild this");
    expect(styleOf(button)).toContain("background:var(--action)");
    expect(styleOf(button)).toContain("color:var(--on-action)");
    // A control at --r-control. Nothing in this system is a pill.
    expect(styleOf(button)).toContain("border-radius:var(--r-control)");
  });

  it("carries the primary slot, so a supplied surface can replace it", () => {
    const doc = staticDoc(<ForkControl state={forkState} />);
    expect(doc.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(1);
  });

  it("says what it is doing while it runs, and shows a progress cursor", () => {
    const doc = staticDoc(<ForkControl state={{ ...forkState, pending: true }} />);
    const button = doc.querySelector("button");

    expect(button?.textContent).toBe("Rebuilding…");
    expect(button?.hasAttribute("disabled")).toBe(true);
    // Accepted and running, which is not the same as refused.
    expect(styleOf(button)).toContain("cursor:progress");
  });

  it("sends a signed-out reader to sign in rather than offering a button that fails", () => {
    const doc = staticDoc(<ForkControl state={{ ...forkState, signedIn: false }} />);
    expect(doc.querySelector("button")?.textContent).toBe("Sign in to rebuild");
  });

  it("reports a failure in the breakage hue", () => {
    const doc = staticDoc(<ForkControl state={{ ...forkState, error: "No." }} />);
    const alert = doc.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("No.");
    expect(styleOf(alert)).toContain("color:var(--cat-breakage)");
  });
});
