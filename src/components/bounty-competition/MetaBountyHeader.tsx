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
          "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.02))",
        border: "1px solid rgba(124,58,237,0.25)",
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
        <Layers size={16} color="#7C3AED" />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#7C3AED",
          }}
        >
          META BOUNTY
        </span>
      </div>

      <h1
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 24,
          fontWeight: 700,
          color: "rgba(255,255,255,0.95)",
          margin: "0 0 8px 0",
          lineHeight: 1.3,
        }}
      >
        {meta.title}
      </h1>
      {meta.description && (
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
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
          borderTop: "1px solid rgba(124,58,237,0.15)",
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
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
          marginBottom: 4,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: accent ? 18 : 14,
          fontWeight: accent ? 700 : 600,
          color: accent ? "#7C3AED" : "rgba(255,255,255,0.9)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
