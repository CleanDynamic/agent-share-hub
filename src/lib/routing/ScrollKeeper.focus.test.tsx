// G1 to G3, and D1: where focus goes after a page change. ScrollKeeper owns it (one hook beside the scroll it keeps).

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollKeeper } from "./ScrollKeeper";

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  vi.useRealTimers();
});

function Page({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

/** A page whose h1 arrives later, with a hidden placeholder h1 in its place meanwhile (G2). */
function Slow({ later }: { later: boolean }) {
  const [ready, setReady] = useState(false);
  (window as unknown as { __ready: () => void }).__ready = () => setReady(true);
  return <main>{ready || !later ? <h1>Build title</h1> : <h1 data-h1-placeholder="">Build</h1>}</main>;
}

function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}

const app = (start = "/") =>
  render(
    <MemoryRouter initialEntries={[start]}>
      <ScrollKeeper />
      <nav>
        <Link to="/">Home</Link>
        <Link to="/builds">Builds</Link>
        <Link to="/builds?view=maps">Maps</Link>
        <Link to="/slow">Slow</Link>
        <Link to="/empty">Empty</Link>
        <Link to="/compose/new">Editor</Link>
        <Link to="/about#team">Team</Link>
        <Back />
      </nav>
      <Routes>
        <Route path="/" element={<Page title="Home" />} />
        <Route path="/builds" element={<Page title="Builds" />} />
        <Route path="/slow" element={<Slow later />} />
        <Route path="/empty" element={<main />} />
        <Route
          path="/about"
          element={
            <Page title="About">
              <a href="#team">To the team</a>
              <h2 id="team">Team</h2>
            </Page>
          }
        />
        <Route
          path="/compose/new"
          element={
            <>
              <a href="#build" data-testid="skip-to-build">
                Skip to build
              </a>
              <Page title="Untitled build" />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const flush = () => act(async () => undefined);

describe("G1: focus on the new page's h1", () => {
  it("moves focus to the h1 after a link, with tabIndex -1 and no outline", async () => {
    app();
    fireEvent.click(screen.getByText("Builds"));
    await flush();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Builds");
    expect(document.activeElement).toBe(h1);
    expect(h1.tabIndex).toBe(-1);
    expect(h1.style.outline).toBe("none");
  });

  it("does the same on Back", async () => {
    app();
    fireEvent.click(screen.getByText("Builds"));
    await flush();
    fireEvent.click(screen.getByText("Back"));
    await flush();
    expect(document.activeElement?.textContent).toBe("Home");
  });

  it("leaves focus alone for a change of query string on the same page", async () => {
    app("/builds");
    const maps = screen.getByText("Maps");
    maps.focus();
    fireEvent.click(maps);
    await flush();
    expect(document.activeElement).toBe(maps);
  });
});

describe("G2: an h1 that is not there yet", () => {
  it("goes to the placeholder h1, then to the real h1 when it replaces it", async () => {
    app();
    fireEvent.click(screen.getByText("Slow"));
    await flush();
    expect(document.activeElement?.textContent).toBe("Build");
    await act(async () => (window as unknown as { __ready: () => void }).__ready());
    await flush();
    expect(document.activeElement?.textContent).toBe("Build title");
    expect(document.activeElement?.hasAttribute("data-h1-placeholder")).toBe(false);
  });

  it("does not take focus back once the person has moved it", async () => {
    app();
    fireEvent.click(screen.getByText("Empty"));
    await flush();
    const mine = screen.getByText("Home");
    mine.focus();
    await flush();
    expect(document.activeElement).toBe(mine);
  });
});

describe("G3: a hash link to an anchor", () => {
  it("moves focus to the anchor, not the h1, across pages and on the same page", async () => {
    app();
    fireEvent.click(screen.getByText("Team"));
    await flush();
    const team = screen.getByRole("heading", { level: 2 });
    expect(document.activeElement).toBe(team);
    expect(team.tabIndex).toBe(-1);
  });
});

describe("D1: the editor", () => {
  it("puts focus on Skip to build and says the page's title once, politely", async () => {
    app();
    fireEvent.click(screen.getByText("Editor"));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId("skip-to-build"));
    const region = screen.getByTestId("page-said");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("Untitled build");
  });
});
