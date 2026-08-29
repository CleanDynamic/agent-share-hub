// Tier 3 — marking a part unsolved and putting a bounty on it at publish
// (NS-P51).
//
// THE TWO CLAIMS, and they are the two the handover names:
//
//   1. toggle → publish with a reward → a bounties row exists carrying the
//      RIGHT gap_node_id. A bounty filed against the wrong node is a question
//      nobody can answer, and it looks identical on every screen to one filed
//      against the right one.
//   2. "Publish without bounties" creates none, and the build still goes live.
//
// WHAT A BROWSER CAN AND CANNOT SAY ABOUT CLAIM 1. It cannot read the table.
// What it can do is watch the insert leave — the POST to /rest/v1/bounties and
// the body it carries — and then watch the workspace's own re-read paint a
// bounty pill on that node's row, which only happens if a row came back for it.
// Those two together are the join a unit test cannot reach: the unit cover in
// src/components/compose/BountySection.test.tsx proves the arguments, and this
// proves they became a row. The SQL half — the constraint that the gap_node_id
// is a gap of that build, and the unique index that stops a second bounty on it
// — is the database's, and is exercised by scripts/verify-bounty-flow.ts.
//
// THIS SPEC WRITES, AND IT CONSUMES WHAT IT IS GIVEN. It publishes builds and
// files bounties, so it is pointed at a DEV project and at DRAFTS THAT ARE
// EXPECTED NOT TO SURVIVE IT: after a run each named draft is published and one
// of its gaps carries an ask, so the same ids cannot be reused for a second
// run. It skips unless every one of these is set, so it cannot be pointed
// anywhere by accident:
//
//   E2E_COMPOSE_EMAIL      a user in that project
//   E2E_COMPOSE_PASSWORD
//   E2E_COMPOSE_DRAFT_A    a fresh publishable draft that user owns
//   E2E_COMPOSE_DRAFT_B    a second one, for the second test
//   E2E_COMPOSE_GAP_TITLE  the title of a node in both, to mark unsolved
//
// WHAT THE SEEDED DRAFT HAS TO BE. Publishable WITHOUT the node this spec is
// about to mark: an outcome, one instruction-category node and one
// evidence-category node, plus a third node carrying E2E_COMPOSE_GAP_TITLE.
// A gap is an admitted hole and does not count towards the record, so marking
// one of only two nodes unsolved would take the build back below the publish
// gate and this spec would be testing the gate instead.
//
// TWO DRAFTS RATHER THAN ONE, so the two tests are independent and runnable in
// any order, as the e2e skill requires. A second publish of the build the first
// test used would find its gap already spoken for and go green having filed
// nothing, which is the shape of a vacuous pass.
//
// WHAT IS ANSWERED IN THE UNIT SUITE INSTEAD. That a node marked unsolved
// keeps its type and renders red in the tree — NodeTree.test.tsx and
// Inspector.test.tsx — because both depend on a precedence between
// treatments that a browser can only reach by clicking a second row chosen
// arbitrarily. This spec is the publish path.
//
// Selectors are the testids NS-P51 introduced — gap-toggle, gap-problem,
// bounty-section, bounty-reward-input, bounty-skip — and roles and placeholders
// everywhere else. Nothing here selects on a class: see the e2e skill.

import { expect, test, type Page, type Request } from "@playwright/test";

const EMAIL = process.env.E2E_COMPOSE_EMAIL ?? "";
const PASSWORD = process.env.E2E_COMPOSE_PASSWORD ?? "";
const DRAFT_A = process.env.E2E_COMPOSE_DRAFT_A ?? "";
const DRAFT_B = process.env.E2E_COMPOSE_DRAFT_B ?? "";
const GAP_TITLE = process.env.E2E_COMPOSE_GAP_TITLE ?? "";

const NEEDS_SEED =
  "Set E2E_COMPOSE_EMAIL, E2E_COMPOSE_PASSWORD, E2E_COMPOSE_DRAFT_A, " +
  "E2E_COMPOSE_DRAFT_B and E2E_COMPOSE_GAP_TITLE. Both drafts are published " +
  "by this spec and cannot be reused, so point it at a DEV project.";

/** The insert a filed bounty is. */
const BOUNTIES_INSERT = /\/rest\/v1\/bounties(\?|$)/;

/** Escape a seeded title so it can be matched as itself, not as a pattern. */
function literal(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/**
 * Sign in through the login form.
 *
 * Through the UI, once per test, which is exactly what the e2e skill tells you
 * not to do — and it says to reuse a saved storage state instead. There is no
 * auth setup project in this repository to save one (the config declares the
 * project; no *.setup.ts exists yet), and inventing the whole fixture inside a
 * spec that skips by default would be the larger mistake. Whoever adds the
 * fixture should delete this helper and put `test.use({ storageState })` here.
 */
async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email or username").fill(EMAIL);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The form navigates on success; a wrong credential leaves it standing.
  await expect(page.getByPlaceholder("Enter your password")).toHaveCount(0, {
    timeout: 20_000,
  });
}

/** Open a draft's workspace and wait for the frame that means it loaded. */
async function openCompose(page: Page, buildId: string): Promise<void> {
  await page.goto(`/compose/${buildId}`);
  await expect(page.locator('[data-visual-slot="compose-frame"]')).toBeVisible();
  await expect(page.locator('[data-visual-slot="compose-node-tree"]')).toBeVisible();
}

/**
 * Mark the seeded node unsolved, and say what is wrong with it.
 *
 * Returns the node's id, which is what claim 1 is about. It is read off the
 * row's own data-node-id rather than passed in through the environment: an id
 * a spec was told is easier to get wrong than one it looked up.
 */
