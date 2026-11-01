# SV-28 · Agent imitation · report

```
SV-28 · Agent imitation
PASS, with the exceptions listed under "Parts not done" and "Checks"
Branch / PR: claude/sv-28-agent-imitation-jnbx9e (the session's designated branch; the prompt names sv-28-agent-imitation) / the PR titled "SV-28 agent imitation"
Facts in this prompt that were wrong on disk:
  - "Nothing copies an agent or a team as one instruction": the build page's "Copy the agent" / "Copy the team" (BuildSteps.tsx,
    teamText) copies each agent's number, title and instructions. Not a setup instruction, so the setup prompt is still new.
  - `refLook` is not a function: postRefs.ts names it in a comment only. Mentions use the reader's link look (RefLinks.tsx: a fill,
    radius 4, padding 1px 4px, `--row-highlight`, `--tag-fill` on hover).
  - readsOutsideContent counts an agent's `tools` entries that are integration nodes ({ tool_ref }); SV-27's fixtures store plain
    tool ids. trustBoundary.ts passes both forms through it.
  - Before you copy (SV-27 P8) exists as `beforeYouCopy(tree)` with no page drawing it (SV-27 Part 11 was not done). The crossings
    are added to it; no new Before you copy screen exists to show them.
  - The `?build=deployment-*` dev pages SV-27 named were not built; SV-28 builds them (DeploymentDemo.tsx).
  - Tool.facts.hosting is empty on every registry entry (SV-27 found no source), so no live agent takes the vendor-hosted form yet;
    it is tested by setting the fact in the test.
  - The registry `source` of Codex, GitHub Copilot, Antigravity, Muse Code, Manus and Muse is not the harness's documentation
    (a third-party page, a release of another project, Wikipedia, a news story). They get no harness map entry.
  - Human oversight had no "Approved before continuing"; it is added to taxonomy.ts (no SQL holds these values).
Baseline → end: tests 10,266 → 10,357 (one failure at the end, sv18.insert, the same timing flake as on main and in SV-27)
Compared boards: not comparable: SV-28 has no vision board; 80 screens in design/audits/composer/sv-28/
Request rounds and requests for the page, before → after: not measured (audit:pages not run, see Checks). setupPrompt.ts,
  harnessMap.ts and trustBoundary.ts fetch nothing; the assembler is its own chunk (6,129 bytes) loaded on the click.
Web Vitals against the last after numbers: not measured this session
Built but not live yet: none (no migration; everything is in build_nodes.payload)
Layers built only because a target failed: the composer chunk went to 121,730 bytes with SV-28's List lines; three windows the
  composer carried (Open as a request, Recently removed, Publish confirm) now load when first opened (SV-26's lazyWindow), and the
  List's new lines are shared with the build page (src/components/build/teamLines.tsx). 119,940 → 117,926 bytes.
Names that differed from this prompt: Tool `facts.hosting` (prompt: `hosting`); `setupFolderFor(items, load, entry)` beside the
  unchanged `setupFolder(items, load)`; the Approval step's notice goes through useBuildHistory's `notify`
Raw values without a token: none
Motion cut back after watching: none (no motion added; Add > Approval goes through `asStep`, the same animator path as Manual step)
Dead code seen: none new
Lovable messages needed: none
Parts not done: see below
Questions for Miles: see the end
```

## SV-28 lines

```
Team instructions: unnumbered yes · numbering tests unchanged yes
Handoff rules: validated yes · rewritten on fork yes · drawn on map yes
Mentions: resolved by role then title yes · unmatched listed yes
Jobs: deliverable, destination and approval saved yes · output rules and rules followed yes
Approval step: built on manual_step yes · blocks validated yes · Autonomy reads it yes
Team: workspace yes · example run 2 to 12 yes
Trust boundary: crossings found in the chief-of-staff fixture (1) · removed by each approval kind yes · blocks nothing yes
Setup prompt: deterministic yes · private data absent yes · vendor-hosted form yes
Target harness: entries (harness · source · checked):
  Claude Code · code.claude.com/docs/en/{model-config, memory, skills, mcp, hooks, permission-modes, sandboxing} · 2026-11
  OpenClaw · docs.openclaw.ai/{providers/models, automation, tools/skills, cli/mcp, automation/hooks, tools/permission-modes,
    tools/exec-approvals, gateway/sandboxing} · 2026-11
  Hermes Agent · hermes-agent.nousresearch.com/docs/{integrations/providers, user-guide/features/context-files, .../skills,
    .../mcp, .../hooks, user-guide/security, user-guide/configuration} · 2026-11
  Devin Desktop · docs.windsurf.com/windsurf/models (redirects to docs.devin.ai/desktop/models), docs.devin.ai/desktop/devin-local/
    {customizations, permissions, modes} · 2026-11
  harnesses left out for want of a source: Cursor (its docs pages returned "not found"), Codex (registry source is a third-party
  page linking to no Codex docs), GitHub Copilot, Antigravity, Muse Code, Manus, Muse (registry sources are not documentation)
  Claude Code folder unchanged yes (byte-identical, tested)
```

## How each part was done

