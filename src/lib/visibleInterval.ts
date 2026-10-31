// SV-26 P5: an interval that does nothing while the tab is hidden. A hidden tab polls nothing and redraws nothing.

/** Run `tick` every `ms` while the tab is visible; skipped ticks are not replayed. Returns the stop function. */
export function visibleInterval(tick: () => void, ms: number): () => void {
  const id = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    tick();
  }, ms);
  return () => clearInterval(id);
}
