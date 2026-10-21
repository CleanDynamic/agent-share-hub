import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Certainty } from "./Certainty";

afterEach(() => cleanup());

describe("Certainty (CA-13 P4)", () => {
  it("closed: the answer, '92% sure', a 48 by 4 bar, and a sentence for a screen reader", () => {
    render(<Certainty answer="billing" share={0.92} source="run" probabilities={{ billing: 0.92, support: 0.08 }} />);
    expect(screen.getByText("billing")).toBeTruthy();
    expect(screen.getByTestId("certainty-words").textContent).toBe("92% sure");
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("billing, 92 percent sure, from the run");
    expect(screen.getByText("From the run")).toBeTruthy();
  });

  it("reads 54% as 'unsure (54%)' and never in an alarm colour", () => {
    render(<Certainty answer="billing" share={0.54} />);
    const words = screen.getByTestId("certainty-words");
    expect(words.textContent).toBe("unsure (54%)");
    expect(words.getAttribute("data-unsure")).toBe("true");
    expect(document.body.innerHTML).not.toMatch(/--cat-breakage|red|amber/);
  });

  it("opened: every option with its share, high to low, the chosen one marked", () => {
    render(<Certainty answer="billing" share={0.92} source="maker" probabilities={{ support: 0.05, billing: 0.92, kitchen: 0.03 }} />);
    expect(screen.queryByRole("list")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show every option" }));
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["billing92%", "support5%", "kitchen3%"]);
    expect(rows[0].getAttribute("data-chosen")).toBe("true");
    expect(screen.getByText("Maker's figure")).toBeTruthy();
  });
});
