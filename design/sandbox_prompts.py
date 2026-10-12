#!/usr/bin/env python3
"""Composer sandbox and build page: prompt series UI-P60 to UI-P76.

Seventeen Claude Code prompts that build the composer sandbox and the build
page drawn on the Composer sandbox canvas. Run them one per Claude Code
session, in order. Each prompt starts by reading design/RULES.md and
design/sandbox/CONCEPT.md, ends with the RULES.md section 4 report, and is
done only on PASS.

Usage (Python 3.9 or later, standard library only):

    python3 sandbox_prompts.py list                the order, and what each prompt needs first
    python3 sandbox_prompts.py show UI-P69         print one prompt, ready to paste (69 or p69 also work)
    python3 sandbox_prompts.py next [REPO]         print the first prompt with no commit in git log yet
    python3 sandbox_prompts.py write [REPO]        write the prompts into REPO/design/prompts/
    python3 sandbox_prompts.py write --dry-run     say what write would change, change nothing

`write` adds UI-P60.md to UI-P76.md to design/prompts/, a section for them in
00-INDEX.md and the prompts at the end of ALL-PROMPTS.md. It never overwrites a
prompt file that differs from the one here unless you pass --force, and it
does not commit.

Before UI-P60: put sandbox-screens.zip at the repo root. UI-P60 unpacks it.

One migration: UI-P61 writes it and puts it in the Deploy queue in
docs/reconciliation/HANDOVER.md. Send it to Lovable before UI-P69. Everything
before UI-P69 runs without it.

Nothing changes for visitors until UI-P76, which turns on the two switches in
src/lib/build/flags.ts (SANDBOX_COMPOSER_ENABLED, BUILD_PAGE_STEPS_ENABLED).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Prompt:
    id: str
    title: str
    wave: int
    needs: str
    lead: str
    body: str

    @property
    def number(self) -> int:
        return int(self.id[len("UI-P"):])

    @property
    def filename(self) -> str:
        return f"{self.id}.md"


WAVES = {
    1: "the record and the data",
    2: "the composer",
    3: "the build page",
    4: "finish",
}

# The decisions this series assumes, and what changes if you choose otherwise.
DECISIONS = (
    ("Layout", "A: boxes place themselves", "B or C changes UI-P68 only: a saved position per box"),
    ("Manual step", "B: its own numbered box", "A: skip UI-P70 and drop it from the Add menu. C: UI-P70 becomes a note on the arrow"),
    ("Default view", "A: List first; the Map switch appears at two sessions or an agent", "B: the switch always shows (UI-P63, UI-P73). C: open in Map at that size"),
    ("Understand it, Watch it get built", "Both kept as they are", "Dropping one removes its tab in UI-P73"),
    ("The Card", "Cover picture or video first, then title, summary, who it's for", "Reorder its sections in UI-P63"),
)

PROMPTS: tuple[Prompt, ...] = (
    Prompt(
        id='UI-P60',
        title='Put the concept and the boards in the repo',
        wave=1,
        needs='the screens zip at the repo root',
        lead='No app code. It writes `design/sandbox/CONCEPT.md`, the file every later prompt cites, and unpacks the board screens.',
        body=r'''# UI-P60 — Put the concept and the boards in the repo

Follow `design/RULES.md` (§1, §4, §8). No app code in this prompt.

**Goal.** The record every prompt from UI-P60 to UI-P76 builds from, in the repo: the concept file and the board screens.

**Steps.**
1. `sandbox-screens.zip` is at the repository root. If it is not, print "UI-P60 STOPPED: sandbox-screens.zip is not at the repo root" and stop.
2. Unpack it into `design/screens/sandbox/`, keeping its two folders (`noon/`, `dusk/`, one PNG per board). Delete the zip. Touch nothing else in `design/screens/`.
3. Create `design/sandbox/CONCEPT.md` with exactly the text between the two marker lines below. The marker lines are not part of the file.
4. Check every name the file uses against the code (RULES §8): the node types `prompt`, `agent_config`, `integration`, `document` and `result` in `supabase/migrations/20260823130000_node_type_registry_seed.sql`; `build_nodes.title`, `payload`, `source_ref`, `parent_id` and `position`; `import_sessions.client`, `model` and `created_at`; `builds.making`; `toolLabel` and `refreshMakingStats` in `src/lib/build/making.ts`; `getSessionPrompts` in `src/lib/build/sessions.ts`. A name spelled differently on disk is corrected in the file and listed in the report. A name that does not exist at all: stop.

---- BEGIN design/sandbox/CONCEPT.md ----
# The composer sandbox

The concept every prompt from UI-P60 to UI-P76 follows, cited as CONCEPT §n. The boards are in `design/screens/sandbox/{noon,dusk}/`. Where a prompt and this file disagree, the prompt wins for that one change. The data shapes are in `design/sandbox/DATA.md` (UI-P61).

## §1 The pieces

| Piece | What it is | Stored as |
| --- | --- | --- |
| Prompt | A message the maker sent: its title and its full text | `build_nodes` row, type `prompt` |
| Session | One chat or agent run, with its tool, model and date | an `import_sessions` row attached to the build; its public copy is in `builds.making.sessions` |
| Output | What a prompt gave back. Never stored as text, only pointed at | a `uses` entry naming that prompt |
| File | Something the AI read, such as CLAUDE.md or a brief | `document` node |
| Tool | An app or connector the AI used, such as Gmail or Web search | `integration` node |
| Agent | Prompts that run by themselves: instructions, tools, how it runs | `agent_config` node; its further prompts are child `prompt` nodes |
| Team | Agents passing work to each other | `team` node (UI-P61); its agents are child `agent_config` nodes |
| Manual step | Work done outside AI, in one line, with its tool | `manual_step` node (UI-P61) |
| Result | The finished thing: a link, a file or a picture | `result` node |

## §2 Rules

1. An arrow means "goes into". It leaves a box's right edge and ends on a named input on the left edge of a prompt, an agent, a team, a manual step or the result.
2. Steps are prompts, agents, teams and manual steps, numbered in order: 1, 2, 3. Inside an agent or a team, sub-numbers: 3.1, 3.2. An agent's instructions are its first sub-step ("3.1 Instructions"). Files, tools and results are not numbered.
3. Every prompt has a title. It starts as "Prompt 3", its number, and only the maker changes it. Nothing writes a title, a summary or a label for the maker.
4. Default names are literal: "Session 2 · Claude · 4 Oct", "Prompt 3", "Agent 3", "Team 3".
5. A box opens into its own map: a team shows its agents, an agent shows its prompts, files and tools. One level is open at a time. What it connects to outside stays in view, dimmed.
6. A suggested link is dashed until the maker accepts it. Readers never see a suggestion.
7. List and Map show the same build. Switching never changes or loses anything.
8. Layout (decision 1, A): boxes place themselves, rows by session, left to right by date. Dragging from a dot connects two boxes; nothing drags a box to a position.

## §3 How it runs

For an agent or a team. Five choices, in this order:

| Choice | Its one field | Example |
| --- | --- | --- |
| Runs once | none | |
| Runs several at once | how many, 2 to 20 | 3 at once |
| Repeats until a condition is met | the condition, up to 80 characters | until every claim has a source |
| Runs on a schedule | when, up to 60 characters | Mondays 07:00 |
| Runs when something happens | what, up to 60 characters | When a new email arrives |

## §4 What is detected

Exact facts only. Nothing is guessed, summarised or named for the maker.

- Now: a session's tool (`import_sessions.client`), model (`import_sessions.model`), date (`import_sessions.created_at`) and its prompts in order; a file's name written word for word in a prompt.
- After the parser change UI-P71 proposes: files attached, tools called and agents started (and how many at once), from structured records in the transcript only, never from prose; and an output moved between sessions, when at least 20 consecutive words of a reply appear in a later prompt, compared with whitespace collapsed.
- Every detected link arrives as a suggestion (§2.6).

## §5 The composer

- **Sources**, left, 250 wide: the only list of sources. Sessions in this build with their prompts nested under them, files in this build, sessions not in a build, the drop zone. In Map it folds to a 56px rail.
- **Build**, centre: List or Map.
- **Details**, right, 290 wide: whatever is selected.
- **Card**, behind one button: the cover picture or video first, then title, one-line summary, who it's for, made with, more details.
- **One filled button: Publish.** The status line names what is missing ("Missing: cover picture"), and each missing item opens the Card at its field.
- **Default view** (decision 3, A): every build opens in List. The List and Map switch appears once the build has two sessions or an agent, with a one-time line: "Map is now available".
- **Add menu**, seven items in this order: Prompt, Session, Agent or team, File, Tool, Manual step, Result.

## §6 The build page

- The top stays as it is: cover, shape tag, action dock, title plate, proof panel.
- **The build** replaces Anatomy, Run it yourself, the part viewer and the timeline. Tabs, in order: The build, Watch it get built, Understand it, Where it broke, Rebuilds (only when there are some). Watch it get built and Understand it keep their current bodies until the owner decides.
- Every step shows its number, title, full text (four lines, then "Read all of it") and Copy. A session's first step is headed "New chat in {tool}"; a later step in it says "Send in the same chat as step {n}". A use reads "Paste in: what step {n} gave you". A file reads "Attach {name}" with Download. Inside an agent or a team the word is "Uses", never "Paste in".
- **What you need**: tools and models with the steps that use them, files with Download, how it runs, and the time span.
- **Map**, read-only: clicking a box opens its full text on the right, with Copy and what to paste in.
- **Copy for AI** copies the whole build in order, with each new chat and each paste-in written out.

## §7 Budgets

- One filled button per view: Publish in the composer, Done in the full prompt window, "I ran this and it worked" on the build page.
- Add menu at most 7. How it runs exactly 5. At most 6 rows visible in any list, then one "Show {n} more". At most 3 actions shown per item: a step shows one, its menu (Rename, Read all of it, Move up, Move down, Remove), and a menu holds at most 7. At most 4 actions beside the primary. One route to the same thing.
- Build page tabs at most 5.

## §8 Copy

The words to ship. A prompt may add copy; it never rewords these.

| Where | Copy |
| --- | --- |
| Sources groups | Sessions in this build · Files in this build · Not in a build |
| Drop zone | Drop sessions or files |
| List hint | Click a prompt to see its details · double-click to read all of it |
| List card footer | Show full prompt · {n} words |
| Inputs | Uses · Goes into · Add an input · suggested · Accept · Dismiss |
| Add a prompt | Paste or type a prompt… |
| Map key | goes into · suggested · click to select · double-click to read all of it · drag from a dot to connect |
| Map footer | Rows by session, left to right by date · what it doesn't touch is dimmed · Esc clears |
| Opened box | Back to build · Inside team {n} · {title} |
| Full prompt window | Prompt {n} of {N} · full prompt · Title · starts as "Prompt {n}" · only you can change it · Copy prompt · Done · Esc closes · ← → move between prompts |
| Build page | The build · New chat in {tool} · Send in the same chat as step {n} · Paste in · what step {n} gave you · Attach {name} · Read all of it · What you need · to repeat this build |
| Copy for AI note | Copy for AI copies all {n} steps in order, with each new chat and paste-in written out. |

## §9 Vocabulary

Allowed, beside CONTRACT §13: prompt, session, agent, team, file, tool, input, result, map, list, manual step. Never in interface text: node, upload, post, blueprint, blog, block, stage, remix, rating, verification.

## §10 Boards

| Screen | Shows |
| --- | --- |
| Main | The pieces, rules, how it runs, what is detected |
| S1 to S5, List and Map | The composer at five sizes: one prompt, one chat, several chats, an agent, a team |
| D1 to D3 | The three decisions, options side by side |
| V1-References | What the composer takes from each reference |
| V2-List, V3-Map | The composer redrawn: titles, named inputs, dimming, the Sources rail |
| V4-PromptModal | The full prompt window |
| V5-TeamMap | A team opened into its own map |
| B0 to B4 | The build page: the translation, List, Map, a team, one prompt |

Where an S board and a V board disagree, the V board wins: it is the later drawing.

## §11 Decisions taken

Layout A, manual step B, default view A, Watch it get built and Understand it kept, the Card cover first.
---- END design/sandbox/CONCEPT.md ----

**Done when.** The file exists with every name checked, the screens are in place, and `npm test` and `npm run build` pass with nothing else changed.

**Commit.** `UI-P60: the composer sandbox concept and boards`''',
    ),
    Prompt(
        id='UI-P61',
        title='Proposal: the data shapes and one migration',
        wave=1,
        needs='UI-P60',
        lead='No app code. Titles, uses, how it runs and sessions all fit columns that already exist, so the only database change is two node-type rows. It writes `design/sandbox/DATA.md`, queues the migration and stops.',
        body=r'''# UI-P61 — Proposal: the data shapes and one migration

Follow `design/RULES.md` (§8) and `design/sandbox/CONCEPT.md` (§1 to §4). Skills: supabase-postgres-best-practices for the migration, neoscale-code-review for the gate. No app code in this prompt.

**Goal.** Write down how every piece of CONCEPT §1 is stored, add the two node types the build lacks as one migration for the owner to apply, and stop. Every later prompt reads `design/sandbox/DATA.md` for names and shapes.

**Read first.** `src/lib/build/types.ts`, `nodeTypes.ts`, `nodes.ts`, `composeCover.ts` (`placeTopNode`, `nodeRow`), `composePrompts.ts`, `making.ts`, `sessions.ts`; `supabase/migrations/20260823130000_node_type_registry_seed.sql` (its columns, renderers, colours, sort per category and its ON CONFLICT form); the newest file in `supabase/migrations/`; the Deploy queue at the top of `docs/reconciliation/HANDOVER.md`.

**Steps.**
1. Confirm against those files, and against the live schema where RULES §8 says the files may have drifted: `build_nodes` has `title`, `payload`, `source_ref`, `parent_id`, `position` and the unique index on `(build_id, parent_id, position)`; `node_types` has the columns the seed inserts; there is no `team` and no `manual_step` key. If any of that is not so, stop and say what you found.
2. Write `design/sandbox/DATA.md` with the text between the two marker lines below. Where a file names something differently, use the file's name and list the change in the report.
3. Write `supabase/migrations/<next timestamp>_sandbox_node_types.sql`, stepping after the newest file:
   - A header comment in the style of `20261001280000_sessions_and_making.sql`: what it does, that it is idempotent, that it is correct in both worlds.
   - One `INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) … ON CONFLICT (key) DO NOTHING` with two rows:
     - `team`, "Team", `configuration`, the colour `agent_config` uses (`#7C3AED`), icon `Users`, renderer `configuration`, copyable `true`, active, sort one past the highest `configuration` sort in the seed, schema `{"fields":[]}`.
     - `manual_step`, "Manual step", `narrative`, the narrative colour (`#9CA3AF`), icon `Hand`, renderer `narrative`, copyable `false`, active, sort one past the highest `narrative` sort, schema `{"fields":[{"key":"tool","label":"Tool","type":"string","required":true},{"key":"text","label":"What was done","type":"text","required":true},{"key":"media_id","label":"Picture","type":"string","format":"media_id"}]}`.
   - Nothing else: no policy, grant or column change. If these rows would need a grant or policy to be readable, stop and propose it.
   - If a local Postgres is available, rehearse the file twice on a stand-in built from the repository's migrations (the second run must change nothing) and say so. Otherwise say it was not rehearsed.
4. Add it to the Deploy queue as the next item: "Apply supabase/migrations/<file> (UI-P61), then check that `select key from public.node_types where key in ('team','manual_step')` returns two rows."
5. Stop. Do not regenerate `types.ts` and do not touch `src/`.

---- BEGIN design/sandbox/DATA.md ----
# The composer sandbox — data

How each piece of CONCEPT §1 is stored. Names follow the code; RULES §8 applies.

## 1. Steps and their order
- A step is a top-level `build_nodes` row of type `prompt`, `agent_config`, `team` or `manual_step` with a `position`. Steps are numbered by position, from 1, counting steps only. Other top-level rows (the cover's evidence node, files, tools, results) keep their positions and are not numbered.
- Inside an agent: `payload.system_prompt` is sub-step n.1, "Instructions"; its child `prompt` rows, by position, are n.2 onward.
- Inside a team: its child `agent_config` rows, by position, are n.1 onward. An agent inside a team shows its instructions in its own row; its further prompts show only when it is opened. There is no third level of numbers.
- A step's title is `build_nodes.title`. Null means its default name: "Prompt 3", "Agent 3", "Team 3", "Manual step 3". A title is trimmed, at most 80 characters, and an empty title saves as null.

## 2. Payloads, beside the fields each type's registry schema already has
- `prompt`: `text` (required), `model?`, `tool?` (only on a prompt written by hand: a client `toolLabel` knows), `uses?: Use[]`, `dismissed?: string[]`.
- `agent_config`: its schema's fields (`system_prompt`, `model`, …) plus `runs?: Runs`, `uses?`, `dismissed?`.
- `team`: `runs?`, `uses?`, `dismissed?`.
- `manual_step`: `tool` (at most 40), `text` (at most 140), `media_id?`, `uses?`.
- `document`, a file: `title` (the file name), `url?`, `summary?`, `media_id?` (a file stored through the existing build media path in `media.ts`).
- `integration`, a tool: `service`, `scopes?` (what it was used for, as detected: "read, label, draft"), `notes?`.
- `result`: `summary`, `media_id?`, `url?`.

## 3. Uses
`Use = { "kind": "output" | "file" | "tool", "node_id": "<uuid>" }`
- `output` names a step, `file` a `document` row, `tool` an `integration` row.
- A step never uses itself, and the same use is never listed twice.
- A use of a later step is allowed only when that later step sits in the same agent or team and its runs is "until" (a checker sending work back). It draws as a loop.
- The order of `uses` is the order of the named inputs on the box.
- "Goes into" is never stored. It is every step whose `uses` names this one, plus the next step in the same session.
- A suggestion is never stored. A dismissed one is kept as `"<kind>:<node_id>"` in `dismissed`, so it is not offered again.

## 4. Runs
`Runs = { "how": "once" | "parallel" | "until" | "schedule" | "event", "count"?: number, "detail"?: string }`
- `count` only for parallel, 2 to 20. `detail` for until (at most 80), schedule and event (at most 60). No `runs` means "once".

## 5. Sessions
- The session a prompt came from is `source_ref.import_session_id`, which `addSessionPrompt` sets. A prompt written by hand has no `source_ref`.
- `import_sessions` is owner-only, so readers never read it. Its public copy is `builds.making.sessions[]`: today `{ client, model, prompts, turns }`. `refreshMakingStats` adds `id` (the import session's id) and `started_at` (its `created_at`). Older entries without them still read.
- A session's number is its order by first step in the build. Its tool label comes from `toolLabel(client)`, its model label from `modelLabel(model)`.

## 6. What this changes in the database
Two `node_types` rows, `team` and `manual_step`, in `<file>`. Nothing else.
---- END design/sandbox/DATA.md ----

**Done when.** DATA.md and the migration exist, the migration is in the Deploy queue, and nothing in `src/` changed.

**Commit.** `UI-P61: sandbox data shapes, and the team and manual step node types (proposal)`

**Report** adds one line: "Owner: send <file> to Lovable before UI-P69."''',
    ),
    Prompt(
        id='UI-P62',
        title='Data: steps, numbers, titles, uses and how it runs',
        wave=1,
        needs='UI-P61',
        lead='One module both the composer and the build page draw from. It has no interface and is tested on its own.',
        body=r'''# UI-P62 — Data: steps, numbers, titles, uses and how it runs

Follow `design/RULES.md` (§3, §8) and `design/sandbox/DATA.md`. Skills: neoscale-code-review. No interface in this prompt.

**Goal.** One module that turns a build's node tree into the steps both the composer and the build page draw, plus the writes that change them. Pure functions first, then the writes, all tested.

**Read first.** `design/sandbox/DATA.md`; in `src/lib/build/`: `types.ts` (`BuildNode`, `NodeTree`), `nodes.ts` (`upsertNode`, `reorderNodes`, `NodeMove`), `composeCover.ts` (`placeTopNode`, `nodeRow`), `composePrompts.ts` (all of it: the pattern to follow), `making.ts` (`refreshMakingStats`, `Making`, `MakingSession`, `toolLabel`), `sessions.ts`, `nodeTypes.ts` (`getNodeType`); `src/lib/models/registry.ts` (`modelLabel`); `src/pages/site/build/buildModel.ts` (`partsInOrder`). Grep first: if a function below already exists under another name, use it and say so.

**Build** `src/lib/build/graph.ts`, exported through `src/lib/build/index.ts` the way its neighbours are:
- Types `Use`, `Runs`, `StepKind = "prompt" | "agent" | "team" | "manual"`, and `Step = { id, kind, number ("3", "3.1"), title: string | null, defaultTitle, text, words, model: string | null, sessionId: string | null, runs: Runs | null, uses: Use[], children: Step[] }`.
- `buildSteps(tree)`: the steps in order, numbered as DATA §1. An agent's instructions are its first child: kind "prompt", number n.1, defaultTitle "Instructions", id `"<agent id>:instructions"`.
- `stepTitle(step)`: the title, else the default title.
- `sessionGroups(steps, sessions)`: `{ sessionId, number, tool, model, startedAt, stepNumbers }[]` in order of first step, from `builds.making.sessions` (DATA §5). Prompts with no session form one group per run of consecutive steps, with the tool from `payload.tool` and "typed here" where the date would be.
- `usesOf(node)`; `goesInto(steps, id)` (DATA §3: the steps that use this one, plus the next step in the same session); `wordCount(text)` (split on whitespace).
- `parseRuns(value)` and `runsLabel(runs)`: "Runs once", "Runs several at once · 3", "Repeats until a condition is met", "Runs on a schedule · Mondays 07:00", "Runs when something happens".
- Writes. Each goes through `upsertNode` or a placer like `placeTopNode`, and refuses bad input with `buildLayerError`, identifiers only (CONTRACT §9):
  - `setStepTitle(node, title)`: trim, at most 80, empty saves as null.
  - `addUse(node, use, steps)`, `removeUse(node, use)`, `dismissSuggestion(node, key)`: the DATA §3 rules, including the "until" exception.
  - `setRuns(node, runs)`: the CONCEPT §3 limits.
  - `addAgent(buildId, tree, { name, model })`, `addTeam(buildId, tree, { name })`, `addAgentPrompt(agent, tree, text)`, `addManualStep(buildId, tree, { tool, text })`, `addFile`, `addTool`, `addResult`. New top-level rows go through `placeTopNode`. A child goes through a new `placeChildNode(buildId, tree, parentId, row)` beside it: one past the highest child position, under the same unique-index rule `reorderNodes` describes. `addTeam` and `addManualStep` first check `getNodeType` for their key and refuse with "That needs the Deploy queue item from UI-P61." while the row is not live.
- `making.ts`: `refreshMakingStats` also writes `id` and `started_at` on each session (DATA §5). `MakingSession` gains both as optional fields, and every reader keeps working when they are absent.

**Tests.** `graph.test.ts`: numbering for a flat build, an agent with two prompts, and a team of four agents; default titles; session groups with a hand-written prompt between two sessions; uses and goes-into; the until loop allowed and every other later use refused; the runs limits; title trimming and nulling; the two refusals while the node types are missing. `making.test.ts`: the two new fields, and an old entry without them.

**Done when.** The RULES §4 checks pass and no interface file changed.

**Commit.** `UI-P62: the build graph — steps, numbers, titles, uses and runs`''',
    ),
    Prompt(
        id='UI-P63',
        title='The composer frame: Sources, Build, Details and the Card',
        wave=2,
        needs='UI-P62',
        lead='The new composer is built beside the old one, behind a switch. It also moves media, title, summary and details into the Card.',
        body=r'''# UI-P63 — The composer frame: Sources, Build, Details and the Card

Follow `design/RULES.md` (§3, §4, §7) and `design/sandbox/CONCEPT.md` (§5, §7, §8). Skills: neoscale-code-review, neoscale-performance (Checklist for any new route), neoscale-e2e-testing. Boards: `S1-List`, `S3-List`, `V2-List`, for the frame only; the panels' insides are UI-P64 to UI-P66.

**Goal.** The new composer beside the old one: a pure `SandboxView`, its container `SandboxPage`, a dev page, and the switch that chooses it. With the switch off, `/compose` is exactly as before.

**Read first.** In `src/pages/site/compose/`: `ComposeRoute.tsx`, `ComposePage.tsx`, `ComposeView.tsx`, `useComposeNodes.ts`, `useComposePrompts.ts`, `useComposeSessions.ts`, `useComposeDetails.ts`, `composeModel.ts` (`missingForPublish`, `PUBLISH_WORDS`, `saveState`), `MoreDetails.tsx`, `MadeWithLine.tsx`. In `src/components/`: `brand/Panel.tsx`, `brand/Button.tsx`, `brand/IconButton.tsx`, `brand/Segmented.tsx`, `shell/BottomSheet.tsx`. Also `src/lib/reblog/flags.ts` (the switch pattern), `src/dev/fixtures/compose.ts`, and how `/dev/kit/pages/:page` registers a page.

**The switch.** New `src/lib/build/flags.ts` with `export const SANDBOX_COMPOSER_ENABLED = false as const;` and `export const BUILD_PAGE_STEPS_ENABLED = false as const;` (UI-P73 uses the second). Each carries a comment naming UI-P76 as the prompt that turns it on. `ComposeRoute` renders `SandboxPage` in place of `ComposePage` only when the switch is on and the visit is one the new composer already takes. Every flow it sends to `legacy` today still goes there.

**Desktop** (1440, the 1280 column):
- Header row, `space-between`, aligned to the bottom. Left: the breadcrumb (Home / Drafts / {title}), the title as an `h1` in `display(34)`, and a DM Mono 12 `--text2` status line, "Draft · {save state} · Missing: {items}". Each missing item is a text button that opens the Card at its field. Right: the List and Map `Segmented`, shown under CONCEPT §5's default-view rule. The first time it appears, a DM Mono 11 line under it says "Map is now available" until the maker switches once. Then "Card" and "Preview" as secondary buttons, then "Publish", the page's one primary.
- Grid `250px minmax(0, 1fr) 290px`, gap 16, `align-items: start`, 16 below the header. Three `Panel surface="flat"` panels, padding 16: Sources, Build, Details. No glass anywhere on the route (RULES §7b).
- Build panel head: "Build" (15/600) and DM Mono 12 counts, "{s} sessions · {p} prompts · {f} files", leaving out any zero. Right, a secondary 30/10 "Add" with `ChevronDown`, opening a menu of CONCEPT §5's seven items. Each item shows its name (13.5/600) and one line in `--text2`: "A message you sent" · "A chat from your sources" · "Prompts that run by themselves" · "Something the AI read" · "An app or connector it used" · "Work done outside AI" · "The finished thing". An item whose prompt has not run yet is listed but disabled; the switch stays off until UI-P76.
- Details with nothing selected: "Select a prompt, session or file to see it here." (13.5, `--text2`).
- **The Card** opens from "Card" or from a missing item. It is a Radix Dialog sheet on the right: 480 wide, full height, `--flat`, a 1px `--line` left edge, the existing dialog shadow and scrim tokens, focus trapped, Esc closes. Its sections, in this order, each reusing today's field and save path: Cover (the current media drop and picker, plus "Use a result's picture" when a result has one), Title, One-line summary (`DESCRIPTION_MAX`), Who it's for, Made with (`MadeWithLine`), More details (`MoreDetails`). No new write path.

**Phone** (below 768): one column. Header, status line, then the Build panel (List only, never Map). Its head carries two secondary buttons, "Sources" and "Details", which open `BottomSheet`s; selecting an item opens Details. Publish sits in the existing sticky action bar. Touch targets 44.

**Dev page.** `src/dev/fixtures/sandbox.ts` with two builds, the one-prompt fox poster (S1) and the bakery homepage (S3). Register it at `/dev/kit/pages/sandbox`, rendering `SandboxView` whatever the switch says.

**Done when.** The dev page matches the frame of `S1-List` and `S3-List` by eye, in both themes, at 1440 and 390. With the switch off, `/compose/new` and `/compose/:id` behave as before and their tests pass. `SandboxPage` is `React.lazy` and stays out of the main bundle (check the build output). The RULES §4 checks pass.

**Commit.** `UI-P63: the sandbox composer frame, behind SANDBOX_COMPOSER_ENABLED`''',
    ),
    Prompt(
        id='UI-P64',
        title='Sources',
        wave=2,
        needs='UI-P63',
        lead='The left panel: sessions with the prompts they gave the build nested under them, files, sessions not in the build, and the drop zone.',
        body=r'''# UI-P64 — Sources

Follow `design/RULES.md` and `design/sandbox/CONCEPT.md` (§5, §7, §8). Skills: neoscale-code-review, neoscale-e2e-testing. Boards: `V2-List` (the tree), `S2-List`, `S3-List`, and `S1-List` for the empty state.

**Goal.** The left panel: every source the build has or could have, sessions with the prompts they gave the build, and the two ways to add a source.

**Read first.** `src/pages/site/compose/SessionsPanel.tsx`, `SessionsPanel.budget.test.tsx`, `useComposeSessions.ts`; `src/lib/build/sessions.ts` (`listBuildSessions`, `listLibrarySessions`, `attachSession`, `getSessionPrompts`, `SessionSummary`); `graph.ts` (`sessionGroups`, `buildSteps`); `media.ts` and the composer's current file drop; `making.ts` (`toolLabel`).

**Build** `SourcesPanel.tsx` beside `SessionsPanel.tsx`, which stays for the old composer:
- Head: "Sources" (15/600), with DM Mono 12 "{n} in build" on the right.
- Three groups, each headed by a 7px dot, its name (12.5/600) and a DM Mono 11.5 count: "Sessions in this build", "Files in this build", "Not in a build" (hollow dot). A group with nothing in it is left out. An empty build shows the S1 empty lines instead: "No sessions yet." with a "Connect a tool" link to the connector page, and "No files yet."
- A session row: a chevron button that opens and closes it, then "Session {n} · {tool}" (13.5/600, one line, ellipsis) over DM Mono 12 "{model} · {d MMM}". Opened, it lists the prompts it gave this build, 16px in, each row 26 tall: a 6px dot, the DM Mono number, the title (the default title in `--text2`). The selected step's row has `--sel2`. Clicking a session selects it; clicking a prompt selects that step.
- A file row: `FileText` 14, the name (13.5/600) over DM Mono 12 "opened in session {n}" or "added by you".
- Not in a build: each session in the creator's library that is not in this build, in `--text2`, with "{d MMM} · {n} prompts" and an `IconButton` `Plus` labelled "Add session", which calls `attachSession`.
- The drop zone: "Drop sessions or files", dashed 1.5 `--line`, radius 12. Dropped files become files of the build (`addFile`, stored through the existing media path); a dropped session export goes to the existing intake. Without a fine pointer it is a button with the same words that opens the file picker.
- At most 6 rows per group, then one text button, "Show {n} more" (CONCEPT §7).
- Add › Session opens the same library list as a menu, and Add › File opens the file picker. Both menu items become enabled.

**Phone.** The panel is the content of UI-P63's "Sources" bottom sheet. Rows at least 44 tall.

**Tests.** `SourcesPanel.budget.test.tsx` in the shape of `SessionsPanel.budget.test.tsx`: at most 6 rows per group, then one "Show {n} more"; no second add route; no filled button. Unit tests for the session numbers and the nested prompts.

**Done when.** The dev page matches the Sources panel of `V2-List` and `S3-List` by eye in both themes. Adding a session from Not in a build, and dropping a file, both work against the faked backend in a tier-3 spec. The RULES §4 checks pass.

**Commit.** `UI-P64: Sources — sessions with their prompts, files, not in a build`''',
    ),
    Prompt(
        id='UI-P65',
        title='List view',
        wave=2,
        needs='UI-P64',
        lead='The centre panel in List: titled steps with two lines of text, session dividers, inputs as chips, suggestions to accept or dismiss, agents and teams nested, the result, and the field for adding a prompt.',
        body=r'''# UI-P65 — List view

Follow `design/RULES.md` and `design/sandbox/CONCEPT.md` (§2, §5, §7, §8). Skills: neoscale-code-review, neoscale-e2e-testing. Boards: `V2-List` first; then `S2-List`, `S3-List`, `S4-List`, `S5-List` for what V2 does not show (agents, teams, a session's checklist).

**Goal.** The Build panel's List: the whole build in step order, readable at a glance, every step titled, each one's inputs visible.

**Read first.** `src/pages/site/compose/PromptsPanel.tsx` (its write field, its drop handling and its `onMove` arrows), `useComposePrompts.ts`; `src/lib/build/composePrompts.ts` (`addWrittenPrompt`, `savePromptText`, `movePrompt`), `graph.ts`.

**Build** `BuildList.tsx`, inside the Build panel:
- A hint, DM Mono 11.5 `--text2`, 4 below the head: "Click a prompt to see its details · double-click to read all of it".
- **Session divider** before the first step of each run of steps from one session: a 7px dot, "Session {n} · {tool}" (13/600), DM Mono 12 "{model} · {d MMM}" and a hairline filling the rest. Margins 16 above, 8 below; 4 above the first.
- **Step card**: radius 14, 1px `--line`, `--solid`, 8 between cards.
  - Header row, padding 10 8 0 14, gap 10: the number badge (24 square, radius 7, `--sel2`, DM Mono 12/600); the title (15/600, one line, ellipsis; a default title in 500 `--text2`); then an `IconButton` `MoreHorizontal` labelled "Prompt {n} options". Its menu: Rename, Read all of it, Move up, Move down, Remove. Rename edits the title in place (Enter saves, Esc cancels). Move up and down call the existing `movePrompt`.
  - Body, padding 6 14 0 48: the text at 14/1.5, clamped to 2 lines.
  - Footer, padding 8 10 10 48, gap 6, wrapping. Left: "Uses" (DM Mono 12 `--text2`), then one chip per use (height 24, padding 0 8 0 6, radius 8, `--sel`, DM Mono 11.5, a 7px ring dot first): "Output of {n} · {title}", "{file name}", "{tool name}". A suggestion chip is transparent with a 1.5px dashed `--text2` border, "{label} · {reason}" ("Output of 1 · Brand brief · 38 words match"), holding an extra-small "Accept" button, followed by a ghost "Dismiss". A step that goes into the result shows "Goes into" and a `--evidence-fill` chip, "Result". Right: "Show full prompt" (12.5/600 underlined link, only when the text is clamped) and DM Mono 12 "{n} words".
  - Selected: a 2px `--text` ring, border transparent. Clicking selects (Details shows it); double-click, Enter, "Show full prompt" and "Read all of it" call `onOpenPrompt(id)`, which UI-P67 implements.
- **Agent card** (`S4-List`): the header reads DM Mono "Agent · made in prompts {a} and {b} · {model}" over the title (15/600), with the runs label as a chip on the right. Below, 12px in behind a 2px `--line` rule, its sub-steps as inner cards (`--cell`, 1px `--hairline`, radius 12, a 34-wide number badge "3.1"), then a "Uses" chip row. A ghost "Add a prompt to this agent" at the end. Enabled in UI-P69.
- **Team card** (`S5-List`): the same, with its agents as the inner cards, each headed "Agent · {title} · {model}" with its runs chip.
- **Result card**: a check badge on `--evidence-fill`, DM Mono "Result", the title or link (15/600), and DM Mono "{what it holds} · from prompt {n}".
- **Add a prompt**, at the end of the list: radius 14, 1px `--line`, `--field`, padding 12 12 10 14. The text area, with the placeholder "Paste or type a prompt…" (16px on a phone). Under it a row of two chip menus, the tool ("Typed here · {tool}"; the tools `toolLabel` knows) and the model ("model {name}"), then an `IconButton` 32 `ArrowUp`, labelled "Add prompt", which calls `addWrittenPrompt` with the tool and model in its payload (DATA §2). Enter adds; Shift+Enter is a new line. Add › Prompt focuses this field.
- Suggestions come in as a prop, `suggestions: Suggestion[]`, empty until UI-P71. Accept calls `addUse`; Dismiss calls `dismissSuggestion`.

**Phone.** The same cards full width. Card menu rows and the add button at 44. Double-click is not offered; a tap selects, and "Show full prompt" opens the window.

**Tests.** Unit: the session dividers fall where the session changes; a default title renders in `--text2`; the clamp link shows only when the text is clamped. Tier-3: write a prompt, rename it, move it, remove it.

**Done when.** The dev page matches the List of `V2-List`, `S3-List` and `S5-List` by eye in both themes at 1440 and 390, and the RULES §4 checks pass.

**Commit.** `UI-P65: List view — titled steps, sessions, inputs, suggestions`''',
    ),
    Prompt(
        id='UI-P66',
        title='Details',
        wave=2,
        needs='UI-P65',
        lead='The right panel for whatever is selected. It is the one place to rename a step, edit its inputs and set how an agent runs, and the home of the pieces that have no card: tools, files and results.',
        body=r'''# UI-P66 — Details

Follow `design/RULES.md` and `design/sandbox/CONCEPT.md` (§2, §3, §7, §8). Skills: neoscale-code-review, neoscale-e2e-testing. Boards: `V2-List` and `V3-Map` (a prompt), `S2-List` (a session), `S4-List` (an agent), `S5-List` (an agent in a team), `S1-List` (a typed prompt).

**Goal.** The Details panel, for each kind of thing that can be selected.

**Read first.** `src/lib/build/graph.ts`, `composePrompts.ts` (`savePromptText`, `setPromptModel`, `addSessionPrompt`), `sessions.ts` (`getSessionPrompts`); `src/components/brand/LiveRegion.tsx`; the Details panels on the boards above.

**Build** `DetailsPanel.tsx`. By what is selected:
- **A prompt.** An eyebrow, DM Mono 11 uppercase, "Prompt {n}". The title in `display(22)`, with an `IconButton` `Pencil` 14 labelled "Rename" that edits it in place. DM Mono 12 "Session {n} · {tool}" over "{model} · {d MMM} · prompt {i} of {total}". A typed prompt shows "Typed here · {tool}" and a Model field instead, with "Model is empty because there is no session to read it from." while it is blank. Then the text in a `--cell` box (1px `--hairline`, radius 10, padding 10 12) clamped to 4 lines, with a secondary 30 "Read all of it" (`Maximize2`) and DM Mono "{n} words".
  - "Uses {n}": one row per use, grid `18px 1fr 24px`, hairline above: `ArrowLeft` 14 `--text2`, the label (600) over a DM Mono sub ("Homepage copy · Session 2", "File · opened at turn 3"), and an `IconButton` `X` 24 labelled "Remove". Then a ghost "Add an input" opening a menu of what this step may use (DATA §3): earlier steps' outputs, the build's files, its tools. Six shown, then "Show {n} more".
  - "Goes into {n}": rows with `ArrowRight`, from `goesInto`.
- **A session.** Key and value rows, a 90px label column, hairline above each: Tool, Model, Date. Then "Prompts in the build {k} of {n}", a checklist of the session's prompts from `getSessionPrompts`: ticking adds the prompt, unticking removes it. Six shown, then "Show {n} more".
- **A file.** Name, where it came from, size, a Download button, and "Used by" rows.
- **A tool.** Service, "What it was used for" (its scopes), "Used by".
- **An agent or a team** (`S4-List`). A Name field; key and value rows for Made in, Model (an agent only) and First run (when known). "How it runs": a real radio group (`<input type="radio">` in labels) of CONCEPT §3's five choices, rows 30 tall, labels 13/500, the chosen row on `--sel`. Under it, the one field that choice needs: a number input for "Runs several at once" (2 to 20, shown as "3 at once"), or a text input with its limit and a counter. Then "Inside {counts}" rows with Remove, "Add an input", and "Goes into".
- **A result.** Summary, Link, Pictures (through the existing media path), and "Use as cover" on a picture, which writes the cover through the Card's existing write.
- **A manual step**: UI-P70.
- Add › Tool and Add › Result create the row and select it here. Both menu items become enabled.

**Phone.** The panel is the content of the Details bottom sheet. Radio rows and remove buttons at 44.

**Tests.** Unit: the five choices in order and their limits; the Add an input menu offers only what DATA §3 allows. Tier-3: add an input and remove it; set "Runs several at once" to 3; rename a prompt from Details.

**Done when.** The dev page matches the Details panels of the boards above by eye in both themes, and the RULES §4 checks pass.

**Commit.** `UI-P66: Details — prompts, sessions, files, tools, agents, results`''',
    ),
    Prompt(
        id='UI-P67',
        title='The full prompt window',
        wave=2,
        needs='UI-P66',
        lead='Double-clicking a prompt opens it whole, with its title editable and Copy beside it. The build page reuses the same window, read-only.',
        body=r'''# UI-P67 — The full prompt window

Follow `design/RULES.md` (§4 accessibility) and `design/sandbox/CONCEPT.md` (§2.3, §7, §8). Skills: neoscale-code-review, neoscale-e2e-testing. Board: `V4-PromptModal`.

**Goal.** One window that shows a prompt in full, for the maker (title editable) and, from UI-P73, for readers (read-only).

**Read first.** How the build page opens its anatomy dialog (Radix Dialog in `BuildView.tsx`); `src/components/brand/LiveRegion.tsx`; `graph.ts` (`stepTitle`, `wordCount`, `goesInto`); the dialog shadow and scrim tokens in `src/lib/theme/tokens.ts`.

**Build** `src/components/build/FullPromptWindow.tsx`, a Radix Dialog, props `{ steps, openId, mode: "maker" | "reader", onTitle?, onClose }`:
- Desktop: 780 wide, centred, 104 from the top, `--flat`, 1px `--line`, radius 16, the overlay shadow, padding 22 24 20, over the scrim token.
- Head: DM Mono 11.5 uppercase `--text2`, "Prompt {n} of {N} · full prompt", and a 32 `IconButton` `X` labelled "Close".
- Maker mode: the title as a field 50 tall, radius 12, 1px `--line`, `--field`, the text in `display(27)`, a `Pencil` 16 at the right; under it DM Mono 11.5, `Title · starts as "Prompt {n}" · only you can change it`. Saved on blur and on Enter through `setStepTitle`; empty saves the default. Reader mode: the title as the dialog's heading, no field.
- Facts, 14 below: chips (height 26, radius 8, `--sel`, DM Mono 12): "Session {n} · {tool}", "{model}", "{d MMM}", "prompt {i} of {total} in the session".
- The text, 14 below: a box on `--recess`, 1px `--hairline`, radius 12, 372 tall, scrolling, `white-space: pre-wrap`, 15/1.6, padding 16 26 16 18, focusable, with a 48px fade at the bottom while there is more to scroll.
- Under it: DM Mono 12 "{n} words" and a secondary 30 "Copy prompt" (`Copy`) on the right, which copies the text and announces "Copied" through `LiveRegion`.
- "Uses" and "Goes into" chips in one wrapping row, as in the List.
- Reader mode adds "Before you send it" (UI-P74 fills it): one row per paste-in and attachment.
- Footer, hairline above, 18 below the chips: ghost buttons "← {previous title}" and "{next title} →" (left out at either end), DM Mono 12 "Esc closes · ← → move between prompts", and "Done", the window's one primary, which closes it.
- Keys: Esc closes; ← and → move between steps, but not while the title field has focus. Opening puts focus on the text box; closing returns it to what opened the window.
- Phone: a full-screen sheet with the same parts in one column. The footer becomes a sticky bar, 48 tall buttons.
- Wire it to `onOpenPrompt` in the List (UI-P65) and Details (UI-P66).

**Tests.** Unit: ← and → at either end; the title field saves an empty title as the default. Tier-3: double-click opens the window, the title saves, Copy announces, Esc returns focus to the card.

**Done when.** The dev page matches `V4-PromptModal` by eye in both themes at 1440 and 390, and the RULES §4 checks pass.

**Commit.** `UI-P67: the full prompt window`''',
    ),
    Prompt(
        id='UI-P68',
        title='Map view',
        wave=2,
        needs='UI-P67',
        lead='The biggest prompt. It has a pure layout function, tested on its own, and a view that draws boxes with named inputs, curved lines and dimming. Drag connects; nothing moves a box. The build page reuses it read-only.',
        body=r'''# UI-P68 — Map view

Follow `design/RULES.md` (§3: hand-written SVG, no dependency) and `design/sandbox/CONCEPT.md` (§2, §5, §7, §8). Skills: neoscale-code-review, neoscale-performance, neoscale-e2e-testing. Boards: `V3-Map` first; `S2-Map` to `S4-Map` for one chat, several chats and an agent.

**Goal.** The Build panel's Map: the same build as the List, laid out by the rule, with each box's inputs named on its left edge and everything the selection doesn't touch dimmed.

**Read first.** `graph.ts`; `src/components/brand/Timeline.tsx` and `charts.tsx` (how this repo hand-writes SVG); the List from UI-P65; `useMinWidth.ts`.

**1. Layout,** pure, in `src/lib/build/mapLayout.ts`: `layoutMap(steps, groups, files, tools, results) → { lanes, columns, boxes, wires, width, height }`.
- Lanes, top to bottom: one per session in order of its first step; one per run of typed prompts ("Typed here"); last, a dashed "Files and tools" lane when the build has any.
- Columns: `column(step) = max(dateColumn(step), 1 + column(previous step in its lane), 1 + max(column(each step it uses)))`, where `dateColumn` is the index of the step's session date among the build's distinct dates (a typed prompt takes its neighbour's). The result goes one column after the step it comes from. A file or tool sits one column before its first user. For the bakery build this gives prompt 1 → 0, 2 → 1, 3 → 1, 4 → 2, 5 → 3, the result → 4, CLAUDE.md → 1.
- Sizes: lane label column 100; column 132 wide (156 for a box with three or more inputs), 48 between columns; a box's height is header 28, plus 22 per named input and a 16 state line when it has inputs, plus a 2-line body (34) and a 20 footer; a lane is its tallest box plus 8, with 12 between lanes; column headers (dates) take the top 24.
- Wires: from the output dot (right edge, the middle of the header) to the input dot (left edge, the middle of its input row): `M x1 y1 C (x1 + 0.6·dx) y1, (x2 − 0.6·dx) y2, (x2 − 6) y2`, with a 5px arrowhead. The next step in the same session joins at an input dot level with the header, unnamed. A loop back (DATA §3's "until") leaves the right edge, rises 36 above both boxes, runs left, and comes down into the input from the left.
- Inputs on a box are its `uses` in order, plus one dashed row per suggestion.

**2. View,** `BuildMap.tsx`, in the Build panel:
- Above the map, a key row (12.5 `--text2`): a 24px line sample, "goes into", DM Mono count; a dashed sample, "suggested", count; on the right, DM Mono 11.5 "click to select · double-click to read all of it · drag from a dot to connect".
- The map frame: radius 12, 1px `--hairline`, `--cell`, a dot grid drawn with a `radial-gradient` of `--hairline` every 16px, padding 16. When the map is bigger than its frame, the frame scrolls both ways. No zoom.
- Lanes on `--sel`, radius 12; the dashed lane has a 1px dashed `--line` border instead. Lane labels: "Session {n}" (12.5/600) over DM Mono 11 tool and model. Column headers: DM Mono 10.5 uppercase dates, `--text2`.
- A box: a real `<button>`, radius 12, 1px `--line`, `--solid`. Header 28: the DM Mono number (left out when the title is the default, which already holds it) and the title (12.5/600, ellipsis). Inputs: DM Mono 10.5 rows with a 9px dot on the left edge (ring `--text2`; filled `--text` when on the selected path; dashed when suggested). The state line, DM Mono 10 `--text2`: "{k} of {n} inputs accepted", or "{n} suggested". Body: 11.5/1.45 `--text2`, 2 lines. Footer: DM Mono 10 "{n} words". The result box has a 1px `--evidence` border. A file or tool box: DM Mono 10.5 "File" or "Tool" over the name (12.5/600).
- Wires in one SVG layer under the boxes: 1.5 `--text2`, dashed 4 4 for suggestions.
- Selecting: a click selects (Details shows it); the selected box gets a 2px `--text` ring. Every box and wire not directly joined to it drops to opacity 0.42, and the wires that are joined go to 1.75 `--text`. Esc clears. Under the map, 12.5 `--text2`: "Rows by session, left to right by date" and, on the right, "Prompt {n} selected · what it doesn't touch is dimmed · Esc clears".
- Double-click or Enter opens the full prompt window (UI-P67).
- Connecting: dragging from an output dot to a later box (or, for a loop, the box DATA §3 allows) calls `addUse` and draws the new input. While dragging, the line follows the pointer and an input under it highlights. A drop the rules refuse snaps back, with the reason in a `LiveRegion`. The keyboard way is Details › Add an input. Dragging a box itself does nothing (CONCEPT §2.8).
- Focus order: boxes lane by lane, left to right. Each box's accessible name: "Prompt {n}, {title}, {k} inputs".
- **The Sources rail.** In Map, the Sources column becomes 56 wide: a flat panel holding a column of 44-wide buttons — "Show sources" (`PanelLeftOpen`), sessions (`Layers` with a DM Mono count), files (`FileText` with a count), and "Add a source" (`Plus`), with hairlines between the groups. "Show sources" puts the full panel back over the map's left side until it is closed.
- The switch works both ways and keeps the selection.

**Phone.** No Map: the switch is not shown below 768.

**Tests.** `mapLayout.test.ts`: the bakery columns above; lanes in order; a typed lane between two sessions; a loop routed above; no two boxes overlap for the S3, S4 and S5 fixtures. Unit: dimming leaves exactly the joined boxes at full opacity. Tier-3: select a box and press Esc; drag from prompt 2's dot onto prompt 4 and see a new input.

**Done when.** The dev page matches `V3-Map` (and `S2-Map` to `S4-Map`) by eye in both themes; a 60-step fixture draws without a long task over 50 ms (measure in the Performance panel and report it); the RULES §4 checks pass.

**Commit.** `UI-P68: Map view — layout, named inputs, curved lines, dimming`''',
    ),
    Prompt(
        id='UI-P69',
        title='Agents and teams',
        wave=2,
        needs='UI-P68 and the migration applied',
        lead='The first prompt that needs the migration. It adds agents and teams from the Add menu to the opened map: a box holding other boxes, one level open at a time, with what it connects to outside kept in view and dimmed.',
        body=r'''# UI-P69 — Agents and teams

Follow `design/RULES.md` and `design/sandbox/CONCEPT.md` (§1, §2.2, §2.5, §3, §7, §8). Skills: neoscale-code-review, neoscale-e2e-testing. Boards: `V5-TeamMap` first; `S4-List`, `S4-Map` and `S5-List` for what V5 does not show. Where `S5-Map` (three Researcher boxes in a column) and `V5-TeamMap` (one stacked box) disagree, V5 wins (CONCEPT §10).

**Before you start.** Check that the UI-P61 Deploy queue item is applied: `getNodeType("team")` returns a row. If it does not, build everything for agents, show "A team of agents" disabled with the line "Teams need the Deploy queue item from UI-P61.", and report teams as not covered.

**Goal.** Agents and teams, from adding one to opening it: the Add dialog, their cards in the List, their box in the Map, and the map inside a box.

**Read first.** `graph.ts` (`addAgent`, `addTeam`, `addAgentPrompt`, `placeChildNode`, `setRuns`, `runsLabel`, `buildSteps`); `mapLayout.ts` and `BuildMap.tsx` (UI-P68); `BuildList.tsx` (its agent and team cards, UI-P65); `DetailsPanel.tsx` (UI-P66's agent rows); the `agent_config` schema in `20260823130000_node_type_registry_seed.sql`; `src/lib/models/registry.ts`.

**1. Adding.** Add › "Agent or team" opens a Radix dialog, 420 wide, on the Card's surface tokens:
- A real radio group: "One agent" / "A team of agents".
- Name, empty, its placeholder the default title ("Agent {n}" or "Team {n}", DATA §1). Empty saves as null.
- For an agent, Model, a menu from the registry.
- "Add", the dialog's one primary, and "Cancel".
- Adding calls `addAgent` or `addTeam` and selects the new step, so Details shows it. A new team is created holding one agent, so it is never empty. The menu item becomes enabled.

**2. In the List,** finishing UI-P65's cards:
- "Made in" in an agent or team header names the steps in its output uses ("made in prompts 1 and 2"); the phrase is left out when it has none. Its file and tool uses are the "Uses" chips.
- An agent card: n.1 "Instructions" shows `payload.system_prompt`; editing it from Details or the full prompt window writes `system_prompt` through `upsertNode`. Its child prompts follow as n.2 onward. A ghost "Add a prompt to this agent" opens a field like the List's add field, without the tool and model chips (the agent's model applies), and calls `addAgentPrompt`.
- A team card: its agents as inner cards, each headed "Agent · {title} · {model}" with its runs chip and its instructions clamped to 2 lines. A ghost "Add an agent to this team" calls `addAgent` with the team as parent, through `placeChildNode`. An inner agent with prompts of its own shows a text button, "Show its {n} prompts", that opens them in place; one is open at a time.

**3. In the Map** (`S4-Map`):
- A top-level agent or team gets its own lane, labelled "Agent {n}" or "Team {n}" over DM Mono "runs by itself".
- Its box spans two columns and is 112 tall: DM Mono "Agent {n}" with an extra-small secondary "Open" on the right, the title (13.5/600), DM Mono 11 "{p} prompts · {f} files · {t} tools" (zeros left out), and the runs label. Named inputs on its left edge and its output dot as on any box (UI-P68). `layoutMap` places it by the same column rule.
- Under the map, when one is present: "Open shows what is inside the agent" (or "the team").

**4. Opened** (`V5-TeamMap`). "Open", double-click on the box, or Enter on it opens it in the Build panel:
- Panel head: "Build › {title}", with "Build" a link back, and a secondary "Back to build" (`ArrowLeft`) beside Add.
- Key row: "goes into" and its count, "stacked box = runs several at once" when there is one, and DM Mono on the right "inside team {n} · Esc goes back to the build".
- A frame: radius 14, 1.5px dashed `--line`, padding 16, captioned top left "Inside team {n} · {title}" (DM Mono 11.5 uppercase) with the runs label as a chip beside it.
- Inside it, one lane, left to right by sub-number, by the same column rule (new `layoutOpened(container, steps, files, tools)` in `mapLayout.ts`). An agent's opened map holds its instructions and prompts; a team's holds its agents. The files and tools used inside sit in a band along the bottom of the frame, captioned "files and tools".
- A parallel agent is one box drawn stacked: two copies behind it, offset 5 and 10px down and right, at opacity 0.75 and 0.5, and DM Mono "× {count}" at the right of its header. An input fed by it reads "Output of {n} × {count}".
- A loop back from an "until" agent arrives as an input named "Sent back by {n}", and its wire carries a DM Mono 10.5 label, "sent back until {detail}".
- Outside the frame, on the right under the caption "Outside": every box this container uses or goes into, the result among them, at the dimmed opacity. Clicking one returns to the build with it selected.
- Under the map: "Left to right by order · boxes outside the frame are part of the build, not the team" and, on the right, "{title} selected".
- One level is open at a time. Opening an agent inside an opened team replaces the view, with the head reading "Build › {team} › {agent}". Esc, or "Back to build", goes up one level.
- Details for an agent inside a team adds "In: Team {n} · {title}". With "Runs once" chosen, its row reads "Runs once · each time work is sent to it".

**Phone.** The List cards and the Add dialog only (no Map, UI-P68). The dialog is a `BottomSheet`; the radio rows and the add buttons are 44 tall.

**Tests.** `mapLayout.test.ts`: the opened team for the S5 fixture (3.1 → 3.4 left to right, one stacked 3.2, the loop above, the result outside); an agent's big box spans two columns. Unit: "made in" names output uses only; "Show its {n} prompts" opens one agent at a time. Tier-3: add an agent, add a prompt to it, open it in the Map, press Esc; add a team, set an agent inside it to "Runs several at once" with 3, and see the stacked box.

**Done when.** The dev page matches `V5-TeamMap`, `S4-List`, `S4-Map` and `S5-List` by eye in both themes, at 1440 and (List only) 390, and the RULES §4 checks pass.

**Commit.** `UI-P69: agents and teams — add, list, map, opened view`''',
    ),
    Prompt(
        id='UI-P70',
        title='Manual step',
        wave=2,
        needs='UI-P69 and the migration applied',
        lead='Decision 2, option B: work done outside AI gets its own numbered box, with a tool and one line. It is never detected, so it always says it was added by the maker.',
        body=r'''# UI-P70 — Manual step

Follow `design/RULES.md` and `design/sandbox/CONCEPT.md` (§1, §2.2, §4, §7, §8). Skills: neoscale-code-review, neoscale-e2e-testing. Board: `D2-ManualStep`, option B. In the Map it is drawn like any box in `V3-Map`.

**Before you start.** `getNodeType("manual_step")` returns a row. If it does not, print "UI-P70 STOPPED: manual_step is not live; apply the UI-P61 Deploy queue item" and stop.

**Goal.** The maker can put a step done by hand, such as laying out copy in Figma or deploying in Lovable, between two prompts, so readers see every step in order.

**Read first.** `graph.ts` (`addManualStep`, `addUse`, `buildSteps`); DATA §2 (its payload and limits); `BuildList.tsx`, `BuildMap.tsx`, `mapLayout.ts`, `DetailsPanel.tsx`; `media.ts` (the picture); `making.ts` (`toolLabel`, for the known tools).

**Adding.** Add › Manual step opens a Radix dialog, 420 wide, on the Card's surface tokens:
- Tool: a menu of the tools `toolLabel` knows plus "Figma", "Lovable", "Vercel", then "Other…", which turns it into a text field (at most 40).
- What was done: one line, at most 140, with a DM Mono counter.
- Picture, optional: one, through the existing media path. On the card it is counted as "1 screenshot".
- "Add", the one primary, and "Cancel".
- It goes after the selected step, or at the end when nothing is selected: `addManualStep` places it last, then the List's existing move puts it in place. The menu item becomes enabled.

**In the List** (D2 option B):
- The card is a step card on `--cell` with a 1px `--text2` border, so it reads as different without a new colour.
- Header: the number badge, then DM Mono 12 "Manual step · {tool} · added by maker" over the title (the default "Manual step {n}" in `--text2`).
- Body: the line, unclamped. Footer: "Uses" chips like any step, and DM Mono "1 screenshot" with a 32px thumbnail when it has a picture.
- Its menu: Rename, Move up, Move down, Remove. No "Read all of it": there is no more to read.

**In the Map.** A box like any other, with its number, its inputs and its output dot, on `--cell` with the 1px `--text2` border. The header line is DM Mono "By hand · {tool}" and the body is the line. In `layoutMap`, manual steps take a "By hand" lane, one per run, the way typed prompts take "Typed here". A later step can use its output like any step's.

**In Details.** The eyebrow "Manual step {n}", the title with Rename, Tool, What was done (both editable, with their limits), Picture (add, replace, remove), DM Mono "Added by you · never detected", then "Uses", "Add an input" and "Goes into" as for a prompt.

**Never** detected, suggested or created by anything but the maker (CONCEPT §4). It has no model and no text to copy.

**Phone.** The List card and the dialog as a `BottomSheet`, with fields 44 tall.

**Tests.** Unit: numbering with a manual step between two prompts (it takes the next number and the prompts after it shift); the limits; the "By hand" lane. Tier-3: add a manual step after prompt 3 with Figma and a picture, then make prompt 4 use its output.

**Done when.** The dev page matches D2 option B in the List, and a manual step draws in the Map like `V3-Map`'s boxes, in both themes; the Add menu holds exactly 7 items, all enabled; the RULES §4 checks pass.

**Commit.** `UI-P70: manual step — work done outside AI as its own step`''',
    ),
    Prompt(
        id='UI-P71',
        title='Detection, and the parser proposal',
        wave=2,
        needs='UI-P70',
        lead='What can be detected today is small: a file named word for word in a prompt. Everything else needs the transcript parser, which CONTRACT §4 locks, so this prompt ships the small part and writes the rest down for the owner.',
        body=r'''# UI-P71 — Detection, and the parser proposal

Follow `design/RULES.md`, `design/sandbox/CONCEPT.md` (§2.6, §4) and `docs/reconciliation/CONTRACT.md` (§4 the connector lock, §9 errors and privacy). Skills: neoscale-code-review, neoscale-error-monitoring (identifiers only, user text never in errors). Boards: `V2-List` and `V3-Map` (the dashed suggestions).

**Goal.** Suggestions from exact facts only, shown dashed until the maker accepts them, and a written proposal for the parser change that would let the composer detect more. No locked file changes.

**Read first.** CONTRACT §4, then, read only: `src/lib/build/intake.ts` (`ProposedEvent`: today a turn carries its prompt `text` and a `response_summary`, never the full reply) and `supabase/functions/parse-transcript/`. Then `sessions.ts` (`getSessionPrompts`), `graph.ts` (`addUse`, `dismissSuggestion`), and the `suggestions` prop UI-P65 left empty.

**1. Now,** pure, in `src/lib/build/suggest.ts`:
- `Suggestion = { stepId, use: Use, reason }`. `reason` is shown as written: "named in the prompt" today; "{n} words match", "attached in session {n}" and "called in session {n}" later.
- `suggestUses(steps, files)`: for each prompt, each file of the build whose name appears in the prompt text as a whole word (case-insensitive, bounded by a character that cannot be part of a file name), offered as a `file` use.
- Never offered: a use the step already has, a key in its `dismissed`, or a use DATA §3 refuses.
- Wire it into the List chips, the dashed Map inputs and their counts, and Details. Accept calls `addUse`; Dismiss calls `dismissSuggestion`.
- A seam for later: `suggestFromProposal(proposal, steps)` returns `[]` until the fields below exist, so the parser change needs no interface work.

**2. Later,** as a proposal only. Write `design/sandbox/DETECTION-PROPOSAL.md` for the RC series that owns the parser:
- What `parse-transcript` would add to each proposed event, from structured records in the transcript, never from prose: `attachments: { name, bytes? }[]`; `tool_calls: { service, actions: string[] }[]`; `agents: { name?, count }[]`, where `count` is how many were started at once.
- For outputs moved between sessions: `reply_shingles: string[]` on each turn, the first 12 hex characters of the SHA-256 of every 20-word window of the reply, after collapsing whitespace and lowercasing. The reply text is never stored. The composer hashes the windows of each later prompt the same way, through SubtleCrypto, and a run of matching windows becomes the suggestion "Output of {n} · {title} · {words} words match".
- Why it is safe: what is stored, that hashes of 20-word windows do not hold the reply, how it passes `_shared/redact` first, the size per turn, and that nothing is backfilled for old imports.
- What the client would do with each field, which suggestion it makes, and the tests it would need.
- The order: parser first, then a short follow-up prompt that fills `suggestFromProposal`.
- Add one line for the owner to `docs/reconciliation/HANDOVER.md`, under the open decisions if it has such a list, otherwise at the end: "Parser proposal for the composer's detection: design/sandbox/DETECTION-PROPOSAL.md (UI-P71)."

**Never** guess a link from the meaning of a prompt, name anything for the maker, or show a suggestion to a reader (CONCEPT §2.6, §4).

**Tests.** `suggest.test.ts`: "Follow CLAUDE.md." suggests CLAUDE.md; "claude.md" does too; "CLAUDE.mdx" and "myCLAUDE.md" do not; an accepted or dismissed one is not offered again; a file name in an agent's instructions is offered on the agent. Tier-3: accept a suggestion in the List and see it solid in the Map; dismiss one and reload.

**Done when.** Suggestions show and behave as on the boards, the proposal exists, the locked files are unchanged (`git diff --stat` on the §4 list is empty, and say so), and the RULES §4 checks pass.

**Commit.** `UI-P71: suggestions from file names, and the parser proposal`''',
    ),
    Prompt(
        id='UI-P72',
        title='Steps for readers, What you need, Copy for AI',
        wave=3,
        needs='UI-P71',
        lead="The build page's data, with no interface: every step turned into what a reader does with it, the column of what they need, and the text Copy for AI puts on the clipboard. Readers can't read `import_sessions`, so everything here comes from the build's own rows and `builds.making`.",
        body=r'''# UI-P72 — Steps for readers, What you need, Copy for AI

Follow `design/RULES.md` (§3, §8) and `design/sandbox/CONCEPT.md` (§6, §8) and DATA §5. Skills: neoscale-code-review. Boards: `B0-Translation` (the table is the spec), `B1-PageList`, `B3-PageTeam`, `B4-PageOne`. No interface in this prompt.

**Goal.** Pure functions that turn a published build into the steps a reader follows, what they need to follow them, and one text that repeats the whole build in another AI.

**Read first.** `graph.ts` (`buildSteps`, `sessionGroups`, `stepTitle`, `usesOf`, `runsLabel`, `wordCount`); `making.ts` (`Making`, `MakingSession`, `toolLabel`); `src/lib/models/registry.ts` (`modelLabel`); `src/pages/site/build/buildModel.ts` (`shortDate`, `needsLine`, `PREREQUISITE_TYPE`, `partsInOrder`); `src/lib/build/portable.ts` (`toPortable`, `toMarkdown`) and `src/components/build/PortableExport.tsx` (how Copy for AI copies today).

**Build** `src/lib/build/readerSteps.ts`, exported through `index.ts`:
- `readerSteps(tree, making)` → `ReaderStep[]`, in step order. Each holds the `Step` and what the reader does:
  - `chat`: on a session's first step, `{ kind: "new", tool, model, session, date }`, read as "New chat in {tool}" over "{model} · session {n} · {d MMM}"; on a later step in it, `{ kind: "same", step }`, read as "Send in the same chat as step {n}". A typed prompt is a new chat in its own `payload.tool`, with "model not recorded · typed in by the maker" when it has no model.
  - `pasteIns`: one per output use, "what step {n} gave you" with the step's title and its number for the link.
  - `attach`: one per file use, "Attach {name}", with the file's size and its download from the existing media path.
  - `tools`: one per tool use.
  - Inside an agent or a team, the same uses read as "Uses": "what 3.1 gives it", "what 3.2 gives it × 3", "what 3.4 sends back", "{tool name} · tool", "{file name}". Never "Paste in" (CONCEPT §6).
  - A manual step: "By hand in {tool}", its line and its picture. Nothing to copy.
  - A team or an agent also carries its runs label, "made in steps {a} and {b}" from its output uses, and the line "runs by itself · last run {d MMM, HH:mm}" when its session's date is known.
  - `goesInto` for the last agent of a loop: "3.3, until {detail}", then "then the result" when it feeds the result.
- `whatYouNeed(steps, tree, making)` → the groups, each left out when empty:
  - **Tools and models**: one row per tool, "{tool}" over "{model} · {steps}"; one row per model inside agents ("agents 3.2 and 3.4"); one per tool node ("tool · agent 3.2"); and each `PREREQUISITE_TYPE` part, with the steps that use it when any do. Step lists are written "step 1", "steps 4–5", "steps 1, 3 and 5", "agent 3.1", "agents 3.2 and 3.4".
  - **Files**: name, "{steps} · {size}", and its download.
  - **How it runs**: for a build with agents or a team, the runs label in plain words ("On a schedule" over "Mondays 07:00 · {n} agents a run").
  - **Time**: "{n} sessions over {d} days" over "{first}–{last}", from the session dates. Left out when there is one session or no dates.
  - **Other parts**: every top-level part that is not a step, file, tool, result or prerequisite (a `system_prompt`, any other registered type), by title, so nothing a build has today goes missing from the page.
- `stepsMarkdown(build, readerSteps)`: the Copy for AI text. The title and the one-line summary; "Repeat this build in {n} steps."; then each step as `## Step {n} · {title}`, its chat line ("New chat in Claude (Opus 5.5)." or "Send in the same chat as step 4."), its paste-ins and attachments as sentences ("Paste in what step 2 gave you (Homepage copy).", "Attach CLAUDE.md: {download link}."), then the text in a fenced block. An agent or a team is a `## Step {n}` with its runs and one `### {n.k} {title} · {model}` per sub-step with its uses and its fenced text. A manual step is "By hand in {tool}: {line}". It ends with `## Result` and the link or file name.
- `buildCounts(steps)` for the page heading: "{s} sessions · {t} teams · {a} agents · {p} prompts · {f} files · {first}–{last}", zeros left out, "1 prompt" for one.
- Readers never see a suggestion: nothing here reads `dismissed` or calls `suggest.ts`.
- Download stays exactly as it is: `toPortable` and `toMarkdown` are not changed by this prompt.

**Tests.** `readerSteps.test.ts` on the B1 bakery fixture: step 1 "New chat in ChatGPT", step 2 pastes in step 1, step 4 pastes in 2 and 3 and attaches CLAUDE.md, step 5 "Send in the same chat as step 4"; the B3 team ("Uses", never "Paste in"; "× 3"; "3.3, until every claim has a source"); the B4 typed prompt ("model not recorded · typed in by the maker"); a manual step; an old build with no `id` in `making.sessions` still groups by `source_ref.import_session_id`. `whatYouNeed`: the B1 and B3 columns row for row, and a build with a `system_prompt` part lists it under Other parts. `stepsMarkdown`: a snapshot for B1 and B3, and every text appears whole.

**Done when.** The RULES §4 checks pass and no interface file changed.

**Commit.** `UI-P72: reader steps, What you need, Copy for AI text`''',
    ),
    Prompt(
        id='UI-P73',
        title='The build, What you need and the tabs',
        wave=3,
        needs='UI-P72',
        lead="The build page's second row, rebuilt behind `BUILD_PAGE_STEPS_ENABLED`: one section, The build, in place of Anatomy, Run it yourself, the part viewer and the timeline, with What you need in the timeline's column. The first screen above it does not change.",
        body=r'''# UI-P73 — The build, What you need and the tabs

Follow `design/RULES.md` (§3, §4, §7) and `design/sandbox/CONCEPT.md` (§6, §7, §8). Skills: neoscale-code-review, neoscale-performance, neoscale-e2e-testing, buildgallery-theme. Boards: `B1-PageList` first; `B3-PageTeam` and `B4-PageOne`; `B0-Translation` for what changes and what stays. The boards draw the tab strip without Watch it get built and Understand it; CONCEPT §6 keeps both, and CONCEPT wins.

**Goal.** The steps a reader can repeat, on the build page, from the first screen they scroll to. With the switch off the page is exactly as before.

**Read first.** `src/pages/site/build/BuildView.tsx` (its header comment, the second grid row, the anatomy dialog), `BuildPage.tsx` (the tab state, `onTabChange`, the `#node-` hash, the tab bodies), `buildModel.ts` (`BuildTabKey`, `BUILD_TABS`, `buildTabs`, `tabLayer`), `src/components/build/BuildTabs.tsx`, `PortableExport.tsx`; `readerSteps.ts` (UI-P72); `FullPromptWindow.tsx` (UI-P67); `src/lib/build/flags.ts`; `src/dev/fixtures/` (the build page's sample).

**When it applies.** Only when `BUILD_PAGE_STEPS_ENABLED` is on and the build has at least one step (DATA §1). A build with no steps keeps today's page exactly: its anatomy, part viewer, timeline and six tabs.

**The tabs** (CONCEPT §6): The build, Watch it get built, Understand it, Where it broke, Rebuilds. Each keeps BuildTabs' own rule for when it shows or is disabled. The keys stay as they are, so links keep working: `anatomy` is The build, and anything that sets `run` lands on `anatomy`. Watch it get built, Understand it, Where it broke and Rebuilds keep their bodies.

**Desktop** (`B1-PageList`). The second row becomes `minmax(0, 1fr) 320px`, gap 12:
- **Left, The build** (a `Panel`). The tab strip, then a head row: the List and Map `Segmented` (shown under CONCEPT §5's rule: two sessions or an agent; the Map body is UI-P74), DM Mono 12 `buildCounts`, and on the right DM Mono 11.5 `--text2` "copy each step into the chat it names", or, for a build with a team or an agent, "steps {a}–{b} set it up · the team then runs by itself".
- **Chat heads.** Above a session's first step, on one line: a 7px dot, "New chat in {tool}" (15/600), DM Mono 12 "{model} · session {n} · {d MMM}", and a hairline filling the rest.
- **A step card** (radius 14, 1px `--line`, `--solid`, 8 apart): the number badge, the title (17/600; a default title in `--text2`, as it is), and a secondary 30 "Copy" on the right, which copies the text and announces "Copied". The text at 15/1.55, clamped to 4 lines, then "Read all of it" (opens `FullPromptWindow` in reader mode) and DM Mono "{n} words". Under it, "Paste in" (DM Mono 12) and one chip per paste-in, "what step {n} gave you · {title}": a link that scrolls to that step and rings it for 1.2s (no ring animation under reduced motion). Then "attach {name}" with an extra-small "Download". A later step in the same chat ends with DM Mono "Send in the same chat as step {n}" under its text.
- **A team or an agent** (`B3-PageTeam`). A divider, "The team these made" (or "The agent these made") with DM Mono "runs by itself · last run {date}". Its card: number badge, title, the runs chip, and a secondary "Copy the team" (or "Copy the agent"); DM Mono "Team · {n} agents, in this order · made in steps {a} and {b}". Its sub-steps as inner cards (`--cell`, 1px `--hairline`, radius 12): "3.1", the title, the model, the runs chip when not once, the text, "Uses" chips, and, on the last agent of a loop, "Goes into" "3.3, until {detail}" and "then the result". Under the inner cards, a secondary "See the team in Map" with DM Mono "shows who passes work to whom" (UI-P74 makes it work; until then it is left out).
- **A manual step.** The card on `--cell` with the 1px `--text2` border, DM Mono "By hand in {tool}", the line, and its picture. No Copy.
- **The result.** The last card: a check badge on `--evidence-fill`, DM Mono "Result", the link or file name (17/600), DM Mono "{what it holds} · from step {n}", and its pictures through the existing `MediaFigure`.
- **Right, What you need** (a `Panel`): "What you need" (17/600) over DM Mono "to repeat this build", then UI-P72's groups, each headed DM Mono 11 uppercase, rows as key and value with a hairline above. Files carry an extra-small "Download". Other parts open their existing body (`NodeBody`) in the build page's existing dialog. At the bottom, DM Mono 12 `--text2`: "Copy for AI copies all {n} steps in order, with each new chat and paste-in written out." For a one-prompt build (`B4-PageOne`): "One prompt, so there is no map. Map appears once a build has two sessions or an agent."
- The `#node-{id}` hash scrolls to that step's card and rings it, as it selects a part today. A part that is not a step scrolls to its row in What you need.
- **Copy for AI** in the action dock copies `stepsMarkdown` when the switch is on and the build has steps. Download is unchanged.
- **Budgets:** one filled button on the page, still "I ran this and it worked"; Copy, Download and Read all of it are secondary or links; at most 6 rows per What you need group, then "Show {n} more"; at most 5 tabs.

**Phone** (below 768): the first screen as today, then the tabs as a sideways row, The build in one column (List only), then What you need under it. Copy buttons and paste-in chips 44 tall.

**Dev page.** Register `/dev/kit/pages/build-steps` rendering `BuildView` with the B1, B3 and B4 fixtures and the switch on, whatever the flag says.

**Tests.** `BuildView.test.tsx`: with the switch off nothing changes (the existing tests pass untouched); with it on, the B1 fixture shows 5 step cards, 4 chat heads, the paste-in chips and the CLAUDE.md download; the tab strip starts with The build, holds at most 5 tabs, and has no Anatomy or Run it yourself; a build with no steps renders the old anatomy. Unit: setting `run` lands on The build. Tier-3: a paste-in chip scrolls to its step; Copy announces; Read all of it opens the window and Esc returns focus; `#node-` scrolls to the step.

**Done when.** The dev page matches `B1-PageList`, `B3-PageTeam` and `B4-PageOne` from the tabs down by eye in both themes at 1440 and 390; the first screen is pixel-identical to before (compare its screenshots); the RULES §4 checks pass.

**Commit.** `UI-P73: the build page — The build, What you need, tabs, behind BUILD_PAGE_STEPS_ENABLED`''',
    ),
    Prompt(
        id='UI-P74',
        title='The map, read-only',
        wave=3,
        needs='UI-P73',
        lead='The composer\'s Map on the build page, with nothing to drag: clicking a box opens its full text on the right, with Copy and what to paste in before sending it. The same panel fills the full prompt window\'s "Before you send it".',
        body=r'''# UI-P74 — The map, read-only

Follow `design/RULES.md` and `design/sandbox/CONCEPT.md` (§2.5, §6, §7, §8). Skills: neoscale-code-review, neoscale-performance, neoscale-e2e-testing. Boards: `B2-PageMap` first; `B3-PageTeam` ("See the team in Map") with `V5-TeamMap` for the opened team.

**Goal.** The Map switch on the build page: the same layout as the composer, read-only, with a reading panel that tells the reader exactly what to do with the step they picked.

**Read first.** `BuildMap.tsx` and `mapLayout.ts` (UI-P68, UI-P69), `FullPromptWindow.tsx` (UI-P67), `readerSteps.ts` (UI-P72), the build page section (UI-P73).

**1. Read-only Map.** `BuildMap` takes `mode: "maker" | "reader"`. Reader mode draws no dashed inputs and no suggested counts, has no drag to connect, no Add and no menu, and its state line is left out. It is passed `readerSteps`, never `suggest.ts`. It is `React.lazy`, loaded only when a reader chooses Map.

**2. The Map body** (`B2-PageMap`), in The build when the switch is on Map. A grid `minmax(0, 1fr) 340px`, gap 12:
- Left: the head row from UI-P73 with DM Mono "click a box to read it · Esc clears" on the right, the map frame, and under it "Rows by session, left to right by date" with, on the right, "Step {n} open · what it doesn't touch is dimmed".
- Right, the reading panel (`--flat`, radius 14, padding 18), empty until a box is clicked, with the line "Click a box to read its full prompt.":
  - DM Mono 11.5 uppercase "Step {n} of {N}", the title in `display(24)`.
  - Chips: "New chat in {tool}" (or "same chat as step {n}"), "{model}", "{d MMM}".
  - The full text on `--recess`, radius 12, scrolling at most 420 tall, with "{n} words" and a secondary "Copy".
  - **Before you send it** (new `BeforeYouSend.tsx`): one row per paste-in, `ArrowLeft` 14, "Paste what step {n} gave you" (600) over DM Mono "{title} · {tool}", and on the right a link "Step {n}" that selects that box; one row per attachment, "Attach {name}" over DM Mono "File · {size}", with Download; inside an agent or a team the rows read "Uses". Left out when the step has none.
  - **Then**: "Step {n+1} · {title}" over DM Mono "same chat" or "new chat", and a ghost "Next" that selects it.
- Clicking a box selects it, dims the rest (UI-P68) and fills the panel. Esc clears. Double-click opens the full prompt window. Keyboard: Tab through the boxes, Enter selects.
- An agent or a team box has "Open": its map opens in place with "Back to build" (UI-P69), read-only.

**3. "See the team in Map"** (UI-P73's button now shows): it switches The build to Map with that team opened and its first agent selected.

**4. The full prompt window in reader mode** now shows `BeforeYouSend` under the text.

**Phone.** No Map: below 768 the switch is not shown and "See the team in Map" is left out; the List already shows the team in order.

**Tests.** Unit: reader mode draws no dashed input even when the tree would give a suggestion; `BeforeYouSend` rows for B1 step 4 (two paste-ins and CLAUDE.md) and for B3 agent 3.3 ("Uses"). Tier-3: switch to Map, click step 4, see the panel, press Next, press Esc; "See the team in Map" on the B3 fixture opens the team; the Map chunk is not requested until Map is chosen (check the network panel in the spec).

**Done when.** The dev page matches `B2-PageMap` by eye in both themes at 1440, the opened team matches `V5-TeamMap` without its editing parts, the List view is unchanged, and the RULES §4 checks pass.

**Commit.** `UI-P74: the build page map, read-only, with Before you send it`''',
    ),
    Prompt(
        id='UI-P75',
        title='States, phones, accessibility, budget tests',
        wave=4,
        needs='UI-P74',
        lead="No new features. It goes over everything UI-P63 to UI-P74 built: loading, empty and error states, old builds, forks, every width, keyboard and screen reader, and one test file that holds the budgets so a later prompt can't quietly break them.",
        body=r'''# UI-P75 — States, phones, accessibility, budget tests

Follow `design/RULES.md` (§4 all of it) and `design/sandbox/CONCEPT.md` (§7, §9). Skills: neoscale-code-review, neoscale-e2e-testing, neoscale-error-monitoring, hicks-law, responsive-design, color-system, aesthetic-usability. Boards: all of them, at every width they draw.

**Goal.** Make the sandbox composer and the new build section finished: every state designed, every width working, every control reachable, and the budgets held by tests.

**Read first.** Everything UI-P63 to UI-P74 added; `src/components/brand/EmptyState.tsx`, `ErrorState.tsx`, `LiveRegion.tsx`; `src/lib/build/fork.ts` (`rewritePayload`) and `rebuild.ts` (`changeSet`, `matchNodes`); the existing `*.budget.test.tsx` files.

**1. States.**
- Loading: each composer panel and The build show the existing skeleton pattern at their final size, so nothing jumps.
- Empty: the S1 lines in Sources; the Build panel with nothing in it shows the add field alone with "Paste or type a prompt…"; Details as in UI-P63.
- Error: a failed read shows `ErrorState` in that panel only. A failed write puts the status line to "Couldn't save · Try again", with Try again as a text button, and puts the change back. Errors carry identifiers only (CONTRACT §9).
- Saving: every write is optimistic and the status line shows "saving…" then "saved just now", as `saveState` does today.

**2. Old builds and forks.**
- A build made before this series (no titles, no `uses`, no `id` on `making.sessions`) opens in the composer and on the build page without a write, with default titles and its sessions grouped as UI-P72 does.
- A build with parts the sandbox does not draw (a top-level `system_prompt`, any narrative type) keeps them: in the composer they are listed in Details when selected from Sources, and on the build page under What you need › Other parts. Nothing is dropped on save.
- A fork: `rewritePayload` already rewrites any string that is a copied node's id, so `uses[].node_id` points at the copies; add a test that proves it for a prompt, an agent and a manual step. `dismissed` keys ("file:{id}") are not rewritten, so a fork may offer a dismissed suggestion again; say so in the report and change nothing.
- A rebuild: `changeSet` lists a changed title and a changed `uses` as changes; check the lines read sensibly and report them.

**3. Widths.** 390, 768, 1024 and 1440, both themes, for `/dev/kit/pages/sandbox` and `/dev/kit/pages/build-steps`. At 1024 the composer's grid becomes `220px minmax(0, 1fr) 260px`; below 900, Details moves under the Build panel; below 768, the phone layout of UI-P63. No horizontal scroll on the page at any width (the Map frame scrolls inside itself). Touch targets 44 on a coarse pointer.

**4. Keyboard and screen reader.**
- Every action on the boards can be done without a mouse: add, rename, move, remove, select, open, connect (Details › Add an input), switch List and Map, open and leave a team.
- Focus is always visible, never lost after a dialog or a removal (it moves to the next card, else the previous, else the add field).
- Announcements through `LiveRegion`: "Copied", "Prompt {n} added", "Prompt {n} removed", "Moved to {n}", "Input added", "Map is now available".
- Map boxes have their names (UI-P68); wires are `aria-hidden`; the List is the accessible reading of the Map, and the Map says so in a visually hidden line.
- Measure the dimmed boxes (opacity 0.42) in both themes: their text must stay at least 3:1 against the frame. If it does not, raise the opacity to the lowest value that passes, use it everywhere, and report the number.
- Reduced motion: no ring or dimming transitions.

**5. Budgets** in one file, `src/pages/site/compose/sandbox.budget.test.tsx` (and a build page twin): one filled button per view (Publish; Done in the window; "I ran this and it worked" on the page); the Add menu holds exactly 7 items in CONCEPT §5's order; How it runs exactly 5; no list shows more than 6 rows before "Show {n} more"; no item shows more than 3 actions; no menu holds more than 7; at most 5 build page tabs; and no word from CONCEPT §9's never list in any rendered text of either dev page.

**6. Performance.** Report against the neoscale-performance baseline: the composer route's chunk, the build page's main chunk (it must not grow by more than the steps section; the Map and the window stay lazy), and the 60-step fixture's longest task in List and in Map.

**Done when.** Every item above is done or reported as not possible with the reason; the RULES §4 checks pass; screenshots at the four widths in both themes are attached to the report.

**Commit.** `UI-P75: sandbox states, widths, accessibility and budgets`''',
    ),
    Prompt(
        id='UI-P76',
        title='Switch it on',
        wave=4,
        needs='UI-P75',
        lead='The only prompt visitors notice. It checks that everything before it passed and the migration is live, turns both switches on, runs one end-to-end pass, and leaves the old composer and anatomy in place so turning back is a one-line change.',
        body=r'''# UI-P76 — Switch it on

Follow `design/RULES.md`, `design/sandbox/CONCEPT.md` and `docs/reconciliation/CONTRACT.md` (§1: nothing deploys from here). Skills: neoscale-code-review, neoscale-e2e-testing, neoscale-performance.

**Goal.** The sandbox composer and the new build section are what makers and readers get.

**Before you start.** Stop with "UI-P76 STOPPED: {what}" if any of these is not so:
- UI-P60 to UI-P75 are committed and each report ended on PASS (read the commits and `design/prompts/00-INDEX.md`).
- The UI-P61 Deploy queue item is marked applied in `docs/reconciliation/HANDOVER.md`, and `getNodeType("team")` and `getNodeType("manual_step")` both return rows against the live project.
- `npm test`, `npm run build` and the tier-3 specs pass on the current commit.

**Steps.**
1. In `src/lib/build/flags.ts`, set `SANDBOX_COMPOSER_ENABLED` and `BUILD_PAGE_STEPS_ENABLED` to `true`. Keep the comments; add the date.
2. Delete nothing. The old `ComposePage` and the anatomy, part viewer and timeline stay reachable by the switches, and still serve builds with no steps. Their removal is a later prompt; list what it would remove in the report.
3. Run one end-to-end pass against the faked backend, in a new tier-3 spec `sandbox.flow.spec.ts`, at 1440 and 390:
   - Start a new build; add a session from Not in a build; title prompt 2 in the full prompt window; drop a file and accept its suggestion; switch to Map and connect prompt 2 into prompt 4 (1440 only); add an agent with a prompt and set it to run on a schedule; add a manual step; add a result; open the Card from the status line and add a cover; Publish.
   - Open the published build: the steps in order with their chat heads and paste-ins; Copy on a step; Copy for AI holds every step's text; Map shows the same build (1440 only); `#node-{id}` scrolls to a step; an old-style link that set the Run tab lands on The build.
   - Open a build from before this series: it renders with default titles and nothing is written.
4. Add UI-P60 to UI-P76 to `design/prompts/00-INDEX.md` in its format, if they are not there.
5. Add to the Deploy queue in `docs/reconciliation/HANDOVER.md`: "Publish the UI-P76 commit. To turn back, set both switches in src/lib/build/flags.ts to false; no data changes either way."

**Done when.** Both switches are on, the flow spec passes at both widths, nothing outside `flags.ts`, the new spec, the index and the handover changed, and the RULES §4 checks pass.

**Commit.** `UI-P76: switch on the sandbox composer and the build page steps`

**Report** adds one line: "Owner: publish this commit in Lovable; the switches turn it back."''',
    ),
)

FOLLOW_UPS = 'After UI-P76, the follow-ups are the parser change in `design/sandbox/DETECTION-PROPOSAL.md` (an RC prompt, once the connector lock lifts) and a short prompt that removes the old composer and anatomy once the new ones have run for a while.'


# --- finding a prompt ---------------------------------------------------------


def find(key: str) -> Prompt:
    """UI-P69, ui-p69, P69, p69 and 69 all find UI-P69."""
    match = re.fullmatch(r"(?:ui-?)?p?(\d{2})", key.strip().lower())
    if match:
        wanted = f"UI-P{match.group(1)}"
        for prompt in PROMPTS:
            if prompt.id == wanted:
                return prompt
    raise SystemExit(f"There is no prompt {key!r} here. This file holds {PROMPTS[0].id} to {PROMPTS[-1].id}.")


def needs_migration(prompt: Prompt) -> bool:
    return "migration" in prompt.needs


# --- list ---------------------------------------------------------------------


def cmd_list(_args: argparse.Namespace) -> int:
    print(f"{len(PROMPTS)} prompts, one per Claude Code session, in this order.\n")
    for wave, name in WAVES.items():
        print(f"Wave {wave} · {name}")
        for prompt in PROMPTS:
            if prompt.wave == wave:
                print(f"  {prompt.id}  {prompt.title}")
                print(f"          needs first: {prompt.needs}")
        print()
    print("Decisions this series assumes")
    for name, chosen, otherwise in DECISIONS:
        print(f"  {name}: {chosen}")
        print(f"          if you choose otherwise: {otherwise}")
    print()
    print(FOLLOW_UPS)
    return 0


# --- show ---------------------------------------------------------------------


def cmd_show(args: argparse.Namespace) -> int:
    prompt = find(args.prompt)
    if args.about:
        print(f"{prompt.id} — {prompt.title}")
        print(f"Wave {prompt.wave} · {WAVES[prompt.wave]} · needs first: {prompt.needs}\n")
        print(prompt.lead)
        return 0
    if needs_migration(prompt):
        print(f"{prompt.id} needs the UI-P61 migration applied in Lovable first.\n", file=sys.stderr)
    sys.stdout.write(prompt.body.rstrip("\n") + "\n")
    return 0


# --- next ---------------------------------------------------------------------


def committed_ids(repo: Path) -> set[str] | None:
    """The prompt ids with a commit on the current branch, from subjects like 'UI-P60: …'."""
    try:
        log = subprocess.run(
            ["git", "-C", str(repo), "log", "--format=%s"],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    return {match.group(1) for match in re.finditer(r"^(UI-P\d+)[a-z]?:", log, re.M)}


def cmd_next(args: argparse.Namespace) -> int:
    done = committed_ids(Path(args.repo))
    if done is None:
        raise SystemExit("next reads git log, so run it inside the repo or pass the repo's path.")
    for prompt in PROMPTS:
        if prompt.id in done:
            continue
        print(f"Next: {prompt.id} — {prompt.title} (needs first: {prompt.needs})", file=sys.stderr)
        if needs_migration(prompt):
            print("It needs the UI-P61 migration applied in Lovable first.", file=sys.stderr)
        print(file=sys.stderr)
        sys.stdout.write(prompt.body.rstrip("\n") + "\n")
        return 0
    print(f"Every prompt from {PROMPTS[0].id} to {PROMPTS[-1].id} has a commit on this branch.\n", file=sys.stderr)
    print(FOLLOW_UPS, file=sys.stderr)
    return 0


# --- write --------------------------------------------------------------------

RULES_HEADING = "## Rules of the road"


def index_section() -> str:
    lines = [
        f"{PROMPTS[0].id} to {PROMPTS[-1].id} build the composer sandbox and the build page. "
        "Send the UI-P61 migration to Lovable before UI-P69; nothing changes for visitors until UI-P76.",
        "",
    ]
    for wave, name in WAVES.items():
        lines += [f"### Sandbox wave {wave} — {name}", ""]
        lines += [f"- **[{p.id}]({p.filename})** — {p.title}" for p in PROMPTS if p.wave == wave]
        lines.append("")
    return "\n".join(lines) + "\n"


def all_prompts_section() -> str:
    chunks = []
    for prompt in PROMPTS:
        first, _, rest = prompt.body.partition("\n")
        chunks.append(f"## {first.lstrip('# ').strip()}\n{rest.rstrip()}\n\n---\n")
    return "\n".join(chunks)


def read(path: Path) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def save(path: Path, text: str, dry_run: bool) -> None:
    if dry_run:
        return
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def cmd_write(args: argparse.Namespace) -> int:
    folder = Path(args.repo) / "design" / "prompts"
    index = folder / "00-INDEX.md"
    if not index.is_file():
        raise SystemExit(f"{index} is not there. Run this from the repo root, or pass the repo's path.")
    verb = "Would" if args.dry_run else "Did"
    changed: list[str] = []
    kept: list[str] = []

    for prompt in PROMPTS:
        path = folder / prompt.filename
        text = prompt.body.rstrip("\n") + "\n"
        if path.exists():
            if read(path) == text:
                continue
            if not args.force:
                kept.append(prompt.filename)
                continue
        save(path, text, args.dry_run)
        changed.append(prompt.filename)

    index_text = read(index)
    if f"({PROMPTS[0].filename})" not in index_text:
        section = index_section()
        at = index_text.find(RULES_HEADING)
        index_text = (
            index_text[:at] + section + index_text[at:] if at >= 0
            else index_text.rstrip("\n") + "\n\n" + section
        )
        save(index, index_text, args.dry_run)
        changed.append("00-INDEX.md (a section for the series)")

    every = folder / "ALL-PROMPTS.md"
    if every.is_file():
        every_text = read(every)
        if f"## {PROMPTS[0].id} —" not in every_text:
            save(every, every_text.rstrip("\n") + "\n\n" + all_prompts_section(), args.dry_run)
            changed.append("ALL-PROMPTS.md (the series at the end)")

    if changed:
        print(f"{verb} write, in {folder}:")
        for name in changed:
            print(f"  {name}")
    elif not kept:
        print(f"Nothing to write: {folder} already holds this series.")
    if kept:
        print("Left alone, because they differ from the ones here (pass --force to replace them):")
        for name in kept:
            print(f"  {name}")
    if changed and not args.dry_run:
        print("Nothing is committed. Before UI-P60, put sandbox-screens.zip at the repo root.")
    return 0


# --- the command line ---------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        prog="sandbox_prompts.py",
        description="The composer sandbox and build page prompts, UI-P60 to UI-P76.",
    )
    commands = parser.add_subparsers(dest="command")

    listing = commands.add_parser("list", help="the order, and what each prompt needs first")
    listing.set_defaults(run=cmd_list)

    show = commands.add_parser("show", help="print one prompt, ready to paste into Claude Code")
    show.add_argument("prompt", help="UI-P69, P69 or 69")
    show.add_argument("--about", action="store_true", help="print what the prompt does instead of the prompt")
    show.set_defaults(run=cmd_show)

    nxt = commands.add_parser("next", help="print the first prompt with no commit on this branch yet")
    nxt.add_argument("repo", nargs="?", default=".", help="the repo (default: here)")
    nxt.set_defaults(run=cmd_next)

    write = commands.add_parser("write", help="write the prompts into design/prompts/")
    write.add_argument("repo", nargs="?", default=".", help="the repo (default: here)")
    write.add_argument("--dry-run", action="store_true", help="say what would change, change nothing")
    write.add_argument("--force", action="store_true", help="replace prompt files that differ")
    write.set_defaults(run=cmd_write)

    args = parser.parse_args(argv)
    if not getattr(args, "run", None):
        print(__doc__)
        return 0
    return args.run(args)


if __name__ == "__main__":
    sys.exit(main())
