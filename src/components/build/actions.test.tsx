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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/** The reader looking at the page. Reassigned per test, like the sibling spec. */
const auth = { user: { id: "reader-2" } as { id: string } | null, isLoggedIn: true };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { ForkControl, type ForkState } from "./ForkControl";
import { PortableExport } from "./PortableExport";
import { ReproductionAction } from "./ReproductionAction";
import type { Build, BuildRecord, BuildReproduction } from "@/lib/build";
import { staticDoc, styleOf, styledWith } from "@/test/tokenStyle";

const forkState: ForkState = {
  fork: () => {},
  pending: false,
  error: null,
  signedIn: true,
};

const record = {
  build: { id: "b1", slug: "inbox-triage", title: "Inbox triage agent" },
  tree: [],
  tray: [],
  events: [],
  nodeTypes: [],
} as unknown as BuildRecord;

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

describe("the export pair is secondary, and confirmation is a state of it", () => {
  it("rests on the secondary treatment, not on a second fill", () => {
    const doc = staticDoc(<PortableExport record={record} />);
    const buttons = Array.from(doc.querySelectorAll("button"));

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(styleOf(button)).toContain("background:var(--glass)");
      expect(styleOf(button)).toContain("border-color:var(--line)");
      expect(styleOf(button)).not.toContain("background:var(--action)");
    }
  });

  it("spends no primary slot on getting a build out", () => {
    const doc = staticDoc(<PortableExport record={record} />);
    expect(doc.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });
});

describe("across the header's action row", () => {
  it("counts exactly one filled --action surface", () => {
    const doc = staticDoc(
      <>
        <PortableExport record={record} />
        <ForkControl state={forkState} />
      </>,
    );
    expect(styledWith(doc, "background:var(--action)")).toHaveLength(1);
  });
});

/* ── The reproduction control's two states ────────────────────────────────────

   Both are rendered through a PRIMED query cache rather than by waiting on a
   fetch: `renderToStaticMarkup` has one pass and resolves nothing, so a cache
   seeded with the rows the component would have fetched is the only way to put
   it into its second state and still read a `var()` back off the markup.
   ─────────────────────────────────────────────────────────────────────────── */

const build = {
  id: "b1",
  slug: "inbox-triage",
  title: "Inbox triage agent",
  creator_id: "creator-1",
  reproduction_count: 3,
  last_confirmed_at: null,
  last_confirmed_model: null,
} as unknown as Build;

function reproductionDoc(rows: BuildReproduction[] | undefined): Document {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  if (rows) client.setQueryData(["build-reproductions", build.id], rows);

  return staticDoc(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReproductionAction build={build} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mine: BuildReproduction = {
  id: "r1",
  build_id: "b1",
  user_id: "reader-2",
  worked: true,
  model_used: "Sonnet 4.5",
  note: null,
  confirmed_at: "2026-08-20T09:00:00Z",
} as BuildReproduction;

describe("the reproduction control, invitation and confirmation", () => {
  it("offers the invitation as a secondary, not as the page's second primary", () => {
    const doc = reproductionDoc([]);
    const invite = Array.from(doc.querySelectorAll("button")).find(
      (button) => button.textContent === "I ran this and it worked",
    );

    expect(invite).toBeTruthy();
    expect(styleOf(invite)).toContain("background:var(--glass)");
    expect(styleOf(invite)).toContain("border-color:var(--line)");
    expect(styleOf(invite)).not.toContain("background:var(--action)");
    // The slot went with the fill: nothing here asks for a primary surface.
    expect(doc.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });

  it("goes quiet once the reader has recorded one", () => {
    const doc = reproductionDoc([mine]);

    const confirmation = Array.from(doc.querySelectorAll("span")).find((span) =>
      span.textContent?.startsWith("You confirmed this"),
    );
    expect(confirmation?.textContent).toBe("You confirmed this, on Sonnet 4.5");
    expect(styleOf(confirmation)).toContain("color:var(--evidence)");

    // The lamp beside it, and nothing filled anywhere in the block.
    const lamp = confirmation?.querySelector("span");
    expect(styleOf(lamp)).toContain("background:var(--evidence)");
    expect(styleOf(lamp)).toContain("border-radius:var(--r-full)");

    // The invitation is gone; the correction is a ghost beside the record.
    const buttons = Array.from(doc.querySelectorAll("button")).map((b) => b.textContent);
    expect(buttons).not.toContain("I ran this and it worked");
    expect(buttons).toContain("update the model");

    const update = Array.from(doc.querySelectorAll("button")).find(
      (button) => button.textContent === "update the model",
    );
    expect(styleOf(update)).toContain("background:transparent");
  });

  it("names the other answer in the one hue this system spends on it", () => {
    const doc = reproductionDoc([{ ...mine, worked: false } as BuildReproduction]);
    const said = Array.from(doc.querySelectorAll("span")).find(
      (span) => span.textContent === "You said it did not work",
    );
    expect(styleOf(said)).toContain("color:var(--cat-breakage)");
  });
});
