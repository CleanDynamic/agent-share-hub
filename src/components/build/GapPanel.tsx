// The gap panel: an open bounty, on the build page, under the node it is about.
//
// WHAT THIS REPLACES, AND WHAT IT DOES NOT. The red invitation card is NS-P05's
// gap renderer and it is untouched — it still draws the problem, what was
// tried and the bar for solving it, for any node of type 'gap'. What NS-P52
// adds is the half that was missing: a node marked unsolved with a BOUNTY on it
// now says so where it stands, with the ask, the reward, the deadline and the
// two things a reader can do about it.
//
// THE COPY IS AN INVITATION, NOT AN ADMISSION. "This part is unsolved — the
// build works without it" is the sentence this file exists to put on the page.
// A gap is a thing a creator wrote down on purpose, and a panel that apologised
// for it would teach the next creator to leave it out instead.
//
// A PANEL PER OPEN BOUNTY, hung under its own node by BuildPage. Nothing here
// queries: the bounty, its counts and the reader's own me-too arrive as props
// from the page's one batched read, which is what keeps a build with four gaps
// at three requests rather than thirteen.
//
// Styled with inline style objects, like every other surface on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { Suspense, lazy, useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toggleMeToo, type BuildBounty } from "@/lib/bounty";
import { gapProblem, type Build, type BuildNode, type NodeType } from "@/lib/build";
/**
 * LAZY, AND FOR A MEASURED REASON. The solve panel renders the gap type's own
 * form, which is SchemaForm and the whole field-widget registry behind it — and
 * one of those widgets reaches into the compose tree for its type pill, which
 * brings @dnd-kit with it. None of that belongs in the chunk a reader downloads
 * to READ a build: the gap on this page is a paragraph, and the form only
 * exists once somebody decides to answer it. The measured gap on this
 * application is download weight rather than execution, so the import waits for
 * the click.
 */
const SolvePanel = lazy(() =>
  import("@/components/bounty/SolvePanel").then((module) => ({
    default: module.SolvePanel,
  })),
);
import {
  deadlineLabel,
  rewardLabel,
  solutionCountLabel,
} from "@/components/bounty/bountyDisplay";
import type { ResolveMedia, ResolveNode } from "./renderers";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "./tokens";

/** The invitation. A constant because it is the design, not a string. */
export const GAP_INVITATION = "This part is unsolved — the build works without it.";
const NO_PROBLEM =
  "The creator has not written down what is wrong yet. Ask in the discussion before you spend an hour on it.";
const SOLVE_LABEL = "Offer a solution";
const ME_TOO_LABEL = "I need this too";
const ME_TOO_MARKED = "You need this too";

const chip: CSSProperties = {
  ...labelText,
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 100,
  border: `1px solid ${HAIRLINE}`,
  color: TEXT_SECONDARY,
  background: "rgba(255,255,255,0.025)",
};

const controlBase: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  fontSize: 12,
  padding: "7px 12px",
  borderRadius: 8,
  cursor: "pointer",
  whiteSpace: "nowrap",
  border: `1px solid ${HAIRLINE}`,
  background: "rgba(255,255,255,0.025)",
  color: TEXT_SECONDARY,
};

/**
 * What is wrong with this node, in the creator's own words.
 *
 * TWO PLACES, ONE MEANING, and the order matters. `gap_problem` is the reserved
 * payload key NS-P51's inspector writes for a node of ANY type that has been
 * flagged unsolved, and it is checked first because it is the one a creator can
 * have written for the node in front of them. `problem` is the 'gap' TYPE's own
 * required field, which only exists on a node whose whole content is a
 * question. A node can carry both — src/lib/build/gaps.ts explains why they are
 * deliberately different keys — and when it does, the flag's statement is the
 * one about this bounty.
 */
export function gapStatement(node: BuildNode): string {
  const flagged = gapProblem(node.payload).trim();
  if (flagged) return flagged;

  const payload =
    node.payload && typeof node.payload === "object" && !Array.isArray(node.payload)
      ? (node.payload as Record<string, unknown>)
      : {};
  const typed = payload.problem;
  return typeof typed === "string" ? typed.trim() : "";
}

export interface GapPanelProps {
  /** The gap node this bounty is the header for. */
  node: BuildNode;
  nodeType?: NodeType;
  build: Build;
  /** The bounty and its two counts, from the page's batched read. */
  entry: BuildBounty;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  /**
   * Something happened that the page's data no longer reflects. 'accepted'
   * means the record itself changed — the gap is a filled node now.
   */
  onChanged: (change: "submitted" | "accepted" | "me_too") => void;
}

