# EX-P00 — Reconnaissance

**Date:** 17 September 2026
**Branch:** `ex-door` (created from `origin/main` @ `320c399`)
**Scope:** read-only. No file changed except this report.
**Manual:** *The Extractive Connector — Build Manual v3.2 (Lovable Cloud)*, 77 pages. Part 4 is pp. 359–583 of the extracted text.

## Merge result

`ex-door` was branched from `origin/main` and `git merge origin/main` reported
**`Already up to date`. Nothing conflicted.**

Note: `origin/main` moved during this session, from `f66bc80` to `320c399` — the
BG-P28→P32 work merged while the session was starting. `ex-door` is based on the
newer tip.

## Headlines

Five findings change what later steps have to do. Each is evidenced in its
numbered answer below.

1. **The SDK does not support 2026-07-28.** `@modelcontextprotocol/sdk@1.30.0`
   ships `LATEST_PROTOCOL_VERSION = '2025-11-25'` and does not contain
   `server/discover`, `resultType`, `ttlMs`, `cacheScope` or `Mcp-Method`. Part
   4.8's "very likely carrying 2026-07-28 support" is wrong. EX-P02 cannot be
   built on the SDK as the manual assumes. (Q20)
2. **`ComposeNew.tsx` is not the only page reaching `materialiseProposal`.**
   `/import` reaches it through `buildFileImport.ts`. (Q1)
3. **Secret scanning already exists.** `scanForSecrets` in
   `src/lib/build/buildfile.ts` is a full implementation, contrary to the
   expected "nothing". It *detects*, it does not *redact*. (Q9)
4. **`NeoScaleShell` no longer exists.** Deleted in BG-P17, replaced by
   `AppShell`. The code-review skill's automatic-fail #7 names a deleted
   component. (Q14)
5. **`docs/FOUNDATIONS.md` does not define the build vocabulary.** It documents
   an unrelated document-editor runtime. (Q17)

---

# Part A — The codebase

## 1. Callers and importers of `requestProposal` / `materialiseProposal`

**`requestProposal` — confirmed, `ComposeNew.tsx` is the only caller.**

| File | Line | What |
|---|---|---|
| `src/lib/build/intake.ts` | 166 | definition |
| `src/lib/build/index.ts` | 130 | re-export |
| `src/pages/ComposeNew.tsx` | 53, 312 | import, **only call site** |
| `src/test/intake.test.ts` | 119 | test import |
| `src/pages/ComposeNew.test.tsx` | 27 | mocked |

`src/pages/ComposeNew.tsx:312`:
```ts
: await requestProposal(buildId, rawText, sourceLabel);
```

**`materialiseProposal` — NOT only `ComposeNew.tsx`. There are two call sites.**

| File | Line | What |
|---|---|---|
| `src/lib/build/intake.ts` | 311 | definition |
| `src/lib/build/index.ts` | 129 | re-export |
| `src/pages/ComposeNew.tsx` | 52, **445** | import, call site 1 |
| `src/lib/build/buildFileImport.ts` | 39, **268** | import, **call site 2** |
| `src/lib/build/buildFileImport.test.ts` | 32 | mocked |
| `src/test/intake.test.ts` | 119 | test import |
| `src/pages/ComposeNew.test.tsx` | 28 | mocked |

`src/lib/build/buildFileImport.ts:268`:
```ts
const counts = await materialiseProposal(build.id, result.proposal, selections);
```

The second path reaches **two** pages:

```
buildFileImport.ts:268  materialiseProposal
  └── BuildFileIntake.tsx:278  importBuildFile(parsed, selection)
        ├── src/pages/ImportPage.tsx:577   <BuildFileIntake …>   ← /import
        └── src/pages/ComposeNew.tsx:508   <BuildFileIntake …>   ← /compose/new
```

So `/import` is a second page that writes through `materialiseProposal`. Part
4.8 of the manual states "`src/pages/ComposeNew.tsx` is the only page that calls
intake" — that is true of `requestProposal` but **not** of `materialiseProposal`.
Any later step that assumes a single entry point (EX-P10's destination picker in
particular) must account for `/import`.

Mentions in comments only, no call: `src/lib/build/repo.ts:7,140,189`,
`src/lib/build/lovable.ts:6,298`, `src/lib/build/buildfile.ts:20,252,708,816,894`,
`src/lib/build/buildfile.test.ts:627`, `supabase/functions/parse-lovable/parse.ts:13`,
`supabase/functions/parse-repo/parse.ts:19,95`.

## 2. `materialiseProposal` signature, and the envelope compared field for field

**Signature** — `src/lib/build/intake.ts:311-315`:
```ts
export async function materialiseProposal(
  buildId: string,
  proposal: TranscriptProposal,
  selections: IntakeSelections
): Promise<MaterialiseCounts>
```

`proposal` is `TranscriptProposal`, declared at `src/lib/build/intake.ts:105-110`:
```ts
export interface TranscriptProposal {
  events: ProposedEvent[];
  nodes: ProposedNode[];
  summary: ProposalSummary;
  warnings: ParseWarning[];
}
```

The edge-function envelope is `ParseResult`, at
`supabase/functions/_shared/intake/envelope.ts:105-114`:
```ts
export interface ParseResult<
  Format extends string = string,
  Source extends string = string,
  Kind extends string = string,
> {
  events: ProposedEvent<Source, Kind>[];
  nodes: ProposedNode<Source>[];
  summary: ParseSummary<Format, Source>;
  warnings: ParseWarning[];
}
```

**Field names are identical across all five shared interfaces.** Verified by
mechanical diff of the declared field names rather than by eye:

| Interface | envelope.ts | intake.ts | Field names |
|---|---|---|---|
| source ref | `SourceRef` 31-35 | `TranscriptSourceRef` 44-48 | identical |
| event | `ProposedEvent` 38-50 | `ProposedEvent` 50-60 | identical |
| node | `ProposedNode` 53-64 | `ProposedNode` 62-73 | identical |
| field | `ProposedField` 67-72 | `ProposedField` 76-81 | identical |
| summary | `ParseSummary` 86-103 | `ProposalSummary` 88-103 | identical |
| warning | `ParseWarning` 74-77 | `ParseWarning` 83-86 | identical |

**No field is present in one and absent from the other.** The differences are
all type-level, not field-level:

1. **`ProposedEvent.visibility`** — the only differing *type* on a shared field.
   `envelope.ts:44` narrows it to a literal; `intake.ts:54` widens it:
   ```ts
   envelope.ts:44    visibility: "folded";
   intake.ts:54      visibility: string;
   ```
   Direction is safe: the envelope's literal is assignable to `string`, so an
   envelope value satisfies `TranscriptProposal`. The reverse is not true.
2. **Type names differ.** `ParseResult` / `Envelope` vs `TranscriptProposal`;
   `ParseSummary` vs `ProposalSummary`; `SourceRef` vs `TranscriptSourceRef`.
3. **Generics.** The envelope parameterises `Format`, `Source` and `Kind`, each
   `extends string = string` (`envelope.ts:31,38,53,67,86,105`). `intake.ts`
   hardcodes `string` in all three positions. With defaults applied the two are
   structurally the same — `intake.ts:39-41` says this is deliberate:
   > kept deliberately structural (`string` for the open vocabularies) so a
   > parser that learns a new detected_format or warning code does not fail to
   > typecheck here.
4. **`ParseOptions`** (`envelope.ts:116-120`) has no counterpart in `intake.ts`.
   It is the parser's *input* type, not part of the returned envelope, so it is
   not a field difference.

