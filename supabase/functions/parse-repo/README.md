# parse-repo

**NS-P21.** The third intake reader. A public GitHub repository URL in, a
proposed draft out — the same envelope `parse-transcript` (NS-P13) and
`parse-lovable` (NS-P20) return, so the intake surface and
`materialiseProposal` consume it with no source-specific branch.

It **writes nothing**. It reads one row of `builds` to confirm the caller owns
the build it is proposing against, reads `ai_tools_registry` for canonical tool
names, and everything else it returns is a suggestion a creator accepts, edits
or throws away.

```
snapshot.ts   types only — what a repository looks like once read. No I/O
github.ts     the fetching: URL parsing, auth, the budget, the 200KB cap
parse.ts      pure — a snapshot in, a ParseResult out. Testable with no network
index.ts      the shell: CORS, auth, ownership, orchestration
```

---

## Read this first: a repository is a suggestion source, not an import target

Every limit below follows from that one sentence, and none of them is a
placeholder for a later, more generous version.

| Limit | Value | Where |
| --- | --- | --- |
| Files read per parse | **40**, and every GitHub request spends from it | `FetchBudget`, `github.ts` |
| Bytes per file | **200KB**, checked *before* the read | `MAX_FILE_BYTES`, `snapshot.ts` |
| Clone | **never** — there is no git operation in this function | — |
| Code nodes | **one**, for an unambiguous entrypoint | `chooseEntrypoint`, `parse.ts` |

A real repository lands at **six requests**; a repository of five thousand
files lands at **eleven**. Size does not move the count, because the whole file
listing arrives in one `/git/trees?recursive=1` request that also carries every
blob's byte size — so presence is checked without probing and the 200KB cap is
applied before a fetch rather than after one. Both numbers are asserted in
`src/test/parseRepo.test.ts`, which runs `github.ts` against a stubbed `fetch`
that counts calls.

`summary.files_fetched` and `summary.fetch_budget` carry the count into the
response, so the cap is checkable from the outside too.

---

## Copied from `import-github-readme`, deliberately not shared with it

`supabase/functions/import-github-readme/` sits on the **existing content
path**, which NS-P21's first hard constraint puts out of bounds. Its approach
was lifted into `github.ts` rather than imported from, and rather than
refactored into a shared module. That file has a **zero diff** and still works.

Duplication here is cheaper than coupling the old path to the new one. What was
lifted: the `github.com/owner/repo` regex, the
`api.github.com/repos/{owner}/{repo}/contents/{path}` endpoint, the
`Accept: application/vnd.github.v3+json` and `User-Agent` headers, and the
base64 content decode.

Three things were **added**, and each is a change from what that file does:

- **An optional `GITHUB_TOKEN`.** `import-github-readme` sends none and this
  works with none. Unauthenticated GitHub allows 60 requests an hour per IP,
  which one creator's parse fits inside and a busy afternoon does not. Set the
  secret and it is sent; leave it unset and nothing changes.
- **The fetch budget**, above.
- **UTF-8 decoding.** `import-github-readme` uses `atob` alone, which reads the
  decoded bytes as latin-1 and mangles every non-ASCII character. That is a
  defect in a file this prompt may not touch, so it is fixed *here* rather than
  there: `atob`, then `TextDecoder` over the byte array.

---

## Configuration

`verify_jwt = true`, set explicitly in `supabase/config.toml`, for the same
reason as the other two parsers: this proposes against a build the caller must
own, so the gateway rejects unauthenticated calls before the function runs, and
`index.ts` checks the header again anyway.

Several seed functions in this repo are configured `verify_jwt = false` and are
therefore publicly invokable. **That is a known defect, not a pattern to copy.**

The Supabase client is built with the **caller's** token, so every read runs
under their RLS. The service role key is never used here.

| Secret | Required | Effect |
| --- | --- | --- |
| `GITHUB_TOKEN` | no | Raises the GitHub rate limit. `GITHUB_API_TOKEN` is also read. |

---

## Contract

### Request

`POST` with a `Bearer` access token.

