# SV-27 · Agent deployment · Part 0

Read on 31 October 2026 at `56ed470` (main, SV-26 merged). Branch: `claude/kind-cannon-rc1eqm` (the session's designated branch; the prompt names `sv-27-agent-deployment`, which this session may not push to).

Baseline: `npx tsc --noEmit -p tsconfig.app.json` clean; `npm test` 10,003 tests, 10,002 passed, 1 failed under load (`src/pages/site/compose/ca20.p2.test.tsx` › "a file goes at once…"), which passes alone (11 of 11): a timing flake, not touched here.

## Assumptions

Each fact under "What exists today", checked on disk.

| Fact | Found |
| --- | --- |
| Agent tile holds Models (up to four, roles), Available tools, Supporting models (`HelpersField.tsx`), Memory (`payload.memory`, "Stored between runs"), harness in `payload.harness` labelled Host platform | True. `AGENT_SETUP_COPY.runsIn = "Host platform"`; the field's none row is `AGENT_SETUP_COPY.ownCode = "Own code (API)"` in Details and `notSure = "Not sure"` in the Add window. "My own code (API)" is `OWN_CODE` in `modelRules.ts`, an internal lookup key for the model menu, not drawn. The Add window draws "Helpers", not "Supporting models". |
| Published renderer `configuration.tsx:116` and `tileSections.ts:583` use the same label | `configuration.tsx:116` "Host platform": true. `tileSections.ts:583` is a doc comment; the drawn row is `tileSections.ts:381`, labelled "Runs in" with "Own code (API)". |
| `AGENT_PATTERNS`: sequential, lead, parallel, review | True (`tileExtras.ts:215`). |
| How did it run? (`payload.runs`, `RunsFields.tsx`, `RUNS_CHOICES` in `detailsModel.ts`) with once, schedule, event, until, parallel, goal, script | True (`detailsModel.ts:59`). The Add agent window draws a separate "Trigger" segmented control (Manual, Scheduled, Event) that writes the same `runs.how`. |
| Limits: free text, "Steps, budget, run time, approvals, prohibited actions" | True (`agentExtrasOf`). |
| `TOOL_PERMISSIONS`, `toolExtrasOf` | True: `["read", "write", "delegated"]` in `tileExtras.ts:141`. |
| `derive.ts`: `triggerOf` counts schedule and event; guarded by any of limits, max_steps, budget, approvals… | True (`derive.ts:143`, `:406`). |
| `modelRun.ts` `{ precision, where }`, kept on prompts, agents and code (`graph.ts:857`) | True, now at `graph.ts:865`. Words: "How it was run", "Full size", Other hint "Q5_K_M". |
| Session harness `sessions_meta[key].tool`, shown as "App" in `SessionDialog.tsx`, `NO_APP` in `sourcesModel.ts`, `SessionMap.tsx`, publish checklist "Session n has no app" | True. `SessionMap.tsx` has its own `MAP_COPY.noApp`. The checklist's words are "Apps for n sessions" and "Session n has no app" (not "Sessions with no app"). |
| Setup items (`setup.ts`): `payload.setup = { session, kind }`, kinds instructions, skill, server, rule, workflow; `SETUP_KIND_LABEL.rule` = "Rule"; not steps; `setupFolder.ts` | True. |
| Prompt variables `{name}`, `VARIABLE`, `PromptVariable`, `payload.variables` | True (`tileExtras.ts`). |
| "Runs when" (`RunsWhenField.tsx`) | True. |
| Costs: `cost.ts`, `costView.ts`, `CostFields.tsx`, `compare.ts`; `run_cost` on runtime tiles; `showCost`; `cost_setup`, `cost_monthly`, `currency` on the build | True. |
| `node_types` category check, renderer names a file in `renderers/` | True (`20260823120000_build_record_core_schema.sql:86`). Renderers: artefact, configuration, data, evidence, instruction, narrative. |
| Add menu `ADD_ITEMS` marks `ready: false` until live | True; liveness is `useNodeType(compose.nodeTypes, key)?.is_active` in `SandboxPage.tsx:425`. |
| `build_events.kind` | True: prompt, milestone, breakage, deploy, note. |
| No partnership or affiliation field | True. |
| What you need: `runtimeNeeds.ts`, `RuntimeNeed { title, steps }` | True. |
| Fork rules `forkRules.ts`, `rewritePayload` | True. |
| Tool registry: has OpenClaw, Hermes Agent (group agents, with `source`), ElevenLabs, Gmail, Stripe, Ollama, LM Studio, LangGraph (`runtime-frameworks`), LangSmith (`runtime-tracing`); lacks llama.cpp, vLLM, MLX, Letta, Mem0, Hume, Telegram, WhatsApp, Google Calendar, Claude Design, Grafana, Prometheus, Langfuse, CrewAI | True. Slack, Notion and Lovable already exist; Obsidian, Tailscale and OpenRouter do not. Models list has Qwen (`qwen2-5`). |
| Map: `sessionMap.ts`, `SessionMap.tsx`, `making.map = { on, direction, onBuildPage }` | True (`making.ts:191`). |
| Imports: readers `transcript`, `claude`, `lovable`, rule-based; `parse-transcript` writes nothing | True. |
| `build_updates` | Does not exist anywhere. |

## Plan

- Part 0: assumptions, plan, before screens -> verified by: 40 screens in `before/` (`e2e/audit/composer-sv27-shots.spec.ts`).
- Part 1: Harness and Hook words on screen -> verified by: `src/lib/build/sv27.harness.test.ts(x)` (labels, stored keys unchanged).
- Part 2: migration file, nine node types and `build_updates` -> verified by: a test that the Deployment group is `ready: false` and the changelog read answers "missing" on 42P01 and PGRST205.
- Part 3: `deployment.ts` model, fork rules -> verified by: `deployment.test.ts` (no number, counts, fork, relay refusal, address refusal, Duplicate rewrite).
- Part 4: model run's new keys and words -> verified by: `modelRun.test.ts` additions.
- Part 5: agent and team fields -> verified by: model tests per field.
- Parts 6 to 14: as the prompt lists, each with its tests.
