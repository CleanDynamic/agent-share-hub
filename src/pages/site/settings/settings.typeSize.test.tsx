// Q4 of the type prompt: a section's title is a section heading (14 / 500) under the page's "Settings" on a desktop, and
// the page's title (20 / 500) on a phone, where the section is a page of its own.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/shell/useMinWidth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => phone.on,
}));

import { SectionPage } from "./SettingParts";

describe("a settings section's title", () => {
  it("is an h2 at 14 / 500 on a desktop", () => {
    phone.on = false;
    render(<SectionPage title="Account">x</SectionPage>);
    const heading = screen.getByRole("heading", { level: 2, name: "Account" });
    expect(heading.style.fontSize).toBe("14px");
    expect(heading.style.fontWeight).toBe("500");
  });

  it("is the page's h1 at 20 / 500 on a phone", () => {
    phone.on = true;
    render(<SectionPage title="Account">x</SectionPage>);
    const heading = screen.getByRole("heading", { level: 1, name: "Account" });
    expect(heading.style.fontSize).toBe("20px");
    expect(heading.style.fontWeight).toBe("500");
  });
});
