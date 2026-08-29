// Tier 3 — legacy bounty creation is retired (NS-P54).
//
// TWO CLAIMS, pulling in opposite directions, which is why they are asserted in
// one file: nothing may CREATE a `content_items` bounty any more, and a bounty
// draft already in progress must still be FINISHABLE. A freeze that took the
// second with it would pass a spec that only checked the first, and the person
// it stranded would have no way to tell anyone — their draft would simply stop
// opening.
//
// WHY A COMPONENT SPEC AND NOT A BROWSER ONE. Both halves need a signed-in
// creator, and the browser has none: the Playwright config declares a `setup`
// project with no `.setup.ts` behind it, so there is no storage state for a
// signed-in run. An anonymous browser spec would meet ProtectedRoute's login
// redirect on /bounty/new and prove nothing about the write. The browser half
// that CAN be proven signed-out — the route renders, the notice names the
// replacement — is e2e/tier3/legacy-bounty-create-retired.spec.ts.
//
// THESE TESTS ARE PART OF THE ROLLBACK. They assert the frozen behaviour
// directly rather than reading the flag and asserting conditionally, because a
// test that agrees with whatever the flag says proves nothing. Flipping
// LEGACY_BOUNTY_CREATE_ENABLED back to true is expected to revert the frozen
// blocks with it; docs/retired-surfaces.md lists that as a rollback step.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: "creator-1" },
  profile: { id: "creator-1", username: "creator", display_name: "Creator" },
  isLoggedIn: true,
  loading: false,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

/**
 * One spy over every write. `inserts` records `[table, payload]` for each
 * `.insert()` that is reached, so "nothing was created" is asserted against
 * what the client was actually asked to do rather than against a rendered
 * absence.
 */
const db = vi.hoisted(() => ({ inserts: [] as Array<[string, unknown]> }));

vi.mock("@/integrations/supabase/client", () => {
  const chainFor = (table: string) => {
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown) =>
              resolve({ data: [], error: null });
          }
          if (prop === "insert") {
            return (payload: unknown) => {
              db.inserts.push([table, payload]);
              return chain;
            };
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => Promise.resolve({ data: { id: "new-row" }, error: null });
          }
          return () => chain;
        },
      }
    );
    return chain;
  };
  return { supabase: { from: (table: string) => chainFor(table) } };
});

// The tool picker reads its own table and is not what is under test here.
vi.mock("@/components/WorksWithPicker", () => ({
  WorksWithPicker: () => <div data-testid="works-with" />,
}));

// Upload.tsx is the shared editor and the heaviest page in the application. It
// is NOT touched by NS-P54 and is stubbed so that "the draft still opens the
// editor" is a claim about the route, not a re-test of the editor.
vi.mock("@/pages/Upload", () => ({
  default: ({ mode }: { mode?: string }) => (
    <div data-testid="shared-editor">{mode}</div>
  ),
}));
vi.mock("./Upload", () => ({
  default: ({ mode }: { mode?: string }) => (
    <div data-testid="shared-editor">{mode}</div>
  ),
}));

import BountyUpload from "@/pages/BountyUpload";
import BountyUploadShell from "@/pages/BountyUploadShell";
import { LegacyUploadRoute } from "@/components/upload/LegacyUploadNotice";
import { UploadPickerProvider, useUploadPicker } from "@/contexts/UploadPickerContext";
import {
  BOUNTY_RETIRED_MESSAGE,
  LegacyBountyValidationError,
  assertLegacyBountyCreateEnabled,
} from "./flags";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

beforeEach(() => {
  db.inserts.length = 0;
});

