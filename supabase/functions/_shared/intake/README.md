# `_shared/intake` — the intake reader substrate

Everything two intake readers had in common, extracted (NS-P20a) so that adding
a third is **writing a reader rather than rebuilding a pipeline**.

Nothing here is user-facing. It writes nothing, reads nothing, performs no I/O
and touches no Deno API — a string in, a proposal out — which is what lets every
piece of it be exercised without a running Supabase.

```
envelope.ts      the canonical proposal envelope. Types only
timestamps.ts    absolute / relative-against-exportedAt / bare-clock-dropped
inferred.ts      the inferred + inferred_reason pair
local-id.ts      local_id minting and post-sort renumbering
source-ref.ts    source_ref shaping
ordinals.ts      event ordinal assignment
reader.ts        the reader interface, outcomes, version and provenance tags
registry.ts      readers -> detect results -> a routed file
index.ts         the barrel
readers/         the registered readers: one adapter per parser function
```

---

## The reader interface

Verbatim from `reader.ts`:

```ts
interface IntakeReader<Format, Source, Kind> extends ReaderTag {
  id: string;
  label: string;
  version: string;
  provenance: SchemaProvenance[];

  detect(file: IntakeFile): Detection;
  parse(file: IntakeFile, options: ParseOptions): ReaderResult<Format, Source, Kind>;
}

interface IntakeFile  { text: string; name?: string | null }
interface Detection   { confidence: number; reason: string }
interface ParseOptions { session_id: string; source_hint?: string | null }

interface ReaderResult<Format, Source, Kind> {
  reader: ReaderTag;
  outcome: ReadOutcome;                       // "session" | "source_only" | "unrecognised"
  envelope: Envelope<Format, Source, Kind>;   // unchanged, field for field
}
```

`confidence` is bounded to `0..1`; build one with `detection(score, reason)`,
which clamps, so a reader cannot outbid the others by returning 99. `reason` is
one short line that ends up in front of a creator when routing surprises them,
so it says what was **seen** — `"4 messages carrying contentText and
timestampText"` — rather than restating the verdict.

`IntakeFile.name` is metadata. **Detection reads the content, never the
filename.** A creator drops what they have; working out what it is, is the
system's job. A `.json` extension proves nothing, and a file saved from a
browser often loses its extension entirely.

### The wrong-file signature

`ReadOutcome` has three values and the distinction between the last two is the
reason this interface exists rather than a boolean:

| outcome | means |
| --- | --- |
| `session` | A session was read. The envelope carries it. |
| `source_only` | **This is a source-code download, not a session export.** |
| `unrecognised` | Nothing in this file looks like anything this reader reads. |

`source_only` is not a decoration. Lovable has no native session export: its own
ZIP download and GitHub sync carry source code and none of the session, so the
creator who takes the obvious path lands there and needs to be told what
happened and what to do instead. Collapsing that into "unrecognised" turns a
five-word explanation into a shrug. `outcome` is returned **beside** the
envelope, not buried in a warning code, so the distinction survives to the
caller.

### Version and provenance

Every reader carries a `READER_VERSION` and a `SCHEMA_PROVENANCE`, and both ride
on every `ReaderResult`. None of the shapes these readers consume is a format
its vendor controls or documents, so *"we read the serialising source on this
date"* is the strongest honest claim available — and it is the claim that lets a
reader broken by a third-party tool changing its serialiser **identify itself**
instead of presenting as a generic import failure.

```ts
interface SchemaProvenance {
  format: string;             // a detected_format value, or a family name
  source: string;             // the serialising source, in words
  identifier: string | null;  // repo, commit or file — null when none was recorded
  read_on: string;            // YYYY-MM-DD
}
```

Never invent an `identifier`. `null` is the honest answer where nothing was
recorded, and the transcript reader's `null` is permanent: a pasted transcript
has no serialiser to pin.

Bump `version` when what a reader **does** changes — a new shape read, a rule
changed, a field filled differently. Not for a comment or a refactor whose
output is identical: the number exists to tell a stale proposal from a current
one.

---

## Registering a reader

Two steps, and the second one is a line.

1. Write `readers/<yours>.ts` exporting an `IntakeReader`, a `READER_VERSION`
   and a `SCHEMA_PROVENANCE`.
2. Import it in `readers/index.ts` and add it to `INTAKE_READERS`.

```ts
export const INTAKE_READERS = [lovableReader, yourReader, transcriptReader];
```

**Order matters.** Readers with a schema come first; `transcriptReader` is last
because it is the fallback — text is what is left when nothing else claims a
file. The sort is stable, so equal bids go to the earlier entry and the fallback
is never reached while a more specific reader has an equal claim.

There is no side-effecting self-registration by import, deliberately: a registry
you assemble by importing modules for their side effects has contents that
depend on import order, and this one breaks ties by position.

### Routing

```ts
const registry = intakeRegistry();
registry.detect(file);           // every reader's bid, best first, refusals included
registry.route(file);            // the winner, or null when nobody claimed it
registry.read(file, options);    // route and parse in one call
```

