import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { helpersOf } from "@/lib/build/helpers";

import { HelperChips, ShapeChip, TraceLink } from "./RuntimeChips";

afterEach(() => cleanup());

describe("runtime chips (CA-13 P5 to P7)", () => {
  it("draws one chip per helper, with a quiet second line only when it did something", () => {
    const helpers = helpersOf([
      { provider: "scaledown", job: "summarize", trigger: { at: 0.8 }, did: { times: 6, source: "run" } },
      { provider: "scaledown", job: "extract", fields: ["order_id", "issue_type"] },
      { provider: "scaledown", job: "classify", labels: ["looping"], stopAt: 0.8, did: { times: 1, stopped: { label: "looping", score: 0.86 }, source: "run" } },
    ]);
    render(<HelperChips helpers={helpers} />);
    expect(screen.getAllByTestId("helper-chip").map((chip) => chip.getAttribute("data-job"))).toEqual(["summarize", "extract", "classify"]);
    expect(screen.getByText("Summarize at 80%")).toBeTruthy();
    expect(screen.getByText("Extract order_id, issue_type")).toBeTruthy();
    expect(screen.getByText("Stop if looping")).toBeTruthy();
    expect(screen.getAllByTestId("helper-did").map((n) => n.textContent)).toEqual(["6 times", "stopped once, looping 0.86"]);
  });

  it("draws nothing for an agent with no helpers", () => {
    const { container } = render(<HelperChips helpers={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("names the shape from the schema's title", () => {
    render(<ShapeChip shape={{ how: "json-schema", schema: JSON.stringify({ title: "Order" }) }} />);
    expect(screen.getByTestId("shape-chip").textContent).toBe("Returns JSON · Order");
  });

  it("opens a trace in a new tab, naming LangSmith or the domain", () => {
    const { rerender } = render(<TraceLink url="https://smith.langchain.com/o/1" />);
    const link = screen.getByTestId("trace-link") as HTMLAnchorElement;
    expect(link.textContent).toBe("Trace · LangSmith");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    rerender(<TraceLink url="https://www.example.com/t" />);
    expect(screen.getByTestId("trace-link").textContent).toBe("Trace · example.com");
  });
});
