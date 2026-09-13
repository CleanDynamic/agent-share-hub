// The tabs of a build page. Every one of them is live.
//
// THE LAST DARK TAB WAS "FORKS — DERIVED BUILDS, SOON", and NS-P40 is what it
// was waiting for. It is now Rebuilds, and it carries no placeholder, because
// the thing it advertised has arrived: a greyed "soon" on a shipped feature is
// a worse lie than an absent tab. So it follows the Understand it rule below
// rather than the placeholder rule — present when there is something to show,
// gone when there is not. A build nobody has rebuilt has no Rebuilds tab, and
// the rebuild count in its header does not render either, so the strip and the
// header agree about the same silence.
//
// UNDERSTAND IT AND REBUILDS ARE THE TABS THAT DISAPPEAR. Understand it exists
// only where a creator has approved a generated understand layer; Rebuilds
// only where a published rebuild exists. A tab is rendered when it has a panel
// OR it declares a placeholder, and neither of those two declares one.
//
// A tab is live when a panel is handed in for it, never because this file
// hardcodes which ones work. NS-P06 activated Run it yourself by passing one,
// NS-P16 activated Watch it get built and Where it broke the same way, and
// NS-P40 activated Rebuilds the same way again.
//
// Selection is uncontrolled by default and controlled when a caller passes
// `active`. The build page takes control so that a link out of one panel — a
// breakage saying "watch it" — can land the reader in another.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { label as labelType } from "@/lib/theme/type";

interface BuildTabsProps {
  /** The Anatomy panel. */
  children: ReactNode;
  /** The Watch it get built panel. Absent leaves the tab disabled. */
  watch?: ReactNode;
  /** The Run it yourself panel. Absent leaves the tab disabled. */
  run?: ReactNode;
  /** The approved understand layer. Absent removes the tab entirely. */
  understand?: ReactNode;
  /** The Where it broke panel. Absent leaves the tab disabled. */
  broke?: ReactNode;
  /** The Rebuilds panel. Absent removes the tab entirely — see the header. */
  rebuilds?: ReactNode;
  /** Controlled selection. Omit to let the strip own it. */
  active?: string;
  /** Fires on every selection, controlled or not. */
  onActiveChange?: (id: string) => void;
}

interface TabDef {
  id: string;
  label: string;
  /** One line, shown under the label, for the tabs that are not built yet. */
  placeholder?: string;
}

// Understand it sits beside Run it yourself rather than at the end: they are
// the two readings of the same record, and a reader who wants the explanation
// looks for it next to the instructions, not past the breakages.
const TABS: TabDef[] = [
  { id: "anatomy", label: "Anatomy" },
  { id: "watch", label: "Watch it get built" },
  { id: "run", label: "Run it yourself" },
  { id: "understand", label: "Understand it" },
  { id: "broke", label: "Where it broke" },
  { id: "rebuilds", label: "Rebuilds" },
];

/* ── BG-P21 — the tab strip, on BG-P07's treatment ────────────────────────────

   THE CURRENT TAB IS AN `--action` UNDERLINE AND `--text`, NOT A FILL. The row
   is six labels with one of them current; a filled pill would make that one
   read as a button while its five neighbours read as text, and the strip would
   stop being a set of peers. BG-P07 settled this for the app's own tab
   component and this strip follows it rather than inventing a second answer.

   THE UNDERLINE OCCUPIES ITS SPACE AT REST. Every tab carries
   `2px solid transparent` whether it is current or not, so becoming current
   changes a colour and never a box — nothing in the row shifts sideways when
   the reader moves between tabs. That was already true here and it stays true;
   it is also why the underline is a border rather than the inset box-shadow
   the Radix component needs, where the border would have added 2px.

   A DISABLED TAB READS AS QUIET, NOT AS BROKEN. It sits on `--text2` like the
   others and is told apart by its cursor and `aria-disabled`, because the
   third text rung this file used to reach for is below the contrast floor in
   both rooms — a label nobody can read is not a quieter label.
   ─────────────────────────────────────────────────────────────────────────── */

