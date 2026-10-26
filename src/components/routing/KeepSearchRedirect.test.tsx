import { act, render, screen } from "@testing-library/react";
import { lazy, Suspense, type ComponentType } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { KeepSearchRedirect } from "./KeepSearchRedirect";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{pathname + search + hash}</p>;
}

function at(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/gallery" element={<KeepSearchRedirect to="/builds" />} />
        <Route path="/bounties" element={<KeepSearchRedirect to="/openbuilds" />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("KeepSearchRedirect", () => {
  it("sends /gallery to /builds and keeps the search and the hash", () => {
    at("/gallery?x=1#y");
    expect(screen.getByTestId("where").textContent).toBe("/builds?x=1#y");
  });

  it("sends /bounties to /openbuilds", () => {
    at("/bounties");
    expect(screen.getByTestId("where").textContent).toBe("/openbuilds");
  });

  it("SV-04: draws the new page's placeholder while that page's code is on its way, never an empty page area", async () => {
    const Builds = lazy(() => new Promise<{ default: ComponentType }>(() => undefined));
    render(
      <MemoryRouter initialEntries={["/gallery"]} future={{ v7_startTransition: true }}>
        <Suspense fallback={<p>the boundary's fallback</p>}>
          <Routes>
            <Route path="/gallery" element={<KeepSearchRedirect to="/builds" />} />
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );
    await act(async () => undefined);
    expect(screen.getByText(/Loading the gallery/)).toBeTruthy();
    expect(screen.queryByText("the boundary's fallback")).toBeNull();
  });
});
