// G25 to G27: open a matrix page, run axe on it, walk it with Tab. Built on prompt 10's harness (e2e/pagestate/network.ts):
// its network faker and its fake member.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { installCondition, signIn } from "../pagestate/network";
import { ALLOW_LIST } from "./allowList";
import { addressOf, type MatrixPage, type Theme, type Variant } from "./matrix";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RESULTS = path.resolve(HERE, "../../test-results/a11y");

/** G25: WCAG 2.0, 2.1 and 2.2, A and AA. */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
/** Rules outside those tags that a DONE line asks for: G12 (no heading level skipped). */
export const AXE_EXTRA_RULES = ["heading-order"];

/** The theme before the app's first script: the stored choice the boot script reads, and the system preference. */
async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* a storage-less context is a harness problem */
    }
  }, theme === "dark" ? "dusk" : "noon");
}

/** Open `entry` at `variant`, faked network, and wait until it has settled (no region still loading, fonts in). */
export async function openPage(page: Page, entry: MatrixPage, variant: Variant): Promise<{ boundary: boolean }> {
  await page.setViewportSize({ width: variant.width, height: variant.width === 390 ? 844 : 900 });
  await setTheme(page, variant.theme);
  await installCondition(page, "empty");
  if (entry.signedIn) await signIn(page);
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto(addressOf(entry, variant), { waitUntil: "load", timeout: 120_000 });
  await settle(page, Boolean(entry.kit));
  if (entry.ready) await page.locator(entry.ready).first().waitFor({ state: "attached", timeout: 30_000 });
  // The dev server reloads a page once when it has just optimised a dependency: settle the page it reloaded to.
  if (loads > 1) await settle(page, Boolean(entry.kit));
  const boundary = await page.getByText("Something went wrong.", { exact: false }).count().then((n) => n > 0);
  return { boundary };
}

