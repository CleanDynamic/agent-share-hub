// G21: the session ended in the editor. A banner across the top of the editor, not the dialog: "You've been signed out. Your
// work is kept on this device." with Sign in, which opens the dialog. Typing still works. Saving is paused, and the save
// state says so: "Not saved. Sign in to save."
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { mergeSave, saveWords } from "./composeModel";
import { SignedOutStrip } from "./saveStrips";

describe("the save state while the session has ended", () => {
  it("is paused, which outranks every other state, and reads the copy's sentence", () => {
    expect(mergeSave("saving", "error", "offline", "paused")).toBe("paused");
    expect(saveWords("paused", { lastSavedAt: null, pending: 3, now: 0 })).toBe("Not saved. Sign in to save.");
  });
});

describe("SignedOutStrip", () => {
  function Where() {
    const location = useLocation();
    return <p data-testid="where" data-state={JSON.stringify(location.state)}>{`${location.pathname}${location.search}`}</p>;
  }

  it("says the work is kept, and Sign in opens the dialog over the editor, saying why", () => {
    render(
      <MemoryRouter initialEntries={["/compose/b1?lens=map"]}>
        <SignedOutStrip />
        <Where />
      </MemoryRouter>,
    );
    const strip = screen.getByTestId("signed-out-strip");
    expect(strip.textContent).toContain("You've been signed out. Your work is kept on this device.");
    expect(strip.getAttribute("role")).toBe("status");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByTestId("where").textContent).toBe("/compose/b1?lens=map&signin=login");
    expect(JSON.parse(screen.getByTestId("where").getAttribute("data-state") ?? "{}")).toMatchObject({ signedOut: true, signinDepth: 1 });
  });
});

describe("a first load refused because the session ended", () => {
  it("shows the editor's banner above the held state", async () => {
    const { setSessionPhase } = await import("@/lib/query/sessionSignal");
    const { EditorLoadState } = await import("./EditorLoadState");
    setSessionPhase("ended");
    try {
      render(
        <MemoryRouter>
          <EditorLoadState status="error" onRetry={() => undefined} loadError={{ status: 401, code: "PGRST301" }} />
        </MemoryRouter>,
      );
      expect(screen.getByTestId("signed-out-strip")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      setSessionPhase("live");
    }
  });
});
