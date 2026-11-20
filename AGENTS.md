# Project implementation rules

- Use the existing theme accessor, radius handles, and type handles for inline presentation; this preserves the current token-driven design.
- Keep desktop global-bar menus lazy and reuse PostingWindows for new posts; this avoids duplicating posting behaviour or adding it to the first download.
- Keep stale generated database typings narrowed at the calling module; never edit generated integration files by hand.