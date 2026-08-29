// Answering a gap, and the author accepting the answer (NS-P52).
//
// THIS IS THE NEW PATH'S SOLVE SURFACE. src/pages/BountySolvePage.tsx is the
// legacy one and stays exactly as it is: it fills a stage or a block in a
// content_items stage_grids blob, and it is still reachable at /b/:id. This
// panel fills a GAP NODE in a build, so a solution here is a payload for that
// node's own type and accepting one substitutes it into the record.
//
// THE FORM IS THE GAP'S OWN TYPE, AND THAT IS THE WHOLE DESIGN. A solver does
// not write prose about what the answer might be; they fill in the same fields
// the creator would have filled in, because submitSolution validates the
// payload against the gap node's type schema and acceptSolution puts it on the
// node. So the form is SchemaForm — the workspace's own — rendered in its
// controlled mode over a payload that starts empty. Controlled matters: the
// ordinary SchemaForm debounces its way into build_nodes, and a solver typing
// into somebody else's published build is a write RLS would refuse halfway
// through a sentence.
//
// A SUBMITTED SOLUTION IS RENDERED BY THE SAME RENDERER AS A NODE, for the same
// reason: the answer is a node payload, so what a reader sees when they judge
// it should be what they will see if it is accepted. The renderer is resolved
// from the gap node's type through the registry, exactly as NodeCard does.
//
// TWO WAYS IN, RANKED, AND THE RANKING IS THE DESIGN (NS-P53). The form above
// is now the SECOND option, behind a quiet link, and the first is "Solve it in
// a rebuild": fork the build, fill the gap inside your own copy, publish it as
// yours, submit that. The form is the right shape for an answer that is one
// node and the wrong shape for everything else — a gap whose real fix is two
// steps earlier cannot be expressed in the field the gap declares, and a solver
// who did that work should not have to throw away the eight changes that made
// it work to file the one the form asks for.
//
// Ranking them is not decoration either. Whichever option is the button is the
// one most people take, so putting the form first would keep teaching solvers
// that an answer is a paragraph in someone else's page. The rebuild leaves the
// solver with a build of their own, carrying their name and their own
// reproduction count, whether or not the author ever accepts it.
//
// Styled with inline style objects, like every other surface on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptSolution,
  listMySolutionRebuilds,
  listSolutions,
  startSolutionRebuild,
  submitSolution,
  submitSolutionRebuild,
  voteOnSolution,
  type Bounty,
  type BountySolution,
  type SolutionBuild,
} from "@/lib/bounty";
import {
  getFieldsFor,
  type Build,
  type BuildNode,
  type FieldDef,
  type NodePayload,
  type NodeType,
} from "@/lib/build";
import { SchemaForm } from "@/components/compose/SchemaForm";
import {
  resolveRenderer,
  type ResolveMedia,
  type ResolveNode,
} from "@/components/build/renderers";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  panelGlass,
  titleText,
} from "@/components/build/tokens";
import { reproductionLabel, solverHandle } from "./bountyDisplay";

/** The copy that has to survive a rewrite, held where it can be read at once. */
const HEADING = "Offer a solution";
const LEAD =
  "If your answer is accepted it becomes this part of the build, credited to you.";
/** The primary path, named as the thing it gives you rather than the work. */
const REBUILD_LABEL = "Solve it in a rebuild";
const REBUILD_SUB =
  "You get the whole build to work with. Your solution is your version, published.";
/** The quiet one. A link, not a button, and that is the ranking. */
const DIRECT_LABEL = "Just send the missing part";
const DIRECT_SUB =
  "Right when the answer is only this one part and nothing around it changes.";
/** What a solver sees on the way back, holding a published rebuild. */
const RETURNING_LEAD = "You have a published rebuild that solves this gap.";
const SUBMIT_REBUILD_LABEL = "Submit your rebuild as the solution";
const NOTE_LABEL = "Anything the creator should know? (optional)";
const NOTE_HELP =
  "How you got there, what you would check first — the part that does not fit in the fields.";
