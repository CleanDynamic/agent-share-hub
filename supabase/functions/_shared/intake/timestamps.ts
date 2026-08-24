// =============================================================================
// NeoScale — timestamp resolution for intake readers (NS-P20a)
// =============================================================================
// MOVED from supabase/functions/parse-lovable/parse.ts, verbatim. NS-P20 wrote
// these rules; this module does not restate them, reinterpret them or improve
// them. parse-lovable still exports `readTimestamp` and `TimestampReading` from
// its own path, and now re-exports them from here.
//
// THE THREE RULES, which are the whole reason this is a module rather than a
// regex, and which every reader after this one inherits:
//
//   1. An ABSOLUTE date is read as-is. A stamp naming no zone is read as UTC
//      rather than as the server's local time, so the same export parses
//      identically wherever it is parsed.
//   2. A RELATIVE stamp ("2 days ago") is resolved against the export's own
//      exportedAt and marked inferred. Computed, not read: the creator is told,
//      and can disagree.
//   3. A BARE CLOCK TIME ("9:12 AM") is DROPPED, not anchored to a day the
//      export never named. build_events.occurred_at is timestamptz, and a wrong
//      date is worse than no date. Ordering survives either way.
//
// Rule 3 is the one that looks like a bug and is not. Do not "fix" it.
// =============================================================================

const ISO_LIKE =
  /\b(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*(Z|[+-]\d{2}:?\d{2})?)?\b/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "Aug 24, 2026, 2:31 PM" and "24 August 2026 14:31". */
const NAMED_MONTH =
  /\b(?:(\d{1,2})\s+)?([A-Za-z]{3,9})\.?\s+(?:(\d{1,2})[,\s]+)?(\d{4})\b(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?/i;

const RELATIVE = /\b(\d+)\s*(second|minute|hour|day|week|month)s?\s+ago\b/i;
const CLOCK_ONLY = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\b/i;

function toIso(date: Date): string | null {
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function withClock(
  year: number, month: number, day: number,
  hour: string | undefined, minute: string | undefined,
  second: string | undefined, meridiem: string | undefined,
): string | null {
  let h = hour ? Number(hour) : 0;
  if (meridiem) {
    const pm = /^p/i.test(meridiem);
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  return toIso(new Date(Date.UTC(year, month, day, h, minute ? Number(minute) : 0, second ? Number(second) : 0)));
}

export interface TimestampReading {
  iso: string | null;
  inferred: boolean;
  /** A clock time with no date — the one case that is dropped rather than kept. */
  clockOnly: boolean;
}

/**
 * Read whatever a display string is willing to give up.
 *
 * `anchor` is the export's own exportedAt, and is the only thing that makes a
 * relative stamp resolvable. Without it a relative stamp reads as no date.
 */
export function readTimestamp(raw: string | null, anchor: Date | null): TimestampReading {
  const none: TimestampReading = { iso: null, inferred: false, clockOnly: false };
  if (!raw || raw.trim() === "") return none;
  const text = raw.trim();

  const iso = text.match(ISO_LIKE);
  if (iso) {
    const [, date, clock, zone] = iso;
    // A stamp naming no zone is read as UTC rather than as the server's local
    // time, so the same export parses identically wherever it is parsed.
    const composed = clock ? `${date}T${clock}${zone ?? "Z"}` : `${date}T00:00:00Z`;
    const parsed = toIso(new Date(composed));
    if (parsed) return { iso: parsed, inferred: false, clockOnly: false };
  }

  const named = text.match(NAMED_MONTH);
  if (named) {
    const [, dayBefore, monthWord, dayAfter, year, hour, minute, second, meridiem] = named;
    const month = MONTHS[monthWord.slice(0, 3).toLowerCase()];
    const day = dayBefore ?? dayAfter;
    if (month !== undefined && day) {
      const parsed = withClock(Number(year), month, Number(day), hour, minute, second, meridiem);
      if (parsed) return { iso: parsed, inferred: false, clockOnly: false };
    }
  }

  const relative = text.match(RELATIVE);
  if (relative && anchor) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const ms: Record<string, number> = {
      second: 1000, minute: 60_000, hour: 3_600_000,
      day: 86_400_000, week: 604_800_000, month: 2_592_000_000,
    };
    const parsed = toIso(new Date(anchor.getTime() - amount * (ms[unit] ?? 0)));
    // Computed, not read: the creator is told, and can disagree.
    if (parsed) return { iso: parsed, inferred: true, clockOnly: false };
  }

  return { iso: null, inferred: false, clockOnly: CLOCK_ONLY.test(text) };
}

/**
 * The export's own clock, as a Date, or null when it does not carry one or
 * carries an unparseable one. This is what a relative stamp is resolved
 * against, so a reader that has no anchor honestly reads relative stamps as no
 * date rather than anchoring them to the moment the parse happened to run.
 */
export function readAnchor(raw: string | null | undefined): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const anchor = new Date(raw);
  return Number.isFinite(anchor.getTime()) ? anchor : null;
}

/** The reason string that goes on anything rule 2 resolved. */
export const RELATIVE_TIMESTAMP_REASON =
  "occurred_at was computed from a relative timestamp ('2 days ago') against the export's own exportedAt, not read as a date.";
