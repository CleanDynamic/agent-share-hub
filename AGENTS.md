# Project implementation rules

- Use the existing theme accessor, radius handles, and type handles for inline presentation; this preserves the current token-driven design.
- Keep desktop global-bar menus lazy and reuse PostingWindows for new posts; this avoids duplicating posting behaviour or adding it to the first download.
- Keep stale generated database typings narrowed at the calling module; never edit generated integration files by hand.
- Keep footer reading routes on the shared LegalPage container and FooterPageView; this keeps review gating, readiness and hash scrolling consistent.