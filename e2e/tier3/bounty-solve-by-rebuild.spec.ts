// Tier 3 — solving a bounty by rebuilding the build it lives on (NS-P53).
//
// THE ONE CLAIM, in six parts, and it is the whole round trip that no unit
// test can reach because it needs two accounts, one database, and a build that
// is published between the two halves:
//
//   1. the gap panel ranks the two ways to answer — the rebuild is the button
//   2. B takes it: the fork is written, B lands in compose, and the draft
//      knows which gap it is answering
//   3. B fills the gap in their own copy and publishes it
//   4. B returns to the bounty and submits that build as the solution
//   5. A accepts it, and A's node carries B'S PAYLOAD and links to B's build
//   6. B's build page says it solves a bounty, and the line points at the gap
//
// PART 5 IS THE ONE THAT MATTERS. Everything before it is navigation; part 5
// is the claim that acceptance pulled the payload out of the SOLVER'S
// PUBLISHED NODE rather than out of the copy stored on the solutions row when
// it was filed. The two are deliberately different in this spec — B edits the
// node once more after submitting — so a build that took the snapshot fails
// here and passes everywhere else.
//
// WHAT IS ANSWERED IN THE UNIT SUITE INSTEAD.
// src/lib/bounty/solutionRebuild.test.ts drives every refusal — unpublished,
// wrong gap, still a gap, empty, duplicate — and asserts that acceptance names
// the matched node to the database. src/components/build/GapPanel.test.tsx
// drives the ranking and the returning solver's one-click submit.
// src/pages/BuildPage.test.tsx drives the banner line. This spec is the join:
// that those pieces, against a real database with real row level security,
// actually complete the round trip.
//
// THIS SPEC WRITES, AND WHAT IT WRITES CANNOT BE UNDONE FROM A BROWSER. It
// forks a build, publishes the fork under B's account, fills a node in A's
// published build, solves a bounty and appends a milestone to A's sequence.
// So it is pointed at a DEV project and at a build that is EXPECTED NOT TO
// SURVIVE it, and it leaves a published build behind on B's profile. It skips
// unless every one of these is set, so it cannot be pointed anywhere by
// accident:
//
//   E2E_REBUILD_BOUNTY_SLUG   a published build with ONE open bounty on a gap
//   E2E_REBUILD_GAP_TITLE     that gap node's title, to find its row in compose
//   E2E_AUTHOR_EMAIL          the creator of that build
//   E2E_AUTHOR_PASSWORD
//   E2E_SOLVER_EMAIL          somebody else — A cannot solve their own gap
//   E2E_SOLVER_PASSWORD
//   E2E_SOLVER_HANDLE         that user's profiles.username, for the credit
//
// A SEPARATE SLUG FROM bounty-solve-loop.spec.ts, deliberately. Both specs
// fill the same kind of hole and neither can run twice against one build;
// sharing an env var would mean whichever ran second failed for a reason that
// has nothing to do with the code.
//
// Selectors are NS-P53's testids — solve-rebuild, solve-direct,
// submit-rebuild-solution, solution-rebuild-card, rebuild-solves-line — plus
// NS-P52's for the parts it did not change. Nothing here selects on a class:
// see the e2e skill.

import { expect, test, type Page } from "@playwright/test";

const SLUG = process.env.E2E_REBUILD_BOUNTY_SLUG ?? "";
const GAP_TITLE = process.env.E2E_REBUILD_GAP_TITLE ?? "";
const AUTHOR_EMAIL = process.env.E2E_AUTHOR_EMAIL ?? "";
const AUTHOR_PASSWORD = process.env.E2E_AUTHOR_PASSWORD ?? "";
const SOLVER_EMAIL = process.env.E2E_SOLVER_EMAIL ?? "";
const SOLVER_PASSWORD = process.env.E2E_SOLVER_PASSWORD ?? "";
const SOLVER_HANDLE = process.env.E2E_SOLVER_HANDLE ?? "";

