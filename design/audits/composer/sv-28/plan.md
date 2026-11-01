# SV-28 · Agent imitation · Part 0

Read on 1 November 2026 at `9064130` (main: SV-27 merged, and Lovable's "Applied SV-27 agent tiles" migration). Branch:
`claude/sv-28-agent-imitation-jnbx9e` (the session's designated branch; the prompt names `sv-28-agent-imitation`, which this
session may not push to).

Baseline: the composer chunk (`SandboxPage-*.js`, gzip) is **119,940 bytes** of its 120,000; the first download 230.4 KB (over
its 200 KB budget on main, as SV-26 and SV-27 reported).

## Where the code sits (measured with `ANALYZE=1 ANALYZE_RAW=1 vite build`)

What decides where SV-28's code can go without breaking the composer's budget:

| Module | Chunk |
| --- | --- |
| `graph.ts`, `agentFields.ts` | `graph-*.js` (shared with the build page), not the composer's |
| `tileExtras.ts` | `sourceTiles-*.js` (shared) |
| `TileEditDialog.tsx`, `AddAgentDialog.tsx` (the agent and team window) | `TileEditDialog-*.js`, loaded when a window opens |
| `AgentRuntimeFields.tsx` | its own chunk, loaded with the window |
| `AddManualStepDialog.tsx` | its own chunk |
| `FullPromptWindow.tsx`, `PartWindow.tsx` (the prompt window) | `FullPromptWindow-*.js` |
| `architectureMap.ts` | `ArchitectureMap-*.js` |
| `setupFolder.ts` | `BuildPage-*.js` |
| `BuildList.tsx`, `SandboxView.tsx` (`ADD_ITEMS`), `derive.ts`, `duplicate.ts`, `detailsView.ts`, `DetailsPanel.tsx` | **the composer's own chunk** |

So the data layer goes in `src/lib/build/` modules the graph chunk or a window chunk carries, and the composer itself gets only
the call sites. Whatever SV-28 adds to the composer's chunk is paid for by moving something out (Part 9 reports it).

## Assumptions

Each fact under "What exists", checked on disk.

| Fact | Found |
| --- | --- |
| An agent's instructions are `payload.system_prompt`, drawn as n.1 (`instructionsOf`) | True: `instructionsOf` (`graph.ts:948`, not exported) makes the `<id>:instructions` step from the agent's own row. |
| Its prompts are n.2 onward | True (`readStep`, `graph.ts:1005`). |
| Agents in a team are n.1 onward (`buildSteps`) | True: the team branch of `readStep` numbers its agents `sub(number, i + 1)`. An agent in a team has children only when it has prompts. |
| A team stores `payload.pattern` (`AGENT_PATTERNS`), SV-27 adds `handoff` and `group` | True (`tileExtras.ts:215`). |
| A team has no instructions of its own | True: `addTeam` writes none; `stepFor` reads a team's `text` from `payload.text`, which nothing writes. |
| No field records which agent passes work to which | True: no `handoffs` anywhere. |
| `copyTogether.ts` copies one step and its tiles; nothing copies an agent or a team as one instruction | Partly: `copyTogether` is as stated, but the build page's "Copy the agent" / "Copy the team" (`BuildSteps.tsx:1037`, `teamText`) copies each agent's number, title and instructions. It is not a setup instruction (no harness, tools, models, handoffs). |
| `setupFolder.ts` writes Claude Code's layout | True, plus SV-27's `SKILLS-TO-INSTALL.md` and `.github/workflows/<file>` for a workflow item. |
| `linkRules.ts` and `postRefs.ts` link post text to `node:`, `session:`, `workstream:`; instruction text has no links | True. Both are in `src/lib/build/`. `refLook` is not a function: `postRefs.ts` only names it in a comment. The post's link look is drawn by the post editor; Part 2 reuses the look the composer's linked words use (`refLookStyle` is checked when built). |
| Prompt variables are `{name}` (`VARIABLE` in `tileExtras.ts`) | True (`tileExtras.ts:88`, not exported; `variableNamesIn` is). |
| `TOOL_PERMISSIONS` is `["read", "write", "delegated"]` | True (`tileExtras.ts:141`). |
| `readsOutsideContent(agent, tree)` returns tools (harness, then tool refs) with `readsOutside: true` | True. It counts the agent's `tools` entries that are `{ tool_ref }` integration nodes. Note: SV-27's fixtures write `tools` as plain tool ids (`["slack", "gmail"]`), which it does not count; Part 6 passes both forms through it. |
| Manual steps: `manual_step`, `AddManualStepDialog.tsx`, numbered like any step, `payload.where` `app` or `site` | True; `where.kind` also takes `terminal`, `phone`, `offline`. `addManualStep` requires a tool and at least one line (`manualKeys`). |
| The Add menu is `ADD_ITEMS` in `SandboxView.tsx` | True (`SandboxView.tsx:242`). |
| Prompts have no deliverable, an agent no output rules, a team no workspace or example run | True (none of the keys exist). |
| The registry has a `source` per entry; SV-27 adds `hosting`, `licence`, `defaults`, `checked` | True as `Tool.facts = { hosting, licence, defaults, checked, source }` (SV-27's report). No entry has `hosting` yet: SV-27 found no source for it. A tool's `source` is the page its model list was read from, which for several harnesses is not the harness's documentation (Codex: aidenapp.org; Copilot: a GitHub release of a notifier; Manus: Wikipedia). |
| SV-27 names: `approval_mode`, `sandbox`, `role`, `tool_permissions`, `framework`, `compatible_models`, `runs.channels`, deployment tiles | True (`agentFields.ts`, `deployment.ts`, `graph.ts` `RUNS_CHANNELS_MAX`). |
| Before you copy (SV-27 Part 8) | `beforeYouCopy(tree)` in `deploymentNeeds.ts` exists as a pure function; no page draws it yet (SV-27 Part 11 was not done). |
| `?build=deployment-<fixture>` dev pages | Not wired: SV-27 Part 14 named them but did not build them. |
| Moving an agent out of a team | `nestStep` (`graph.ts`) is the one writer that changes a tile's parent, inside `track(...)`, so its writes are one undo step. |
| Human oversight values | `taxonomy.ts` has Every output reviewed, Spot checks, No review. "Approved before continuing" is new (no SQL holds these values). |

## Plan

- Part 0: assumptions, plan, chunk map -> verified by: this file; baseline size 119,940.
- Part 1: `teamFields.ts` (pure: team instructions, handoff reading and refusal, the cleanup when an agent leaves); cleaners through
  the extras writer; `nestStep` writes the cleanup with the move; the window's Hands off to row and Team instructions; map lines
  -> verified by: `sv28.team.test.ts` (no number, refusal, cleanup in the same write, fork rewrite, one map line per rule).
- Part 2: `mentionsOf(text, team)` pure; linked mentions in the instructions; `Mentions not matched`; dotted map lines
  -> verified by: `sv28.mentions.test.ts`.
- Part 3: job fields on prompts inside an agent, output rules, rules followed; the job line -> verified by: `sv28.jobs.test.ts`.
- Part 4: Approval in the Add menu (a `manual_step` with `payload.gate`), blocks validated and cleaned after a move, the gate's lines,
  Classification -> verified by: `sv28.gate.test.ts`, `derive.test.ts` additions.
- Part 5: workspace and example run on a team -> verified by: `sv28.workspace.test.ts`.
- Part 6: `trustBoundary.ts` -> verified by: `trustBoundary.test.ts` (each case in the prompt).
- Part 7: `setupPrompt.ts`, Copy setup prompt and Show setup prompt -> verified by: `setupPrompt.test.ts` (snapshots per fixture,
  determinism, private data absent, vendor form, empty sections left out).
- Part 8: `harnessMap.ts` from documentation read this session; `setupFolder` takes the entry; `NOT-CARRIED.md` -> verified by:
  `harnessMap.test.ts` (Claude Code byte-identical, each mapped harness's names, nulls carried to notCarried).
- Part 9: fixtures, dev page, screens, checks, report.
