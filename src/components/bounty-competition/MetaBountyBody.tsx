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
          fontFamily: "Figtree, sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text)",
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
        background: "color-mix(in srgb, var(--action) 4%, transparent)",
        border: "1px solid color-mix(in srgb, var(--action) 18%, transparent)",
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
              fontFamily: "Figtree, sans-serif",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Sub-bounty {index + 1}
            {isSpawned && (
              <span
                style={{
                  marginLeft: 8,
                  background: "color-mix(in srgb, var(--cat-configuration) 16%, transparent)",
                  color: "var(--cat-configuration)",
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
              fontFamily: "Figtree, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              margin: "0 0 4px 0",
            }}
          >
            {sub.title}
          </h3>
          {sub.description && (
            <p
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 12,
                color: "var(--text2)",
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
              background: "color-mix(in srgb, var(--cat-configuration) 15%, transparent)",
              color: "var(--cat-configuration)",
              border: "1px solid color-mix(in srgb, var(--cat-configuration) 30%, transparent)",
              borderRadius: 8,
              padding: "8px 14px",
              fontFamily: "Figtree, sans-serif",
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
              background: "var(--action)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontFamily: "Figtree, sans-serif",
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
            fontFamily: "Figtree, sans-serif",
            fontSize: 11,
            color: "var(--text2)",
            marginBottom: 4,
          }}
        >
          <span>
            ${sub.pledgedAmount.toFixed(0)} / ${sub.targetAmount.toFixed(0)}{" "}
            <span style={{ color: "var(--text2)" }}>
              · spawns at ${thresholdAmount.toFixed(0)}
            </span>
          </span>
          <span>{sub.pledgerCount} contributors</span>
        </div>
        <div
          style={{
            height: 6,
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
              transition: "none",
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
        background: "color-mix(in srgb, var(--porthole) 62%, transparent)",
        backdropFilter: "blur(16px)",
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
            "var(--recess)",
          border: "1px solid color-mix(in srgb, var(--action) 30%, transparent)",
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
              fontFamily: "Figtree, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text)",
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
              color: "var(--text2)",
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
              fontFamily: "Figtree, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text2)",
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
                background: "var(--recess)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontFamily: "Figtree, sans-serif",
                fontSize: 14,
                color: "var(--text)",
              }}
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                width: 100,
                padding: "10px 12px",
                background: "var(--recess)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontFamily: "Figtree, sans-serif",
                fontSize: 14,
                color: "var(--text)",
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
            fontFamily: "Figtree, sans-serif",
            fontSize: 13,
            color: "var(--text2)",
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
              ? "color-mix(in srgb, var(--action) 50%, transparent)"
              : "var(--action)",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontFamily: "Figtree, sans-serif",
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
