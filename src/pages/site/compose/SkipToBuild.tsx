// "Skip to build": the composer's first tab stop. Apart from buildFocus.tsx (its list hooks and what they pull in) because
// the route table names it and the route table is in the first download (SV-26 P2).

import { useState, type CSSProperties } from "react";

import { HEADER_HEIGHT } from "@/components/shell/chromeSize";
import { ROVING_ITEM, itemsOf } from "@/lib/focus/buildItems";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { text } from "./refinedStyles";

/** The item a Tab press lands on: the last one that had focus, or the first. */
export function currentBuildItem(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>('[data-testid="build-list"]');
  if (!root) return null;
  return root.querySelector<HTMLElement>(`:is(${ROVING_ITEM})[tabindex="0"]`) ?? itemsOf(root)[0] ?? null;
}

/** Skip to build: focus goes to the build list's current item, or to the Build panel when the list has none. */
export function focusBuild(): boolean {
  const target = currentBuildItem() ?? document.querySelector<HTMLElement>('[aria-label="Build"]');
  if (!target) return false;
  target.focus();
  target.scrollIntoView?.({ block: "nearest" });
  return true;
}

/** "Skip to build": the page's first stop. Hidden until focused, then at the top-left of the composer box. */
export function SkipToBuild() {
  const [focused, setFocused] = useState(false);
  const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
  const shown: CSSProperties = {
    position: "absolute",
    left: 18,
    top: HEADER_HEIGHT + 12,
    zIndex: 40,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    background: t.window,
    border: `1px solid ${t.windowBorder}`,
    textDecoration: "none",
    ...text(13, 500, t.text),
    ...ring(true),
  };
  return (
    <a
      href="#build"
      data-testid="skip-to-build"
      style={focused ? shown : hidden}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        if (focusBuild()) event.preventDefault();
      }}
    >
      Skip to build
    </a>
  );
}
