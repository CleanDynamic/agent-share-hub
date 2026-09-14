import type { ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * A section heading on the progress page. Repainted by BG-P28b: the title was
 * white at 0.92 and the subtitle white at 0.45 — the first invisible on
 * Exhibition, the second below the text floor in either room.
 *
 * The sizes are untouched. 16px is under the 20px floor for the display face,
 * so this stays Figtree rather than becoming Bodoni; growing it to reach the
 * floor would change the rhythm of every section on the page, which is a layout
 * decision rather than a paint one.
 */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: FIGTREE,
            fontSize: 16,
            fontWeight: 600,
            color: t.text,
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: t.text2, marginTop: 2 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
