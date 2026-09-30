// /analytics — the progress page, in six sections (RC-P27).
//
// EXACTLY THESE, IN THIS ORDER, AND NOTHING ELSE ⟦better-layout › Order by
// importance⟧ ⟦critique-information-density › Progressive Disclosure⟧:
//
//   1. the reset note, until it is read (RC-P25's ResetNote);
//   2. PROGRESS: the level, the XP, the XP to the next level, the bar, and
//      how XP is earned;
//   3. NEEDS YOU, the builds waiting on their maker, left out when none is
//      (RC-P23);
//   4. YOUR BUILDS, the maker's figures and the table (RC-P23);
//   5. THIS WEEK, the three weekly challenges ⟦hicks-law › Budgets⟧;
//   6. BADGES, the ten, earned first.
//
// The old product's panels are not mounted: the tab bar, the skill tree and
// its perks, today's daily nudge, the quest checklist, the next unlock, the
// eligibility notice, the streak flame, calendar and freezes, the creator
// marks and the showcase, the XP ledger and the challenge history. Their files
// stay until RC-P29, and nothing on this page asks for their data.
//
// SPACING ⟦buildgallery-theme › Spacing scale⟧: sections are 64 apart, in this
// new wrapper; inside each section its children are 16 apart, in the
// section's own. The column around them is the page's existing layout element
// and keeps every structural value it had (CONTRACT §2.2).
//
// ONE LIGHT ⟦von-restorff-effect⟧: nothing here is filled but the progress
// fills (and a badge's tier, which is how BadgeMark draws one), and the page
// adds no primary action; its buttons are ghost or secondary.

import { SeoHead } from "@/components/SeoHead";
import { BuildAnalytics } from "@/components/analytics/BuildAnalytics";
import { BadgesSection } from "@/components/progress/BadgesSection";
import { ProgressSection } from "@/components/progress/ProgressSection";
import { ResetNote } from "@/components/progress/ResetNote";
import { ThisWeek } from "@/components/progress/ThisWeek";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { SPACE } from "@/lib/theme/space";

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Skeleton className="h-8 w-48" /></div>;
  }
  if (!user) return null;

  return (
    <>
      <SeoHead
        title="Your Progress — buildgallery.ai"
        description="Your level and XP, your builds' numbers, this week's challenges and your badges."
        path="/analytics"
      />
      <ShellHeader title="Your Progress" />
      <div
        className="mx-auto"
        style={{
          maxWidth: 760,
          padding: "16px 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          data-testid="progress-page"
          style={{ display: "flex", flexDirection: "column", gap: SPACE.xl, minWidth: 0 }}
        >
          <ResetNote />
          <ProgressSection />
          <BuildAnalytics />
          <ThisWeek />
          <BadgesSection />
        </div>
      </div>
    </>
  );
}