**Conclusion: the envelope can be stored on `import_sessions.proposal` as jsonb
and handed to `materialiseProposal` unchanged.** The manual's Part 4.8 plan for
`finish_import` is sound on this point.

## 3. Is `materialiseProposal` safe against a build that already has events and nodes?

**Yes.** In my own words: it reads the build's existing events and nodes first,
numbers anything new *above* the highest ordinal already present, and skips any
item whose proposal id and local handle it already finds on a written row. Both
the events pass and the nodes pass filter against what is already there before
inserting, so the second run of the same proposal inserts nothing. The header
(title/outcome) is guarded separately and is not re-applied.

**The lines that continue the ordinal sequence** — `intake.ts:351-354`:
```ts
const highestOrdinal = (eventRows ?? []).reduce(
  (highest, row) => Math.max(highest, typeof row.ordinal === "number" ? row.ordinal : 0),
  0
);
```
and `intake.ts:382`, where that value is applied:
```ts
ordinal: highestOrdinal + offset + 1,
```

**The lines that skip already-written items** — events, `intake.ts:375-377`:
```ts
const pendingEvents = proposal.events.filter(
  (event) => keptEvents.has(event.ordinal) && !eventIdByTurn.has(event.source_ref.index)
);
```
nodes, `intake.ts:425-427`:
```ts
const pendingNodes = proposal.nodes.filter(
  (node) => keptNodes.has(node.local_id) && !writtenLocalIds.has(node.local_id)
);
```

The two skip-sets are built at `intake.ts:356-369`, both keyed on the proposal
id so only *this* proposal's rows count:
```ts
for (const row of eventRows ?? []) {
  const ref = readSourceRef(row.payload);
  if (ref?.session_id === sessionId) eventIdByTurn.set(ref.index, row.id);
}
```

**Calling it twice with the same proposal on the same build: the second call
writes nothing.** Explicitly:

- **Events** — every event of this proposal is in `eventIdByTurn` after run 1, so
  `pendingEvents` is empty and the `if (pendingEvents.length > 0)` guard at
  `intake.ts:379` means the insert never executes.
- **Nodes** — every `local_id` is in `writtenLocalIds`, so `pendingNodes` is
  empty and the guard at `intake.ts:429` means the insert never executes.
- **Header** — `alreadyMaterialised` is `true` (`intake.ts:371`), so the
  `if (!alreadyMaterialised)` guard at `intake.ts:464` skips both patches;
  `titleApplied`/`outcomeApplied` are `false`, so `updateBuild` at
  `intake.ts:472-474` is never reached. `intake.ts:456-458` states the reason:
  > Skipped entirely on a resubmission — the header was settled the first time
  > and may have been edited by hand since, which a re-apply would silently
  > overwrite.
- **Return value** — `{ events: 0, nodes: 0, titleApplied: false,
  outcomeApplied: false, alreadyMaterialised: true }`.

Two caveats worth carrying into EX-P10/EX-P13:

- **The guarantee is per item, not all-or-nothing** (`intake.ts:301-302`), which
  is what makes a half-failed run resumable — but it also means a partially
  written proposal reports `alreadyMaterialised: true` and will therefore *not*
  apply the header on the completing run.
- **The idempotency reads are capped** at 2000 rows each
  (`intake.ts:125-126`, applied at `:333` and `:342`). `intake.ts:118-123`
  explains that an uncapped read could be silently truncated by PostgREST and
  break the guarantee "on exactly the large build where it matters most". A
  build over 2000 events or 2000 nodes is outside the guarantee.

This is confirmed by existing tests: `src/test/intake.test.ts:310-311` calls it
twice and asserts on both results; `:328-335` covers the resume-after-failure
path; `:480-481` covers a second full call.

## 4. The `Stage` type in `ComposeNew.tsx`

`src/pages/ComposeNew.tsx:109-131`:
```ts
type Stage =
  | { name: "idle" }
  | {
      name: "parsing";
      buildId: string;
      sourceLabel: string;
      characterCount: number;
      /** Overrides the turn-splitting copy, which is untrue for a repository. */
      description?: string;
    }
  /** Undecidable input. Asked once, answered once, and never recorded. */
  | { name: "asking"; rawText: string; sourceLabel: string }
  /**
   * `repoUrl` is set only on the repo path. It is what the confirm step needs
   * to apply builds.repo_url and the proposal's made_with — two header facts
   * the shared writer deliberately knows nothing about.
   */
  | {
      name: "review";
      buildId: string;
      proposal: TranscriptProposal;
      repoUrl: string | null;
    };
```

**The `review` stage carries three things:** `buildId: string`,
`proposal: TranscriptProposal`, and `repoUrl: string | null`.

`repoUrl` is the repo path's only extra: `ComposeNew.tsx:448` notes it covers
"header facts `materialiseProposal` deliberately knows nothing about". For the
connector, a `review` stage reached from an import will need the import's id
carried the same way `repoUrl` is — the type has no field for it today.

## 5. Props of `src/components/compose/IntakeProposal.tsx`

`src/components/compose/IntakeProposal.tsx:596-624`:
```ts
interface IntakeProposalProps {
  proposal: TranscriptProposal;
  selection: IntakeSelectionState;
  onChange: (next: IntakeSelectionState) => void;
  onConfirm: () => void;
  /** Take the empty draft instead and throw the proposal away. */
  onSkip: () => void;
  isWriting: boolean;
  error: string | null;
  /**
   * "From Claude, 12 parts and 30 steps" — what wrote the file and how much of
   * it there is. Absent on the transcript path, which has no such provenance to
   * state: it was parsed from a paste, and saying so would be filler.
   */
  sourceLine?: string | null;
  /**
   * Where kept items land, when it is not the tray.
   * …
   */
  arrivalNote?: string;
  /** Keys and passwords found in the file. Advisory; never blocks the import. */
  secrets?: SecretWarning[];
  /** For the import flow's own tests. Omitted on the transcript path. */
  testId?: string;
  confirmTestId?: string;
}
```

Seven required (`proposal`, `selection`, `onChange`, `onConfirm`, `onSkip`,
`isWriting`, `error`) and five optional (`sourceLine`, `arrivalNote`, `secrets`,
`testId`, `confirmTestId`).

The header comment at `:18-24` records that the optional five were added by
NS-P34 to serve the Build File path **without forking the component** — the
stated precedent for how the connector should extend it rather than build a
second review surface. Note `secrets?: SecretWarning[]` already exists: the
review screen can already display found credentials (see Q9).

## 6. `listDraftBuildsByCreator`

`src/lib/build/builds.ts:230-245`:
```ts
export async function listDraftBuildsByCreator(
  creatorId: string,
  { limit = CREATOR_LIST_LIMIT, offset = 0 }: ListBuildsOptions = {}
): Promise<Build[]> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("creator_id", creatorId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw buildLayerError("listDraftBuildsByCreator", error);
  return (data ?? []) as Build[];
}
```

- **Signature:** `(creatorId: string, opts?: { limit?: number; offset?: number })
  => Promise<Build[]>`. `ListBuildsOptions` is at `builds.ts:45-48`.
- **Filters on:** `creator_id = creatorId` **and** `status = 'draft'`. Both
  equality filters; no other predicate.
- **Orders by:** `updated_at` descending — most recently worked on first, which
  is exactly what Part 4.1 specifies for `buildgallery_list_drafts`.
- **Paging:** `limit` defaults to `CREATOR_LIST_LIMIT = 50` (`builds.ts:27`),
  `offset` defaults to 0. Both `.range()` and `.limit()` are applied.
