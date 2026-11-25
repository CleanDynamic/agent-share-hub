// /analytics — the progress page (RC-P27).
//
// One panel at 820 in the site frame, the h1 "Your progress" at 31/36 (no subtitle), then the sections 32 apart, in this
// order: Needs you (only when something does), the builds table headed by its fact, This week, and the badges. There is no
// level, no XP and no reset note, and nothing stands in their place. The run-based parts (reproduction figures, run
// challenges, run badges) are not drawn.

import { SeoHead } from "@/components/SeoHead";
import { BuildAnalytics } from "@/components/analytics/BuildAnalytics";
import { BadgesSection } from "@/components/progress/BadgesSection";
import { ThisWeek } from "@/components/progress/ThisWeek";
import { READING_WIDTH, ReadingPanel } from "@/components/shell/ReadingPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { hero } from "@/lib/theme/type";

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const phone = useIsPhone();
  /* Mobile 28 D: on a phone the top bar names the page ("Your progress") and the h1 is for screen readers. */
  useRegisterPageBar(phone ? { title: "Your progress" } : null);

  if (authLoading) {
    return (
      <ReadingPanel width={READING_WIDTH.progress}>
        <Skeleton className="h-9 w-60" />
      </ReadingPanel>
    );
  }
  if (!user) return null;

  return (
    <>
      <SeoHead
        title="Your progress"
        description="Your builds' numbers, this week's challenges and your badges."
        path="/analytics"
      />
      <ReadingPanel width={READING_WIDTH.progress} data-testid="progress-panel">
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? 0 : 32, minWidth: 0, ...(phone ? { padding: "8px 0 24px" } : null) }}>
          <h1 className={phone ? "sr-only" : undefined} style={phone ? undefined : { ...hero, margin: 0, color: t.text }}>Your progress</h1>
          <div data-testid="progress-page" style={{ display: "flex", flexDirection: "column", gap: phone ? 24 : 32, minWidth: 0 }}>
            <BuildAnalytics />
            <ThisWeek />
            <BadgesSection />
          </div>
        </div>
      </ReadingPanel>
    </>
  );
}
