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
import { t } from "@/lib/theme/tokens";
import { hero } from "@/lib/theme/type";

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();

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
        <div style={{ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>
          <h1 style={{ ...hero, margin: 0, color: t.text }}>Your progress</h1>
          <div data-testid="progress-page" style={{ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>
            <BuildAnalytics />
            <ThisWeek />
            <BadgesSection />
          </div>
        </div>
      </ReadingPanel>
    </>
  );
}
