// The reader's action on a build page: I ran this, and here is what happened.
//
// WHY THE COUNT IS THE BIGGEST NUMBER ON THE PAGE. Views, downloads and forks
// all count people who clicked something. A reproduction counts someone who
// went away, did the work, came back and said what happened — and who, by the
// RLS policy on build_reproductions, is not the creator. It is the only figure
// here that cost anybody anything, so it is set at COUNT_FONT_SIZE, twice the
// page heading, and nothing else on this route is allowed to out-shout it.
//
// The control is shown to everyone, signed in or not. A reader who is not
// signed in is sent to sign in and brought back to the build they were reading:
// hiding the action from them would make the page look like it had no action,
// which is a worse lie than a round trip.
//
// One row per person, so the sheet is the same sheet whether it is the first
// time or a correction. recordReproduction upserts; nothing here has to know
// which of the two it is doing.
//
// Beneath the count sits the freshness line, and it is the one place on this
// page where saying nothing is the correct output. freshnessLabel returns null
// for a build nobody has confirmed, and a build nobody has confirmed has no
// freshness — so the block says it has not been confirmed rather than dating a
// confirmation that never happened.
//
// THE CREATOR GETS A DIFFERENT CONTROL, not a broken one. They cannot record a
// reproduction of their own build — the database refuses the row — so offering
// them "I ran this and it worked" would be offering a button that fails. What
// they get instead is a re-confirmation, which moves the freshness date and
// leaves the count alone, and it is put in front of them when the build has
// gone quiet for four months rather than sitting there inviting a creator to
// keep their own work looking fresh.

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  getBuildHeader,
  getReproductions,
  isStale,
  recordReproduction,
  recordSelfConfirmation,
  type Build,
  type BuildReproduction,
} from "@/lib/build";
import { Plaque } from "@/components/brand/Plaque";
import { fieldStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyType,
  cardTitle,
  data as dataType,
  eyebrow,
  label as labelType,
  measure,
} from "@/lib/theme/type";
import { panelGlass } from "./tokens";
import { useActionStyle } from "./actionStyle";

/** Enough rows that a reader's own is almost always among them. See `mine`. */
const REPRODUCTION_FETCH_LIMIT = 200;

const REPRODUCTIONS_STALE_TIME = 60_000;

/**
 * The geometry every control on this panel keeps, over BG-P07's treatments.
 *
 * Padding, whitespace and the label role only: the colour, the border and the
 * radius come from `buttonStyle` through `useActionStyle`, so a control here
 * is repainted without being moved.
 */
const controlBase: React.CSSProperties = {
  ...labelType,
  padding: "8px 14px",
  whiteSpace: "nowrap",
};

/**
 * The sheet's inputs, on BG-P07's field treatment.
 *
 * A field is a surface the page is cut INTO — `--recess` with a `--line` border
 * that brightens to `--action` on focus — which is what separates it from a
 * button sitting on the page. It was a 2.5% white wash with a 6% white border,
 * invisible in the light room.
 *
 * No font size is set here on purpose: index.css forces 16px on every input
 * below 768px, because anything smaller makes mobile Safari zoom the viewport
 * on focus and never zoom back.
 */
const inputStyle: React.CSSProperties = {
  ...fieldStyle(),
  fontFamily: "inherit",
  width: "100%",
  padding: "8px 10px",
  color: t.text,
};

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ ...eyebrow, color: t.text2 }}>{label}</span>
      {children}
      {help ? (
        <span style={{ ...dataType, ...measure, color: t.text2 }}>{help}</span>
      ) : null}
    </div>
  );
}

/** What the count says next to itself. Zero gets its own sentence. */
export interface ReproductionActionProps {
  build: Build;
  /**
   * Handed the build header as the database has it after a write, so the page
   * that owns the record can put the new count on screen without a reload.
   */
  onRecorded?: (build: Build) => void;
}

