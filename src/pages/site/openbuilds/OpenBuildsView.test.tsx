// SV-14 P1: the OpenBuilds view, from the board's sample data. Every section is drawn from its own prop, and a section
// whose prop is absent is not drawn.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { visionOpenBuildsProps } from "@/dev/fixtures/vision/openbuilds";

import { OpenBuildsView, type OpenBuildsViewProps } from "./OpenBuildsView";

let wide = true;

beforeEach(() => {
  wide = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width") ? wide : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function view(props: Partial<OpenBuildsViewProps> = {}) {
  const all = { ...visionOpenBuildsProps(), ...props };
  render(
    <MemoryRouter>
      <OpenBuildsView {...all} />
    </MemoryRouter>,
  );
  return all;
}

describe("OpenBuildsView", () => {
  it("draws every section of the board", () => {
    view();
    expect(screen.getByRole("region", { name: "Model release check" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Requests" })).toBeInTheDocument();
    for (const name of ["Your requests", "Your claims", "Your record", "Groups", "Top contributors"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("openbuilds-request").map((item) => item.dataset.kind)).toEqual(["step", "session", "brief", "model-test", "review"]);
    expect(screen.getByText(/requests closed/).parentElement).toHaveTextContent("18 of 30 requests closed");
  });

  it("puts the release check's bars behind one text summary", () => {
    view();
    const chart = screen.getByRole("img", { name: "94 of 120 work on Opus 5.5, 11 fail, 15 not tested" });
    expect(chart.children).toHaveLength(120);
    expect([...chart.children].every((bar) => bar.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.getByRole("link", { name: "Run an untested build" })).toHaveAttribute("data-visual-slot", "btn-primary");
  });

  it("draws a step request: the problem, the strip with the open step dashed, and one control", () => {
    view();
    const step = screen.getAllByTestId("openbuilds-request")[0];
    expect(within(step).getByRole("heading", { name: "Step 4 · Fetch from paywalled sources" })).toBeInTheDocument();
    expect(within(step).getByText("£40")).toBeInTheDocument();
    expect(within(step).getByText("Research brief agent · @mira · opened from a failed run · 6h")).toBeInTheDocument();
    const tiles = within(within(step).getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(tiles).toHaveLength(5);
    expect(tiles[3]).toHaveAttribute("data-ui", "dashed-slot");
    expect(tiles[3]).toHaveTextContent("4 · Code · openPaywalled sources");
    expect(within(step).getByRole("link", { name: "Answer" })).toBeInTheDocument();
  });

  it("presses Me too in place", () => {
    const onToggle = vi.fn();
    const props = visionOpenBuildsProps();
    const [first, ...rest] = props.requests.items;
    view({ requests: { ...props.requests, items: [{ ...first, meToo: { count: 5, pressed: true, onToggle } }, ...rest] } });
    const button = screen.getByRole("button", { name: "Me too 5" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("changes tab and sort through its props", () => {
    const onTab = vi.fn();
    const onSort = vi.fn();
    const props = visionOpenBuildsProps();
    view({ requests: { ...props.requests, onTab, onSort } });
    fireEvent.click(screen.getByRole("tab", { name: "Steps" }));
    expect(onTab).toHaveBeenCalledWith("steps");
    fireEvent.keyDown(screen.getByRole("button", { name: "Sort: Most needed" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Closing soon" }));
    expect(onSort).toHaveBeenCalledWith("closing");
  });

  it("leaves out the sections it is not given", () => {
    const props = visionOpenBuildsProps();
    view({ release: undefined, yourClaims: undefined, groups: undefined, week: undefined });
    expect(screen.queryByRole("region", { name: "Model release check" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your claims" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Groups" })).toBeNull();
    expect(screen.queryByText("Site goal")).toBeNull();
    expect(screen.getAllByTestId("openbuilds-request")).toHaveLength(props.requests.items.length);
  });

  it("says when there are no requests, with one action", () => {
    view(visionOpenBuildsProps("empty"));
    expect(screen.getByText("No open requests right now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse builds" })).toHaveAttribute("href", "/builds");
  });

  it("says when the requests did not load, with Retry", () => {
    const onRetry = vi.fn();
    const props = visionOpenBuildsProps();
    view({ requests: { ...props.requests, status: "error", onRetry } });
    const alert = screen.getByText("Requests didn't load.").closest("[role=alert]") as HTMLElement;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("puts the side column after the main one below 1000px", () => {
    wide = false;
    view();
    const page = screen.getByTestId("openbuilds-page");
    expect(page.dataset.layout).toBe("one");
    expect(page.lastElementChild?.tagName).toBe("ASIDE");
  });
});
