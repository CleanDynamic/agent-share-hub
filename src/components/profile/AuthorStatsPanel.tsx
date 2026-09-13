// The author-stats panel — repainted for BG-P25.
//
// THESE ARE COUNTS, NOT CLAIMS, and the repaint is where that distinction gets
// made visible. The two figures a reader should trust — reproductions received
// and rebuilds of this creator's work — are up in the header on the plaque's
// own treatment; everything in this panel is a number the creator's own
// activity produced, so it takes `--text` on a `--recess` ground and no accent
// at all. A 22px figure in full ink was competing with the header for the eye
// and winning, which is the opposite of what `visual-hierarchy` asks of a
// profile: the entry point is the work.
//
// THE BLOCK-TYPE FINGERPRINT RESOLVES INTO THE NINE CATEGORY HUES. Its colours
// used to come from `getAuthorStats`, as `hsl(var(--muted-foreground))` and
// friends — the shadcn palette, which is a second colour system this one
// replaces. The bar now maps each block type through `categoryFill`, which is
// the sanctioned resolver: a type the registry does not know lands on the
// measured fallback pair rather than on an invented grey.
//
// THE TWO COMPETITION TAGS lose their teal and sienna and take the evidence
// pair and the recess fill respectively — a bounty contributor is somebody
// other people's bounties accepted, and a bounty creator is a role rather than
// an endorsement.

import { useState } from "react";
import { categoryColour, categoryFill } from "@/lib/theme/category";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular } from "@/lib/theme/type";

interface BlockTypeData {
  type: string;
  color: string;
  count: number;
  percentage: number;
}

interface AuthorStats {
  totalViews: number;
  blueprintsCount: number;
  referencesReceived: number;
  bountiesSolved: number;
  bountiesPosted: number;
  avgReadingMinutes: number;
  blockTypeDistribution: BlockTypeData[];
  // Phase 6 (optional, additional fields read via `sp` cast for backwards-compat).
  bountiesSubmittedToCount?: number;
  metaBountyPledgesCount?: number;
  reblogCount?: number;
}

interface AuthorStatsPanelProps {
  stats: AuthorStats;
}

function CompetitionTag({
  label,
  tone,
}: {
  label: string;
  tone: "contributor" | "creator";
}) {
  const evidence = categoryFill("evidence");
  const palette =
    tone === "contributor"
      ? { bg: evidence.background, color: t.text }
      : { bg: t.recess, color: t.text2 };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        ...chipType,
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "2px 8px",
        /* The chip step. 100 was a capsule, and the shape language that had
           capsules in it was dropped by decision. */
        borderRadius: r.chip,
        backgroundColor: palette.bg,
        color: palette.color,
        border: `1px solid ${t.line}`,
      }}
    >
      🏆 {label}
    </span>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toString();
}

function StatCell({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        /* The eyebrow: 12-mono is the role the type scale names for one. */
        style={{
          ...chipType,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: t.text2,
        }}
      >
        {label}
      </span>
      <span
        /* Tabular, because five of these sit in a grid and their digits have to
           line up as they land. 20px rather than 22 and weight 500 rather than
           700: it is a figure in a supporting panel, not a headline. */
        style={{
          ...dataText,
          ...tabular,
          fontSize: "20px",
          fontWeight: 500,
          color: t.text,
        }}
      >
        {value}
      </span>
      <span
        style={{
          ...body,
          fontSize: "11px",
          color: t.text2,
        }}
      >
        {subtitle}
      </span>
    </div>
  );
}