const tabBase: CSSProperties = {
  ...labelType,
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "10px 2px",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  alignItems: "flex-start",
  textAlign: "left",
  whiteSpace: "nowrap",
  transition: "color 160ms cubic-bezier(.2,.6,.35,1), border-color 160ms cubic-bezier(.2,.6,.35,1)",
};

export function BuildTabs({
  children,
  watch,
  run,
  understand,
  broke,
  rebuilds,
  active,
  onActiveChange,
}: BuildTabsProps) {
  const [own, setOwn] = useState("anatomy");
  /** Which tab has the keyboard, so only that one draws the focus ring. */
  const [focused, setFocused] = useState<string | null>(null);

  const panels: Record<string, ReactNode> = { anatomy: children };
  if (watch !== undefined) panels.watch = watch;
  if (run !== undefined) panels.run = run;
  if (understand !== undefined) panels.understand = understand;
  if (broke !== undefined) panels.broke = broke;
  if (rebuilds !== undefined) panels.rebuilds = rebuilds;

  const live = TABS.filter((tab) => panels[tab.id] !== undefined);
  // A tab with neither a panel nor a placeholder has nothing to say, so it is
  // not in the strip at all.
  const shown = TABS.filter((tab) => panels[tab.id] !== undefined || tab.placeholder);
  const selected = active ?? own;
  const current = panels[selected] !== undefined ? selected : "anatomy";

  const setActive = (id: string) => {
    // The internal state is kept in step even when a caller controls the
    // selection, so dropping the prop later does not snap the strip back to a
    // tab the reader left three clicks ago.
    setOwn(id);
    onActiveChange?.(id);
  };

  /** Left and right move between the live tabs, as a tablist is expected to. */
  const onKeyDown = (event: React.KeyboardEvent, id: string) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = live.findIndex((tab) => tab.id === id);
    const next = live[(index + step + live.length) % live.length];
    setActive(next.id);
    document.getElementById(`build-tab-${next.id}`)?.focus();
  };

  return (
    <section data-visual-slot="build-tabs">
      <div
        role="tablist"
        aria-label="Build sections"
        style={{
          display: "flex",
          gap: 24,
          borderBottom: `1px solid ${t.line}`,
          overflowX: "auto",
        }}
      >
        {shown.map((tab) => {
          const enabled = panels[tab.id] !== undefined;
          const selected = enabled && tab.id === current;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`build-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={selected ? `build-panel-${tab.id}` : undefined}
              aria-disabled={!enabled}
              disabled={!enabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => enabled && setActive(tab.id)}
              onKeyDown={(event) => enabled && onKeyDown(event, tab.id)}
              style={{
                ...tabBase,
                color: selected ? t.text : t.text2,
                borderBottom: selected ? `2px solid ${t.action}` : "2px solid transparent",
                cursor: enabled ? "pointer" : "not-allowed",
                ...ring(focused === tab.id),
              }}
              onFocus={(event) => {
                let visible = true;
                try {
                  visible = event.currentTarget.matches(":focus-visible");
                } catch {
                  /* :focus-visible unsupported. Show the ring rather than hide it. */
                }
                if (visible) setFocused(tab.id);
              }}
              onBlur={() => setFocused((current) => (current === tab.id ? null : current))}
            >
              <span>{tab.label}</span>
              {/* The second line keeps the row's height whether a tab has a
                  placeholder or not, so the strip does not grow the first time
                  one appears. Weight 400: the theme forbids Figtree under 400
                  below 18px outright, and this line was set at 300. */}
              {tab.placeholder ? (
                <span style={{ ...labelType, fontSize: 11, color: t.text2 }}>
                  {tab.placeholder}
                </span>
              ) : (
                <span style={{ ...labelType, fontSize: 11, color: t.text2 }}>&nbsp;</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`build-panel-${current}`}
        aria-labelledby={`build-tab-${current}`}
        style={{ paddingTop: 24 }}
      >
        {panels[current]}
      </div>
    </section>
  );
}

export default BuildTabs;