Every reader answers every file. A reader saying "not mine" says it with a
confidence and a reason rather than by throwing, which is what lets a caller
show a creator **why** their file went where it went. `route()` returning `null`
is an answer, not an error.

A tie is how this substrate says *undecidable* — the two current readers
deliberately bid equally (`0.15`) on valid JSON carrying no marker either
recognises. `route()` resolves it silently by registration order; a caller that
wants to notice compares the top two bids from `detect()`. The compose route
already asks the creator in exactly that case.

---

## The helpers, and why they are helpers

### `timestamps.ts` — the three rules

Moved verbatim from NS-P20. **Do not "improve" rule 3.**

| the source carries | `occurred_at` | `inferred` |
| --- | --- | --- |
| an absolute date (`2026-08-18T09:12:04Z`, `Aug 18, 2026, 9:12 AM`) | read as-is, UTC when no zone is named | `false` |
| a relative stamp (`2 days ago`) | resolved against the export's own `exportedAt` | **`true`** |
| a relative stamp and **no** `exportedAt` | `null` | `false` |
| a bare clock time (`9:12 AM`) | **`null` — dropped** | `false` |

`build_events.occurred_at` is `timestamptz`, so a value without a date is worse
than no value: it would anchor the event to a day the export never named. A
wrong date is worse than no date, and the ordering survives either way. Rule 3
looks like a bug and is not.

`readAnchor(raw)` turns an export's own `exportedAt` into the `Date` a relative
stamp resolves against, or `null`. A reader with no anchor honestly reads
relative stamps as no date rather than anchoring them to whenever the parse ran.

### `inferred.ts` — rule 2 of the two rules

> Anything inferred rather than read carries `inferred: true` and a short reason
> string. Anything read verbatim carries `inferred: false` and
> `inferred_reason: null`.

```ts
...verbatim()                 // read out of the source as it stands
...guessed("why this is a guess, in a sentence a creator can disagree with")
...mark(computed ? WHY : null)  // one condition decides it
```

**Spread these LAST** into a proposed item, where the two keys have always sat.
That is not cosmetic: the envelope is serialised to JSON and compared field by
field against the other reader's by a standing test, and key order is part of
what a diff sees.

### `source-ref.ts` — rule 1 of the two rules

> Every proposed item carries `source_ref` recording where it came from:
> `{ source, session_id, index }`, where `index` is the turn or message it was
> read out of, counted across **both** speakers from 1.

```ts
const ref = sourceRefFor("lovable", sessionId);
ref(message.index);
```

`source` is the reader's own discriminator and the only value in the whole
envelope a client could branch on. `intake.ts` types it as `string` and does
not branch on it; `build_nodes.source_ref` holds it as-is.

### `local-id.ts` and `ordinals.ts`

`local_id` is a handle within **one response** and nothing more — the client
maps it to a uuid on materialisation. `createLocalIdMinter()` mints
`node-1, node-2, …`; `renumberLocalIds(nodes)` renumbers in place after a sort,
which costs nothing precisely because the handle means nothing outside the
response.

`ordinal` is the event's position, `1..N`, and a **unique selection key** within
one proposal: the intake surface identifies the event a creator kept or dropped
by it. So it runs across every kind — a proposal holding prompt, deploy and
breakage events numbers them 1, 2, 3, not 1, 1, 1.

`source_ref.index` is a **different number** and the two are routinely unequal.
NS-P13's twentieth event has `ordinal` 20 and `index` 39.

---

## The envelope

`envelope.ts` holds the declarations NS-P13 wrote, moved here so there is one
source of truth rather than two agreeing copies. Both parsers still export every
name from their own paths, narrowed to their own literals.

Three fields are parameterised, because they are the three that are supposed to
vary per reader: `source_ref.source`, `detected_format`, and event `kind`. Every
parameter defaults to `string`, so a caller that does not care reads the
envelope with no type arguments — `src/lib/build/intake.ts` does not care, and
was not touched.

**Do not redefine these types in a reader.** Import them, narrow them, re-export
them if a path has to keep resolving. A third declaration is how a contract
becomes a suggestion.

---

## Still duplicated

Recorded rather than fixed, because NS-P20a was not allowed to edit
`parse-transcript/parse.ts`:

- **Fence handling.** `fenceMask`, `extractFences`, the language alias table and
  `excerpt` exist in both parsers. They are module-private in parse-transcript
  (`function`, not `export function`), so lifting them means editing that file.
  Whichever prompt may do so should move them here.
- **Transcript detection.** The transcript reader's `detect` runs the whole
  parser to reach `summary.detected_format`, because the split is private too.
  Correct, and twice the work it needs to be.
- **The client's routing copy.** `src/lib/build/lovable.ts` decides between the
  two functions with its own mirror of the Lovable detection. This registry
  exists to replace it; replacing it is a UI change and was out of scope here.
