import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/shell/flags", () => ({ useSiteFrameFlag: () => flag.on }));

import { FrameRoute } from "./FrameRoute";

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FrameRoute site={<p>new</p>} legacy={<p>old</p>} />
    </MemoryRouter>,
  );

describe("FrameRoute", () => {
  beforeEach(() => {
    flag.on = false;
  });

  it("renders the legacy page when the flag is off", () => {
    at("/notifications");
    expect(screen.getByText("old")).toBeTruthy();
  });

  it("renders the legacy page on a route not in SITE_FRAME_ROUTES, flag on", () => {
    flag.on = true;
    at("/bounties");
    expect(screen.getByText("old")).toBeTruthy();
  });

  it("renders the new page when the flag is on and the route is listed", () => {
    flag.on = true;
    at("/notifications");
    expect(screen.getByText("new")).toBeTruthy();
  });
});
