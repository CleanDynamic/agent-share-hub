// SV-04 P1: one boundary under the frame. A page whose code is still on its way never takes the old page off the screen,
// the first page of a visit shows its own placeholder, and App.tsx holds no other Suspense fallback.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { lazy, type ComponentType } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";

import { FrameOutlet } from "./FrameOutlet";

function held() {
  let release: () => void = () => undefined;
  const Page = lazy(
    () =>
      new Promise<{ default: ComponentType }>((resolve) => {
        release = () => resolve({ default: () => <p>the drafts page</p> });
      }),
  );
  return { Page, release: () => release() };
}

const app = (initial: string, Drafts: ComponentType) =>
  render(
    <MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true }}>
      <ConnectorDialogProvider>
        <Routes>
          <Route element={<FrameOutlet />}>
            <Route path="/" element={<Link to="/drafts">Drafts</Link>} />
            <Route path="/drafts" element={<Drafts />} />
          </Route>
        </Routes>
      </ConnectorDialogProvider>
    </MemoryRouter>,
  );

describe("the frame's one boundary", () => {
  it("keeps the old page on screen, with no fallback, while the next page's code is held back", async () => {
    const drafts = held();
    app("/", drafts.Page);
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Drafts" }));
    });
    expect(screen.getByRole("link", { name: "Drafts" })).toBeTruthy();
    expect(screen.queryByText(/Loading your drafts/)).toBeNull();
    await act(async () => {
      drafts.release();
    });
    expect(await screen.findByText("the drafts page")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Drafts" })).toBeNull();
  });

  it("shows the page's own placeholder on the first load", async () => {
    const drafts = held();
    app("/drafts", drafts.Page);
    expect(screen.getByText(/Loading your drafts/)).toBeTruthy();
    await act(async () => {
      drafts.release();
    });
    expect(await screen.findByText("the drafts page")).toBeTruthy();
  });
});

describe("App.tsx", () => {
  const source = readFileSync("src/App.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("runs navigation as a transition", () => {
    expect(source).toMatch(/<BrowserRouter future=\{\{ v7_startTransition: true \}\}>/);
  });

  it("has no Suspense fallback but the one for the routes outside the frame, and the legacy composer's own", () => {
    const fallbacks = [...source.matchAll(/<Suspense fallback=\{([^\n]*?)\}>/g)].map((match) => match[1]);
    expect(fallbacks).toEqual([`<div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />`, "OUTSIDE_FRAME_FALLBACK"]);
    expect(source).toMatch(/const legacyCompose = \(\s*<Suspense fallback=/);
  });
});
