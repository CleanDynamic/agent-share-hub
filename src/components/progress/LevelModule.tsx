// Mobile 28 D: the Level module at the top of the phone's Your progress. A module on Card (the frame's panel is the Panel
// shade on a phone): "Level 7" 20/600 and "1,240 XP · 260 to level 8" in mono 13 Text 2 on one line, the bar (8 tall, radius
// 4, Raised, the filled part Mint) and XP-DESIGN.md's line about XP at 13 Text 3. The bar is a progressbar named for the
// level. Loading is the module's shape in blocks; a failed read is the progress page's refusal, never a level nobody measured.

import { useMyLevel } from "@/hooks/useProgressPage";
import { levelLine, XP_LINE } from "@/lib/progress/level";
import { skeletonStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular } from "@/lib/theme/type";

import { SectionRefusal } from "./SectionRefusal";

export const LEVEL_BAR_HEIGHT = 8;

const box = { background: t.module, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 } as const;

export function LevelModule() {
  const level = useMyLevel(true);
  if (level.isLoading) {
    return (
      <section data-testid="progress-level" aria-busy="true" aria-label="Loading your level" style={box}>
        <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: 24, width: "60%" }} />
        <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: LEVEL_BAR_HEIGHT, borderRadius: 4 }} />
        <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: 16, width: "70%" }} />
      </section>
    );
  }
  if (level.error || !level.data) {
    return (
      <section data-testid="progress-level" aria-label="Your level" style={box}>
        <SectionRefusal data-testid="progress-level-error" error={level.error} onRetry={() => void level.refetch()} />
      </section>
    );
  }
  const progress = level.data;
  const name = `Level ${progress.level}`;
  return (
    <section data-testid="progress-level" aria-labelledby="progress-level-heading" style={box}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 4 }}>
        <h2 id="progress-level-heading" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", letterSpacing: "-0.01em", color: t.text }}>
          {name}
        </h2>
        <span data-testid="progress-level-line" style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.text2, ...tabular }}>
          {levelLine(progress)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.fraction * 100)}
        aria-valuetext={`${progress.toNext.toLocaleString("en-GB")} XP to level ${progress.level + 1}`}
        style={{ height: LEVEL_BAR_HEIGHT, borderRadius: 4, background: t.control, overflow: "hidden" }}
      >
        <div data-testid="progress-level-fill" style={{ height: "100%", width: `${progress.fraction * 100}%`, background: t.brandAccent, borderRadius: 4 }} />
      </div>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{XP_LINE}</p>
    </section>
  );
}

export default LevelModule;
