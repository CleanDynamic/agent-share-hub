import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { MakerLink } from "@/components/profile/MakerLink";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { TOP_SOLVERS_LIMIT, listTopSolvers, type Solver } from "@/lib/bounty";
import { isPermissionError } from "@/lib/errors/permission";
import { SPACE_COMPACT } from "@/lib/theme/space";
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
      style={phone ? { paddingTop: SPACE_COMPACT.sm } : { padding: SPACE_COMPACT.md }}
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
  const navigate = useNavigate();
  /* A refusal is its own sentence, never an empty board. */
  if (error) {
    return (
      <ErrorState
        data-testid="solvers-error"
        line={isPermissionError(error) ? "You don't have access to this." : undefined}
        panel="Solvers"
        onRetry={onRetry}
        error={error}
      />
    );
  }

  if (isLoading) return <LoadingRows phone={phone} />;

  /* One sentence and one action: where solving starts. */
  if (solvers.length === 0) {
    return (
      <EmptyState
        data-testid="solvers-empty"
        line="Nobody has solved a bounty yet."
        action={{ label: "See open bounties", onClick: () => navigate("/bounties") }}
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

/* ────────────────────────────────────────────────────────────────────────────
   One solver
   ──────────────────────────────────────────────────────────────────────────── */

/** DM Mono 16 with tabular figures: the position and the count. */
const rankFigure = {
  fontFamily: DM_MONO,
  fontSize: 15,
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
        columnGap: SPACE_COMPACT.sm,
        alignItems: "center",
        paddingBlock: SPACE_COMPACT.sm,
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
        <SolverIdentity solver={solver} phone={phone} />
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
                columnGap: SPACE_COMPACT.xs,
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
function SolverIdentity({ solver, phone }: { solver: Solver; phone: boolean }) {
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
      /* MakerLink's own box (36 tall, 44 on a phone, SPACE_COMPACT.xs apart, a 26px avatar), which this stands in for, so the rows line up. */
      style={{ display: "inline-flex", alignItems: "center", gap: SPACE_COMPACT.xs, minHeight: phone ? 44 : 36 }}
    >
      <Avatar style={{ width: 26, height: 26 }}>
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
    <LoadingRegion what="the solvers" data-testid="solvers-loading">
      {Array.from({ length: LOADING_ROWS }, (_, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: phone ? PHONE_COLUMNS : "40px minmax(0, 1fr) 96px",
            columnGap: SPACE_COMPACT.sm,
            rowGap: SPACE_COMPACT.xs,
            alignItems: "center",
            paddingBlock: SPACE_COMPACT.sm,
            borderTop: index === 0 ? undefined : `1px solid ${t.line}`,
          }}
        >
          <Skeleton height={16} />
          {/* The person: MakerLink's 44. */}
          <Skeleton height={44} />
          <Skeleton height={16} style={phone ? { gridColumn: 2 } : undefined} />
        </div>
      ))}
    </LoadingRegion>
  );
}
