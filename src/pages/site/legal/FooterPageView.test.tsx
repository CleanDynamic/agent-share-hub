// TB-02: the footer pages' view, from the three real texts.
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { contact } from "@/content/legal/contact";
import { report } from "@/content/legal/report";
import { rules } from "@/content/legal/rules";
import { terms } from "@/content/legal/terms";
import type { LegalSection, LegalText } from "@/content/legal/types";
import { REPORT_NOTE_MAX, REPORT_REASONS } from "@/lib/moderation/reports";

import { FooterPageView, subtitleOf } from "./FooterPageView";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

const pages: Array<[string, LegalText, string]> = [
  ["rules", rules, "/rules"],
  ["report", report, "/report"],
  ["contact", contact, "/contact"],
];

const view = (text: LegalText, path: string) =>
  render(
    <MemoryRouter>
      <FooterPageView text={text} path={path} />
    </MemoryRouter>,
  );

describe("subtitleOf", () => {
  const section = (blocks: LegalSection["blocks"], source?: "terms" | "code"): LegalSection => ({ id: "x", heading: "X", source, blocks });
  it("counts a list's rules", () => expect(subtitleOf(section([{ kind: "list", items: ["a", "b", "c"] }]))).toBe("3 rules · Please don't"));
  it("counts a table's reasons", () => expect(subtitleOf(section([{ kind: "table", head: ["a", "b"], rows: [["1", "2"], ["3", "4"]] }]))).toBe("2 reasons"));
  it("says how the site works for code", () => expect(subtitleOf(section([{ kind: "p", text: "t" }], "code"))).toBe("How the site works"));
  it("says from the Terms for terms or no source", () => {
    expect(subtitleOf(section([{ kind: "p", text: "t" }], "terms"))).toBe("From the Terms");
    expect(subtitleOf(section([{ kind: "p", text: "t" }]))).toBe("From the Terms");
  });
});

describe.each(pages)("%s page", (_name, text, path) => {
  it("has one h1 and each section as a region named by its h2, in order", () => {
    view(text, path);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: text.title })).toBeInTheDocument();
    const main = within(screen.getByTestId("footer-main"));
    expect(main.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(text.sections.map((s) => s.heading));
    for (const section of text.sections) expect(screen.getByRole("region", { name: section.heading })).toHaveAttribute("id", section.id);
  });

  it("gives every card a subtitle", () => {
    view(text, path);
    for (const section of text.sections) expect(screen.getAllByText(subtitleOf(section)).length).toBeGreaterThan(0);
  });

  it("side: one link per section, Related without this page and in order, draft tag while not reviewed", () => {
    view(text, path);
    const nav = within(screen.getByRole("navigation", { name: "In this page" }));
    expect(nav.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(text.sections.map((s) => `#${s.id}`));
    const related = within(screen.getByRole("navigation", { name: "Related pages" }));
    const all = ["/rules", "/report", "/contact", "/terms", "/privacy"];
    expect(related.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(all.filter((href) => href !== path));
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("shows no draft tag once reviewed", () => {
    view({ ...text, reviewed: true }, path);
    expect(screen.queryByText("draft")).toBeNull();
    expect(screen.queryByText("Not reviewed yet")).toBeNull();
  });
});

describe("rules", () => {
  it("draws ten list rows numbered 01 to 10 with hidden tags, matching the Terms", () => {
    view(rules, "/rules");
    const rows = within(screen.getByTestId("footer-list")).getAllByRole("listitem");
    expect(rows).toHaveLength(10);
    const tags = screen.getAllByTestId("footer-number");
    expect(tags.map((tag) => tag.textContent)).toEqual(Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0")));
    for (const tag of tags) expect(tag).toHaveAttribute("aria-hidden", "true");
    const termsList = terms.sections.find((s) => s.id === "what-you-must-not-do")!.blocks.find((b) => b.kind === "list") as { items: string[] };
    expect(rows.map((row) => row.textContent!.slice(2))).toEqual(termsList.items);
  });

  it("links Report a problem to /report", () => {
    view(rules, "/rules");
    const inText = within(screen.getByRole("region", { name: "If a rule is broken" })).getByRole("link", { name: "Report a problem" });
    expect(inText).toHaveAttribute("href", "/report");
  });
});

describe("report", () => {
  it("has one table row per reason, in order, and the note limit", () => {
    view(report, "/report");
    const rows = within(screen.getByRole("table", { name: "Report reasons" })).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(REPORT_REASONS.map((x) => x.label));
    expect(screen.getByText(new RegExp(`up to ${REPORT_NOTE_MAX} characters`))).toBeInTheDocument();
  });

  it("highlights placeholders and links Settings", () => {
    const { container } = view(report, "/report");
    expect(container.querySelectorAll("mark[data-need]").length).toBe(REPORT_REASONS.length + 1);
    expect(within(screen.getByRole("region", { name: "Block someone" })).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });
});

describe("a sixth reason", () => {
  it("appears in the table", async () => {
    vi.resetModules();
    vi.doMock("@/lib/moderation/reports", async (original) => {
      const real = await original<typeof import("@/lib/moderation/reports")>();
      return { ...real, REPORT_REASONS: [...real.REPORT_REASONS, { value: "other", label: "Sixth" }] };
    });
    const { report: fresh } = await import("@/content/legal/report");
    const table = fresh.sections[0].blocks.find((b) => b.kind === "table") as { rows: string[][] };
    expect(table.rows).toHaveLength(6);
    expect(table.rows[5][0]).toBe("Sixth");
    vi.doUnmock("@/lib/moderation/reports");
  });
});

describe("contact", () => {
  it("links Settings, the Privacy policy anchor and Report a problem", () => {
    view(contact, "/contact");
    const data = within(screen.getByRole("region", { name: "Your data" }));
    expect(data.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(data.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy#your-rights");
    expect(within(screen.getByRole("region", { name: "Reporting content" })).getByRole("link", { name: "Report a problem" })).toHaveAttribute("href", "/report");
  });
});