const SIGNED_OUT = "Sign in to offer a solution.";
const EMPTY_SOLUTIONS = "Nobody has answered this yet. You would be the first.";
/** The consequence, named before the author commits to it. */
const ACCEPT_CONFIRM =
  "This fills the gap in your build and credits @solver on the node.";
/**
 * The same consequence, for an answer that lives in somebody else's build.
 *
 * Said explicitly because it is the one thing about this path an author could
 * reasonably not expect: what lands on their node is read from the solver's
 * published build at the moment they accept, not from the copy stored when it
 * was submitted. Their build gains one node; the solver's is untouched.
 */
const ACCEPT_REBUILD_CONFIRM =
  "This pulls that part from @solver's published rebuild into your build, and links the node to it. Their build is not changed.";

/** A node type's fields change about as often as the registry is edited. */
const FIELDS_STALE_MS = 5 * 60 * 1000;

const controlBase: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
  whiteSpace: "nowrap",
  border: `1px solid ${HAIRLINE}`,
  background: "rgba(255,255,255,0.025)",
  color: TEXT_SECONDARY,
};

const textareaStyle: CSSProperties = {
  ...bodyText,
  fontFamily: "inherit",
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: TEXT_PRIMARY,
  outline: "none",
  resize: "vertical",
};

export interface SolvePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bounty: Bounty;
  build: Build;
  /** The gap this bounty is the header for. Its TYPE decides the form. */
  gapNode: BuildNode;
  /** The registry row for that type, for the form and for the renderer. */
  nodeType?: NodeType;
  /** From the page's loaded tree, so a renderer never queries. */
  resolveNode: ResolveNode;
  /** From the page's one media query, for the same reason. */
  resolveMedia: ResolveMedia;
  /**
   * A solution landed, or one was accepted.
   *
   * The page refetches on 'accepted' — the gap node is a filled node now and
   * the record on screen is out of date — and refreshes its bounty counts on
   * 'submitted'. This component does neither itself: it does not own the
   * record, and a component that invalidated somebody else's query key would
   * be guessing at what that key is.
   */
  onChanged: (change: "submitted" | "accepted") => void;
}