- **Columns:** named explicitly via `BUILD_COLUMNS` (`builds.ts:24-25`), 36
  columns, no `select('*')`.

**Exported from `src/lib/build/index.ts`: yes**, at line 11.

Two notes for Part 4.4: the default of **50** is `MAX_PAGE_SIZE` in the manual's
constants table, not its `DEFAULT_PAGE_SIZE` of 20 — the connector tool must pass
its own limit rather than rely on this default. And there is no `total_count`
here; the manual requires one on every list response, so the connector needs a
separate count query.

## 7. `createBuild`

`src/lib/build/builds.ts:85-117`:
```ts
export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const title = (input.title ?? "").trim();
  if (!title) throw buildLayerError("createBuild", new Error("title is required"));

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw buildLayerError("createBuild (session)", sessionError);

  const creatorId = sessionData.session?.user?.id;
  if (!creatorId) {
    throw buildLayerError("createBuild", new Error("no signed-in user"));
  }

  const { data, error } = await supabase
    .from("builds")
    .insert({
      creator_id: creatorId,
      slug: slugifyTitle(title),
      title,
      outcome: input.outcome ?? null,
      shape: input.shape ?? "other",
      status: "draft",
      …
    })
```

**What it requires:**
1. **A non-empty `title`** after trimming — the only required field on
   `CreateBuildInput`, and the only hard validation. Throws `title is required`.
2. **A signed-in user** — it reads `supabase.auth.getSession()` itself and throws
   `no signed-in user` if there is none. `creator_id` is taken from the session,
   never from the caller.

Everything else is optional with a default:
```ts
export interface CreateBuildInput {
  title: string;
  outcome?: string | null;
  shape?: BuildShape;
  made_for?: string[];
  made_with?: string[];
  live_url?: string | null;
  repo_url?: string | null;
}
```
`shape` defaults to `"other"`, `made_for`/`made_with` to `[]`, the three nullable
fields to `null`. `slug` is derived from the title by `slugifyTitle`.

**`status` is set to `"draft"`**, hard-coded in the insert — not a parameter.

**Relevant to the connector:** this function depends on a **browser session**
(`supabase.auth.getSession()`). It cannot be called from the edge function as
written. Per rule 3 the `mcp` function may not use the service-role key, so build
creation must stay on the browser side — which matches Part 4.8's design ("The
browser then asks 'new build, or into which draft?' and proceeds as before") and
Part 4.1's rule that no tool creates a build.

## 8. Registered readers, in registration order

`supabase/functions/_shared/intake/readers/index.ts:30`:
```ts
export const INTAKE_READERS = [lovableReader, transcriptReader];
```

| # | Export | `id` | Label | Declared at |
|---|---|---|---|---|
| 1 | `lovableReader` | `"lovable"` | Lovable session export | `readers/lovable.ts:104` |
| 2 | `transcriptReader` | `"transcript"` | Pasted chat transcript | `readers/transcript.ts:92` |

**Two readers, not four.** Order is load-bearing — `readers/index.ts:16-19`:
> ORDER MATTERS. Readers with a schema come first; the transcript reader is
> last because it is the fallback — text is what is left when nothing else
> claims a file. Ties go to the earlier entry, so the fallback is never reached
> while a more specific reader has an equal claim.

Registration is explicit, never by import side effect (`:11-14`). The registry is
built fresh per call by `intakeRegistry()` at `:39-41`.

Note: `supabase/functions/parse-repo/` exists as an edge function but has **no
registered reader** in this registry. EX-P12 ("Readers, one per tool ×4")
therefore starts from two, and the repo parser is not among them.

## 9. Existing secret / API-key redaction

**Not "nothing". A complete secret scanner already exists** — though it detects
rather than redacts, which is the distinction that matters for EX-P07.

`src/lib/build/buildfile.ts`:

| Line | Item |
|---|---|
| 74 | `export const MAX_SECRET_FINDINGS = 200;` |
| 1181 | `export type SecretKind` |
| 1190 | `export interface SecretWarning` |
| 1206 | `const SECRET_PATTERNS: SecretPattern[]` |
| 1223 | `const TOKEN_PATTERN` (entropy fallback) |
| 1244 | `function looksLikeSecret` |
| 1258 | `function excerptFor` (the masker) |
| 1315 | `const MAX_SWEEP_DEPTH = 12;` |
| 1317 | `function sweep` (recursive payload walk) |
| **1368** | **`export function scanForSecrets(proposal: TranscriptProposal): SecretWarning[]`** |
| 1171 | `secrets: scanForSecrets(proposal),` — wired into the parse result |

The patterns, `buildfile.ts:1206-1213`:
```ts
const SECRET_PATTERNS: SecretPattern[] = [
  { kind: "openai_key",     pattern: /sk-[A-Za-z0-9_-]{16,}/g },
  { kind: "aws_access_key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "github_token",   pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { kind: "slack_token",    pattern: /\bxox[abp]-[A-Za-z0-9-]{10,}/g },
  { kind: "private_key",    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g },
  { kind: "env_line",       pattern: /^[A-Z0-9_]{3,}=\S+/gm },
];
```
plus a seventh kind, `high_entropy_token`, via a Shannon-entropy test on
base64ish runs of 32+ characters (`:1223-1244`).

**It deliberately does not redact.** `buildfile.ts:1358-1362`:
> This never blocks a parse and never edits a payload. A creator pasting their
> own working config is the common case, the regexes cannot tell a live key
> from an example one, and a parser that stripped what it suspected would be
> silently editing the build. NS-P34 shows these before the write, which is the
> moment a human can actually make the call.

Masking happens only in the *excerpt* (`excerptFor`, `:1258`), so a log of a
finding leaks nothing — `SecretWarning.excerpt` is documented at `:1197` as
"The match with its middle replaced". Test evidence:
`buildfile.test.ts:696-697` asserts the excerpt does not contain the key and
does contain `•`.

Exported from `src/lib/build/index.ts` at line 161 (`scanForSecrets`) and 179
(`type SecretWarning`). Consumed by the review screen at
`IntakeProposal.tsx:35, 496, 524, 620`.

**Other matches in the repo, all unrelated:** `src/lib/build/media.ts:493,506`
uses `apikey` as a Supabase request header; every
`supabase/functions/*/index.ts` lists `apikey` in
`Access-Control-Allow-Headers`; `generate-build-layers/model.ts:63-65` names
`LOVABLE_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` as env-var keys;
`src/test/parseRepo.test.ts:87` and `ImportPage.test.tsx:85` plant fake keys as
fixtures. **No redaction anywhere** — nothing in the repo rewrites content to
remove a secret.

One non-code item: `public/buildfile/BUILDGALLERY_EXTRACTOR.md:23-24` instructs
an *external* assistant to redact:
> REDACT SECRETS. Replace API keys, tokens, passwords, connection strings
> and .env values with "[REDACTED]". Then set `"secrets_redacted": true`.

That is a prompt to a third-party model, not something this repo enforces. EX-P07
is genuinely new work: it must **redact** server-side, and `scanForSecrets` gives
it the patterns but not the behaviour — and it lives in `src/`, so the edge
function cannot import it without the detection logic being moved or duplicated
into `supabase/functions/_shared/`.

## 10. Does `builds` have a `created_via` column?

**No.** Confirmed three ways:

1. Repo-wide search for `created_via` across `*.ts`, `*.tsx` and `*.sql`:
   **zero matches.**
