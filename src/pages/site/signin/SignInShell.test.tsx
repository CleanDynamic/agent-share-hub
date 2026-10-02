// UI-P36 — what the four containers share: where Back goes, what the switch
// carries, and the two numbers the orbs say (and that a phone never asks for).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";

const countReproducedToday = vi.fn();
const getGalleryStats = vi.fn();

vi.mock("@/lib/build/signals", () => ({ countReproducedToday: (...args: unknown[]) => countReproducedToday(...args) }));
vi.mock("@/lib/build/gallery", () => ({ getGalleryStats: (...args: unknown[]) => getGalleryStats(...args) }));

import { SignInShell } from "./SignInShell";
import { setViewport } from "./signinTest";

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function shell(entries: string[], index = entries.length - 1) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemeProvider>
        <MemoryRouter initialEntries={entries} initialIndex={index}>
          <Where />
          <Routes>
            <Route
              path="/login"
              element={
                <SignInShell mode="login">
                  <p>the body</p>
                </SignInShell>
              }
            />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setViewport("desktop");
  countReproducedToday.mockReset().mockResolvedValue(48);
  getGalleryStats.mockReset().mockResolvedValue({ inGallery: 1284, reproducedThisWeek: 312, weeklyGoal: null, freshPct: 86 });
});

describe("Back", () => {
  it("goes one step back through the history when there is one", async () => {
    shell(["/gallery", "/login?redirect=%2Fgallery"]);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/gallery"));
  });

  it("goes Home when this is the first page of the session", async () => {
    shell(["/login"]);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"));
  });
});

describe("the switch", () => {
  it("carries the address the visitor was heading for", () => {
    shell(["/login?redirect=%2Fgallery&frame=site"]);
    expect(screen.getByRole("link", { name: "Join free" }).getAttribute("href")).toBe("/signup?redirect=%2Fgallery");
  });

  it("carries nothing when there is none", () => {
    shell(["/login"]);
    expect(screen.getByRole("link", { name: "Join free" }).getAttribute("href")).toBe("/signup");
  });
});

describe("the orbs' numbers", () => {
  it("are read through the data layer and drawn, in the keys the Home and Gallery pages use", async () => {
    shell(["/login"]);
    expect(await screen.findByText("48 today")).toBeTruthy();
    expect(await screen.findByText("1,284")).toBeTruthy();
    expect(countReproducedToday).toHaveBeenCalledTimes(1);
    expect(getGalleryStats).toHaveBeenCalledTimes(1);
  });

  it("leave an empty disc where a count could not be read, and the page standing", async () => {
    countReproducedToday.mockRejectedValue(new Error("boom"));
    getGalleryStats.mockRejectedValue(new Error("boom"));
    shell(["/login"]);
    expect(screen.getByText("the body")).toBeTruthy();
    await waitFor(() => expect(countReproducedToday).toHaveBeenCalled());
    expect(screen.queryByText(/today/)).toBeNull();
    expect(document.querySelector('[data-ui="orb-glass"]')).toBeNull();
  });

  it("are never asked for on a phone, which draws no orbs", async () => {
    setViewport("phone");
    shell(["/login"]);
    expect(screen.getByText("the body")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(countReproducedToday).not.toHaveBeenCalled();
    expect(getGalleryStats).not.toHaveBeenCalled();
  });
});
