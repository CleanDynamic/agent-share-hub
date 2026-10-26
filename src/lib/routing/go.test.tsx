// SV-04 P2: ready, then change. A click marks its target as current at once; the progress line comes only after 300 ms
// of waiting; past 800 ms the new page's placeholder takes the page area; the last click wins; Back does not wait.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { lazy, type ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FrameOutlet } from "@/components/shell/FrameOutlet";
import { PageProgress } from "@/components/shell/PageProgress";

import { loadEntry, resetGo, useCurrentPath } from "./go";
import { PageChangeProvider } from "./PageChangeProvider";
import { PageLink } from "./PageLink";

vi.mock("./warm", () => ({ warmPath: vi.fn() }));
vi.mock("./useIntent", () => ({
  storedUserId: async () => null,
  useIntent: () => ({ onPointerEnter() {}, onPointerLeave() {}, onFocus() {}, onTouchStart() {}, onPointerDown() {} }),
}));

/** A page whose code arrives when the test says so. */
function held(text: string) {
  let release: () => void = () => undefined;
  const Page = lazy(
    () =>
      new Promise<{ default: ComponentType }>((resolve) => {
        release = () => resolve({ default: () => <p>{text}</p> });
      }),
  );
  return { Page, release: () => release() };
}

function Nav() {
  const current = useCurrentPath();
  return (
    <nav aria-label="Primary">
      {["/drafts", "/library"].map((href) => (
        <PageLink key={href} to={href} aria-current={current === href ? "page" : undefined}>
          {href.slice(1)}
        </PageLink>
      ))}
    </nav>
  );
}

function app(pages: { drafts: ComponentType; library: ComponentType }) {
  return render(
    <BrowserRouter future={{ v7_startTransition: true }}>
      <PageChangeProvider>
        <Nav />
        <PageProgress />
        <Routes>
          <Route element={<FrameOutlet />}>
            <Route path="/" element={<p>the home page</p>} />
            <Route path="/drafts" element={<pages.drafts />} />
            <Route path="/library" element={<pages.library />} />
          </Route>
        </Routes>
      </PageChangeProvider>
    </BrowserRouter>,
  );
}

const link = (name: string) => screen.getByRole("link", { name });
const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, "", "/");
  resetGo();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("go()", () => {
  it("marks the clicked target as current within one frame, while the old page is still on screen", async () => {
    const drafts = held("the drafts page");
    app({ drafts: drafts.Page, library: held("the library").Page });
    await act(async () => {
      fireEvent.click(link("drafts"));
    });
    expect(link("drafts").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("the home page")).toBeTruthy();
    await act(async () => drafts.release());
    await wait(0);
    expect(screen.getByText("the drafts page")).toBeTruthy();
    expect(link("drafts").getAttribute("aria-current")).toBe("page");
  });

  it("changes a page that is ready in 200 ms with no progress line", async () => {
    const drafts = held("the drafts page");
    app({ drafts: drafts.Page, library: held("the library").Page });
    await act(async () => {
      fireEvent.click(link("drafts"));
    });
    await wait(200);
    expect(screen.queryByTestId("page-progress")).toBeNull();
    await act(async () => drafts.release());
    await wait(400);
    expect(screen.getByText("the drafts page")).toBeTruthy();
    expect(screen.queryByTestId("page-progress")).toBeNull();
  });

  it("shows the line from 300 ms for a page that takes 500 ms, and finishes it when the page changes", async () => {
    const drafts = held("the drafts page");
    app({ drafts: drafts.Page, library: held("the library").Page });
    await act(async () => {
      fireEvent.click(link("drafts"));
    });
    await wait(290);
    expect(screen.queryByTestId("page-progress")).toBeNull();
    await wait(20);
    expect(screen.getByTestId("page-progress").getAttribute("data-phase")).toBe("on");
    await wait(190);
    await act(async () => drafts.release());
    expect(screen.getByText("the drafts page")).toBeTruthy();
    expect(screen.getByTestId("page-progress").getAttribute("data-phase")).toBe("done");
  });

  it("shows the new page's placeholder at 800 ms for a page that takes 2 s", async () => {
    const drafts = held("the drafts page");
    app({ drafts: drafts.Page, library: held("the library").Page });
    await act(async () => {
      fireEvent.click(link("drafts"));
    });
    await wait(790);
    expect(screen.getByText("the home page")).toBeTruthy();
    expect(screen.queryByText(/Loading Drafts/)).toBeNull();
    await wait(20);
    expect(screen.getByText(/Loading Drafts/)).toBeTruthy();
    expect(screen.queryByText("the home page")).toBeNull();
    await wait(1200);
    await act(async () => drafts.release());
    await wait(0);
    expect(screen.getByText("the drafts page")).toBeTruthy();
    expect(screen.queryByText(/Loading Drafts/)).toBeNull();
  });

  it("lets the second click win", async () => {
    const drafts = held("the drafts page");
    const library = held("the library");
    app({ drafts: drafts.Page, library: library.Page });
    await act(async () => {
      fireEvent.click(link("drafts"));
    });
    await act(async () => {
      fireEvent.click(link("library"));
    });
    expect(link("library").getAttribute("aria-current")).toBe("page");
    expect(link("drafts").getAttribute("aria-current")).toBeNull();
    await act(async () => {
      drafts.release();
      library.release();
    });
    await wait(0);
    expect(screen.getByText("the library")).toBeTruthy();
    expect(screen.queryByText("the drafts page")).toBeNull();
    expect(window.location.pathname).toBe("/library");
  });

  it("does not wait on Back: a page whose code is not in shows its placeholder at once", async () => {
    const drafts = held("the drafts page");
    const library = held("the library");
    app({ drafts: drafts.Page, library: library.Page });
    // Open the library, its code in.
    await act(async () => {
      fireEvent.click(link("library"));
    });
    await act(async () => library.release());
    await wait(0);
    expect(screen.getByText("the library")).toBeTruthy();
    // Back to Home (drawn at once), Forward to the library (its code is in: drawn at once)...
    await act(async () => {
      await loadEntry("library", async () => undefined);
      window.history.back();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(screen.getByText("the home page")).toBeTruthy();
    // ...and a Back to an address whose code never came shows that page's placeholder, not the page left.
    window.history.replaceState({}, "", "/");
    await act(async () => {
      window.history.pushState({}, "", "/drafts");
      window.history.pushState({}, "", "/library");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await vi.advanceTimersByTimeAsync(20);
    });
    await act(async () => {
      window.history.back();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(window.location.pathname).toBe("/drafts");
    expect(screen.getByText(/Loading Drafts/)).toBeTruthy();
    expect(screen.queryByText("the library")).toBeNull();
    expect(link("drafts").getAttribute("aria-current")).toBe("page");
  });
});
