import * as React from "react";
import { Layers, Users, Clock } from "lucide-react";

export interface MetaBountyHeaderModel {
  id: string;
  title: string;
  description: string;
  totalPledged: number;
  totalPledgers: number;
  fundingDeadline: string | null;
  subBountyCount: number;
  spawnedCount: number;
}

interface Props {
  meta: MetaBountyHeaderModel;
}

export function MetaBountyHeader({ meta }: Props) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const deadline = meta.fundingDeadline ? new Date(meta.fundingDeadline) : null;
  const daysRemaining = deadline
    ? Math.max(
        0,
        Math.ceil(
          (deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  return (
    <div
      style={{
        background:
          "var(--action)",
        border: "1px solid color-mix(in srgb, var(--action) 25%, transparent)",
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Layers size={16} color="var(--action)" />
        <span
          style={{
            fontFamily: "Figtree, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--action)",
          }}
        >
          META BOUNTY
        </span>
      </div>

      <h1
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text)",
          margin: "0 0 8px 0",
          lineHeight: 1.3,
        }}
      >
        {meta.title}
      </h1>
      {meta.description && (
        <p
          style={{
            fontFamily: "Figtree, sans-serif",
            fontSize: 13,
            color: "var(--text2)",
            margin: "0 0 16px 0",
            lineHeight: 1.5,
          }}
        >
          {meta.description}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          paddingTop: 12,
          borderTop: "1px solid color-mix(in srgb, var(--action) 15%, transparent)",
        }}
      >
        <Stat
          label="Pool"
          value={formatCurrency(meta.totalPledged)}
          accent
        />
        <Stat
          label="Contributors"
          value={String(meta.totalPledgers)}
          icon={<Users size={12} />}
        />
        <Stat
          label="Sub-bounties"
          value={`${meta.spawnedCount}/${meta.subBountyCount} spawned`}
        />
        {daysRemaining !== null && (
          <Stat
            label="Funding ends"
            value={daysRemaining > 0 ? `${daysRemaining}d left` : "Closed"}
            icon={<Clock size={12} />}
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "Figtree, sans-serif",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text2)",
          marginBottom: 4,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: accent ? 18 : 14,
          fontWeight: accent ? 700 : 600,
          color: accent ? "var(--action)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
