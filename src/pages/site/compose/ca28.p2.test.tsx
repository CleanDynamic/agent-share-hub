// CA-28 P2: "Classification Card" is "Classification" on screen: the title row button and its aria-label, the window's title,
// the Clear the build body and the undo step. Code names (SandboxCard, useClassificationCard) are untouched.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

// The columns are not in the fake database, so the Classification would never write; here they are live.
vi.mock("@/lib/classify/storage", async (original) => ({
  ...(await original<typeof import("@/lib/classify/storage")>()),
  getClassification: async () => ({ live: true, classification: (await original<typeof import("@/lib/classify/storage")>()).NOT_LIVE.classification, facets: [] }),
  writeClassification: async () => ({ written: true, missing: false }),
}));

import { CLEAR_COPY } from "@/lib/build/componentMenus";
import { pendingWrites } from "@/lib/build/pendingWrites";

vi.setConfig({ testTimeout: 40_000 });

import { mountComposer, stubWidth } from "./ca23.harness";
import { CLASSIFICATION_CARD } from "./SandboxCard";

beforeEach(() => {
  stubWidth(1280);
  localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  pendingWrites.reset();
  vi.restoreAllMocks();
});

describe("CA-28 P2 · Classification", () => {
  it("names the window Classification", () => {
    expect(CLASSIFICATION_CARD).toBe("Classification");
  });

  it("ends the Clear the build body with 'the Classification stay.'", () => {
    expect(CLEAR_COPY.body({ parts: 0, sessions: 3, tiles: 8, files: 1 })).toBe("Removes 3 sessions, 8 tiles and 1 file, with their colours, groups and links. The title, the post's words and the Classification stay.");
  });

  it("the title row button reads Classification, is named Classification, opens a window titled Classification, and its Save is the step 'Saved the Classification'", async () => {
    mountComposer();
    const button = await screen.findByRole("button", { name: "Classification" }, { timeout: 10_000 });
    expect(button.textContent).toBe("Classification");
    expect(button.getAttribute("aria-label")).toBe("Classification");
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Classification" });
    expect(within(dialog).getByRole("heading", { name: "Classification" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Classification Card/);
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "A new title" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByTestId("sandbox-card")).toBeNull(), { timeout: 5_000 });
    await waitFor(() => expect(screen.getByTestId("title-undo").getAttribute("title")).toMatch(/^Undo: Saved the Classification\b/), { timeout: 15_000 });
  });
});