describe("frozen — the gate itself", () => {
  it("throws BOUNTY_RETIRED, naming where bounties live now", () => {
    let thrown: unknown;
    try {
      assertLegacyBountyCreateEnabled();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(LegacyBountyValidationError);
    expect((thrown as LegacyBountyValidationError).code).toBe("BOUNTY_RETIRED");
    expect((thrown as LegacyBountyValidationError).message).toBe(BOUNTY_RETIRED_MESSAGE);
    expect(BOUNTY_RETIRED_MESSAGE).toMatch(/mark a part unsolved in the composer/);
  });
});

describe("frozen — /bounty/new", () => {
  function renderRoute() {
    return render(
      <MemoryRouter initialEntries={["/bounty/new"]}>
        <Routes>
          <Route
            path="/bounty/new"
            element={
              <LegacyUploadRoute bounty>
                <BountyUpload />
              </LegacyUploadRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it("carries the notice, the bounty line and a way into the composer", () => {
    renderRoute();
    expect(screen.getByText("Previous publishing tool")).toBeTruthy();
    expect(
      screen.getByText(/Bounties are now part of publishing a build/)
    ).toBeTruthy();
    const cta = screen.getByRole("link", { name: "Open the build workspace" });
    expect(cta.getAttribute("href")).toBe("/compose/new");
  });

  // THE ACCEPTANCE CRITERION. The form is walked end to end by a signed-in
  // creator with every field the submit button waits for, and the submit writes
  // nothing.
  it("walks the whole form and still creates no content_items row", async () => {
    renderRoute();

    fireEvent.change(
      screen.getByPlaceholderText(/I need a prompt that rewrites my emails/),
      { target: { value: "A prompt that summarises release notes" } }
    );
    fireEvent.click(screen.getByText("A Prompt"));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    fireEvent.change(screen.getByPlaceholderText(/Give context/), {
      target: { value: "Shipping weekly and writing the notes by hand." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    fireEvent.change(screen.getByPlaceholderText("50"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /Post Bounty/ }));

    await waitFor(() =>
      expect(screen.getByTestId("legacy-bounty-retired")).toBeTruthy()
    );
    expect(
      screen.getByTestId("legacy-bounty-retired").textContent
    ).toContain("This form no longer posts bounties.");
    // Not "the insert failed" — the insert was never attempted.
    expect(db.inserts).toEqual([]);
  });
});

describe("frozen — /upload/bounty with no draft", () => {
  it("mints no draft row and points at the composer instead", async () => {
    render(
      <MemoryRouter initialEntries={["/upload/bounty"]}>
        <Routes>
          <Route
            path="/upload/bounty"
            element={
              <LegacyUploadRoute bounty>
                <BountyUploadShell />
              </LegacyUploadRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId("legacy-bounty-retired")).toBeTruthy()
    );
    expect(db.inserts).toEqual([]);
    expect(screen.queryByTestId("shared-editor")).toBeNull();
    const cta = screen.getAllByRole("link", { name: "Open the build workspace" });
    expect(cta.some((a) => a.getAttribute("href") === "/compose/new")).toBe(true);
  });
});

// The other half of the freeze, and the one that would be silently lost.
describe("live — a bounty draft already in progress still opens its editor", () => {
  it("mounts the shared editor in bounty mode for /upload/bounty?id=", async () => {
    render(
      <MemoryRouter initialEntries={["/upload/bounty?id=draft-9"]}>
        <Routes>
          <Route
            path="/upload/bounty"
            element={
              <LegacyUploadRoute bounty>
                <BountyUploadShell />
              </LegacyUploadRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("shared-editor")).toBeTruthy());
    expect(screen.getByTestId("shared-editor").textContent).toBe("bounty");
    expect(screen.queryByTestId("legacy-bounty-retired")).toBeNull();
  });
});

// NS-P54 commit 2. Both helpers wrote an APPROVED content_items row —
// createMetaBounty a meta-bounty, promoteBountyToBlueprint a clone of a solved
// one — and both are frozen at their first statement. The claim is that they
// REFUSE rather than fail: no query of any kind is built, so there is no
// half-written row and no orphaned header behind the error.
describe("frozen — the superseded bounty-competition helpers", () => {
  it("createMetaBounty throws BOUNTY_RETIRED and writes nothing", async () => {
    const { createMetaBounty } = await import(
      "@/lib/bounty-competition/createMetaBounty"
    );

    await expect(
      createMetaBounty({
        authorId: "creator-1",
        title: "One umbrella, four holes",
        subBountyDefinitions: [{ title: "Citation checker", targetAmount: 120 }],
      })
    ).rejects.toMatchObject({
      name: "LegacyBountyValidationError",
      code: "BOUNTY_RETIRED",
      message: BOUNTY_RETIRED_MESSAGE,
    });

    expect(db.inserts).toEqual([]);
  });

  it("promoteBountyToBlueprint throws BOUNTY_RETIRED and writes nothing", async () => {
    const { promoteBountyToBlueprint } = await import(
      "@/lib/bounty-competition/promoteBountyToBlueprint"
    );

    await expect(promoteBountyToBlueprint("bounty-1")).rejects.toMatchObject({
      name: "LegacyBountyValidationError",
      code: "BOUNTY_RETIRED",
      message: BOUNTY_RETIRED_MESSAGE,
    });

    expect(db.inserts).toEqual([]);
  });
});

describe("retired affordance — the upload picker's Bounty card", () => {
  it("lands on /compose/new rather than the legacy bounty editor", async () => {
    function Opener() {
      const { openUploadTypePicker } = useUploadPicker();
      return (
        <button type="button" onClick={() => openUploadTypePicker()}>
          open picker
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <UploadPickerProvider>
          <LocationProbe />
          <Opener />
        </UploadPickerProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "open picker" }));
    // The card keeps its label and its promise; only the destination moved.
    fireEvent.click(
      await screen.findByRole("button", { name: /^Create Bounty:/ })
    );

    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe("/compose/new")
    );
    expect(db.inserts).toEqual([]);
  });
});