2. `src/integrations/supabase/types.ts`, the generated `builds` Row type — 31
   columns, no `created_via`.
3. `src/lib/build/builds.ts:24-25`, `BUILD_COLUMNS` — 36 named columns, no
   `created_via`.

EX-P14 (Provenance) will need a migration to add it.

## 11. `MAX_RAW_TEXT_CHARS`

**Both are `400_000`, and they agree.**

| File | Line | Value |
|---|---|---|
| `supabase/functions/parse-transcript/parse.ts` | 30 | `export const MAX_RAW_TEXT_CHARS = 400_000;` |
| `src/lib/build/intake.ts` | 113 | `export const MAX_RAW_TEXT_CHARS = 400_000;` |

A third copy exists at `supabase/functions/parse-lovable/parse.ts:39`, also
`400_000`. Enforced at `parse-transcript/index.ts:107` (413 response),
`parse-lovable/index.ts:103`, and client-side at `ComposeNew.tsx:279`.

`intake.ts:112` documents the contract:
```ts
/** Rejected over this by the function, with a 413 that says to split the paste. */
```

This matches Part 4.3's `MAX_TOTAL_CHARS = 400,000` exactly. The constant is
duplicated in three places rather than shared, so the connector's fourth copy in
`supabase/functions/mcp/constants.ts` follows existing practice — but nothing
keeps the four in sync.

## 12. How `parse-transcript/index.ts` builds its client and verifies the caller

`supabase/functions/parse-transcript/index.ts`, 149 lines. Four steps.

**(a) Bearer token required — lines 63-67:**
```ts
const authHeader = req.headers.get("Authorization");
if (!authHeader || !/^Bearer\s+\S/i.test(authHeader)) {
  return fail("Authentication required: send the signed-in user's access token as a Bearer token.", 401);
}
const token = authHeader.replace(/^Bearer\s+/i, "");
```

**(b) Client built on the ANON key with the caller's header forwarded — lines
69-77.** The comment is explicit:
```ts
// The caller's token, not the service role: reads run under the caller's RLS.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
```
**No service-role key.** `SUPABASE_SERVICE_ROLE_KEY` does not appear in this
function. This is the pattern the `mcp` function must copy under rule 3.

**(c) Token verified against the auth server — lines 79-83:**
```ts
const { data: userData, error: userError } = await supabase.auth.getUser(token);
const user = userData?.user;
if (userError || !user) {
  return fail("Authentication failed: that access token is not valid.", 401);
}
```

**(d) Ownership checked before any work — lines 123-137:**
```ts
// Ownership, before any work. A build the caller cannot see and a build the
// caller does not own answer identically, so this cannot be used to probe
// for build ids.
const { data: build, error: buildError } = await supabase
  .from("builds")
  .select("id, creator_id")
  .eq("id", build_id)
  .maybeSingle();

if (buildError) {
  return fail(`Could not read that build: ${buildError.message}`, 500);
}
if (!build || build.creator_id !== user.id) {
  return fail("That build does not exist or is not yours to draft against.", 403);
}
```

Input validation sits between (c) and (d): JSON body (`:86-93`), `raw_text` is a
non-empty string (`:101-105`), size ≤ `MAX_RAW_TEXT_CHARS` → 413 (`:107-113`),
`build_id` matches a UUID regex (`:115-117`, regex at `:39`), `source_hint`
trimmed to 120 chars (`:118-121`, cap at `:40`).

The function writes nothing — `:144`:
```ts
// A proposal. Nothing above wrote, and nothing below writes.
```

