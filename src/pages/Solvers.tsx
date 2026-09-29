import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { MakerLink } from "@/components/profile/MakerLink";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { TOP_SOLVERS_LIMIT, listTopSolvers, type Solver } from "@/lib/bounty";
import { isPermissionError } from "@/lib/errors/permission";
import { skeletonStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, data as dataText, tabular } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P13 — /bounties/solvers, the people whose solutions were accepted.

   A SOLVE IS AN ACCEPTED SOLUTION on a bounty that lives on a build
   (top_solvers). This board replaces /b/:id/leaderboard, which ranked people
   against one legacy bounty post and now lands here.

   THE ORDER IS STATED, NOT OFFERED ⟦hicks-law › Budgets: sort controls 0⟧:
   most solved first, in the sentence under the title. No sort, no time range;
   nothing on the page is a choice except the people themselves.

   A RANKED LIST READ DOWN ONE EDGE ⟦law-of-continuity › Alignment and reading
   flow⟧. Every row is its own grid on the same three columns (40px, the
   person, the tally), so the positions end on one edge, the people start on
   one edge and the tallies end on one edge, the whole way down. Positions and
   tallies are DM Mono with tabular figures ⟦buildgallery-theme › Type⟧, so a
   "9" sits over the "9" of "19". Max 720 wide, on the title's leading edge.

   THE WEAKEST CONTAINER ⟦law-of-common-region⟧: rows are flat, parted by a
   --line hairline, as on the bounties board.

   BELOW 768 THE TALLY MOVES UNDER THE NAME ⟦responsive-design › Reflow⟧: a
   390 screen cannot hold a name and "12 solved · £1,250 in rewards" on one
   line, and the position column stays, so the ranking still reads down its
   edge.

   TWO REQUESTS (listTopSolvers): the ranking, then the people's names.
   ──────────────────────────────────────────────────────────────────────────── */

/** How many placeholder rows stand in for the board. */
const LOADING_ROWS = 5;

/** The row's three columns: position, the person, the tally. */
const ROW_COLUMNS = "40px minmax(0, 1fr) auto";

/** Below 768 the tally sits under the person, so two columns. */
const PHONE_COLUMNS = "40px minmax(0, 1fr)";

/** A reward total, as money: "£50" for whole pounds, "£49.50" otherwise. */
const wholePounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const poundsAndPence = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** The total to show, or null when there is none: no reward named, or £0. */
function rewardTotalLabel(total: number | null): string | null {
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  return (Number.isInteger(total) ? wholePounds : poundsAndPence).format(total);
}

