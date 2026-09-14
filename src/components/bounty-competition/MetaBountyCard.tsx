import * as React from "react";
import { Layers } from "lucide-react";

export interface MetaBountySubBountyView {
  id: string;
  title: string;
  target: number;
  pledged: number;
  status: "funding" | "spawned" | "completed";
}

export interface MetaBountyCardModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  contributors: number;
  totalPool: number;
  subBounties: MetaBountySubBountyView[];
}

interface MetaBountyCardProps {
  metaBounty: MetaBountyCardModel;
  onClick?: () => void;
  onPledge?: () => void;
}

export function MetaBountyCard({
  metaBounty,
  onClick,
  onPledge,
}: MetaBountyCardProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div
      onClick={onClick}
      style={{
        background: "color-mix(in srgb, var(--action) 4%, transparent)",
        border: "0.5px solid color-mix(in srgb, var(--action) 20%, transparent)",
        borderRadius: "10px",
        padding: "14px 16px",
        width: "100%",
        maxWidth: "880px",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "14px",
          right: "16px",
          background: "color-mix(in srgb, var(--action) 14%, transparent)",
          color: "var(--action)",
          fontFamily: "Figtree, sans-serif",
          fontSize: "9px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: "100px",
        }}
      >
        META
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Layers
            style={{ width: "14px", height: "14px", color: "var(--action)" }}
          />
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--action)",
            }}
          >
            META BOUNTY
          </span>
        </div>
        <span
          style={{
            fontFamily: "Figtree, sans-serif",
            fontSize: "11px",
            fontWeight: 400,
            color: "var(--text2)",
            marginRight: "60px",
          }}
        >
          {metaBounty.contributors} contributors ·{" "}
          {formatCurrency(metaBounty.totalPool)} pool
        </span>
      </div>

      <h3
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--text)",
          margin: "8px 0",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: "1.4",
        }}
      >
        {metaBounty.title}
      </h3>

      <p
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: "12px",
          fontWeight: 400,
          color: "var(--text2)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          margin: "0 0 12px 0",
          lineHeight: "1.5",
        }}
      >
        {metaBounty.description}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {metaBounty.subBounties.map((subBounty, index) => {
          const progress = Math.min(
            (subBounty.pledged / Math.max(subBounty.target, 1)) * 100,
            100,
          );
          return (
            <div key={subBounty.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: "Figtree, sans-serif",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "var(--text2)",
                  }}
                >
                  Solve {index + 1}: {subBounty.title}
                </span>
                <span
                  style={{
                    fontFamily: "Figtree, sans-serif",
                    fontSize: "10px",
                    fontWeight: 400,
                    color: "var(--text2)",
                  }}
                >
                  {formatCurrency(subBounty.pledged)} /{" "}
                  {formatCurrency(subBounty.target)}
                </span>
              </div>
              <div
                style={{
                  height: "4px",
                  background: "var(--recess)",
                  borderRadius: "var(--r-chip)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "var(--evidence)",
                    borderRadius: "var(--r-chip)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPledge?.();
          }}
          style={{
            background: "var(--action)",
            color: "white",
            fontFamily: "Figtree, sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Pledge to a sub-bounty
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          style={{
            background: "transparent",
            color: "var(--text2)",
            fontFamily: "Figtree, sans-serif",
            fontSize: "11px",
            fontWeight: 500,
            padding: "8px 12px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
          }}
        >
          View details
        </button>
      </div>
    </div>
  );
}