**One thing to fix when copying this:** `:133` returns `buildError.message`, a
raw database message, straight to the caller. Part 4.5 forbids that outright
("never expose an internal error, stack trace or database message to the
caller"). The `mcp` function must not copy that line.

## 13. How an existing migration creates a private bucket and its policies

`supabase/migrations/20260319131843_3f938006-56fa-4350-b3f0-5514addc0b3e.sql`,
34 lines, creating two private buckets. `dm-images`, lines 3 and 7-19:

```sql
-- Create storage buckets for DM media
INSERT INTO storage.buckets (id, name, public) VALUES ('dm-images', 'dm-images', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('dm-voice', 'dm-voice', false);

-- RLS policies for dm-images bucket
CREATE POLICY "Users can upload DM images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dm-images' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));

CREATE POLICY "Users can view DM images in their threads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dm-images' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));
```

The pattern, which EX-P05's imports bucket should follow:

1. **Private** — `public` is `false` in the `storage.buckets` insert.
2. **Policies on `storage.objects`**, not on the bucket, each scoped by
   `bucket_id = '<name>'`.
3. **`TO authenticated`** — anonymous callers never match.
4. **First path segment is the ownership key.**
   `(storage.foldername(name))[1]` is compared against ids the caller may reach,
   so the object path itself carries the authorisation. For EX-P05 that segment
   should be the `import_id`.
5. **Separate `INSERT` (`WITH CHECK`) and `SELECT` (`USING`) policies.** Note
   there is **no `UPDATE` and no `DELETE` policy** — which suits Part 4.2's
   `destructiveHint: false` commitment.

> **Do not copy the `auth.uid()` form.** Lines 11, 18, 26 and 33 use **bare
> `auth.uid()`**. That is automatic-fail #1 in the neoscale-code-review skill
> ("325 existing policies have this defect; do not add a 326th") and violates
> rule 2 of this step. The imports-bucket migration must write
> `(select auth.uid())` in all four positions. This migration is the structural
> precedent only, not the RLS precedent.

## 14. `React.lazy` routes, and `/compose/*` relative to the shell

**Lazy routes in `src/App.tsx`:**

| Line | Component |
|---|---|
| 67 | `BuildPage` |
| 71 | `Gallery` |
| 73 | `Compose` |
| 76 | `ComposeNew` |
| 80 | `RebuildRoute` |
| 83 | `ImportPage` |
| 87 | `ConvertPrompt` |
| 99 | `Kit` — dev only (`import.meta.env.DEV`) |
| 117 | `WideDemo` — dev only |

Seven production lazy routes plus two dev-only ones. Everything else in `App.tsx`
is statically imported.

**`/compose/new` and `/compose/:buildId` render OUTSIDE the shell.**

`src/App.tsx:293-294`:
```tsx
<Route path="/compose/new" element={<Suspense fallback={…}><ComposeNew /></Suspense>} />
<Route path="/compose/:buildId" element={<Suspense fallback={…}><Compose /></Suspense>} />
```

The framed block is `<Route element={<Layout />}>` opening at `:150` and
**closing at `:272`**. Both compose routes are at 293-294, after that close, so
neither is a child of `Layout`. `App.tsx:273-284` says so deliberately:
> **THEY STAY OUT HERE, ON PURPOSE.** Unlike the three routes BG-P15 moved in,
> these are not reading surfaces: an authoring workspace drops navigation the
> way Figma and Docs do, because a tray, a tree and an inspector cannot share a
> viewport with two rails and a mobile bottom bar…

Four authoring routes sit outside: `/compose/new`, `/compose/:buildId`,
`/rebuild/:slug` (`:295`), `/convert/:contentItemId` (`:296`). They share a
`WorkspaceBar` instead of the shell.

**Correction to the code-review skill: `NeoScaleShell` no longer exists.**
`src/components/AppShell.tsx:36-39`:
> It replaced NeoScaleShell as the layout frame, keeping that shell's nav
> … single router `<Outlet />`. **NeoScaleShell was deleted in BG-P17**…

`Layout` (`src/components/Layout.tsx:16-30`) renders `<AppShell />`, not
`NeoScaleShell`. The name survives only in comments, CSS class names
(`.ns-*`), and test files. Automatic-fail #7 of the neoscale-code-review skill
("A new surface rendered inside `NeoScaleShell`") should be read as "inside
`AppShell`/`Layout`" — the intent (`/compose/:buildId` renders outside the frame)
still holds and is still true.

## 15. How the e2e suite runs, and coverage of `supabase/functions/`

**`playwright.config.ts`, 81 lines:**

- **`testDir`** — `"./e2e"` (`:31`).
- **`BASE_URL`** — `:27-28`:
  ```ts
  const PORT = Number(process.env.E2E_PORT ?? 5173);
  const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
  ```
  The env var is **`E2E_BASE_URL`**, not `BASE_URL`; it falls back to
  `E2E_PORT`, default 5173. Used as `use.baseURL` at `:43`.
- **Projects** (`:53-71`) — three:
  1. **`setup`** — `testMatch: /.*\.setup\.ts/`. **Contributes nothing**: the
     header comment at `:18-20` states "there is no such file, so it contributes
     nothing".
  2. **`desktop`** — Desktop Chrome at 1440×900, `dependencies: ["setup"]`,
     ignores `*.setup.ts`. Runs everything under `e2e/`.
  3. **`mobile`** — Pixel 7 (412×915, under the 768px breakpoint),
     `testMatch: /e2e\/tier1\/.*\.spec\.ts/` — **tier 1 only**.
- **Web server** (`:73-80`) — `npx vite --port ${PORT} --strictPort`,
  `reuseExistingServer` unless CI, 180s startup budget.
- **Timeouts** are deliberately generous (`:39-40`, `:49-50`); `:14-16` explains
  the measured ~2676 ms load.
- No `test:e2e` script in `package.json`; it is run as `playwright test`. The
  `audit`/`audit:*` scripts (`package.json:14-18`) use a **separate**
  `playwright.audit.config.ts`.

**Is there a test runner for `supabase/functions/`? No.**

- `vitest.config.ts` — `include: ["src/**/*.{test,spec}.{ts,tsx}"]`. Only `src/`.
- `playwright.config.ts` — `testDir: "./e2e"`.
- No `*.test.ts` file anywhere under `supabase/functions/`, no `deno.json`, no
  `deno test` script.

Edge-function *logic* is nonetheless covered, by vitest tests in `src/` that
reach across the boundary by relative path:
`src/test/intake.test.ts:408`, `src/test/parseRepo.test.ts:25,26,436`,
`src/test/layers.test.ts:79,80`, `src/lib/build/repo.test.ts:31`,
`src/lib/build/lovable.test.ts:207,210,255`.

So the connector's pure logic (chunk assembly, redaction, error strings) can be
tested today by placing a test in `src/` that imports from
`supabase/functions/mcp/`. The HTTP surface — headers, auth, status codes —
has **no runner at all**, which is what EX-P18 has to solve.

## 16. Sentry or error monitoring

**Nothing is installed.** No `@sentry/*`, Bugsnag, Rollbar, Datadog or LogRocket
in `package.json`, `src/`, `index.html`, `netlify.toml` or `supabase/`. (A
case-insensitive sweep for `rollbar` matches only CSS `scrollbar` properties.)

The only error handling of any kind is a local React error boundary,
`src/components/ErrorBoundary.tsx`, 34 lines, mounted once in `src/App.tsx:121`
(closing at `:319`). It is **not** instrumentation — it sets `hasError` and
renders a reload button:
```ts
static getDerivedStateFromError(): State {
  return { hasError: true };
}
```
There is no `componentDidCatch`, no logging, no network call. A caught error is
displayed and then lost.

Consequence for EX-P16 (Observability): there is no existing sink to send to, and
the `neoscale-error-monitoring` skill describes a Sentry setup that does not
exist yet. Its privacy rule — never send user-authored prompt content — is the
constraint to carry, and it is sharper here: rule 4 of this step plus Part 4.5
("never include any part of the conversation's content in an error") mean
conversation text must never reach a monitoring service either.

## 17. Vocabulary in the two documents

### `docs/FOUNDATIONS.md` — defines **none** of the nine terms

This is the significant finding. The file (220 lines) documents an unrelated
system: the **document-editor runtime** — one Zustand store, a persistence
worker, an event bus and a selection model (`:1-5`). Its vocabulary is
`Stage` / `Block` / `Connection` / `Selection` (`:37-38`), keyed off
`content_items.document_version` (`:128-129`) — the **legacy content path**, not
the build path.

Note `Stage` here is a document-editor entity, unrelated to the `Stage` type in
`ComposeNew.tsx` (Q4). Two different things share a name.

It defines none of: build, node, event, phase, gap, shape, proposal, tray,
completeness. **Any later step citing FOUNDATIONS.md for build vocabulary is
citing the wrong file.**

### `public/buildfile/BUILDGALLERY_EXTRACTOR.md` — defines six of the nine

116 lines. It is a prompt addressed to a third-party assistant, not internal
documentation.

| Term | Defined? | Meaning, one line | Where |
|---|---|---|---|
| **build** | yes | The thing the person made, with title, outcome, shape, made_for, made_with, cost and time_to_first_result. | `:41-51` |
| **node** | yes | A piece of the build's *anatomy* — what it is made of — as a tree up to 3 levels deep, addressed by `path` ("1", "1.2"). | `:52-54`, `:62-65` |
| **event** | yes | A piece of the build's *story* — what happened, in order, with an `ordinal` and a `kind`. | `:55-58`, `:63-64` |
| **phase** | partly | A named run of consecutive events; carried as `phase_title` on the first event of each. | `:58`, `:108-109` |
| **gap** | yes | A narrative node type: a problem left unsolved — `problem` required, `what_i_tried` and `acceptance_criteria` optional. | `:96-97` |
| **shape** | yes | The build's kind: `app \| agent \| workflow \| prompt \| dataset \| study \| media \| technique \| other`. | `:44` |
| **proposal** | **no** | — | — |
| **tray** | **no** | — | — |
| **completeness** | **no** | — | — |

The distinction it draws at `:62-65` is the core of the model:
> `nodes` is the anatomy — what the thing is MADE OF, as a tree (max 3
> levels; `path` is "1", "1.2", "1.2.1"). `events` is the story — what
> HAPPENED, in order.

It also defines the **event kinds** (`:106-109`): `prompt`, `milestone`,
`breakage`, `deploy`, `note`; and a full node-type registry in six categories
(`:67-97`): Instruction, Configuration, Data, Artefact, Evidence, Narrative.

### Where the missing three are actually defined

| Term | Meaning | Authoritative location |
|---|---|---|
| **proposal** | What a parser returns and a creator accepts, edits or discards — events, nodes, a suggested title and outcome. Written by nothing until accepted. | `src/lib/build/intake.ts:3-7`; shape at `envelope.ts:105-114` |
| **tray** | Where materialised nodes land: `position NULL`, unplaced, not part of the public record. | `intake.ts:20-22`, `:442`; `gaps.ts:89` |
| **completeness** | Shape-relative score of whether enough of the record is written down to follow at all. | `signals.ts:9`, `:11-21` |

`intake.ts:20-22` on the tray:
> Everything materialised lands in the tray (position NULL). Nothing is
> auto-placed: arranging material that already exists is a far easier first
> act than filling a blank form, and it is the creator's act, not the parser's.

`signals.ts:11-16` on completeness:
> COMPLETENESS IS SHAPE-RELATIVE. A prompt that lands its outcome, the prompt
> itself and one result is a finished record. An app with those three and
> nothing else is missing the link, the cost and the prerequisites.

**Recommendation:** EX-P01 ("The contract documents") should write the missing
definitions somewhere canonical. There is currently no single file defining the
nine terms, and `docs/FOUNDATIONS.md` is actively misleading as a candidate.

## 18. Edge functions, `verify_jwt`, and Lovable-managed files

**23 functions on disk** (`supabase/functions/`, excluding `_shared`).
`supabase/config.toml` is 57 lines and carries **15** entries. The other **8 have
no entry and therefore default to `verify_jwt = true`.**

| Function | `verify_jwt` | Source |
|---|---|---|
| `check-compatibility-status` | `false` | config.toml:6-7 |
| `create-checkout-session` | **true** | no entry — default |
| `create-donation-session` | **true** | no entry — default |
| `create-project-package-session` | **true** | no entry — default |
| `create-pwyw-checkout-session` | `false` | config.toml:12-13 |
| `create-split-checkout-session` | `false` | config.toml:9-10 |
| `create-subscription-session` | **true** | no entry — default |
| `generate-ai-pdf` | `false` | config.toml:33-34 |
| `generate-build-layers` | `true` | config.toml:36-40 |
| `import-github-readme` | `false` | config.toml:18-19 |
| `notify-version-update` | `false` | config.toml:3-4 |
| `parse-lovable` | `true` | config.toml:48-52 |
| `parse-repo` | `true` | config.toml:42-46 |
| `parse-transcript` | `true` | config.toml:54-57 |
| `post-json` | `false` | config.toml:27-28 |
| `public-api` | `false` | config.toml:21-22 |
| `seed-demo-data` | `false` | config.toml:15-16 |
| `seed-ecosystem` | **true** | no entry — default |
| `seed-new-posts` | `false` | config.toml:24-25 |
| `sitemap-xml` | `false` | config.toml:30-31 |
| `update-seed-data` | **true** | no entry — default |
| `update-user-password` | **true** | no entry — default |
| `verify-project-package` | **true** | no entry — default |

The four `verify_jwt = true` entries are all explicit and all commented. The
`parse-transcript` comment (`:55-57`) is the template:
> Deliberately true. NS-P13 proposes a draft against a build the caller must own,
> so the gateway must reject an unauthenticated call before the function runs.

`project_id = "zybdotagjwektucfdkri"` at `:1` — matches the brief.

**Important for EX-P02/EX-P04:** the `mcp` function is the one case that must go
the other way. An MCP endpoint has to return `401` with a `WWW-Authenticate`
header (Part 4.5 says "Handled by the 401 and the WWW-Authenticate header, not a
tool error"), and it must serve unauthenticated `server/discover` probes. With
`verify_jwt = true` the gateway rejects before the function runs and no
`WWW-Authenticate` header can be set. **`[functions.mcp] verify_jwt = false` is
required**, with authentication done inside the function on the
`parse-transcript` pattern from Q12. This is a deliberate inversion of the
parser convention and should be commented as such.

### Lovable-managed files — yes, several

| Path | Evidence | Rule |
|---|---|---|
| `src/integrations/supabase/client.ts` | Line 1: `// This file is automatically generated. Do not edit it directly.` | Never edit |
| `src/integrations/supabase/types.ts` | Generated `Database` types, 160 KB, regenerated from the live schema | Never edit by hand — it updates after a migration is applied |
| `.lovable/knowledge.md` | Lovable's own project knowledge | Never edit |
| `.lovable/plan/*.md` | Two generated plan files, incl. `turn-on-the-oauth-authorization-server-backend-settings-only-2026-09-17.md` | Never edit |
| `supabase/config.toml` | Lovable-deployed; **but** the brief explicitly assigns function settings here | Edit — this one only |

The client is constructed from `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` with `brokeredPreviewStorage()` as auth storage
(`client.ts:6-17`). The connector must import `supabase` from
`@/integrations/supabase/client` rather than construct its own.

Also note `.lovable/plan/turn-on-the-oauth-authorization-server-backend-settings-only-2026-09-17.md`
and the branch tip commit `320c399 "Enabled OAuth auth server"`, both dated
today: **OAuth authorization-server settings were turned on in Lovable this
session.** That is the backend half of EX-P04 (The lock) and should be confirmed
before EX-P04 assumes it must configure it.

---

# Part B — The protocol

## 19. MCP specification 2026-07-28

`modelcontextprotocol.io` is blocked by this environment's egress proxy
(`EGRESS_BLOCKED`, and `curl` gets a 403 on CONNECT). Both pages were read from
the specification's own source repository instead, which is the same content:

- `https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/specification/2026-07-28/changelog.mdx` (121 lines)
- `.../2026-07-28/basic/transports/streamable-http.mdx` (739 lines)
- `.../2026-07-28/server/discover.mdx` (108 lines), for the response shape

### What `server/discover` must return

Servers **MUST** implement it; clients **MAY** call it. It takes no parameters
beyond `_meta`. The result carries:

- **`supportedVersions`** — the protocol versions the server supports, e.g.
  `["2026-07-28"]`. The client picks one for subsequent requests.
- **`capabilities`** — what the server offers (`tools`, `resources`, `prompts`).
- **`_meta["io.modelcontextprotocol/serverInfo"]`** — name and version. Servers
  **SHOULD** include it. The spec warns it is self-reported and unverified:
  clients **SHOULD NOT** use it for security decisions.
- **`instructions`** — optional natural-language guidance for the model.
- **`resultType: "complete"`**, plus **`ttlMs`** and **`cacheScope`**, since
  discovery is cacheable.

In plain English: it is the replacement for "tell me who you are and what you can
do", answered in one round trip instead of a handshake. Its two real uses are
presenting server information without probing `tools/list`/`prompts/list`
separately, and acting as a backward-compatibility probe on stdio where there is
no HTTP status code to drive fallback.

### What replaced the `initialize` handshake

**Nothing replaced it with another handshake — the protocol became stateless.**
Changelog major change 2: `initialize` and `notifications/initialized` are
removed. Every request now carries, in `_meta`:

- `io.modelcontextprotocol/protocolVersion`
- `io.modelcontextprotocol/clientCapabilities`
- `io.modelcontextprotocol/clientInfo` (clients **SHOULD**)

and each *result* carries `io.modelcontextprotocol/serverInfo` (servers
**SHOULD**). A version mismatch returns `UnsupportedProtocolVersionError`.

Related, major change 1: **protocol-level sessions and the `Mcp-Session-Id`
header are gone.** A server needing cross-call state mints its own handle and
passes it as an ordinary tool argument — exactly what `import_id` is in Part 4.
The manual is right that this is "already correct".

### Headers a Streamable HTTP POST must carry

From the transports page, four requirements:

1. **`MCP-Protocol-Version`** — required on every POST (`:252-255`), e.g.
   `MCP-Protocol-Version: 2026-07-28`. It **MUST** match
   `io.modelcontextprotocol/protocolVersion` in the body's `_meta`.
2. **`Mcp-Method`** — mirrors the body's `method`. Required on **all** requests.
3. **`Mcp-Name`** — mirrors `params.name` or `params.uri`. Required for
   `tools/call`, `resources/read` and `prompts/get`. If the value is not safely
   ASCII, clients **MUST** use the Base64 sentinel encoding.
4. **`Accept`** — **MUST** list *both* `application/json` and `text/event-stream`
   (`:76-78`). The client **MUST** support either response type.

The spec's own example (`:301-306`):
```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_weather
```

**On mismatch** (`:597-603`): the server **MUST** return `400 Bad Request` with
JSON-RPC error **`-32020` `HeaderMismatch`** — "The HTTP headers do not match the
corresponding values in the request body, or required headers are
missing/malformed." The rationale (`:582-587`) is that a load balancer routing on
the header while the server executes on the body is a security problem. Note
`-32020` is a **renumbering**: it was `-32001` in the draft, moved because
`-32000`–`-32019` is now reserved for implementation-defined codes and
`-32020`–`-32099` for the specification.

Two neighbouring rules worth carrying: an unsupported version returns `400` with
`UnsupportedProtocolVersionError` (renumbered `-32004` → `-32022`) listing
supported versions; an unimplemented method returns **`404 Not Found`** with
`-32601`. Also `:58-60`: servers **MUST** validate the `Origin` header on all
incoming connections — Part 4 does not mention this.

### What `resultType` is

A **required** field on every result, added by SEP-2322. Two values:

- **`"complete"`** — an ordinary, finished result.
- **`"input_required"`** — an interim result under the Multi Round-Trip Request
  (MRTR) pattern, carrying `inputRequests`. The client retries the original
  request with `inputResponses`.

MRTR replaces all server-initiated requests — `roots/list`,
`sampling/createMessage` and `elicitation/create`. Instead of the server calling
back to the client mid-request, it *returns* saying what it still needs.

For backward compatibility, clients **MUST** treat a result from an
earlier-protocol server that omits `resultType` as `"complete"`.

### What `ttlMs` and `cacheScope` are for

Both are **required** on results from `tools/list`, `prompts/list`,
`resources/list`, `resources/read` and `resources/templates/list`, via a new
`CacheableResult` interface (SEP-2549).

- **`ttlMs`** — a freshness hint in milliseconds. It lets a client cache the
  response and stop re-polling. `server/discover`'s example uses `3600000`
  (one hour).
- **`cacheScope`** — `"public"` or `"private"`. It controls whether a *shared
  intermediary* (a proxy, a gateway) may cache the response, as distinct from
  the client caching it for itself.

They complement rather than replace `listChanged` notifications. A related minor
change: servers **SHOULD** return tools from `tools/list` in a deterministic
order, to make client-side caching and LLM prompt-cache hits work.

### Other changes bearing on this build

- **`subscriptions/listen`** replaces the HTTP GET endpoint and
  `resources/subscribe`/`unsubscribe` — one long-lived POST-response stream.
  The connector needs none of it.
- **`ping`, `logging/setLevel` and `notifications/roots/list_changed` are
  removed.** Log level is per-request via `io.modelcontextprotocol/logLevel`;
  servers **MUST NOT** emit `notifications/message` for a request that did not
  include it.
- **Roots, Sampling and Logging are deprecated** (SEP-2577). Suggested migration
  for logging: stderr or OpenTelemetry.
- **Tasks moved out of core** into the `io.modelcontextprotocol/tasks`
  extension: `tasks/get` polling replaces the blocking `tasks/result`,
  `tasks/update` added, `tasks/list` removed.
- **SSE resumability removed** — no `Last-Event-ID`, no event IDs. A broken
  stream loses the in-flight request and the client **MUST** re-issue it with a
  new request id. This matters for `finish_import`: a dropped connection means a
  retry, which is exactly why Part 4.2's idempotency commitments are load-bearing.
- **DCR deprecated** in favour of Client ID Metadata Documents, but still
  supported for backward compatibility. Clients must also now send an
  `application_type` during DCR.
- **OpenTelemetry trace context** (`traceparent`, `tracestate`, `baggage`) is
  documented for `_meta` — relevant to EX-P16.
- **Resource-not-found** changed from `-32002` to `-32602`.

The manual's Part 4.8 comparison table is accurate on all of these.

## 20. The MCP TypeScript SDK — version and protocol support

**Version: `1.30.0`**, published **2026-07-27T17:56:01Z**. It is the current
`latest` tag on `https://registry.npmjs.org/@modelcontextprotocol/sdk/latest`.
The manual's "1.30.0 (27 July 2026)" is correct.

**The protocol versions it advertises** — read from the shipped source
(`dist/esm/types.js`, lines 2-4 of the published tarball), which is the
authoritative answer rather than the README:

```js
export const LATEST_PROTOCOL_VERSION = '2025-11-25';
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26';
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];
```

Five versions: **`2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`,
`2024-10-07`**. Identical in the CJS build (`dist/cjs/types.d.ts:3`).

> ### It does NOT support 2026-07-28.
>
> Part 4.8 says the SDK is "very likely carrying 2026-07-28 support". **It is
> not.** EX-P00 was asked to confirm this, and the answer is no.

Confirmed by absence as well as by the constant. Searching the entire shipped
`dist/esm/` tree for the 2026-07-28 wire features returns **zero files** for
every one of them:

| Feature | Files in SDK 1.30.0 |
|---|---|
| `server/discover` | 0 |
| `resultType` | 0 |
| `ttlMs` | 0 |
| `cacheScope` | 0 |
| `Mcp-Method` / `mcp-method` | 0 |
| `inputRequests` | 0 |
| `subscriptions/listen` | 0 |
| `HeaderMismatch` | 0 |

One near-miss to disregard: `input_required` appears in five files, but it is the
**tasks extension's task *status*** (`dist/esm/shared/protocol.js:341,345,586,588`
— `updateTaskStatus(effectiveTaskId, 'input_required')`), not the MRTR
`resultType`. Different concept, same string.

There is also a `dist/esm/spec.types.js` carrying
`LATEST_PROTOCOL_VERSION = "DRAFT-2026-v1"`, auto-generated from the spec repo's
`schema/draft/schema.ts`. It is marked `/** @internal */`, is not part of the
package's `exports` map (`.`, `./client`, `./server`, `./validation`,
`./validation/ajv`, `./validation/cfworker`, `./experimental`,
`./experimental/tasks`, `./*`), and is not wired into negotiation. It is a
generated preview, not support.

