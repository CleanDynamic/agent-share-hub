// UI-P46 — Drafts: continue editing, and the sessions waiting to join a build.
//
// THE BACKEND IS FAKED (see support/fakeBackend.ts). builds answers the
// creator's drafts and their session counts; import_sessions answers the
// waiting sessions and records the claim; content_items and content_blocks are
// answered too, but only so that the spec can assert nothing asked.

import { expect, test, type Page, type Request } from "@playwright/test";
import { ME } from "../audit/support/harness";
import { fakeBoundaries, json, uuid, type Row } from "./support/fakeBackend";

const DRAFT = (n: number, title: string, minutesAgo: number): Row => ({
  id: uuid(n),
  creator_id: ME.id,
  slug: `draft-${n}`,
  title,
  outcome: null,
  shape: "workflow",
  status: "draft",
  made_for: [],
  made_with: [],
  completeness: 10,
  reproduction_count: 0,
  parent_build_id: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  published_at: null,
  session_count: 0,
});

const DRAFTS = [
  { ...DRAFT(1, "Photo renamer by date taken", 17), session_count: 2 },
  { ...DRAFT(2, "Untitled build", 2 * 1440), session_count: 1 },
  { ...DRAFT(3, "Inbox triage v2", 3 * 1440), session_count: 0 },
  { ...DRAFT(4, "First MCP test", 12 * 1440), session_count: 1 },
];

const SESSION = (n: number, prompt: string, model: string, createdAt: string): Row => ({
  id: uuid(100 + n),
  client: "claude",
  model,
  target_build_id: null,
  build_id: null,
  created_at: createdAt,
  first_prompt: prompt,
  user_turns: 3,
  assistant_turns: 3,
  status: "parsed",
});

const SESSIONS = [
  SESSION(1, "Every morning at 7, sort my Gmail into Clients, Admin, Newsletters or Ignore.", "gpt-6-astra", "2026-10-02T09:00:00.000Z"),
  SESSION(2, "The n8n workflow fails on the Outlook trigger. Why?", "gpt-6-astra", "2026-10-02T08:00:00.000Z"),
  SESSION(3, "Make the triage rules editable from a Google Sheet.", "gpt-6-1-sol", "2026-10-01T09:00:00.000Z"),
  SESSION(4, "Explain this contract clause like I am 12.", "claude-opus-5-5", "2026-09-14T09:00:00.000Z"),
];

const PROPOSAL = {
  events: [],
  nodes: [],
  warnings: [],
  summary: { session_id: "s", proposed_title: null, user_turn_count: 3, assistant_turn_count: 3 },
};

interface Backend {
  /** Every PATCH to import_sessions, as sent. */
  claims: Request[];
  /** Every request to the older post tables. */
  contentRequests: string[];
}

async function fakeBackend(page: Page, { signedIn = true }: { signedIn?: boolean } = {}): Promise<Backend> {
  const backend: Backend = { claims: [], contentRequests: [] };
  await fakeBoundaries(page, { signedIn });

  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const request = route.request();
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    const url = decodeURIComponent(request.url());
    const one = url.match(/[?&]id=eq\.([^&]+)/)?.[1];
    if (one) return json(route, DRAFTS.filter((row) => row.id === one));
    const many = url.match(/[?&]id=in\.\(([^)]*)\)/)?.[1]?.split(",");
    if (many) return json(route, DRAFTS.filter((row) => many.includes(String(row.id))).map((row) => ({ id: row.id, session_count: row.session_count })));
    return json(route, DRAFTS);
  });

  await page.route(/\/rest\/v1\/import_sessions/, (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      backend.claims.push(request);
      return json(route, [{ id: uuid(101), client: "claude", reader_id: null }]);
    }
    const url = decodeURIComponent(request.url());
    if (url.includes("select=proposal")) return json(route, [{ proposal: PROPOSAL }]);
    if (url.includes("select=id,status,build_id")) return json(route, [{ id: uuid(101), status: "parsed", build_id: null }]);
    if (url.includes("status=in.(parsed,claimed)")) return json(route, SESSIONS);
    return json(route, SESSIONS);
  });

  for (const table of ["content_items", "content_blocks"]) {
    await page.route(new RegExp(`/rest/v1/${table}`), (route) => {
      backend.contentRequests.push(route.request().url());
      return json(route, []);
    });
  }
  return backend;
}

const draftRows = (page: Page) => page.getByTestId("draft-row");
const sessionRows = (page: Page) => page.getByTestId("session-row");

test("both lists render, and nothing asks for the older post tables", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/drafts");

  await expect(page.getByRole("heading", { name: "Drafts", level: 1 })).toBeVisible();
  await expect(draftRows(page)).toHaveCount(4);
  await expect(draftRows(page).first()).toContainText("Photo renamer by date taken");
  await expect(draftRows(page).first()).toContainText("2 sessions");
  await expect(draftRows(page).nth(2)).toContainText("No sessions");
  await expect(sessionRows(page)).toHaveCount(4);
  await expect(sessionRows(page).first()).toContainText("Every morning at 7");
  await expect(page.getByRole("link", { name: "Older post drafts" })).toHaveAttribute("href", "/drafts/posts");

  expect(backend.contentRequests).toEqual([]);
});

test("the + menu → Add to Photo renamer by date taken sends the claim and shows the toast", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the desktop + opens a dropdown; the phone's sheet has its own test");
  const backend = await fakeBackend(page);
  await page.goto("/drafts");

  await expect(sessionRows(page)).toHaveCount(4);
  await page.getByRole("button", { name: /^Add “Every morning at 7/ }).click();
  await page.getByRole("menuitem", { name: "Add to Photo renamer by date taken" }).click();

  await expect(page.getByText("Added to Photo renamer by date taken.")).toBeVisible();
  const claim = backend.claims.find((request) => (request.postDataJSON() as Row).status === "claimed");
  expect(claim?.postDataJSON()).toMatchObject({ status: "claimed", build_id: uuid(1) });
});

test("on the phone the + opens the sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch only");
  const backend = await fakeBackend(page);
  await page.goto("/drafts");

  await expect(sessionRows(page)).toHaveCount(4);
  await page.getByRole("button", { name: /^Add “Every morning at 7/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add to a build" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Start a new build" })).toBeVisible();
  await sheet.getByRole("button", { name: "Add to Photo renamer by date taken" }).click();

  await expect(page.getByText("Added to Photo renamer by date taken.")).toBeVisible();
  expect(backend.claims.some((request) => (request.postDataJSON() as Row).build_id === uuid(1))).toBe(true);
});

test("signed out goes to sign in", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await page.goto("/drafts");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdrafts/);
});
