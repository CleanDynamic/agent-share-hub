/* UI-P28 — the two small things the legacy Gallery page draws that the reference
   has no place for, carried across unchanged in what they say and who sees it.

   SHORTFALL. Why a build has not earned its place, to the one person who can fix
   it: the signed-in creator, for a build an admin promoted past the bar. Plain
   instructions in the creator's terms, never a score. Under the card, in the
   data face, `--text2`. (Copied from `pages/Gallery.tsx`, which is not edited;
   UI-P41 deletes that page and this is the one that remains.)

   MAKERS. Up to three makers whose names match the search, above the wall: a
   scent, not a second list.

   Both take the density table since UI-P56: the shortfall in 12px mono, the
   makers row 6 apart and 10 above the wall. */

import { MakerLink } from "@/components/profile/MakerLink";
import {
  galleryShortfall,
  galleryThreshold,
  requirementCopy,
  type GalleryBuild,
  type MissingItem,
} from "@/lib/build";
import { linkableMakers, type MakerHit } from "@/lib/profile/searchMakers";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, eyebrow } from "@/lib/theme/type";

const hasText = (value: string | null | undefined): boolean => typeof value === "string" && value.trim().length > 0;

const hasEntries = (value: string[] | null | undefined): boolean =>
  Array.isArray(value) && value.some((entry) => (entry ?? "").trim().length > 0);

const item = (key: "outcome" | "made_for" | "made_with"): MissingItem => ({ key, copy: requirementCopy(key) });

/** The gallery requirements a card row carries enough columns to answer. */
function provableMissing(build: GalleryBuild): MissingItem[] {
  const missing: MissingItem[] = [];
  if (!hasText(build.outcome)) missing.push(item("outcome"));
  if (!hasEntries(build.made_for)) missing.push(item("made_for"));
  if (!hasEntries(build.made_with)) missing.push(item("made_with"));
  return missing;
}

/** "a", "a and b", "a, b and c". */
function sentence(items: readonly MissingItem[]): string {
  const parts = items.map((entry) => entry.copy);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function Shortfall({ build, viewerId }: { build: GalleryBuild; viewerId: string | null }) {
  if (!viewerId || viewerId !== build.creator_id) return null;

  const score = build.completeness ?? 0;
  if (score >= galleryThreshold(build.shape)) return null;

  const outstanding = galleryShortfall(build.shape, score, provableMissing(build));
  if (outstanding.length === 0) return null;

  return (
    <p
      data-testid="gallery-shortfall"
      style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1.45, margin: 0, padding: "6px 6px 0", color: t.text2 }}
    >
      Only you can see this — to earn its place in the gallery, {sentence(outstanding)}.
    </p>
  );
}

export function MakersRow({ makers }: { makers: MakerHit[] }) {
  const linkable = linkableMakers(makers);
  if (linkable.length === 0) return null;

  return (
    <section
      aria-labelledby="gallery-makers-heading"
      data-testid="gallery-makers"
      style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}
    >
      <h2 id="gallery-makers-heading" style={{ ...eyebrow, margin: 0, color: t.text2 }}>
        Makers
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", columnGap: 17, rowGap: 6 }}>
        {linkable.map((maker) => (
          <li key={maker.id} style={{ minWidth: 0 }}>
            <MakerLink maker={maker} testId="gallery-maker" />
          </li>
        ))}
      </ul>
    </section>
  );
}
