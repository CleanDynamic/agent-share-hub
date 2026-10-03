import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FrameRoute } from "./FrameRoute";

const at = (path: string, hold?: boolean) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FrameRoute site={<p>new</p>} legacy={<p>old</p>} hold={hold} />
    </MemoryRouter>,
  );

describe("FrameRoute", () => {
  it("UI-P41: always renders the site page", () => {
    at("/notifications");
    expect(screen.getByText("new")).toBeTruthy();
    expect(screen.queryByText("old")).toBeNull();
  });

  it("ignores the legacy prop", () => {
    at("/");
    expect(screen.getByText("new")).toBeTruthy();
    expect(screen.queryByText("old")).toBeNull();
  });

  it("ignores the hold prop", () => {
    const { container } = at("/login", true);
    expect(screen.getByText("new")).toBeTruthy();
    expect(container.textContent).toContain("new");
  });
});
