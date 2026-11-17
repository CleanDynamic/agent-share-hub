// G29: what state a page is in, read from the DOM.
//
// PageState marks its region with `data-page-state` (loading, failed, empty, notfound, ready). Until every page draws
// through it, today's pages are read by what they show: the brand ErrorState and EmptyState, the site's NotFoundView,
// skeletons (aria-busy, LoadingRegion, LoadingStatus), and the hand-written sentences the audit found. A page with more
// than one region can show more than one state; `states` lists every one seen, and `state` is the page's.

import type { Page } from "@playwright/test";

export type Seen = "loading" | "signedout" | "notfound" | "failed" | "empty" | "ready";

export interface Reading {
  state: Seen;
  states: Seen[];
  /** The page's title: the visible h1's text, or null. */
  title: string | null;
  /** Visible text that looks like an error code. */
  codes: string[];
  /** G28: the word "gallery" anywhere on screen. */
  gallery: boolean;
  /** Labels of the buttons inside failed regions, and any visible "Retry". */
  retryLabels: string[];
  /** Elements still marked aria-busy="true". */
  busy: number;
  /** The visible sentences that decided a failed, empty or not-found reading, for the report. */
  lines: string[];
}

/** Five-character SQLSTATEs (42501, 57014, XX000), PostgREST codes and "Code …". */
export const CODE_PATTERN = /PGRST\d{3}|\bCode [0-9A-Z]+|\b(?:[0-9]{2}[0-9A-Z]{3}|[A-Z]{2}[0-9]{3})\b/g;

export async function readState(page: Page): Promise<Reading> {
  return page.evaluate((codeSource) => {
    const visible = (el: Element) => {
      const box = (el as HTMLElement).getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        // Visually hidden status text still counts for loading.
        return (el as HTMLElement).closest("[role=status],[aria-busy=true],[data-ui=loading]") !== null;
      }
      const style = getComputedStyle(el as HTMLElement);
      return style.visibility !== "hidden" && style.display !== "none";
    };
    const all = (selector: string) => Array.from(document.querySelectorAll(selector)).filter(visible);
    const text = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    const states = new Set<string>();
    const lines: string[] = [];

    // PageState's own mark, when there is one.
    // `display: contents` gives the mark no box of its own, so it is read whatever its size.
    for (const el of Array.from(document.querySelectorAll("[data-page-state]"))) states.add(el.getAttribute("data-page-state") as string);

    // Loading.
    const busy = document.querySelectorAll('[aria-busy="true"]').length;
    if (busy > 0 || all('[data-ui="loading"], [data-testid="loading-status"]').length > 0) states.add("loading");
    for (const el of all("[role=status]")) if (/^(Loading|Checking|Setting up)\b/.test(text(el))) states.add("loading");

    // Signed out: the dialog with the notice, or the editor's banner.
    const body = document.body.innerText ?? "";
    if (/You've been signed out/.test(body)) states.add("signedout");

    // Not found.
    for (const el of all('[data-testid="not-found"]')) {
      states.add("notfound");
      lines.push(text(el).slice(0, 120));
    }
    const NOT_FOUND = /Nothing at this address|No build at this address|One of those builds is not here|There is no space at this address|This post isn't available|Profile not found|Nobody here goes by that name|isn't here\b/;
    const FAILED = /didn't load|did not load|Couldn't load|didn't save/;
    const EMPTY = /^(No [^.]{1,60} yet\.?|Nothing in progress\.|No new sessions\.|All caught up\.|Nothing new in your spaces\.|Nothing is still open right now\.|Nothing run yet this week\.|No drafts in progress\.|No sessions yet\.|No conversations yet|Nothing has changed yet\.)/;

    // Failed.
    for (const el of all('[data-ui="error-state"]')) {
      states.add("failed");
      lines.push(text(el).slice(0, 120));
    }
    const SENTENCES = new RegExp(`${FAILED.source}|${NOT_FOUND.source}|${EMPTY.source}`);
    for (const el of all("p, span, div, li, h1, h2, h3")) {
      const t = text(el);
      if (!t || t.length > 160 || !SENTENCES.test(t)) continue;
      // The smallest element that says it: skip one whose child says it too.
      if (Array.from(el.children).some((child) => SENTENCES.test(text(child)))) continue;
      if (FAILED.test(t)) {
        states.add("failed");
        lines.push(t);
      } else if (NOT_FOUND.test(t)) {
        states.add("notfound");
        lines.push(t);
      } else if (EMPTY.test(t)) {
        states.add("empty");
        lines.push(t);
      }
    }
    for (const el of all('[data-ui="empty-state"]')) {
      states.add("empty");
      lines.push(text(el).slice(0, 120));
    }

    // The sign-in dialog is over the page: it is what the person sees, whatever is under it (G18 holds the skeleton there).
    const order = ["signedout", "loading", "notfound", "failed", "empty"];
    const state = order.find((s) => states.has(s)) ?? "ready";

    const h1 = all("h1").map(text).find((t) => t.length > 0) ?? null;
    const codes = Array.from(body.matchAll(new RegExp(codeSource, "g"))).map((m) => m[0]);
    const retryLabels: string[] = [];
    for (const region of all('[data-ui="error-state"], [data-page-state="failed"]')) {
      for (const b of Array.from(region.querySelectorAll("button"))) retryLabels.push(text(b));
    }
    for (const b of all("button")) if (/^Retry$/.test(text(b))) retryLabels.push(text(b));

    return {
      state,
      states: Array.from(states),
      title: h1,
      codes: Array.from(new Set(codes)),
      gallery: /gallery/i.test(body),
      retryLabels: Array.from(new Set(retryLabels)),
      busy,
      lines: Array.from(new Set(lines)).slice(0, 6),
    } as never;
  }, CODE_PATTERN.source);
}
