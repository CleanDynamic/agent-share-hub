import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import type { MetaState, SubBountyState } from "@/lib/bounty-competition/types";
import { pledgeToSubBounty } from "@/lib/bounty-competition/pledgeToSubBounty";
import { useToast } from "@/hooks/use-toast";

interface Props {
  meta: MetaState;
  viewerId: string | null;
  onPledged: () => void;
}

export function MetaBountyBody({ meta, viewerId, onPledged }: Props) {
  const navigate = useNavigate();
  const [pledgeFor, setPledgeFor] = React.useState<{
    index: number;
    sub: SubBountyState;
  } | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "rgba(255,255,255,0.92)",
          margin: "0 0 4px 0",
        }}
      >
        Sub-bounties
      </h2>

      {meta.subBounties.map((sub, index) => (
        <SubBountyRow
          key={sub.id}
          sub={sub}
          index={index}
          onPledge={() => setPledgeFor({ index, sub })}
          onOpenSpawned={(id) => navigate(`/content/${id}`)}
        />
      ))}

      {pledgeFor && (
        <PledgeModal
          meta={meta}
          subIndex={pledgeFor.index}
          sub={pledgeFor.sub}
          viewerId={viewerId}
          onClose={() => setPledgeFor(null)}
          onSuccess={() => {
            setPledgeFor(null);
            onPledged();
          }}
        />
      )}
    </div>
  );
}

function SubBountyRow({
  sub,
  index,
  onPledge,
  onOpenSpawned,
}: {
  sub: SubBountyState;
  index: number;
  onPledge: () => void;
  onOpenSpawned: (id: string) => void;
}) {
  const progress = Math.min(
    (sub.pledgedAmount / Math.max(sub.targetAmount, 1)) * 100,
    100,
  );
  const thresholdAmount =
    (sub.targetAmount * sub.spawnThresholdPct) / 100;
  const isSpawned = !!sub.spawnedBountyId;

  return (
    <div
      style={{
        background: "rgba(124,58,237,0.04)",
        border: "1px solid rgba(124,58,237,0.18)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)",
              marginBottom: 4,
            }}
          >
            Sub-bounty {index + 1}
            {isSpawned && (
              <span
                style={{
                  marginLeft: 8,
                  background: "rgba(34,197,94,0.16)",
                  color: "#22C55E",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 9,
                }}
              >
                SPAWNED
              </span>
            )}
          </div>
          <h3
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
              margin: "0 0 4px 0",
            }}
          >
            {sub.title}
          </h3>
          {sub.description && (
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {sub.description}
            </p>
          )}
        </div>
        {isSpawned ? (
          <button
            onClick={() => onOpenSpawned(sub.spawnedBountyId!)}
            style={{
              background: "rgba(34,197,94,0.15)",
              color: "#22C55E",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8,
              padding: "8px 14px",
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            View bounty <ArrowRight size={12} />
          </button>
        ) : (
          <button
            onClick={onPledge}
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Pledge
          </button>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 4,
          }}
        >
          <span>
            ${sub.pledgedAmount.toFixed(0)} / ${sub.targetAmount.toFixed(0)}{" "}
            <span style={{ color: "rgba(255,255,255,0.35)" }}>
              · spawns at ${thresholdAmount.toFixed(0)}
            </span>
          </span>
          <span>{sub.pledgerCount} contributors</span>
        </div>
        <div
          style={{
            height: 6,
            background: "rgba(124,58,237,0.08)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #7C3AED 0%, #A78BFA 100%)",
              borderRadius: 3,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PledgeModal({
  meta,
  subIndex,
  sub,
  viewerId,
  onClose,
  onSuccess,
}: {
  meta: MetaState;
  subIndex: number;
  sub: SubBountyState;
  viewerId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = React.useState<string>("25");
  const [currency, setCurrency] = React.useState("USD");
  const [anonymous, setAnonymous] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!viewerId) {
      toast({ title: "Sign in to pledge", variant: "destructive" });
      return;
    }
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    try {
      setSubmitting(true);
      await pledgeToSubBounty({
        metaBountyId: meta.bountyId,
        subBountyIndex: subIndex,
        pledgerId: viewerId,
        amount: numeric,
        currency,
        isAnonymous: anonymous,
      });
      toast({ title: "Pledge confirmed" });
      onSuccess();
    } catch (e: any) {
      toast({
        title: "Pledge failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "100%",
          background:
            "linear-gradient(180deg, rgba(30,30,35,0.95), rgba(20,20,25,0.98))",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              margin: 0,
            }}
          >
            Pledge to: {sub.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              display: "block",
              marginBottom: 6,
            }}
          >
            Amount
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                color: "rgba(255,255,255,0.9)",
                outline: "none",
              }}
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                width: 100,
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                color: "rgba(255,255,255,0.9)",
                outline: "none",
              }}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USDC">USDC</option>
              <option value="ETH">ETH</option>
            </select>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.75)",
            marginBottom: 20,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          Pledge anonymously
        </label>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%",
            padding: "12px",
            background: submitting
              ? "rgba(124,58,237,0.5)"
              : "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Pledging…" : "Confirm pledge"}
        </button>
      </div>
    </div>
  );
}