export function GapPanel({
  node,
  nodeType,
  build,
  entry,
  resolveNode,
  resolveMedia,
  onChanged,
}: GapPanelProps) {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [solving, setSolving] = useState(false);
  /**
   * The mark and the number as this session last saw them.
   *
   * Held locally rather than read back through the page on every click: the
   * write returns the trigger-maintained count, which is the truth, and
   * re-rendering the whole record to move one integer would take the reader's
   * scroll position with it. The page is told anyway — onChanged — so anything
   * else reading these counts can catch up in its own time.
   */
  const [marked, setMarked] = useState(entry.meToo);
  const [count, setCount] = useState(entry.bounty.me_too_count ?? 0);

  const problem = gapStatement(node);
  const reward = rewardLabel(entry.bounty.reward_gbp);
  const closes = deadlineLabel(entry.bounty.closes_at);

  const signIn = useCallback(() => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  }, [location.pathname, navigate]);

  const meToo = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Sign in to say you need this too.");
      return toggleMeToo({ bountyId: entry.bounty.id, userId: user.id });
    },
    onSuccess: (result) => {
      setMarked(result.marked);
      setCount(result.count);
      onChanged("me_too");
    },
  });

  return (
    <div
      data-testid="gap-panel"
      data-visual-slot="build-gap-panel"
      data-bounty-id={entry.bounty.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${hexToRgba(GAP_RED, 0.28)}`,
        background: hexToRgba(GAP_RED, 0.06),
      }}
    >
      <span style={{ ...labelText, fontSize: 11, color: GAP_RED, textTransform: "uppercase" }}>
        Open bounty
      </span>

      <p style={{ ...bodyText, margin: 0, color: TEXT_PRIMARY }}>{GAP_INVITATION}</p>

      <p
        data-testid="gap-problem-statement"
        style={{
          ...bodyText,
          margin: 0,
          color: problem ? TEXT_SECONDARY : TEXT_MUTED,
          whiteSpace: "pre-wrap",
        }}
      >
        {problem || NO_PROBLEM}
      </p>

      {/* The two facts that are only sometimes true. Neither is invented: an
          unpriced bounty shows no reward, and one with no deadline shows no
          date. */}
      {reward || closes ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {reward ? (
            <span
              data-testid="gap-reward"
              style={{
                ...chip,
                color: GAP_RED,
                border: `1px solid ${hexToRgba(GAP_RED, 0.35)}`,
                background: hexToRgba(GAP_RED, 0.1),
              }}
            >
              {reward}
            </span>
          ) : null}
          {closes ? (
            <span data-testid="gap-deadline" style={chip}>
              {closes}
            </span>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          data-testid="solve-open"
          onClick={() => setSolving(true)}
          style={{
            ...controlBase,
            color: TEAL,
            border: `1px solid ${hexToRgba(TEAL, 0.35)}`,
            background: hexToRgba(TEAL, 0.1),
            fontWeight: 600,
          }}
        >
          {SOLVE_LABEL}
        </button>

        <button
          type="button"
          data-testid="gap-me-too"
          aria-pressed={marked}
          disabled={meToo.isPending}
          onClick={() => (isLoggedIn ? meToo.mutate() : signIn())}
          style={{
            ...controlBase,
            color: marked ? GAP_RED : TEXT_SECONDARY,
            border: `1px solid ${marked ? hexToRgba(GAP_RED, 0.35) : HAIRLINE}`,
            background: marked ? hexToRgba(GAP_RED, 0.1) : "rgba(255,255,255,0.025)",
            cursor: meToo.isPending ? "wait" : "pointer",
          }}
        >
          {marked ? ME_TOO_MARKED : ME_TOO_LABEL}
          {count > 0 ? (
            <span style={{ marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>{count}</span>
          ) : null}
        </button>

        <span data-testid="gap-solution-count" style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
          {solutionCountLabel(entry.solutions)}
        </span>
      </div>

      {meToo.isError ? (
        <span role="alert" style={{ ...bodyText, fontSize: 12, color: GAP_RED }}>
          {(meToo.error as Error).message}
        </span>
      ) : null}

      {/* Mounted only once opened: the panel loads the type's fields and the
          answers, and a page of four gaps should not fetch four of each for
          sheets nobody has opened. */}
      {solving ? (
        <Suspense fallback={null}>
          <SolvePanel
            open={solving}
            onOpenChange={setSolving}
            bounty={entry.bounty}
            build={build}
            gapNode={node}
            nodeType={nodeType}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            onChanged={onChanged}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

/**
 * "Solved by @rae" — the credit line under a node a bounty filled.
 *
 * THE BUILD ITSELF RECORDS THIS. accept_bounty_solution writes
 * source_ref = {source: 'bounty', solution_id, solver_id} onto the node it
 * fills, which is the only place the record says who answered. This line is
 * that column, read out. It is quiet on purpose: the node is the creator's
 * build and the solver's contribution is provenance, not a byline over the
 * work.
 */
export function SolvedCredit({ handle }: { handle: string | null }) {
  return (
    <p
      data-testid="gap-solved-credit"
      style={{
        ...labelText,
        margin: 0,
        fontSize: 11,
        color: TEAL,
      }}
    >
      Solved by {handle ? `@${handle}` : "a solver"}
    </p>
  );
}

export default GapPanel;