```json
{ "repo_url": "https://github.com/owner/repository", "build_id": "uuid", "source_hint": "owner/repository" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `repo_url` | yes | Any github.com URL shape: bare, `www.`, `.git`, `/tree/<branch>/…`, with a query or a fragment. Rejected over 500 characters. |
| `build_id` | yes | uuid. Must belong to the caller. |
| `source_hint` | no | Free text, trimmed to 120 chars. Defaults to `owner/repo`. |

### Response

```json
{ "events": [], "nodes": [...], "summary": {...}, "warnings": [...] }
```

| Status | When |
| --- | --- |
| `200` | A proposal, however thin. |
| `400` | Body is not JSON, `repo_url` missing/empty/too long/**not a GitHub URL**, `build_id` missing or not a uuid. |
| `401` | No `Authorization` header, or the token is not valid. |
| `403` | The build is not the caller's, **or** the repository is private. |
| `404` | The repository is private, does not exist, or was renamed. |
| `405` | Anything but `POST` (and the `OPTIONS` preflight). |
| `429` | GitHub is rate-limiting the server. |
| `502` | GitHub is unreachable or returning errors. |
| `500` | The ownership read failed, or something unforeseen. |

**A private or nonexistent repository never returns a 500** — NS-P21
acceptance 3. GitHub answers 404 for both, deliberately, so that an
unauthenticated caller cannot enumerate private names; "private, does not
exist, or has been renamed" is therefore the only honest message, and a better
one than either guess would be.

### One divergence from NS-P20's advice

`parse-lovable`'s README asks the next parser to return **200 with a warning**
for input that is not its to read, because that is what makes *file* detection
composable — a dropped file might belong to another reader.

A URL is not a dropped file. There is no second URL parser to fall through to,
and the client detects a GitHub URL before calling at all, so a non-GitHub
`repo_url` reaching this function is a caller error rather than an undecidable
input. It returns **400 with the shape it expected**. Detection composability is
preserved where it exists; it is not invented where it does not.

---

## What is produced

| Node | Count | `inferred` | Read from |
| --- | --- | --- | --- |
| `repo` | 1 | **false** | the repository record — `url`, `default_branch`, `stars` |
| `stack` | 0–1 | true | the manifests, plus what the file listing alone proves |
| `prerequisite` | 0–14 | true | `.env.example` keys, and a Prerequisites/Installation section |
| `code` | 0–1 | true | one unambiguous entrypoint |

Plus `summary.proposed_title`, `summary.proposed_outcome` and
`summary.proposed_made_with` — all three are `builds` **columns**, not nodes.

### `events` is always empty, and that is not a gap

A repository is **not a session**. There is no ordered exchange to read, so
`events: []` and `turn_count`, `user_turn_count` and `assistant_turn_count` are
all `0`. Inventing events out of a file listing would put a sequence in front of
a creator that never happened. The fields keep their names because the client
reads them by name; zero is the honest answer, not a placeholder.

`materialiseProposal` derives a node's `event_id` from the covering event, and
with no events it correctly resolves to `null` for every node. Nothing needed to
change there.

### Stack detection

The six manifests NS-P21 names, each read at the repository root:

| Manifest | Proves | Dependencies from |
| --- | --- | --- |
| `package.json` | Node.js (`engines.node`) | `dependencies`, `devDependencies` |
| `requirements.txt` | Python | one requirement per line |
| `pyproject.toml` | Python (`requires-python`) | `[project].dependencies`, `[tool.poetry.dependencies]` |
| `go.mod` | Go (`go` directive) | `require` blocks and single-line requires |
| `Gemfile` | Ruby (`ruby` directive) | `gem` lines |
| `composer.json` | PHP (`require.php`) | `require`, `require-dev`, minus `ext-*` |

`pyproject.toml` is read by a **targeted reader, not a TOML parser**: four keys
out of two known tables, returning nothing on an unfamiliar shape. That is a
smaller thing to be wrong about than a hand-rolled TOML grammar.

The file listing contributes what it proves for free — a `Dockerfile`,
`netlify.toml`, `vercel.json`, `fly.toml`, `supabase/config.toml`,
`.github/workflows/` — because the tree request already listed them.

Entries are sorted by layer so the node reads as a description rather than a
listing, capped at **20**, and truncated from the bottom where the unplaced
dependencies sit. Toolchain noise (`@types/*`, `eslint*`, `react-dom`, `tslib`)
is dropped **before** the cap, so dropping it buys room for something a reader
cares about.

Versions have their range operator removed: `^18.3.1` becomes `18.3.1`. A stack
node is read by a person deciding whether they can run this, and `18.3.1`
answers that where `^18.3.1` makes them parse npm's grammar first. The manifest
is named in `source_ref.file` for anyone who needs the exact constraint.

### Canonical names, and why they matter

Every detected tool is looked up in `ai_tools_registry` on **`lower(name)` or
`lower(slug)`** — the same match `gallery_facets` uses — and the registry's
spelling wins where there is a hit. `@anthropic-ai/sdk` becomes
**`Anthropic API`**, which is what makes `made_with` join cleanly rather than
fragment into a facet nobody can filter on.

The candidate lists in `KNOWN_TOOLS` are deliberately **conservative**. The
`openai` package is not ChatGPT, and mapping it there to force a match would
write a wrong canonical name into `made_with`. Where the registry has no honest
row, the reader's own display name is used and `made_with` carries that — which
the gallery already supports for unmatched tools.

If the registry cannot be read at all, the parse still succeeds under the
reader's own names and says so with a `registry_unavailable` warning.

### `made_with` candidates

Every stack entry at layer **`ai`** becomes a `proposed_made_with` field, one
per tool so a creator can drop any of them individually. That is what NS-P21
means by "made_with candidates from detected AI SDK dependencies".

### The entrypoint, and what makes one unambiguous

`ENTRYPOINT_TIERS` in `parse.ts`, checked in order:

1. `src/main.{ts,tsx,js,jsx,py,go,rs}`
2. `src/index.{ts,tsx,js,jsx}`
3. `app.py`, `main.py`, `main.go`, `app.js`, `server.js`, `index.js`, `index.ts`, `manage.py`
4. `src/app.{ts,tsx}`, `src/server.ts`, `cmd/main.go`

A tier with **exactly one** present path names the entrypoint. A tier with
**two** is undecidable, and no code node is proposed — with an
`entrypoint_ambiguous` warning saying which two — rather than guessing between
them.

`github.ts` imports `chooseEntrypoint` from `parse.ts` rather than keeping a
second copy, so the file it fetches and the file the proposal names are the same
file by construction.

The source is excerpted at 20,000 characters. `node_types.code.language` is a
**closed enum**; an extension outside it is filed as `other` with an
`unmapped_code_language` warning rather than inventing a value the inspector
cannot render.

### The outcome

The README's first paragraph, else the repository's GitHub description, else
nothing with a warning. **Always `inferred: true`** — a README says what a
repository *is*, an outcome says what someone *got*, and the two are not the
same sentence.

Reaching that paragraph means walking past a centred HTML logo block, an H1, a
badge row, a horizontal rule and a table — which is what most READMEs open with.
`firstParagraph` returns `null` rather than a shrug when a README is nothing but
decoration, so the caller falls back to the description instead of presenting
badge alt-text as a description.

### Prerequisites

Two sources, both `inferred`:

- **`.env.example` keys**, one node each, capped at 12. A comment on or directly
  above the line becomes `why`. A key is *evidence* that something must be set,
  not a statement that it must.
- **The first matching README section** — `Prerequisites`, `Requirements`,
  `Before you begin`, `Installation`, `Setup`, `Getting started` and their
  variants — one node per bullet, or the section's first paragraph where it has
  no bullets.

Only the **first** matching section is read. A repository with both
Prerequisites and Installation has already said which one holds the
prerequisites, and reading both would propose the same requirement twice under
two headings.

Fenced code blocks inside that section are **dropped**: an Installation
section's code blocks are the commands you run, not the things you need first,
and proposing `npm install` as a prerequisite is noise a creator then has to
clear.

---

## `source_ref`, and the two things this reader adds

`_shared/intake/envelope.ts` was **not edited**. Both additions are made by
*narrowing* the shared types — an intersection is assignable to the shared type
— which is what that module's README asks for.

```ts
type SourceRef = SharedSourceRef<"repo"> & {
  repo: string;         // owner/repo
  ref: string;          // the default branch every read was pinned to
  file: string | null;  // the path this item came out of
};
```

`file` is what NS-P21 acceptance 6 asks for: a materialised tray node names the
file it came from. It rides into `build_nodes.source_ref` through the spread
`materialiseProposal` already does, so **no client change was needed** for it.

`file` is `null` on exactly one node — the `repo` node, which is read from the
repository record rather than from a file. `repo` and `ref` are set on all of
them, so provenance is complete either way.

`summary.proposed_made_with: ProposedField[]` is the second addition, by the
same means. `made_with` is a `builds` column exactly like `title` and `outcome`,
and `ProposedField` is how this envelope has always modelled a proposed `builds`
column.

`source_ref.index` is a **read order**, 1..N over the items proposed — not a
turn, because a repository has none.

---

## `warnings[]`

| Code | Means |
| --- | --- |
| `file_too_large` | A wanted file is over 200KB. Listed, never opened. |
| `fetch_budget_spent` | The 40-read budget ran out before this file. |
| `tree_truncated` | GitHub truncated its own listing. The stack may be incomplete. |
| `stack_truncated` | More dependencies than the 20-entry cap. |
| `no_stack_detected` | None of the six manifests is at the repository root. |
| `env_keys_truncated` | More than 12 keys in `.env.example`. |
| `entrypoint_ambiguous` | Two candidates tied. No code node proposed. |
| `unmapped_code_language` | The entrypoint's extension is outside the closed enum. |
| `no_outcome_found` | No README paragraph and no description. |
| `registry_unavailable` | `ai_tools_registry` could not be read; names are this reader's own. |

---

## Notes for the next parser author (NS-P22)

- **The substrate was used, not re-derived.** NS-P20a's `_shared/intake/` gave
  this reader its envelope types, `inferred` marking, `local_id` minting and
  `source_ref` shaping. There is no third copy of anything here — including no
  third copy of fence handling, which this reader does not need.
- **This reader is not in `_shared/intake/readers/`.** That registry routes a
  dropped **file** by reading its content; a repository URL is not a file and
  has no content to detect. The client routes it by recognising a GitHub URL
  instead. If NS-P22 or later adds a URL-shaped reader, that registry is where
  a `detect(url)` sibling would belong.
- `parse.ts` is pure and imports no Deno API, which is why
  `src/test/parseRepo.test.ts` can exercise all of it directly. `github.ts` is
  the only file that touches the network, and it is tested against a stubbed
  `fetch` that counts calls. Keep that split.
