// The dev server compiles each chunk on first request and re-optimises its dependencies once, reloading the page. Opening a
// signed-out page, a signed-in page and a kit page first lets that happen before any check runs.

import { chromium, type FullConfig } from "@playwright/test";

import { installCondition, signIn } from "../pagestate/network";

export default async function warmup(config: FullConfig): Promise<void> {
  const { baseURL, launchOptions } = config.projects[0].use;
  const browser = await chromium.launch(launchOptions);
  for (const [path, signed] of [["/", false], ["/settings/account", true], ["/compose/new", true], ["/dev/kit/pages/vision-builds-table?theme=noon&viewport=desktop", false], ["/dev/kit/pages/build?theme=noon&viewport=desktop", false]] as const) {
    const page = await browser.newPage({ baseURL });
    await installCondition(page, "empty");
    if (signed) await signIn(page);
    await page.goto(path, { waitUntil: "load", timeout: 180_000 }).catch(() => undefined);
    await page.waitForTimeout(6000);
    await page.close();
  }
  await browser.close();
}
