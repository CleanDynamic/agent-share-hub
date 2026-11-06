// UX-12 P2: the pure parts of a legal page. Formatting only; nothing here reads the network or the router.

import { NEED_PATTERN } from "@/content/legal/types";

/** "2026-11-04" -> "4 November 2026". A date that does not parse is returned as written. */
export function formatLastUpdated(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export type Piece = { kind: "text"; text: string } | { kind: "need"; text: string } | { kind: "link"; text: string; href: string };

const LINKS: Record<string, string> = { "ico.org.uk": "https://ico.org.uk" };

/** A sentence cut into plain text, `{{NEED: …}}` placeholders and the few outside addresses the text names. */
export function piecesOf(text: string): Piece[] {
  const pattern = new RegExp(`${NEED_PATTERN.source}|${Object.keys(LINKS).map((address) => address.replace(/\./g, "\\.")).join("|")}`, "g");
  const out: Piece[] = [];
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > from) out.push({ kind: "text", text: text.slice(from, at) });
    out.push(match[0].startsWith("{{") ? { kind: "need", text: match[0] } : { kind: "link", text: match[0], href: LINKS[match[0]] });
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
