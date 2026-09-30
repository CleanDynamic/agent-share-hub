// RC-P28 — what a way into a parked feature looks like in a rendered DOM: a
// link to its address, or an element whose own text or accessible label names
// it. Guilds, leaderboards and reputation are parked (src/lib/progress/flags.ts),
// so every surface's test expects this list to be empty.

const ADDRESS = /^\/(guilds|leaderboards|reputation)(?:[/?#]|$)/;
const NAME = /\b(guilds?|leaderboards?|reputation)\b/i;

/** Every link to a parked address, and every element naming a parked feature, under `root`. */
export function parkedEntryPoints(root: ParentNode): string[] {
  const links = [...root.querySelectorAll("a[href]")]
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => ADDRESS.test(new URL(href, "http://localhost").pathname))
    .map((href) => `link to ${href}`);
  const labelled = [...root.querySelectorAll("[aria-label], [title]")]
    .map((element) => `${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""}`.trim())
    .filter((label) => NAME.test(label))
    .map((label) => `label "${label}"`);
  const named = [...root.querySelectorAll("*")]
    .filter((element) =>
      [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && NAME.test(node.textContent ?? "")),
    )
    .map((element) => `text "${element.textContent?.trim()}"`);
  return [...links, ...labelled, ...named];
}
