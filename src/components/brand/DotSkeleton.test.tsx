import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DotSkeleton } from "./DotSkeleton";

describe("DotSkeleton", () => {
  it("renders the real tree hidden (opacity 0, still laid out) under an aria-hidden field", () => {
    const { getByTestId, getByText } = render(
      <DotSkeleton>
        <p>One line of the real layout</p>
      </DotSkeleton>,
    );
    const field = getByTestId("dot-skeleton");
    expect(field.getAttribute("aria-hidden")).toBe("true");
    expect(getByText("One line of the real layout").parentElement?.style.opacity).toBe("0");
  });

  it("marks itself gone when the data has arrived", () => {
    const { getByTestId } = render(
      <DotSkeleton gone>
        <p>x</p>
      </DotSkeleton>,
    );
    expect(getByTestId("dot-skeleton").hasAttribute("data-gone")).toBe(true);
  });
});
