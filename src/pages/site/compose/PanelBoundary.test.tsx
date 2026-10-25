// CA-24 P3 - a panel fails alone: its words, its Retry, the others still usable; a query error shows the same fallback; Retry
// refetches that panel's queries only.

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recentErrors, resetReportedErrors } from "@/lib/errors/report";

import { PanelBoundary, PanelFailed, panelFailedLine, type PanelName } from "./PanelBoundary";

beforeEach(() => {
  resetReportedErrors();
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
  it.each(PANELS)("%s says it did not load, with Retry", (panel) => {
    const armed = { current: true };
    render(
      <PanelBoundary panel={panel}>
        <Bomb panel={panel} armed={armed} />
      </PanelBoundary>,
    );
    const failed = screen.getByTestId("panel-failed");
    expect(within(failed).getByText(`${panel} didn't load`)).toBeTruthy();
    expect(within(failed).getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(panelFailedLine(panel)).toBe(`${panel} didn't load`);
  });

  it("is drawn as the board has it: padding 16 at the top-left, 13/500, the button 8 below at 26 tall, padding 0 9, 12/500, radius 7", () => {
    render(<PanelFailed panel="Details" onRetry={() => undefined} />);
    const failed = screen.getByTestId("panel-failed");
    const style = failed.getAttribute("style") ?? "";
    expect(style).toContain("padding: 16px");
    expect(style).toContain("align-items: flex-start");
    expect(style).toContain("gap: 8px");
    const line = failed.querySelector("p")?.getAttribute("style") ?? "";
    expect(line).toContain("font-size: 13px");
    expect(line).toContain("font-weight: 500");
    const html = renderToStaticMarkup(<PanelFailed panel="Details" onRetry={() => undefined} />);
    expect(html).toContain("background:var(--control);border:1px solid var(--control-border)");
    const retry = (screen.getByTestId("panel-retry").getAttribute("style") ?? "").replace(/\s+/g, " ");
    expect(retry).toContain("height: 26px");
    expect(retry).toContain("padding: 0px 9px");
    expect(retry).toContain("border-radius: 7px");
    expect(retry).toContain("font-size: 12px");
    expect(retry).toContain("font-weight: 500");
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
    expect(screen.getByText(`${broken} didn't load`)).toBeTruthy();
    for (const panel of PANELS.filter((other) => other !== broken)) {
      expect(screen.getByText(`${panel} is fine`)).toBeTruthy();
      expect(screen.getByRole("button", { name: `${panel} button` })).toBeTruthy();
    }
  });

  it("Retry resets the boundary and draws the panel again, and runs onRetry", () => {
    const armed = { current: true };
    const onRetry = vi.fn();
    render(
      <PanelBoundary panel="Map" onRetry={onRetry}>
        <Bomb panel="Map" armed={armed} />
      </PanelBoundary>,
    );
    armed.current = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Map is fine")).toBeTruthy();
    expect(screen.queryByTestId("panel-failed")).toBeNull();
  });

  it("Retry on a panel that still fails shows the fallback again", () => {
    const armed = { current: true };
    render(
      <PanelBoundary panel="Details">
        <Bomb panel="Details" armed={armed} />
      </PanelBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Details didn't load")).toBeTruthy();
  });

  it("reports the failure once, naming the panel, and never prints the message", () => {
    const armed = { current: true };
    render(
      <PanelBoundary panel="Post">
        <Bomb panel="Post" armed={armed} />
      </PanelBoundary>,
    );
    const reported = recentErrors().filter((entry) => entry.context.boundary === "Post");
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ name: "Error", context: { source: "boundary", boundary: "Post" } });
    const lines = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes("secret text"))).toBe(false);
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

  it("shows the same fallback, and Retry refetches that panel's query only", async () => {
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
    await waitFor(() => expect(screen.getByText("Sources didn't load")).toBeTruthy());
    expect(screen.getByText("Details")).toBeTruthy();
    expect(calls).toEqual({ Sources: 1, Details: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Sources")).toBeTruthy());
    expect(calls).toEqual({ Sources: 2, Details: 1 });
    expect(screen.queryByTestId("panel-failed")).toBeNull();
  });
});
