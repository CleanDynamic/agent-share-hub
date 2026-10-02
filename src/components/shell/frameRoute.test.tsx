import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: false, known: true }));
vi.mock("@/lib/shell/flags", () => ({ useSiteFrameFlag: () => flag.on, useSiteFrameKnown: () => flag.known }));

import { FrameRoute } from "./FrameRoute";

const at = (path: string, hold?: boolean) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FrameRoute site={<p>new</p>} legacy={<p>old</p>} hold={hold} />
    </MemoryRouter>,
  );

describe("FrameRoute", () => {
  beforeEach(() => {
    flag.on = false;
    flag.known = true;
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

  describe("hold (UI-P36)", () => {
    it("renders neither page while the flag is unknown, so a page that spends a token on mount is never mounted twice", () => {
      flag.known = false;
      const { container } = at("/login", true);
      expect(container.textContent).toBe("");
    });

    it("renders the site page once the flag is known and on, on a listed route", () => {
      flag.known = true;
      flag.on = true;
      at("/reset-password", true);
      expect(screen.getByText("new")).toBeTruthy();
    });

    it("renders the legacy page once the flag is known and off", () => {
      flag.known = true;
      flag.on = false;
      at("/reset-password", true);
      expect(screen.getByText("old")).toBeTruthy();
    });

    it("does not hold a route that did not ask: the legacy page shows while the flag is unknown", () => {
      flag.known = false;
      at("/login");
      expect(screen.getByText("old")).toBeTruthy();
    });
  });
});
