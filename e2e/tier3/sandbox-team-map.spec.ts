// Tier 3 — agents and teams in the composer sandbox's Map (UI-P69).
//
// WHY THIS IS A BROWSER SPEC. What matters here is geometry and resolved paint:
// a box 112px tall that spans two columns, a stacked box whose two copies sit
// 5 and 10px down and right at opacity 0.75 and 0.5, a dashed 1.5px frame, and
// boxes outside it at 0.42. jsdom has no layout, so the unit tests under
// src/pages/site/compose and src/lib/build cover what is decided and this covers
// what a browser does with it.
//
// WHY /dev/kit. The real composer needs a signed-in creator and a record they
// own; the dev page draws the same components from the sample team build
// (`?build=team`, board S5 and V5-TeamMap) with no auth, as the other tier-3
// specs about the frame do.

import { expect, test } from "@playwright/test";

const PAGE = "/dev/kit/pages/sandbox?build=team&lens=map";

test.describe("a team in the Map", () => {
  test("has a lane of its own and a box two columns wide and 112 tall, with Open on it", async ({ page }) => {
    await page.goto(PAGE);
    const box = page.getByTestId("map-box-t3");
    await expect(box).toBeVisible();
    const size = await box.boundingBox();
    expect(Math.round(size!.height)).toBe(112);
    // Two columns of 132 and the gap between them.
    expect(Math.round(size!.width)).toBe(2 * 132 + 48);
    await expect(page.getByRole("button", { name: "Open Team 3" })).toBeVisible();
    await expect(page.getByTestId("map-lane").filter({ hasText: "runs by itself" })).toHaveCount(1);
    await expect(page.getByText("Open shows what is inside the team")).toBeVisible();
  });
});

test.describe("an opened team", () => {
  test("draws a dashed frame, 3.1 to 3.4 left to right, one stacked box and the files and tools band", async ({ page }) => {
    await page.goto(`${PAGE}&opened=t3`);
    const frame = page.getByTestId("opened-frame");
    await expect(frame).toBeVisible();
    // The declared width: a browser at 1x snaps a 1.5px border to whole device pixels when it paints.
    const declared = await frame.getAttribute("style");
    expect(declared).toMatch(/border:\s*1\.5px dashed/);
    expect(await frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("14px");
    await expect(frame).toContainText("Inside team 3");

    const lefts: number[] = [];
    const tops = new Set<number>();
    for (const id of ["t3a", "t3b", "t3c", "t3d"]) {
      const box = await page.getByTestId(`map-box-${id}`).boundingBox();
      lefts.push(box!.x);
      tops.add(Math.round(box!.y));
    }
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    expect(tops.size).toBe(1);

    await expect(page.getByText("files and tools", { exact: true })).toBeVisible();
    await expect(page.getByTestId("map-box-f1")).toBeVisible();
  });

  test("stacks the box that runs several at once: two copies 5 and 10px down and right, at 0.75 and 0.5", async ({ page }) => {
    await page.goto(`${PAGE}&opened=t3`);
    const writer = (await page.getByTestId("map-box-t3b").boundingBox())!;
    const copies = page.getByTestId("stack-copy");
    await expect(copies).toHaveCount(2);
    const placed = await copies.evaluateAll((els) => els.map((el) => ({ left: parseFloat((el as HTMLElement).style.left), top: parseFloat((el as HTMLElement).style.top), opacity: getComputedStyle(el).opacity })));
    // The first is the one furthest behind.
    expect(placed.map((copy) => copy.opacity)).toEqual(["0.5", "0.75"]);
    const near = placed[1];
    const far = placed[0];
    expect(far.left - near.left).toBe(5);
    expect(far.top - near.top).toBe(5);
    const boxLeft = parseFloat(await page.getByTestId("map-box-t3b").evaluate((el) => (el as HTMLElement).style.left));
    expect(near.left - boxLeft).toBe(5);
    expect(writer.width).toBeGreaterThan(0);
    await expect(page.getByTestId("map-box-t3b")).toContainText("× 3");
  });

  test("dims what is outside the frame to 0.42, and labels the loop", async ({ page }) => {
    await page.goto(`${PAGE}&opened=t3`);
    for (const id of ["p2", "p4", "r1"]) {
      await expect(page.getByTestId(`map-box-${id}`)).toHaveCSS("opacity", "0.42");
    }
    await expect(page.getByTestId("map-wire-label")).toHaveText("sent back until approved");
    await expect(page.getByText("Sent back by 3.3")).toBeVisible();
    await expect(page.getByText("Output of 3.2 × 3")).toBeVisible();
  });

  test("shows 'Build › {title}' with a way back, and an agent opened inside it reads 'Inside agent'", async ({ page }) => {
    await page.goto(`${PAGE}&opened=t3`);
    await expect(page.getByTestId("sandbox-trail")).toContainText("Build");
    await expect(page.getByTestId("sandbox-trail")).toContainText("Copy team");
    await expect(page.getByRole("button", { name: "Back to build" })).toBeVisible();

    await page.goto(`${PAGE}&opened=t3b`);
    await expect(page.getByTestId("opened-frame")).toContainText("Inside agent 3.2");
    await expect(page.getByTestId("map-box-t3b:instructions")).toBeVisible();
  });
});
