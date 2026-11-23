// Synth 15: the reading pages' shared styles (the legal pages, the footer pages, About).

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";

/** The Card recipe for a box inside the panel: Card fill, radius 12, 14px 16px, no edge. */
export const CARD_BOX: CSSProperties = { background: t.module, border: 0, borderRadius: 12, padding: "14px 16px" };

/** A section's h2 on a reading page: 17/600. */
export const SECTION_HEADING: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: textStep.section, fontWeight: 600, lineHeight: "24px", color: t.text };
