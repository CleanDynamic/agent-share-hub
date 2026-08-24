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
  freshnessLabel,
  getBuildHeader,
  getReproductions,
  recordReproduction,
  type Build,
  type BuildReproduction,
} from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  hexToRgba,
  labelText,
  panelGlass,
  titleText,
} from "./tokens";

/**
 * The type size of the reproduction count.
 *
 * Exported so a test can hold the page to acceptance 2 — larger than every
 * other figure — without reading a number out of a style object by hand.
 */
export const COUNT_FONT_SIZE = 44;

/** Enough rows that a reader's own is almost always among them. See `mine`. */
const REPRODUCTION_FETCH_LIMIT = 200;

const REPRODUCTIONS_STALE_TIME = 60_000;

const controlBase: React.CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  ...bodyText,
  fontFamily: "inherit",
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.025)",
  border: `1px solid rgba(255,255,255,0.06)`,
  color: TEXT_PRIMARY,
  outline: "none",
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
      <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>{label}</span>
      {children}
      {help ? (
        <span style={{ ...bodyText, fontSize: 11, color: TEXT_MUTED }}>{help}</span>
      ) : null}
    </div>
  );
}

/** What the count says next to itself. Zero gets its own sentence. */
function countCaption(count: number): string {
  if (count <= 0) return "no one has run this yet";
  return count === 1
    ? "person ran this and it worked"
    : "people ran this and it worked";
}

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
  const freshness = freshnessLabel(build);

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
    setModel(mine?.model_used ?? "");
    setNote(mine?.note ?? "");
    setError(null);
    setOpen(true);
  }, [isLoggedIn, location.pathname, mine, navigate]);

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

  return (
    <div
      data-visual-slot="build-reproduction"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span
        style={{
          ...labelText,
          fontSize: 11,
          color: TEXT_MUTED,
          textTransform: "uppercase",
        }}
      >
        Reproduction
      </span>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span
          data-testid="reproduction-count"
          style={{
            fontSize: COUNT_FONT_SIZE,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            color: count > 0 ? TEAL : TEXT_MUTED,
          }}
        >
          {count}
        </span>
        <span style={{ ...bodyText, color: TEXT_SECONDARY }}>{countCaption(count)}</span>
      </div>

      {/* Never fabricated: no confirmation, no date. */}
      {freshness ? (
        <span style={{ ...bodyText, color: TEXT_SECONDARY }}>{freshness}</span>
      ) : (
        <span style={{ ...bodyText, color: TEXT_MUTED }}>not yet confirmed by anyone</span>
      )}

      {isCreator ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED, maxWidth: 420 }}>
          This is your build. The count is other people — a confirmation you
          could give yourself would not be worth reading.
        </p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {mine ? (
            <>
              <span
                style={{
                  ...labelText,
                  fontSize: 12,
                  color: mine.worked ? TEAL : GAP_RED,
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
                    borderRadius: 999,
                    background: mine.worked ? TEAL : GAP_RED,
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
                style={{
                  ...controlBase,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  color: TEXT_SECONDARY,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                update the model
              </button>
            </>
          ) : (
            // VISUAL SLOT — the primary button surface is supplied externally.
            // Geometry and behaviour only here.
            <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
              <button
                type="button"
                onClick={openSheet}
                style={{
                  ...controlBase,
                  color: VOID,
                  background: ORANGE,
                  border: `1px solid ${ORANGE}`,
                  fontWeight: 600,
                }}
              >
                I ran this and it worked
              </button>
            </span>
          )}
        </div>
      )}

      {error && !open ? (
        <span role="alert" style={{ ...bodyText, fontSize: 12, color: GAP_RED }}>
          {error}
        </span>
      ) : null}

      <Sheet open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <SheetContent
          side="bottom"
          data-visual-slot="modal-surface"
          style={{
            ...panelGlass,
            color: TEXT_PRIMARY,
            fontFamily: "inherit",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxWidth: 520,
            margin: "0 auto",
            borderRadius: "12px 12px 0 0",
          }}
        >
          <SheetTitle style={{ ...titleText, margin: 0 }}>You ran this build</SheetTitle>
          <SheetDescription style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
            What you say here is what the next reader sees. Both answers are
            worth having.
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

          {error ? (
            <span role="alert" style={{ ...bodyText, fontSize: 12, color: GAP_RED }}>
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
              borderTop: `1px solid ${HAIRLINE}`,
            }}
          >
            {/* The quieter path. Quieter, not hidden: a build that does not
                work for someone is the single most useful thing this page can
                learn, and it must not cost more clicks than the happy answer. */}
            <button
              type="button"
              disabled={pending}
              onClick={() => void submit(false)}
              style={{
                ...controlBase,
                padding: "6px 0",
                background: "transparent",
                border: "none",
                color: TEXT_SECONDARY,
                textDecoration: "underline",
                textUnderlineOffset: 3,
                cursor: pending ? "progress" : "pointer",
              }}
            >
              it did not work
            </button>

            <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
              <button
                type="button"
                disabled={pending}
                onClick={() => void submit(true)}
                style={{
                  ...controlBase,
                  color: VOID,
                  background: pending ? hexToRgba(ORANGE, 0.5) : ORANGE,
                  border: `1px solid ${ORANGE}`,
                  fontWeight: 600,
                  cursor: pending ? "progress" : "pointer",
                }}
              >
                {pending ? "Recording…" : "It worked"}
              </button>
            </span>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ReproductionAction;