export async function settle(page: Page, kit = false): Promise<void> {
  if (kit) await page.locator("[data-design-ready]").first().waitFor({ state: "attached", timeout: 30_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('[data-page-state="loading"]'), undefined, { timeout: 20_000 }).catch(() => undefined);
  // Lazily loaded parts of the page (the editor's thread, a window's code) come in after the first draw.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  // The idle mounts (toasters, presence) and the page's arrival settle.
  await page.waitForTimeout(1200);
}

export interface AxeFinding {
  rule: string;
  impact: string | null;
  target: string;
  html: string;
  summary: string;
  allowed?: string;
}

export async function runAxe(page: Page, pageName: string): Promise<AxeFinding[]> {
  const result = await new AxeBuilder({ page })
    .options({ runOnly: { type: "tag", values: AXE_TAGS }, rules: Object.fromEntries(AXE_EXTRA_RULES.map((id) => [id, { enabled: true }])) })
    .analyze();
  const findings: AxeFinding[] = [];
  for (const violation of result.violations) {
    for (const node of violation.nodes) {
      const target = node.target.map(String).join(" ");
      const allowed = ALLOW_LIST.find((entry) => entry.rule === violation.id && (!entry.page || entry.page === pageName) && (!entry.target || target.includes(entry.target)));
      findings.push({
        rule: violation.id,
        impact: violation.impact ?? null,
        target,
        html: node.html.slice(0, 200),
        summary: (node.failureSummary ?? "").split("\n").slice(1).join(" ").slice(0, 240),
        allowed: allowed?.reason,
      });
    }
  }
  return findings;
}

/* ── G26: the Tab walk ── */

export interface Stop {
  index: number;
  what: string;
  name: string;
  problems: string[];
}

export interface WalkResult {
  stops: Stop[];
  /** How the forward walk ended: at the body, back at the first stop (a trap such as a dialog), or at the press limit. */
  ended: "body" | "cycle" | "limit";
  failures: string[];
}

export const MAX_PRESSES = 160;

/**
 * In the page: everything the walk needs, installed once. `window.__a11y` keeps the elements in the order they took focus,
 * so the backward walk compares the same elements, not similar-looking ones.
 */
function installWalker(): void {
  type Walker = {
    stops: Element[];
    signatures: string[];
    last: Element | null;
    lastTabbable: Element | null;
  };
  const w = window as unknown as { __a11y: Walker; __a11yStep: () => Promise<unknown>; __a11yBack: () => unknown };
  const FOCUSABLE = 'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';

  const shown = (el: Element): boolean => {
    if (!(el instanceof HTMLElement)) return true;
    if (el.closest("[inert]")) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return el.getClientRects().length > 0;
  };
  const tabbable = (el: Element): boolean => {
    const h = el as HTMLElement;
    if (h.tabIndex < 0 || (h as HTMLButtonElement).disabled) return false;
    if (h instanceof HTMLInputElement && h.type === "hidden") return false;
    if (h instanceof HTMLInputElement && h.type === "radio" && !h.checked) {
      // A native radio group is one stop: the checked one, or the first when none is.
      const group = h.name ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(h.name)}"]`)) : [h];
      if (group.some((r) => r.checked) || group[0] !== h) return false;
    }
    return shown(el);
  };
  const all = Array.from(document.querySelectorAll(FOCUSABLE)).filter(tabbable);

  const describe = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const testId = el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : "";
    const role = el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : "";
    return `${el.tagName.toLowerCase()}${id}${testId}${role}`;
  };
  const textOf = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();
  /** A close enough accessible name: labelledby, aria-label, labels, alt, the text, title, placeholder. */
  const nameOf = (el: Element): string => {
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const text = by.split(/\s+/).map((id) => textOf(document.getElementById(id) ?? document.createElement("i"))).join(" ").trim();
      if (text) return text;
    }
    const label = el.getAttribute("aria-label")?.trim();
    if (label) return label;
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) {
      const text = Array.from(labels).map(textOf).join(" ").trim();
      if (text) return text;
    }
    if (el instanceof HTMLImageElement && el.alt) return el.alt;
    const inner = Array.from(el.querySelectorAll("img[alt], svg[aria-label], [role=img][aria-label]")).map((i) => i.getAttribute("alt") ?? i.getAttribute("aria-label") ?? "").join(" ");
    const text = `${textOf(el)} ${inner}`.trim();
    if (text && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return text;
    if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.text ?? "";
    return el.getAttribute("title") ?? (el as HTMLInputElement).placeholder ?? (el instanceof HTMLInputElement && /button|submit|reset/.test(el.type) ? el.value : "") ?? "";
  };
  /** What a focus indicator can change on the element or the three boxes round it. */
  const signature = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const s = getComputedStyle(node);
      parts.push([s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderTopColor, s.borderBottomColor, s.backgroundColor, s.color, s.textDecorationLine].join("|"));
    }
    return parts.join("//");
  };
  /** Why a focused element cannot be seen: hidden, off screen, transparent, or a 1px box. */
  const problems = (el: Element): string[] => {
    const out: string[] = [];
    const style = getComputedStyle(el);
    if (style.visibility === "hidden") out.push("visibility hidden");
    let opacity = 1;
    for (let node: Element | null = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    if (opacity === 0) out.push("opacity 0");
    // A visually hidden input drawn as the box beside it (a custom checkbox) is seen through its label.
    const labels = (el as HTMLInputElement).labels;
    const own = el.getBoundingClientRect();
    const box = (own.width <= 1 || own.height <= 1) && labels && labels.length ? labels[0].getBoundingClientRect() : own;
    if (box.width <= 1 || box.height <= 1) out.push(`box ${Math.round(box.width)}x${Math.round(box.height)}`);
    const off = box.bottom <= 0 || box.right <= 0 || box.top >= window.innerHeight || box.left >= window.innerWidth;
    if (off) out.push("off screen");
    if (!nameOf(el)) out.push("no name");
    return out;
  };

  w.__a11y = { stops: [], signatures: [], last: null, lastTabbable: all[all.length - 1] ?? null };

  w.__a11yStep = async () => {
    // Two frames, so a ring drawn from React state (useInteractive) has been drawn, and the one left behind is gone.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const state = w.__a11y;
    const previous = state.last;
    let previousChanged: boolean | null = null;
    if (previous) {
      const at = state.stops.lastIndexOf(previous);
      previousChanged = at >= 0 && previous.isConnected ? state.signatures[at] !== signature(previous) : null;
    }
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      state.last = null;
      return { kind: "body", previousChanged, reachedLast: state.lastTabbable ? state.stops.includes(state.lastTabbable) : true, lastTabbable: state.lastTabbable ? describe(state.lastTabbable) : null };
    }
    if (state.stops.length > 0 && el === state.stops[0]) {
      state.last = null;
      return { kind: "cycle", previousChanged };
    }
    state.stops.push(el);
    state.signatures.push(signature(el));
    state.last = el;
    return { kind: "stop", previousChanged, what: describe(el), name: nameOf(el).slice(0, 60), problems: problems(el) };
  };

  w.__a11yBack = () => {
    const el = document.activeElement;
    return { index: el ? w.__a11y.stops.indexOf(el) : -1, what: el ? describe(el) : "none" };
  };
}

