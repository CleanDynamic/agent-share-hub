// SV-03 P3: start the composer's code early, from anywhere that is about to open it.
//
// ComposeRoute calls this the moment its route matches, and a link to a draft calls it on hover (Part 6). Each one is
// asked for once: a later call gets the same promise. This file stays tiny on purpose, because App.tsx imports
// ComposeRoute eagerly and ComposeRoute imports this.

import { SANDBOX_COMPOSER_ENABLED } from "@/lib/build/flags";

let page: Promise<unknown> | null = null;

/** The composer's page chunk. */
export function preloadComposer(): Promise<unknown> {
  page ??= SANDBOX_COMPOSER_ENABLED ? import("./SandboxPage") : import("./ComposePage");
  return page;
}
