// UX-08 P5: the three Solvers addresses land on /openbuilds, keeping the search and the hash; the footer has no Solvers link.
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { KeepSearchRedirect } from "@/components/routing/KeepSearchRedirect";

import { SOLVERS_ADDRESSES, SOLVERS_LANDING } from "./retiredRoutes";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{pathname + search + hash}</p>;
}

function at(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {SOLVERS_ADDRESSES.map((address) => (
          <Route key={address} path={address} element={<KeepSearchRedirect to={SOLVERS_LANDING} />} />
        ))}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UX-08 P5 · retire Solvers", () => {
  it.each([
    ["/openbuilds/solvers", "/openbuilds"],
    ["/bounties/solvers", "/openbuilds"],
    ["/b/abc123/leaderboard", "/openbuilds"],
    ["/openbuilds/solvers?x=1#y", "/openbuilds?x=1#y"],
  ])("%s lands on %s", (from, to) => {
    at(from);
    expect(screen.getByTestId("where").textContent).toBe(to);
  });

  it("the three addresses are the ones the prompt names", () => {
    expect([...SOLVERS_ADDRESSES]).toEqual(["/openbuilds/solvers", "/bounties/solvers", "/b/:id/leaderboard"]);
  });
});
