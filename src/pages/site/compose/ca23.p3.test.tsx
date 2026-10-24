// CA-23 P3: leaving with changes that have not saved. A link, navigate() and the browser's Back are asked about once; the tab
// closing or reloading is the browser's own question; neither is asked while nothing is waiting.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAVE_COPY, LeaveWindow } from "./saveWindows";
import { useLeaveGuard } from "./useLeaveGuard";

afterEach(() => cleanup());

let setPending: (n: number) => void = () => undefined;

function Probe() {
  const [pending, set] = useState(0);
  setPending = set;
  const guard = useLeaveGuard(pending);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <p data-testid="where">{location.pathname}</p>
      <Link to="/elsewhere">Elsewhere</Link>
      <button onClick={() => navigate("/by-code")}>By code</button>
      <button onClick={() => navigate("/compose/abc", { replace: true })}>Draft made</button>
      <button onClick={() => navigate({ pathname: "/compose/abc", search: "?tab=post" })}>Tab</button>
      <LeaveWindow open={guard.open} count={guard.count} onStay={guard.stay} onLeave={guard.leave} />
    </>
  );
}

const memory = (path = "/compose/new") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
const where = () => screen.getByTestId("where").textContent;

describe("the window", () => {
  it("says what it says: a title, one grey line, Leave then Stay", () => {
    expect(LEAVE_COPY.title).toBe("Changes still saving");
    expect(LEAVE_COPY.body(2)).toBe("2 changes haven't saved. Leaving may lose them.");
    expect(LEAVE_COPY.body(1)).toBe("1 change hasn't saved. Leaving may lose it.");
    render(<LeaveWindow open count={2} onStay={() => undefined} onLeave={() => undefined} />);
    const window_ = screen.getByTestId("leave-window");
    expect(within(window_).getByText("Changes still saving")).toBeTruthy();
    expect(within(window_).getByText("2 changes haven't saved. Leaving may lose them.")).toBeTruthy();
    const buttons = within(window_).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Leave", "Stay"]);
    expect(buttons[0].getAttribute("data-variant")).toBe("secondary");
    expect(buttons[1].getAttribute("data-variant")).toBe("primary");
    expect(window_.style.width).toBe("420px");
  });
});

describe("inside the site", () => {
  it("opens only with pending writes", () => {
    memory();
    fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(where()).toBe("/elsewhere");
    expect(screen.queryByTestId("leave-window")).toBeNull();
  });

  it("asks before a link goes, Stay keeps the page, Leave goes", () => {
    memory();
    act(() => setPending(2));
    fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(where()).toBe("/compose/new");
    expect(within(screen.getByTestId("leave-window")).getByText("2 changes haven't saved. Leaving may lose them.")).toBeTruthy();
    fireEvent.click(screen.getByTestId("leave-stay"));
    expect(screen.queryByTestId("leave-window")).toBeNull();
    expect(where()).toBe("/compose/new");

    fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));
    fireEvent.click(screen.getByTestId("leave-leave"));
    expect(where()).toBe("/elsewhere");
    expect(screen.queryByTestId("leave-window")).toBeNull();
  });

  it("asks before navigate() goes, too", () => {
    memory();
    act(() => setPending(1));
    fireEvent.click(screen.getByRole("button", { name: "By code" }));
    expect(where()).toBe("/compose/new");
    expect(screen.getByTestId("leave-window")).toBeTruthy();
    fireEvent.click(screen.getByTestId("leave-leave"));
    expect(where()).toBe("/by-code");
  });

  it("does not ask about a move that stays in the composer: the draft's address, the tab in the query", () => {
    memory();
    act(() => setPending(3));
    fireEvent.click(screen.getByRole("button", { name: "Draft made" }));
    expect(where()).toBe("/compose/abc");
    fireEvent.click(screen.getByRole("button", { name: "Tab" }));
    expect(where()).toBe("/compose/abc");
    expect(screen.queryByTestId("leave-window")).toBeNull();
  });

  it("closes itself and lets the move go ahead when the writes land while it is open", () => {
    memory();
    act(() => setPending(2));
    fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(screen.getByTestId("leave-window")).toBeTruthy();
    act(() => setPending(1));
    expect(screen.getByTestId("leave-window")).toBeTruthy();
    expect(within(screen.getByTestId("leave-window")).getByText("1 change hasn't saved. Leaving may lose it.")).toBeTruthy();
    act(() => setPending(0));
    expect(screen.queryByTestId("leave-window")).toBeNull();
    expect(where()).toBe("/elsewhere");
  });

  it("puts the router's own navigation back when the page goes", () => {
    const view = memory();
    act(() => setPending(1));
    view.unmount();
    // A new router's link works as it always did.
    memory();
    fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(where()).toBe("/elsewhere");
  });
});

describe("the browser's Back", () => {
  beforeEach(() => {
    window.history.replaceState({ usr: null, key: "k0", idx: 0 }, "", "/compose/x");
  });

  function Real() {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </BrowserRouter>
    );
  }

  async function arriveAtElsewhere() {
    render(<Real />);
    fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));
    expect(where()).toBe("/elsewhere");
  }

  it("asks, keeps the page on Stay, and goes back on Leave", async () => {
    await arriveAtElsewhere();
    act(() => setPending(2));
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByTestId("leave-window")).toBeTruthy());
    expect(where()).toBe("/elsewhere");
    // The address is put back (the browser does it a moment later).
    await waitFor(() => expect(window.location.pathname).toBe("/elsewhere"));
    fireEvent.click(screen.getByTestId("leave-stay"));
    expect(where()).toBe("/elsewhere");

    act(() => window.history.back());
    await waitFor(() => expect(screen.getByTestId("leave-window")).toBeTruthy());
    fireEvent.click(screen.getByTestId("leave-leave"));
    await waitFor(() => expect(where()).toBe("/compose/x"));
    expect(window.location.pathname).toBe("/compose/x");
  });

  it("does not ask when nothing is waiting", async () => {
    await arriveAtElsewhere();
    act(() => window.history.back());
    await waitFor(() => expect(where()).toBe("/compose/x"));
    expect(screen.queryByTestId("leave-window")).toBeNull();
  });
});

describe("closing or reloading the tab", () => {
  it("is the browser's own question, only while writes are waiting", () => {
    memory();
    const quiet = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);

    act(() => setPending(1));
    const waiting = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(waiting);
    expect(waiting.defaultPrevented).toBe(true);

    act(() => setPending(0));
    const done = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(done);
    expect(done.defaultPrevented).toBe(false);
  });
});
