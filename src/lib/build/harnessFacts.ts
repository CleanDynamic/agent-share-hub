// SV-27 P5 and P8: what a harness's own docs say about it, as the composer and the build page show it. Facts come only from the
// registry entry's `facts`, which is filled from the entry's source page; a fact with no source stays empty. A vendor's default
// is always shown as the vendor's ("OpenClaw's default: full access (its docs, October 2026)"), never as the site's own claim.
// PURE.

import { toolFor } from "@/lib/tools/registry";

import { APPROVAL_LABEL, type ApprovalMode, type Sandbox } from "./agentFields";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" as "October 2026"; the text as it is when it is not a month. */
export function monthWord(checked: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(checked.trim());
  if (!match) return checked;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : checked;
}

/** The approval words a default reads as, lower case after the harness's name. */
const DEFAULT_WORDS: Record<ApprovalMode, string> = { full: "full access", risky: "asks before risky actions", every: "asks before every action", reviewer: "an AI reviewer, then asks you" };

/** The harness's facts, or null when it has none from a source. */
export function harnessFacts(harness: string | null | undefined) {
  const tool = toolFor(harness);
  return tool?.facts ? { name: tool.name, ...tool.facts } : null;
}

/** "OpenClaw's default: full access (its docs, October 2026)", or null when its docs state no default. */
export function harnessDefaultLine(harness: string | null | undefined): string | null {
  const facts = harnessFacts(harness);
  const mode = facts?.defaults?.approval_mode;
  if (!facts || !mode) return null;
  return `${facts.name}'s default: ${DEFAULT_WORDS[mode] ?? APPROVAL_LABEL[mode]} (its docs, ${monthWord(facts.checked)})`;
}

/** The harness runs actions without asking by default, by its own docs. */
export const harnessDefaultsToFull = (harness: string | null | undefined): boolean => harnessFacts(harness)?.defaults?.approval_mode === "full";

/** The harness is run by its vendor, on the vendor's servers. */
export const isVendorHosted = (harness: string | null | undefined): boolean => harnessFacts(harness)?.hosting === "vendor";

/** The sandbox the window shows: the maker's choice, else The vendor's cloud for a vendor-hosted harness, else nothing. */
export const sandboxShown = (sandbox: Sandbox | undefined, harness: string | null | undefined): Sandbox | undefined => sandbox ?? (isVendorHosted(harness) ? "vendor" : undefined);

/** "Self-hosted · MIT", the hosting and licence where known; null when neither is. */
export function hostingLine(harness: string | null | undefined): string | null {
  const facts = harnessFacts(harness);
  if (!facts) return null;
  const parts = [facts.hosting === "vendor" ? "Vendor-hosted" : facts.hosting === "self-hosted" ? "Self-hosted" : null, facts.licence ?? null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
