import type { CSSProperties } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { levelLamp } from "@/lib/theme/progress";

export type ProgressTab = { id: string; label: string; isNew?: boolean };

export interface ProgressTabBarProps {
  tabs: ProgressTab[];
  active: string;
  onChange: (id: string) => void;
}

/**
 * The progress tab bar — repainted onto BG-P07's tab contract (BG-P28b).
 *
 * THE ACTIVE TAB IS AN `--action` UNDERLINE, NOT A FILL, which is the rule
 * BG-P07 set for every tab row in the product: a row is a set of labels with
 * one of them current, and filling the current one makes it read as a button
 * while its neighbours read as text.
 *
 * THE UNDERLINE STAYS A 2px BORDER HERE RATHER THAN BECOMING AN INSET SHADOW.
 * BG-P07's `TAB_TRIGGER_CLASS` uses `inset 0 -2px` because a Radix trigger has
 * no border to begin with and gaining one would shift the row. This bar already
 * declares `borderBottom: 2px solid …` on EVERY tab, active or not — so the
 * 2px is already in the box on both states and swapping the colour moves
 * nothing. Reaching for the shadow instead would mean removing a border that is
 * load-bearing for this row's height, which is a layout change.
 *
 * THE isNew DOT WAS A GLOWING ORANGE PIP — `background: #E8571A` with an
 * 8px `box-shadow` of the same hue. Two things were wrong with it: orange is
 * `--action`, which means "the primary thing to do" rather than "something
 * arrived here", and a glow on Exhibition has nothing to glow against. It is
 * the ladder's lamp now: a solid amber mark, which is what the system uses to
 * say "progress" everywhere else.
 */
export function ProgressTabBar({ tabs, active, onChange }: ProgressTabBarProps) {
  const wrap: CSSProperties = {
    display: "flex",
    gap: 24,
    borderBottom: `0.5px solid ${t.line}`,
    padding: "0 4px",
    overflowX: "auto",
  };
  return (
    <div style={wrap}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            style={{
              position: "relative",
              background: "transparent",
              border: 0,
              padding: "12px 0",
              fontFamily: FIGTREE,
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? t.text : t.text2,
              borderBottom: `2px solid ${isActive ? t.action : "transparent"}`,
              cursor: "pointer",
              marginBottom: -0.5,
              textTransform: "capitalize",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: r.chip,
              transition: "color 160ms ease-out",
            }}
          >
            {tab.label}
            {tab.isNew && (
              <span
                aria-label="New"
                style={{ ...levelLamp({ size: 7 }), display: "inline-block" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ProgressTabBar;
