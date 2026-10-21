// CA-09 Part 3: press every control that should do something, on the desktop and iPhone profiles, and record what
// happens: how long until something visible changes, what it was, whether the expected thing happened, and the
// requests and errors it caused. Writes actions-<profile>.json and actions.csv (both profiles, once both have run).
//
// "Visible change" is the first of: the address changes; an element appears or changes text inside the viewport and
// is not covered at its centre (a menu, a dialog, a toast, a new step); an aria-expanded / data-state / aria-pressed
// change on screen; the page scrolls; focus moves to an element that is inside the viewport AND not under anything
// at its centre. Focus that lands off screen or under a fixed bar is recorded as "focus (hidden)", which is what
// the maker sees as nothing.
//
// Verdicts: Works (expected effect, first visible change ≤ 300 ms); Slow (expected effect, but nothing visible for
// over 300 ms); Silent (something happened — a request, a focus — but nothing visible within 4 s, or only hidden
// focus); Broken (nothing at all, or an error).
//
// Each action starts from a fresh load of its screen. Usage: node docs/audits/ca-09/scripts/actions.mjs desktop|iphone [filter]
import { open, SITE, API, standin, resetData, clearLog, serverLog, write, purpose, landmarks, OUT } from "./lib.mjs";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const profileName = process.argv[2] ?? "desktop";
const filter = process.argv[3] ? new RegExp(process.argv[3], "i") : null;
const phone = profileName !== "desktop";
const L = await landmarks();
const SEVEN = `/compose/${L.sevenStep}`;
const THREAD = `/compose/${L.thread}`;

/** Installed in the page before each action; `__watch.done()` reports. */
const WATCH = () => {
  const t0 = performance.now();
  const seen = [];
  const inView = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    return true;
  };
  const uncovered = (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
    const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 20), 1), innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    return Boolean(top && (top === el || el.contains(top) || top.contains(el)));
  };
  const ignore = (el) => el.closest && (el.closest("canvas") || el.closest("[data-backdrop]") || el.tagName === "CANVAS" || el.tagName === "STYLE" || el.tagName === "SCRIPT");
  const note = (kind, detail) => seen.push({ ms: Math.round(performance.now() - t0), kind, detail: String(detail ?? "").slice(0, 120) });
  const url = location.href;
  const scroll = [scrollX, scrollY];
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "childList") {
        for (const n of r.addedNodes) {
          const el = n.nodeType === 1 ? n : n.parentElement;
          if (!el || ignore(el)) continue;
          if (inView(el) && uncovered(el)) note("appeared", (el.getAttribute("role") ?? el.tagName.toLowerCase()) + ":" + (el.textContent ?? "").trim().slice(0, 60));
        }
      } else if (r.type === "characterData") {
        const el = r.target.parentElement;
        if (el && !ignore(el) && inView(el)) note("text", (el.textContent ?? "").trim().slice(0, 60));
      } else if (r.type === "attributes") {
        const el = r.target;
        if (!ignore(el) && inView(el)) note("state", `${r.attributeName}=${el.getAttribute(r.attributeName)}`);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-expanded", "data-state", "aria-pressed", "aria-selected", "data-selected", "open", "aria-current", "disabled"] });
  const onFocus = (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    let r = el.getBoundingClientRect();
    let visible = inView(el) && uncovered(el);
    if (el.isContentEditable) {
      // An editor can be taller than the screen: what the maker sees is the caret.
      const range = getSelection()?.rangeCount ? getSelection().getRangeAt(0) : null;
      const caret = range ? range.getClientRects()[0] ?? range.startContainer.parentElement?.getBoundingClientRect?.() : null;
      if (caret) {
        r = caret;
        const top = document.elementFromPoint(Math.min(Math.max(caret.left + 1, 1), innerWidth - 1), Math.min(Math.max(caret.top + caret.height / 2, 1), innerHeight - 1));
        visible = caret.bottom > 0 && caret.top < innerHeight && Boolean(top && (el === top || el.contains(top)));
      }
    }
    note(visible ? "focus" : "focus (hidden)", `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? "[" + el.getAttribute("aria-label") + "]" : ""}${el.getAttribute("placeholder") ? "[" + el.getAttribute("placeholder") + "]" : ""} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${innerHeight}${visible ? "" : inView(el) ? " covered by " + (() => { const t = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + 20, innerHeight - 1)); return t ? (t.getAttribute("data-testid") || t.tagName.toLowerCase()) : "?"; })() : " offscreen"}`);
  };
  document.addEventListener("focusin", onFocus, true);
  const timer = setInterval(() => {
    if (location.href !== url) note("url", location.pathname + location.search);
    if (scrollX !== scroll[0] || scrollY !== scroll[1]) {
      note("scroll", `${scrollY}`);
      scroll[0] = scrollX;
      scroll[1] = scrollY;
    }
  }, 16);
  window.__watch = {
    done() {
      mo.disconnect();
      clearInterval(timer);
      document.removeEventListener("focusin", onFocus, true);
      const a = document.activeElement;
      const r = a?.getBoundingClientRect?.();
      return {
        seen,
        active: a ? { tag: a.tagName.toLowerCase(), label: a.getAttribute("aria-label") ?? a.getAttribute("placeholder") ?? (a.textContent ?? "").trim().slice(0, 40), top: Math.round(r?.top ?? 0), bottom: Math.round(r?.bottom ?? 0), visible: inView(a) && uncovered(a) } : null,
        bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
        dialogs: [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].filter(inView).map((d) => (d.getAttribute("aria-label") || d.textContent || "").trim().slice(0, 60)),
        menus: [...document.querySelectorAll("[role=menu]")].filter(inView).length,
        toasts: [...document.querySelectorAll("[data-sonner-toast], [role=status]")].filter(inView).map((d) => (d.textContent || "").trim().slice(0, 80)),
        url: location.pathname + location.search,
        viewport: { w: innerWidth, h: innerHeight },
      };
    },
  };
};

