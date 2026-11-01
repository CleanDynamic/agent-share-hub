# SV-30 Part 0: Assumptions and Plan

Checked on disk at `92150ce` (main after SV-29).

## Assumptions

1. **Do imported turns carry tool calls and results?** No. `supabase/functions/_shared/intake/readers/claude.ts` folds a tool call to one line
   (`[ran <name>]`, or `[ran <name> — it returned an error]`). Its input and its result are never read (decision 3 in that file). No reader
   carries a tool result.
2. **Can a `git commit` SHA, or a compaction turn, be read?**
   - A commit SHA: no. The result text is not kept, so the import proposes no SHAs. Output commits are entered by the maker only.
   - A compaction turn: yes, for Claude Code. The summary turn arrives as an ordinary user turn and `isSessionSummary` (`summaryTurn.ts`)
     recognises it by its opening words, so the Compaction count can be filled from a session's own Summary tiles. Other harnesses: maker only.
   - Message count: the import knows it (`SessionSummary.turnCount`), so `messages` is filled from it.
   - Model ID: the import's `modelName` is a display label (`modelLabel`), not a provider ID. No import gives an exact model ID today, so
     `model_id` is maker-entered, with a reader hook (`fromRun`) ready for when one does.
3. **Names.** `SessionMeta` (`making.ts`) extends `SessionExtras` (`sessionFacts.ts`), whose `extrasOf` / `withExtras` / `extrasRefusal` are
   the single read, write and refusal path; they feed `onSessionExtras` -> `setSessionMeta` (a `making` writer). New session keys join
   `SessionExtras`. `SessionGoal` and `goalOf` are in `making.ts`. `EFFORTS` is in `tileExtras.ts`. The Summary tile is `summaryTurn.ts`.
   Setup kinds are in `setup.ts` (`rule` shows as Hook). The Check's `evidence` is in `tileExtras.ts` (`eval_run` cleaners).
   The copy rule is `methodOf` in `forkRules.ts`. `copyTogether.ts` and `setupPrompt.ts` exist.

## Plan

- Part 1: `model_id`, `effort` on `SessionExtras`, shown in the session facts, Session window fields -> verified by: sessionFacts tests, a writer test.
- Part 2: `target` on `SessionGoal`, `goalOf`/`goalRefusal`/`goalLine` -> verified by: goal tests.
- Part 3: `sent_by`, `asks_for` on prompt payload, `copyTogether` + setup prompt wording -> verified by: tileExtras and copyTogether tests.
- Part 4: `environment`, `isolation`, `can_install`, `access` -> verified by: sessionFacts tests, fork test.
- Part 5: `plugin` setup kind, install line in the folder and setup prompt -> verified by: setup, setupFolder tests.
- Part 6: `messages`, `compactions`, Compaction summary label -> verified by: tests.
- Part 7: `outputs` with `Show readers` -> verified by: tests.
- Part 8: evidence kinds, `review`, original's label on fork -> verified by: tileExtras, forkRules tests.
- Part 9: `part_of`, `runs_where` on Code tiles -> verified by: tests.
- Part 10: fixture, screens, checks.

Each part is pure code first, then its window field. A part that cannot be finished with every check green is reported, not left half done.
