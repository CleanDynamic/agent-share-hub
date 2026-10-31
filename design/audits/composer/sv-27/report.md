# SV-27 · Agent deployment · report

```
SV-27 · Agent deployment
FAIL (Parts 0 to 10 done; Parts 11 to 14 left, see below; the composer chunk is 0.1 KB over its budget)
Branch / PR: claude/kind-cannon-rc1eqm (the session's designated branch; the prompt names sv-27-agent-deployment) / see the PR titled "SV-27 agent deployment"
Facts in this prompt that were wrong on disk:
  - "My own code (API)" is OWN_CODE, an internal key the model menu reads (modelRules.ts), not drawn. The drawn none rows were
    "Own code (API)" (Details) and "Not sure" (the Add window). Both now read "Built in code (no harness)"; OWN_CODE is unchanged.
  - tileSections.ts:583 is a doc comment; the drawn row was tileSections.ts:381 ("Runs in"), and :520 "App and model".
  - The publish checklist said "Apps for n sessions", not "Sessions with no app".
  - graph.ts:857 is now graph.ts:865.
  - Slack, Notion, Lovable, Stripe, LangGraph and LangSmith were already in the registry.
  - Tool.checked already exists (the date the model list was read), so the harness facts are `Tool.facts = { hosting, licence,
    defaults, checked, source }`; a tool's deployment kinds are `Tool.deploys` (`steps` are Add items).
  - fork.ts copies no `making`, so a partnership can never travel with a copy; nothing had to be dropped.
  - The Add agent window draws its own "Trigger" control (Manual, Scheduled, Event) over the same `runs.how`.
Baseline → end: tests 10,003 → 10,251 (10,250 passed; the one failure, sv18.insert, passes alone)
Compared boards: not comparable: SV-27 has no vision board; before screens are in before/ (40 shots), after screens not taken (Part 14)
Request rounds and requests for the page, before → after: not measured (Part 11, the build page, not done)
Web Vitals against the last after numbers: not measured this session
Built but not live yet: the nine deployment kinds and the changelog wait on the migration (ready: false / hidden until then)
Layers built only because a target failed: the deployment window, the Deployment section, the agent's deployment fields, the
  Map's Architecture view are each their own chunk; costFields.ts split from deploymentCost.ts; derive's new readings moved to
  agentFields.ts and deployment.ts; partnership.ts split from making.ts. Each to keep the composer chunk near 120 KB (see Chunks).
Names that differed from this prompt: Tool.checked → Tool.facts.checked; Tool.steps (kinds) → Tool.deploys; SessionMap's
  MAP_COPY.noApp and NO_APP now read NO_HARNESS (harnessWords.ts)
Raw values without a token: none
Motion cut back after watching: none (no after video taken)
Dead code seen: none new
Lovable messages needed:
  Apply supabase/migrations/20261105120000_sv27_agent_deployment.sql exactly as written. Change nothing else. Then run the EXPLAIN in its header and paste the plan back.
Parts not done: 11 (published build page), 12 (changelog UI; its data layer and table are done), 13 (guide import), 14 (after
  screens, motion moments, audits; the three fixtures are done)
Questions for Miles: see the end
```

## SV-27 lines

```
Harness and hook: places renamed 14 (Session window: subtitle, "Harness and model", "Harness", "No harness chosen"; NO_APP and the
  Map's line; Drafts, OpenBuilds offers and the build page's session heads; the publish checklist's two lines; "Pick a harness for
  session n"; the agent's Harness field, its placeholder and its Built in code row in Details and the Add window; the published
  renderer; tileSections' agent row and session row; SETUP_KIND_LABEL.rule "Hook" and Copy for AI's "Hooks:") · stored keys unchanged yes
Deployment tiles: kinds live before the migration: Front end (live_app) · numbering unchanged yes · counts unchanged yes
Model run: new keys saved yes · old runs unchanged yes
Agent and team: framework yes · compatible models yes (typed names, not the model picker) · model routing yes · runs background and
  ongoing yes · approvals and reviewer yes · sandbox yes · roles yes · handoff and group chat yes · tool permissions yes ·
  Deployment line yes (in the agent's window; not yet under the title row in the List)
Knowledge base and relay: notes with templates yes (model; the window adds no notes yet) · relay joins two or more yes · memory
  tagging and review yes · Agent Tincan left out for want of a source (typed as a provider name in the fixture)
Partnership and affiliation: both kinds stored through the making writers yes (setPartnership on makingStep; no menu item or line
  yet) · shown on the build page no · dropped on fork yes (fork copies no making)
Harness facts: entries with hosting, licence and defaults from a source: none · left empty for want of a source: OpenClaw,
  Hermes Agent (no source page was read this session); Dots, Muse and Grok Bot left out for the same reason
Classification: Autonomy from approval mode yes · budget-only Limits no longer a gate yes
Skills: origin saved yes · registry install line yes (SKILLS-TO-INSTALL.md in the downloaded folder)
Setup for the agent: agent-owned items yes · download folder yes (setupFolder over readerSetup's agent:<id> items; no button
  yet) · templates yes (model, reader, export, fork; no window yet)
Costs: setup, run and estimate kept apart yes · Compare rows yes · measured speed dropped on fork yes
Architecture map: own chunk 3.7 KB · view stored through the making writers yes
Changelog: hidden before migration yes (data layer) · what SV-20 would need for savers: an AFTER INSERT trigger on build_updates
  that writes one notification per saver of the build (SV-20's pattern), SECURITY DEFINER with search_path set and EXECUTE revoked
Guide import: not done
Chunks: composer 119.0 KB (main) → 120.1 KB · deployment window 3.3 KB · Deployment section 0.9 KB · agent deployment fields
  3.0 KB · architecture map 3.7 KB · the shared deployment module 4.4 KB
```

The first download was already 230.2 KB on main against its 200 KB budget (SV-26 reported it); it is 230.5 KB here, the Part 1
words now shared by Drafts and OpenBuilds.

## Checks

- `npx tsc --noEmit -p tsconfig.app.json`: clean.
- `npm test`: 10,251 tests, 10,250 passed; the flakes seen under load (`ca20.p2`, `ca21.p7`, `sv07.parts`, `ca26.p3`, `sv18.insert`)
  each pass alone and touch nothing this prompt changed; `ca21.p7` fails alone on main too.
- `npm run lint`: 1,921 problems on main and the same here; 0 errors in the files this prompt changed.
- `npm run build`: passes. `node scripts/check-size.mjs`: the composer chunk is 120.1 KB (0.1 KB over), the first download 230.6 KB.
- Not run: `npx playwright test e2e/tier1`, `audit:motion`, `audit:pages`, `audit:themes`, `audit:contrast`, after screens.
- Em dash search of the diff: none in shown copy.

## Questions for Miles

1. The composer chunk is 0.1 KB over 120 KB. The next session can take it under by moving `detailsView`'s agent deployment view
   or the Add menu's group rendering out, or the budget can move to 121 KB.
2. Should the harness facts (OpenClaw's default approvals) be read from their docs pages in a session allowed to fetch them?
3. In the Add agent window, "Not sure" now reads "Built in code (no harness)", since both saved no harness. Keep a separate
   "Not sure"?
