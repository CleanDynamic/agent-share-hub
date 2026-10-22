// CA-14 P9: the rows of "Add from your connected chats" are 64 tall and none overlaps another, at 430 and 1280.
//   node docs/audits/ca-14/scripts/overlap.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openDraft } from "./shots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const id = execFileSync("node", [path.join(here, "scenario.mjs"), "--reset"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop();
const browser = await launch();
let failed = false;
for (const size of ["desktop", "phone"]) {
  const { context, page } = await openDraft(browser, size, "noon", id);
  await page.getByTestId("add-session-row").scrollIntoViewIfNeeded();
  await page.getByTestId("add-session-row").click();
  await page.getByRole("button", { name: /Add from your connected chats/ }).click();
  await page.waitForSelector('[data-testid="library-row"]');
  const boxes = await page.locator('[data-testid="library-row"]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right })));
  const heights = new Set(boxes.map((box) => Math.round(box.height)));
  const overlaps = boxes.filter((box, at) => at > 0 && box.top < boxes[at - 1].bottom - 0.5 && box.top >= 0);
  const wide = boxes.some((box) => box.right > (size === "phone" ? 430 : 1280) + 1);
  console.log(size, `${boxes.length} rows`, "heights", [...heights], "overlaps", overlaps.length, "past the edge", wide);
  if (heights.size !== 1 || !heights.has(64) || overlaps.length > 0 || wide) failed = true;
  await context.close();
}
await browser.close();
if (failed) process.exit(1);
