# CLAUDE.md

## UI overhaul

The source of truth is `design/`. Read `design/RULES.md` before any UI change. Prompts live in `design/prompts/` and run in order. Names of modules, functions and columns come from the `buildgallery-repo-map` skill and from the files themselves, never from a prompt alone.

## SV series (current)

The current prompt series is **SV-01 to SV-26**, in `design/prompts/sv-series/`: `README.md` holds the order and the rules every prompt follows, and each prompt is `SV-nn-<name>.md`. When asked to run "SV-01", "sv 1" or similar, open `design/prompts/sv-series/SV-01-security.md` (and so on by number) and follow it. The vision boards these prompts compare against are written by `python3 design/vision-kit.py`. The UI-Pnn prompts in `design/prompts/` are the earlier series; CA-06 to CA-28 are earlier work already in the code.
