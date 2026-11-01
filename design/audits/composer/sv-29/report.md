# SV-29 · Pipelines and evaluation · report

```
SV-29 · Pipelines and evaluation
PASS with exceptions (below)
Branch / PR: claude/sv-29-pipelines-evaluation-ai680v (the designated branch; the prompt names sv-29-pipelines-and-evaluation) / SV-29 pipelines and evaluation
Facts wrong on disk: readers/guide.ts and providers.ts (SV-27) do not exist; retrieval_config already existed as a child of a dataset
  (data renderer, demo seed), so it is a step only with `step: true`.
Baseline -> end: tests 10,366 -> 10,475 (4 fail in the full run under load: LayerReview fails without my changes too; the other three pass alone)
Composer chunk 117.9 -> 119.0 KB gz; AddRetrievalDialog 2.1 KB gz new chunk (see size.md)
Audits run here, all three FAILED and not compared with main: audit:themes and audit:contrast stop on `Cannot read properties of null (reading 'click')` in the page script (environment, no signed-in state); audit:motion remove-a-tile saw 6 frame gaps over 25 ms in this container (no motion was added). Not run: tier1 e2e, audit:pages, audit:perf
Lovable messages: none. No migration.

Decision: label set, candidates, selection, adaptation, known limits yes each · ceiling derived yes
Retrieval: step kind added yes · numbering tests updated: none needed (SV-05's are about sessions) 
Comparison: rows yes · metric by question type yes · design yes · fork labels original yes
Eval harness: test set source yes · failure types yes · graders with what they see yes · runs per case and stability yes · run history with compare yes · CI gate with dropped rules yes · guide reader NOT BUILT (file missing)
Registry: DeepEval, Confident AI, pytest, GitHub Actions all left out: source pages unreachable from this session
Costs: per item yes · pricing basis yes · batch yes · daily volume line yes
Map pipeline row yes · Classification values added: Zero-shot, Reranking
```

Notes: Classification is now a Decision with a choice or multi question (one derive test updated). Add menu 15 items; Decision window 13 and Check window 14 optional fields (tests updated).
Screens: 76 in this folder (19 cases, 1440 and 390, Dusk and Noon).

## What Miles needs to do
Merge the pull request, then Publish > Publish changes. No migration.
