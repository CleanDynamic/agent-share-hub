// CA-24 P3 - a panel fails alone: the shared failed state (G20: PageState's line and Try again), the others still usable; a
// query error shows the same fallback; Try again refetches that panel's queries only.

import { clearRecentErrors, recentErrors } from "@/lib/errors/report";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelBoundary, PanelFailed, panelFailedLine, type PanelName } from "./PanelBoundary";

const LINE: Record<PanelName, string> = {
  Sources: "Couldn't load your sessions. Try again.",
  Post: "Couldn't load this build. Try again.",
  Build: "Couldn't load this build. Try again.",
  Details: "Couldn't load this build. Try again.",
  Map: "Couldn't load this build. Try again.",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Bomb({ panel, armed }: { panel: string; armed: { current: boolean } }): ReactElement {
  if (armed.current) throw new Error(`secret text of ${panel}`);
  return <p>{panel} is fine</p>;
}

const PANELS: PanelName[] = ["Sources", "Post", "Build", "Details", "Map"];

describe("the words", () => {
  it.each(PANELS)("%s is the shared failed state: what did not load, and Try again", (panel) => {
    const armed = { current: true };
    render(
      <PanelBoundary panel={panel}>
        <Bomb panel={panel} armed={armed} />
      </PanelBoundary>,
    );
    const failed = screen.getByTestId("panel-failed");
    expect(within(failed).getByRole("alert").textContent).toContain(LINE[panel]);
    expect(within(failed).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(within(failed).queryByText(/didn't load|Retry/)).toBeNull();
    expect(panelFailedLine(panel)).toBe(LINE[panel]);
  });

  it("sits in the panel's own place, padded 16 at its top-left", () => {
    render(<PanelFailed panel="Details" onRetry={() => undefined} />);
    const style = screen.getByTestId("panel-failed").getAttribute("style") ?? "";
    expect(style).toContain("padding: 16px");
    expect(style).toContain("align-items: flex-start");
  });

  it("a failed read is not reported again here: the query cache reports it (one report per failure)", () => {
    clearRecentErrors();
    render(<PanelFailed panel="Sources" onRetry={() => undefined} error={new Error("boom")} />);
    expect(recentErrors()).toHaveLength(0);
  });
});

describe("each panel fails alone", () => {
  it.each(PANELS)("%s failing leaves the other four usable", (broken) => {
    const armed = Object.fromEntries(PANELS.map((panel) => [panel, { current: panel === broken }]));
    render(
      <div>
        {PANELS.map((panel) => (
          <PanelBoundary key={panel} panel={panel}>
            <Bomb panel={panel} armed={armed[panel]} />
            <button type="button">{panel} button</button>
          </PanelBoundary>
        ))}
      </div>,
    );
    expect(screen.getAllByTestId("panel-failed")).toHaveLength(1);
    expect(within(screen.getByTestId("panel-failed")).getByRole("alert").textContent).toContain(LINE[broken]);
    for (const panel of PANELS.filter((other) => other !== broken)) {
      expect(screen.getByText(`${panel} is fine`)).toBeTruthy();
      expect(screen.getByRole("button", { name: `${panel} button` })).toBeTruthy();
    }
  });

  it("Try again resets the boundary and draws the panel again, and runs onRetry", () => {
    const armed = { current: true };
    const onRetry = vi.fn();
    render(
      <PanelBoundary panel="Map" onRetry={onRetry}>
        <Bomb panel="Map" armed={armed} />
      </PanelBoundary>,
    );
    armed.current = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Map is fine")).toBeTruthy();
    expect(screen.queryByTestId("panel-failed")).toBeNull();
  });

  it("Try again on a panel that still fails shows the fallback again", () => {
    const armed = { current: true };
    render(
      <PanelBoundary panel="Details">
        <Bomb panel="Details" armed={armed} />
      </PanelBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert").textContent).toContain(LINE.Details);
  });

  it("reports the failure once, naming the panel and the kind of error, never the message (SV-01: through reportError)", () => {
    clearRecentErrors();
    const armed = { current: true };
    render(
      <PanelBoundary panel="Post">
        <Bomb panel="Post" armed={armed} />
      </PanelBoundary>,
    );
    expect(recentErrors()).toHaveLength(1);
    expect(recentErrors()[0]).toMatchObject({ source: "panel-boundary", context: "Post", name: "Error" });
    expect(JSON.stringify(recentErrors())).not.toContain("secret text");
  });
});

describe("a failing query", () => {
  function Panel({ name, calls, fail }: { name: PanelName; calls: Record<string, number>; fail: boolean }) {
    const query = useQuery({
      queryKey: ["panel", name],
      queryFn: async () => {
        calls[name] = (calls[name] ?? 0) + 1;
        if (fail && calls[name] === 1) throw new Error("boom");
        return name;
      },
      retry: false,
    });
    const client = (Panel as unknown as { client: QueryClient }).client;
    return (
      <PanelBoundary panel={name} failed={query.isError} error={query.error ?? undefined} onRetry={() => void client.refetchQueries({ queryKey: ["panel", name] })}>
        <p>{query.data ?? "loading"}</p>
      </PanelBoundary>
    );
  }

  it("shows the same fallback, and Try again refetches that panel's query only", async () => {
    const calls: Record<string, number> = {};
    const client = new QueryClient();
    (Panel as unknown as { client: QueryClient }).client = client;
    function App() {
      const [, force] = useState(0);
      void force;
      return (
        <QueryClientProvider client={client}>
          <Panel name="Sources" calls={calls} fail />
          <Panel name="Details" calls={calls} fail={false} />
        </QueryClientProvider>
      );
    }
    render(<App />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(LINE.Sources));
    expect(screen.getByText("Details")).toBeTruthy();
    expect(calls).toEqual({ Sources: 1, Details: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Sources")).toBeTruthy());
    expect(calls).toEqual({ Sources: 2, Details: 1 });
    expect(screen.queryByTestId("panel-failed")).toBeNull();
  });
});
