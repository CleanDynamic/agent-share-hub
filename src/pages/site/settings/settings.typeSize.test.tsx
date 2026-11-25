// Q4 of the type prompt: a section's title is the page's h1, read aloud and not drawn: on a desktop the chosen row names it, and on a
// phone the top bar carries its name (mobile prompt 27).

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/shell/useMinWidth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => phone.on,
}));

import { SectionPage } from "./SettingParts";

describe("a settings section's title", () => {
  it("is the page's h1, visually hidden, on a desktop (Synth 13: the chosen row names it)", () => {
    phone.on = false;
    render(<MemoryRouter><SectionPage title="Account">x</SectionPage></MemoryRouter>);
    const heading = screen.getByRole("heading", { level: 1, name: "Account" });
    expect(heading.className).toBe("sr-only");
  });

  it("is the page's h1, visually hidden, on a phone too: the top bar shows the name and carries Back (mobile prompt 27)", () => {
    phone.on = true;
    render(<MemoryRouter><SectionPage title="Account">x</SectionPage></MemoryRouter>);
    const heading = screen.getByRole("heading", { level: 1, name: "Account" });
    expect(heading.className).toBe("sr-only");
    expect(screen.queryByRole("link", { name: "Back to settings" })).toBeNull();
  });
});
