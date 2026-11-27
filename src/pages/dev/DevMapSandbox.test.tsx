import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { MAP_SANDBOX_NAMES } from "@/dev/fixtures/mapSandbox";

import DevMapSandbox, { DEV_MAP_SANDBOX_COPY } from "./DevMapSandbox";

const open = (url: string) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <DevMapSandbox />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("/dev/map-sandbox", () => {
  it.each(MAP_SANDBOX_NAMES)("opens on %s", (name) => {
    const { unmount } = open(`/dev/map-sandbox?fixture=${name}`);
    expect((screen.getByTestId("map-sandbox-fixture") as HTMLSelectElement).value).toBe(name);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    unmount();
  });

  it("opens on the support inbox, with its links as sentences and no stored layout", () => {
    open("/dev/map-sandbox");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("9 tiles in 3 sessions, 7 links");
    expect(within(screen.getByTestId("map-sandbox-links")).getByText("Check 6 tests Code 5")).toBeTruthy();
    expect(screen.getByText(DEV_MAP_SANDBOX_COPY.noLayout)).toBeTruthy();
  });

  it("shows the stored layout a fixture has, and a fixture with no links says so", () => {
    const { unmount } = open("/dev/map-sandbox?fixture=removedTile");
    expect(screen.getByTestId("map-sandbox-layout").textContent).toContain('"q-gone"');
    unmount();
    open("/dev/map-sandbox?fixture=noUses");
    expect(screen.getByText(DEV_MAP_SANDBOX_COPY.noLinks)).toBeTruthy();
  });

  it("reads an unknown fixture as the support inbox", () => {
    open("/dev/map-sandbox?fixture=nope");
    expect((screen.getByTestId("map-sandbox-fixture") as HTMLSelectElement).value).toBe("supportInbox");
  });
});
