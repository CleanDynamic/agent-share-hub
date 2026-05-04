import { useState } from "react";

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
  const palette =
    tone === "contributor"
      ? {
          bg: "rgba(31,122,109,0.12)",
          color: "#2EC4B6",
          border: "rgba(46,196,182,0.30)",
        }
      : {
          bg: "rgba(232,87,26,0.12)",
          color: "#E8571A",
          border: "rgba(232,87,26,0.30)",
        };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "2px 8px",
        borderRadius: 100,
        background: palette.bg,
        color: palette.color,
        border: `0.5px solid ${palette.border}`,
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
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.40)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "22px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.95)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 400,
          color: "rgba(255,255,255,0.40)",
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
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.40)",
          display: "block",
          marginBottom: "8px",
        }}
      >
        Block Type Fingerprint
      </span>

      <div
        className="relative flex w-full overflow-hidden"
        style={{ height: "10px", borderRadius: "5px" }}
      >
        {distribution.map((block, index) => (
          <div
            key={block.type}
            className="relative h-full cursor-pointer transition-opacity"
            style={{
              width: `${block.percentage}%`,
              backgroundColor: block.color,
              opacity: 0.65,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {hoveredIndex === index && (
              <div
                className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap px-2 py-1"
                style={{
                  backgroundColor: "rgba(0,0,0,0.9)",
                  borderRadius: "4px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.90)",
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
                borderRadius: "50%",
                backgroundColor: block.color,
              }}
            />
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "10px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.60)",
              }}
            >
              {block.type.charAt(0).toUpperCase() + block.type.slice(1)}
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "10px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.35)",
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
      style={{
        backgroundColor: "rgba(22,22,30,0.40)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "10px",
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
      </div>

      {hasPosts && (
        <>
          <div
            style={{
              height: "0.5px",
              backgroundColor: "rgba(255,255,255,0.04)",
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
        backgroundColor: "rgba(22,22,30,0.40)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "10px",
        padding: "18px",
        marginTop: "24px",
        height: "140px",
      }}
    />
  );
}