const NEEDS_SEED =
  "Set E2E_REBUILD_BOUNTY_SLUG, E2E_REBUILD_GAP_TITLE, E2E_AUTHOR_EMAIL, " +
  "E2E_AUTHOR_PASSWORD, " +
  "E2E_SOLVER_EMAIL, E2E_SOLVER_PASSWORD and E2E_SOLVER_HANDLE. This spec " +
  "publishes a rebuild and fills a gap in a published build, and cannot be " +
  "re-run against the same build, so point it at a DEV project.";

/**
 * What B writes into the gap inside their own rebuild, and then what they
 * change it to after submitting.
 *
 * THE SECOND VALUE IS THE TEST. Acceptance is specified to pull from the
 * solver's published node at the moment it happens, not from the copy the
 * solutions row took at submission. Editing the node between the two makes
 * those two answers different strings, so part 5 can tell them apart.
 */
const FIRST_ANSWER = "Back off exponentially: 1s, 2s, 4s, capped at six attempts.";
const FINAL_ANSWER =
  "Back off exponentially: 1s, 2s, 4s, capped at six attempts, and log the last error.";
const SOLVER_NOTE = "The chunker was the problem, not the prompt.";
const REBUILD_NOTE = "Rewrote the retry step and moved it after the check.";

/** Cold loads on this bundle run to ~2.7s; writes go through Supabase. */
const SLOW = 30_000;

/**
 * Sign in through the login form.
 *
 * Through the UI, which is what the e2e skill tells you not to do — and there
 * is still no auth setup project in this repository to save a storage state
 * with (the config declares the project; no *.setup.ts exists). NS-P51's and
 * NS-P52's specs carry the same helper and the same note. Whoever adds the
 * fixture should delete all three and use two `test.use({ storageState })`
 * contexts here, which is also what would let the halves run as separate tests.
 */
async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email or username").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByPlaceholder("Enter your password")).toHaveCount(0, {
    timeout: SLOW,
  });
}

async function signOut(page: Page): Promise<void> {
  // The session is in local storage; clearing it is what signing out amounts
  // to, and it does not depend on where the menu that does it lives today.
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
}

/** A's build page, once its record has painted. */
async function openSourceBuild(page: Page): Promise<void> {
  await page.goto(`/b2/${SLUG}`);
  await expect(page.locator('[data-visual-slot="build-anatomy-tree"]')).toBeVisible({
    timeout: SLOW,
  });
}

