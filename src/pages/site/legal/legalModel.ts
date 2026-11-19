// UX-12 P2: the pure parts of a legal page. Formatting only; nothing here reads the network or the router.

import { NEED_PATTERN, type LegalLink } from "@/content/legal/types";
import { reportError } from "@/lib/errors/report";

/** "2026-11-04" -> "4 November 2026". A date that does not parse is returned as written. */
export function formatLastUpdated(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export type Piece = { kind: "text"; text: string } | { kind: "need"; text: string } | { kind: "link"; text: string; href: string };

const LINKS: Record<string, string> = { "ico.org.uk": "https://ico.org.uk" };

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A sentence cut into plain text, `{{NEED: …}}` placeholders, the few outside addresses the text names and the links the
 * paragraph lists. A listed `text` that is not in the sentence exactly once throws in development; in production the
 * sentence is drawn without that link and the fault is reported with the section id and no user text.
 */
export function piecesOf(text: string, links: readonly LegalLink[] = [], section = ""): Piece[] {
  const hrefs: Record<string, string> = { ...LINKS };
  for (const link of links) {
    const count = text.split(link.text).length - 1;
    if (count !== 1) {
      if (import.meta.env.DEV) throw new Error(`Legal link "${link.text}" must appear exactly once in its paragraph (found ${count}).`);
      reportError(new Error("legal link text not found once"), { source: "legal-links", context: section });
      continue;
    }
    hrefs[link.text] = link.href;
  }
  const pattern = new RegExp(`${NEED_PATTERN.source}|${Object.keys(hrefs).map(escape).join("|")}`, "g");
  const out: Piece[] = [];
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > from) out.push({ kind: "text", text: text.slice(from, at) });
    out.push(match[0].startsWith("{{") ? { kind: "need", text: match[0] } : { kind: "link", text: match[0], href: hrefs[match[0]] });
    from = at + match[0].length;
  }
  if (from < text.length) out.push({ kind: "text", text: text.slice(from) });
  return out;
}

export const DRAFT_NOTICE = "This is a draft and has not been reviewed yet.";

/** The address that scrolls to a section. */
export const anchorOf = (id: string): string => `#${id}`;

/** The hash in an address, without the "#", decoded; "" when there is none. */
export function hashTarget(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return "";
  }
}