function BlockTypeBar({
  distribution,
}: {
  distribution: BlockTypeData[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const topTypes = [...distribution]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  return (
    <div>
      <span
        style={{
          ...chipType,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: t.text2,
          display: "block",
          marginBottom: "8px",
        }}
      >
        Block Type Fingerprint
      </span>

      <div
        className="relative flex w-full overflow-hidden"
        style={{ height: "10px", borderRadius: r.chip }}
      >
        {distribution.map((block, index) => (
          <div
            key={block.type}
            className="relative h-full cursor-pointer transition-opacity"
            /* The category hue, resolved rather than carried: the `color` on
               the row is shadcn's palette and this system does not read it. */
            style={{
              width: `${block.percentage}%`,
              backgroundColor: categoryColour(block.type),
              opacity: 0.9,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {hoveredIndex === index && (
              <div
                className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap px-2 py-1"
                style={{
                  backgroundColor: t.recess,
                  border: `1px solid ${t.line}`,
                  borderRadius: r.chip,
                  ...body,
                  fontSize: "11px",
                  fontWeight: 500,
                  color: t.text,
                }}
              >
                {block.type.charAt(0).toUpperCase() + block.type.slice(1)} blocks · {block.percentage}% ({block.count} blocks)
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {topTypes.map((block) => (
          <div key={block.type} className="flex items-center gap-1.5">
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: r.full,
                backgroundColor: categoryColour(block.type),
              }}
            />
            <span
              style={{
                ...body,
                fontSize: "10px",
                fontWeight: 500,
                color: t.text,
              }}
            >
              {block.type.charAt(0).toUpperCase() + block.type.slice(1)}
            </span>
            <span
              style={{
                ...dataText,
                ...tabular,
                fontSize: "10px",
                color: t.text2,
              }}
            >
              {block.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthorStatsPanel({ stats }: AuthorStatsPanelProps) {
  const {
    totalViews,
    blueprintsCount,
    referencesReceived,
    bountiesSolved,
    bountiesPosted,
    avgReadingMinutes,
    blockTypeDistribution,
  } = stats;

  const sp: any = stats as any;
  const accepted = Number(sp.bountySolutionsAccepted ?? 0);
  const submitted = Number(sp.bountySolutionsSubmitted ?? 0);
  const hideBountyCell =
    accepted === 0 && submitted === 0 && bountiesSolved === 0 && bountiesPosted === 0;

  let bountyValue = "";
  let bountySubtitle = "";
  if (!hideBountyCell) {
    if (submitted > 0) {
      bountyValue = `${accepted} of ${submitted}`;
      const rate = Math.round((accepted / submitted) * 100);
      bountySubtitle = `${rate}% acceptance rate`;
    } else if (accepted > 0) {
      bountyValue = `${accepted}`;
      bountySubtitle = "accepted";
    } else {
      bountyValue = "0";
      bountySubtitle = "No bounties submitted yet";
    }
  }

  const gridCols = hideBountyCell
    ? "grid-cols-1 sm:grid-cols-3"
    : "grid-cols-2 lg:grid-cols-4";

  const hasPosts =
    blueprintsCount > 0 ||
    (blockTypeDistribution && blockTypeDistribution.length > 0);

  // Phase 6 — Bounty contributor / creator tags.
  const bountiesSubmittedToCount = Number(
    sp.bountiesSubmittedToCount ?? stats.bountiesSubmittedToCount ?? 0,
  );
  const metaBountyPledgesCount = Number(
    sp.metaBountyPledgesCount ?? stats.metaBountyPledgesCount ?? 0,
  );
  const isBountyContributor =
    bountiesSubmittedToCount > 2 || metaBountyPledgesCount > 0;
  const isBountyCreator = bountiesPosted > 2;

  return (
    <div
      className="w-full"
      /* A panel, at the panel radius, on the recess ground. */
      style={{
        backgroundColor: t.recess,
        border: `1px solid ${t.line}`,
        borderRadius: r.panel,
        padding: "18px",
        marginTop: "24px",
      }}
    >
      {(isBountyContributor || isBountyCreator) && (
        <div
          className="flex flex-wrap items-center"
          style={{ gap: 6, marginBottom: 14 }}
        >
          {isBountyContributor && (
            <CompetitionTag label="Bounty contributor" tone="contributor" />
          )}
          {isBountyCreator && (
            <CompetitionTag label="Bounty creator" tone="creator" />
          )}
        </div>
      )}

      <div className={`grid ${gridCols} gap-6`}>
        <StatCell
          label="Total Views"
          value={totalViews === 0 ? "—" : formatNumber(totalViews)}
          subtitle={
            totalViews === 0
              ? "No views yet"
              : `across ${blueprintsCount} blueprint${blueprintsCount !== 1 ? "s" : ""}`
          }
        />

        <StatCell
          label="Referenced by Others"
          value={referencesReceived === 0 ? "—" : formatNumber(referencesReceived)}
          subtitle={
            referencesReceived === 0
              ? "Be the first to reference your work"
              : "blocks and stages cited"
          }
        />

        {!hideBountyCell && (
          <StatCell
            label="Bounty Solutions"
            value={bountyValue}
            subtitle={bountySubtitle}
          />
        )}

        <StatCell
          label="Avg. Depth"
          value={`${avgReadingMinutes} min`}
          subtitle="average reading time"
        />

        <StatCell
          label="Reblogs"
          value={formatNumber(Number(sp.reblogCount ?? 0))}
          subtitle={Number(sp.reblogCount ?? 0) === 0 ? "No reblogs yet" : "shared by this author"}
        />
      </div>

      {hasPosts && (
        <>
          <div
            style={{
              height: "1px",
              backgroundColor: t.line,
              margin: "16px 0",
            }}
          />
          <BlockTypeBar distribution={blockTypeDistribution} />
        </>
      )}
    </div>
  );
}

export function AuthorStatsPanelSkeleton() {
  return (
    <div
      className="w-full animate-pulse"
      style={{
        backgroundColor: t.recess,
        border: `1px solid ${t.line}`,
        borderRadius: r.panel,
        padding: "18px",
        marginTop: "24px",
        height: "140px",
      }}
    />
  );
}
