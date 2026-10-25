import { render, screen } from "@testing-library/react";
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
});
