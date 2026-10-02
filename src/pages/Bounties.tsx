import { useState } from "react";
import { SeoHead } from "@/components/SeoHead";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  listOpenBountyCards,
  listTopSolvers,
  type OpenBountyCard,
  type Solver,
} from "@/lib/bounty";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { VacantFrame } from "@/components/brand/VacantFrame";
import { CoverFallback } from "@/components/brand/CoverFallback";

/* UI-P33 — /bounties in the site frame, with desktop and mobile layouts */

export default function Bounties() {
  const breakpoint = useBreakpoint();
  const phone = breakpoint === "mobile";
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [solvePanelOpen, setSolvePanelOpen] = useState(false);

  const board = useQuery({
    queryKey: ["bounty-board"],
    queryFn: () => listOpenBountyCards({ limit: 100 }),
  });

  const solvers = useQuery({
    queryKey: ["top-solvers"],
    queryFn: () => listTopSolvers({ limit: 3 }),
  });

  const cards = board.data?.cards ?? [];
  const selectedCard = cards.find((c) => c.bounty.id === selectedId) ?? cards[0];

  return (
    <div
      data-visual-slot="bounties-frame"
      style={phone ? { paddingTop: SPACE.sm } : { padding: SPACE.md }}
    >
      <SeoHead
        title="Bounties — buildgallery"
        description="Open asks on real builds, with rewards for solutions."
        path="/bounties"
      />

      {!phone && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
          <HeaderPanel onSolversClick={() => {}} />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: SPACE.md }}>
            <FramesGrid cards={cards} selected={selectedId} onSelect={setSelectedId} />
            <RightColumn
              card={selectedCard}
              solvers={solvers.data ?? []}
              onSolveClick={() => {
                if (selectedCard) setSolvePanelOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {phone && (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
          <MobileHeader />
          <MobileContent cards={cards} solvers={solvers.data ?? []} />
        </div>
      )}
    </div>
  );
}

function HeaderPanel({ onSolversClick }: { onSolversClick: () => void }) {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.68)",
        border: "1px solid rgba(255, 255, 255, 0.95)",
        borderRadius: 16,
        padding: "16px 20px",
        boxShadow: "0 14px 30px rgba(26, 35, 32, 0.11), inset 0 1px 0 rgba(255, 255, 255, 1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: DM_MONO, fontSize: 11, letterSpacing: 0.09, textTransform: "uppercase", color: t.text2 }}>
          Bounties
        </div>
        <h1 style={{ margin: 0, fontFamily: "Sentient, serif", fontWeight: 500, fontSize: 44, letterSpacing: -0.035, lineHeight: 1, color: t.text }}>
          Open asks on real builds
        </h1>
        <div style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
          The build works. One part is left open on purpose, with a reward for whoever solves it.
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "inline-flex", gap: 2, padding: 4, borderRadius: 12, background: "rgba(255, 255, 255, 0.58)", border: "1px solid rgba(26, 35, 32, 0.15)" }}>
          <button style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 8, fontFamily: FIGTREE, fontSize: 12, background: t.text, color: t.bg, fontWeight: 600, cursor: "pointer" }}>
            Newest
          </button>
          <button style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 8, fontFamily: FIGTREE, fontSize: 12, background: "transparent", color: t.text2, cursor: "pointer" }}>
            Reward
          </button>
          <button style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 8, fontFamily: FIGTREE, fontSize: 12, background: "transparent", color: t.text2, cursor: "pointer" }}>
            Closing soon
          </button>
        </div>
        <div style={{ display: "inline-flex", gap: 2, padding: 4, borderRadius: 12, background: "rgba(255, 255, 255, 0.58)", border: "1px solid rgba(26, 35, 32, 0.15)" }}>
          <button style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 8, fontFamily: FIGTREE, fontSize: 12, background: t.text, color: t.bg, fontWeight: 600, cursor: "pointer" }}>
            Bounties
          </button>
          <Link
            to="/bounties/solvers"
            style={{
              height: 26,
              padding: "0 12px",
              border: 0,
              borderRadius: 8,
              fontFamily: FIGTREE,
              fontSize: 12,
              background: "transparent",
              color: t.text2,
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            Solvers
          </Link>
        </div>
      </div>
    </div>
  );
}