The explanation is simply chronology: the SDK shipped **2026-07-27**, the spec
was dated **2026-07-28**. The SDK is one day older than the specification it
would need to implement.

**Backwards compatibility with 2025-11-25 and 2025-06-18: yes, both.**
`2025-11-25` is the SDK's *latest*, and `2025-06-18` is the second entry in
`SUPPORTED_PROTOCOL_VERSIONS`. Keeping compatibility with those two — which Part
4.8 asks for — is not merely possible, it is all the SDK can currently do.

### What this means for EX-P02

Part 4.8 states "EX-P02 is built around `server/discover`. One server per request
is now the only shape." That cannot be built on `@modelcontextprotocol/sdk@1.30.0`
as it stands. Three options, for a design conversation and not for me to pick:

1. **Hand-roll the 2026-07-28 wire format** in the edge function — no SDK. The
   surface is small (seven tools, `server/discover`, `tools/list`, `tools/call`)
   and Deno edge functions do not fit the SDK's Node/Express assumptions well
   anyway (see Q21). This keeps the manual's architecture.
2. **Use the SDK and target 2025-11-25**, i.e. keep `initialize`. This
   contradicts Part 4.8's central claim but is the only SDK-supported path today.
3. **Serve both** — `server/discover` hand-rolled, with an `initialize` fallback
   for clients on 2025-11-25 and 2025-06-18, which Part 4.8 asks for regardless.