const byName = (page, role, name) => page.getByRole(role, { name, exact: false }).filter({ visible: true }).first();
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A menu row by the name it starts with ("Tool", not "New session · One sitting with one tool"). */
const menuItem = (page, name) => page.getByRole("menuitem").filter({ hasText: new RegExp(`^\\s*${esc(name)}`) }).filter({ visible: true }).first();
const openAdd = async (page) => {
  await page.getByTestId("sandbox-add").filter({ visible: true }).first().click();
  await page.getByRole("menu").first().waitFor({ state: "visible", timeout: 5000 });
};

/** screen, name, what it should do, how to reach it (setup), how to press it, and what counts as done. */
const ACTIONS = [
  // the composer, on the 7-step draft
  { screen: SEVEN, area: "Composer", name: "Add (open the menu)", should: "open the Add menu", press: (p) => p.getByTestId("sandbox-add").filter({ visible: true }).first(), expect: (r) => r.menus > 0 },
  ...[
    ["New session", "open the New session dialog", (r) => r.dialogs.length > 0],
    ["Prompt", "put the cursor in the add-prompt field, on screen, keyboard up", (r) => r.active?.label?.includes("prompt") && r.active.visible],
    ["Agent or team", "open the agent dialog", (r) => r.dialogs.length > 0],
    ["File", "open the file picker", (r) => r.fileChooser],
    ["Tool", "open the tool dialog", (r) => r.dialogs.length > 0],
    ["Manual step", "open the manual step dialog", (r) => r.dialogs.length > 0],
    ["Code", "open the code dialog", (r) => r.dialogs.length > 0],
    ["Check", "open the check dialog (or be shown disabled)", (r) => r.dialogs.length > 0 || r.disabledBefore],
    ["Result", "add a Result step and select it", (r) => r.seen.some((s) => s.kind === "appeared" && /result/i.test(s.detail))],
  ].map(([item, should, expect]) => ({ screen: SEVEN, area: "Composer › Add", name: item, should, setup: openAdd, press: (p) => menuItem(p, item), expect })),
  { screen: SEVEN, area: "Composer › Add", name: "Session (submenu)", should: "open the list of waiting sessions", setup: openAdd, press: (p) => menuItem(p, "Session"), hover: true, expect: (r) => r.menus > 1 },
  { screen: "/compose/new", area: "Composer › Add (new post)", name: "Prompt", should: "put the cursor in the add-prompt field, on screen", setup: openAdd, press: (p) => menuItem(p, "Prompt"), expect: (r) => r.active?.label?.includes("prompt") && r.active.visible },
  { screen: "/compose/new", area: "Composer › Add (new post)", name: "Result", should: "make the draft, add a Result step", setup: openAdd, press: (p) => menuItem(p, "Result"), expect: (r) => r.seen.some((s) => s.kind === "appeared" && /result/i.test(s.detail)) },
  { screen: "/compose/new", area: "Composer › Add (new post)", name: "New session", should: "open the New session dialog", setup: openAdd, press: (p) => menuItem(p, "New session"), expect: (r) => r.dialogs.length > 0 },
  { screen: SEVEN, area: "Composer", name: "List / Map: Map", should: "show the map", press: (p) => p.getByRole("radio", { name: "Map" }).or(p.getByRole("tab", { name: "Map" })).or(p.getByRole("button", { name: /^Map$/ })).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: SEVEN, area: "Composer", name: "Select a prompt (tap the card)", should: "select it and show its details", press: (p) => p.getByTestId("step-card").first(), expect: (r) => r.seen.some((s) => /data-selected|appeared|text/.test(s.kind + s.detail)) },
  { screen: SEVEN, area: "Composer", name: "Step menu (…)", should: "open the step's menu", press: (p) => p.getByRole("button", { name: /Prompt 1 options/ }).filter({ visible: true }).first(), expect: (r) => r.menus > 0 },
  { screen: SEVEN, area: "Composer", name: "Step menu › Read all of it", should: "open the whole prompt", setup: async (p) => { await p.getByRole("button", { name: /Prompt 1 options/ }).filter({ visible: true }).first().click(); await p.getByRole("menu").first().waitFor(); }, press: (p) => menuItem(p, "Read all of it"), expect: (r) => r.dialogs.length > 0 || r.seen.some((s) => s.kind === "appeared") },
  { screen: SEVEN, area: "Composer", name: "Step menu › Rename", should: "turn the title into a field", setup: async (p) => { await p.getByRole("button", { name: /Prompt 1 options/ }).filter({ visible: true }).first().click(); await p.getByRole("menu").first().waitFor(); }, press: (p) => menuItem(p, "Rename"), expect: (r) => r.active?.tag === "input" },
  { screen: SEVEN, area: "Composer", name: "Sources", should: "show Sources", press: (p) => p.getByRole("button", { name: /^Sources$/ }).filter({ visible: true }).first(), expect: (r) => r.dialogs.length > 0 || r.seen.length > 0, phoneOnly: true },
  { screen: SEVEN, area: "Composer", name: "Details", should: "show Details", press: (p) => p.getByRole("button", { name: /^Details$/ }).filter({ visible: true }).first(), expect: (r) => r.dialogs.length > 0 || r.seen.length > 0, phoneOnly: true },
  { screen: SEVEN, area: "Composer", name: "Card", should: "open the card editor", press: (p) => p.getByRole("button", { name: /^Card$/ }).filter({ visible: true }).first(), expect: (r) => r.dialogs.length > 0 || r.seen.some((s) => s.kind === "appeared") },
  { screen: SEVEN, area: "Composer", name: "Preview", should: "show the preview", press: (p) => p.getByRole("button", { name: /^Preview$/ }).filter({ visible: true }).first(), expect: (r) => r.dialogs.length > 0 || r.seen.some((s) => s.kind === "appeared") },
  { screen: SEVEN, area: "Composer", name: "Publish", should: "publish, or say what is missing", press: (p) => p.getByRole("button", { name: /^Publish$/ }).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: "/compose/new", area: "Composer", name: "Missing: a cover picture (link)", should: "take you to the cover", press: (p) => p.getByText("a cover picture or video").filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  // the post editor
  { screen: THREAD, area: "Post editor", name: "Type in post 1", should: "put the cursor in the post and show the letter", press: (p) => p.locator("main [contenteditable=true]").first(), type: "x", expect: (r) => r.seen.some((s) => s.kind === "text" || s.kind === "focus") },
  { screen: SEVEN, area: "Post editor", name: "What did you build? (first post)", should: "put the cursor in the post", press: (p) => p.locator("main [contenteditable=true]").first(), expect: (r) => r.active?.tag === "div" && r.active.visible },
  { screen: SEVEN, area: "Post editor", name: "Add another post", should: "start a second post", press: (p) => p.getByText("Add another post").filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: SEVEN, area: "Post editor › toolbar", name: "Picture", should: "open the file picker", press: (p) => p.getByRole("button", { name: "Picture or video" }).filter({ visible: true }).first(), expect: (r) => r.fileChooser },
  { screen: SEVEN, area: "Post editor › toolbar", name: "Bulleted list", should: "make a list", setup: async (p) => p.locator("main [contenteditable=true]").first().click(), press: (p) => p.getByRole("button", { name: "Bulleted list" }).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: SEVEN, area: "Post editor › toolbar", name: "Text size (Aa)", should: "open the text size menu", press: (p) => p.getByRole("button", { name: "Text size" }).filter({ visible: true }).first(), expect: (r) => r.menus > 0 || r.seen.length > 0 },
  { screen: SEVEN, area: "Post editor › toolbar", name: "@ (reference)", should: "open references", press: (p) => p.getByRole("button", { name: "Link to a tile or session" }).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: SEVEN, area: "Post editor › toolbar", name: "Add to the post (+)", should: "open what can be added", press: (p) => p.getByRole("button", { name: "Add another post" }).or(p.getByRole("button", { name: "Add to the post" })).filter({ visible: true }).first(), expect: (r) => r.menus > 0 || r.seen.length > 0 },
  // drafts
  { screen: "/drafts", area: "Drafts", name: "Open a draft", should: "open it in the composer", press: (p) => p.getByText("Pantry inventory helper").filter({ visible: true }).first(), expect: (r) => /\/compose\//.test(r.url) },
  { screen: "/drafts", area: "Drafts", name: "Start a new build", should: "open a new post", press: (p) => p.getByText("Start a new build").filter({ visible: true }).first(), expect: (r) => /\/compose\//.test(r.url) },
  { screen: "/drafts", area: "Drafts", name: "Connect a tool", should: "open the connector guide", press: (p) => p.getByRole("button", { name: /Connect a tool/ }).filter({ visible: true }).first(), expect: (r) => r.dialogs.length > 0 },
  { screen: "/drafts", area: "Drafts", name: "Session › its menu", should: "offer Start a build / Add to a draft / Remove", press: (p) => p.locator("main").getByRole("button", { name: /^(Add|Start|Put)/i }).filter({ visible: true }).first(), expect: (r) => r.menus > 0 || r.dialogs.length > 0 },
  { screen: "/drafts", area: "Drafts", name: "Show N already in a build", should: "list the sessions already in builds", press: (p) => p.getByRole("button", { name: /already in a build/ }).filter({ visible: true }).first(), expect: (r) => r.seen.some((s) => s.kind === "appeared") },
  // build page
  { screen: `/b2/${L.showcaseSlug}`, area: "Build page", name: "Copy for AI", should: "copy, and say so", press: (p) => p.locator("main").getByRole("button", { name: /copy/i }).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: `/b2/${L.showcaseSlug}`, area: "Build page", name: "Rebuild", should: "start a rebuild", press: (p) => p.locator("main").getByRole("link", { name: /rebuild/i }).or(p.locator("main").getByRole("button", { name: /rebuild/i })).filter({ visible: true }).first(), expect: (r) => /rebuild/.test(r.url) || r.dialogs.length > 0 },
  { screen: `/b2/${L.showcaseSlug}`, area: "Build page", name: "Second tab", should: "switch tab", press: (p) => p.locator("main").getByRole("tab").nth(1), expect: (r) => r.seen.length > 0 },
  { screen: `/b2/${L.showcaseSlug}`, area: "Build page", name: "Like / me too", should: "count it", press: (p) => p.locator("main").getByRole("button", { name: /me too|like/i }).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  // header and tabs
  ...["Home", "Gallery", "Bounties", "Library", "Drafts"].map((name) => ({ screen: "/drafts", area: "Header", name, should: `go to ${name}`, press: (p) => p.getByRole("navigation").getByRole("link", { name }).filter({ visible: true }).first(), expect: (r) => r.seen.some((s) => s.kind === "url") || r.url !== "/drafts" || name === "Drafts", desktopOnly: true })),
  { screen: "/drafts", area: "Header", name: "New build", should: "open a new post", press: (p) => p.getByRole("button", { name: /New build/ }).or(p.getByRole("link", { name: /New build/ })).filter({ visible: true }).first(), expect: (r) => /compose/.test(r.url), desktopOnly: true },
  { screen: "/drafts", area: "Header", name: "Search", should: "open search", press: (p) => p.getByRole("button", { name: /search/i }).or(p.getByRole("searchbox")).filter({ visible: true }).first(), expect: (r) => r.seen.length > 0 },
  { screen: "/drafts", area: "Header", name: "Account (avatar)", should: "open the account menu", press: (p) => p.locator("header").getByRole("button").last(), expect: (r) => r.menus > 0 || r.dialogs.length > 0 || r.seen.some((s) => s.kind === "url") },
  ...["Home", "Gallery", "New", "Bounties", "Activity"].map((name) => ({ screen: "/drafts", area: "Bottom tabs", name, should: `go to ${name}`, press: (p) => p.getByRole("link", { name: new RegExp(`^${name}`) }).filter({ visible: true }).last(), expect: (r) => r.seen.some((s) => s.kind === "url"), phoneOnly: true })),
];

async function run(action) {
  await resetData();
  await standin({ latency: 120 });
  const { browser, page } = await open(profileName);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
  let fileChooser = false;
  page.on("filechooser", () => (fileChooser = true));
  const out = { area: action.area, name: action.name, screen: action.screen.replace(L.sevenStep, "{7-step}").replace(L.thread, "{thread}"), should: action.should, profile: profileName };
  try {
    await page.goto(SITE + action.screen);
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(phone ? 1500 : 600);
    if (action.setup) await action.setup(page);
    await page.waitForTimeout(250);
    const target = action.press(page);
    await target.waitFor({ state: "visible", timeout: 8000 });
    await target.scrollIntoViewIfNeeded().catch(() => {});
    const disabledBefore = await target.evaluate((el) => el.disabled || el.getAttribute("aria-disabled") === "true" || el.getAttribute("data-disabled") !== null).catch(() => false);
    const box = await target.boundingBox();
    out.target = box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null;
    out.covered = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return t && !(t === el || el.contains(t)) ? (t.getAttribute("data-testid") || t.tagName.toLowerCase()) : null;
    }).catch(() => null);
    // Point at it first: Radix focuses a menu row when the pointer reaches it, which is not the press's effect.
    if (!phone) await target.hover({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
    await clearLog();
    await page.evaluate(WATCH);
    const pressedAt = Date.now();
    if (action.hover) await target.hover();
    else if (phone) await target.tap({ timeout: 5000, force: Boolean(out.covered) });
    else await target.click({ timeout: 5000 });
    if (action.type) await page.keyboard.type(action.type);
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => window.__watch.done());
    r.fileChooser = fileChooser;
    r.disabledBefore = disabledBefore;
    const reqs = (await serverLog()).filter((e) => e.method !== "OPTIONS" && e.method !== "WS" && !/dm_presence/.test(e.path));
    const firstVisible = r.seen.find((s) => s.kind !== "focus (hidden)");
    const hiddenFocus = r.seen.find((s) => s.kind === "focus (hidden)");
    const ok = Boolean(action.expect(r));
    out.firstVisibleMs = firstVisible ? firstVisible.ms : null;
    // The first change the maker would read as the press working: not focus landing on what was pressed, not a menu
    // closing. This is the number the table reports.
    const effect = r.seen.find((x) => !x.kind.startsWith("focus") && !/data-state=closed|aria-expanded=false/.test(x.detail));
    out.effectMs = effect ? effect.ms : null;
    out.effect = effect ? `${effect.kind}: ${effect.detail}` : null;
    out.seen = r.seen.slice(0, 40);
    out.whatChanged = firstVisible ? `${firstVisible.kind}: ${firstVisible.detail}` : hiddenFocus ? `focus (hidden): ${hiddenFocus.detail}` : "nothing";
    out.expectedHappened = ok;
    out.active = r.active;
    out.dialogs = r.dialogs;
    out.toasts = r.toasts;
    out.requests = reqs.map((e) => `${e.method} ${e.status}${e.code ? " " + e.code : ""} ${e.path.split("?")[0].replace("/rest/v1/", "")} ${e.ms}ms`);
    out.bodyPointerEvents = r.bodyPointerEvents;
    out.errors = errors;
    out.fileChooser = fileChooser;
    out.disabledBefore = disabledBefore;
    // A menu closing and focus moving are not, by themselves, something the maker can see happen.
    const meaningful = r.seen.filter((x) => !x.kind.startsWith("focus") && !/data-state=closed|aria-expanded=false/.test(x.detail));
    out.verdict = ok
      ? fileChooser || (out.effectMs ?? out.firstVisibleMs) === null || (out.effectMs ?? out.firstVisibleMs) <= 300 ? "Works" : "Slow"
      : errors.length
        ? "Broken"
        : meaningful.length || reqs.length || hiddenFocus
          ? "Silent"
          : "Broken";
    if (!ok && r.active && /^Add$/.test(r.active.label ?? "")) out.note = "focus went back to the Add button";
    void pressedAt;
  } catch (error) {
    const message = String(error.message);
    // Playwright will not press what lies outside the screen: neither can the maker.
    out.verdict = /outside of the viewport/.test(message) ? "Broken" : "Not reached";
    if (/outside of the viewport/.test(message)) out.whatChanged = "cannot be pressed: the row is outside the screen";
    out.error = message.split("\n")[0].slice(0, 200);
  }
  await browser.close();
  return out;
}

const results = [];
for (const action of ACTIONS) {
  if (action.phoneOnly && !phone) continue;
  if (action.desktopOnly && phone) continue;
  if (filter && !filter.test(`${action.area} ${action.name}`)) continue;
  const r = await run(action);
  results.push(r);
  console.log(`${profileName.padEnd(7)} ${r.verdict.padEnd(11)} ${String(r.firstVisibleMs ?? "-").padStart(5)} ms  ${(r.area + " › " + r.name).padEnd(52)} ${r.whatChanged ?? r.error ?? ""}`.slice(0, 220));
}
// A filtered run replaces its rows in the full file, so one control can be measured again.
const full = path.join(OUT, `actions-${profileName}.json`);
if (filter && existsSync(full)) {
  const rows = JSON.parse(readFileSync(full, "utf8"));
  for (const r of results) {
    const at = rows.findIndex((x) => x.area === r.area && x.name === r.name);
    if (at >= 0) rows[at] = r;
    else rows.push(r);
  }
  writeFileSync(full, JSON.stringify(rows, null, 2));
} else write(`actions-${profileName}.json`, results);

// The CSV of both profiles, when both exist.
const both = ["desktop", "iphone"].map((p) => path.join(OUT, `actions-${p}.json`));
if (both.every(existsSync)) {
  const rows = both.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let csv = "profile,area,control,screen,should,verdict,ms_to_visible_effect,visible_effect,first_change,expected_happened,final_focus,requests,errors,note\n";
  for (const r of rows) csv += [r.profile, r.area, r.name, r.screen, r.should, r.verdict, r.effectMs ?? "", r.effect ?? "", r.whatChanged ?? r.error, r.expectedHappened, r.active ? `${r.active.tag} ${r.active.label} visible=${r.active.visible}` : "", (r.requests ?? []).join(" | "), (r.errors ?? []).join(" | "), r.note ?? ""].map(q).join(",") + "\n";
  writeFileSync(path.join(OUT, "actions.csv"), csv);
}