function FramesGrid({ cards, selected, onSelect }: { cards: OpenBountyCard[]; selected: string | null; onSelect: (id: string) => void }) {
  const wholePounds = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px 14px" }}>
      {cards.slice(0, 6).map((card) => (
        <VacantFrame
          key={card.bounty.id}
          title={card.build.title}
          cover={<CoverFallback />}
          part={card.gapTitle || "Part"}
          reward={card.bounty.reward_gbp ? wholePounds.format(card.bounty.reward_gbp) : undefined}
          solutions={card.solutions}
          meToo={card.bounty.me_too_count || 0}
          to={`/bounties/${card.bounty.id}/solve`}
          selected={selected === card.bounty.id}
        />
      ))}
    </div>
  );
}

function RightColumn({ card, solvers, onSolveClick }: { card?: OpenBountyCard; solvers: Solver[]; onSolveClick: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, minHeight: 0 }}>
      {card && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.68)",
            border: "1px solid rgba(255, 255, 255, 0.95)",
            borderRadius: 16,
            padding: 0,
            overflow: "hidden",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ padding: 0 }}>
            <SolvePreview card={card} onSolveClick={onSolveClick} />
          </div>
        </div>
      )}

      <div
        style={{
          background: "rgba(255, 255, 255, 0.68)",
          border: "1px solid rgba(255, 255, 255, 0.95)",
          borderRadius: 16,
          padding: "12px 16px",
          boxShadow: "0 14px 30px rgba(26, 35, 32, 0.11), inset 0 1px 0 rgba(255, 255, 255, 1)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>
            Top solvers
          </div>
          <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
            Solutions accepted
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {solvers.slice(0, 3).map((solver, i) => (
            <div key={solver.id} style={{ display: "flex", alignItems: "center", gap: 10, height: 38, borderBottom: i < 2 ? `1px solid rgba(26, 35, 32, 0.09)` : "none" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: i === 0 ? "50%" : 9,
                  background: i === 0 ? "#D9A441" : i === 1 ? "#D7DBD5" : "transparent",
                  border: i === 2 ? `1.5px solid rgba(26, 35, 32, 0.15)` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Sentient, serif",
                  fontWeight: 500,
                  fontSize: 16,
                  color: t.text,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: t.recess,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FIGTREE,
                  fontSize: 9,
                  fontWeight: 600,
                  color: t.text,
                }}
              >
                {solver.username?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, fontFamily: FIGTREE, fontSize: 12, color: t.text }}>
                @{solver.username}
              </div>
              <div style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>
                {solver.solved} solved
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/bounties/solvers"
          style={{
            display: "inline-block",
            marginTop: 12,
            fontFamily: FIGTREE,
            fontSize: 12,
            color: t.text,
            textDecoration: "underline",
            textUnderlineOffset: "4px",
          }}
        >
          All solvers
        </Link>
      </div>
    </div>
  );
}

function SolvePreview({ card, onSolveClick }: { card: OpenBountyCard; onSolveClick: () => void }) {
  const wholePounds = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });

  const reward = card.bounty.reward_gbp ? wholePounds.format(card.bounty.reward_gbp) : "No reward";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
      <div
        style={{
          border: `1.5px dashed ${t.catBreakage}`,
          borderRadius: 14,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: DM_MONO, fontSize: 10, color: t.catBreakage, textTransform: "uppercase" }}>
            OPEN
          </div>
        </div>
        <div style={{ fontFamily: "Sentient, serif", fontWeight: 500, fontSize: 24, letterSpacing: -0.02, lineHeight: 1.05, color: t.text }}>
          {card.gapTitle || "Part of " + card.build.title}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onSolveClick}
            style={{
              fontFamily: FIGTREE,
              fontSize: 13,
              fontWeight: 600,
              padding: "0 14px",
              height: 36,
              borderRadius: 12,
              background: t.action,
              color: t.onAction,
              border: `1px solid ${t.action}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            Submit a solution
          </button>
          <button
            style={{
              fontFamily: FIGTREE,
              fontSize: 13,
              fontWeight: 500,
              padding: "0 14px",
              height: 36,
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.58)",
              color: t.text,
              border: "1px solid rgba(26, 35, 32, 0.15)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            Me too
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, background: "rgba(26, 35, 32, 0.09)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ background: "rgba(255, 255, 255, 0.55)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontFamily: DM_MONO, fontSize: 10, letterSpacing: 0.09, textTransform: "uppercase", color: t.text2 }}>
            Reward
          </div>
          <div style={{ fontFamily: DM_MONO, fontSize: 14, color: "#D9A441" }}>{reward}</div>
        </div>
        <div style={{ background: "rgba(255, 255, 255, 0.55)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontFamily: DM_MONO, fontSize: 10, letterSpacing: 0.09, textTransform: "uppercase", color: t.text2 }}>
            Closes
          </div>
          <div style={{ fontFamily: DM_MONO, fontSize: 14, color: t.text }}>—</div>
        </div>
        <div style={{ background: "rgba(255, 255, 255, 0.55)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontFamily: DM_MONO, fontSize: 10, letterSpacing: 0.09, textTransform: "uppercase", color: t.text2 }}>
            Me too
          </div>
          <div style={{ fontFamily: DM_MONO, fontSize: 14, color: t.text }}>0</div>
        </div>
      </div>
    </div>
  );
}

function MobileHeader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: DM_MONO, fontSize: 11, letterSpacing: 0.09, textTransform: "uppercase", color: t.text2 }}>
          Bounties
        </div>
        <h1 style={{ margin: 0, fontFamily: "Sentient, serif", fontWeight: 500, fontSize: 34, letterSpacing: -0.035, lineHeight: 1, color: t.text }}>
          Open asks on real builds
        </h1>
        <div style={{ fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
          The build works. One part is left open on purpose, with a reward.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "inline-flex", gap: 2, padding: 4, borderRadius: 12, background: "rgba(255, 255, 255, 0.58)", border: "1px solid rgba(26, 35, 32, 0.15)" }}>
          <button style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 8, fontFamily: FIGTREE, fontSize: 13, background: t.text, color: t.bg, fontWeight: 600, cursor: "pointer" }}>
            Bounties
          </button>
          <Link
            to="/bounties/solvers"
            style={{
              height: 26,
              padding: "0 12px",
              border: 0,
              borderRadius: 8,
              fontFamily: FIGTREE,
              fontSize: 13,
              background: "transparent",
              color: t.text2,
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            Solvers
          </Link>
        </div>
      </div>
    </div>
  );
}

function MobileContent({ cards, solvers }: { cards: OpenBountyCard[]; solvers: Solver[] }) {
  const wholePounds = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cards.slice(0, 6).map((card) => (
        <VacantFrame
          key={card.bounty.id}
          title={card.build.title}
          cover={<CoverFallback />}
          part={card.gapTitle || "Part"}
          reward={card.bounty.reward_gbp ? wholePounds.format(card.bounty.reward_gbp) : undefined}
          solutions={card.solutions}
          meToo={card.bounty.me_too_count || 0}
          to={`/bounties/${card.bounty.id}/solve`}
        />
      ))}

      <div
        style={{
          background: "rgba(255, 255, 255, 0.68)",
          border: "1px solid rgba(255, 255, 255, 0.95)",
          borderRadius: 16,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>
            Top solvers
          </div>
          <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
            Solutions accepted
          </div>
        </div>

        {solvers.slice(0, 3).map((solver) => (
          <div key={solver.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: t.recess,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FIGTREE,
                fontSize: 10,
                fontWeight: 600,
                color: t.text,
                flexShrink: 0,
              }}
            >
              {solver.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, fontFamily: FIGTREE, fontSize: 14, color: t.text }}>
              @{solver.username}
            </div>
            <div style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
              {solver.solved} solved
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

