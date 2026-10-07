import { describe, expect, it } from "vitest";

import { DASHBOARD_FIXTURE_NOW, DASHBOARD_FIXTURE_ROWS } from "@/dev/fixtures/gallery-dashboard";
import { LABS } from "@/lib/models/registry";

import {
  CSV_HEADER,
  audienceCounts,
  averageSessions,
  buildCsv,
  csvCell,
  dashboardCounts,
  engagementTitle,
  filterDashboardRows,
  modelNamesOf,
  pillText,
  shortDate,
  sortDashboardRows,
  sparkValues,
  sumOfPrompts,
} from "./dashboardModel";

const rows = DASHBOARD_FIXTURE_ROWS;
const titles = (list: typeof rows) => list.map((row) => row.title);

describe("buildCsv", () => {
  it("starts with the header row and ends each line with CRLF", () => {
    const csv = buildCsv([]);
    expect(csv).toBe(`${CSV_HEADER.join(",")}\r\n`);
    expect(CSV_HEADER.join(",")).toBe("Title,Maker,Models,Sessions,Prompts,AI turns,Engagement,Last activity");
  });

  it("writes one line per row: title, maker, models, figures, last activity", () => {
    const [, line] = buildCsv([rows[1]]).split("\r\n");
    expect(line).toBe(
      'Pull request reviewer for small teams,kofi,Opus 5.5; Sonnet 5.5; DeepSeek V4 Pro,4,24,102,52,Oct 4 — Reproduced on Opus 5.5',
    );
  });

  it("quotes commas, quotes and line breaks, and doubles the quotes", () => {
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(7)).toBe("7");
  });

  it("defuses a title a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+1 trick")).toBe("'+1 trick");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("plain")).toBe("plain");
  });
});

describe("sortDashboardRows", () => {
  it("sorts by engagement, largest first, by default", () => {
    expect(titles(sortDashboardRows(rows, "engagement")).slice(0, 2)).toEqual([
      "CV tailored to a job ad",
      "Pull request reviewer for small teams",
    ]);
  });

  it("sorts by prompts, sessions, AI turns and models", () => {
    expect(sortDashboardRows(rows, "prompts")[0].title).toBe("Tenancy agreement checker");
    expect(sortDashboardRows(rows, "sessions")[0].title).toBe("Tenancy agreement checker");
    expect(sortDashboardRows(rows, "turns")[0].title).toBe("Tenancy agreement checker");
    expect(sortDashboardRows(rows, "models")[0].modelsUsed.length).toBe(3);
  });

  it("sorts by last activity, newest first, and by name A to Z", () => {
    expect(sortDashboardRows(rows, "activity")[0].title).toBe("CV tailored to a job ad");
    expect(titles(sortDashboardRows(rows, "name"))).toEqual([...titles(rows)].sort((a, b) => a.localeCompare(b)));
  });

  it("does not change the rows it was given", () => {
    const before = titles(rows);
    sortDashboardRows(rows, "prompts");
    expect(titles(rows)).toEqual(before);
  });
});

describe("filterDashboardRows", () => {
  const filter = (filters: Parameters<typeof filterDashboardRows>[1]) =>
    filterDashboardRows(rows, filters, DASHBOARD_FIXTURE_NOW);

  it("keeps the builds that used a lab's models", () => {
    expect(titles(filter({ lab: "Google" })).sort()).toEqual(
      ["Inbox triage for a small shop", "Monthly budget from a bank export", "Recipe scaler with shopping list"].sort(),
    );
  });

  it("keeps the builds made with one model version", () => {
    expect(titles(filter({ model: "deepseek-v4-pro" }))).toEqual(["Pull request reviewer for small teams"]);
  });

  it("keeps builds built over 3+ sessions", () => {
    const multi = filter({ report: "multi" });
    expect(multi.length).toBeGreaterThan(0);
    expect(multi.every((row) => row.sessionCount >= 3)).toBe(true);
  });

  it("keeps builds active inside the window", () => {
    expect(titles(filter({ active: 7 }))).toEqual([
      "CV tailored to a job ad",
      "Pull request reviewer for small teams",
      "Photo renamer by date taken",
    ]);
    expect(filter({ report: "month" })).toHaveLength(6);
  });

  it("searches title, maker, audience and models", () => {
    expect(titles(filter({ q: "KOFI" })).sort()).toContain("Pull request reviewer for small teams");
    expect(titles(filter({ q: "teachers" }))).toEqual(["Lesson plan from a curriculum objective"]);
    expect(filter({ q: "zzzz" })).toEqual([]);
  });
});

describe("the sidebar's counts", () => {
  const counts = dashboardCounts(rows, LABS, DASHBOARD_FIXTURE_NOW);

  it("counts builds and distinct makers", () => {
    expect(counts.builds).toBe(10);
    expect(counts.makers).toBe(10);
  });

  it("counts the builds that used any of a lab's models", () => {
    expect(counts.byLab.Anthropic).toBe(7);
    expect(counts.byLab.Google).toBe(3);
    expect(counts.byLab.xAI).toBe(1);
  });

  it("counts the two reporting toggles", () => {
    expect(counts.activeThisMonth).toBe(6);
    expect(counts.multiSession).toBe(5);
  });

  it("counts audiences, most builds first", () => {
    expect(audienceCounts(rows)[0]).toEqual({ value: "Developers", count: 1 });
  });
});

describe("cells and the footer", () => {
  it("merges model spellings and keeps first-seen order", () => {
    expect(modelNamesOf({ modelsUsed: ["claude-sonnet-5-5", "Sonnet 5.5", "my-local-llm "] })).toEqual(["Sonnet 5.5", "my-local-llm"]);
  });

  it("dates in UTC as Oct 5, and a dash for none", () => {
    expect(shortDate("2026-10-05T23:30:00Z")).toBe("Oct 5");
    expect(shortDate("")).toBe("—");
  });

  it("scales the sparkline by the row's highest week, never less than 2", () => {
    expect(sparkValues([0, 1, 4])).toEqual([0, 0.25, 1]);
    expect(sparkValues([0, 1, 0])).toEqual([0, 0.5, 0]);
    expect(sparkValues([0, 0])).toEqual([0, 0]);
  });

  it("spells the engagement title", () => {
    expect(engagementTitle({ runs: 3, rebuilds: 2, comments: 1, saves: 0, total: 6 })).toBe(
      "3 runs · 2 rebuilds · 1 comments · 0 saves",
    );
  });

  it("sums prompts and averages sessions to one decimal", () => {
    expect(sumOfPrompts(rows)).toBe(164);
    expect(averageSessions(rows)).toBe("2.9");
    expect(averageSessions([])).toBe("0.0");
  });

  it("words the pill", () => {
    expect(pillText("opus-5-5", null)).toBe("Made with Opus 5.5");
    expect(pillText(null, "Google")).toBe("Google models");
    expect(pillText(null, null)).toBe("All models");
  });
});