async function markUnsolved(page: Page, problem: string): Promise<string> {
  const row = page.locator("[data-node-id]").filter({ hasText: GAP_TITLE }).first();
  await expect(row).toBeVisible();
  const nodeId = await row.getAttribute("data-node-id");
  expect(nodeId).toBeTruthy();

  await row.getByRole("button", { name: literal(GAP_TITLE) }).click();

  const toggle = page.getByTestId("gap-toggle");
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // The waiter is registered BEFORE the click that causes the write. The node
  // writer debounces 600ms, and a listener attached after the fact can miss the
  // response it is waiting for and then wait out its whole timeout.
  //
  // Waiting for the flag's write specifically, rather than for a settle, is the
  // point: createBountyForGap reads is_gap from the DATABASE, so an ask filed
  // before this landed would be refused for a reason that has nothing to do
  // with what this spec is testing.
  const flagWritten = nodeWrite(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await flagWritten;

  // The problem statement is payload.gap_problem, and its field only exists
  // once the flag is on.
  const problemWritten = nodeWrite(page);
  await page.getByTestId("gap-problem").fill(problem);
  await problemWritten;

  // THE RED ACCENT IS NOT ASSERTED HERE, and deliberately. The row is selected
  // — this helper just clicked it — and the selected treatment wins over the
  // gap treatment by design, because a creator needs to see which row they
  // clicked more than they need the flag repeated back at them. Driving that
  // precedence from a browser means clicking a second row chosen by nothing in
  // particular; NodeTree.test.tsx drives it exactly, on both branches, and is
  // where acceptance 1's "renders red in the tree" is answered.

  return nodeId as string;
}

/** The next upsert of a node row: what a debounced inspector edit becomes. */
function nodeWrite(page: Page) {
  return page.waitForResponse(
    (response) =>
      /\/rest\/v1\/build_nodes/.test(response.url()) &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );
}

/** Open the publish sheet from the top bar pill. */
async function openSheet(page: Page) {
  await page.getByRole("button", { name: "Publish" }).first().click();
  const sheet = page.getByTestId("publish-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Every POST that filed a bounty, as its parsed body. */
function bountyInserts(requests: Request[]): Record<string, unknown>[] {
  return requests
    .filter((request) => request.method() === "POST" && BOUNTIES_INSERT.test(request.url()))
    .map((request) => {
      try {
        const parsed = JSON.parse(request.postData() ?? "null");
        return (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown>;
      } catch {
        return {};
      }
    });
}

test.describe("putting a bounty on a gap while publishing", () => {
  test.skip(!EMAIL || !PASSWORD || !DRAFT_A || !DRAFT_B || !GAP_TITLE, NEEDS_SEED);

  // CLAIM 1
  test("files a bounty on the node that was marked, with the reward that was typed", async ({
    page,
  }) => {
    const requests: Request[] = [];
    page.on("request", (request) => requests.push(request));

    await signIn(page);
    await openCompose(page, DRAFT_A);

    const nodeId = await markUnsolved(
      page,
      "Above 0.4 it invents citations. I never found a setting that holds.",
    );

    const sheet = await openSheet(page);
    const section = sheet.getByTestId("bounty-section");
    await expect(section).toBeVisible();
    await expect(section).toContainText("unsolved");

    await section.getByTestId("bounty-reward-input").first().fill("5");
    await page.getByTestId("publish-confirm").click();

    // Live first. Everything below happens to a build that is already public.
    await expect(page.getByText("It’s live.")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(() => bountyInserts(requests).length, { timeout: 20_000 })
      .toBe(1);

    const insert = bountyInserts(requests)[0];
    expect(insert.gap_node_id).toBe(nodeId);
    expect(Number(insert.reward_gbp)).toBe(5);
    expect(insert.status).toBe("open");

    // The row came back: the workspace re-read its bounties and the tree found
    // one for this node. This is the half that says a row exists rather than
    // that an insert was attempted.
    await expect(page.getByTestId("bounty-outcome")).toContainText(
      "One bounty is open on this build.",
    );
    await page.getByRole("button", { name: "Back to the workspace" }).click();
    await expect(
      page.locator(`[data-node-id="${nodeId}"]`).getByTestId("bounty-node-pill"),
    ).toBeVisible({ timeout: 20_000 });
  });

  // CLAIM 2
  test("files nothing when the creator publishes without bounties", async ({ page }) => {
    const requests: Request[] = [];
    page.on("request", (request) => requests.push(request));

    await signIn(page);
    await openCompose(page, DRAFT_B);

    const nodeId = await markUnsolved(page, "Still open, and deliberately unpriced.");

    const sheet = await openSheet(page);
    await expect(sheet.getByTestId("bounty-section")).toBeVisible();
    await sheet.getByTestId("bounty-skip").click();
    await expect(sheet.getByTestId("bounty-skip")).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("publish-confirm").click();

    // The build is live — the switch declines the asks, not the publish.
    await expect(page.getByText("It’s live.")).toBeVisible({ timeout: 30_000 });
    // And nothing was filed. Asserted after the confirmation rather than before
    // it, so the wait is for the whole path to have run rather than for a
    // fixed interval to have passed.
    expect(bountyInserts(requests)).toEqual([]);

    await page.getByRole("button", { name: "Back to the workspace" }).click();
    // The part is still marked unsolved on the page; it simply carries no ask.
    await expect(
      page.locator(`[data-node-id="${nodeId}"]`).getByTestId("bounty-node-pill"),
    ).toHaveCount(0);
  });
});
