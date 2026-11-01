# SV-29 · Pipelines and evaluation · plan

## Assumptions (each fact the prompt states, checked on disk at aae5b14)

- Branch: the session's designated branch is `claude/sv-29-pipelines-evaluation-ai680v` (the prompt names `sv-29-pipelines-and-evaluation`). The designated branch is used. Main was at `aae5b14` (SV-28 merged) and the branch is level with it.
- `node_modules` was absent; `npm ci` from the lockfile (no new dependency).
- Decision tile (`decision.ts`): matches the prompt. `OPTIONS_MAX` 255, six question types, `examples` up to 10 pairs, `low_confidence`. No label set, candidates, selection, adaptation or known limits.
- Check tile: `CHECK_TYPE = "eval_run"`, `SCORING_HOWS` has `ab` ("A/B comparison"), `CheckRun { at, passed, total }` (max 20 kept), `CheckCase` four fields, 50 cases, 280 characters. Matches.
- `retrieval_config` exists in the node type registry seed (category data, renderer data). It is NOT in `KIND_OF_TYPE`. The data renderer (`renderers/data.tsx`) and the demo seed use it as a child of a dataset with `top_k`. So that rows saved before read as before, the Retrieval tile is a step only when its payload says `step: true` (the way System prompt, Dataset and Repo are tiles, and the way a Check needs `tested`). `KIND_OF_TYPE` gains it; `isStepNode` applies that guard.
- `cost.ts`: `RunPer = call | run | hour | day`; `money()` already prints `$` for USD. `modelRun.ts` has no batch flag.
- `TECHNIQUES` has no Zero-shot or Reranking; Few-shot examples, Retrieval (RAG), Structured output, Classification, Extraction, Fine-tuning, Embeddings, Evaluations exist.
- Tool registry: LangSmith is in `runtime-tracing`. No DeepEval, Confident AI, pytest or GitHub Actions. Each is added only from its source page.
- **FALSE PREMISE (reported, not built):** SV-27's `supabase/functions/_shared/intake/readers/guide.ts` and `providers.ts` do not exist. `readers/` holds `claude.ts`, `lovable.ts`, `transcript.ts`, `index.ts`. Part 4 item 10 (the guide reader proposing eval-harness fields) has no file to extend. Not built; reported.
- The architecture map (`architectureMap.ts`), `setupPrompt.ts`, `deployment` tiles, `costFields.ts`, `teamFields.ts` (the cleaner-registration pattern) exist. `setExtras(node, patch, tree)` is the generic payload writer; new keys register cleaners through `registerCleaners`.

## Plan

- Part 1: `pipelineFields.ts` (label set, candidates, selection, adaptation, known limits, ceiling), registered cleaners for `decision`, Decision facts read them -> verified by: `pipelineFields.test.ts`.
- Part 2: `retrieval.ts`, StepKind `retrieval`, Add menu, window, numbering -> verified by: `retrieval.test.ts`, SV-05 numbering tests.
- Part 3: `comparison.ts` (test set, metric by question type, rows, design) -> verified by: `comparison.test.ts`.
- Part 4: `evalHarness.ts` (test set source, case fields, failure types, graders, runs per case, run history, gate, validation), registry entries from source pages -> verified by: `evalHarness.test.ts`.
- Part 5: `cost.ts` (`item`, `pricing`), `modelRun.batch`, `volume` -> verified by: `cost.test.ts`.
- Part 6: pipeline row in `architectureMap.ts` -> verified by: `architectureMap.test.ts`.
- Part 7: Techniques in `taxonomy.ts` and `derive.ts` -> verified by: `derive.test.ts`.
- Part 8: build page sections, `setupPrompt.ts` lines -> verified by: component and `setupPrompt` tests.
- Part 9: two fixtures, dev pages, screens, checks -> verified by: the README's checks.