Option 3 is the closest to the manual's stated intent, and options 1 and 3 both
mean the mcp-builder reference's SDK-centric guidance (Q21) does not apply.

## 21. Part 4 of the build manual vs the mcp-builder references

Read in full: `reference/mcp_best_practices.md` and `reference/node_mcp_server.md`.

### Where Part 4 conforms

Worth stating, because most of it does: the server name `buildgallery-mcp-server`
matches the Node convention `{service}-mcp-server` exactly (4.1); tool names are
snake_case with a service prefix (4.1); Zod with `.strict()` (4.3);
`outputSchema` plus `structuredContent` (4.3); `response_format` of
`"markdown" | "json"` defaulting to markdown (4.4); `total_count` / `has_more` /
`next_offset` and never counting in memory (4.4); `DEFAULT_PAGE_SIZE = 20` and
`MAX_PAGE_SIZE = 50`, inside the reference's "20-50 items is typical" (4.3);
constants in one file (4.3); and "never expose an internal error, stack trace or
database message" (4.5), which matches "Don't expose internal errors to clients".

Part 4.2's annotation discipline is *stronger* than the reference requires — it
justifies `idempotentHint: true` per tool rather than merely asserting it.

### Conflicts

**1. No response-size ceiling — a real gap.**
`node_mcp_server.md` requires a `CHARACTER_LIMIT` constant (its example uses
`25000`) with truncation and a `truncation_message`, and its quality checklist
has "Large responses check CHARACTER_LIMIT constant and truncate with clear
messages". **Part 4.3's constants table has no such constant.** Every constant it
lists governs *input* size (`CHUNK_SIZE_CHARS`, `MAX_CHUNK_CHARS`,
`MAX_TOTAL_CHARS`) or pagination. `buildgallery_list_drafts`,
`buildgallery_list_imports` and `buildgallery_get_import_status` can therefore
return unbounded responses. A creator with 300 drafts at `MAX_PAGE_SIZE = 50`
would get a large markdown blob with no truncation path.
**Resolution needed:** add a `CHARACTER_LIMIT` to `constants.ts`. This is an
addition to Part 4, which Part 4's preamble says must go to a Claude chat first.

