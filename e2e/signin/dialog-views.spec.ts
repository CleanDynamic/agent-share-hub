// The sign-in dialog's other views (G8, G10) on the dev kit page: every state keeps its words, the dialog, row 1 and
// the picture column do not move between views, nothing overflows 540, and focus is inside a view that has just arrived.
import { expect, test, type Page } from "@playwright/test";

const THEMES = ["dusk", "noon"] as const;

const VIEWS: { mode: string; words: string[] }[] = [
  { mode: "reset", words: ["Reset your password", "Enter your email and we'll send a link", "Send reset link"] },
  { mode: "sent", words: ["Check your inbox", "If an account exists with", "you@studio.com"] },
  { mode: "checking", words: ["Checking your reset link…", "We're confirming the link is still valid."] },
  { mode: "confirm", words: ["Choose a new password", "Your reset link is valid.", "Update password"] },
  { mode: "dead", words: ["This reset link doesn't work", "It may have expired or already been used.", "Request a new one"] },
  { mode: "verify", words: ["Check your inbox", "We sent a verification link to", "Didn't get the email?", "Resend verification", "Wrong email?", "Sign up again"] },
  { mode: "verify-sending", words: ["Sending…"] },
  { mode: "verify-sent", words: ["Sent again — it should arrive in a minute."] },
  { mode: "verify-cooldown", words: ["Resend available in 45s"] },
  { mode: "verifying", words: ["Verifying your email…", "We're checking the link you opened."] },
  { mode: "verified", words: ["You're in", "Your email is confirmed and your account is active.", "Continue to OpenBuilds.ai"] },
  { mode: "failed", words: ["This link doesn't work", "It may have expired or been used already.", "Send a new link"] },
];

async function open(page: Page, theme: string, mode: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/dev/kit/pages/signin?theme=${theme}&viewport=desktop&mode=${mode}`);
  await page.getByTestId("signin-dialog").waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Measure the dialog where it rests, not mid-entrance (G11 slides it up 12px and scales it from 0.98).
  await page.waitForFunction(() => document.querySelector('[data-testid="signin-dialog"]')?.getAnimations().length === 0);
}

const boxes = (page: Page) =>
  page.evaluate(() => {
    const of = (id: string) => {
      const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    };
    return { dialog: of("signin-dialog"), row: of("signin-row-one"), picture: of("signin-picture-column") };
  });

const fits = (page: Page) =>
  page.getByTestId("signin-view-body").evaluate((el) => el.scrollHeight <= el.clientHeight && el.getBoundingClientRect().bottom <= el.closest('[data-testid="signin-dialog"]')!.getBoundingClientRect().bottom - 24);

for (const theme of THEMES) {
  test.describe(`sign-in views, ${theme}`, () => {
    test("G8, G10: each reset and verify state, its words, the same frame, within 540", async ({ page }) => {
      await open(page, theme, "login");
      const signIn = await boxes(page);
      for (const view of VIEWS) {
        await open(page, theme, view.mode);
        for (const words of view.words) await expect(page.getByTestId("signin-dialog").getByText(words, { exact: false }).first()).toBeVisible();
        await expect(page.getByTestId("signin-back")).toHaveText("Back to sign in");
        const now = await boxes(page);
        expect(now.dialog).toEqual(signIn.dialog);
        expect(now.picture).toEqual(signIn.picture);
        expect([now.row[0], now.row[1], now.row[2], now.row[3]]).toEqual(signIn.row);
        expect(await fits(page), `${view.mode} fits`).toBe(true);
      }
    });

    test("G10: focus is inside the new view after Forgot password? and after Back to sign in", async ({ page }) => {
      await open(page, theme, "login");
      const before = await boxes(page);
      await page.getByRole("link", { name: "Forgot password?" }).click();
      await expect(page).toHaveURL(/mode=reset/);
      await expect(page.getByText("Reset your password")).toBeVisible();
      expect(await page.getByTestId("signin-view-body").evaluate((el) => el.contains(document.activeElement))).toBe(true);
      expect(await boxes(page)).toEqual(before);
      await page.getByTestId("signin-back").click();
      await expect(page).toHaveURL(/mode=login/);
      expect(await page.getByTestId("signin-view-body").evaluate((el) => el.contains(document.activeElement))).toBe(true);
      expect(await boxes(page)).toEqual(before);
    });
  });
}
