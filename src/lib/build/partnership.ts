// SV-27 P7: a paid partnership or vendor affiliation, kept as `making.partnership = { partner, kind }` and written through SV-07's
// `making` writer (`makingStep`). Its own module, so the first download does not carry it. A copy never carries it: a fork copies
// no `making`.

import { buildLayerError, type BuildPatch } from "./types";
import { makingStep } from "./making";

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

export const PARTNERSHIP_KINDS = ["paid", "works_for"] as const;
export type PartnershipKind = (typeof PARTNERSHIP_KINDS)[number];
export const PARTNER_MAX = 60;

export interface Partnership {
  partner: string;
  kind: PartnershipKind;
}

export const PARTNERSHIP_COPY = {
  menu: "Partnership or affiliation",
  partner: "Partner",
  kinds: { paid: "Paid partnership", works_for: "I work for this company" } as Record<PartnershipKind, string>,
  remove: "Remove",
  needsPartner: "Name the partner.",
} as const;

/** `making.partnership`, read defensively; null when there is none. */
export function partnershipOf(making: unknown): Partnership | null {
  const raw = asObject(asObject(making).partnership);
  const partner = typeof raw.partner === "string" ? raw.partner.trim().slice(0, PARTNER_MAX) : "";
  if (!partner || !PARTNERSHIP_KINDS.includes(raw.kind as PartnershipKind)) return null;
  return { partner, kind: raw.kind as PartnershipKind };
}

/** "Paid partnership with Example Partner", "Made by someone at Example Partner". */
export const partnershipLine = (partnership: Partnership): string => (partnership.kind === "paid" ? `Paid partnership with ${partnership.partner}` : `Made by someone at ${partnership.partner}`);

export function partnershipRefusal(partnership: Partnership): string | null {
  const partner = partnership.partner.trim();
  if (!partner) return PARTNERSHIP_COPY.needsPartner;
  if (partner.length > PARTNER_MAX) return `${PARTNERSHIP_COPY.partner}: ${PARTNER_MAX} characters max`;
  if (!PARTNERSHIP_KINDS.includes(partnership.kind)) return "That is not a kind of partnership.";
  return null;
}

/** Store the partnership through the `making` writer, or take the key off (null). A copy never carries it: fork copies no `making`. */
export function setPartnership(buildId: string, partnership: Partnership | null): Promise<Record<string, unknown>> {
  if (partnership) {
    const why = partnershipRefusal(partnership);
    if (why) return Promise.reject(buildLayerError("setPartnership", new Error(why)));
  }
  return makingStep(buildId, "setPartnership", ({ making }) => {
    const { partnership: _was, ...rest } = making;
    const next = partnership ? { ...rest, partnership: { partner: partnership.partner.trim(), kind: partnership.kind } } : rest;
    return { patch: { making: next } as unknown as BuildPatch, result: next };
  });
}