export function ReproductionAction({ build, onRecorded }: ReproductionActionProps) {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isCreator = Boolean(user && user.id === build.creator_id);

  const [open, setOpen] = useState(false);
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  /* One per control, because each tracks its own hover, focus and press. The
     sheet's pair is mounted with the sheet and costs nothing while it is shut. */
  const confirmAction = useActionStyle("secondary");
  const inviteAction = useActionStyle("secondary");
  const updateAction = useActionStyle("ghost");
  const declineAction = useActionStyle("ghost", { disabled: pending });
  const submitAction = useActionStyle("default", { disabled: pending });
  const [error, setError] = useState<string | null>(null);
  /** The row this session just wrote. Authoritative over the list below. */
  const [justRecorded, setJustRecorded] = useState<BuildReproduction | null>(null);

  /**
   * The build's reproductions, so a returning reader is met by what they said
   * last time rather than by an invitation to say it again.
   *
   * Not fetched for the creator: they cannot have one. BEST EFFORT on a cold
   * load — the read is capped, so a reader whose confirmation has been pushed
   * past the limit by two hundred later ones sees the first-time control. The
   * write is an upsert, so acting on it corrects the row rather than adding a
   * second.
   */
  const { data: rows, refetch } = useQuery<BuildReproduction[]>({
    queryKey: ["build-reproductions", build.id],
    queryFn: () => getReproductions(build.id, REPRODUCTION_FETCH_LIMIT),
    enabled: Boolean(user) && !isCreator,
    staleTime: REPRODUCTIONS_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const mine = useMemo(() => {
    if (justRecorded) return justRecorded;
    if (!user) return null;
    return rows?.find((row) => row.user_id === user.id) ?? null;
  }, [justRecorded, rows, user]);

  const count = build.reproduction_count ?? 0;
  const stale = isStale(build);

  /** The models this build says it was made with, offered rather than imposed. */
  const suggestions = useMemo(
    () => (build.made_with ?? []).filter((entry) => entry.trim().length > 0),
    [build.made_with]
  );

  const openSheet = useCallback(() => {
    if (!isLoggedIn) {
      // The same round trip the fork control takes, so the reader lands back on
      // the build they were reading rather than on the home page.
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setModel((isCreator ? build.last_confirmed_model : mine?.model_used) ?? "");
    setNote(mine?.note ?? "");
    setError(null);
    setOpen(true);
  }, [
    build.last_confirmed_model,
    isCreator,
    isLoggedIn,
    location.pathname,
    mine,
    navigate,
  ]);

  const submit = useCallback(
    async (worked: boolean) => {
      setPending(true);
      setError(null);
      try {
        const row = await recordReproduction({
          buildId: build.id,
          worked,
          modelUsed: model,
          note,
        });
        setJustRecorded(row);

        // The count is maintained by a trigger on build_reproductions, so the
        // truth after a write is on the row rather than in any arithmetic this
        // component could do. One small read, and the header is exact.
        const fresh = await getBuildHeader(build.id);
        if (fresh) onRecorded?.(fresh);
        void refetch();
        setOpen(false);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "That could not be recorded. Try again in a moment."
        );
      } finally {
        setPending(false);
      }
    },
    [build.id, model, note, onRecorded, refetch]
  );

  /**
   * The creator saying it still works.
   *
   * The header is re-read afterwards for the same reason a reproduction re-reads
   * it: what the page renders should be what the database holds, not what this
   * component believes it just wrote.
   */
  const confirmStillWorks = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await recordSelfConfirmation({ buildId: build.id, modelUsed: model });
      const fresh = await getBuildHeader(build.id);
      if (fresh) onRecorded?.(fresh);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That could not be recorded. Try again in a moment."
      );
    } finally {
      setPending(false);
    }
  }, [build.id, model, onRecorded]);

  return (
    <div
      data-visual-slot="build-reproduction"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span style={{ ...eyebrow, color: t.text2 }}>Reproduction</span>

      {/* BG-P11: the count and the freshness line are the SHARED PLAQUE now,
          in the slot they already occupied. Two things changed and neither is
          a move.

          THE 44px FIGURE IS GONE, and that is the von-Restorff correction this
          prompt asks for: "make it the distinct one without inflating it". A
          44px numeral made the count distinct by shouting, which costs the
          panel's other figures their own scale and does not survive greyscale
          any better than a fill does. The plaque makes it distinct by being
          the only filled ground on an object that is otherwise mono text on
          nothing — isolation by fill and weight, which is what the effect
          actually asks for — and steps the numeral up one notch inside that
          tag rather than across the page.

          THE LAMP ARRIVES. This panel never had one: a build gone stale said
          so in a sentence to its CREATOR and said nothing at all to everybody
          else, so the one reader who most needs to know the claim is old — the
          person deciding whether to spend an hour on it — was the one reader
          not told. The plaque dims the lamp for all of them. */}
      <Plaque build={build} size="header" />

      {isCreator ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stale ? (
            <p
              data-testid="stale-prompt"
              style={{ ...bodyType, ...measure, margin: 0, color: t.text2 }}
            >
              no one has confirmed this in four months — is it still working?
            </p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* SECONDARY IN BOTH STATES, AND STALE IS NOT ALARM. A build that
                has gone quiet is a prompt to its creator, not a failure — the
                plaque above has already dimmed its lamp, which is the theme's
                own signal for it. Stale here only thickens the border to
                `--action` and adds the weight; it does not fill, because a
                filled button would be this page's second primary and would
                read as "something is wrong" rather than "worth a look". */}
            <button
              type="button"
              onClick={openSheet}
              {...confirmAction.handlers}
              style={{
                ...confirmAction.style,
                ...controlBase,
                ...(stale ? { borderColor: t.action, color: t.action, fontWeight: 600 } : {}),
              }}
            >
              It still works
            </button>
            <span style={{ ...dataType, ...measure, color: t.text2 }}>
              The count is other people. Your own confirmation moves the date,
              not the number.
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {mine ? (
            <>
              {/* THE QUIET CONFIRMATION. Once a reader has recorded one, the
                  invitation has been taken and the control becomes a record of
                  it: a 6px lamp in `--evidence` and a line of mono, with the
                  correction available as a ghost link beside it. No fill, no
                  border, nothing competing with the plaque above — the fact is
                  already filed, and a button that keeps asking would be asking
                  for something it already has. `--cat-breakage` carries the
                  other answer, in the one hue this system spends on a part
                  that did not work. */}
              <span
                style={{
                  ...dataType,
                  color: mine.worked ? t.evidence : t.catBreakage,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: r.full,
                    background: mine.worked ? t.evidence : t.catBreakage,
                  }}
                />
                {mine.worked
                  ? mine.model_used
                    ? `You confirmed this, on ${mine.model_used}`
                    : "You confirmed this"
                  : "You said it did not work"}
              </span>
              <button
                type="button"
                onClick={openSheet}
                {...updateAction.handlers}
                style={{
                  ...updateAction.style,
                  ...controlBase,
                  padding: 0,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                update the model
              </button>
            </>
          ) : (
            // THE INVITATION, AND IT IS SECONDARY FROM BG-P21. It was a filled
            // `--action` button carrying the primary slot, which made it the
            // page's second primary beside "Rebuild this" — two solid fills in
            // one view, asking the reader twice which thing matters most. The
            // theme allows one. Rebuilding is the act this whole record exists
            // to invite, so it keeps the fill and this takes the secondary
            // treatment: still a button, still the only control in its strip,
            // and still the one thing a reader who has run the build is being
            // asked for.
            <button
              type="button"
              onClick={openSheet}
              {...inviteAction.handlers}
              style={{ ...inviteAction.style, ...controlBase, fontWeight: 600 }}
            >
              I ran this and it worked
            </button>
          )}
        </div>
      )}

      {error && !open ? (
        <span role="alert" style={{ ...dataType, color: t.catBreakage }}>
          {error}
        </span>
      ) : null}

      <Sheet open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <SheetContent
          side="bottom"
          data-visual-slot="modal-surface"
          style={{
            ...panelGlass,
            color: t.text,
            fontFamily: "inherit",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxWidth: 520,
            margin: "0 auto",
            /* A sheet is a panel, so `--r-panel` — and only on the two corners
               that are not against the edge of the screen. */
            borderRadius: `${r.panel} ${r.panel} 0 0`,
          }}
        >
          <SheetTitle style={{ ...cardTitle, margin: 0, color: t.text }}>
            {isCreator ? "You ran your own build" : "You ran this build"}
          </SheetTitle>
          <SheetDescription style={{ ...bodyType, ...measure, margin: 0, color: t.text2 }}>
            {isCreator
              ? "This moves the date on the freshness line. It does not touch the count — that stays other people."
              : "What you say here is what the next reader sees. Both answers are worth having."}
          </SheetDescription>

          <Field
            label="Which model did you run it on?"
            help={
              suggestions.length > 0
                ? `The creator used ${suggestions.join(", ")}. Say what you used.`
                : "Leave it blank rather than guess."
            }
          >
            <input
              id="reproduction-model"
              type="text"
              list="reproduction-model-suggestions"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="e.g. Claude Opus 4.5"
              autoComplete="off"
              style={inputStyle}
            />
            <datalist id="reproduction-model-suggestions">
              {suggestions.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          </Field>

          {/* A self-confirmation writes two columns on builds and no row, so
              there is nowhere for a note to go. Asking for one and dropping it
              would be worse than not asking. */}
          {isCreator ? null : (
            <Field label="Anything worth adding? (optional)">
              <textarea
                id="reproduction-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What you changed, what tripped you up, what it cost you."
                style={{ ...inputStyle, minHeight: 64, resize: "vertical", display: "block" }}
              />
            </Field>
          )}

          {error ? (
            <span role="alert" style={{ ...dataType, color: t.catBreakage }}>
              {error}
            </span>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 4,
              borderTop: `1px solid ${t.line}`,
            }}
          >
            {/* The quieter path. Quieter, not hidden: a build that does not
                work for someone is the single most useful thing this page can
                learn, and it must not cost more clicks than the happy answer.
                A creator has no such path — "it did not work" from the author
                is an edit to make, not a signal to file. */}
            {isCreator ? (
              <span />
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => void submit(false)}
                {...declineAction.handlers}
                style={{
                  ...declineAction.style,
                  ...controlBase,
                  padding: "6px 0",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  cursor: pending ? "progress" : "pointer",
                }}
              >
                it did not work
              </button>
            )}

            <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  isCreator ? void confirmStillWorks() : void submit(true)
                }
                {...submitAction.handlers}
                /* THE SHEET IS ITS OWN VIEW, so it keeps a primary of its own:
                   the one-primary rule is per view, and a modal with no filled
                   action is a modal with no answer. `--action` with
                   `--on-action` on it, at the measured pairing. */
                style={{
                  ...submitAction.style,
                  ...controlBase,
                  fontWeight: 600,
                  cursor: pending ? "progress" : "pointer",
                }}
              >
                {pending ? "Recording…" : isCreator ? "It still works" : "It worked"}
              </button>
            </span>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ReproductionAction;
