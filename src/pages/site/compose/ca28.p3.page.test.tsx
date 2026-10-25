// CA-28 P3, on the page: a write that fails once says "Title not saved" with Retry, and Retry makes the same write again.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { PG } from "@/lib/build/__audit__/fakeSupabase";
import { sessionsMetaOf } from "@/lib/build/making";

import { draftRow, harnessAfter, harnessBefore, mountCa20 } from "./ca20Harness";
import { KEY_A, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

describe("Title not saved", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("says so when the write fails once, with Retry; Retry writes the title", async () => {
    await mountCa20(seedCa20, { faults: [{ method: "PATCH", path: /\/rest\/v1\/builds\?/, answer: PG.check("builds", "builds_making_object_check"), times: 1 }] });
    render(<Toaster />);
    const title = screen.getByRole("textbox", { name: "Title of Session 1" }) as HTMLInputElement;
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: "Login" } });
    fireEvent.keyDown(title, { key: "Enter" });
    fireEvent.blur(title);
    const said = await screen.findByText("Title not saved", undefined, { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[KEY_A]?.title).toBeUndefined();
    fireEvent.click(within(said.closest("[data-sonner-toast]") as HTMLElement).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[KEY_A]?.title).toBe("Login"), { timeout: 15_000 });
  });
});