**2. The 1,500-character description cap fights the reference's description
requirements.**
Part 4.7 targets "under 1,500 characters each" because clients truncate.
`node_mcp_server.md` requires descriptions that state args, the **complete return
schema**, worked examples and error handling — its single worked example
description runs well past 1,500 characters, and its checklist demands
"Descriptions include return value examples and complete schema documentation".
Both cannot hold for a tool returning a structured list.
**Resolution:** Part 4.3 already mandates `outputSchema`, which carries the
return shape machine-readably. The description can then cite the schema instead
of restating it, and stay under 1,500. Worth writing down in EX-P01 so EX-P18
does not test for the reference's version.

**3. The whole Node project structure is inapplicable.**
`node_mcp_server.md` prescribes a `{service}-mcp-server/` package with
`package.json`, `tsconfig.json`, `src/index.ts`, `dist/`, `express`, `axios`, and
"Always ensure `npm run build` completes successfully before considering the
implementation complete". Its checklist requires "dist/index.js created and
executable" and "Server runs: `node dist/index.js --help`". Part 4.3 puts the
connector at `supabase/functions/mcp/constants.ts` — a **Deno** edge function
with no package.json, no build step and no dist. None of those checklist items
can be satisfied, and the `express`-based `runHTTP()` pattern does not apply.
**Resolution:** treat the Node guide's *design* guidance as binding and its
*project/build* guidance as out of scope. EX-P18's quality gate must be written
against Deno, not `npm run build`.

**4. Part 4.8's SDK claim is factually wrong — the largest conflict.**
Part 4.8 says the SDK is "very likely carrying 2026-07-28 support" and builds
EX-P02 around `server/discover`. Q20 shows 1.30.0 tops out at `2025-11-25` and
contains no `server/discover`. Compounding it, `node_mcp_server.md` says
"**DO NOT use** old deprecated APIs such as `server.tool()`,
`server.setRequestHandler(...)`" and mandates `server.registerTool()` — i.e. it
mandates an SDK that cannot speak the protocol version the manual targets.
**Resolution:** see the three options at the end of Q20. This needs a decision
before EX-P02 starts.

**5. No `Origin` validation.**
`mcp_best_practices.md` has a DNS-rebinding section requiring `Origin` validation
on all incoming connections, and the 2026-07-28 transports spec makes it a
**MUST** for all servers, not just local ones. **Part 4 never mentions `Origin`.**
Its CORS discussion (4.8) is only about getting `Mcp-Method` and `Mcp-Name` into
`Access-Control-Allow-Headers`. Every existing function in this repo uses
`"Access-Control-Allow-Origin": "*"` (e.g. `parse-transcript/index.ts:34`), which
is precisely what the rule exists to prevent.
**Resolution:** EX-P02 should validate `Origin` against an allowlist
(`https://agent-share-hub.lovable.app` plus whatever client origins are
intended) rather than copying the `*` pattern.

**6. `response_format` is specified for only two of the four reading tools.**
`mcp_best_practices.md`: "**All** tools that return data should support multiple
formats." Part 4.4 gives `response_format` to "both list tools" only.
`buildgallery_whoami` and `buildgallery_get_import_status` also return data.
Minor, but it is a divergence EX-P18 might otherwise flag.

**7. Error transport is unspecified.**
`mcp_best_practices.md` says "Report tool errors within result objects (not
protocol-level errors)" and its example returns `{ isError: true, content: [...] }`.
Part 4.5 specifies error *text* precisely but never says whether these arrive as
`isError` results or JSON-RPC errors. An underspecification rather than a
contradiction, but EX-P18 cannot test it as written.

### Deliberate divergences — not errors, but worth recording

- **Seven tools, no more.** mcp-builder says "When uncertain, prioritize
  comprehensive API coverage"; Part 4.1 says "Seven tools. There is no eighth."
  The narrowing is the point of the feature — the connector is extraction-only
  and cannot publish, edit or delete — and it is well justified. It should be
  recorded as a conscious departure so a later reviewer does not "fix" it.
- **No resources.** The Node guide has a full Resources section; Part 4 uses
  tools only. Correct here: there is no data this server should expose by URI,
  and Part 4.1 explicitly forbids a tool that reads a build's content.
- **`openWorldHint: false` everywhere** (4.2). Defensible — the server reaches
  only the caller's own account — but note the Node guide's analogous worked
  example, a read tool hitting a remote HTTP API, sets it `true`. Worth a
  sentence of justification in EX-P01; Part 4.2 already has one.
- **Evaluations instead of MCP Inspector.** mcp-builder Phase 3 says test with
  `npx @modelcontextprotocol/inspector`; the manual uses EX-P18 evaluations.
  Both can hold — but see Q15: there is no runner for edge-function HTTP
  surfaces today.

---

## Blocking questions for the next step

1. **Which of the three SDK options in Q20** should EX-P02 take? The manual's
   plan assumes an SDK capability that does not exist.
2. **`CHARACTER_LIMIT` is missing from Part 4.3.** Part 4 says changes to it go
   to a Claude chat first — this is one.
3. **`Origin` validation is absent from Part 4** and is a spec MUST.
4. **EX-P10 must account for `/import`,** not just `/compose/new` (Q1).
5. **EX-P07's redaction cannot import `scanForSecrets`** from `src/` (Q9). Moving
   or duplicating it into `supabase/functions/_shared/` is a design decision.
