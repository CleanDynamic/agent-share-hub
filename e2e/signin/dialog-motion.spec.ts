// G11, G12: the scrim, the dialog's entrance and exit, and the pending ring, read from the animations the browser runs.
// RUN AGAINST MOCKS (e2e/signin/support.ts).
import { expect, test, type Page } from "@playwright/test";

import { stub } from "./support";

/** Every `element.animate` call, recorded as it is made, with the element's test id: a 300ms fade is over before a check
    could read it from getAnimations(). */
async function recordAnimations(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __animations: unknown[] }).__animations = calls;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, keyframes: Keyframe[], options?: KeyframeAnimationOptions) {
      calls.push({
        id: this.getAttribute("data-testid"),
        at: performance.now(),
        keyframes: (keyframes as Keyframe[]).map((frame) => ({ opacity: String(frame.opacity ?? ""), transform: String(frame.transform ?? "") })),
        duration: options?.duration,
        easing: String(options?.easing ?? "linear").replace(/\s/g, ""),
        delay: options?.delay ?? 0,
        iterations: options?.iterations ?? 1,
      });
      return original.call(this, keyframes, options);
    } as typeof Element.prototype.animate;
  });
}

type Call = { id: string | null; at: number; keyframes: { opacity: string; transform: string }[]; duration: number; easing: string; delay: number; iterations: number };
const calls = async (page: Page, id: string) =>
  ((await page.evaluate(() => (window as unknown as { __animations: unknown[] }).__animations)) as Call[]).filter((call) => call.id === id);
const shape = ({ keyframes, duration, easing, delay }: Call) => ({ keyframes, duration, easing, delay });

async function open(page: Page, theme: "dusk" | "noon") {
  await recordAnimations(page);
  await page.addInitScript((room) => localStorage.setItem("bg-theme", room), theme);
  await page.goto("/builds");
  await page.evaluate((room) => document.documentElement.setAttribute("data-theme", room), theme);
  await page.waitForLoadState("networkidle");
  await page.getByRole("banner").getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("signin-dialog").waitFor();
}

for (const theme of ["dusk", "noon"] as const) {
  test(`G11: scrim ${theme}, entrance, and a close that fades at once`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stub(page);
    await open(page, theme);

    const scrimColour = await page.getByTestId("signin-scrim").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(scrimColour).toBe(theme === "dusk" ? "rgba(0, 0, 0, 0.8)" : "rgba(244, 244, 242, 0.84)");

    const o = (opacity: string) => ({ opacity, transform: "" });
    const [scrimIn] = await calls(page, "signin-scrim");
    expect(shape(scrimIn)).toEqual({ keyframes: [o("0"), o("1")], duration: 300, easing: "ease-out", delay: 0 });
    const entrance = await calls(page, "signin-dialog");
    expect(entrance.map(shape)).toEqual([
      { keyframes: [o("0"), o("1")], duration: 320, easing: "ease-out", delay: 0 },
      { keyframes: [{ opacity: "", transform: "translateY(12px) scale(0.98)" }, { opacity: "", transform: "none" }], duration: 440, easing: "cubic-bezier(0.2,0.8,0.2,1)", delay: 0 },
    ]);
    // No delay between them: the two start in the same frame as the scrim.
    expect(Math.abs(entrance[0].at - scrimIn.at)).toBeLessThan(5);

    await page.waitForTimeout(500);
    const pressed = await page.evaluate(() => performance.now());
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await calls(page, "signin-scrim")).length).toBe(2);
    const scrimOut = (await calls(page, "signin-scrim"))[1];
    expect(shape(scrimOut)).toEqual({ keyframes: [o("1"), o("0")], duration: 900, easing: "ease-out", delay: 0 });
    const exit = (await calls(page, "signin-dialog"))[2];
    expect(shape(exit)).toEqual({ keyframes: [o("1"), o("0")], duration: 320, easing: "ease-out", delay: 0 });
    // The dialog starts fading at once.
    expect(exit.at - pressed).toBeLessThan(100);
    await expect(page.getByTestId("signin-dialog")).toHaveCount(0, { timeout: 2000 });
  });
}

test("G12: a pending Sign in shows the ring of 8 dots and says Signing in", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page, { signInDelayMs: 3000 });
  await open(page, "dusk");
  const dialog = page.getByTestId("signin-dialog");
  await dialog.getByPlaceholder("Email or username").fill("ada@example.test");
  await dialog.getByPlaceholder("Enter your password").fill("correct horse");
  const primary = dialog.locator('[data-variant="signin-primary"]');
  await primary.click();
  await expect(primary).toHaveText("Signing in");
  const ring = primary.getByTestId("pending-ring");
  const [turn] = await calls(page, "pending-ring");
  expect({ ...shape(turn), iterations: turn.iterations }).toEqual({
    keyframes: [{ opacity: "", transform: "rotate(0deg)" }, { opacity: "", transform: "rotate(360deg)" }],
    duration: 900,
    easing: "linear",
    delay: 0,
    iterations: Infinity,
  });
  const geometry = await ring.evaluate((el) => {
    // Layout sizes: the ring is turning, so its bounding box grows and shrinks with the angle.
    const box = el as HTMLElement;
    const dots = Array.from(el.children).map((dot) => {
      const d = dot as HTMLElement;
      return { w: d.offsetWidth, h: d.offsetHeight, opacity: Number(getComputedStyle(dot).opacity) };
    });
    return { w: box.offsetWidth, h: box.offsetHeight, dots };
  });
  expect(geometry.w).toBe(18);
  expect(geometry.h).toBe(18);
  expect(geometry.dots).toHaveLength(8);
  for (const dot of geometry.dots) expect([dot.w, dot.h]).toEqual([4, 4]);
  const opacities = geometry.dots.map((dot) => dot.opacity).sort((a, b) => b - a);
  expect(opacities[0]).toBeCloseTo(1, 5);
  expect(opacities[7]).toBeCloseTo(0.12, 5);
});