export function SolvePanel({
  open,
  onOpenChange,
  bounty,
  build,
  gapNode,
  nodeType,
  resolveNode,
  resolveMedia,
  onChanged,
}: SolvePanelProps) {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isAuthor = Boolean(user && user.id === bounty.author_id);

  /** The answer being written. Starts empty: this is a new payload, not an
   *  edit of the question's. */
  const [draft, setDraft] = useState<NodePayload>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Which solution the author has asked to accept, awaiting the confirm. */
  const [confirming, setConfirming] = useState<string | null>(null);
  /**
   * Whether the typed form has been asked for.
   *
   * CLOSED BY DEFAULT, and that is the ranking made structural rather than
   * merely visual: the form is real work to look at — a whole schema's fields —
   * and a panel that renders it immediately has already chosen for the solver.
   */
  const [directOpen, setDirectOpen] = useState(false);

  const { data: fields } = useQuery<FieldDef[]>({
    queryKey: ["node-type-fields", gapNode.type],
    queryFn: () => getFieldsFor(gapNode.type),
    enabled: open,
    staleTime: FIELDS_STALE_MS,
  });

  const solutionsKey = useMemo(
    () => ["bounty-solutions", bounty.id, user?.id ?? null],
    [bounty.id, user?.id],
  );

  const solutions = useQuery<BountySolution[]>({
    queryKey: solutionsKey,
    queryFn: () => listSolutions({ bountyId: bounty.id, viewerId: user?.id ?? null }),
    enabled: open,
  });

  /**
   * The caller's own published rebuilds that declare they solve THIS gap.
   *
   * What turns a second visit into one click. A solver who started a rebuild
   * yesterday, filled it and published it has already done everything the
   * submission needs; asking them to find their own build in a picker would be
   * asking them to repeat a decision the draft already recorded.
   *
   * Not run for the author — a bounty author is not a candidate solver on their
   * own bounty — and not run signed out, where there is nobody to have any.
   */
  const myRebuilds = useQuery<SolutionBuild[]>({
    queryKey: ["my-solution-rebuilds", gapNode.id, user?.id ?? null],
    queryFn: () =>
      listMySolutionRebuilds({ gapNodeId: gapNode.id, creatorId: user?.id as string }),
    enabled: open && isLoggedIn && !isAuthor && bounty.status === "open" && Boolean(user),
  });

  /** The newest qualifying one. listMySolutionRebuilds returns newest first. */
  const readyRebuild = (myRebuilds.data ?? [])[0] ?? null;

  const refetchSolutions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["bounty-solutions", bounty.id] });
  }, [bounty.id, queryClient]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(SIGNED_OUT);
      return submitSolution({
        bountyId: bounty.id,
        nodePayload: draft,
        solverId: user.id,
        solverNote: note.trim() === "" ? null : note,
      });
    },
    onSuccess: () => {
      setDraft({});
      setNote("");
      setError(null);
      refetchSolutions();
      onChanged("submitted");
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    },
  });

  /**
   * Fork the build, declare the gap, and hand the solver to their workspace.
   *
   * The navigation is the same one RebuildRoute performs, and deliberately so:
   * a solution rebuild is an ordinary rebuild that happens to name what it is
   * answering, and a solver who lands somewhere unfamiliar has been told the
   * two things are different when they are not.
   */
  const startRebuild = useMutation({
    mutationFn: () => startSolutionRebuild(bounty.id),
    onSuccess: (draftBuild) => {
      setError(null);
      navigate(`/compose/${draftBuild.id}?from=rebuild`);
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    },
  });

  const submitRebuild = useMutation({
    mutationFn: () => {
      if (!readyRebuild) throw new Error("There is no published rebuild to submit.");
      return submitSolutionRebuild({
        bountyId: bounty.id,
        solutionBuildId: readyRebuild.id,
        solverNote: note.trim() === "" ? null : note,
      });
    },
    onSuccess: () => {
      setNote("");
      setError(null);
      refetchSolutions();
      // The build is filed now, so the offer to file it should stop standing.
      void queryClient.invalidateQueries({ queryKey: ["my-solution-rebuilds", gapNode.id] });
      onChanged("submitted");
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    },
  });

  const accept = useMutation({
    mutationFn: (solutionId: string) => acceptSolution(bounty.id, solutionId),
    onSuccess: () => {
      setConfirming(null);
      setError(null);
      refetchSolutions();
      onChanged("accepted");
    },
    onError: (cause: unknown) => {
      setConfirming(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    },
  });

  const vote = useMutation({
    mutationFn: (solutionId: string) => {
      if (!user) throw new Error("Sign in to vote.");
      return voteOnSolution({
        solutionId,
        voterId: user.id,
        voteKind: "upvote",
      });
    },
    onSuccess: refetchSolutions,
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    },
  });

  const signIn = useCallback(() => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  }, [location.pathname, navigate]);

  const busy =
    submit.isPending ||
    accept.isPending ||
    startRebuild.isPending ||
    submitRebuild.isPending;
  const rows = solutions.data ?? [];
  const closed = bounty.status !== "open";

  return (
    <Sheet open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <SheetContent
        side="bottom"
        data-visual-slot="modal-surface"
        data-testid="solve-panel"
        style={{
          ...panelGlass,
          color: TEXT_PRIMARY,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 720,
          maxHeight: "86vh",
          overflowY: "auto",
          margin: "0 auto",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SheetTitle style={{ ...titleText, margin: 0 }}>{HEADING}</SheetTitle>
          <SheetDescription style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
            {LEAD}
          </SheetDescription>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
            {gapNode.title ?? "This part"} · {nodeType?.label ?? gapNode.type}
          </span>
        </div>

        {/* The form, or the reason there is not one. A closed or solved bounty
            keeps its answers on screen and stops taking new ones. */}
        {closed ? (
          <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
            This bounty is {bounty.status}, so it is not taking solutions. The
            answers below stay readable.
          </p>
        ) : !isLoggedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{SIGNED_OUT}</p>
            <button type="button" onClick={signIn} style={controlBase}>
              Sign in
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* THE RETURNING SOLVER. Offered first when it applies, because
                somebody holding a finished rebuild has no decision left to
                make — the two options below are for the visit before this one. */}
            {readyRebuild ? (
              <div
                data-testid="ready-rebuild"
                style={{
                  ...cardGlass,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  borderLeft: `2px solid ${hexToRgba(TEAL, 0.5)}`,
                }}
              >
                <p style={{ ...bodyText, margin: 0, color: TEXT_PRIMARY }}>
                  {RETURNING_LEAD}
                </p>
                <SolutionBuildLine build={readyRebuild} />

                {/* The same optional note the form offers, for the same reason:
                    the diff says what changed and the note says why. Shared
                    state with the form's, because a solver only ever submits
                    through one of the two. */}
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
                    {NOTE_LABEL}
                  </span>
                  <textarea
                    data-testid="rebuild-solution-note"
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    style={textareaStyle}
                  />
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {/* VISUAL SLOT — the primary button surface is supplied
                      externally. Geometry and behaviour only here. */}
                  <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
                    <button
                      type="button"
                      data-testid="submit-rebuild-solution"
                      disabled={busy}
                      onClick={() => submitRebuild.mutate()}
                      style={{
                        ...controlBase,
                        color: VOID,
                        background: TEAL,
                        border: `1px solid ${TEAL}`,
                        fontWeight: 600,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {submitRebuild.isPending ? "Submitting…" : SUBMIT_REBUILD_LABEL}
                    </button>
                  </span>
                </div>
              </div>
            ) : null}

            {/* THE TWO OPTIONS, RANKED. A button and a link, not two buttons:
                the difference in weight is the recommendation. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span data-visual-slot="btn-primary" style={{ display: "inline-flex", alignSelf: "flex-start" }}>
                  <button
                    type="button"
                    data-testid="solve-rebuild"
                    disabled={busy}
                    onClick={() => startRebuild.mutate()}
                    style={{
                      ...controlBase,
                      color: VOID,
                      background: TEAL,
                      border: `1px solid ${TEAL}`,
                      fontWeight: 600,
                      cursor: busy ? "not-allowed" : "pointer",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {startRebuild.isPending ? "Setting it up…" : REBUILD_LABEL}
                  </button>
                </span>
                <span style={{ ...bodyText, fontSize: 12, color: TEXT_SECONDARY }}>
                  {REBUILD_SUB}
                </span>
              </div>

              {/* The quiet one. A button element for the keyboard and the
                  screen reader; a link everywhere it is looked at. */}
              {directOpen ? null : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    data-testid="solve-direct"
                    onClick={() => setDirectOpen(true)}
                    style={{
                      ...bodyText,
                      fontFamily: "inherit",
                      alignSelf: "flex-start",
                      padding: 0,
                      background: "transparent",
                      border: "none",
                      color: TEXT_SECONDARY,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      cursor: "pointer",
                    }}
                  >
                    {DIRECT_LABEL}
                  </button>
                  <span style={{ ...bodyText, fontSize: 11, color: TEXT_MUTED }}>
                    {DIRECT_SUB}
                  </span>
                </div>
              )}
            </div>

            {/* The NS-P52 form, unchanged in every respect except that it is
                now asked for rather than assumed. */}
            {directOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* CONTROLLED: the payload lives in this component and nothing is
                written to build_nodes. See SchemaForm's props. */}
            <SchemaForm
              buildId={build.id}
              node={gapNode}
              fields={fields ?? []}
              payload={draft}
              onPatchPayload={(patch) =>
                setDraft((current) => ({ ...current, ...patch }))
              }
            />

            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
                {NOTE_LABEL}
              </span>
              <textarea
                data-testid="solution-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                style={textareaStyle}
              />
              <span style={{ ...bodyText, fontSize: 11, color: TEXT_MUTED }}>
                {NOTE_HELP}
              </span>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* VISUAL SLOT — the primary button surface is supplied
                  externally. Geometry and behaviour only here. */}
              <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
                <button
                  type="button"
                  data-testid="solution-submit"
                  disabled={busy}
                  onClick={() => submit.mutate()}
                  style={{
                    ...controlBase,
                    color: VOID,
                    background: TEAL,
                    border: `1px solid ${TEAL}`,
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {submit.isPending ? "Sending…" : "Submit solution"}
                </button>
              </span>
              <span style={{ ...bodyText, fontSize: 11, color: TEXT_MUTED }}>
                The creator decides. Nothing changes in the build until they
                accept.
              </span>
            </div>
              </div>
            ) : null}
          </div>
        )}

        {error ? (
          <p
            role="alert"
            data-testid="solve-error"
            style={{ ...bodyText, margin: 0, fontSize: 12, color: GAP_RED }}
          >
            {error}
          </p>
        ) : null}

        <div style={{ height: 1, background: HAIRLINE }} />

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ ...labelText, margin: 0, textTransform: "uppercase", color: TEXT_MUTED }}>
            Solutions
          </h3>

          {solutions.isLoading ? (
            <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>{EMPTY_SOLUTIONS}</p>
          ) : (
            rows.map((solution) => (
              <SolutionRow
                key={solution.id}
                solution={solution}
                gapNode={gapNode}
                nodeType={nodeType}
                build={build}
                resolveNode={resolveNode}
                resolveMedia={resolveMedia}
                canAccept={isAuthor && bounty.status === "open"}
                confirming={confirming === solution.id}
                busy={busy}
                onAsk={() => setConfirming(solution.id)}
                onCancel={() => setConfirming(null)}
                onAccept={() => accept.mutate(solution.id)}
                onVote={() => (isLoggedIn ? vote.mutate(solution.id) : signIn())}
              />
            ))
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}

/**
 * A rebuild-solution's build, as a line you can click.
 *
 * TITLE AND REPRO COUNT, AND THE COUNT IS THE POINT. Two answers to one gap are
 * otherwise ranked by votes, which measure who read them first. A published
 * rebuild carries the one number nobody can award themselves — how many people
 * ran it and said what happened — and putting it beside the title is what lets
 * an author rank the answers by evidence rather than by enthusiasm.
 *
 * The link opens the solver's build, not a preview of it: the whole argument
 * for this path is that the answer is a build, and a card that summarised it
 * into three lines would be making the opposite case.
 */
function SolutionBuildLine({ build }: { build: SolutionBuild }) {
  return (
    <div
      data-testid="solution-build-link"
      data-build-id={build.id}
      style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}
    >
      <Link
        to={`/b2/${build.slug}`}
        style={{
          ...labelText,
          fontSize: 12,
          color: TEAL,
          textDecoration: "none",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {build.title}
      </Link>
      <span
        data-testid="solution-build-repros"
        style={{
          ...labelText,
          fontSize: 10.5,
          color: build.reproduction_count > 0 ? TEAL : TEXT_MUTED,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {reproductionLabel(build.reproduction_count)}
      </span>
    </div>
  );
}

/**
 * One answer: who wrote it, what they said, and the payload itself.
 *
 * THE PAYLOAD IS DRAWN BY THE NODE RENDERER, not by a list of key/value pairs.
 * A reader judging an answer to a prompt node should see a prompt, laid out the
 * way every prompt on the platform is laid out — and if the author accepts it,
 * that is exactly what the build will show. The node handed to the renderer is
 * the gap node with this payload on it and its gap flag cleared, which is
 * precisely what acceptSolution will write.
 */
function SolutionRow({
  solution,
  gapNode,
  nodeType,
  build,
  resolveNode,
  resolveMedia,
  canAccept,
  confirming,
  busy,
  onAsk,
  onCancel,
  onAccept,
  onVote,
}: {
  solution: BountySolution;
  gapNode: BuildNode;
  nodeType?: NodeType;
  build: Build;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  canAccept: boolean;
  confirming: boolean;
  busy: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onVote: () => void;
}) {
  const Renderer = resolveRenderer(nodeType?.renderer);
  const accepted = solution.status === "accepted";
  const who = solverHandle(solution.solver);

  const answered: BuildNode = {
    ...gapNode,
    payload: solution.content_payload,
    is_gap: false,
  };

  return (
    <article
      data-testid="solution-row"
      data-solution-id={solution.id}
      style={{
        ...cardGlass,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...(accepted ? { borderLeft: `3px solid ${TEAL}` } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...labelText, fontSize: 12, color: TEXT_PRIMARY }}>{who}</span>
        {accepted ? (
          <span
            style={{
              ...labelText,
              fontSize: 10.5,
              color: TEAL,
              padding: "1px 6px",
              borderRadius: 4,
              background: hexToRgba(TEAL, 0.1),
            }}
          >
            ACCEPTED
          </span>
        ) : null}

        <button
          type="button"
          data-testid="solution-vote"
          onClick={onVote}
          aria-pressed={solution.myVote}
          style={{
            ...controlBase,
            marginLeft: "auto",
            padding: "2px 9px",
            fontSize: 11,
            color: solution.myVote ? TEAL : TEXT_SECONDARY,
            background: solution.myVote ? hexToRgba(TEAL, 0.12) : "transparent",
            border: `1px solid ${solution.myVote ? hexToRgba(TEAL, 0.3) : HAIRLINE}`,
          }}
        >
          ▲ {solution.vote_count}
        </button>
      </div>

      {/* A REBUILD-SOLUTION SAYS SO BEFORE IT SAYS ANYTHING ELSE. The payload
          below is one node of a whole published build, and a reader who judged
          it without knowing that would be judging a fragment. The build that
          can no longer be read (deleted, or unpublished since) resolves to null
          and the row renders without this block — the payload on it is still
          what was offered, and losing the link is not losing the answer. */}
      {solution.solutionBuild ? (
        <div
          data-testid="solution-rebuild-card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${hexToRgba(TEAL, 0.22)}`,
            background: hexToRgba(TEAL, 0.06),
          }}
        >
          <span style={{ ...labelText, fontSize: 10.5, color: TEAL, textTransform: "uppercase" }}>
            Solved in a rebuild
          </span>
          <SolutionBuildLine build={solution.solutionBuild} />
        </div>
      ) : null}

      {solution.solver_note ? (
        <p
          style={{
            ...bodyText,
            margin: 0,
            color: TEXT_SECONDARY,
            whiteSpace: "pre-wrap",
          }}
        >
          {solution.solver_note}
        </p>
      ) : null}

      <div data-renderer-slot={nodeType?.renderer ?? "generic"} style={{ minWidth: 0 }}>
        <Renderer
          node={answered}
          nodeType={nodeType}
          build={build}
          resolveNode={resolveNode}
          resolveMedia={resolveMedia}
        />
      </div>

      {canAccept && !accepted ? (
        confirming ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ ...bodyText, margin: 0, fontSize: 12, color: TEXT_SECONDARY }}>
              {(solution.solutionBuild ? ACCEPT_REBUILD_CONFIRM : ACCEPT_CONFIRM).replace(
                "@solver",
                who,
              )}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="solution-accept-confirm"
                disabled={busy}
                onClick={onAccept}
                style={{
                  ...controlBase,
                  color: VOID,
                  background: TEAL,
                  border: `1px solid ${TEAL}`,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "Accepting…" : "Yes, accept it"}
              </button>
              <button type="button" onClick={onCancel} disabled={busy} style={controlBase}>
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              data-testid="solution-accept"
              onClick={onAsk}
              style={{ ...controlBase, color: TEAL, border: `1px solid ${hexToRgba(TEAL, 0.3)}` }}
            >
              Accept
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}

export default SolvePanel;
