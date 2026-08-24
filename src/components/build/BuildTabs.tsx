// The five tabs of a build page. Only Forks is still dark.
//
// It is rendered and visibly disabled rather than omitted: the strip is the map
// of what a build record is going to hold, and a reader seeing "Forks" greyed
// out learns more than a reader seeing nothing at all.
//
// A tab is live when a panel is handed in for it, never because this file
// hardcodes which ones work. NS-P06 activated Run it yourself by passing one
// and NS-P16 activated Watch it get built and Where it broke the same way; the
// one still dark goes the same way when its panel exists.
//
// Selection is uncontrolled by default and controlled when a caller passes
// `active`. The build page takes control so that a link out of one panel — a
// breakage saying "watch it" — can land the reader in another.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { HAIRLINE, ORANGE, TEXT_MUTED, TEXT_SECONDARY, labelText } from "./tokens";

interface BuildTabsProps {
  /** The Anatomy panel. */
  children: ReactNode;
  /** The Watch it get built panel. Absent leaves the tab disabled. */
  watch?: ReactNode;
  /** The Run it yourself panel. Absent leaves the tab disabled. */
  run?: ReactNode;
  /** The Where it broke panel. Absent leaves the tab disabled. */
  broke?: ReactNode;
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

const TABS: TabDef[] = [
  { id: "anatomy", label: "Anatomy" },
  { id: "watch", label: "Watch it get built" },
  { id: "run", label: "Run it yourself" },
  { id: "broke", label: "Where it broke" },
  { id: "forks", label: "Forks", placeholder: "Derived builds — soon" },
];

const tabBase: CSSProperties = {
  ...labelText,
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
};

export function BuildTabs({
  children,
  watch,
  run,
  broke,
  active,
  onActiveChange,
}: BuildTabsProps) {
  const [own, setOwn] = useState("anatomy");

  const panels: Record<string, ReactNode> = { anatomy: children };
  if (watch !== undefined) panels.watch = watch;
  if (run !== undefined) panels.run = run;
  if (broke !== undefined) panels.broke = broke;

  const live = TABS.filter((tab) => panels[tab.id] !== undefined);
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
          borderBottom: `1px solid ${HAIRLINE}`,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
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
                color: selected ? ORANGE : enabled ? TEXT_SECONDARY : TEXT_MUTED,
                borderBottom: selected ? `2px solid ${ORANGE}` : "2px solid transparent",
                cursor: enabled ? "pointer" : "not-allowed",
              }}
            >
              <span>{tab.label}</span>
              {tab.placeholder ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 300,
                    letterSpacing: 0,
                    color: TEXT_MUTED,
                  }}
                >
                  {tab.placeholder}
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 300, color: TEXT_SECONDARY }}>
                  &nbsp;
                </span>
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
