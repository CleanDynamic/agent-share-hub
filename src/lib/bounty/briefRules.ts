// SV-22 P1: when a build can be a brief, and the words for its answers. PURE: no Supabase.

import { NO_TITLE, hasTitle } from "@/lib/build/publish";

export const NO_GAPS = "A brief needs at least one open step.";
export const NOT_PUBLISHED = "Publish the build before you make it a brief.";

/** Why a build cannot be a brief, or null when it can: published, titled, and with at least one open step (a gap node). */
export function briefRefusal(build: { status: string; title: string | null | undefined }, gapCount: number): string | null {
  if (build.status !== "published" && build.status !== "gallery") return NOT_PUBLISHED;
  if (!hasTitle(build.title)) return NO_TITLE;
  return gapCount > 0 ? null : NO_GAPS;
}

/** The two newest answers, whose comparison "Compare answers" opens (`compare.ts` reads two sides); null with fewer than two. */
export function comparePair<T extends { slug: string }>(answers: readonly T[]): [T, T] | null {
  return answers.length >= 2 ? [answers[0], answers[1]] : null;
}