export default function Solvers() {
  const phone = useBreakpoint() === "mobile";

  const board = useQuery({
    queryKey: ["top-solvers"],
    queryFn: () => listTopSolvers({ limit: TOP_SOLVERS_LIMIT }),
  });

  return (
    /* The bounties board's frame, so moving between the two changes nothing
       but the list: 24 around the page on the wide frame, which has no inset
       of its own there; on a phone the frame's own 16 is the margin. */
    <div
      data-visual-slot="solvers-frame"
      style={phone ? { paddingTop: SPACE.sm } : { padding: SPACE.md }}
    >
      <Helmet>
        <title>Solvers — buildgallery</title>
      </Helmet>

      <PageHeader
        title="Solvers"
        description="People whose solutions were accepted. Most solved first."
      />

      <div data-visual-slot="solvers-column" style={{ maxWidth: 720 }}>
        <BoardBody
          solvers={board.data ?? []}
          phone={phone}
          isLoading={board.isLoading}
          error={(board.error as Error | null) ?? null}
          onRetry={() => void board.refetch()}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The board's states
   ──────────────────────────────────────────────────────────────────────────── */

function BoardBody({
  solvers,
  phone,
  isLoading,
  error,
  onRetry,
}: {
  solvers: Solver[];
  phone: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  /* STATES.md row 21: a refusal is its own sentence, never an empty board. */
  if (error) {
    return (
      <StateLine
        testId="solvers-error"
        sentence={isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
        action={
          <Button type="button" variant="outline" onClick={onRetry} style={{ background: "transparent" }}>
            Try again
          </Button>
        }
      />
    );
  }

  if (isLoading) return <LoadingRows phone={phone} />;

  /* STATES.md row 19: one sentence and one action, secondary (row 2), as the
     bounties board's is, because the frame's own controls spend the primary on
     the phone and signed out. The action is where solving starts. */
  if (solvers.length === 0) {
    return (
      <StateLine
        testId="solvers-empty"
        sentence="Nobody has solved a bounty yet."
        action={
          <Button asChild variant="outline" style={{ background: "transparent" }}>
            <Link to="/bounties">See open bounties</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ol
      data-testid="solvers-board"
      aria-label="Solvers, most solved first"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {solvers.map((solver, index) => (
        <SolverRow key={solver.id} solver={solver} position={index + 1} phone={phone} />
      ))}
    </ol>
  );
}

function StateLine({
  testId,
  sentence,
  action,
}: {
  testId: string;
  sentence: string;
  action: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: SPACE.sm,
        paddingBottom: SPACE.lg,
      }}
    >
      <p style={{ ...body, margin: 0, color: t.text2 }}>{sentence}</p>
      {action}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   One solver
   ──────────────────────────────────────────────────────────────────────────── */

/** DM Mono 16 with tabular figures: the position and the count. */
const rankFigure = {
  fontFamily: DM_MONO,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.4,
  ...tabular,
  whiteSpace: "nowrap",
} as const;

/**
 * One row: position | the person | how many they solved and, when their
 * bounties named rewards, the total ⟦law-of-proximity⟧. A NEW element, so its
 * grid is its own.
 *
 * THE POSITION ENDS ON THE COLUMN'S TRAILING EDGE, so every position sits the
 * same 16 from its avatar and the units line up down the list whether the
 * position is 9 or 19.
 */
function SolverRow({
  solver,
  position,
  phone,
}: {
  solver: Solver;
  position: number;
  phone: boolean;
}) {
  const reward = rewardTotalLabel(solver.rewardTotalGbp);

  return (
    <li
      data-testid="solver-row"
      style={{
        display: "grid",
        gridTemplateColumns: phone ? PHONE_COLUMNS : ROW_COLUMNS,
        columnGap: SPACE.sm,
        alignItems: "center",
        paddingBlock: SPACE.sm,
        ...(position === 1 ? {} : { borderTop: `1px solid ${t.line}` }),
      }}
    >
      <span
        data-testid="solver-position"
        style={{ ...rankFigure, color: t.text2, textAlign: "end" }}
      >
        {position}
      </span>

      <div style={{ minWidth: 0 }}>
        <SolverIdentity solver={solver} />
      </div>

      <div
        data-testid="solver-tally"
        style={
          phone
            ? {
                gridColumn: 2,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                columnGap: SPACE.xs,
              }
            : {
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                textAlign: "end",
              }
        }
      >
        <span data-testid="solver-solved" style={{ ...rankFigure, color: t.text }}>
          {solver.solved} solved
        </span>
        {reward ? (
          <span
            data-testid="solver-reward"
            style={{
              fontFamily: DM_MONO,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.3,
              ...tabular,
              color: t.text2,
              whiteSpace: "nowrap",
            }}
          >
            {reward} in rewards
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The person: the shared maker link (avatar, name, handle → their profile),
 * the same one the gallery and Home use ⟦law-of-similarity⟧. A solver whose
 * profile has no handle has no address, so they keep their place in the
 * ranking with the same avatar and name and no link.
 */
function SolverIdentity({ solver }: { solver: Solver }) {
  if (solver.username) {
    return (
      <MakerLink
        testId="solver-maker"
        maker={{
          id: solver.id,
          username: solver.username,
          display_name: solver.display_name,
          avatar_url: solver.avatar_url,
        }}
      />
    );
  }

  const name = solver.display_name?.trim() || "A solver";
  return (
    <span
      data-testid="solver-maker"
      style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs, minHeight: 44 }}
    >
      <Avatar style={{ width: 32, height: 32 }}>
        <AvatarFallback style={{ background: t.recess, color: t.text2, ...dataText }}>
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span style={{ ...body, color: t.text }}>{name}</span>
    </span>
  );
}

/** STATES.md row 20: the rows' shape before the rows, in --recess. */
function LoadingRows({ phone }: { phone: boolean }) {
  return (
    <div data-testid="solvers-loading" aria-hidden>
      {Array.from({ length: LOADING_ROWS }, (_, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: phone ? PHONE_COLUMNS : "40px minmax(0, 1fr) 96px",
            columnGap: SPACE.sm,
            rowGap: SPACE.xs,
            alignItems: "center",
            paddingBlock: SPACE.sm,
            borderTop: index === 0 ? undefined : `1px solid ${t.line}`,
          }}
        >
          <div style={{ ...skeletonStyle(), height: 20 }} />
          <div style={{ ...skeletonStyle(), height: 44 }} />
          <div style={{ ...skeletonStyle(), height: 20, ...(phone ? { gridColumn: 2 } : {}) }} />
        </div>
      ))}
    </div>
  );
}
