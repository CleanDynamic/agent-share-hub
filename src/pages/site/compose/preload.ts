// SV-03 P3: start the composer's code early, from anywhere that is about to open it.
//
// ComposeRoute calls this the moment its route matches, and a link to a draft calls it on hover (Part 6). Each one is
// asked for once: a later call gets the same promise. This file stays tiny on purpose: App.tsx and the route table import it eagerly.

import { SANDBOX_COMPOSER_ENABLED } from "@/lib/build/flags";

let page: Promise<unknown> | null = null;

/** The composer's page chunk. */
export function preloadComposer(): Promise<unknown> {
  page ??= SANDBOX_COMPOSER_ENABLED ? import("./SandboxPage") : import("./ComposePage");
  return page;
}

let route: Promise<typeof import("./ComposeRoute")> | null = null;

/** SV-26 P2: ComposeRoute's own chunk (it holds the build layer's reads), asked for once. The composer's page starts with it, so
    the two download side by side as they did when ComposeRoute was in the first download. */
export function preloadComposeRoute(): Promise<typeof import("./ComposeRoute")> {
  if (!route) {
    void preloadComposer();
    route = import("./ComposeRoute");
  }
  return route;
}