/** Playwright reads a bare string as a substring; a title with regex in it. */
function literal(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

/** The next write of a node row: what a debounced inspector edit becomes. */
function nodeWrite(page: Page) {
  return page.waitForResponse(
    (response) =>
      /\/rest\/v1\/build_nodes/.test(response.url()) &&
      ["POST", "PATCH"].includes(response.request().method()),
    { timeout: SLOW },
  );
}

/**
 * Select the gap node in the workspace tree and return its inspector.
 *
 * The row is found by the gap's TITLE, which the fork copied verbatim from the
 * source, and the node id is read off the row rather than passed in: an id a
 * spec was told is easier to get wrong than one it looked up.
 */
async function selectGap(page: Page) {
  const row = page.locator("[data-node-id]").filter({ hasText: GAP_TITLE }).first();
  await expect(row).toBeVisible({ timeout: SLOW });
  await row.getByRole("button", { name: literal(GAP_TITLE) }).click();

  const inspector = page.getByTestId("inspector");
  await expect(inspector).toBeVisible({ timeout: SLOW });
  return inspector;
}

/** The solve sheet, opened from the gap panel under the node. */
async function openSolveSheet(page: Page) {
  const panel = page.getByTestId("gap-panel").first();
  await expect(panel).toBeVisible({ timeout: SLOW });
  await panel.getByTestId("solve-open").click();
  const sheet = page.getByTestId("solve-panel");
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("solving a bounty by rebuilding it", () => {
  test.skip(
    !SLUG ||
      !GAP_TITLE ||
      !AUTHOR_EMAIL ||
      !AUTHOR_PASSWORD ||
      !SOLVER_EMAIL ||
      !SOLVER_PASSWORD ||
      !SOLVER_HANDLE,
    NEEDS_SEED,
  );

  // One test, not six: every part depends on state the one before it wrote —
  // a fork that does not exist cannot be published, and a build that is not
  // published cannot be submitted — and splitting them would make five of the
  // six pass or fail for reasons that have nothing to do with what they
  // assert.
  test("B rebuilds the gap, submits it, and A's node carries B's payload", async ({
    page,
  }) => {
    // ---------------------------------------------------------------- part 1
    await signIn(page, SOLVER_EMAIL, SOLVER_PASSWORD);
    await openSourceBuild(page);
    const sheet = await openSolveSheet(page);

    // The ranking is the design: the rebuild is a button, the form is a link
    // behind it, and the form is not on screen until it is asked for.
    const primary = sheet.getByTestId("solve-rebuild");
    await expect(primary).toBeVisible();
    await expect(sheet).toContainText("You get the whole build to work with");
    await expect(sheet.getByTestId("solve-direct")).toBeVisible();
    await expect(sheet.getByTestId("solution-note")).toHaveCount(0);

    // ---------------------------------------------------------------- part 2
    await primary.click();

    // The fork is a write, and the workspace is where it lands. The address is
    // the evidence the draft exists and belongs to B.
    await page.waitForURL(/\/compose\/[0-9a-f-]{36}/, { timeout: SLOW });
    const draftUrl = page.url();

    // ---------------------------------------------------------------- part 3
    // Fill the gap inside B's own copy. forkBuild copies is_gap, so the node
    // arrives in the draft still flagged, and B turns the flag off — which is
    // what "solved" means to the record and what submitSolutionRebuild checks.
    const inspector = await selectGap(page);

    // The type's own first field. SchemaForm renders the schema's fields in
    // order and the title input above them carries its own id, so the first
    // textbox BELOW the title is the field the type puts first.
    const answered = nodeWrite(page);
    await inspector.getByRole("textbox").nth(1).fill(FIRST_ANSWER);
    await answered;

    const toggle = page.getByTestId("gap-toggle");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    // Registered BEFORE the click that causes it: the node writer debounces
    // and a listener attached afterwards can miss its own response.
    const flagCleared = nodeWrite(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await flagCleared;

    // Publish, from the top bar pill — the same door bounty-publish.spec.ts
    // uses, because there is only one.
    await page.getByRole("button", { name: "Publish" }).first().click();
    const publishSheet = page.getByTestId("publish-sheet");
    await expect(publishSheet).toBeVisible({ timeout: SLOW });

    // The rebuild section is what makes this a rebuild rather than a fork
    // published untouched: the gate wants a diff, and filling the gap is one.
    await expect(publishSheet.getByTestId("rebuild-section")).toBeVisible();
    await publishSheet.getByTestId("rebuild-note").fill(REBUILD_NOTE);
    await page.getByTestId("publish-confirm").click();
    await expect(page.getByText("It’s live.")).toBeVisible({ timeout: SLOW });

    // The slug is read off the sheet's own card preview rather than guessed
    // from the title: slugifyTitle appends a suffix when a title collides, and
    // this fork's title starts out identical to its source's.
    const rebuildHref = await publishSheet
      .getByTestId("publish-card-preview")
      .locator('a[href^="/b2/"]')
      .first()
      .getAttribute("href");
    expect(rebuildHref).toBeTruthy();
    const rebuildUrl = rebuildHref as string;
    await page.goto(rebuildUrl);

    // ---------------------------------------------------------------- part 6
    // Asserted here rather than at the end because the page is already open:
    // the banner says what this build IS, and it says it whether or not the
    // solution is ever accepted.
    const solves = page.getByTestId("rebuild-solves-line");
    await expect(solves).toBeVisible({ timeout: SLOW });
    await expect(solves).toContainText("Solves a bounty on");
    // The link names the NODE, because the gap panel is a card in A's tree and
    // not a route of its own.
    await expect(solves.getByRole("link")).toHaveAttribute(
      "href",
      new RegExp(`/b2/${SLUG}#node-[0-9a-f-]{36}$`),
    );

    // ---------------------------------------------------------------- part 4
    await openSourceBuild(page);
    const returning = await openSolveSheet(page);

    // B is back holding a published rebuild that declares this gap, so the
    // panel offers it rather than making them find it.
    const submit = returning.getByTestId("submit-rebuild-solution");
    await expect(submit).toBeVisible({ timeout: SLOW });
    await returning.getByTestId("rebuild-solution-note").fill(SOLVER_NOTE);

    const written = page.waitForResponse(
      (response) =>
        /\/rest\/v1\/solutions/.test(response.url()) &&
        response.request().method() === "POST",
      { timeout: SLOW },
    );
    await submit.click();
    await written;

    // The answer lists as a rebuild-solution: a card naming the build, with
    // the evidence beside it, because that is what ranks it.
    const row = returning.getByTestId("solution-row").first();
    await expect(row).toContainText(SOLVER_NOTE);
    await expect(row.getByTestId("solution-rebuild-card")).toBeVisible();
    await expect(row.getByTestId("solution-build-repros")).toBeVisible();

    // A solver is not offered the author's control, whatever the DOM says
    // about the row being theirs.
    await expect(returning.getByTestId("solution-accept")).toHaveCount(0);

    // --------------------------------------------- the edit that proves part 5
    // B changes their published node AFTER filing. The solutions row still
    // holds FIRST_ANSWER; the build now holds FINAL_ANSWER. Acceptance is
    // specified to take the build's.
    await page.goto(draftUrl);
    const editor = await selectGap(page);
    const edited = nodeWrite(page);
    await editor.getByRole("textbox").nth(1).fill(FINAL_ANSWER);
    // The write is debounced into build_nodes; wait for it rather than sleep.
    await edited;

    // ---------------------------------------------------------------- part 5
    await signOut(page);
    await signIn(page, AUTHOR_EMAIL, AUTHOR_PASSWORD);
    await openSourceBuild(page);
    const authorSheet = await openSolveSheet(page);

    await expect(authorSheet.getByTestId("solution-row").first()).toBeVisible({
      timeout: SLOW,
    });
    await authorSheet.getByTestId("solution-accept").first().click();
    // The confirm names the consequence, and for this path it names where the
    // payload is coming from — which is the thing an author could not
    // otherwise guess.
    await expect(authorSheet).toContainText("published rebuild into your build");
    await authorSheet.getByTestId("solution-accept-confirm").click();

    // The record itself changed, so the page refetches: the gap becomes the
    // filled node, crediting the solver.
    const credit = page.getByTestId("gap-solved-credit").first();
    await expect(credit).toBeVisible({ timeout: SLOW });
    await expect(credit).toHaveText(`Solved by @${SOLVER_HANDLE}`);
    await expect(page.getByTestId("gap-panel")).toHaveCount(0);

    // THE CLAIM. A's tree carries what B'S BUILD says now, not what the
    // solutions row remembered from submission.
    const tree = page.locator('[data-visual-slot="build-anatomy-tree"]');
    await expect(tree).toContainText(FINAL_ANSWER, { timeout: SLOW });

    // And the node points at where the answer lives, so a reader of A's build
    // can go and run B's. This is source_ref.solution_build_id, rendered.
    await expect(page.locator(`a[href="${rebuildUrl}"]`).first()).toBeVisible({
      timeout: SLOW,
    });
  });
});
