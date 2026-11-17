// G4 to G10: PageState draws exactly one of loading, failed, empty, not found and ready, from the query results it is given.
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageState } from "./PageState";
import { allFailed, shownState, type ReadLike } from "./pageStateModel";

afterEach(() => vi.restoreAllMocks());

const read = (over: Partial<ReadLike> = {}): ReadLike => ({ data: undefined, error: null, status: "pending", fetchStatus: "fetching", refetch: vi.fn(), ...over });
const ok = (data: unknown) => read({ data, status: "success", fetchStatus: "idle" });
const failed = (error: unknown, over: Partial<ReadLike> = {}) => read({ error, status: "error", fetchStatus: "idle", ...over });

const SERVER = { code: "XX000", message: "internal error", status: 500 };
const NO_ROWS = { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" };
const REFUSED = { code: "42501", message: "permission denied" };
const SESSION = { code: "PGRST301", message: "JWT expired", status: 401 };

function draw(node: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/here"]}>
      <Routes>
        <Route path="/here" element={node} />
        <Route path="/builds" element={<p>The builds page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const SKELETON = <div data-testid="skeleton" aria-busy="true" />;

describe("shownState", () => {
  it("loading while a read is out, ready once it answers", () => {
    expect(shownState([read()])).toBe("loading");
    expect(shownState([ok([1])])).toBe("ready");
  });

  it("empty only when the server answered with nothing", () => {
    const isEmpty = (data: unknown[]) => (data[0] as unknown[]).length === 0;
    expect(shownState([ok([])], { isEmpty })).toBe("empty");
    expect(shownState([failed(SERVER)], { isEmpty })).toBe("failed");
    expect(shownState([read()], { isEmpty })).toBe("loading");
  });

  it("not found only when the server said the row is absent", () => {
    const isMissing = (data: unknown[]) => data[0] === null;
    expect(shownState([ok(null)], { isMissing })).toBe("notfound");
    expect(shownState([failed(NO_ROWS)], { isMissing })).toBe("notfound");
    expect(shownState([failed(SERVER)], { isMissing })).toBe("failed");
    expect(shownState([failed(REFUSED)], { isMissing })).toBe("failed");
    expect(shownState([failed(SESSION)], { isMissing })).toBe("failed");
    expect(shownState([failed(new TypeError("Failed to fetch"))], { isMissing })).toBe("failed");
  });

  it("a page with no not-found case never shows one, even for the no-rows code", () => {
    expect(shownState([failed(NO_ROWS)])).toBe("failed");
  });

  it("one failed read fails the region at once, without waiting for the rest", () => {
    expect(shownState([read(), failed(SERVER)])).toBe("failed");
  });

  it("data already on screen stays when a refetch fails", () => {
    expect(shownState([failed(SERVER, { data: [1] })])).toBe("ready");
  });
});

describe("allFailed (G9)", () => {
  it("is true only when every read failed with nothing to show", () => {
    expect(allFailed([failed(SERVER), failed(SERVER)])).toBe(true);
    expect(allFailed([failed(SERVER), ok([1])])).toBe(false);
    expect(allFailed([failed(SERVER), read()])).toBe(false);
    expect(allFailed([failed(SERVER, { data: [1] }), failed(SERVER)])).toBe(false);
    expect(allFailed([])).toBe(false);
  });
});

describe("PageState", () => {
  it("loading: the page's own skeleton, and nothing else", () => {
    draw(<PageState read={read()} thing="your drafts" region="Continue editing" skeleton={SKELETON}>{() => <p>Content</p>}</PageState>);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Content")).toBeNull();
    expect(document.querySelector('[data-page-state="loading"]')).not.toBeNull();
  });

  it("failed: one sentence, one Try again, an alert naming its region, no code (G5, G10)", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const query = failed(SESSION);
    draw(<PageState read={query} thing="your drafts" region="Continue editing" skeleton={SKELETON}>{() => <p>Content</p>}</PageState>);
    const alert = screen.getByRole("alert", { name: "Continue editing" });
    expect(alert.textContent).toBe("Couldn't load your drafts. Try again.Try again");
    expect(document.body.textContent).not.toMatch(/PGRST|401|Code /);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it("retrying: the button is disabled and reads Trying again…; a retry that fails comes back to the same state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = draw(<PageState read={failed(SERVER, { fetchStatus: "fetching" })} thing="builds" region="Builds" skeleton={SKELETON}>{() => null}</PageState>);
    expect(screen.getByRole("button", { name: "Trying again…" })).toBeDisabled();
    rerender(
      <MemoryRouter initialEntries={["/here"]}>
        <Routes>
          <Route path="/here" element={<PageState read={failed(SERVER)} thing="builds" region="Builds" skeleton={SKELETON}>{() => null}</PageState>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeDisabled();
    expect(screen.getByText("Couldn't load builds. Try again.")).toBeInTheDocument();
  });

  it("retries only the reads that failed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good = ok([1]);
    const bad = failed(SERVER);
    draw(<PageState read={[good, bad]} thing="this comparison" region="Compare" skeleton={SKELETON}>{() => null}</PageState>);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(bad.refetch).toHaveBeenCalledTimes(1);
    expect(good.refetch).not.toHaveBeenCalled();
  });

  it("empty: the page's sentence and its one action (G6)", () => {
    const onClick = vi.fn();
    draw(
      <PageState read={ok([])} thing="your drafts" region="Continue editing" skeleton={SKELETON} empty={{ when: ([rows]) => (rows as unknown[]).length === 0, line: "Nothing in progress.", action: { label: "Start a new build", onClick } }}>
        {() => <p>Content</p>}
      </PageState>,
    );
    expect(screen.getByText("Nothing in progress.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start a new build" }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByText("Content")).toBeNull();
  });

  it("not found: Nothing at this address, the kind's line, and the page's way out (G7)", () => {
    draw(
      <PageState read={ok(null)} thing="this build" region="The build" skeleton={SKELETON} notFound={{ when: ([row]) => row === null, kind: "build", way: { label: "Browse builds", to: "/builds" } }}>
        {() => <p>Content</p>}
      </PageState>,
    );
    expect(screen.getByText("Nothing at this address.")).toBeInTheDocument();
    expect(screen.getByText("This build may have been unpublished, or the link may be wrong.")).toBeInTheDocument();
    // A navigation: a link drawn as the button, so it opens in a new tab.
    expect(screen.getByRole("link", { name: "Browse builds" })).toHaveAttribute("href", "/builds");
    fireEvent.click(screen.getByRole("link", { name: "Browse builds" }));
    expect(screen.getByText("The builds page")).toBeInTheDocument();
  });

  it("a failed or refused read never reaches not found (G7)", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const error of [SERVER, REFUSED, SESSION]) {
      const { unmount } = draw(
        <PageState read={failed(error)} thing="this build" region="The build" skeleton={SKELETON} notFound={{ when: ([row]) => row === null, kind: "build", way: { label: "Browse builds", to: "/builds" } }}>
          {() => null}
        </PageState>,
      );
      expect(screen.queryByText("Nothing at this address.")).toBeNull();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      unmount();
    }
  });

  it("a frame wraps every state but loading: the skeleton stands in for the whole region", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const frame = (body: React.ReactNode) => (
      <section aria-label="Continue editing">
        <h2>Continue editing</h2>
        {body}
      </section>
    );
    const { unmount } = draw(<PageState read={read()} thing="your drafts" region="Continue editing" skeleton={SKELETON} frame={frame}>{() => <p>Content</p>}</PageState>);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Continue editing" })).toBeNull();
    unmount();
    draw(<PageState read={failed({ ...SERVER })} thing="your drafts" region="Continue editing" skeleton={SKELETON} frame={frame}>{() => <p>Content</p>}</PageState>);
    const section = screen.getByRole("region", { name: "Continue editing" });
    expect(section).toContainElement(screen.getByRole("heading", { name: "Continue editing" }));
    expect(section).toContainElement(screen.getByRole("alert"));
  });

  it("ready: the content, drawn only then", () => {
    const content = vi.fn(() => <p>Content</p>);
    const { rerender } = draw(<PageState read={read()} thing="builds" region="Builds" skeleton={SKELETON}>{content}</PageState>);
    expect(content).not.toHaveBeenCalled();
    rerender(
      <MemoryRouter initialEntries={["/here"]}>
        <Routes>
          <Route path="/here" element={<PageState read={ok([1])} thing="builds" region="Builds" skeleton={SKELETON}>{content}</PageState>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("logs the failure once, as one line with its code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Its own error: a failure is logged once for the whole app, and SERVER was logged by the tests above.
    draw(<PageState read={failed({ ...SERVER })} thing="builds" region="Builds" skeleton={SKELETON}>{() => null}</PageState>);
    const lines = spy.mock.calls.map((call) => call[0]).filter((line) => typeof line === "string" && line.startsWith("[Builds]"));
    expect(lines).toEqual(["[Builds] read failed XX000 internal error"]);
  });
});

describe("while the session is being checked or has ended (G18)", () => {
  afterEach(async () => (await import("@/lib/query/sessionSignal")).setSessionPhase("live"));

  it("a failed read is held as loading, so no Try again is offered that cannot succeed", async () => {
    const { setSessionPhase } = await import("@/lib/query/sessionSignal");
    setSessionPhase("checking");
    expect(shownState([failed(SESSION)])).toBe("loading");
    expect(allFailed([failed(SESSION), failed(SESSION)])).toBe(false);
    setSessionPhase("ended");
    expect(shownState([failed(SERVER)])).toBe("loading");
    setSessionPhase("live");
    expect(shownState([failed(SESSION)])).toBe("failed");
  });

  it("PageState shows the skeleton, and the failed state once the server says the session is fine", async () => {
    const { setSessionPhase } = await import("@/lib/query/sessionSignal");
    const { act } = await import("@testing-library/react");
    setSessionPhase("checking");
    draw(
      <PageState read={failed(SESSION)} thing="builds" region="Builds" skeleton={SKELETON}>
        {() => <p>ready</p>}
      </PageState>,
    );
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => setSessionPhase("live"));
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load builds.");
  });
});
