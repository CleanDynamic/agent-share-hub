// UI-P81 — the scroll reveal, and its absence under the refined look.
//
// `motion.test.ts` holds WHERE the hook may be imported and what the reveal's
// figures are. What is proved here is the hook: that it reveals once on
// intersection in the current look, and that under the refined look it answers
// "already revealed" without ever creating an observer.
//
// jsdom has no IntersectionObserver, which is also what makes `canReveal()` false
// and the hook fail towards visible, so the tests install a fake one. The look
// comes from the router, as it does in the app: `?look=refined` counts on `/dev/*`.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReveal, type RevealOptions } from "./useReveal";

class FakeObserver {
  static all: FakeObserver[] = [];
  disconnected = false;
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.all.push(this);
  }
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }
  /** What the browser does when the element crosses into the root margin. */
  intersect() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe(options: RevealOptions) {
  const { ref, style, shown } = useReveal(options);
  return <div ref={ref} data-testid="probe" data-shown={String(shown)} style={style} />;
}

const probe = () => screen.getByTestId("probe");
/** The element's inline style as text. A style React has emptied reads "", and one it never set reads null: both are none. */
const styleText = () => probe().getAttribute("style") ?? "";
const at = (url: string, node: React.ReactElement) => <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>;
const REFINED = "/dev/kit/pages/home?look=refined";

describe("useReveal in the current look", () => {
  it("holds the element hidden until it intersects, then reveals it once and stops watching", () => {
    render(<Probe />);
    expect(probe().dataset.shown).toBe("false");
    expect(probe().style.opacity).toBe("0");
    expect(FakeObserver.all).toHaveLength(1);

    act(() => FakeObserver.all[0].intersect());
    expect(probe().dataset.shown).toBe("true");
    expect(probe().style.opacity).toBe("1");
    expect(probe().style.transform).toBe("none");
    expect(FakeObserver.all[0].disconnected).toBe(true);
  });

  it("is the same on a dev route that asks for the current look", () => {
    render(at("/dev/kit/pages/home?look=current", <Probe />));
    expect(probe().style.opacity).toBe("0");
    expect(FakeObserver.all).toHaveLength(1);
  });

  it("ignores ?look=refined off the dev routes, where a visitor cannot opt in", () => {
    render(at("/gallery?look=refined", <Probe />));
    expect(probe().style.opacity).toBe("0");
    expect(FakeObserver.all).toHaveLength(1);
  });

  it("does not animate when told not to, as before", () => {
    render(<Probe enabled={false} />);
    expect(probe().dataset.shown).toBe("true");
    expect(probe().style.opacity).toBe("");
    expect(FakeObserver.all).toHaveLength(0);
  });
});

describe("useReveal under the refined look (UI-P81)", () => {
  it("answers already revealed from the first render: shown, no style, no observer", () => {
    render(at(REFINED, <Probe />));
    expect(probe().dataset.shown).toBe("true");
    expect(styleText()).toBe("");
    expect(FakeObserver.all).toHaveLength(0);
  });

  it("does so whatever the options ask for: a delay, a root margin, enabled", () => {
    render(at(REFINED, <Probe delayMs={240} rootMargin="0px" enabled />));
    expect(probe().dataset.shown).toBe("true");
    expect(styleText()).toBe("");
    expect(FakeObserver.all).toHaveLength(0);
  });

  it("follows the look while the element is mounted: it is shown the moment the look turns refined, and waits again when it turns back", () => {
    function Switch() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate("/dev/kit?look=refined")}>refine</button>
          <button onClick={() => navigate("/dev/kit?look=current")}>revert</button>
        </>
      );
    }
    render(
      at(
        "/dev/kit?look=current",
        <>
          <Switch />
          <Probe />
        </>,
      ),
    );
    expect(probe().style.opacity).toBe("0");
    expect(FakeObserver.all).toHaveLength(1);

    // Hidden, waiting, and the look changes: nothing is left at opacity 0, and the observer is released.
    fireEvent.click(screen.getByText("refine"));
    expect(probe().dataset.shown).toBe("true");
    expect(styleText()).toBe("");
    expect(FakeObserver.all[0].disconnected).toBe(true);

    // Back to the current look it was never revealed in: it waits for its observer again.
    fireEvent.click(screen.getByText("revert"));
    expect(probe().style.opacity).toBe("0");
    expect(FakeObserver.all).toHaveLength(2);
    expect(FakeObserver.all[1].disconnected).toBe(false);
  });
});
