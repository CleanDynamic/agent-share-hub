// G25: the family's counts are drawn only once the family has loaded: never "0 builds · 0 generations" while it loads or
// after it failed.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { FamilyPanel } from "./FamilyPanel";

const draw = (props: Partial<Parameters<typeof FamilyPanel>[0]>) =>
  render(
    <MemoryRouter>
      <FamilyPanel root={null} onSelect={() => undefined} {...props} />
    </MemoryRouter>,
  );

describe("the family's counts (G25)", () => {
  it("are not drawn while the family loads", () => {
    draw({ loading: true });
    expect(screen.getByTestId("family-panel").textContent).not.toMatch(/\d+ builds?|\d+ generations?/);
  });

  it("are not drawn after the family failed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    draw({ failure: { onRetry: () => undefined, error: { message: "boom" } } });
    expect(screen.getByTestId("family-panel").textContent).not.toMatch(/\d+ builds?|\d+ generations?/);
  });

  it("are drawn once it has loaded", () => {
    draw({ root: { id: "b1", parentId: null, depth: 0, slug: "b1", title: "Bakery", maker: null, publishedAt: null, reproductionCount: 0, rebuildNote: null, works: null, children: [] } as never });
    expect(screen.getByTestId("family-panel").textContent).toMatch(/1 build · 1 generation/);
  });
});