- **P1.** `teamFields.ts` holds the fields, their cleaners (registered on the existing extras writer) and the refusals that need the
  tree (`setExtras(node, patch, tree)`; the composer passes its tree). After any tracked step, `useBuildHistory.track` runs
  `tidyTeamWork` before the step's "after" is read, so a handoff to or from an agent that left its team, its example run entries,
  and who merges, are taken off in the same undo step. The team window edits Team instructions (AddAgentDialog in edit mode for a
  team); the agent window has Hands off to under Role (AgentRuntimeFields' chunk). The architecture map draws one line per rule,
  `hands off to`, with `when` in its tooltip; Details lists each rule with its condition.
- **P2.** `mentionsOf(text, team)` in `mentions.ts`. Linked in the List (a team's agents, Team instructions) and on the build page;
  each opens the agent. Details lists "Mentions not matched" (ambiguous ones say so). Dotted `mentions` lines on the map.
- **P3.** Job fields in the prompt window's Optional section, for a prompt inside an agent only (`JobFields.tsx`). The job line in
  the List and on the build page. Output rules and Follows in the agent window and under its instructions.
- **P4.** Add › Approval opens the manual step window in its Approval form (`ApprovalForm.tsx`); its window on a saved step is the
  same form. Blocked steps must be numbered after it (refused otherwise); a move that puts one before it removes it from `blocks`
  in the same step and says "Moved before its approval, so it no longer waits for it". The step line has each number as a button;
  the blocked step says "Waits for approval (step n)". derive.ts reads it for Autonomy and adds "Approved before continuing".
- **P5.** Workspace and example run in the team window (`TeamWorkFields.tsx`, entries move with Up and Down buttons); the team head
  shows the workspace line and "Example run · n steps", which opens the timeline headed "Entered by the maker, not recorded from a
  run."
- **P6.** `trustBoundaryOf(build)`. One refinement, said here because the prompt's tests needed it: one agent counts as a crossing
  only when it reads outside content through a tool other than the ones it acts through (an agent that reads and posts in the same
  Slack is not, on its own, a crossing). Without it, "a handoff from a Gmail reader to a Slack writer ... none once the rule has
  needs_approval" could not hold, since Slack is marked `readsOutside` in the registry. Before you copy gains one line per crossing
  (an SV-27 test is updated for its assistant fixture, whose OpenClaw harness reads outside content with full access).
- **P7.** `setupPromptOf` in `setupPrompt.ts`; Copy setup prompt and Show setup prompt on an agent's and a team's menu, and Copy
  setup prompt beside each agent and team on the build page. Copy shows the notice "Setup prompt copied".
- **P8.** `harnessMap.ts`; Rebuild in on the setup prompt window and on Download (one entry per mapped harness). A harness whose
  MCP or hooks file does not take Claude Code's shape is not written to; NOT-CARRIED.md says where to declare them.
- **P9.** Fixtures, dev pages (`/dev/kit/pages/sandbox?build=deployment-chief-of-staff` and the other three;
  `/dev/kit/pages/build-steps?build=chief-of-staff`), 80 screens (`e2e/audit/composer-sv28-shots.spec.ts`).

## Commits

The parts share `graph.ts` and `teamFields.ts`, so Parts 1 to 6 are one commit and Parts 7 and 8 another, each message naming its
parts; Part 0 and Part 9 have their own.

## Chunks

| | Bytes (gzip) |
| --- | --- |
| Composer, main (SV-27) | 119,940 |
| Composer, SV-28 Lines in the List before the size pass | 121,730 |
| Composer, end | **117,926** |
| setupPrompt (on click) | 6,129 |
| SetupPromptWindow | 1,835 |
| harnessMap | 1,138 |
| trustBoundary | 1,178 |
| AgentTeamDetails (Details, agents and teams) | 1,086 |

The first download is 230.7 KB (230.4 KB on main), over its 200 KB budget as SV-26 and SV-27 reported.

## Checks

- `npx tsc --noEmit -p tsconfig.app.json`: clean.
- `npm test`: 10,357 tests, 10,356 passed; sv18.insert fails under load and passes alone, as on main.
- `npm run lint`: 1,927 problems (1,921 on main); 0 errors in the files this prompt changed (the 6 more are fast-refresh warnings).
- `npm run build`: passes; composer chunk 117.9 KB within 120 KB.
- `npx playwright test e2e/tier1`: see the PR description (the config's server binds to IPv6, which this container lacks, so it was
  run against a server started on 127.0.0.1).
- Not run: `audit:pages`, `audit:perf`, `audit:themes`, `audit:contrast`, `audit:motion`.
- Theme guards (`src/lib/theme/*.test.ts`) pass, with every changed file in `lookRules.test.ts`.
- Em dash search of the diff: none.

## Seen while watching the screens

- On the architecture map, a handoff or mention line between two agents of one team runs straight down the agents' column, so it
  passes behind a relay drawn between them and its label can be covered. Not changed: the map's layout is SV-27's.
- The agent window's SV-27 fields (Deployment to Role) sit flush with the window's edge rather than inside its padding; SV-28's
  Hands off to, Output rules and Follows follow them, so they share it. Pre-existing.

## Parts not done

- Part 9.3's "trust boundary in Before you copy" screen: no page draws Before you copy yet (SV-27 Part 11). The line is in
  `beforeYouCopy` and tested.

## Questions for Miles

1. The self-crossing refinement in Part 6 (above): keep it, or count an agent that reads and writes the same tool as a crossing
   too? The second makes one prompt test impossible as written.
2. Claude Code's approval names: bypassPermissions for full, acceptEdits for "asks before risky actions" and default for "asks
   before every action" are read from the permission-modes page's descriptions; no Claude Code mode is "an AI reviewer that asks
   when unsure", so that one does not carry over. Confirm the mapping, or say which to drop.
3. Cursor's documentation could not be read this session (every page returned "not found"); a later session can add its entry.
