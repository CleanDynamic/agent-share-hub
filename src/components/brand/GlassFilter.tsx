// The one SVG filter behind liquid glass (UI-P09b).
//
// MOUNTED ONCE, by `SiteFrame`, above everything. `.bg-glass::after` in index.css points at it with
// `filter: url(#bg-glass-distortion)`; nothing else in the app may reference it, and nothing else may use an
// `feDisplacementMap` — this is the one place the performance guidance's ban is lifted, under the guards in
// index.css (dropped below 768px, under reduced transparency and without backdrop-filter).
//
// THE VALUES ARE MEASURED AT PANEL SIZE, not copied from the 400 × 300 card they came from. That source used
// baseFrequency 0.035 and scale 180, which tears a 1280px panel apart. 0.012 makes one wave span the panel
// instead of twenty, and 42 bends the edge without smearing it. x/y/width/height stay 0% / 100%: that clips the
// displacement to the panel and stops the corners pulling in content from outside.

export const GLASS_FILTER_ID = "bg-glass-distortion";

export function GlassFilter() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      data-ui="glass-filter"
      style={{ position: "absolute" }}
    >
      <filter id={GLASS_FILTER_ID} x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="92" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
        <feDisplacementMap in="SourceGraphic" in2="blurred" scale="42" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

export default GlassFilter;