type StepAnswer =
  | { kind: "body"; previousChanged: boolean | null; reachedLast: boolean; lastTabbable: string | null }
  | { kind: "cycle"; previousChanged: boolean | null }
  | { kind: "stop"; previousChanged: boolean | null; what: string; name: string; problems: string[] };

/** G26: forward with Tab from the top of the document, then back with Shift+Tab over the same stops. */
export async function tabWalk(page: Page): Promise<WalkResult> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.scrollTo(0, 0);
  });
  await page.evaluate(installWalker);
  const stops: Stop[] = [];
  const failures: string[] = [];
  let ended: WalkResult["ended"] = "limit";

  for (let press = 0; press < MAX_PRESSES; press++) {
    await page.keyboard.press("Tab");
    const answer = (await page.evaluate(() => (window as unknown as { __a11yStep: () => Promise<unknown> }).__a11yStep())) as StepAnswer;
    if (answer.previousChanged === false && stops.length > 0) failures.push(`no visible change on focus: stop ${stops.length} ${stops[stops.length - 1].what} "${stops[stops.length - 1].name}"`);
    if (answer.kind === "body") {
      ended = "body";
      // Focus at the body is right only after the last control; before it, the walk fell out of the page.
      if (stops.length === 0 || !answer.reachedLast) failures.push(`focus reached the body after ${stops.length} stops, before the last control (${answer.lastTabbable ?? "none"})`);
      break;
    }
    if (answer.kind === "cycle") {
      ended = "cycle";
      break;
    }
    const stop: Stop = { index: stops.length, what: answer.what, name: answer.name, problems: answer.problems };
    stops.push(stop);
    for (const problem of stop.problems) failures.push(`stop ${stop.index + 1} ${stop.what} "${stop.name}": ${problem}`);
  }

  // Back: from the body Shift+Tab reaches the last stop; from a cycle, focus is on the first stop and Shift+Tab reaches the last.
  // At the press limit focus is still on the last stop, so the first Shift+Tab reaches the one before it.
  if (stops.length > 1) {
    const expected = stops.map((stop) => stop.index).reverse().slice(ended === "limit" ? 1 : 0);
    const back: number[] = [];
    for (let i = 0; i < expected.length; i++) {
      await page.keyboard.press("Shift+Tab");
      const at = (await page.evaluate(() => (window as unknown as { __a11yBack: () => unknown }).__a11yBack())) as { index: number; what: string };
      back.push(at.index);
    }
    const first = back.findIndex((value, i) => value !== expected[i]);
    if (first >= 0) failures.push(`Shift+Tab does not retrace: back step ${first + 1} reached stop ${back[first] + 1 || "outside the walk"}, expected stop ${expected[first] + 1}`);
  }
  return { stops, ended, failures };
}

export function writeResult(slug: string, data: unknown): void {
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, `${slug}.json`), JSON.stringify(data, null, 1));
}
